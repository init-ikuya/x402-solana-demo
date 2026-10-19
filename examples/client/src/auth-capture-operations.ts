import { createHash } from "node:crypto";
import {
  address, getBase58Decoder, getTransactionDecoder, type TransactionSigner,
} from "@solana/kit";
import {
  AUTH_CAPTURE_PROGRAM, holdOperationInstruction, paymentAddress,
} from "../../shared/anchor-auth-capture.js";
import { signedTransaction, tokenAddress } from "../../shared/anchor-upto.js";

const ACCOUNT_SIZE = 266;
const DISCRIMINATOR = createHash("sha256").update("account:AuthCapturePayment").digest().subarray(0, 8);

type RpcAccount = { owner: string; data: [string, string] };

export type AuthPaymentState = {
  id: string; payer: string; merchant: string; mint: string;
  payerToken: string; merchantToken: string; vault: string;
  funded: bigint; captured: bigint; released: bigint; refunded: bigint;
  nextOperation: bigint; nonce: bigint; captureDeadline: bigint; refundDeadline: bigint;
  holdClosed: boolean;
};

async function rpc<T>(url: string, method: string, params: unknown[], fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} RPC returned HTTP ${response.status}`);
  const result = await response.json() as { result?: T; error?: { message?: string } };
  if (result.error || result.result === undefined) {
    throw new Error(`${method} RPC failed: ${result.error?.message ?? "missing result"}`);
  }
  return result.result;
}

export async function readAuthPayment(
  id: string, rpcUrl: string, fetchImpl: typeof fetch = fetch,
): Promise<AuthPaymentState> {
  const paymentId = address(id);
  const result = await rpc<{ value: RpcAccount | null }>(rpcUrl, "getAccountInfo",
    [paymentId, { encoding: "base64", commitment: "confirmed" }], fetchImpl);
  if (!result.value || result.value.owner !== AUTH_CAPTURE_PROGRAM || result.value.data?.[1] !== "base64") {
    throw new Error("Auth-capture payment account is missing or has the wrong owner");
  }
  const bytes = Buffer.from(result.value.data[0], "base64");
  if (bytes.length !== ACCOUNT_SIZE || !bytes.subarray(0, 8).equals(DISCRIMINATOR)) {
    throw new Error("Auth-capture payment account has an invalid layout");
  }
  const key = (offset: number) => getBase58Decoder().decode(bytes.subarray(offset, offset + 32));
  const state: AuthPaymentState = {
    id: paymentId, payer: key(8), merchant: key(40), mint: key(72),
    payerToken: key(104), merchantToken: key(136), vault: key(168),
    funded: bytes.readBigUInt64LE(200), captured: bytes.readBigUInt64LE(208),
    released: bytes.readBigUInt64LE(216), refunded: bytes.readBigUInt64LE(224),
    nextOperation: bytes.readBigUInt64LE(232), nonce: bytes.readBigUInt64LE(240),
    captureDeadline: bytes.readBigInt64LE(248), refundDeadline: bytes.readBigInt64LE(256),
    holdClosed: bytes[264] === 1,
  };
  if (await paymentAddress(state.payer, state.nonce) !== paymentId ||
      await tokenAddress(state.payer, state.mint) !== state.payerToken ||
      await tokenAddress(state.merchant, state.mint) !== state.merchantToken ||
      await tokenAddress(paymentId, state.mint) !== state.vault ||
      state.captured + state.released > state.funded || state.refunded > state.captured) {
    throw new Error("Auth-capture payment state is inconsistent");
  }
  return state;
}

export type AuthOperation = "capture_hold" | "capture_and_void_hold" | "void_hold" | "reclaim_hold" | "refund_captured";

/** Submit one lifecycle operation after reading its current on-chain sequence. */
export async function executeAuthOperation(options: {
  paymentId: string; authority: TransactionSigner; action: AuthOperation;
  amount?: bigint; rpcUrl: string; fetchImpl?: typeof fetch;
  pollIntervalMs?: number; timeoutMs?: number;
}): Promise<{ signature: string; before: AuthPaymentState; after: AuthPaymentState }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const state = await readAuthPayment(options.paymentId, options.rpcUrl, fetchImpl);
  const isReclaim = options.action === "reclaim_hold";
  if (options.authority.address !== (isReclaim ? state.payer : state.merchant)) {
    throw new Error("The configured key is not authorized for this payment operation");
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (isReclaim && now < state.captureDeadline) throw new Error("Capture deadline has not passed");
  if (["capture_hold", "capture_and_void_hold"].includes(options.action) && now >= state.captureDeadline) {
    throw new Error("Capture deadline has passed");
  }
  if (options.action === "refund_captured" && now >= state.refundDeadline) {
    throw new Error("Refund deadline has passed");
  }
  const amount = options.amount ?? 0n;
  const needsAmount = ["capture_hold", "capture_and_void_hold", "refund_captured"].includes(options.action);
  if (amount < 0n || (!needsAmount && amount !== 0n) ||
      (needsAmount && options.action !== "capture_and_void_hold" && amount === 0n)) {
    throw new Error("Invalid auth-capture operation amount");
  }
  const remaining = state.funded - state.captured - state.released;
  if (options.action !== "refund_captured" && (state.holdClosed || remaining === 0n || amount > remaining)) {
    throw new Error("The hold has no sufficient remaining balance");
  }
  if (options.action === "refund_captured" && amount > state.captured - state.refunded) {
    throw new Error("Refund exceeds captured funds");
  }
  const { instruction } = await holdOperationInstruction({
    authority: options.authority, payer: state.payer, merchant: state.merchant,
    mint: state.mint, nonce: state.nonce, type: options.action,
    sequence: state.nextOperation, amount,
  });
  const wire = await signedTransaction(instruction, options.authority.address, options.rpcUrl);
  const signatureBytes = getTransactionDecoder().decode(Buffer.from(wire, "base64"))
    .signatures[address(options.authority.address)];
  if (!signatureBytes) throw new Error("Operation transaction is missing the authority signature");
  const signature = getBase58Decoder().decode(signatureBytes);
  try {
    const submitted = await rpc<string>(options.rpcUrl, "sendTransaction",
      [wire, { encoding: "base64", preflightCommitment: "confirmed" }], fetchImpl);
    if (submitted !== signature) throw new Error("RPC returned a different operation signature");
  } catch (error) {
    throw new Error(`Submission outcome is uncertain; check signature ${signature} before retrying`, { cause: error });
  }
  const deadline = Date.now() + (options.timeoutMs ?? 30_000);
  do {
    let status: { err: unknown; confirmationStatus: string | null } | null;
    try {
      const result = await rpc<{ value: Array<{ err: unknown; confirmationStatus: string | null } | null> }>(
        options.rpcUrl, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }], fetchImpl);
      status = result.value[0];
    } catch (error) {
      throw new Error(`Operation outcome is uncertain; check signature ${signature} before retrying`, { cause: error });
    }
    if (status?.err) throw new Error(`Operation ${signature} failed on-chain: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      const after = await readAuthPayment(options.paymentId, options.rpcUrl, fetchImpl);
      if (after.nextOperation === state.nextOperation + 1n) {
        return { signature, before: state, after };
      }
    }
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, options.pollIntervalMs ?? 1000));
  } while (true);
  throw new Error(`Operation confirmation timed out; check signature ${signature} before retrying`);
}

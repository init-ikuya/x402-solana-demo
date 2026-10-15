import { createHash } from "node:crypto";
import { address, getBase58Decoder, getTransactionDecoder, type TransactionSigner } from "@solana/kit";
import {
  ANCHOR_UPTO_PROGRAM, channelAddress, refundInstruction, signedTransaction,
} from "../../shared/anchor-upto.js";

const CHANNEL_ACCOUNT_SIZE = 8 + 32 * 4 + 8 * 3 + 1;
const CHANNEL_DISCRIMINATOR = createHash("sha256").update("account:PaymentChannel").digest().subarray(0, 8);

type RpcAccount = { owner: string; data: [string, string] };
type ProgramAccount = { pubkey: string; account: RpcAccount };

export interface RefundChannel {
  id: string;
  payer: string;
  merchant: string;
  mint: string;
  rentPayer: string;
  maxAmount: bigint;
  expiresAt: bigint;
  nonce: bigint;
}

export interface UptoRefundOptions {
  payer: TransactionSigner;
  merchant: string;
  mint: string;
  rpcUrl: string;
  channelId?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

async function rpc<T>(url: string, method: string, params: unknown[], fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} RPC returned HTTP ${response.status}`);
  const result = await response.json() as { result?: T; error?: { message?: string } };
  if (result.error || result.result === undefined) throw new Error(`${method} RPC failed: ${result.error?.message ?? "missing result"}`);
  return result.result;
}

function readChannel(id: string, account: RpcAccount): RefundChannel {
  if (account.owner !== ANCHOR_UPTO_PROGRAM || account.data?.[1] !== "base64") {
    throw new Error(`Channel ${id} is not owned by this repository's Anchor program`);
  }
  const bytes = Buffer.from(account.data[0], "base64");
  if (bytes.length !== CHANNEL_ACCOUNT_SIZE || !bytes.subarray(0, 8).equals(CHANNEL_DISCRIMINATOR)) {
    throw new Error(`Channel ${id} has an invalid account layout`);
  }
  const key = (offset: number) => getBase58Decoder().decode(bytes.subarray(offset, offset + 32));
  return {
    id, payer: key(8), merchant: key(40), mint: key(72), rentPayer: key(104),
    maxAmount: bytes.readBigUInt64LE(136), expiresAt: bytes.readBigInt64LE(144),
    nonce: bytes.readBigUInt64LE(152),
  };
}

/** Discover one refundable channel. Explicit ID avoids RPC program-index requirements. */
export async function findRefundChannel(options: UptoRefundOptions): Promise<RefundChannel> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let entries: ProgramAccount[];
  if (options.channelId) {
    const id = address(options.channelId);
    const result = await rpc<{ value: RpcAccount | null }>(options.rpcUrl, "getAccountInfo",
      [id, { encoding: "base64", commitment: "confirmed" }], fetchImpl);
    if (!result.value) throw new Error(`Channel ${id} does not exist`);
    entries = [{ pubkey: id, account: result.value }];
  } else {
    entries = await rpc<ProgramAccount[]>(options.rpcUrl, "getProgramAccounts", [ANCHOR_UPTO_PROGRAM, {
      encoding: "base64", commitment: "confirmed",
      filters: [{ dataSize: CHANNEL_ACCOUNT_SIZE }, { memcmp: { offset: 8, bytes: options.payer.address } }],
    }], fetchImpl);
  }
  const channels: RefundChannel[] = [];
  for (const entry of entries) {
    const channel = readChannel(entry.pubkey, entry.account);
    if (channel.payer !== options.payer.address || channel.merchant !== options.merchant || channel.mint !== options.mint) {
      if (options.channelId) throw new Error(`Channel ${channel.id} does not match the configured payer, merchant, and mint`);
      continue;
    }
    if (await channelAddress(channel.payer, channel.merchant, channel.mint, channel.nonce) !== channel.id) {
      throw new Error(`Channel ${channel.id} does not match its PDA seeds`);
    }
    channels.push(channel);
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  const eligible = channels.filter(channel => channel.expiresAt < now);
  if (options.channelId && !eligible.length) {
    throw new Error(`Channel ${options.channelId} expires at ${channels[0].expiresAt}; refund is not available yet`);
  }
  if (!eligible.length) throw new Error("No expired upto channel for the configured payer, merchant, and mint");
  if (eligible.length > 1) {
    throw new Error(`Multiple expired channels found; set UPTO_CHANNEL_ID to one of: ${eligible.map(channel => channel.id).join(", ")}`);
  }
  return eligible[0];
}

/** Sign and submit a payer-funded refund without contacting the gateway or facilitator. */
export async function refundUptoChannel(options: UptoRefundOptions): Promise<{ channel: RefundChannel; signature: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const channel = await findRefundChannel(options);
  const { instruction } = await refundInstruction({
    payer: options.payer, merchant: channel.merchant, rentPayer: channel.rentPayer,
    mint: channel.mint, nonce: channel.nonce,
  });
  const wire = await signedTransaction(instruction, options.payer.address, options.rpcUrl);
  const signatureBytes = getTransactionDecoder().decode(Buffer.from(wire, "base64")).signatures[address(options.payer.address)];
  if (!signatureBytes) throw new Error("Refund transaction is missing the payer signature");
  const signature = getBase58Decoder().decode(signatureBytes);
  try {
    const submitted = await rpc<string>(options.rpcUrl, "sendTransaction", [wire, {
      encoding: "base64", preflightCommitment: "confirmed",
    }], fetchImpl);
    if (submitted !== signature) throw new Error("RPC returned a different refund transaction signature");
  } catch (error) {
    throw new Error(`Refund submission is uncertain; check signature ${signature} before retrying`, { cause: error });
  }
  const deadline = Date.now() + (options.timeoutMs ?? 30_000);
  do {
    let status: { err: unknown; confirmationStatus: string | null } | null;
    try {
      const result = await rpc<{ value: Array<{ err: unknown; confirmationStatus: string | null } | null> }>(
        options.rpcUrl, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }], fetchImpl);
      status = result.value[0];
    } catch (error) {
      throw new Error(`Refund outcome is uncertain; check signature ${signature} before retrying`, { cause: error });
    }
    if (status?.err) throw new Error(`Refund transaction ${signature} failed on-chain: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return { channel, signature };
    }
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, options.pollIntervalMs ?? 1000));
  } while (true);
  throw new Error(`Refund confirmation timed out; check signature ${signature} before retrying`);
}

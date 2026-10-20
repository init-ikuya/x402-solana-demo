import { getBase58Decoder, getTransactionDecoder } from "@solana/kit";
import { BATCH_CLAIM_GRACE_SECONDS, closeBatchInstruction, readBatchChannel } from "../../shared/anchor-batch.js";
import { signedSelfFundedTransaction } from "../../shared/anchor-upto.js";
import { AtomicJsonStore } from "../../shared/atomic-json-store.js";
import { type AnchorBatchClientRecord } from "./anchor-batch-client.js";
import { DEVNET_USDC } from "./constants.js";
import { loadKeypair } from "./keypair.js";

const signer = await loadKeypair(
  process.env.PAYMENT_CLIENT_KEYPAIR_FILE ?? process.env.EXACT_CLIENT_KEYPAIR_FILE,
  process.env.PAYMENT_CLIENT_SECRET_KEY ?? process.env.EXACT_CLIENT_SECRET_KEY,
);
const rpcUrl = process.env.PAYMENT_RPC_URL ?? "https://api.devnet.solana.com";
const store = new AtomicJsonStore<AnchorBatchClientRecord>(
  process.env.BATCH_CLIENT_STORE_FILE ?? ".local/anchor-batch-client.json",
);
const candidates = (await store.list()).filter(record => record.payer === signer.address &&
  record.mint === DEVNET_USDC && (!process.env.GATEWAY_PAY_TO || record.merchant === process.env.GATEWAY_PAY_TO));
const channelId = process.env.BATCH_CHANNEL_ID ?? (candidates.length === 1 ? candidates[0].channelId : undefined);
if (!channelId) throw new Error("Set BATCH_CHANNEL_ID or keep exactly one matching channel in BATCH_CLIENT_STORE_FILE");
const state = await readBatchChannel(channelId, rpcUrl);
if (state.payer !== signer.address || state.mint !== DEVNET_USDC) throw new Error("Batch channel does not match the configured payer or asset");
const closeAfter = state.expiresAt + BigInt(BATCH_CLAIM_GRACE_SECONDS);
if (BigInt(Math.floor(Date.now() / 1000)) <= closeAfter + 5n) {
  throw new Error(`Batch claim window ends after Unix timestamp ${closeAfter}; close after that time`);
}
const { instruction } = await closeBatchInstruction({
  payer: state.payer, merchant: state.merchant, mint: state.mint,
  nonce: state.nonce, rentPayer: state.rentPayer,
});
const wire = await signedSelfFundedTransaction(instruction, signer, rpcUrl);
const signatureBytes = Object.values(getTransactionDecoder().decode(Buffer.from(wire, "base64")).signatures)[0];
if (!signatureBytes) throw new Error("Missing close transaction signature");
const signature = getBase58Decoder().decode(signatureBytes);
const request = async <T>(method: string, params: unknown[]): Promise<T> => {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const result = await response.json() as { result?: T; error?: { message?: string } };
  if (!response.ok || result.error || result.result === undefined) throw new Error(`${method} failed: ${result.error?.message ?? response.status}`);
  return result.result;
};
const sent = await request<string>("sendTransaction", [wire, { encoding: "base64", preflightCommitment: "confirmed" }]);
if (sent !== signature) throw new Error("RPC returned a different close signature");
const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  const result = await request<{ value: Array<{ err: unknown; confirmationStatus: string | null } | null> }>(
    "getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
  const status = result.value[0];
  if (status?.err) throw new Error(`Batch close failed on chain: ${JSON.stringify(status.err)}`);
  if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
    console.log(JSON.stringify({ channelId, signature, refundedAtomicUnits: (state.deposit - state.claimed).toString() }));
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
throw new Error(`Batch close outcome is uncertain; check signature ${signature}`);

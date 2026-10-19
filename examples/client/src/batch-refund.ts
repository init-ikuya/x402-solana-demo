import { BatchPaymentClient, FileBatchClientStorage } from "./batch-client.js";
import { loadKeypair } from "./keypair.js";

const signer = await loadKeypair(
  process.env.PAYMENT_CLIENT_KEYPAIR_FILE ?? process.env.EXACT_CLIENT_KEYPAIR_FILE,
  process.env.PAYMENT_CLIENT_SECRET_KEY ?? process.env.EXACT_CLIENT_SECRET_KEY,
);
const client = new BatchPaymentClient(
  signer,
  process.env.PAYMENT_RPC_URL ?? "https://api.devnet.solana.com",
  new FileBatchClientStorage(process.env.BATCH_CLIENT_STORE_FILE ?? ".batch-client-channels.json"),
  BigInt(process.env.BATCH_DEPOSIT_AMOUNT ?? "1000"),
);
const url = process.env.BATCH_RESOURCE_URL ?? "http://127.0.0.1:4021/api/trump-insider/batch";
const result = await client.refund(url);
if (!result.success) throw new Error(`Batch close failed: ${result.errorReason ?? "unknown"}`);
console.log(JSON.stringify(result));

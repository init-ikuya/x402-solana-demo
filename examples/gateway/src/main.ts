import { createApp } from "./app.js";
import { loadKeypair } from "./keypair.js";
import { AnchorBatchServerScheme } from "./anchor-batch-server.js";

const payTo = process.env.GATEWAY_PAY_TO;
if (!payTo) {
  throw new Error("Set GATEWAY_PAY_TO to a Solana wallet address before starting the gateway.");
}

const port = Number(process.env.GATEWAY_PORT ?? "4021");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("GATEWAY_PORT must be an integer from 1 to 65535.");
}

const anchorMerchantSigner = process.env.UPTO_MERCHANT_KEYPAIR_FILE || process.env.UPTO_MERCHANT_SECRET_KEY
  ? await loadKeypair(process.env.UPTO_MERCHANT_KEYPAIR_FILE, process.env.UPTO_MERCHANT_SECRET_KEY)
  : undefined;
const authCaptureMerchantSigner = process.env.AUTH_CAPTURE_ENABLED === "1"
  ? await loadKeypair(process.env.AUTH_CAPTURE_MERCHANT_KEYPAIR_FILE, process.env.AUTH_CAPTURE_MERCHANT_SECRET_KEY)
  : undefined;
const facilitatorUrl = process.env.GATEWAY_FACILITATOR_URL ?? "http://127.0.0.1:4022";
const mode = process.env.GATEWAY_MODE ?? "local";
if (mode !== "local" && mode !== "devnet") throw new Error("GATEWAY_MODE must be local or devnet");
const exactFacilitatorUrl = process.env.GATEWAY_EXACT_FACILITATOR_URL ??
  (mode === "devnet" ? "https://x402.org/facilitator" : undefined);
const batchScheme = process.env.BATCH_ENABLED === "1" ? new AnchorBatchServerScheme(payTo) : undefined;
const app = createApp({
  payTo,
  facilitatorUrl,
  exactFacilitatorUrl,
  anchorMerchantSigner,
  authCaptureMerchantSigner,
  anchorRpcUrl: process.env.AUTH_CAPTURE_RPC_URL ?? process.env.UPTO_RPC_URL ?? "https://api.devnet.solana.com",
  batchScheme,
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Payment gateway listening at http://127.0.0.1:${port}`);
});

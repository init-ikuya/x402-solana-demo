import { createApp } from "./app.js";
import { loadKeypair } from "./keypair.js";

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
const app = createApp({
  payTo,
  facilitatorUrl: process.env.GATEWAY_FACILITATOR_URL ?? "http://127.0.0.1:4022",
  anchorMerchantSigner,
  anchorRpcUrl: process.env.UPTO_RPC_URL ?? "https://api.devnet.solana.com",
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Payment gateway listening at http://127.0.0.1:${port}`);
});

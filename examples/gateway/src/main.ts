import { createApp } from "./app.js";
import { loadKeypair } from "./keypair.js";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { BatchSvmScheme, type BatchChannelManager } from "@x402/svm/batch-settlement/server";
import { FileBatchChannelStore } from "./batch-store.js";
import { BATCH_AMOUNT, DEVNET, DEVNET_USDC } from "./constants.js";

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
const batchRpcUrl = process.env.BATCH_RPC_URL ?? "https://api.devnet.solana.com";
let batchManager: BatchChannelManager | undefined;
const batchReceiver = process.env.BATCH_ENABLED === "1"
  ? await loadKeypair(process.env.BATCH_RECEIVER_KEYPAIR_FILE, process.env.BATCH_RECEIVER_SECRET_KEY)
  : undefined;
const batchScheme = batchReceiver ? new BatchSvmScheme({
  receiverAuthorizer: batchReceiver,
  store: new FileBatchChannelStore(process.env.BATCH_CHANNEL_STORE_FILE ?? ".batch-gateway-channels.json"),
  onChannelClosing: () => { void batchManager?.redeem().catch(error => console.error("Batch redemption failed:", error)); },
}) : undefined;
const app = createApp({
  payTo,
  facilitatorUrl,
  anchorMerchantSigner,
  authCaptureMerchantSigner,
  anchorRpcUrl: process.env.AUTH_CAPTURE_RPC_URL ?? process.env.UPTO_RPC_URL ?? "https://api.devnet.solana.com",
  batchScheme,
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Payment gateway listening at http://127.0.0.1:${port}`);
});

if (batchScheme) {
  const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const supported = await facilitator.getSupported();
  const kind = supported.kinds.find(value => value.x402Version === 2 && value.scheme === "batch-settlement" && value.network === DEVNET);
  if (!kind) throw new Error("Facilitator does not advertise Solana batch-settlement");
  const requirements: PaymentRequirements = {
    scheme: "batch-settlement", network: DEVNET, asset: DEVNET_USDC,
    amount: BATCH_AMOUNT, payTo, maxTimeoutSeconds: 300,
    extra: { voucherSigner: "client", assetTransferMethod: "channel", paymentFlow: "authorization" },
  };
  const enhanced = await batchScheme.enhancePaymentRequirements(requirements, kind, []);
  batchManager = batchScheme.createChannelManager(facilitator, enhanced, {
    rpcUrl: batchRpcUrl,
    onError: error => console.error("Batch redemption failed:", error),
    onClaim: result => console.log(`Batch claim confirmed: ${result.transaction}`),
    onSettle: result => console.log(`Batch distribution confirmed: ${result.transaction}`),
  });
  const interval = Number(process.env.BATCH_REDEEM_INTERVAL_SECONDS ?? "30");
  if (!Number.isSafeInteger(interval) || interval <= 0) throw new Error("Invalid BATCH_REDEEM_INTERVAL_SECONDS");
  batchManager.start(interval);
  console.log(`Batch redemption worker started (${interval}s interval)`);
}

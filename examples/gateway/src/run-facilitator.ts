import { x402Facilitator } from "@x402/core/facilitator";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { address, createSolanaRpc } from "@solana/kit";
import { DEVNET } from "./constants.js";
import { createFacilitatorApp } from "./facilitator.js";
import { loadKeypair } from "./keypair.js";
import { AnchorUptoFacilitatorScheme } from "./anchor-upto-facilitator.js";
import { AnchorBatchFacilitatorScheme, type AnchorBatchRecord } from "./anchor-batch-facilitator.js";
import { AtomicJsonStore } from "../../shared/atomic-json-store.js";
import { ANCHOR_UPTO_PROGRAM } from "../../shared/anchor-upto.js";
import { AnchorAuthCaptureFacilitatorScheme } from "./anchor-auth-capture-facilitator.js";

const payTo = process.env.GATEWAY_PAY_TO;
if (!payTo) throw new Error("Set GATEWAY_PAY_TO");
const signer = await loadKeypair(process.env.FACILITATOR_KEYPAIR_FILE, process.env.FACILITATOR_SECRET_KEY);
const port = Number(process.env.FACILITATOR_PORT ?? "4022");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid FACILITATOR_PORT");
const rpcUrl = process.env.FACILITATOR_RPC_URL ?? "https://api.devnet.solana.com";
const facilitator = new x402Facilitator();
const svmSigner = toFacilitatorSvmSigner(signer, { defaultRpcUrl: rpcUrl });
facilitator.register(DEVNET, new ExactSvmScheme(
  svmSigner,
  undefined,
  { maxPriorityFeeMicroLamports: 1000, maxComputeUnits: 200000, maxRequiredSignatures: 2 },
));
if (process.env.UPTO_ENABLED === "1") {
  const deployed = await createSolanaRpc(rpcUrl).getAccountInfo(address(ANCHOR_UPTO_PROGRAM)).send();
  if (!deployed.value?.executable) throw new Error("Project Anchor program is not deployed at the facilitator RPC endpoint");
  facilitator.register(DEVNET, new AnchorUptoFacilitatorScheme(svmSigner, payTo));
}
if (process.env.AUTH_CAPTURE_ENABLED === "1") {
  const deployed = await createSolanaRpc(rpcUrl).getAccountInfo(address(ANCHOR_UPTO_PROGRAM)).send();
  if (!deployed.value?.executable) throw new Error("Auth-capture Anchor program is not deployed at the facilitator RPC endpoint");
  facilitator.register(DEVNET, new AnchorAuthCaptureFacilitatorScheme(svmSigner, payTo));
}
if (process.env.BATCH_ENABLED === "1") {
  const deployed = await createSolanaRpc(rpcUrl).getAccountInfo(address(ANCHOR_UPTO_PROGRAM)).send();
  if (!deployed.value?.executable) throw new Error("Anchor batch program is not deployed at the facilitator RPC endpoint");
  const batch = new AnchorBatchFacilitatorScheme(svmSigner, payTo, rpcUrl,
    new AtomicJsonStore<AnchorBatchRecord>(process.env.BATCH_FACILITATOR_STORE_FILE ?? ".local/anchor-batch-facilitator.json"));
  facilitator.register(DEVNET, batch);
  const seconds = Number(process.env.BATCH_REDEEM_INTERVAL_SECONDS ?? "30");
  if (!Number.isSafeInteger(seconds) || seconds < 1) throw new Error("Invalid BATCH_REDEEM_INTERVAL_SECONDS");
  setInterval(() => { void batch.redeem().catch(error => console.error("Batch redemption failed:", error)); }, seconds * 1000);
}
createFacilitatorApp(facilitator, payTo, signer.address).listen(port, "127.0.0.1", () => {
  console.log(`Payment facilitator listening at http://127.0.0.1:${port}`);
});

import { x402Facilitator } from "@x402/core/facilitator";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { address, createSolanaRpc } from "@solana/kit";
import { DEVNET } from "./constants.js";
import { createFacilitatorApp } from "./facilitator.js";
import { loadKeypair } from "./keypair.js";
import { AnchorUptoFacilitatorScheme } from "./anchor-upto-facilitator.js";
import { ANCHOR_UPTO_PROGRAM } from "../../shared/anchor-upto.js";

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
createFacilitatorApp(facilitator, payTo, signer.address).listen(port, "127.0.0.1", () => {
  console.log(`Payment facilitator listening at http://127.0.0.1:${port}`);
});

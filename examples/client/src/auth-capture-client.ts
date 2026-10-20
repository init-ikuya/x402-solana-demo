import { randomBytes } from "node:crypto";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import { findDefaultAsset, type ClientSvmSigner } from "@x402/svm";
import {
  AUTH_CAPTURE_BINDING, AUTH_CAPTURE_PROGRAM, AUTH_CAPTURE_SCHEME,
  authorizeHoldInstruction,
} from "../../shared/anchor-auth-capture.js";
import { signedTransaction } from "../../shared/anchor-upto.js";
import { DEVNET } from "./constants.js";
import type { ExactClientOptions, ExactPaymentLimits, PaidResource } from "./exact-client.js";

class AuthCaptureClientScheme implements SchemeNetworkClient {
  readonly scheme = AUTH_CAPTURE_SCHEME;
  readonly findDefaultAsset = findDefaultAsset;
  constructor(private readonly signer: ClientSvmSigner, private readonly rpcUrl: string) {}

  async createPaymentPayload(_version: number, requirements: PaymentRequirements) {
    const feePayer = requirements.extra.feePayer;
    if (typeof feePayer !== "string" || requirements.extra.programId !== AUTH_CAPTURE_PROGRAM ||
        requirements.extra.binding !== AUTH_CAPTURE_BINDING) {
      throw new Error("Invalid Anchor auth-capture payment requirements");
    }
    const nonce = randomBytes(8).readBigUInt64LE();
    const captureDeadline = BigInt(String(requirements.extra.captureDeadline));
    const refundDeadline = BigInt(String(requirements.extra.refundDeadline));
    const { payment, instruction } = await authorizeHoldInstruction({
      payer: this.signer, feePayer, merchant: requirements.payTo, mint: requirements.asset,
      nonce, amount: BigInt(requirements.amount), captureDeadline, refundDeadline,
    });
    return { x402Version: 2, payload: {
      payer: this.signer.address, nonce: nonce.toString(),
      captureDeadline: captureDeadline.toString(), refundDeadline: refundDeadline.toString(),
      paymentId: payment, authorizeTransaction: await signedTransaction(instruction, feePayer, this.rpcUrl),
    } };
  }
}

function acceptable(requirement: PaymentRequirements, limits: ExactPaymentLimits): boolean {
  return requirement.scheme === AUTH_CAPTURE_SCHEME && requirement.network === DEVNET &&
    requirement.asset === limits.asset && requirement.payTo === limits.payTo &&
    /^[1-9]\d*$/.test(requirement.amount) && BigInt(requirement.amount) <= limits.maxAmount &&
    requirement.maxTimeoutSeconds === 300 &&
    requirement.extra.programId === AUTH_CAPTURE_PROGRAM &&
    requirement.extra.binding === AUTH_CAPTURE_BINDING &&
    typeof requirement.extra.feePayer === "string" &&
    requirement.extra.assetTransferMethod === "escrow" &&
    requirement.extra.paymentFlow === "escrow" &&
    typeof requirement.extra.captureDeadline === "string" &&
    /^\d+$/.test(requirement.extra.captureDeadline) &&
    typeof requirement.extra.refundDeadline === "string" &&
    /^\d+$/.test(requirement.extra.refundDeadline) &&
    BigInt(requirement.extra.captureDeadline) > BigInt(Math.floor(Date.now() / 1000)) &&
    BigInt(requirement.extra.refundDeadline) >= BigInt(requirement.extra.captureDeadline);
}

/** Experimental escrow-only auth-capture paid API flow. */
export async function payForAuthCaptureResource(
  url: string,
  limits: ExactPaymentLimits,
  signer: ClientSvmSigner,
  fetchImpl: typeof fetch = fetch,
  options: ExactClientOptions = {},
): Promise<PaidResource> {
  if (limits.maxAmount <= 0n) throw new Error("maxAmount must be positive");
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("Expected an HTTP URL");
  const initial = await fetchImpl(target);
  if (initial.status !== 402) throw new Error(`Expected HTTP 402, received ${initial.status}`);
  const core = new x402Client((_version, requirements) => requirements[0])
    .setSpendControls({ allowedAssets: [{ network: DEVNET, asset: limits.asset,
      maxAmountPerPayment: limits.maxAmount.toString() }] });
  core.register(DEVNET, new AuthCaptureClientScheme(signer, options.rpcUrl ?? "https://api.devnet.solana.com"));
  const http = new x402HTTPClient(core);
  let required: PaymentRequired;
  try { required = http.getPaymentRequiredResponse(name => initial.headers.get(name)); }
  catch { throw new Error("Invalid PAYMENT-REQUIRED header"); }
  if (required.x402Version !== 2 || !Array.isArray(required.accepts) ||
      new URL(required.resource.url, target).href !== target.href) {
    throw new Error("Invalid x402 payment requirements");
  }
  const accepted = required.accepts.find(option => acceptable(option, limits));
  if (!accepted) throw new Error("No acceptable Anchor auth-capture payment requirement");
  options.onQuoteAccepted?.(BigInt(accepted.amount));
  const payload = await http.createPaymentPayload({ ...required, accepts: [accepted] });
  const paymentId = payload.payload.paymentId;
  if (typeof paymentId !== "string") throw new Error("Missing auth-capture payment ID");
  options.onBeforePaidRequest?.();
  const paid = await fetchImpl(target, { headers: http.encodePaymentSignatureHeader(payload) });
  if (!paid.ok) throw new Error(`Paid request failed with HTTP ${paid.status}; check payment ${paymentId} before retrying`);
  let settlement;
  try { settlement = http.getPaymentSettleResponse(name => paid.headers.get(name)); }
  catch { throw new Error(`Paid response has no valid PAYMENT-RESPONSE; check payment ${paymentId} before retrying`); }
  if (!settlement.success || settlement.network !== DEVNET || !settlement.transaction ||
      typeof settlement.amount !== "string" || !/^\d+$/.test(settlement.amount) ||
      BigInt(settlement.amount) > BigInt(accepted.amount) ||
      settlement.extra?.paymentId !== paymentId) {
    throw new Error(`Auth-capture settlement was not confirmed; check payment ${paymentId} before retrying`);
  }
  return { response: paid, settlement };
}

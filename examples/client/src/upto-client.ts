import { randomBytes } from "node:crypto";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import { findDefaultAsset, type ClientSvmSigner } from "@x402/svm";
import {
  ANCHOR_UPTO_PROGRAM, UPTO_SCHEME, openInstruction, signedTransaction,
} from "../../shared/anchor-upto.js";
import { DEVNET } from "./constants.js";
import type { ExactClientOptions, ExactPaymentLimits, PaidResource } from "./exact-client.js";

class UptoClientScheme implements SchemeNetworkClient {
  readonly scheme = UPTO_SCHEME;
  readonly findDefaultAsset = findDefaultAsset;
  constructor(private readonly signer: ClientSvmSigner, private readonly rpcUrl: string) {}

  async createPaymentPayload(_version: number, requirements: PaymentRequirements) {
    const feePayer = requirements.extra.feePayer;
    if (typeof feePayer !== "string" || requirements.extra.programId !== ANCHOR_UPTO_PROGRAM) {
      throw new Error("Invalid Anchor upto payment requirements");
    }
    const nonce = randomBytes(8).readBigUInt64LE();
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds);
    const { channel, instruction } = await openInstruction({
      payer: this.signer, feePayer, merchant: requirements.payTo, mint: requirements.asset,
      nonce, maxAmount: BigInt(requirements.amount), expiresAt,
    });
    return { x402Version: 2, payload: {
      payer: this.signer.address, nonce: nonce.toString(), expiresAt: expiresAt.toString(),
      channelId: channel, openTransaction: await signedTransaction(instruction, feePayer, this.rpcUrl),
    } };
  }
}

function acceptable(requirement: PaymentRequirements, limits: ExactPaymentLimits): boolean {
  return requirement.scheme === UPTO_SCHEME && requirement.network === DEVNET &&
    requirement.asset === limits.asset && requirement.payTo === limits.payTo &&
    /^[1-9]\d*$/.test(requirement.amount) && BigInt(requirement.amount) <= limits.maxAmount &&
    Number.isSafeInteger(requirement.maxTimeoutSeconds) && requirement.maxTimeoutSeconds > 0 &&
    requirement.maxTimeoutSeconds <= 300 && requirement.extra.programId === ANCHOR_UPTO_PROGRAM &&
    typeof requirement.extra.feePayer === "string" &&
    requirement.extra.assetTransferMethod === "channel" && requirement.extra.paymentFlow === "escrow";
}

/** Upto payment backed by this repository's Anchor program. */
export async function payForUptoResource(
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
  const core = new x402Client((_version, requirements) => requirements[0]);
  core.register(DEVNET, new UptoClientScheme(signer, options.rpcUrl ?? "https://api.devnet.solana.com"));
  const http = new x402HTTPClient(core);
  let required: PaymentRequired;
  try { required = http.getPaymentRequiredResponse(name => initial.headers.get(name)); }
  catch { throw new Error("Invalid PAYMENT-REQUIRED header"); }
  if (required.x402Version !== 2 || !Array.isArray(required.accepts) ||
      new URL(required.resource.url, target).href !== target.href) {
    throw new Error("Invalid x402 payment requirements");
  }
  const accepted = required.accepts.find(option => acceptable(option, limits));
  if (!accepted) throw new Error("No acceptable Anchor upto payment requirement");
  options.onQuoteAccepted?.(BigInt(accepted.amount));
  const payload = await http.createPaymentPayload({ ...required, accepts: [accepted] });
  const channelId = payload.payload.channelId;
  if (typeof channelId !== "string") throw new Error("Missing upto channel ID");
  options.onBeforePaidRequest?.();
  const paid = await fetchImpl(target, { headers: http.encodePaymentSignatureHeader(payload) });
  if (!paid.ok) throw new Error(`Paid request failed with HTTP ${paid.status}; check channel ${channelId} before retrying`);
  let settlement;
  try { settlement = http.getPaymentSettleResponse(name => paid.headers.get(name)); }
  catch { throw new Error(`Paid response has no valid PAYMENT-RESPONSE; check channel ${channelId} before retrying`); }
  if (!settlement.success || settlement.network !== DEVNET || !settlement.transaction ||
      typeof settlement.amount !== "string" || !/^\d+$/.test(settlement.amount) ||
      BigInt(settlement.amount) > BigInt(accepted.amount)) {
    throw new Error(`Anchor upto settlement was not confirmed; check channel ${channelId} before retrying`);
  }
  return { response: paid, settlement };
}

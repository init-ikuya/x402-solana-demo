import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import type { ClientSvmSigner } from "@x402/svm";
import { DEVNET, DEVNET_USDC } from "./constants.js";

export { DEVNET_USDC } from "./constants.js";

export interface ExactPaymentLimits {
  payTo: string;
  asset: string;
  maxAmount: bigint;
}

export interface PaidResource {
  response: Response;
  settlement: SettleResponse;
}

export interface ExactClientOptions {
  rpcUrl?: string;
  /** Called after the quoted amount is checked and before the transaction is signed. */
  onQuoteAccepted?: (amount: bigint) => void;
  /** Called immediately before the signed payment request may leave this process. */
  onBeforePaidRequest?: () => void;
}

function acceptable(requirement: PaymentRequirements, limits: ExactPaymentLimits): boolean {
  return requirement.scheme === "exact"
    && requirement.network === DEVNET
    && requirement.asset === limits.asset
    && requirement.payTo === limits.payTo
    && /^[1-9]\d*$/.test(requirement.amount)
    && BigInt(requirement.amount) <= limits.maxAmount
    && Number.isFinite(requirement.maxTimeoutSeconds)
    && requirement.maxTimeoutSeconds > 0
    && typeof requirement.extra?.feePayer === "string";
}

/** Make one paid GET request. An uncertain result is never paid a second time automatically. */
export async function payForExactResource(
  url: string,
  limits: ExactPaymentLimits,
  signer: ClientSvmSigner,
  fetchImpl: typeof fetch = fetch,
  options: ExactClientOptions = {},
): Promise<PaidResource> {
  if (limits.maxAmount <= 0n) throw new Error("maxAmount must be positive");
  const target = new URL(url);
  if (!(["http:", "https:"].includes(target.protocol))) throw new Error("Expected an HTTP URL");

  const initial = await fetchImpl(target);
  if (initial.status !== 402) throw new Error(`Expected HTTP 402, received ${initial.status}`);

  const core = new x402Client((_version, requirements) => requirements[0]);
  core.register(DEVNET, new ExactSvmScheme(signer, { rpcUrl: options.rpcUrl }));
  const http = new x402HTTPClient(core);
  let required: PaymentRequired;
  try {
    required = http.getPaymentRequiredResponse(name => initial.headers.get(name));
  } catch {
    throw new Error("Invalid PAYMENT-REQUIRED header");
  }
  if (required.x402Version !== 2 || !Array.isArray(required.accepts)) {
    throw new Error("Only x402 v2 payment requirements are supported");
  }
  if (new URL(required.resource.url, target).href !== target.href) {
    throw new Error("Payment requirement targets a different resource");
  }
  const accepted = required.accepts.find(option => acceptable(option, limits));
  if (!accepted) throw new Error("No acceptable exact payment requirement");
  options.onQuoteAccepted?.(BigInt(accepted.amount));
  const payload = await http.createPaymentPayload({ ...required, accepts: [accepted] });
  const headers = http.encodePaymentSignatureHeader(payload);
  options.onBeforePaidRequest?.();
  const paid = await fetchImpl(target, { headers });
  if (!paid.ok) throw new Error(`Paid request failed with HTTP ${paid.status}; check settlement before retrying`);

  let settlement: SettleResponse;
  try {
    settlement = http.getPaymentSettleResponse(name => paid.headers.get(name));
  } catch {
    throw new Error("Paid response has no valid PAYMENT-RESPONSE; check settlement before retrying");
  }
  if (!settlement.success || settlement.network !== DEVNET || !settlement.transaction) {
    throw new Error("Payment settlement was not confirmed; check settlement before retrying");
  }
  return { response: paid, settlement };
}

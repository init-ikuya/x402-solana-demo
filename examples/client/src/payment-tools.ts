import type { ClientSvmSigner } from "@x402/svm";
import type { AgentTool } from "./agent-core.js";
import { AgentPaymentSession } from "./agent-payment-session.js";
import type { ExactPaymentLimits } from "./exact-client.js";

export type PaymentScheme = "exact" | "upto";

/** Expose fixed merchant routes as model tools. The model cannot choose a URL, recipient, or amount. */
export function createPaymentTools(options: {
  session: AgentPaymentSession;
  signer: ClientSvmSigner;
  limits: ExactPaymentLimits;
  routes: Partial<Record<PaymentScheme, string>>;
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
}): AgentTool[] {
  const tools: AgentTool[] = [];
  for (const scheme of ["exact", "upto"] as const) {
    const url = options.routes[scheme];
    if (!url) continue;
    tools.push({
      name: `get_trump_insider_${scheme.replace("-", "_")}`,
      description: scheme === "exact"
        ? "Buy one fictional Trump insider parody API response for an exact payment. Each call makes a new payment."
        : "Buy one fictional Trump insider parody API response using this project's upto escrow. Each call authorizes a ceiling and pays the actual charge.",
      parameters: { type: "object", properties: {}, required: [] },
      async execute(arguments_) {
        if (Object.keys(arguments_).length) throw new Error("This payment tool accepts no arguments");
        const paid = scheme === "exact"
          ? await options.session.payExact(url, options.limits, options.signer, options.fetchImpl, { rpcUrl: options.rpcUrl })
          : await options.session.payUpto(url, options.limits, options.signer, options.fetchImpl, { rpcUrl: options.rpcUrl });
        const body = await paid.response.text();
        if (body.length > 16_384) throw new Error("Paid resource exceeded the demo's model context limit");
        const resource: unknown = JSON.parse(body);
        if (!resource || typeof resource !== "object" || Array.isArray(resource) ||
            typeof (resource as { reportId?: unknown }).reportId !== "string") {
          throw new Error("Paid resource has no report ID");
        }
        const record = options.session.records.at(-1);
        if (!record || record.state !== "settled") throw new Error("Missing confirmed payment record");
        return JSON.stringify({
          scheme,
          resource,
          transaction: record.transaction,
          chargedAtomicUnits: record.charged?.toString(),
          remainingBudgetAtomicUnits: options.session.remaining.toString(),
        });
      },
    });
  }
  if (!tools.length) throw new Error("Enable at least one payment scheme");
  return tools;
}

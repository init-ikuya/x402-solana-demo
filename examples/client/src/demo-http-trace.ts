type Log = (message: string) => void;

function decodedHeader(value: string | null): Record<string, unknown> | undefined {
  if (!value || value.length > 32_768) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function selectedFields(value: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter(field =>
    typeof value[field] === "string" || typeof value[field] === "number" || typeof value[field] === "boolean",
  ).map(field => [field, value[field]]));
}

/** Show the x402 exchange without printing signed transaction bytes or private data. */
export function createDemoHttpTrace(fetchImpl: typeof fetch = fetch, log: Log = console.log): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const signed = headers.has("PAYMENT-SIGNATURE");
    log(`[HTTP] → ${method} ${url.pathname} ${signed ? "PAYMENT-SIGNATURE: [redacted]" : "without payment"}`);

    const response = await fetchImpl(input, init);
    const required = decodedHeader(response.headers.get("PAYMENT-REQUIRED"));
    if (response.status === 402 && required) {
      const accepts = Array.isArray(required.accepts) ? required.accepts : [];
      const quote = accepts[0];
      const terms = quote && typeof quote === "object" && !Array.isArray(quote)
        ? selectedFields(quote as Record<string, unknown>,
          ["scheme", "network", "amount", "asset", "payTo", "maxTimeoutSeconds"]) : {};
      log(`[HTTP] ← 402 PAYMENT-REQUIRED (decoded): ${JSON.stringify(terms)}`);
    } else if (response.status === 402) {
      log("[HTTP] ← 402 PAYMENT-REQUIRED: missing or unreadable");
    } else {
      const settlement = decodedHeader(response.headers.get("PAYMENT-RESPONSE"));
      const details = settlement
        ? JSON.stringify(selectedFields(settlement, ["success", "network", "payer", "transaction", "amount", "errorReason"]))
        : "missing or unreadable";
      log(`[HTTP] ← ${response.status} PAYMENT-RESPONSE (decoded): ${details}`);
      if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
        try {
          const body: unknown = await response.clone().json();
          if (body && typeof body === "object" && !Array.isArray(body)) {
            log(`[HTTP] ← JSON body preview: ${JSON.stringify(selectedFields(body as Record<string, unknown>,
              ["reportId", "title", "headline", "fictional"]))}`);
          }
        } catch { /* The payment client handles invalid resource bodies. */ }
      }
    }
    return response;
  };
}

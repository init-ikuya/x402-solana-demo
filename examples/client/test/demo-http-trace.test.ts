import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoHttpTrace } from "../src/demo-http-trace.js";

const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");

test("demo trace shows the exchange without exposing the signed payload or consuming the body", async () => {
  const lines: string[] = [];
  const requests: Headers[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    requests.push(headers);
    if (!headers.has("PAYMENT-SIGNATURE")) {
      return new Response("{}", { status: 402, headers: {
        "PAYMENT-REQUIRED": encoded({ accepts: [{ scheme: "auth-capture", network: "solana:devnet",
          amount: "1000", asset: "test-mint", payTo: "test-merchant",
          extra: { binding: "anchor-auth-capture-escrow-v1", paymentFlow: "escrow",
            captureDeadline: "123", refundDeadline: "456", secret: "never-print" } }] }),
      } });
    }
    return Response.json({ reportId: "FICTION-12345678", title: "Demo", headline: "Demo report", fictional: true }, {
      headers: { "PAYMENT-RESPONSE": encoded({ success: true, network: "solana:devnet",
        transaction: "test-signature", amount: "300", extra: { paymentId: "test-payment-pda" } }) },
    });
  };
  const traced = createDemoHttpTrace(fetchImpl, line => lines.push(line));
  const url = "http://127.0.0.1:4021/api/trump-insider/auth-capture";
  const challenge = await traced(url);
  assert.equal(challenge.status, 402);
  const paid = await traced(url, { headers: { "PAYMENT-SIGNATURE": "secret-signed-payload" } });
  assert.equal((await paid.json()).reportId, "FICTION-12345678");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].get("PAYMENT-SIGNATURE"), "secret-signed-payload");
  assert.match(lines.join("\n"), /402 PAYMENT-REQUIRED.*"amount":"1000"/);
  assert.match(lines.join("\n"), /200 PAYMENT-RESPONSE.*"amount":"300"/);
  assert.match(lines.join("\n"), /"captureDeadline":"123"/);
  assert.match(lines.join("\n"), /"paymentId":"test-payment-pda"/);
  assert.match(lines.join("\n"), /JSON body preview.*FICTION-12345678/);
  assert.match(lines.join("\n"), /PAYMENT-SIGNATURE: \[redacted\]/);
  assert.doesNotMatch(lines.join("\n"), /secret-signed-payload/);
  assert.doesNotMatch(lines.join("\n"), /never-print/);
});

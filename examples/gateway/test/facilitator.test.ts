import assert from "node:assert/strict";
import { type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { generateKeyPairSigner } from "@solana/kit";
import { DEVNET, DEVNET_USDC, EXACT_AMOUNT } from "../src/constants.js";
import { createFacilitatorApp, type PaymentFacilitator } from "../src/facilitator.js";

const payTo = "11111111111111111111111111111111";
const feePayer = "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5";
const requirements: PaymentRequirements = {
  scheme: "exact", network: DEVNET, asset: DEVNET_USDC, amount: EXACT_AMOUNT,
  payTo, maxTimeoutSeconds: 60, extra: { feePayer },
};
const payload: PaymentPayload = {
  x402Version: 2, accepted: requirements, payload: { transaction: "mock-transaction" },
};
let server: Server;
let base: string;
let verified = 0;
let settled = 0;

before(async () => {
  const facilitator: PaymentFacilitator = {
    getSupported: () => ({ kinds: [
      { x402Version: 2, scheme: "exact", network: DEVNET, extra: { feePayer } },
      { x402Version: 2, scheme: "upto", network: DEVNET, extra: { feePayer } },
    ], extensions: [], signers: { "solana:*": [feePayer] } }),
    verify: async () => { verified++; return { isValid: true }; },
    settle: async () => { settled++; return { success: true, network: DEVNET, transaction: "mock-signature" }; },
  };
  server = createFacilitatorApp(facilitator, payTo, feePayer).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => { await new Promise<void>(resolve => server?.close(() => resolve())); });

test("local facilitator exposes the exact devnet capability", async () => {
  const response = await fetch(`${base}/supported`);
  assert.equal(response.status, 200);
  const supported = await response.json() as { kinds: Array<{ scheme: string; network: string; extra: { feePayer: string } }> };
  assert.equal(supported.kinds[0].scheme, "exact");
  assert.equal(supported.kinds[0].network, DEVNET);
  assert.equal(supported.kinds[0].extra.feePayer, feePayer);
});

test("official SDK advertises the configured fee payer on devnet", async () => {
  const signer = await generateKeyPairSigner();
  const facilitator = new x402Facilitator();
  facilitator.register(DEVNET, new ExactSvmScheme(toFacilitatorSvmSigner(signer)));
  const kinds = facilitator.getSupported().kinds;
  assert.equal(kinds.length, 1);
  assert.equal(kinds[0].scheme, "exact");
  assert.equal(kinds[0].network, DEVNET);
  assert.equal(kinds[0].extra?.feePayer, signer.address);
});

test("local facilitator forwards merchant-scoped verify and settle", async () => {
  for (const route of ["verify", "settle"]) {
    const response = await fetch(`${base}/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: requirements }) });
    assert.equal(response.status, 200);
  }
  assert.equal(verified, 1);
  assert.equal(settled, 1);
});

test("local facilitator refuses other recipients before using its signer", async () => {
  const response = await fetch(`${base}/settle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: { ...requirements, payTo: "other" } }) });
  assert.equal(response.status, 400);
  assert.equal(settled, 1);
});

test("local facilitator forwards a scoped batch voucher", async () => {
  const batchRequirements: PaymentRequirements = {
    scheme: "batch-settlement", network: DEVNET, asset: DEVNET_USDC,
    amount: "1000", payTo, maxTimeoutSeconds: 300,
    extra: { feePayer, voucherSigner: "client", assetTransferMethod: "channel", paymentFlow: "authorization" },
  };
  const batchPayload: PaymentPayload = {
    x402Version: 2, accepted: batchRequirements,
    payload: { type: "voucher", channelId: "channel-a" },
  };
  const response = await fetch(`${base}/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload: batchPayload, paymentRequirements: batchRequirements }),
  });
  assert.equal(response.status, 200);
  assert.equal(verified, 2);
  const wrong = await fetch(`${base}/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload: batchPayload, paymentRequirements: { ...batchRequirements, payTo: "other" } }),
  });
  assert.equal(wrong.status, 400);
  assert.equal(verified, 2);
  const claim = await fetch(`${base}/settle`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload: { ...batchPayload, payload: { type: "claim", claims: [] } },
      paymentRequirements: batchRequirements,
    }),
  });
  assert.equal(claim.status, 200);
  assert.equal(settled, 2);
});

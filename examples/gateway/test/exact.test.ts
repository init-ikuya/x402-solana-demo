import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import { generateKeyPairSigner } from "@solana/kit";
import { createApp, DEVNET } from "../src/app.js";
import { payForExactResource, DEVNET_USDC } from "../../client/src/exact-client.js";
import { AgentPaymentSession } from "../../client/src/agent-payment-session.js";
import { DEMO_RESOURCE_PATH } from "../src/demo-resource.js";
import { assertDemoResource } from "./demo-resource-assert.js";

const payTo = "11111111111111111111111111111111";
let facilitator: Server;
let gateway: Server;
let gatewayUrl: string;
let verifyCalls = 0;
let settleCalls = 0;
let rpcCalls = 0;

before(async () => {
  facilitator = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/supported") {
      res.end(JSON.stringify({ kinds: [{ x402Version: 2, scheme: "exact", network: DEVNET, extra: { feePayer: payTo } }] }));
    } else if (req.url === "/verify") {
      verifyCalls++;
      res.end(JSON.stringify({ isValid: true, payer: payTo }));
    } else if (req.url === "/settle") {
      settleCalls++;
      res.end(JSON.stringify({ success: true, network: DEVNET, payer: payTo, transaction: "mock-signature" }));
    } else if (req.url === "/rpc") {
      rpcCalls++;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const request = JSON.parse(Buffer.concat(chunks).toString()) as { id: number; method: string };
      if (request.method === "getAccountInfo") {
        const mint = Buffer.alloc(82);
        mint[44] = 6;
        mint[45] = 1;
        res.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: {
          data: [mint.toString("base64"), "base64"], executable: false, lamports: 1000000,
          owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", rentEpoch: 0, space: 82,
        } } }));
      } else if (request.method === "getLatestBlockhash") {
        res.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: {
          blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100,
        } } }));
      } else {
        res.writeHead(400).end();
      }
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>(resolve => facilitator.listen(0, "127.0.0.1", resolve));
  const facilitatorUrl = `http://127.0.0.1:${(facilitator.address() as AddressInfo).port}`;
  gateway = createApp({ payTo, facilitatorUrl }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => gateway.once("listening", resolve));
  gatewayUrl = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
});

after(async () => {
  await Promise.all([
    new Promise<void>(resolve => gateway?.close(() => resolve())),
    new Promise<void>(resolve => facilitator?.close(() => resolve())),
  ]);
});

test("gateway challenges and serves after facilitator verifies and settles", async () => {
  const url = `${gatewayUrl}${DEMO_RESOURCE_PATH}`;
  const challenge = await fetch(url);
  assert.equal(challenge.status, 402);
  const header = challenge.headers.get("PAYMENT-REQUIRED");
  assert.ok(header);
  const required = JSON.parse(Buffer.from(header, "base64").toString()) as PaymentRequired;
  assert.equal(required.x402Version, 2);
  assert.equal(required.accepts[0].scheme, "exact");
  assert.equal(required.accepts[0].network, DEVNET);
  assert.equal(required.accepts[0].asset, DEVNET_USDC);
  assert.equal(required.accepts[0].amount, "1000");
  assert.equal(required.accepts[0].payTo, payTo);

  const payload: PaymentPayload = {
    x402Version: 2,
    resource: required.resource,
    accepted: required.accepts[0],
    payload: { transaction: "mock-partially-signed-transaction" },
  };
  const response = await fetch(url, { headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) } });
  assert.equal(response.status, 200);
  assertDemoResource(await response.json());
  assert.ok(response.headers.get("PAYMENT-RESPONSE"));
  assert.equal(verifyCalls, 1);
  assert.equal(settleCalls, 1);
});

test("client rejects an unexpected recipient before signing", async () => {
  const url = `${gatewayUrl}${DEMO_RESOURCE_PATH}`;
  await assert.rejects(
    payForExactResource(url, { payTo: "DifferentRecipient", asset: DEVNET_USDC, maxAmount: 1000n }, {} as never),
    /No acceptable exact payment requirement/,
  );
  assert.equal(settleCalls, 1);
});

test("client rejects an insufficient budget before signing", async () => {
  const url = `${gatewayUrl}${DEMO_RESOURCE_PATH}`;
  await assert.rejects(
    payForExactResource(url, { payTo, asset: DEVNET_USDC, maxAmount: 999n }, {} as never),
    /No acceptable exact payment requirement/,
  );
  assert.equal(settleCalls, 1);
});

test("client signs one exact payment and requires settlement evidence", async () => {
  const signer = await generateKeyPairSigner();
  const url = `${gatewayUrl}${DEMO_RESOURCE_PATH}`;
  const facilitatorUrl = `http://127.0.0.1:${(facilitator.address() as AddressInfo).port}`;
  const { response, settlement } = await payForExactResource(
    url, { payTo, asset: DEVNET_USDC, maxAmount: 1000n }, signer, fetch,
    { rpcUrl: `${facilitatorUrl}/rpc` },
  );
  assert.equal(response.status, 200);
  assert.equal(settlement.transaction, "mock-signature");
  assert.equal(verifyCalls, 2);
  assert.equal(settleCalls, 2);
  assert.ok(rpcCalls >= 2);
});

test("agent keeps a failed paid request pending and does not sign another payment", async () => {
  const signer = await generateKeyPairSigner();
  const url = `${gatewayUrl}${DEMO_RESOURCE_PATH}`;
  const facilitatorUrl = `http://127.0.0.1:${(facilitator.address() as AddressInfo).port}`;
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 2000n, maxPayments: 2 });
  const settledBefore = settleCalls;
  const losePaidResponse: typeof fetch = async (input, init) => {
    if (init?.headers) throw new Error("Simulated lost paid response");
    return fetch(input, init);
  };

  await assert.rejects(
    session.payExact(url, { payTo, asset: DEVNET_USDC, maxAmount: 1000n }, signer,
      losePaidResponse, { rpcUrl: `${facilitatorUrl}/rpc` }),
    /Simulated lost paid response/,
  );
  assert.equal(session.records[0].state, "outcome_unknown");
  assert.equal(session.reserved, 1000n);
  await assert.rejects(
    session.payExact(url, { payTo, asset: DEVNET_USDC, maxAmount: 1000n }, signer),
    /Previous payment is unresolved/,
  );
  assert.equal(settleCalls, settledBefore);
});

test("agent releases the reservation when signing fails before the paid request", async () => {
  const url = `${gatewayUrl}${DEMO_RESOURCE_PATH}`;
  const facilitatorUrl = `http://127.0.0.1:${(facilitator.address() as AddressInfo).port}`;
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 1000n, maxPayments: 2 });
  const settledBefore = settleCalls;
  await assert.rejects(session.payExact(
    url, { payTo, asset: DEVNET_USDC, maxAmount: 1000n }, {} as never, fetch,
    { rpcUrl: `${facilitatorUrl}/rpc` },
  ));
  assert.equal(session.records[0].state, "cancelled_before_submission");
  assert.equal(session.reserved, 0n);
  assert.equal(settleCalls, settledBefore);
});

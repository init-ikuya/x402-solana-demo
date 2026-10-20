import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { RoutedFacilitatorClient } from "../src/routed-facilitator.js";
import { DEVNET, DEVNET_USDC } from "../src/constants.js";

async function start(scheme: string, calls: string[]): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/supported") {
      response.end(JSON.stringify({ kinds: [{ x402Version: 2, scheme, network: DEVNET, extra: { feePayer: `${scheme}-payer` } }], extensions: [], signers: {} }));
      return;
    }
    calls.push(`${scheme}:${request.url}`);
    response.end(JSON.stringify(request.url === "/verify"
      ? { isValid: true }
      : { success: true, network: DEVNET, transaction: `${scheme}-transaction` }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

test("Devnet exact uses the official endpoint while custom batch uses the local facilitator", async t => {
  const calls: string[] = [];
  const local = await start("batch-settlement", calls);
  const official = await start("exact", calls);
  t.after(() => Promise.all([local.server, official.server].map(server =>
    new Promise<void>(resolve => server.close(() => resolve())))));
  const client = new RoutedFacilitatorClient(local.url, official.url);
  const supported = await client.getSupported();
  assert.deepEqual(supported.kinds.map(kind => kind.scheme), ["batch-settlement", "exact"]);
  const base = { network: DEVNET, asset: DEVNET_USDC, amount: "1000", payTo: "merchant", maxTimeoutSeconds: 300, extra: {} } as const;
  for (const scheme of ["exact", "batch-settlement"] as const) {
    const requirements: PaymentRequirements = { ...base, scheme };
    const payload: PaymentPayload = { x402Version: 2, accepted: requirements, payload: {} };
    assert.equal((await client.verify(payload, requirements)).isValid, true);
    assert.equal((await client.settle(payload, requirements)).transaction, `${scheme}-transaction`);
  }
  assert.deepEqual(calls, ["exact:/verify", "exact:/settle", "batch-settlement:/verify", "batch-settlement:/settle"]);
});

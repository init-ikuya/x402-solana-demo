import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import { BatchSvmScheme as BatchServerScheme } from "@x402/svm/batch-settlement/server";
import { BatchSvmScheme as BatchFacilitatorScheme } from "@x402/svm/batch-settlement/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import type { PaymentRequired } from "@x402/core/types";
import { createApp } from "../src/app.js";
import { DEVNET, DEVNET_USDC } from "../src/constants.js";
import { BATCH_RESOURCE_PATH } from "../src/demo-resource.js";

async function listen(server: Server): Promise<string> {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("batch route advertises the official client-signed channel binding", async t => {
  const receiver = await generateKeyPairSigner();
  const sponsor = await generateKeyPairSigner();
  const facilitatorScheme = new BatchFacilitatorScheme(toFacilitatorSvmSigner(sponsor));
  const facilitator = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/supported") response.end(JSON.stringify({
      kinds: [
        { x402Version: 2, scheme: "exact", network: DEVNET, extra: { feePayer: sponsor.address } },
        { x402Version: 2, scheme: "batch-settlement", network: DEVNET, extra: facilitatorScheme.getExtra(DEVNET) },
      ],
      extensions: [], signers: { "solana:*": [sponsor.address] },
    }));
    else response.writeHead(404).end();
  });
  const facilitatorUrl = await listen(facilitator);
  t.after(() => new Promise<void>(resolve => facilitator.close(() => resolve())));
  const gateway = createApp({
    payTo: receiver.address, facilitatorUrl,
    batchScheme: new BatchServerScheme({ receiverAuthorizer: receiver }),
  }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => gateway.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => gateway.close(() => resolve())));
  const url = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}${BATCH_RESOURCE_PATH}`;
  const response = await fetch(url);
  assert.equal(response.status, 402);
  const header = response.headers.get("PAYMENT-REQUIRED");
  assert.ok(header);
  const required = JSON.parse(Buffer.from(header, "base64").toString()) as PaymentRequired;
  const quote = required.accepts[0];
  assert.equal(quote.scheme, "batch-settlement");
  assert.equal(quote.network, DEVNET);
  assert.equal(quote.asset, DEVNET_USDC);
  assert.equal(quote.payTo, receiver.address);
  assert.equal(quote.amount, "1000");
  assert.equal(quote.extra.feePayer, sponsor.address);
  assert.equal(quote.extra.receiverAuthorizer, receiver.address);
  assert.equal(quote.extra.voucherSigner, "client");
  assert.ok(quote.extra.paymentFlow === undefined || quote.extra.paymentFlow === "authorization");
  assert.equal(quote.extra.assetTransferMethod, "channel");
});

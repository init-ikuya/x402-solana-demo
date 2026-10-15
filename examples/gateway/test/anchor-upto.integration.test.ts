import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import {
  decompileTransactionMessage, generateKeyPairSigner, getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { createApp } from "../src/app.js";
import { createFacilitatorApp } from "../src/facilitator.js";
import { AnchorUptoFacilitatorScheme } from "../src/anchor-upto-facilitator.js";
import { UPTO_RESOURCE_PATH } from "../src/demo-resource.js";
import { DEVNET, DEVNET_USDC } from "../src/constants.js";
import { assertDemoResource } from "./demo-resource-assert.js";
import { ANCHOR_UPTO_PROGRAM, instructionDiscriminator } from "../../shared/anchor-upto.js";
import { AgentPaymentSession } from "../../client/src/agent-payment-session.js";

let rpcServer: Server;
let facilitatorServer: Server;
let gatewayServer: Server;
let rpcUrl: string;
let gatewayUrl: string;
let payTo: string;
let client: Awaited<ReturnType<typeof generateKeyPairSigner>>;
const submitted: string[] = [];
let confirmations = 0;
let simulations = 0;

before(async () => {
  client = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const sponsor = await generateKeyPairSigner();
  payTo = merchant.address;
  rpcServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rpc = JSON.parse(Buffer.concat(chunks).toString()) as { id: number; method: string; params?: unknown[] };
    let result: unknown;
    switch (rpc.method) {
      case "getLatestBlockhash":
        result = { context: { slot: 42 }, value: {
          blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100,
        } };
        break;
      case "simulateTransaction":
        simulations++;
        result = { context: { slot: 42 }, value: { err: null, logs: [], unitsConsumed: 60_000 } };
        break;
      case "sendTransaction":
        submitted.push(String(rpc.params?.[0]));
        result = `anchor-test-${submitted.length}`;
        break;
      case "getSignatureStatuses":
        confirmations++;
        result = { context: { slot: 42 }, value: [{ slot: 42, confirmations: 1, err: null,
          confirmationStatus: "confirmed" }] };
        break;
      default:
        response.writeHead(400).end(JSON.stringify({ error: `Unexpected RPC method: ${rpc.method}` }));
        return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });
  await new Promise<void>(resolve => rpcServer.listen(0, "127.0.0.1", resolve));
  rpcUrl = `http://127.0.0.1:${(rpcServer.address() as AddressInfo).port}`;

  const facilitator = new x402Facilitator();
  const svmSigner = toFacilitatorSvmSigner(sponsor, { defaultRpcUrl: rpcUrl });
  facilitator.register(DEVNET, new ExactSvmScheme(svmSigner));
  facilitator.register(DEVNET, new AnchorUptoFacilitatorScheme(svmSigner, payTo));
  facilitatorServer = createFacilitatorApp(facilitator, payTo, sponsor.address).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => facilitatorServer.once("listening", resolve));
  const facilitatorUrl = `http://127.0.0.1:${(facilitatorServer.address() as AddressInfo).port}`;
  gatewayServer = createApp({ payTo, facilitatorUrl,
    anchorMerchantSigner: merchant, anchorRpcUrl: rpcUrl }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => gatewayServer.once("listening", resolve));
  gatewayUrl = `http://127.0.0.1:${(gatewayServer.address() as AddressInfo).port}`;
});

after(async () => {
  await Promise.all([rpcServer, facilitatorServer, gatewayServer].map(server =>
    new Promise<void>(resolve => server?.close(() => resolve()))));
});

test("upto sends this repository's Anchor program open and settle through the facilitator", async () => {
  const url = `${gatewayUrl}${UPTO_RESOURCE_PATH}`;
  const challenge = await fetch(url);
  assert.equal(challenge.status, 402);
  const required = JSON.parse(Buffer.from(challenge.headers.get("PAYMENT-REQUIRED") ?? "", "base64").toString()) as {
    accepts: Array<{ scheme: string; extra: { programId?: string } }>;
  };
  assert.equal(required.accepts.length, 1);
  assert.equal(required.accepts[0].scheme, "upto");
  assert.equal(required.accepts[0].extra.programId, ANCHOR_UPTO_PROGRAM);
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 1000n, maxPayments: 1 });
  const { response, settlement } = await session.payUpto(
    url,
    { payTo, asset: DEVNET_USDC, maxAmount: 1000n }, client, fetch, { rpcUrl },
  );
  assertDemoResource(await response.json());
  assert.equal(settlement.amount, "300");
  assert.equal(session.spent, 300n);
  assert.equal(session.remaining, 700n);
  assert.equal(submitted.length, 2);
  assert.ok(simulations >= 2);
  assert.equal(confirmations, 2);
  const instructions = submitted.map(wire => {
    const tx = getTransactionDecoder().decode(Buffer.from(wire, "base64"));
    return decompileTransactionMessage(getCompiledTransactionMessageDecoder().decode(tx.messageBytes)).instructions;
  });
  assert.equal(instructions[0]?.length, 1);
  assert.equal(instructions[1]?.length, 1);
  for (const [index, name] of (["open", "settle"] as const).entries()) {
    assert.equal(instructions[index]?.[0].programAddress, ANCHOR_UPTO_PROGRAM);
    assert.deepEqual(instructions[index]?.[0].data?.slice(0, 8), instructionDiscriminator(name));
  }
});

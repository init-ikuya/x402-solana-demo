import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { address, generateKeyPairSigner, getTransactionDecoder } from "@solana/kit";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactSvmScheme as ExactSvmClientScheme } from "@x402/svm/exact/client";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { createApp } from "../src/app.js";
import { DEVNET, DEVNET_USDC, EXACT_AMOUNT } from "../src/constants.js";
import { DEMO_RESOURCE_PATH } from "../src/demo-resource.js";
import { assertDemoResource } from "./demo-resource-assert.js";
import { payForExactResource } from "../../client/src/exact-client.js";
import { createFacilitatorApp } from "../src/facilitator.js";
import { AgentPaymentSession } from "../../client/src/agent-payment-session.js";

let rpcServer: Server;
let facilitatorServer: Server;
let gatewayServer: Server;
let rpcUrl: string;
let facilitatorUrl: string;
let gatewayUrl: string;
let payTo: string;
let feePayer: string;
let client: Awaited<ReturnType<typeof generateKeyPairSigner>>;
let simulations = 0;
const submissions: string[] = [];
let confirmations = 0;

before(async () => {
  client = await generateKeyPairSigner();
  const recipient = await generateKeyPairSigner();
  const facilitatorSigner = await generateKeyPairSigner();
  payTo = recipient.address;
  feePayer = facilitatorSigner.address;

  // The RPC is a deterministic stand-in for devnet. The facilitator, its
  // verifier, transaction signer, and sendTransaction adapter are all real.
  rpcServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rpc = JSON.parse(Buffer.concat(chunks).toString()) as {
      id: number;
      method: string;
      params?: unknown[];
    };
    let result: unknown;
    switch (rpc.method) {
      case "getAccountInfo": {
        const mint = Buffer.alloc(82);
        mint[44] = 6;
        mint[45] = 1;
        result = { context: { slot: 1 }, value: {
          data: [mint.toString("base64"), "base64"], executable: false, lamports: 1_000_000,
          owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", rentEpoch: 0, space: 82,
        } };
        break;
      }
      case "getLatestBlockhash":
        result = { context: { slot: 1 }, value: {
          blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100,
        } };
        break;
      case "simulateTransaction":
        simulations++;
        result = { context: { slot: 1 }, value: { err: null, logs: [], unitsConsumed: 10_000 } };
        break;
      case "sendTransaction":
        submissions.push(rpc.params?.[0] as string);
        result = "integration-test-signature";
        break;
      case "getSignatureStatuses":
        confirmations++;
        result = { context: { slot: 1 }, value: [{
          slot: 1, confirmations: 1, err: null, confirmationStatus: "confirmed",
        }] };
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
  facilitator.register(DEVNET, new ExactSvmScheme(
    toFacilitatorSvmSigner(facilitatorSigner, { defaultRpcUrl: rpcUrl }),
    undefined,
    { maxPriorityFeeMicroLamports: 1000, maxComputeUnits: 200000, maxRequiredSignatures: 2 },
  ));
  facilitatorServer = createFacilitatorApp(facilitator, payTo, feePayer).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => facilitatorServer.once("listening", resolve));
  facilitatorUrl = `http://127.0.0.1:${(facilitatorServer.address() as AddressInfo).port}`;

  gatewayServer = createApp({ payTo, facilitatorUrl }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => gatewayServer.once("listening", resolve));
  gatewayUrl = `http://127.0.0.1:${(gatewayServer.address() as AddressInfo).port}`;
});

after(async () => {
  await Promise.all([rpcServer, facilitatorServer, gatewayServer].map(server =>
    new Promise<void>(resolve => server?.close(() => resolve()))));
});

test("real exact facilitator verifies, signs, submits, and confirms a client payment", async () => {
  const { response, settlement } = await payForExactResource(
    `${gatewayUrl}${DEMO_RESOURCE_PATH}`,
    { payTo, asset: DEVNET_USDC, maxAmount: BigInt(EXACT_AMOUNT) },
    client,
    fetch,
    { rpcUrl },
  );

  assert.equal(response.status, 200);
  assertDemoResource(await response.json());
  assert.equal(settlement.success, true);
  assert.equal(settlement.payer, client.address);
  assert.equal(settlement.transaction, "integration-test-signature");
  assert.ok(simulations >= 2, "verify and settle must both simulate the transaction");
  assert.equal(submissions.length, 1);
  assert.equal(confirmations, 1);

  const transaction = getTransactionDecoder().decode(Buffer.from(submissions[0], "base64"));
  for (const signerAddress of [client.address, feePayer]) {
    const signature = transaction.signatures[address(signerAddress)];
    assert.ok(signature, `${signerAddress} must sign the submitted transaction`);
    assert.ok(signature.some(byte => byte !== 0), `${signerAddress} signature must not be empty`);
  }
});

test("real facilitator rejects a tampered payer signature without submitting", async () => {
  const submissionsBefore = submissions.length;
  const challenge = await fetch(`${gatewayUrl}${DEMO_RESOURCE_PATH}`);
  assert.equal(challenge.status, 402);
  const core = new x402Client((_version, requirements) => requirements[0]);
  core.register(DEVNET, new ExactSvmClientScheme(client, { rpcUrl }));
  const http = new x402HTTPClient(core);
  const required = http.getPaymentRequiredResponse(name => challenge.headers.get(name));
  const payload = await http.createPaymentPayload(required);
  const original = (payload.payload as { transaction: string }).transaction;
  const decoded = getTransactionDecoder().decode(Buffer.from(original, "base64"));
  const payerSignature = decoded.signatures[client.address];
  assert.ok(payerSignature);
  const wire = Buffer.from(original, "base64");
  const signatureOffset = wire.indexOf(Buffer.from(payerSignature));
  assert.ok(signatureOffset >= 0);
  wire[signatureOffset] ^= 1;

  const response = await fetch(`${facilitatorUrl}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload: { ...payload, payload: { ...payload.payload, transaction: wire.toString("base64") } },
      paymentRequirements: required.accepts[0],
    }),
  });
  assert.equal(response.status, 200);
  const verification = await response.json() as { isValid: boolean };
  assert.equal(verification.isValid, false);
  assert.equal(submissions.length, submissionsBefore);
});

test("one agent session pays twice and refuses a third charge over its total budget", async () => {
  const session = new AgentPaymentSession({
    asset: DEVNET_USDC,
    maxTotalAmount: 2n * BigInt(EXACT_AMOUNT),
    maxPayments: 3,
  });
  const submissionsBefore = submissions.length;
  const limits = { payTo, asset: DEVNET_USDC, maxAmount: BigInt(EXACT_AMOUNT) };
  const reportIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const { response, settlement } = await session.payExact(`${gatewayUrl}${DEMO_RESOURCE_PATH}`, limits, client, fetch, { rpcUrl });
    assert.equal(settlement.success, true);
    const report: unknown = await response.json();
    assertDemoResource(report);
    reportIds.push(report.reportId);
  }
  assert.equal(new Set(reportIds).size, 2);
  assert.equal(submissions.length, submissionsBefore + 2);
  assert.equal(session.spent, 2n * BigInt(EXACT_AMOUNT));
  await assert.rejects(
    session.payExact(`${gatewayUrl}${DEMO_RESOURCE_PATH}`, limits, client, fetch, { rpcUrl }),
    /cumulative payment budget/,
  );
  assert.equal(submissions.length, submissionsBefore + 2);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  address, decompileTransactionMessage, generateKeyPairSigner, getBase58Decoder,
  getBase58Encoder, getCompiledTransactionMessageDecoder, getTransactionDecoder,
} from "@solana/kit";
import { ANCHOR_UPTO_PROGRAM, channelAddress, instructionDiscriminator } from "../../shared/anchor-upto.js";
import { DEVNET_USDC } from "../src/constants.js";
import { findRefundChannel, refundUptoChannel } from "../src/upto-refund.js";

function channelData(payer: string, merchant: string, rentPayer: string, nonce: bigint, expiresAt: bigint): string {
  const bytes = Buffer.alloc(161);
  createHash("sha256").update("account:PaymentChannel").digest().copy(bytes, 0, 0, 8);
  const key = (value: string, offset: number) => Buffer.from(getBase58Encoder().encode(value)).copy(bytes, offset);
  key(payer, 8);
  key(merchant, 40);
  key(DEVNET_USDC, 72);
  key(rentPayer, 104);
  bytes.writeBigUInt64LE(1000n, 136);
  bytes.writeBigInt64LE(expiresAt, 144);
  bytes.writeBigUInt64LE(nonce, 152);
  bytes[160] = 255;
  return bytes.toString("base64");
}

async function rpcServer(accounts: Array<{ pubkey: string; account: { owner: string; data: [string, string] } }>) {
  const submitted: string[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = JSON.parse(Buffer.concat(chunks).toString()) as { id: number; method: string; params: unknown[] };
    let result: unknown;
    switch (input.method) {
      case "getProgramAccounts": result = accounts; break;
      case "getAccountInfo": result = { context: { slot: 42 }, value: accounts.find(item => item.pubkey === input.params[0])?.account ?? null }; break;
      case "getLatestBlockhash": result = { context: { slot: 42 }, value: {
        blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100,
      } }; break;
      case "sendTransaction": {
        const wire = String(input.params[0]);
        submitted.push(wire);
        const tx = getTransactionDecoder().decode(Buffer.from(wire, "base64"));
        const signature = Object.values(tx.signatures)[0];
        if (!signature) throw new Error("Missing transaction signature");
        result = getBase58Decoder().decode(signature);
        break;
      }
      case "getSignatureStatuses": result = { context: { slot: 42 }, value: [{ err: null, confirmationStatus: "confirmed" }] }; break;
      default:
        response.writeHead(400).end(JSON.stringify({ error: `Unexpected RPC method: ${input.method}` }));
        return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: input.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, submitted };
}

async function close(server: Server) {
  await new Promise<void>(resolve => server.close(() => resolve()));
}

test("payer discovers an expired channel and submits refund without a facilitator", async t => {
  const payer = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const otherMerchant = await generateKeyPairSigner();
  const rentPayer = await generateKeyPairSigner();
  const expired = BigInt(Math.floor(Date.now() / 1000) - 10);
  const id = await channelAddress(payer.address, merchant.address, DEVNET_USDC, 7n);
  const unrelatedId = await channelAddress(payer.address, otherMerchant.address, DEVNET_USDC, 8n);
  const { server, url, submitted } = await rpcServer([
    { pubkey: unrelatedId, account: { owner: ANCHOR_UPTO_PROGRAM,
      data: [channelData(payer.address, otherMerchant.address, rentPayer.address, 8n, expired), "base64"] } },
    { pubkey: id, account: { owner: ANCHOR_UPTO_PROGRAM,
      data: [channelData(payer.address, merchant.address, rentPayer.address, 7n, expired), "base64"] } },
  ]);
  t.after(() => close(server));

  const result = await refundUptoChannel({ payer, merchant: merchant.address, mint: DEVNET_USDC, rpcUrl: url });
  assert.equal(result.channel.id, id);
  assert.equal(result.channel.maxAmount, 1000n);
  assert.equal(submitted.length, 1);
  const tx = getTransactionDecoder().decode(Buffer.from(submitted[0], "base64"));
  assert.ok(tx.signatures[address(payer.address)]?.some(byte => byte !== 0));
  const instructions = decompileTransactionMessage(getCompiledTransactionMessageDecoder().decode(tx.messageBytes)).instructions;
  assert.equal(instructions?.length, 1);
  assert.equal(instructions[0].programAddress, ANCHOR_UPTO_PROGRAM);
  assert.deepEqual(instructions[0].data, instructionDiscriminator("refund"));
  assert.equal(instructions[0].accounts?.[0].address, id);
  assert.equal(instructions[0].accounts?.[2].address, rentPayer.address);
});

test("refund rejects a channel before expiry without submitting a transaction", async t => {
  const payer = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const rentPayer = await generateKeyPairSigner();
  const id = await channelAddress(payer.address, merchant.address, DEVNET_USDC, 9n);
  const { server, url, submitted } = await rpcServer([{ pubkey: id, account: { owner: ANCHOR_UPTO_PROGRAM,
    data: [channelData(payer.address, merchant.address, rentPayer.address, 9n,
      BigInt(Math.floor(Date.now() / 1000) + 300)), "base64"] } }]);
  t.after(() => close(server));
  await assert.rejects(findRefundChannel({ payer, merchant: merchant.address, mint: DEVNET_USDC,
    rpcUrl: url, channelId: id }), /refund is not available yet/);
  assert.equal(submitted.length, 0);
});

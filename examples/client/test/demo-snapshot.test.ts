import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import { readDemoSnapshot } from "../src/demo-snapshot.js";

test("demo snapshot distinguishes a missing token account from a zero balance", async () => {
  const payer = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const requests: string[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const call = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
    requests.push(call.method);
    const key = call.params[0];
    const result = call.method === "getBalance"
      ? { context: { slot: 71 }, value: key === payer.address ? 1_500_000_000 : 2_000_000_000 }
      : call.method === "getAccountInfo"
        ? { context: { slot: 72 }, value: requests.filter(method => method === "getAccountInfo").length === 1
          ? { data: ["", "base64"] } : null }
        : { context: { slot: 73 }, value: { amount: "0", decimals: 6 } };
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as typeof fetch;
  const result = await readDemoSnapshot({
    payer: payer.address, merchant: merchant.address, rpcUrl: "https://example.invalid",
    fetchImpl,
  });
  assert.equal(result.payer.lamports, "1500000000");
  assert.equal(result.merchant.lamports, "2000000000");
  assert.deepEqual([result.payer.usdc, result.merchant.usdc].sort(), [null, "0"].sort());
  assert.equal(requests.filter(method => method === "getTokenAccountBalance").length, 1);
  assert.equal(result.payment, null);
});

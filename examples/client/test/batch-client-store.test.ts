import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FileBatchClientStorage } from "../src/batch-client.js";

test("client restores pending and confirmed batch allocations after restart", async t => {
  const dir = await mkdtemp(join(tmpdir(), "batch-client-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "channels.json");
  const store = new FileBatchClientStorage(file);
  const record = {
    channelId: "channel-a", channelConfig: {
      payer: "payer", payerAuthorizer: "payer", receiver: "receiver",
      receiverAuthorizer: "authorizer", token: "mint", withdrawDelay: 60,
      salt: "0", openSlot: 1,
    },
    deposit: "3000", chargedCumulativeAmount: "1000",
    pending: { amount: "1000", chargedCumulativeAmount: "2000", deposit: "3000",
      payment: { x402Version: 2, payload: { type: "voucher" as const, channelId: "channel-a",
        channelConfig: {
          payer: "payer", payerAuthorizer: "payer", receiver: "receiver",
          receiverAuthorizer: "authorizer", token: "mint", withdrawDelay: 60,
          salt: "0", openSlot: 1,
        },
        voucher: { channelId: "channel-a", maxClaimableAmount: "2000", expiresAt: 0, signature: "signature" } } },
    },
  };
  await store.set("route", record);
  assert.deepEqual(await new FileBatchClientStorage(file).get("route"), record);
  await store.delete("route");
  assert.equal(await new FileBatchClientStorage(file).get("route"), undefined);
});

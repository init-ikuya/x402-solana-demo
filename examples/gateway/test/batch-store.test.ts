import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FileBatchChannelStore } from "../src/batch-store.js";
import { FileBatchFacilitatorChannelStore, FileBatchPendingStore } from "../src/batch-facilitator-store.js";
import { DEVNET } from "../src/constants.js";
import type { ChannelState } from "@x402/svm/batch-settlement/server";
import type { PaymentChannelRecord } from "@x402/svm/batch-settlement/facilitator";

test("gateway persists cumulative vouchers and serializes concurrent updates", async t => {
  const dir = await mkdtemp(join(tmpdir(), "batch-gateway-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "channels.json");
  const store = new FileBatchChannelStore(file);
  const initial = { channelId: "channel-a", settled: 0n, chargedCumulativeAmount: 0n } as ChannelState;
  await store.put(initial);
  await Promise.all(Array.from({ length: 20 }, () => store.update("channel-a", current => ({
    ...current!, chargedCumulativeAmount: current!.chargedCumulativeAmount + 1n,
  }))));
  const restored = await new FileBatchChannelStore(file).get("channel-a");
  assert.equal(restored?.chargedCumulativeAmount, 20n);
  assert.equal((await new FileBatchChannelStore(file).list()).length, 1);
  await assert.rejects(store.update("channel-a", current => ({ ...current!, channelId: "other" })), /ID changed/);
  assert.equal((await store.get("channel-a"))?.chargedCumulativeAmount, 20n);
});

test("facilitator retains first receiver binding and unresolved signatures", async t => {
  const dir = await mkdtemp(join(tmpdir(), "batch-facilitator-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pendingFile = join(dir, "pending.json");
  const pending = new FileBatchPendingStore(pendingFile);
  assert.equal(await pending.setIfAbsent("claim-1", "signature-a"), true);
  assert.equal(await pending.setIfAbsent("claim-1", "signature-b"), false);
  assert.equal(await new FileBatchPendingStore(pendingFile).get("claim-1"), "signature-a");
  assert.equal(await pending.deleteIfEquals("claim-1", "signature-b"), false);
  assert.equal(await pending.deleteIfEquals("claim-1", "signature-a"), true);

  const channelFile = join(dir, "bindings.json");
  const channels = new FileBatchFacilitatorChannelStore(channelFile);
  const record: PaymentChannelRecord = {
    network: DEVNET, channelId: "channel-a", payTo: "receiver-a", tokenProgram: "token-a",
    expiresAt: 0, lastActivityAt: 100, receiverAuthorizer: "authorizer-a", callerIdentity: "",
  };
  const first = await channels.recordOpen(record);
  assert.ok(first.revertToken);
  const conflict = await channels.recordOpen({ ...record, receiverAuthorizer: "authorizer-b", lastActivityAt: 200 });
  assert.equal(conflict.revertToken, "");
  assert.equal(conflict.record.receiverAuthorizer, "authorizer-a");
  assert.equal((await channels.get(DEVNET, "channel-a"))?.lastActivityAt, 100);
  await channels.revertOpen(first);
  assert.equal(await new FileBatchFacilitatorChannelStore(channelFile).get(DEVNET, "channel-a"), undefined);
});

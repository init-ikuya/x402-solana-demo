import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentPaymentSession } from "../src/agent-payment-session.js";
import { DEVNET_USDC } from "../src/constants.js";

test("one budget counts actual charges across schemes and reserves the next ceiling", () => {
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 2500n, maxPayments: 4 });
  const exact = session.reserve("exact", DEVNET_USDC, 1000n);
  session.markSubmitted(exact);
  session.confirm(exact, 1000n, "exact-signature");

  const upto = session.reserve("upto", DEVNET_USDC, 1200n);
  assert.equal(session.spent, 1000n);
  assert.equal(session.reserved, 1200n);
  assert.equal(session.remaining, 300n);
  session.markSubmitted(upto);
  session.confirm(upto, 400n, "upto-signature");
  assert.equal(session.spent, 1400n);
  assert.equal(session.remaining, 1100n);
  assert.throws(() => session.reserve("batch-settlement", DEVNET_USDC, 1101n), /cumulative payment budget/);
  assert.throws(() => session.reserve("auth-capture", "another-mint", 100n), /budget asset/);
});

test("unknown outcome holds the ceiling and blocks new payments", () => {
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 2000n, maxPayments: 3 });
  const id = session.reserve("exact", DEVNET_USDC, 1000n);
  session.markSubmitted(id);
  assert.equal(session.records[0].state, "outcome_unknown");
  assert.equal(session.remaining, 1000n);
  assert.throws(() => session.reserve("exact", DEVNET_USDC, 1000n), /Previous payment is unresolved/);
  assert.throws(() => session.cancelBeforeSubmission(id), /not reserved/);
});

test("a signing failure releases a reservation, but the attempt count remains bounded", () => {
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 1000n, maxPayments: 1 });
  const id = session.reserve("exact", DEVNET_USDC, 1000n);
  session.cancelBeforeSubmission(id);
  assert.equal(session.remaining, 1000n);
  assert.throws(() => session.reserve("exact", DEVNET_USDC, 1000n), /payment count limit/);
});

test("a batch voucher commitment records a charge without claiming an on-chain payout", () => {
  const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: 2000n, maxPayments: 2 });
  const id = session.reserve("batch-settlement", DEVNET_USDC, 1000n);
  session.markSubmitted(id);
  session.confirm(id, 1000n, "", "channel-a:1000");
  assert.equal(session.spent, 1000n);
  assert.equal(session.records[0].commitmentId, "channel-a:1000");
  assert.equal(session.records[0].transaction, "");
});

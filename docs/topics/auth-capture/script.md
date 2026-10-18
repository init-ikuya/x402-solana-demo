# Auth-Capture on Solana — speaker script

A standalone seven-slide English talk for five minutes. See the [slides](slides.md) and [design](ARCHITECTURE.md). The Issue #90 talk remains an alternative. Demo Day is tentatively October 19 or 21, 2026.

## Timing

| Slide | Content | Seconds |
| --- | --- | --- |
| 1 | Introduction | 20 |
| 2 | Evidence | 40 |
| 3 | Actors | 40 |
| 4 | Lifecycle | 50 |
| 5 | Money | 45 |
| 6 | Tests | 45 |
| 7 | Scope | 40 |

Total: 280 seconds plus 20 seconds of slack. Narration and live demo time have not been measured.

## Slide 1 — Introduction

> Hi everyone. This presentation explores auth-capture payments on Solana. An agent agrees to a spending ceiling, funds a hold, and the merchant later captures payment or releases unused funds. This is a proposed Anchor implementation, not a completed payment system.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 2 — Evidence

> The generic x402 specification already defines this payment lifecycle. In the official source snapshot we reviewed, we did not find a Solana auth-capture specification or SDK implementation. That does not prove nobody else is developing one. Our contribution target is a concrete Solana binding with documented authorities, accounting, and tests. The repository still covers four schemes, while this talk focuses on one.

Sources: [Generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md), [specification directory](https://github.com/x402-foundation/x402/tree/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture), and [SVM SDK](https://github.com/x402-foundation/x402/tree/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src). The statement is limited to the public materials reviewed.

## Slide 3 — Actors

> In our current exact and upto demo, the model calls a paid API tool, while application code checks the budget and signs with the client wallet. Auth-capture integration is planned. In that proposed flow, the client signs hold funding. The gateway performs the task and signs capture, cancellation, and refund operations. The facilitator sponsors transaction fees and relays those transactions. The Anchor program checks the required signatures, deadlines, amounts, and operation sequence. It controls the hold vault through a payment account. If the service disappears, the client has a direct recovery path that does not depend on the facilitator.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 4 — Lifecycle

> Our first demonstration uses the escrow flow. A hold must be confirmed before the paid task runs. On success, the merchant captures the actual price and releases the remainder in one transaction. On failure, it can void the remaining hold. If the service disappears, the client waits until the capture deadline and reclaims what remains. A later refund is different: the merchant must authorize it and provide the money. The program does not decide whether an answer was useful or correct.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 5 — Money

> Here is an illustrative example with test tokens. The client deposits one token. The merchant captures point three, and point seven returns from the vault to the client. Later, the merchant refunds point one from its own wallet. The client has recovered point eight, and the merchant retains point two. A refund does not create a new right to capture more money. If the merchant has no refund liquidity, the refund fails without changing the accounting.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 6 — Tests

> The tests should cover more than a successful transfer. Wrong signers, changed destinations, and amounts above the allowed balance must fail. We will test both sides of each deadline, repeated operations, and attempts to fund the same payment twice. We also need restart and timeout recovery, because a missing response does not mean a transaction failed. State counters and token transfers must succeed or fail together.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 7 — Scope

> Today the program has a single-request escrow prototype for upto; auth-capture remains a design. Its first milestone is a testable hold and capture lifecycle, followed by merchant-funded refunds and recovery. Direct charge under the authorization flow needs a separate design and tests. We will not label an escrow-only demonstration as complete auth-capture support. The goal is to make the missing Solana-specific decisions explicit and verify them before claiming interoperability. Thank you.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Optional demo architecture appendix — outside the timed talk

The agent calls the gateway's paid API. The gateway returns the x402 quote, receives the signed retry, and calls its configured facilitator URL. For `exact`, the facilitator verifies and settles the payment. For `upto`, it confirms the deposit before the API runs and the final charge afterward. The facilitator submits to Solana; the gateway returns the paid report and settlement header. See the [current demo architecture](../../demo-payment-architecture.md). This appendix describes the running `exact` / `upto` routes; `auth-capture` remains planned.

## Optional FAQ appendix — outside the timed talk

The app, not the model, holds the local Solana signing key. The model calls a paid API tool; application code checks the budget and signs. The official FAQ lists Base and Solana, while this demo uses Solana Devnet USDC. A separate local facilitator verifies and submits payments. Fiat conversion and card deposits are outside x402's native scope and outside this demo. Sources: [x402 FAQ](https://docs.x402.org/faq), [facilitator](https://docs.x402.org/core-concepts/facilitator), [demo tools](../../../examples/client/src/payment-tools.ts). Auth-capture itself remains proposed.

## Research scope and presentation caveats

- Pinned x402 commit: `cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71`. Recheck it before implementation or presentation.
- Failure to find an official Solana implementation does not mean nobody is working on one. Do not claim this is the first in the world.
- The initial proposal covers escrow only, with a legacy SPL test mint, no transfer fees, and zero protocol fees. The authorization flow with direct charge needs separate design and implementation.
- `void` and `reclaim` release the remaining hold; `refund` returns previously paid funds. Refunds depend on merchant authorization and liquidity. Do not claim unconditional buyer protection.
- Verify partial capture, release of the remainder, and later refunds as separate amounts. `reclaim` cannot recover already captured funds.
- The four-scheme implementation goal remains. The Issue #90 and auth-capture talks present alternative plans, not completed results.

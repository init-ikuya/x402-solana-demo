# Auth-Capture on Solana — speaker script

A seven-slide English presentation designed for a four-minute slot, including a planned 60-second video of the current `exact` / `upto` demo. See the [slides](slides.md) and [design](ARCHITECTURE.md). Auth-capture remains a proposal; the Issue #90 talk is an alternative. Demo Day is tentatively October 19 or 21, 2026.

## Timing

| Slide | Content | Seconds |
| --- | --- | --- |
| 1 | Introduction | 15 |
| 2 | Evidence | 20 |
| 3 | Actors | 30 |
|  | Current demo video | 60 |
| 4 | Lifecycle | 30 |
| 5 | Money | 25 |
| 6 | Tests | 20 |
| 7 | Scope | 20 |

Total: 160 seconds of narration + 60 seconds of demo video + 20 seconds for transitions = 240 seconds. These are targets, not measured reading or video times.

## Slide 1 — Introduction

> Hi everyone. This talk explores auth-capture on Solana: an agent funds a spending hold, then the merchant captures the charge or releases unused funds. This is a proposed Anchor design, not a completed payment flow.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 2 — Evidence

> The generic x402 specification defines auth-capture, but we did not find a Solana binding or SDK implementation in the official snapshot we reviewed. That is a limited observation, not a claim to be first. Our goal is to specify the Solana authorities, accounting, and tests.

Sources: [Generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md), [specification directory](https://github.com/x402-foundation/x402/tree/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture), and [SVM SDK](https://github.com/x402-foundation/x402/tree/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src). The statement is limited to the public materials reviewed.

## Slide 3 — Actors

> Today our agent can call a paid API through `exact` or our repository-specific `upto` escrow. Application code checks the budget and signs; the model never holds the key. In the proposed auth-capture flow, the client funds the hold, the merchant authorizes capture or refund, and the program enforces amounts and deadlines. Here is a short recording of what runs today.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## 60-second video cue — current demo, not auth-capture

Play a recorded run of the existing `exact` or repository-specific `upto` flow after Slide 3. Show the 402 quote, the client budget check and signed retry, the facilitator result, and the paid API response. Label simulated RPC or LiteSVM footage as local testing; do not present it as a confirmed Devnet transfer. The video is a planned presentation asset and has not been recorded or timed. If it is unavailable, use this minute for a clearly labeled walkthrough of the same current flow; do not improvise an auth-capture demonstration.

## Slide 4 — Lifecycle

> Auth-capture itself is still planned. The first design uses escrow: confirm the hold before work begins, then capture the actual price and release the rest. The merchant may void an unused hold. If the service disappears, the client can reclaim the remainder after the deadline. A later refund requires merchant authorization and funds.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 5 — Money

> For example, from a one-token hold, capture point three and return point seven. If the merchant later refunds point one from its own wallet, the client has recovered point eight and the merchant retains point two. A refund never increases the capture allowance.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 6 — Tests

> Tests must reject wrong signers, changed destinations, excessive amounts, replay, and early reclaim. We also need to reconcile timeouts before retrying. Token transfers and state counters must change atomically.

Basis: Our [design](ARCHITECTURE.md) starts from the lifecycle and network implementation requirements in the [generic specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md). The specific accounts, signature method, money example, and tests are proposals, not an official Solana specification or measured results.

## Slide 7 — Scope

> The running `upto` escrow is a local prototype. Auth-capture is the next design and implementation target, followed by refunds and recovery. Direct charge needs separate work. We will verify these rules before claiming Solana interoperability. Thank you.

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

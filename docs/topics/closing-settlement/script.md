# Batch settlement on Solana — Demo Day speaker script

A separate seven-slide English batch-settlement reference presentation for a four-minute slot. The one-minute segment is a planned batch-route walkthrough; no recording or end-to-end payout evidence exists yet. The official `@x402/svm` 2.28.0 route is integrated locally. Issue #90 is a follow-up design, not part of the running route. The [auth-capture deck](../auth-capture/slides.md) is the selected Demo Day presentation.

## Timing

| Slide | Content | Seconds |
| --- | --- | --- |
| 1 | Introduction | 15 |
| 2 | Why batch? | 20 |
| 3 | Payment lifecycle | 30 |
|  | Batch route walkthrough | 60 |
| 4 | Repository implementation | 25 |
| 5 | Verified evidence | 30 |
| 6 | Closing risk and Issue #90 | 25 |
| 7 | Next milestone | 15 |

Total: 160 seconds of narration + 60 seconds of walkthrough + 20 seconds for transitions = 240 seconds. Durations have not been measured.

## Slide 1 — Introduction

> Hi everyone. This project adds batch settlement to an x402 paid API on Solana. One funded channel can support repeated requests with client-signed cumulative vouchers. I will show what is implemented and what still needs an end-to-end payout test.

Basis: [SVM specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md) and our [gateway route](../../../examples/gateway/src/app.ts).

## Slide 2 — Why batch?

> With exact, each paid request is a transfer. Batch instead funds a channel once. Each later request signs a higher cumulative total, and the merchant retains the latest accepted voucher. Voucher acceptance does not itself move tokens; the claim and eventual distribution happen later.

Basis: [official SDK guide](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src/batch-settlement/README.md). This is a protocol comparison, not a measured cost or speed claim.

## Slide 3 — Payment lifecycle

> The agent's application checks the budget and signs; the model never receives its key. The gateway advertises a batch requirement in HTTP 402. The client opens or reuses a channel and retries with a cumulative voucher. The gateway accepts the request and stores the channel state. A later worker asks the facilitator to claim and distribute funds.

Basis: [client implementation](../../../examples/client/src/batch-client.ts), [gateway setup](../../../examples/gateway/src/main.ts), and [facilitator setup](../../../examples/gateway/src/run-facilitator.ts). The payout sequence is wired but not verified end to end.

## 60-second batch route walkthrough — planned presentation asset

Show the batch route's local 402 test and the implementation in four short cuts: (1) `GET /api/trump-insider/batch` returns a `batch-settlement` requirement with `voucherSigner=client` and `assetTransferMethod=channel`; (2) the client selects the requirement, opens or reuses its stored channel, and signs the cumulative voucher; (3) the gateway and facilitator persist channel and pending state; (4) the redemption worker has periodic `redeem()` and on-closing triggers. Show test names/results on screen and label this **local route and storage evidence**. Do not show a successful paid response, claim confirmation, token payout, or Devnet transaction unless separately recorded and verified. The video has not been recorded or timed. If it is unavailable, use the same minute for a live slide/code walkthrough with the same scope label. Redact keys, signed payloads, and private configuration.

## Slide 4 — Repository implementation

> This is the official SVM batch binding, enabled as an opt-in API route. The client persists channel allocations. The gateway persists accepted vouchers and runs periodic redemption. The local facilitator stores its channel and pending transaction state. A refund command lets the client request closure for unused escrow.

Basis: [client store](../../../examples/client/src/batch-client.ts), [gateway store](../../../examples/gateway/src/batch-store.ts), [facilitator stores](../../../examples/gateway/src/batch-facilitator-store.ts), and [refund command](../../../examples/client/src/batch-refund.ts). This is the Foundation channel program, not this repository's custom Anchor `upto` program.

## Slide 5 — Verified evidence

> Local tests verify that the batch endpoint advertises the expected official binding, that the gateway forwards it through the facilitator, and that channel stores survive reopening. Type checking and the payment test suite pass. We have not verified a complete deposit-to-distribution transaction sequence or live Devnet balances, so a successful payout is not yet a result.

Basis: [batch route test](../../../examples/gateway/test/batch-route.test.ts), [gateway store test](../../../examples/gateway/test/batch-store.test.ts), [client store test](../../../examples/client/test/batch-client-store.test.ts). Current evidence: 30 TypeScript tests passed locally; no on-chain batch payout assertion.

## Slide 6 — Closing risk and Issue #90

> Batch introduces a delayed claim. If the client requests closure while the facilitator is unavailable, the merchant can hold a valid voucher without an independent way to record it during Closing. Issue #90 proposes a deadline-bounded merchant submission path. That is a separate Anchor experiment, not a feature of today's SDK demo.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [Open-only settle at the pinned baseline](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), and [our design](ARCHITECTURE.md#design-focus-issue-90-planned). Recheck upstream status before presenting.

## Slide 7 — Next milestone

> Next we need one full Devnet run: fund a channel, make repeated paid calls, verify the cumulative claim, close and distribute, and compare token balances. Then we can test Issue #90 against the canonical Closing behavior. The batch integration is in place; payout and recovery remain open evidence gaps. Thank you.

Basis: [gateway operations](../../../examples/gateway/README.md#batch-settlement-payment-flow) and [Issue #90 validation plan](ARCHITECTURE.md#demonstration-and-acceptance-criteria).

## Optional architecture appendix — outside the timed talk

The agent selects the batch paid API tool. Its application checks the quote and budget, persists the channel, and signs each cumulative voucher. The gateway advertises the 402 requirement, verifies through the local facilitator, and persists accepted channel state. A periodic worker invokes the official SDK channel manager to redeem. Claim recording and final token distribution are separate events. See the [three-party request sequence](../../demo-payment-architecture.md) and [gateway guide](../../../examples/gateway/README.md#batch-settlement-payment-flow).

## Optional FAQ appendix — outside the timed talk

The application holds the local signing key; the model only calls a tool. The opt-in batch route uses Solana Devnet USDC and the official SVM SDK. The separate local facilitator sponsors transactions. The repository's Anchor program backs only the custom `upto` route. Complete batch payout and live Devnet balance checks are still pending. Sources: [x402 SVM binding](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md), [demo tools](../../../examples/client/src/payment-tools.ts).

## Evidence and scope of verification

- x402 snapshot: `cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71`; payment-channels baseline: `3ffa4d6728ad88e4a9667a76ad9ccd68a302c696`. Recheck upstream status before presenting.
- The SDK route uses the Foundation program and client-signed vouchers. It is separate from the proposed custom Anchor Issue #90 route. The Foundation README's deployment report is not our independent verification.
- Local tests cover HTTP challenge, facilitator forwarding, and durable stores. They do not prove successful deposit, claim, distribution, or refund on Devnet.
- A stored voucher is an accepted off-chain claim, not a token transfer. A confirmed claim is still distinct from distribution.
- Issue #90 cannot recover a channel after sealing. Its merchant-operated worker needs independent RPC and a SOL fee payer; this is design work.

## Before presenting

Rehearse narration and walkthrough together; confirm the date and presenter name. Record the exact commit and local test output. If a Devnet sequence becomes available, record transaction signatures and before/after balances, then update slides and narration to match that evidence.

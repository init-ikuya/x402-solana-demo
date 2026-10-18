# Fall Class — Issue #90 speaker script

A seven-slide English presentation designed for a four-minute slot, including a planned 60-second video of the current `exact` / `upto` demo. Demo Day is tentatively October 19 or 21, 2026. The four-scheme implementation goal remains, while this talk focuses on the proposed Issue #90 recovery path. The Issue #83 alternative was dropped.

## Timing

| Slide | Content | Seconds |
| --- | --- | --- |
| 1 | Introduction | 15 |
| 2 | Context | 20 |
| 3 | Actors | 30 |
|  | Current demo video | 60 |
| 4 | Problem | 25 |
| 5 | Proposed route | 30 |
| 6 | Validation | 25 |
| 7 | Progress | 15 |

Total: 160 seconds of narration + 60 seconds of demo video + 20 seconds for transitions = 240 seconds. These are targets, not measured reading or video times.

## Slide 1 — Introduction

> Hi everyone. This project explores x402 payments on Solana. Today I will focus on Issue #90: recovering a merchant payment when a channel is closing and the facilitator is offline. The recovery change is still a design.

Basis: [Current program](../../../programs/anchoring-payment-channels/src/lib.rs) and our [design and validation plan](ARCHITECTURE.md#design-focus-issue-90-planned). Do not present planned work as an implemented result.

## Slide 2 — Context

> In batch settlement, the client signs cumulative vouchers while the merchant serves requests. The merchant redeems the latest voucher later. Solana specifications and SDK code already exist; the Foundation reports its channel program live on mainnet. Our target is a particular recovery gap.

Sources: [SVM batch-settlement specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md), [SDK](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860f34433c2e8e0d71/typescript/packages/mechanisms/svm/src/batch-settlement/README.md), and [Foundation README](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md). Mainnet operation is the provider's report, not our independent verification.

## Slide 3 — Actors

> Our running demo already has an agent, gateway, and local facilitator for `exact` and a custom `upto` path. The client application controls signing and budgets. The proposed batch path adds a long-lived channel: the gateway stores the latest voucher, while the facilitator sponsors transactions and holds lifecycle authority. The merchant would have a separate route to submit a voucher when the facilitator is unavailable. First, here is the current demo.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [current `settle` state restriction](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), [`settle_and_seal`](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs), and [distribution and closure instructions](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions). The direct-submission worker and outage demo are [our design](ARCHITECTURE.md#design-focus-issue-90-planned).

## 60-second video cue — current demo, not Issue #90 recovery

Play a recorded run of the existing `exact` or repository-specific `upto` flow after Slide 3. Show the 402 quote, client-side budget check and signed retry, facilitator result, and paid API response. Label simulated RPC or LiteSVM footage as local testing; do not present it as a confirmed Devnet transfer or as the planned Issue #90 recovery. The video is a planned presentation asset and has not been recorded or timed. If it is unavailable, use this minute for a clearly labeled walkthrough of the same current flow.

## Slide 4 — Problem

> Suppose the merchant served requests and holds a valid voucher. The client requests closure, putting the channel into Closing. Normal settlement rejects that state. Cooperative settlement requires the facilitator signature. If it is offline, the merchant cannot independently record the payment during the grace period.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [current `settle` state restriction](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), [`settle_and_seal`](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs), and [distribution and closure instructions](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions). The direct-submission worker and outage demo are [our design](ARCHITECTURE.md#design-focus-issue-90-planned).

## Slide 5 — Proposed route

> Issue #90 proposes allowing ordinary settlement during Closing, strictly before the deadline. A merchant worker submits the stored voucher. The program still checks its signature, channel, expiry, and amount. Settlement records the claim but does not transfer tokens. Sealing and distribution happen later. An already sealed channel cannot be rescued.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [current `settle` state restriction](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), [`settle_and_seal`](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs), and [distribution and closure instructions](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions). The direct-submission worker and outage demo are [our design](ARCHITECTURE.md#design-focus-issue-90-planned).

## Slide 6 — Validation

> We plan paired tests of the baseline and modified program, just before, at, and after the deadline. Invalid signatures, excess amounts, and duplicate vouchers must still fail. We will also test distribution once, worker restarts, and uncertain transaction outcomes.

Basis: [Current program](../../../programs/anchoring-payment-channels/src/lib.rs) and our [design and validation plan](ARCHITECTURE.md#design-focus-issue-90-planned). Do not present planned work as an implemented result.

## Slide 7 — Progress

> Today we have a single-request `upto` escrow prototype. Batch channel recovery is planned. The goal is a testable merchant fallback during Closing, not a claim of completed recovery. Thank you.

Basis: [Current program](../../../programs/anchoring-payment-channels/src/lib.rs) and our [design and validation plan](ARCHITECTURE.md#design-focus-issue-90-planned). Do not present planned work as an implemented result.

## Optional demo architecture appendix — outside the timed talk

The agent calls the gateway's paid API. The gateway returns the x402 quote, receives the signed retry, and calls its configured facilitator URL. For `exact`, the facilitator verifies and settles the payment. For `upto`, it confirms the deposit before the API runs and the final charge afterward. The facilitator submits to Solana; the gateway returns the paid report and settlement header. See the [current demo architecture](../../demo-payment-architecture.md). This appendix describes the running `exact` / `upto` routes, not the planned Issue #90 recovery route.

## Optional FAQ appendix — outside the timed talk

The app, not the model, holds the local Solana signing key. The model calls a paid API tool; application code checks the budget and signs. The official FAQ lists Base and Solana, while this demo uses Solana Devnet USDC. A separate local facilitator verifies and submits payments. Fiat conversion and card deposits are outside x402's native scope and outside this demo. Sources: [x402 FAQ](https://docs.x402.org/faq), [facilitator](https://docs.x402.org/core-concepts/facilitator), [demo tools](../../../examples/client/src/payment-tools.ts).

## Evidence and scope of verification

- Pinned payment-channels commit: `3ffa4d6728ad88e4a9667a76ad9ccd68a302c696`; x402 commit: `cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71`. Issues can change, so recheck them and related PRs before implementation or presentation.
- The [official README](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md) reports mainnet operation; this does not prove completeness, stability, or support by every facilitator. Its v2 extensions are described as unimplemented proposals. Payment channel v2 and x402 v2 are separate things.
- Issue #90 changes the states in which ordinary `settle` is allowed. It does not introduce a new voucher format or cryptography. The estimate that this addition is relatively small is our judgment; it does not mean the full channel system is easy to implement.
- Issue #90 cannot recover an already Sealed channel or an early cooperative closure. Keep signature and deadline validation on chain, and distinguish `settle` from `distribute`.
- Issue #83 has [fix PR #84](https://github.com/solana-foundation/payment-channels/pull/84), which was open and unmerged when checked (head `25df9636698c320a0716ba224cbc8724acf63edf`). It was removed from the presentation candidates by project decision.

## Before presenting

Rehearse the narration and video together, and adjust them to fit four minutes. After implementation, update test results, execution logs, and reference commits, distinguishing plans from observations. The experimental Anchor program is a separate deployment; do not suggest that it changes the official canonical program.

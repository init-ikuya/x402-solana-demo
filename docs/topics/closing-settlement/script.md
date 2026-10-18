# Fall Class — Issue #90 speaker script

A standalone seven-slide English talk for five minutes. Demo Day is tentatively October 19 or 21, 2026, according to the presenter. The four-scheme implementation goal remains, while this talk focuses on Issue #90. The Issue #83 alternative was dropped.

## Timing

| Slide | Content | Seconds |
| --- | --- | --- |
| 1 | Introduction | 20 |
| 2 | Context | 35 |
| 3 | Actors | 45 |
| 4 | Problem | 45 |
| 5 | Proposed route | 50 |
| 6 | Validation | 50 |
| 7 | Progress | 35 |

Total: 280 seconds plus 20 seconds of slack. This is an estimate, not a measured reading time, and excludes any live demo.

## Slide 1 — Introduction

> Hi everyone. This project implements x402 payments on Solana. The repository covers four payment schemes, but this talk focuses on one recovery problem: what happens when a client closes a channel and the payment facilitator is unavailable? That recovery change is still at the design stage.

Basis: [Current program](../../../programs/anchoring-payment-channels/src/lib.rs) and our [design and validation plan](ARCHITECTURE.md#design-focus-issue-90-planned). Do not present planned work as an implemented result.

## Slide 2 — Context

> In batch settlement, a client signs payment vouchers while an API handles requests. The merchant collects the vouchers and redeems them later. Solana specifications and SDK code already exist, and the Foundation reports its channel program live on mainnet. My focus is an improvement described in upstream issue ninety, rather than a claim that Solana payments do not exist.

Sources: [SVM batch-settlement specification](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md), [SDK](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860f34433c2e8e0d71/typescript/packages/mechanisms/svm/src/batch-settlement/README.md), and [Foundation README](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md). Mainnet operation is the provider's report, not our independent verification.

## Slide 3 — Actors

> There are three actors. In our current exact and upto demo, the model calls a paid API tool, while application code checks the budget and signs with the client wallet. Batch integration is planned. In the proposed batch flow, the client funds the channel and signs payment vouchers. The gateway provides the API and keeps the latest voucher. The facilitator sponsors transactions and holds the channel payee authority. In this arrangement, that authority belongs to the facilitator, not the merchant receiving the API payment. Our recovery worker will give the merchant a separate submission route, with its own RPC connection and transaction fees.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [current `settle` state restriction](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), [`settle_and_seal`](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs), and [distribution and closure instructions](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions). The direct-submission worker and outage demo are [our design](ARCHITECTURE.md#design-focus-issue-90-planned).

## Slide 4 — Problem

> Imagine that the merchant has already served several requests and holds a valid voucher. Before it is settled, the client requests closure. The channel enters Closing and a grace period begins. Normal settlement currently rejects that state. The alternative is cooperative settlement and sealing, which requires the facilitator signature. If the facilitator is offline, the merchant cannot use either route independently. This is the failure scenario we want to reproduce.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [current `settle` state restriction](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), [`settle_and_seal`](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs), and [distribution and closure instructions](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions). The direct-submission worker and outage demo are [our design](ARCHITECTURE.md#design-focus-issue-90-planned).

## Slide 5 — Proposed route

> The proposal allows normal settlement during Closing, strictly before the deadline. The merchant submits the saved voucher directly. The program still validates its signature, channel, expiry, and amount. It records the settlement and leaves the channel Closing. This does not transfer tokens or extend the deadline. After the deadline, sealing and distribution complete the payment and refund. If the channel was already sealed, the recovery fails; this is not a guarantee against every race.

Sources: [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90), [current `settle` state restriction](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs), [`settle_and_seal`](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs), and [distribution and closure instructions](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions). The direct-submission worker and outage demo are [our design](ARCHITECTURE.md#design-focus-issue-90-planned).

## Slide 6 — Validation

> I will compare baseline and modified behavior using the same outage scenario. The tests will check the instant before the deadline, the deadline itself, and the time afterward. Invalid signatures, excessive amounts, and duplicate vouchers must still fail. Settlement should only update state; distribution should pay once and return the unused balance. I also want to test restarts and unknown transaction outcomes, so a timeout does not accidentally cause an unsafe retry.

Basis: [Current program](../../../programs/anchoring-payment-channels/src/lib.rs) and our [design and validation plan](ARCHITECTURE.md#design-focus-issue-90-planned). Do not present planned work as an implemented result.

## Slide 7 — Progress

> Today the repository contains a single-request Anchor escrow prototype for upto. Next I will reproduce the batch channel lifecycle, implement the changed state gate, and compare the results. All four payment schemes remain in the repository scope. This presentation focuses on reducing facilitator dependence during the Closing grace period. Thank you.

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

Read the script aloud and adjust it to fit five minutes. After implementation, update test results, execution logs, and reference commits, distinguishing plans from observations. The experimental Anchor program is a separate deployment; do not suggest that it changes the official canonical program.

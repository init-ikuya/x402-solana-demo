# Auth-Capture on Solana — speaker script

Main English Demo Day talk: seven slides, approximately four minutes including a 60-second demo walkthrough. Use the [slides](slides.md), [architecture](ARCHITECTURE.md), and [demo runbook](demo.md) together. The walkthrough is a local test or a recorded Devnet run only when transaction signatures and balances have actually been checked.

## Timing

| Segment | Seconds |
| --- | ---: |
| Slide 1 — problem and result | 20 |
| Slide 2 — specification and binding | 25 |
| Slide 3 — actors and authority | 25 |
| Auth-capture demo walkthrough | 60 |
| Slide 4 — request lifecycle | 30 |
| Slide 5 — money and refund | 25 |
| Slide 6 — test evidence | 20 |
| Slide 7 — limits and next validation | 15 |
| Transitions | 20 |

Total: 240 seconds. Rehearsal and video duration have not yet been measured.

## Slide 1 — Hold, capture, refund

> Hi everyone. This is an experimental auth-capture escrow flow for x402 on Solana. The client authorizes a bounded hold before an API request. The merchant charges the actual amount after the work and releases the rest. Our Anchor program and local HTTP demo implement that lifecycle.

## Slide 2 — Specification and binding

> The generic x402 specification describes an escrow flow and a separate direct authorization flow. We implement only the escrow flow. Our Solana transaction format is a project-specific binding, not an official interoperable SVM profile. The Foundation payment-channels Closing proposal is a different problem.

Source: [generic auth-capture specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md).

## Slide 3 — Who signs

> The model selects a paid API tool; application code checks the quote and budget. The payer signs the hold, and the facilitator confirms it before the API runs. The merchant signs capture, void, or refund. After the capture deadline, the payer can reclaim any remaining hold directly.

## 60-second demo cue

Use the [browser demo and runbook](demo.md#browser-presentation). Show the agent selecting the auth-capture tool, the 402 response with a 1000-unit ceiling and deadlines, the redacted signed retry, and the paid report with a 300-unit settlement response and payment ID. The UI's 700-unit remainder is calculated; show a LiteSVM assertion or verified live balance record for the actual release and optional 100-unit merchant-funded refund. If using a live Devnet run, show actual signatures and balances. Do not label simulated RPC output as a Devnet payment. No video has been recorded yet.

## Slide 4 — Request lifecycle

> This request uses two settlement phases. First the facilitator confirms a 1000-unit hold. The gateway then runs the fictional paid API. After success, the merchant signs one atomic transaction that captures 300 and releases 700. If the task fails, the merchant can release the hold. A separate payer-only reclaim is available after the capture deadline.

## Slide 5 — Money and refund

> Release and refund are different transfers. The 700-unit release comes from the unused hold. A later 100-unit refund comes from the merchant's token account, with merchant consent and sufficient balance. The client has recovered 800 in this example, and the merchant retains 200.

## Slide 6 — Evidence

> LiteSVM tests exercise capture, release, refund, wrong authority, overcharge, replay, deadlines, duplicate funding, and insufficient refund liquidity. An HTTP integration test runs the client, gateway, and facilitator against a simulated RPC. Type checks and the broader payment test suite pass. These are local results; live Devnet balances remain unverified.

## Slide 7 — Scope

> This is a working local escrow prototype, not the complete generic scheme. Direct authorization and charge are still open. We also need a recorded Devnet transaction and stronger restart recovery before an interoperability claim. The simple hold, capture, release, and merchant-funded refund path is the contribution we can show today. Thank you.

## Presenter notes

- The paid report is explicitly fictional parody, not real private information.
- The example uses classic SPL Token, associated token accounts, one merchant, and zero protocol fees.
- The merchant can refuse a refund or lack liquidity. The payer reclaim returns only funds still held.
- The in-request capture is relayed through facilitator `/settle`; later refund, capture, void, or reclaim uses a direct CLI transaction.
- The custom auth-capture program does not implement [payment-channels Issue #90](https://github.com/solana-foundation/payment-channels/issues/90).
- Avoid claims of first implementation or official SVM compatibility.

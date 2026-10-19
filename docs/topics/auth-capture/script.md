# Auth-Capture on Solana — speaker script

Main English Demo Day talk: seven main slides, followed by an Appendix divider and two optional reference slides. Target 3 minutes 50 seconds, including a 60-second edited recording of the browser agent, leaving 10 seconds under the four-minute limit. Use the [slides](slides.md), [architecture](ARCHITECTURE.md), and [demo runbook](demo.md) together. Label a locally simulated run as such; call it a Devnet payment only after checking its transaction signatures and balances.

## Timing

| Segment | Seconds |
| --- | ---: |
| Slide 1 — problem and result | 20 |
| Slide 2 — EVM/SVM gap | 25 |
| Slide 3 — actors and authority | 20 |
| Auth-capture demo walkthrough | 60 |
| Slide 4 — request lifecycle | 25 |
| Slide 5 — money and refund | 20 |
| Slide 6 — test evidence | 25 |
| Slide 7 — limits and next validation | 20 |
| Transitions | 15 |

Total: 230 seconds. Rehearsal and video duration have not yet been measured.

Read each quoted paragraph while the matching PDF page is visible. After page 3, switch to the recorded demo; resume the PDF at page 4 when the clip ends. Page 8 is the Appendix divider, and pages 9–10 are optional reference slides with no scripted lines.

## PDF page 1 — Hold, capture, refund

> Hi everyone. We built an experimental auth-capture escrow for x402 on Solana. An AI agent requests paid work, locks a maximum, then the merchant captures the actual cost and releases the rest. Here is the lifecycle.

## PDF page 2 — Specification and binding

> Official x402 implements auth-capture for EVM, but has no published SVM implementation in the reviewed October 15 snapshot. Our Anchor program covers the escrow path, including later merchant-funded refunds and payer reclaim. This is a project-specific binding, not official SVM interoperability.

Sources: [generic auth-capture specification](https://github.com/x402-foundation/x402/blob/faa1c694c66a3732aaabbce93bdae140e521a67d/specs/schemes/auth-capture/scheme_auth_capture.md), [EVM SDK source](https://github.com/x402-foundation/x402/tree/faa1c694c66a3732aaabbce93bdae140e521a67d/typescript/packages/mechanisms/evm/src/auth-capture), and [SVM SDK source](https://github.com/x402-foundation/x402/tree/faa1c694c66a3732aaabbce93bdae140e521a67d/typescript/packages/mechanisms/svm/src).

## PDF page 3 — Who signs

> The model chooses the paid API tool, while application code enforces the budget. The payer signs the hold; the merchant signs capture or refund. The facilitator relays transactions, and the payer can reclaim an abandoned hold after the deadline.

## Recorded demo — after PDF page 3

Use the [pre-recorded browser-agent demo and runbook](demo.md#browser-presentation) as the primary presentation path. Point to the 402 response with a 1000-unit ceiling, the redacted signed retry, and the paid report with a 300-unit settlement response and payment ID. Use the final seconds for recorded confirmed account counters if available. The UI's 700-unit remainder is calculated; show a verified Devnet balance record before claiming a real transfer. The clip may shorten waiting periods, so do not imply that its edited duration is the actual settlement latency. Keep refund, deadline reclaim, tests, and CLI operations in the slides or Q&A, outside this minute. No video has been recorded yet.

## PDF page 4 — Request lifecycle

> The facilitator confirms a 1000-unit hold before the API runs. After success, one transaction captures 300 and releases 700. If the task fails, the merchant voids the hold. An abandoned hold can be reclaimed after the deadline.

## PDF page 5 — Money and refund

> Release and refund move different money. The 700-unit release comes from escrow. A later 100-unit refund comes from the merchant's wallet, with merchant consent and liquidity. The merchant ultimately keeps 200.

## PDF page 6 — Evidence

> LiteSVM tests cover authority, amount bounds, replay, deadlines, and refund liquidity. The HTTP integration test uses simulated RPC. Devnet signatures and balances are still unverified, so the recording must be labeled according to the environment it actually uses.

## PDF page 7 — Scope

> Today's contribution is the escrow lifecycle on Solana. Direct charge and official interoperability remain outside scope. Next: deploy to Devnet, verify balances, and record the agent's payment. Thank you.

## Presenter notes

- The paid report is explicitly fictional parody, not real private information.
- The example uses classic SPL Token, associated token accounts, one merchant, and zero protocol fees.
- The merchant can refuse a refund or lack liquidity. The payer reclaim returns only funds still held.
- The in-request capture is relayed through facilitator `/settle`; later refund, capture, void, or reclaim uses a direct transaction tool for development checks and is outside the browser presentation.
- The custom auth-capture program does not implement [payment-channels Issue #90](https://github.com/solana-foundation/payment-channels/issues/90).
- Avoid claims of first implementation or official SVM compatibility.

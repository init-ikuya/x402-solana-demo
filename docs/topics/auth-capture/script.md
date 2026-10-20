# Auth-Capture on Solana — speaker script

Main English Demo Day talk: seven main slides, followed by an Appendix divider and two optional reference slides. Target about 3 minutes 28 seconds, including the recorded 38-second local validator demo, leaving room under the four-minute limit. Use the [slides](slides.md), [architecture](ARCHITECTURE.md), and [demo runbook](demo.md) together. Label the recording as a local validator transaction with a test token; Devnet payment remains unverified.

## Timing

| Segment | Seconds |
| --- | ---: |
| Slide 1 — problem and result | 20 |
| Slide 2 — EVM/SVM gap | 25 |
| Slide 3 — actors and authority | 20 |
| Auth-capture demo walkthrough | 38 |
| Slide 4 — request lifecycle | 25 |
| Slide 5 — money and refund | 20 |
| Slide 6 — test evidence | 25 |
| Slide 7 — limits and next validation | 20 |
| Transitions | 15 |

Total: 208 seconds. The recorded clip is 37.5 seconds; rehearse the spoken transitions separately.

Read each quoted paragraph while the matching PDF page is visible. After page 3, switch to the recorded demo; resume the PDF at page 4 when the clip ends. Page 8 is the Appendix divider, and pages 9–10 are optional reference slides with no scripted lines.

## PDF page 1 — Hold, capture, refund

> Hi everyone. We built an experimental auth-capture escrow for x402 on Solana. An AI agent requests paid work, locks a maximum, then the merchant captures the actual cost and releases the rest. Here is the lifecycle.

## PDF page 2 — Specification and binding

> Official x402 implements auth-capture for EVM, but has no published SVM implementation in the reviewed October 15 snapshot. Our Anchor program covers the escrow path, including later merchant-funded refunds and payer reclaim. This is a project-specific binding, not official SVM interoperability.

Sources: [generic auth-capture specification](https://github.com/x402-foundation/x402/blob/faa1c694c66a3732aaabbce93bdae140e521a67d/specs/schemes/auth-capture/scheme_auth_capture.md), [EVM SDK source](https://github.com/x402-foundation/x402/tree/faa1c694c66a3732aaabbce93bdae140e521a67d/typescript/packages/mechanisms/evm/src/auth-capture), and [SVM SDK source](https://github.com/x402-foundation/x402/tree/faa1c694c66a3732aaabbce93bdae140e521a67d/typescript/packages/mechanisms/svm/src).

## PDF page 3 — Who signs

> The model chooses the paid API tool, while application code enforces the budget. The payer signs the hold; the merchant signs capture or refund. The facilitator relays transactions, and the payer can reclaim an abandoned hold after the deadline.

## Recorded demo — after PDF page 3

Play the [38-second two-scene browser recording](demo.md#browser-presentation). Point to the 402 response with a 1000-unit ceiling, the redacted signed retry, and the paid report with a 300-unit settlement response. In the second scene, a **merchant-initiated** 100-unit refund is followed by a confirmed local RPC refresh: funded 1000, captured 300, released 700, refunded 100; payer −200 and merchant +200 from the pre-payment baseline. The agent initiates the paid request, while the merchant operation initiates the later refund. The test token is not pegged to a dollar. The clip uses real local validator transactions; it is not a Devnet transfer. Keep deadline reclaim and CLI details in Q&A.

## PDF page 4 — Request lifecycle

> The facilitator confirms a 1000-unit hold before the API runs. After success, one transaction captures 300 and releases 700. If the task fails, the merchant voids the hold. An abandoned hold can be reclaimed after the deadline.

## PDF page 5 — Money and refund

> Release and refund move different money. The 700-unit release comes from escrow. A later 100-unit refund comes from the merchant's wallet, with merchant consent and liquidity. The merchant ultimately keeps 200.

## PDF page 6 — Evidence

> LiteSVM tests cover authority, amount bounds, replay, deadlines, and refund liquidity. The HTTP integration test uses simulated RPC. Separately, the browser agent and merchant refund ran against a local validator with confirmed balance changes. Devnet remains unverified.

## PDF page 7 — Scope

> Today's contribution is the escrow lifecycle on Solana. The program is deployed on Devnet; a Devnet payment and balance check are next. Direct charge and official interoperability remain outside scope. Thank you.

## Presenter notes

- The paid report is explicitly fictional parody, not real private information.
- The example uses classic SPL Token, associated token accounts, one merchant, and zero protocol fees.
- The merchant can refuse a refund or lack liquidity. The payer reclaim returns only funds still held.
- The in-request capture is relayed through facilitator `/settle`; the later refund uses a direct merchant-signed operation behind the browser recording. Do not imply that the agent requested the refund.
- The custom auth-capture program does not implement [payment-channels Issue #90](https://github.com/solana-foundation/payment-channels/issues/90).
- Avoid claims of first implementation or official SVM compatibility.

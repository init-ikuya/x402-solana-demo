# Project notes

## Direction

Reimplement [solana-foundation/payment-channels](https://github.com/solana-foundation/payment-channels) using Rust and Anchor, then attempt additional features described as future work in the upstream issue.

The project is intended for Demo Day at [Solana School: Fall Class](https://luma.com/jy1g8k90). The [auth-capture presentation draft](topics/auth-capture/slides.md) is maintained in this repository.

## Demo scope and implementation languages

- On-chain settlement: Rust with Anchor.
- HTTP gateway: TypeScript. It returns payment requirements, verifies signed vouchers, calls the paid AI API, and submits settlement transactions.
- AI agent: TypeScript. The demo must include an actual LLM tool-use loop, not just a scripted HTTP client.
- The agent's payment tool handles HTTP 402 responses, signs vouchers within a configured spending limit, retries the request, and returns the result to the model. Signing keys remain in application code; they are never included in model prompts or tool results.
- Run the gateway and agent locally for the initial demo, with the settlement program deployed to devnet. Public hosting and MCP integration are optional follow-ups.
- Demonstrate an agent choosing the paid tool, completing a payment-authorized request, and using the returned answer, followed by on-chain settlement and refund of unused funds.
- Use the same fictional Donald Trump "insider information" parody response as the paid resource for `exact`, `batch-settlement`, `upto`, and `auth-capture`. The joke is application content, independent of payment mechanics. The implemented routes are `/api/trump-insider` for `exact` and an opt-in `/api/trump-insider/upto` for `upto`; the other bindings are still planned. Present the answer as invented satire, never as a real non-public fact.

The `exact` and `upto` gateway paths and local facilitator use Express and the official x402 SVM SDK; the separate payment CLI uses the same SDK without Express. The `upto` HTTP flow is locally tested with a simulated facilitator, while canonical channel transactions are not yet verified. The client now also includes a model-driven tool loop with a local Ollama adapter; automated tests use a fake model, not live model inference. The other two payment adapters remain planned. Future custom Anchor settlement examples can use the standard TypeScript client with the program IDL; consider Codama later if generated clients are needed.

## Example application layout

- `examples/gateway/`: Service-side reference implementation, also used by the demo. Integrators can replace it with their own server.
- `examples/client/`: Payment CLI, spending controls, and a model-driven agent using the same payment adapters. Other HTTP clients can use the gateway without an LLM.
- `programs/anchoring-payment-channels/`: Core on-chain settlement program, independent of the examples and AI providers.

Keep the example applications in this repository's npm workspace and document configuration and startup commands runnable from the repository root. The gateway and client packages exist; the agent lives in the client package.

## Upstream references

- Repository: https://github.com/solana-foundation/payment-channels
- Reference issue: Pending confirmation.
- Baseline commit: To be selected before implementing the channel logic.
- Future-work items: To be extracted from the reference issue once confirmed.

## Presentation focus

The selected presentation track covers the [Solana auth-capture design](topics/auth-capture/ARCHITECTURE.md) and [dedicated slides](topics/auth-capture/slides.md). It investigates the missing binding and an escrow-first prototype, with direct charge tracked separately. Both presentation options preserve the four-scheme implementation requirement.

The alternative [Issue #90](https://github.com/solana-foundation/payment-channels/issues/90) presentation covers direct merchant settlement during the Closing grace period. See [the architecture](topics/closing-settlement/ARCHITECTURE.md#design-focus-issue-90-planned) and [slides](topics/closing-settlement/slides.md). All four schemes remain required. Issue #83 was excluded from the #90 presentation after reviewing existing [PR #84](https://github.com/solana-foundation/payment-channels/pull/84); recheck its status before presenting.

## Implementation plan

The agreed payment scope includes all four x402 schemes. The shared TypeScript transport and `exact` path were implemented first, followed by an opt-in `upto` HTTP path backed by this repository's Anchor program. The longer-lived `batch-settlement` channel and `auth-capture` remain planned. See the [architecture implementation scope](ARCHITECTURE.md#four-scheme-implementation-scope-planned) for sources, per-scheme acceptance criteria, and binding boundaries. This supersedes the earlier voucher-only demo scope. It does not commit all four milestones to the Demo Day deadline.

1. Establish the Rust and Anchor workspace with local integration tests.
2. Review the upstream program and reference issue; document the baseline behavior and intended extensions.
3. Reimplement the baseline channel lifecycle and settlement rules in Anchor.
4. Test expected behavior and rejection of invalid operations.
5. Implement selected future-work experiments and document results and differences from upstream.
6. Implement the TypeScript HTTP gateway and AI agent; verify the end-to-end tool-use and payment flow.
7. Prepare the Demo Day demonstration and slides.

## Experiment template

### Feature name

- Target users:
- Upstream issue or discussion:
- Problem to solve:
- Use case:
- Why x402:
- Data or functionality provided:
- When payment occurs:
- Minimum experiment scope:
- Success criteria:
- Open questions and research:
- Results:
- Next steps:

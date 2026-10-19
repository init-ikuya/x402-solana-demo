# x402 AI Gateway with a Custom Settlement Program

**Area**: Payments × AI

This is the initial proposal, not a description of the current implementation. See the [overall architecture](../ARCHITECTURE.md) and [project notes](../ideas.md) for current scope and status.

## Proposed submission title and abstract

**Title**: Pay-per-Call AI Gateway on Solana — An Independent x402-Style Settlement Program

**Abstract**:

> Most AI APIs still assume subscriptions or credit cards, leaving AI agents without a way to pay autonomously for what they consume — the gap the x402 protocol, an HTTP 402-based payment standard, was created to fill (as of September 2026, Solana leads all x402 chains in settlement volume). This project builds a pay-per-call AI gateway on Solana following x402. x402's standard `exact` scheme transfers the exact requested amount in one client-signed transfer — deliberately simple, but unable to express usage-based pricing where the final cost is unknown until the request has been served. x402's `upto` scheme addresses this by separating the authorized maximum from the settled amount; on EVM it rests on Permit2, but Solana has no Permit2 equivalent — as the official SVM `upto` spec itself puts it, a signed Solana transfer commits to an exact amount, so the server cannot lower it after signing — and upto-style settlement therefore requires a purpose-built on-chain program: the Solana Foundation's audited `payment-channels` program (escrowed deposits, signed cumulative vouchers, Ed25519 verification). This project implements an independent settlement program in Anchor and targets a devnet deployment. Where time permits, it further aims to explore design space the official v1 does not yet natively cover — handling of Token-2022 mints carrying extensions outside v1's fixed allow-list (real stablecoins such as PYUSD and USDG are currently rejected for this reason) and separated funding/close/refund authorities, both under discussion on the official v2 roadmap — and to compare the resulting design against the official implementation and its published Cantina security audit.

**Referenced upstream issues** (the proposed exploration areas): [payment-channels #83 (Token-2022 mint extensions)](https://github.com/solana-foundation/payment-channels/issues/83) · [#91 (separate funding/close/refund authorities)](https://github.com/solana-foundation/payment-channels/issues/91) · [#89 (`settle_metered` under a client-signed cap)](https://github.com/solana-foundation/payment-channels/issues/89).

## Related work and project position

| Layer | Existing work | Relationship to this proposal |
| --- | --- | --- |
| Protocol | x402 `exact` and `upto` schemes in [x402-foundation/x402](https://github.com/x402-foundation/x402). The [SVM `upto` specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto_svm.md) specifies payment-channels as the settlement layer. | Follow the HTTP 402 flow and message format. Describe the result as compatible rather than claiming full compliance. The specification explicitly permits a server to facilitate its own payments. |
| Hosted service | The Coinbase facilitator launched Solana `upto` support on September 17, 2026. The default x402.org facilitator supports Solana Devnet. | The initial proposal envisioned a gateway that handled verification and settlement itself. The current demo instead uses a separate local facilitator. |
| On-chain program | The Solana Foundation's [payment-channels](https://github.com/solana-foundation/payment-channels) is MIT licensed, reported as live on mainnet, and was audited by Cantina in July 2026. It supports x402 `upto` (one request per channel) and MPP `session` / `batch-settlement` (multiple requests per channel). | Independently implement a similar architecture and, if possible, explore v2 roadmap areas and compare designs. The originally proposed one-deposit, multiple-request, single-claim flow corresponds to session or batch settlement. |

**Why implement something that already exists?** The independent implementation is a learning outcome, and the proposal aimed to explore areas that the official team listed as issues:

- [#83](https://github.com/solana-foundation/payment-channels/issues/83) / #84: Official v1 accepts Token-2022 mints, but its fixed mint-extension allow-list contains only `MetadataPointer` and `TokenMetadata`. Mints with other extensions, including PYUSD and USDG variants with `TransferFee`, `PermanentDelegate`, or `TransferHook`, fail at `open` with an unhelpful `0x38` malformed error. The team preferred accurate error reporting over indiscriminately expanding the allow-list. The proposal would use `token_interface`, define which extensions to accept or reject and why, and report explicit rejection errors. See the existing fix PR #84 before treating this as open work.
- [#91](https://github.com/solana-foundation/payment-channels/issues/91): In v1, the payer holds funding, close, and refund authority together. A controller program can act as payer, but the issue notes that this requires another custody program. The proposal would test separate authorities.
- [#89](https://github.com/solana-foundation/payment-channels/issues/89): `settle_metered`, usage-based settlement under a client-signed cap, was a reference point for the voucher design.

## Proposed architecture

```text
[Client / AI agent]
   | 0. open_channel: deposit USDC (Token or Token-2022) in a vault PDA, with a cap and expiry
   | 1. GET /ask without payment
   v
[Gateway with an x402-compatible HTTP 402 flow]
   | 2. 402 Payment Required + PaymentRequirements (price and channel terms)
   v
[Client] Retry with an Ed25519-signed cumulative voucher in X-PAYMENT
   v
[Gateway] Verify voucher off chain, call the AI API, and return the answer
   | 3. claim with the latest voucher, verified on chain by Ed25519
   v
[Vault PDA] Return unused funds to the client by refund after expiry (timelock)
```

- **Cumulative vouchers**: The server keeps only the newest, largest accepted voucher. Older vouchers cannot claim more than the newer one. The proposed on-chain flow uses `open`, `claim`, and `refund` transactions.
- **Trust model**: Program-enforced signatures, caps, recipient bindings, and deadlines replace the off-chain transaction checks that an `exact` facilitator performs.

## Proposed implementation scope

### On chain: Anchor program on Devnet

**Framework choice**: The official program uses Pinocchio 0.11, lightweight native Rust without a framework. This proposal chose **Anchor** to prioritize learning and design validation over compute-unit optimization. `anchor-spl`'s `token_interface` could support exploration of Token-2022 extensions. If a comparison is made, measure compute units to make the Pinocchio versus Anchor tradeoff concrete.

- `open_channel`, `claim`, `refund`, and `close_channel`. The proposed `claim` verifies a signature through the Ed25519SigVerify precompile and instructions-sysvar introspection, enforces claim amount at or below the deposit, binds the recipient, and prevents replay.
- Optional exploration beyond official v1: (1) Token-2022 mints with extensions, with explicit errors for unsupported extensions; (2) separate funding and refund authorities so additional funders and refund recipients can use different keys.
- Bankrun or LiteSVM tests for normal and adversarial cases: changed vouchers, early refunds, claims by others, excessive claims, and Token-2022 transfer-fee mints.

### Optional comparison work

- Compare official v1 design choices — a 50-byte cumulative voucher, `open_slot` addressing and a 1,500-slot replay window, SHA-256 distribution commitments, and separate `rent_payer` — with this project's decisions. Explain how the unimplemented v2 ADR proposals for batch settlement, channel re-arming, and rollups relate.
- Read the published Cantina audit and check each relevant finding against the independent implementation as a security self-review.

### Off chain: TypeScript gateway and AI agent

The examples live under `examples/` in this repository. `examples/gateway/` is the service-side reference implementation and demo server; `examples/client/` contains the payment CLI and LLM agent. The core payment program does not depend on these examples or an AI provider. Both projects are npm workspaces and can be run from the repository root. Local LM Studio and Ollama tool calling are implemented, but a demo with a live model has not been verified.

- **Gateway**: TypeScript HTTP server for 402 responses, off-chain voucher verification, AI API calls such as Claude, and on-chain settlement. Confirm the x402 specification version and message format before implementing any new route.
- **AI agent**: TypeScript tool loop in which the LLM selects a paid API and uses its result in an answer, with a replaceable model connection. The browser demo defaults to LM Studio's OpenAI-compatible `/v1/chat/completions`; Ollama's `/api/chat` remains selectable.
- **Payment tool**: On a 402 response, create and sign a voucher within the configured budget, then retry. The application manages the private key and never exposes it in model prompts or tool results.
- **Program client**: Start with Anchor's TypeScript client and IDL. Consider Codama if a generated client becomes necessary.
- **Demo deployment**: Run gateway and agent locally against a Devnet program. Public hosting and MCP support were optional extensions.

### Proposed milestones and fallback

1. **Phase 1**: Minimal 402 → payment → AI answer using the official SVM `exact` SDK. The default x402.org facilitator supports Solana Devnet, allowing the demo to remain on Devnet.
2. **Phase 2**: Implement and deploy the independent settlement program to Devnet; this was the originally promised deliverable.
3. **Phase 3, if time permits**: Explore Token-2022 extensions and authority separation, and compare against the official implementation and Cantina audit.
4. **Phase 4, if time permits**: Add an MCP server and dynamic pricing.

## Proposed demo sequence

1. Send an unpaid request and show the **402 response**.
2. Have the agent deposit, automatically attach a voucher to an AI request, and repeat several times to show the cumulative amount increase.
3. Claim and show in an explorer that only the used amount is withdrawn: three on-chain transactions for multiple requests.
4. Show an expired refund and rejection of a tampered voucher.
5. If Phase 3 is implemented, open a channel with a Token-2022 mint carrying an extension outside the official v1 allow-list, such as `TransferFee`, and run the same flow. A PYUSD-like mint fails to open under the cited v1 behavior.

## Risks and tradeoffs

- Ed25519 instruction introspection requires careful implementation. Test it independently at the start of Phase 2, using the public official program as a reference if needed.
- A strict proof that the server returned a response is unavailable. Incremental small-value vouchers limit exposure to roughly one request under the stated trust model, as in the official design and Lightning-style systems.
- Describe this independent implementation as following a compatible flow and format, without claiming complete x402 or `upto` compliance.
- Upstream PRs or issue comments were outside the proposed deliverables. The project aimed to stand on its independent implementation and comparison work.

## Relevant prior projects

- `solana-fall-transfer-hook` and `solana-summer-escrow`: Practical Token-2022 and `token_interface` experience for possible Phase 3 exploration.
- `solana-fall-vault`: Vault PDA and signer seeds.
- `solana-summer-escrow`: Timelocked refunds.
- `solana-fall-fundraiser-codama`: Reference for possible future Codama client generation.
- `flores-ai-agent` and similar work: Client-side AI agent implementation.
- `haiku_verse`: AI API integration and cost-control experience.

## References

- [What is x402? (Solana)](https://solana.com/x402/what-is-x402)
- [x402-foundation/x402](https://github.com/x402-foundation/x402) / [`upto` scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto.md) / [SVM `upto` scheme using payment-channels](https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto_svm.md) / [SVM `exact` scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md)
- [x402 network and token support](https://docs.x402.org/core-concepts/network-and-token-support)
- [EIP-2612 on Solana (Solana)](https://solana.com/developers/evm-to-svm/eip2612)
- [solana-foundation/payment-channels](https://github.com/solana-foundation/payment-channels)
- [Payment Channels announcement (Solana)](https://solana.com/news/payment-channels-1-million-payments-per-second)
- [Coinbase facilitator `upto` support (Solana Compass, September 17, 2026)](https://solanacompass.com/news/coinbase-upgrades-x402-facilitator-on-solana-upto-scheme-live-verify-latency-cut-66)
- [Solana x402 volume report (Solana Compass)](https://solanacompass.com/news/solana-claims-top-spot-on-x402-as-ai-agents-settle-33m-usdc-in-a-single-week)

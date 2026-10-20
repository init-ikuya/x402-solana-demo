# x402-solana-demo

An experimental x402 payment demo on Solana. It combines official SDK routes with independent Anchor escrow bindings. A separate [payment-channels](https://github.com/solana-foundation/payment-channels) Issue #90 design remains reference work.

This project is being developed for Demo Day at [Solana School: Fall Class](https://luma.com/jy1g8k90). The main [auth-capture presentation](docs/topics/auth-capture/slides.md), [speaker script](docs/topics/auth-capture/script.md), and [browser demo runbook](docs/topics/auth-capture/demo.md) live alongside the implementation.

## Status

The opt-in `batch-settlement` route now uses this repository's Anchor program. The payer opens one escrow channel and signs cumulative vouchers; the local facilitator stores accepted vouchers and later claims only the new amount on chain. An expiry plus grace period lets anyone close the channel and return unused escrow after claims are no longer valid. LiteSVM tests and a real local-validator run cover the channel, repeated paid requests, restart persistence, and redemption. The separate Issue #90 merchant recovery design remains unimplemented; Devnet has not been upgraded with these batch instructions.

The Anchor program also implements a single-request `upto` channel and an experimental `auth-capture` escrow payment. The auth-capture route confirms a 1000-unit hold before the paid API, then captures 300 and releases 700 atomically; a direct operation CLI supports merchant-funded refunds and payer reclaim. The browser agent, gateway, facilitator, deployed Anchor program, and a subsequent 100-unit merchant refund have been verified against a real local Solana validator using an unpegged test token. The TypeScript examples connect the [gateway and facilitator](examples/gateway/README.md) to a [budget-limited client and local LLM agent](examples/client/README.md). An older version of the custom program is deployed on Devnet at `4PpHEbD82o3bEtTYk478dcbTp4M4G9Q8Jqswcvoozq88`; Devnet payment settlement remains unverified.

The paid demo resource is a clearly fictional Donald Trump "insider information" parody, presented as an invented private briefing note with a distinct report ID per call. `exact` serves it at `/api/trump-insider`; opt-in `upto`, `batch-settlement`, and `auth-capture` serve the same format at their matching suffix routes. The agent includes the API's report IDs and headlines in its answer.

## Project goals

- Implement and test independent Anchor escrow bindings for `upto` and the auth-capture lifecycle.
- Keep the payment-channels Issue #90 Closing recovery design separate from the running auth-capture route.
- Document implementation choices, differences from upstream, and experiment results for the Demo Day presentation.
- Build a TypeScript HTTP gateway and a TypeScript AI agent that demonstrates LLM tool use with payment authorization, paid API access, settlement, and refunds. See the [demo scope](docs/ideas.md#demo-scope-and-implementation-languages).
- Implement all four x402 schemes in stages: `exact`, `batch-settlement`, `upto`, and `auth-capture`. The [implementation scope](docs/ARCHITECTURE.md#four-scheme-implementation-scope) records specifications, compatibility boundaries, and acceptance criteria. The custom Anchor batch and auth-capture escrow routes are integrated locally; the proposed Closing recovery remains unimplemented.

The upstream payment-channels implementation uses Pinocchio and provides an on-chain settlement layer for x402 and MPP payments. This repository's auth-capture binding is an independent educational experiment, not an official upstream implementation.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the planned system architecture, Solana account relationship diagram, payment flow, and currently implemented accounts.

The three escrow schemes share this repository's Anchor program ID:

| Scheme | On-chain program used by this demo |
| --- | --- |
| `exact` | Standard SPL Token transfer through the official x402 SVM SDK. |
| `batch-settlement` | This repository's Anchor program, `4PpHEbD82o3bEtTYk478dcbTp4M4G9Q8Jqswcvoozq88`. |
| `upto` | This repository's Anchor program, `4PpHEbD82o3bEtTYk478dcbTp4M4G9Q8Jqswcvoozq88`. |
| `auth-capture` | The same repository Anchor program as `upto`, with separate instructions and account state. |

For the running demo, see the [client–gateway–facilitator architecture](docs/demo-payment-architecture.md), including the auth-capture request sequence.

The [auth-capture presentation](docs/topics/auth-capture/slides.md) is the Demo Day focus. A local [browser front end](examples/client/demo/index.html) displays the real agent's tool choice, x402 exchange, paid report, and answer, with a samurai-styled buyer and satirical provider. It explains the locally tested escrow binding and its limits. The proposed [Issue #90 Closing recovery](docs/topics/closing-settlement/ARCHITECTURE.md) remains separate design reference material.

The [local validator rehearsal](docs/topics/auth-capture/demo.md#real-local-validator-rehearsal) includes a 38-second browser recording of autonomous payment followed by a merchant refund. Its MP4 is kept locally under ignored `.local/local-demo/` and is not published with the repository.

## Upstream

The batch channel reference is [solana-foundation/payment-channels](https://github.com/solana-foundation/payment-channels). The auth-capture escrow route is a simpler independent binding based on the [generic x402 scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md).

## Getting started

Install Rust via rustup, Anchor CLI 1.2.0, and the Solana CLI with `cargo build-sbf`. See the [Anchor installation guide](https://www.anchor-lang.com/docs/installation). The Rust toolchain is pinned in `rust-toolchain.toml`.

Build the program and generate its IDL:

```sh
anchor build --arch v0 --tools-version v1.57 --ignore-keys
```

The program has been deployed on Devnet with an upgrade authority. Run `bash scripts/deploy-devnet.sh --check` to verify the program ID, build artifact, and current Devnet balance before an upgrade. See the [Devnet validation steps](docs/topics/auth-capture/demo.md#development-only-live-devnet-validation). The script's `--deploy` mode submits a new program version to the same address.

Run the Rust integration test against the compiled program in LiteSVM:

```sh
anchor test --skip-build
```

Tests run locally in-process without a validator or funded wallet. Build with `--arch v0` for compatibility with the pinned LiteSVM 0.10 test environment; the default Anchor 1.2 SBF v3 artifact failed to load in this setup. Use `--skip-build` when testing to preserve that artifact. Rebuild after changing program code. The test embeds the compiled program, so `cargo test` also requires a prior build.

Check formatting:

```sh
cargo fmt --all -- --check
```

## Workflow

### Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs on every pull request, push to `main`, and `v*` tag push, and can also be run manually. The `lint` job checks Rust formatting and TypeScript types. The `test` job runs the payment example tests and builds the SBF program for LiteSVM tests. After both pass, the `build` job runs only for `main` pushes and manual dispatches, rebuilding the program and packaging the nightly release in the same job.

CI uses Ubuntu 24.04, the Rust version in `rust-toolchain.toml`, Anchor CLI 1.2.0, Solana CLI 3.1.10, and SBF platform-tools v1.57. Anchor and Solana CLI binaries are downloaded from pinned upstream releases and verified with SHA-256 checksums. See the [Anchor release assets](https://github.com/otter-sec/anchor/releases/expanded_assets/v1.2.0) and [Agave release assets](https://github.com/anza-xyz/agave/releases/expanded_assets/v3.1.10) when updating these versions and checksums.

The CI builds use `--arch v0 --ignore-keys`: the test loads the compiled program directly at the declared program ID, so CI does not need the deployment keypair. The test command explicitly skips building, deploying, and starting a validator. No GitHub secrets, funded wallet, or RPC endpoint is required. CI uses no Actions Artifacts or caches; dependency resolution must leave `Cargo.lock` unchanged.

### Nightly builds

Download the latest development build from [Nightly](https://github.com/init-ikuya/x402-solana-demo/releases/tag/nightly). A successful `main` push or explicit manual CI run updates the same rolling prerelease. This is not a scheduled nightly build. Manual runs can publish the selected branch; the release notes identify its ref and commit. PRs and `v*` tag pushes run checks without producing downloadable build outputs.

Publication waits for the lint and test jobs to succeed. Concurrent nightly runs are serialized, and rerunning an old `main` commit cannot replace the current main build. The release tag advances after assets upload. Release assets are replaced on the next successful publication; the previous nightly remains if checks fail.

Assets:

- `anchoring_payment_channels.so`: Compiled SBF v0 program.
- `anchoring_payment_channels.json`: Anchor IDL.
- `anchoring_payment_channels.ts` and `anchoring_payment_channels_errors.ts`: TypeScript IDL types, not a generated SDK.
- `architecture-submission.pdf`: Architecture submission, rendered from [`docs/architecture-submission.md`](docs/architecture-submission.md) during CI.
- `auth-capture-slides.pdf`: Main presentation, rendered from Markdown during CI.
- `build-info.json`: Commit, source ref, workflow run, and tool versions.
- `SHA256SUMS.txt`: Checksums; verify downloaded files with `sha256sum --check SHA256SUMS.txt`.

Only these public files are packaged; deployment keypairs are excluded. The lint and test jobs have read-only repository access; only the build job receives `contents: write` using the automatic `GITHUB_TOKEN` to publish the release. Release updates are not atomic: download after the build job completes and verify checksums.

### Development steps

1. Record the upstream reference and intended behavior in the [project notes](docs/ideas.md).
2. Implement and test the baseline payment channel behavior in Anchor.
3. Select future-work items from the referenced issue, implement focused experiments, and record the results.

## Repository structure

- `.github/workflows/ci.yml`: Formatting, Anchor build, LiteSVM, and x402 example checks for PRs and `main`.
- `docs/ARCHITECTURE.md`: System architecture, Solana account relationships, and implementation status.
- `docs/proposals/ai-gateway.md`: AI gateway proposal and demo design.
- `docs/ideas.md`: Project scope, upstream references, and experiment plans.
- `docs/topics/`: Topic-specific architecture, Demo Day slides, and speaker scripts.
- `docs/README.md`: Documentation index, sources policy, and slide generation instructions.
- `docs/references/`: Local reference PDFs (not tracked by Git).
- `programs/anchoring-payment-channels/src/`: Anchor program, instructions, and account state.
- `programs/anchoring-payment-channels/tests/`: Rust integration tests using LiteSVM.
- `Anchor.toml`: Anchor configuration for local development.
- `Cargo.toml`: Rust workspace configuration.
- `rust-toolchain.toml`: Pinned Rust toolchain.

Example applications:

- `examples/gateway/`: TypeScript x402 `exact` and repository-backed `upto`, batch, and auth-capture routes. See its [setup guide](examples/gateway/README.md).
- `examples/client/`: TypeScript payment CLI, per-process spending controls, and a model-driven agent with local LM Studio and Ollama adapters.

The `exact` route uses the official x402 SVM SDK. The other three routes use this repository's Anchor program and custom facilitator. Their Solana payloads are not interoperable with the official SVM bindings, which use different program IDs and instruction formats. For local experiments, use the local facilitator for every scheme. On Devnet, `GATEWAY_MODE=devnet` routes only `exact` to the public facilitator by default; the custom schemes still require this repository's facilitator connected to Devnet RPC. The public facilitator's current capability list advertises Devnet `exact`, not these custom bindings.

The existing example is runnable from the repository root. The core settlement program is independent of these applications and of any AI provider.

## Development notes

Do not commit private keys, seed phrases, API keys, or other credentials. Document example environment variables in `.env.example` using placeholder values.

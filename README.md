# x402-solana-demo

An experimental Anchor reimplementation of [solana-foundation/payment-channels](https://github.com/solana-foundation/payment-channels), with additional experiments implementing future work discussed in the upstream issue.

This project is being developed for Demo Day at [Solana School: Fall Class](https://luma.com/jy1g8k90). The [presentation draft](docs/topics/closing-settlement/slides.md) lives in this repository alongside the implementation.

## Status

The Anchor program implements a single-request `upto` escrow channel with `open`, `settle`, and expired `refund`, covered by a LiteSVM test. The TypeScript `exact` and `upto` examples connect the [gateway and local facilitator](examples/gateway/README.md) to a [budget-limited payment client, refund CLI, and local LLM agent](examples/client/README.md). The `upto` path calls this repository's program; the payer can send an expired refund without the facilitator. HTTP integration tests use simulated RPC; live devnet settlement remains unverified.

The paid demo resource is a clearly fictional Donald Trump "insider information" parody, presented as an invented private briefing note with a distinct report ID per call. `exact` serves it at `/api/trump-insider`; opt-in `upto` serves the same format at `/api/trump-insider/upto`. The agent includes the API's report IDs and headlines in its answer.

## Project goals

- Reimplement the upstream payment channel behavior using Anchor, with tests covering the channel lifecycle and settlement rules.
- Explore additional features identified as future work in the upstream issue. The specific issue and feature scope are pending confirmation.
- Document implementation choices, differences from upstream, and experiment results for the Demo Day presentation.
- Build a TypeScript HTTP gateway and a TypeScript AI agent that demonstrates LLM tool use with payment authorization, paid API access, settlement, and refunds. See the [demo scope](docs/ideas.md#demo-scope-and-implementation-languages).
- Implement all four x402 schemes in stages: `exact`, `batch-settlement`, `upto`, and `auth-capture`. The [implementation scope](docs/ARCHITECTURE.md#four-scheme-implementation-scope-planned) records specifications, compatibility boundaries, and acceptance criteria. The `exact` example and this repository's Anchor-backed `upto` HTTP path are locally tested; `batch-settlement` and `auth-capture` remain unimplemented.

The upstream implementation uses Pinocchio and provides an on-chain settlement layer for x402 and MPP payments. This repository is an independent educational experiment, not an official upstream implementation.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the planned system architecture, Solana account relationship diagram, payment flow, and currently implemented accounts.

For the running demo, see the [client–gateway–facilitator architecture](docs/demo-payment-architecture.md), including the `exact` and `upto` request sequences.

The separate [auth-capture design](docs/topics/auth-capture/ARCHITECTURE.md) and [presentation](docs/topics/auth-capture/slides.md) explore a proposed Solana escrow and refund lifecycle. The [Issue #90 presentation](docs/topics/closing-settlement/slides.md) remains an alternative focus within the same four-scheme scope.

## Upstream

The original project and source of reference is [solana-foundation/payment-channels](https://github.com/solana-foundation/payment-channels). This repository explores an Anchor reimplementation and selected future-work items discussed in upstream issues.

## Getting started

Install Rust via rustup, Anchor CLI 1.2.0, and the Solana CLI with `cargo build-sbf`. See the [Anchor installation guide](https://www.anchor-lang.com/docs/installation). The Rust toolchain is pinned in `rust-toolchain.toml`.

Build the program and generate its IDL:

```sh
anchor build --arch v0
```

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

[GitHub Actions](.github/workflows/ci.yml) checks every pull request, push to `main`, and `v*` tag push, and can also be run manually. Separate jobs check Rust formatting and build the SBF program plus IDL before running the Rust integration tests in LiteSVM.

CI uses Ubuntu 24.04, the Rust version in `rust-toolchain.toml`, Anchor CLI 1.2.0, Solana CLI 3.1.10, and SBF platform-tools v1.57. Anchor and Solana CLI binaries are downloaded from pinned upstream releases and verified with SHA-256 checksums. See the [Anchor release assets](https://github.com/otter-sec/anchor/releases/expanded_assets/v1.2.0) and [Agave release assets](https://github.com/anza-xyz/agave/releases/expanded_assets/v3.1.10) when updating these versions and checksums.

The CI build uses `--arch v0 --ignore-keys`: the test loads the compiled program directly at the declared program ID, so CI does not need the deployment keypair. The test command explicitly skips building, deploying, and starting a validator. No GitHub secrets, funded wallet, or RPC endpoint is required. Rust dependencies and SBF tools are cached; dependency resolution must leave `Cargo.lock` unchanged.

### Nightly builds

Download the latest development build from [Nightly](https://github.com/init-ikuya/x402-solana-demo/releases/tag/nightly). A successful `main` push or explicit manual CI run updates the same rolling prerelease. This is not a scheduled nightly build. Manual runs can publish the selected branch; the release notes identify its ref and commit. PRs and `v*` tag pushes only produce Actions Artifacts, retained for seven days.

Publication waits for both formatting and build/test jobs to succeed. Concurrent nightly runs are serialized, and rerunning an old `main` commit cannot replace the current main build. The release tag advances after assets upload. Release assets persist beyond the Actions Artifact retention period and are replaced on the next successful publication; the previous nightly remains if checks fail.

Assets:

- `anchoring_payment_channels.so`: Compiled SBF v0 program.
- `anchoring_payment_channels.json`: Anchor IDL.
- `anchoring_payment_channels.ts` and `anchoring_payment_channels_errors.ts`: TypeScript IDL types, not a generated SDK.
- `architecture-submission.pdf`: Architecture submission, rendered from [`docs/architecture-submission.md`](docs/architecture-submission.md) during CI.
- `closing-settlement-slides.pdf` and `auth-capture-slides.pdf`: Two presentation alternatives, rendered from their Markdown sources during CI.
- `build-info.json`: Commit, source ref, workflow run, and tool versions.
- `SHA256SUMS.txt`: Checksums; verify downloaded files with `sha256sum --check SHA256SUMS.txt`.

Only these public files are packaged; deployment keypairs are excluded. The build job has read-only repository access; only the publication job receives `contents: write` using the automatic `GITHUB_TOKEN`. The same build package is also retained as an Actions Artifact for seven days, including on main/manual runs for transfer between jobs. Release updates are not atomic: download after the publication job completes and verify checksums.

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

- `examples/gateway/`: TypeScript x402 `exact` and repository-backed `upto` service and local facilitator. See its [setup guide](examples/gateway/README.md).
- `examples/client/`: TypeScript payment CLI, per-process spending controls, and a model-driven agent with a local Ollama adapter.

The `exact` route uses the official x402 SVM SDK and does not need this Anchor program. The `upto` route uses this repository's Anchor program and local facilitator. Its Solana payload is not interoperable with the official SVM `upto` binding, which fixes a different program ID and instruction format.

The existing example is runnable from the repository root. The core settlement program is independent of these applications and of any AI provider.

## Development notes

Do not commit private keys, seed phrases, API keys, or other credentials. Document example environment variables in `.env.example` using placeholder values.

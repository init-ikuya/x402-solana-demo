# x402-solana-demo

An experimental x402 payment demo on Solana. It combines official SDK routes with independent Anchor escrow bindings. A separate [payment-channels](https://github.com/solana-foundation/payment-channels) Issue #90 design remains reference work.

This project is being developed for Demo Day at [Solana School: Fall Class](https://luma.com/jy1g8k90). The main [auth-capture presentation](docs/topics/auth-capture/slides.md), [speaker script](docs/topics/auth-capture/script.md), and [browser demo runbook](docs/topics/auth-capture/demo.md) live alongside the implementation.

## Status

The HTTP demo also has an opt-in `batch-settlement` route backed by `@x402/svm` 2.28.0 and the Solana Foundation payment-channels program. The client reuses a channel, the gateway stores cumulative vouchers and redeems them periodically, and a batch refund command closes unused escrow. This is separate from the proposed custom Anchor Issue #90 closing-recovery experiment, which remains unimplemented. Local persistence and unit tests are present; live devnet settlement has not been verified.

The Anchor program implements a single-request `upto` channel and a separate experimental `auth-capture` escrow payment. The auth-capture route confirms a 1000-unit hold before the paid API, then captures 300 and releases 700 atomically; a direct operation CLI supports merchant-funded refunds and payer reclaim. LiteSVM and simulated-RPC HTTP tests cover the local path. The TypeScript `exact`, `upto`, opt-in `batch-settlement`, and `auth-capture` examples connect the [gateway and local facilitator](examples/gateway/README.md) to a [budget-limited client and local LLM agent](examples/client/README.md). The batch path uses the official SVM binding. Live Devnet settlement remains unverified.

The paid demo resource is a clearly fictional Donald Trump "insider information" parody, presented as an invented private briefing note with a distinct report ID per call. `exact` serves it at `/api/trump-insider`; opt-in `upto`, `batch-settlement`, and `auth-capture` serve the same format at their matching suffix routes. The agent includes the API's report IDs and headlines in its answer.

## Project goals

- Implement and test independent Anchor escrow bindings for `upto` and the auth-capture lifecycle.
- Keep the payment-channels Issue #90 Closing recovery design separate from the running auth-capture route.
- Document implementation choices, differences from upstream, and experiment results for the Demo Day presentation.
- Build a TypeScript HTTP gateway and a TypeScript AI agent that demonstrates LLM tool use with payment authorization, paid API access, settlement, and refunds. See the [demo scope](docs/ideas.md#demo-scope-and-implementation-languages).
- Implement all four x402 schemes in stages: `exact`, `batch-settlement`, `upto`, and `auth-capture`. The [implementation scope](docs/ARCHITECTURE.md#four-scheme-implementation-scope-planned) records specifications, compatibility boundaries, and acceptance criteria. The official SDK batch route is wired into the HTTP demo; the proposed custom Anchor Closing recovery remains unimplemented; an escrow-only auth-capture prototype is integrated locally.

The upstream payment-channels implementation uses Pinocchio and provides an on-chain settlement layer for x402 and MPP payments. This repository's auth-capture binding is an independent educational experiment, not an official upstream implementation.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the planned system architecture, Solana account relationship diagram, payment flow, and currently implemented accounts.

For the running demo, see the [client–gateway–facilitator architecture](docs/demo-payment-architecture.md), including the auth-capture request sequence.

The [auth-capture presentation](docs/topics/auth-capture/slides.md) is the Demo Day focus. A local [browser front end](examples/client/demo/index.html) displays the real agent's tool choice, x402 exchange, paid report, and answer, with a samurai-styled buyer and satirical provider. It explains the locally tested escrow binding and its limits. The proposed [Issue #90 Closing recovery](docs/topics/closing-settlement/ARCHITECTURE.md) remains separate design reference material.

## Upstream

The batch channel reference is [solana-foundation/payment-channels](https://github.com/solana-foundation/payment-channels). The auth-capture escrow route is a simpler independent binding based on the [generic x402 scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md).

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

- `examples/gateway/`: TypeScript x402 `exact`, repository-backed `upto` and auth-capture escrow, and official SVM batch service and local facilitator. See its [setup guide](examples/gateway/README.md).
- `examples/client/`: TypeScript payment CLI, per-process spending controls, and a model-driven agent with local LM Studio and Ollama adapters.

The `exact` and `batch-settlement` routes use the official x402 SVM SDK and do not need this Anchor program. The `upto` and experimental escrow-only `auth-capture` routes use this repository's Anchor program and local facilitator. Its Solana payload is not interoperable with the official SVM `upto` binding, which fixes a different program ID and instruction format.

The existing example is runnable from the repository root. The core settlement program is independent of these applications and of any AI provider.

## Development notes

Do not commit private keys, seed phrases, API keys, or other credentials. Document example environment variables in `.env.example` using placeholder values.

# Documentation

## General and topic-specific documents

- [Overall architecture](ARCHITECTURE.md): Implementation plan for four schemes, shared components, and account design.
- [Three-party demo architecture](demo-payment-architecture.md): Client, gateway, and facilitator roles and all four request paths.
- [Demo payment flows](../examples/gateway/README.md): Client, gateway, and facilitator flows for all enabled schemes.
- [Architecture submission diagram](architecture-submission.md) and [three-sentence description](architecture-submission-blurb.md): Editable submission sources. Generated PDFs are excluded from Git.
- [Project notes](ideas.md): Goals, scope, and candidate issues.
- [AI Gateway proposal](proposals/ai-gateway.md): Initial proposal. See the overall architecture and project notes for the current implementation scope.
- Auth-capture main track: [architecture](topics/auth-capture/ARCHITECTURE.md), [slides](topics/auth-capture/slides.md), [speaker script](topics/auth-capture/script.md), and [demo runbook](topics/auth-capture/demo.md).
- Batch settlement and Issue #90 reference track: [design](topics/closing-settlement/ARCHITECTURE.md), [slides](topics/closing-settlement/slides.md), and [speaker script](topics/closing-settlement/script.md).
- `references/`: Reference PDFs from the school and other local materials. PDFs are excluded from Git.

## Presentation materials

These materials are for the Solana School: Fall Class Demo Day. The presentation is **in English and four minutes long**. A video or live walkthrough may use approximately one minute. Confirm the event date before exporting slides.

- [Auth-capture slides](topics/auth-capture/slides.md): Main presentation with seven main slides and two optional slides. `---` separates slides.
- [Auth-capture speaker script](topics/auth-capture/script.md): English narration, four-minute timing, and a one-minute auth-capture walkthrough.
- [Browser demo runbook](topics/auth-capture/demo.md): Real local agent process, visual payment timeline, recording fallback, and evidence limits.
- [Batch-settlement slides and script](topics/closing-settlement/slides.md): Separate reference track for the official SDK route and future Issue #90 experiment.
- Put any diagrams or screenshots in the relevant topic's `assets/` directory and reference them with relative paths.

The slides are Markdown in [Marp](https://marp.app/) format. Diagrams and layout use HTML/CSS, so generation requires `--html`. The slides are 16:9 and have page numbers. Speaker scripts are separate files.

## Current materials and timing

- The main presentation focuses on the experimental auth-capture escrow route: hold, atomic capture/release, merchant-funded refund, payer reclaim, and local test evidence. The repository still targets four schemes.
- The four-minute plan allocates 160 seconds to narration, 60 seconds to the browser auth-capture walkthrough, and 20 seconds to transitions. The walkthrough must label simulated RPC and LiteSVM output as local evidence. No video has been recorded or timed; live Devnet balances have not been verified.
- The Issue #83 alternative was dropped after reviewing the existing fix in PR #84.
- HTML and PDFs are excluded from Git. Regenerate them after editing the Markdown sources.
- Generated PDFs from earlier presentation drafts need regeneration after these Markdown changes. Reading time and walkthrough duration have not been measured.

## Generate the architecture PDF

Run this command from the repository root to regenerate the submission PDF. The first run needs network access to download Marp CLI. The CI `build` job uses the same Markdown source and includes the PDF in the nightly release on `main` pushes or manual runs. The PDF itself is excluded from Git.

```sh
npx --yes @marp-team/marp-cli@4.5.0 --html --pdf docs/architecture-submission.md -o docs/architecture-submission.pdf
```

## Generate the slides

Run these commands from the repository root with Node.js and npm. The first run needs network access to download Marp CLI. CI renders both slide sets as PDFs and attaches `auth-capture-slides.pdf` and `closing-settlement-slides.pdf` to the nightly release.

```sh
# HTML for presenting in a browser
npx --yes @marp-team/marp-cli@4.5.0 --html docs/topics/auth-capture/slides.md -o docs/topics/auth-capture/slides.html

# PDF for distribution (requires a compatible browser such as Chrome, Edge, or Firefox)
npx --yes @marp-team/marp-cli@4.5.0 --html docs/topics/auth-capture/slides.md --pdf -o docs/topics/auth-capture/slides.pdf
```

Generated files are excluded from Git; Markdown remains the editable source. To generate the batch reference version, replace `auth-capture` with `closing-settlement` in the commands.

## Evidence and citations

- Link each claim about x402 specifications or Solana implementation status to a primary source. Slides use short source references; speaker scripts identify the relevant specification section or the scope of verification.
- Distinguish specifications, public code, provider deployment reports, and independently tested results. Label future plans and this project's own designs clearly.
- Avoid unsupported claims. Pin implementation comparisons to a tag or commit instead of relying only on a moving URL.
- Each slide's script lists its sources. The end of each script records pinned commits and the limits of verification.

## Before presenting

- Rehearse narration, video playback, and slide transitions together; keep the full presentation within four minutes.
- Update implemented features, test results, and demo steps to match actual progress.
- Record auth-capture test output, the commit used, and any Devnet transactions and balances.
- Verify reference commits and primary sources before including upstream comparisons.
- Add the presenter name and measured results, and confirm the event date. Clearly label unimplemented ideas as plans.

See [ARCHITECTURE.md](ARCHITECTURE.md) for design details and [ideas.md](ideas.md) for scope.

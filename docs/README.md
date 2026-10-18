# Documentation

## General and topic-specific documents

- [Overall architecture](ARCHITECTURE.md): Implementation plan for four schemes, shared components, and account design.
- [Three-party demo architecture](demo-payment-architecture.md): Client, gateway, and facilitator roles and the `exact` / `upto` request sequences. This is not a submission document.
- [Exact and upto demo payment flows](../examples/gateway/README.md#exact-payment-flow): Implemented client, gateway, and facilitator flows. These are not submission documents.
- [Architecture submission diagram](architecture-submission.md) and [three-sentence description](architecture-submission-blurb.md): Editable submission sources. Generated PDFs are excluded from Git.
- [Project notes](ideas.md): Goals, scope, and candidate issues.
- [AI Gateway proposal](proposals/ai-gateway.md): Initial proposal. See the overall architecture and project notes for the current implementation scope.
- Issue #90: [design](topics/closing-settlement/ARCHITECTURE.md), [slides](topics/closing-settlement/slides.md), and [speaker script](topics/closing-settlement/script.md).
- Auth-capture: [design](topics/auth-capture/ARCHITECTURE.md), [slides](topics/auth-capture/slides.md), and [speaker script](topics/auth-capture/script.md).
- `references/`: Reference PDFs from the school and other local materials. PDFs are excluded from Git.

## Presentation materials

These materials are for the Solana School: Fall Class Demo Day. The presentation is **in English and four minutes long**. A video may be used for approximately one minute of the demo. The date is **October 19 or 21, 2026** (not yet confirmed, according to the presenter).

- [Issue #90 slides](topics/closing-settlement/slides.md): Alternative presentation with seven main slides and two optional demo architecture and FAQ slides. `---` separates slides.
- [Issue #90 speaker script](topics/closing-settlement/script.md): English narration, timing, a planned one-minute current-demo video cue, and presenter notes for each slide.
- [Auth-capture slides](topics/auth-capture/slides.md): Submission candidate with seven main slides and two optional demo architecture and FAQ slides. See the [dedicated architecture](topics/auth-capture/ARCHITECTURE.md) and [speaker script](topics/auth-capture/script.md).
- Put any diagrams or screenshots in the relevant topic's `assets/` directory and reference them with relative paths.

The slides are Markdown in [Marp](https://marp.app/) format. Diagrams and layout use HTML/CSS, so generation requires `--html`. The slides are 16:9 and have page numbers. Speaker scripts are separate files.

## Current materials and timing

- The main presentation focuses on auth-capture: seven English slides plus two optional demo architecture and FAQ slides for questions. It explains the design and validation plan for holds, capture, release, and refunds, along with current progress. The repository still targets four schemes.
- The four-minute plan allocates 160 seconds to narration, 60 seconds to a prerecorded demo of the existing `exact` / `upto` paths, and 20 seconds to transitions. The video has not been recorded, and neither narration nor video duration has been measured. The video must be labeled as a demo of existing local tests, not a completed `auth-capture` or Issue #90 recovery flow.
- The Issue #83 alternative was dropped after reviewing the existing fix in PR #84.
- HTML and PDFs are excluded from Git. Regenerate them after editing the Markdown sources.
- Both the Issue #90 and auth-capture nine-page PDFs have been generated and checked for layout. Reading time after the latest edits has not been measured.

## Generate the architecture PDF

Run this command from the repository root to regenerate the submission PDF. The first run needs network access to download Marp CLI. The CI `build` job uses the same Markdown source and includes the PDF in the nightly release on `main` pushes or manual runs. The PDF itself is excluded from Git.

```sh
npx --yes @marp-team/marp-cli@4.5.0 --html --pdf docs/architecture-submission.md -o docs/architecture-submission.pdf
```

## Generate the slides

Run these commands from the repository root with Node.js and npm. The first run needs network access to download Marp CLI. CI renders both slide sets as PDFs and attaches `closing-settlement-slides.pdf` and `auth-capture-slides.pdf` to the nightly release.

```sh
# HTML for presenting in a browser
npx --yes @marp-team/marp-cli@4.5.0 --html docs/topics/closing-settlement/slides.md -o docs/topics/closing-settlement/slides.html

# PDF for distribution (requires a compatible browser such as Chrome, Edge, or Firefox)
npx --yes @marp-team/marp-cli@4.5.0 --html docs/topics/closing-settlement/slides.md --pdf -o docs/topics/closing-settlement/slides.pdf
```

Generated files are excluded from Git; Markdown remains the editable source. To generate the auth-capture version, replace `closing-settlement` with `auth-capture` in the commands. Both scripts use the same four-minute schedule, including a planned one-minute demo video.

## Evidence and citations

- Link each claim about x402 specifications or Solana implementation status to a primary source. Slides use short source references; speaker scripts identify the relevant specification section or the scope of verification.
- Distinguish specifications, public code, provider deployment reports, and independently tested results. Label future plans and this project's own designs clearly.
- Avoid unsupported claims. Pin implementation comparisons to a tag or commit instead of relying only on a moving URL.
- Each slide's script lists its sources. The end of each script records pinned commits and the limits of verification.

## Before presenting

- Rehearse narration, video playback, and slide transitions together; keep the full presentation within four minutes.
- Update implemented features, test results, and demo steps to match actual progress.
- Record demo logs, the commit used, and any Devnet transactions.
- Verify reference commits and primary sources before including upstream comparisons.
- Add the presenter name and measured results, and confirm whether the presentation is on October 19 or 21. Clearly label unimplemented ideas as plans.

See [ARCHITECTURE.md](ARCHITECTURE.md) for design details and [ideas.md](ideas.md) for scope.

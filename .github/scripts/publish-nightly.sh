#!/usr/bin/env bash
set -euo pipefail

# Match the mcaddon repository: main pushes and explicit manual builds publish.
if [[ "$GITHUB_EVENT_NAME" != "workflow_dispatch" ]]; then
  if [[ "$GITHUB_EVENT_NAME" != "push" || "$GITHUB_REF_NAME" != "main" ]]; then
    echo 'Nightly publication is only allowed for main pushes or manual builds.' >&2
    exit 1
  fi
  main_sha=$(gh api "repos/$GH_REPO/git/ref/heads/main" --jq '.object.sha')
  if [[ "$main_sha" != "$GITHUB_SHA" ]]; then
    echo 'Nightly publication skipped: this commit is no longer the main branch tip.' >> "$GITHUB_STEP_SUMMARY"
    exit 0
  fi
fi

cd "$RUNNER_TEMP/nightly"
sha256sum --check SHA256SUMS.txt
# Verify that the package built in this job belongs to this commit.
python3 -c 'import json, os; assert json.load(open("build-info.json"))["commit"] == os.environ["GITHUB_SHA"]'

notes="$RUNNER_TEMP/nightly-notes.md"
cat > "$notes" <<EOF
Development build from $GITHUB_REF_NAME. This is a rolling pre-release, not a stable release.

Commit: $GITHUB_SHA
Build: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID

Assets include the SBF v0 program, Anchor IDL, TypeScript IDL types, architecture submission PDF, two presentation PDFs, build metadata, and SHA-256 checksums.
No deployment keypair is included. The TypeScript files are IDL types, not a generated SDK.

Updated after successful main builds or explicit manual builds; not on a nightly schedule.
EOF

# A failed API request must not be mistaken for a missing release.
release_id=$(gh api --paginate "repos/$GH_REPO/releases" \
  --jq '.[] | select(.tag_name == "nightly") | .id')
if [[ -z "$release_id" ]]; then
  gh release create nightly --draft --prerelease --latest=false \
    --target "$GITHUB_SHA" --title Nightly --notes-file "$notes"
fi

gh release upload nightly \
  anchoring_payment_channels.so anchoring_payment_channels.json \
  anchoring_payment_channels.ts anchoring_payment_channels_errors.ts \
  architecture-submission.pdf closing-settlement-slides.pdf auth-capture-slides.pdf \
  build-info.json SHA256SUMS.txt --clobber

# Move the rolling tag only after all assets have uploaded successfully.
tag_exists=$(gh api "repos/$GH_REPO/git/matching-refs/tags/nightly" \
  --jq '.[] | select(.ref == "refs/tags/nightly") | .ref')
if [[ -n "$tag_exists" ]]; then
  gh api --method PATCH "repos/$GH_REPO/git/refs/tags/nightly" \
    -f sha="$GITHUB_SHA" -F force=true
fi
gh release edit nightly --draft=false --prerelease --latest=false \
  --target "$GITHUB_SHA" --title Nightly --notes-file "$notes"

echo "Nightly: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/releases/tag/nightly (commit: $GITHUB_SHA)" \
  >> "$GITHUB_STEP_SUMMARY"

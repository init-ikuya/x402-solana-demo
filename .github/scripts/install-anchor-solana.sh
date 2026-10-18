#!/usr/bin/env bash
set -euo pipefail

# Pinned upstream release assets; update checksums when changing versions.
mkdir -p "$RUNNER_TEMP/anchor-bin"
curl --fail --location --retry 3 \
  "https://github.com/otter-sec/anchor/releases/download/v${ANCHOR_VERSION}/anchor-${ANCHOR_VERSION}-x86_64-unknown-linux-gnu" \
  --output "$RUNNER_TEMP/anchor-bin/anchor"
echo "0c9c41a3292c281cc6eadb78d6e1c8224d8324a34b0736a89d640fd314db05b7  $RUNNER_TEMP/anchor-bin/anchor" | sha256sum --check
chmod +x "$RUNNER_TEMP/anchor-bin/anchor"
echo "$RUNNER_TEMP/anchor-bin" >> "$GITHUB_PATH"

curl --fail --location --retry 3 \
  "https://github.com/anza-xyz/agave/releases/download/v${SOLANA_VERSION}/solana-release-x86_64-unknown-linux-gnu.tar.bz2" \
  --output "$RUNNER_TEMP/solana-release.tar.bz2"
echo "a7205ff29bcf0f7199740225ecae2b85a28ea9668892d5ec21bd9749882984a1  $RUNNER_TEMP/solana-release.tar.bz2" | sha256sum --check
tar -xjf "$RUNNER_TEMP/solana-release.tar.bz2" -C "$RUNNER_TEMP"
echo "$RUNNER_TEMP/solana-release/bin" >> "$GITHUB_PATH"

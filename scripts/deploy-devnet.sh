#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

mode="${1:---check}"
if [[ "$mode" != "--check" && "$mode" != "--deploy" || $# -gt 1 ]]; then
  echo "Usage: bash scripts/deploy-devnet.sh [--check|--deploy]" >&2
  exit 2
fi

program_key=".local/keys/anchoring_payment_channels-keypair.json"
build_key="target/deploy/anchoring_payment_channels-keypair.json"
program_file="target/deploy/anchoring_payment_channels.so"
wallet_file="${SOLANA_DEPLOY_WALLET:-${HOME}/.config/solana/id.json}"

for file in "$program_key" "$program_file" "$wallet_file"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing $file; see docs/topics/auth-capture/demo.md" >&2
    exit 1
  fi
done

program_id="$(solana-keygen pubkey "$program_key")"
for file in programs/anchoring-payment-channels/src/lib.rs examples/shared/anchor-upto.ts; do
  if ! rg -Fq -- "$program_id" "$file"; then
    echo "Program ID in $file differs from $program_id" >&2
    exit 1
  fi
done
if [[ "$(rg -Fc -- "$program_id" Anchor.toml)" != "2" ]]; then
  echo "Both localnet and Devnet program IDs in Anchor.toml must equal $program_id" >&2
  exit 1
fi
if [[ -f "$build_key" && "$(solana-keygen pubkey "$build_key")" != "$program_id" ]]; then
  echo "Build keypair differs from the preserved Devnet program keypair" >&2
  exit 1
fi

wallet_id="$(solana-keygen pubkey "$wallet_file")"
program_size="$(wc -c < "$program_file" | tr -d ' ')"
echo "Devnet program: $program_id"
echo "Deploy authority and fee payer: $wallet_id"
echo "Built program: $program_size bytes"
solana rent "$((program_size + 45))" --url devnet
solana balance "$wallet_id" --url devnet

if [[ "$mode" == "--deploy" ]]; then
  solana program deploy "$program_file" \
    --program-id "$program_key" \
    --upgrade-authority "$wallet_file" \
    --keypair "$wallet_file" \
    --url devnet
  solana program show "$program_id" --url devnet
else
  echo "Read-only check complete. Use --deploy to submit the program."
fi

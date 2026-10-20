#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

local_dir="$repo_root/.local/local-demo"
mkdir -p "$local_dir"
rpc="http://127.0.0.1:8899"
config="$local_dir/solana.yml"
payer_key="$local_dir/payer-keypair.json"
merchant_key="$local_dir/merchant-keypair.json"
facilitator_key="$local_dir/facilitator-keypair.json"
mint_key="$local_dir/mint-keypair.json"
program_key="$repo_root/.local/keys/anchoring_payment_channels-keypair.json"
program_file="$repo_root/target/deploy/anchoring_payment_channels.so"

for file in "$payer_key" "$merchant_key" "$facilitator_key" "$mint_key"; do
  if [[ ! -f "$file" ]]; then
    solana-keygen new --silent --no-bip39-passphrase --outfile "$file" >/dev/null
  fi
done
for file in "$program_key" "$program_file"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing local demo key or program: $file" >&2
    exit 1
  fi
done
solana cluster-version --url "$rpc" >/dev/null
solana config set -C "$config" --url "$rpc" --keypair "$facilitator_key" --commitment confirmed >/dev/null

payer="$(solana-keygen pubkey "$payer_key")"
merchant="$(solana-keygen pubkey "$merchant_key")"
facilitator="$(solana-keygen pubkey "$facilitator_key")"
mint="$(solana-keygen pubkey "$mint_key")"
program="$(solana-keygen pubkey "$program_key")"
network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"

fund_if_low() {
  local owner="$1"
  local amount="$2"
  local balance
  balance="$(solana balance "$owner" --lamports --url "$rpc" | awk '{print $1}')"
  if (( balance < 100000000 )); then
    solana airdrop "$amount" "$owner" --url "$rpc"
  fi
}
fund_if_low "$facilitator" 2
fund_if_low "$payer" 1
fund_if_low "$merchant" 1

if ! solana program show "$program" --url "$rpc" >/dev/null 2>&1; then
  solana program deploy "$program_file" --program-id "$program_key" \
    --upgrade-authority "$facilitator_key" --keypair "$facilitator_key" --url "$rpc"
fi
solana program show "$program" --url "$rpc"

if ! solana account "$mint" --url "$rpc" >/dev/null 2>&1; then
  spl-token -C "$config" create-token --decimals 6 "$mint_key"
fi
payer_token="$(spl-token -C "$config" address --verbose --token "$mint" --owner "$payer" | sed -n 's/^Associated token address: //p')"
merchant_token="$(spl-token -C "$config" address --verbose --token "$mint" --owner "$merchant" | sed -n 's/^Associated token address: //p')"
if ! solana account "$payer_token" --url "$rpc" >/dev/null 2>&1; then
  spl-token -C "$config" --fee-payer "$facilitator_key" create-account "$mint" --owner "$payer"
fi
if ! solana account "$merchant_token" --url "$rpc" >/dev/null 2>&1; then
  spl-token -C "$config" --fee-payer "$facilitator_key" create-account "$mint" --owner "$merchant"
fi
if [[ "$(spl-token -C "$config" balance "$mint" --owner "$payer")" == "0" ]]; then
  spl-token -C "$config" --fee-payer "$facilitator_key" mint "$mint" 10 "$payer_token"
fi

cat > "$local_dir/gateway.env" <<EOF
GATEWAY_PAY_TO=$merchant
FACILITATOR_KEYPAIR_FILE=$facilitator_key
AUTH_CAPTURE_MERCHANT_KEYPAIR_FILE=$merchant_key
AUTH_CAPTURE_ENABLED=1
FACILITATOR_RPC_URL=$rpc
AUTH_CAPTURE_RPC_URL=$rpc
GATEWAY_FACILITATOR_URL=http://127.0.0.1:4022
PAYMENT_ASSET=$mint
EOF

cat > "$local_dir/client.env" <<EOF
GATEWAY_PAY_TO=$merchant
PAYMENT_CLIENT_KEYPAIR_FILE=$payer_key
PAYMENT_SCHEME=auth-capture
PAYMENT_RPC_URL=$rpc
AUTH_CAPTURE_RESOURCE_URL=http://127.0.0.1:4021/api/trump-insider/auth-capture
PAYMENT_ASSET=$mint
PAYMENT_DEMO_TRACE=1
AGENT_MODEL_PROVIDER=lm-studio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
EOF

echo "Local validator genesis: $(solana genesis-hash --url "$rpc")"
echo "x402 SDK routing network for this local test: $network"
echo "Local test mint: $mint"
echo "Payer token account: $payer_token"
echo "Merchant token account: $merchant_token"
echo "Local configuration written under .local/local-demo/"

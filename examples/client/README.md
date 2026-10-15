# x402 payment client

This package contains the paying CLI, an `exact` adapter and an `upto` adapter for this repository's Anchor program, a per-process spending budget, and a model-driven payment agent. The CLI remains available for deterministic checks. See the [local LLM agent guide](AGENT.md) for Ollama setup and tool calling. The gateway and local facilitator are in [examples/gateway](../gateway/README.md), which documents the payment flows and local setup.

The [demo payment architecture](../../docs/demo-payment-architecture.md) shows how this client, the gateway, and the facilitator communicate.

The client uses `@x402/core` for the x402 HTTP envelope and `@x402/svm` for `exact` and signer utilities, but does not use the Quickstart's `@x402/fetch` wrapper. It handles the initial 402 response and the paid retry explicitly so it can check the quoted network, asset, recipient, and amount, reserve the agent's budget before signing, and stop after an uncertain payment outcome instead of issuing another paid request. This is a demo policy choice; it does not imply that `@x402/fetch` is incompatible with these schemes.

Run `npm ci` at the repository root, then copy `.env.example` to `.env`. Configure the expected `GATEWAY_PAY_TO` and a funded `PAYMENT_CLIENT_KEYPAIR_FILE`. The client accepts only the configured recipient, devnet USDC asset, Solana devnet network, and price within `PAYMENT_MAX_AMOUNT`. Its session budget limits the number and total amount of payments made in one process. `PAYMENT_SCHEME=exact` is the default; set it to `upto` for this repository's Anchor escrow route. `PAYMENT_RESOURCE_URL` can override the selected local route.

From the repository root, after starting the gateway and facilitator:

```sh
npm run pay:env --workspace @anchoring-payment-channels/client
```

The CLI defaults to one paid request. Set `AGENT_REQUEST_COUNT`, `AGENT_MAX_PAYMENTS`, and `AGENT_MAX_TOTAL_AMOUNT` in the client `.env` to make several bounded requests. A payment with an unknown outcome blocks further requests in that process; inspect transaction history before starting a new run.

## Recover an expired upto deposit

If `open` succeeded but `settle` did not, the payer can reclaim the escrow after the channel's expiry without the gateway or facilitator. Use the same `PAYMENT_CLIENT_KEYPAIR_FILE`, `GATEWAY_PAY_TO`, and Devnet RPC as the original payment. The payer needs SOL to pay the refund transaction fee.

```sh
npm run refund:env --workspace @anchoring-payment-channels/client
```

The CLI discovers expired channels owned by the payer. If more than one matches, it prints their addresses and asks you to set `UPTO_CHANNEL_ID` in `examples/client/.env` before running it again. You can also set `UPTO_CHANNEL_ID` to avoid relying on RPC program-account indexing. It verifies the channel's program owner, PDA, payer, merchant, mint, and expiry before signing. A confirmed `settle` already closed the channel and returned its unused deposit, so there is nothing to refund. If submission or confirmation is uncertain, check the printed transaction signature before retrying. The CLI is locally tested against simulated RPC; a live Devnet refund remains unverified.

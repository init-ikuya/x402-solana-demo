# x402 payment client

This package contains the paying CLI, `exact`, repository-backed `upto`, repository-backed `batch-settlement`, and experimental escrow-only `auth-capture` adapters, a per-process spending budget, and a model-driven payment agent. The CLI remains available for deterministic checks. See the [local LLM agent guide](AGENT.md) for LM Studio or Ollama setup and tool calling. The gateway and local facilitator are in [examples/gateway](../gateway/README.md), which documents the payment flows and local setup.

The [demo payment architecture](../../docs/demo-payment-architecture.md) shows how this client, the gateway, and the facilitator communicate.

For Demo Day, the [browser demo](../../docs/topics/auth-capture/demo.md#browser-presentation) starts the same agent as a localhost child process and presents its auth-capture events, report, and answer graphically. Its samurai-styled buyer and satirical provider are presentation artwork; the paid API result remains fictional.

The client uses `@x402/core` for the x402 HTTP envelope and `@x402/svm` for `exact` and signer utilities, but does not use the Quickstart's `@x402/fetch` wrapper. It handles the initial 402 response and the paid retry explicitly so it can check the quoted network, asset, recipient, and amount, reserve the agent's budget before signing, and stop after an uncertain payment outcome instead of issuing another paid request. This is a demo policy choice; it does not imply that `@x402/fetch` is incompatible with these schemes.

Run `npm ci` at the repository root, then copy `.env.example` to `.env`. Configure the expected `GATEWAY_PAY_TO` and a funded `PAYMENT_CLIENT_KEYPAIR_FILE`. The client accepts only the configured recipient, devnet USDC asset, Solana devnet network, and price within `PAYMENT_MAX_AMOUNT`. Its session budget limits the number and total amount of payments made in one process. `PAYMENT_SCHEME=exact` is the default; `upto`, `batch-settlement`, and `auth-capture` select this repository's Anchor escrow routes. `PAYMENT_RESOURCE_URL` can override the selected local route.

From the repository root, after starting the gateway and facilitator:

```sh
npm run pay:env --workspace @anchoring-payment-channels/client
```

The CLI defaults to one paid request. Set `AGENT_REQUEST_COUNT`, `AGENT_MAX_PAYMENTS`, and `AGENT_MAX_TOTAL_AMOUNT` in the client `.env` to make several bounded requests. A payment with an unknown outcome blocks further requests in that process; inspect transaction history before starting a new run.

## Auth-capture operations

The opt-in `auth-capture` route places a 1000-unit hold, then synchronously captures 300 and releases 700. The CLI prints the payment PDA after a confirmed response. Save that ID for later operations. The [gateway guide](../gateway/README.md#experimental-auth-capture-escrow-flow) explains the experimental binding and its limits.

With `AUTH_CAPTURE_PAYMENT_ID` and `AUTH_CAPTURE_ACTION` set in the client `.env`, run:

```sh
npm run auth-capture:operate:env --workspace @anchoring-payment-channels/client
```

`AUTH_CAPTURE_ACTION=refund_captured` and `AUTH_CAPTURE_AMOUNT=100` submit a merchant-funded partial refund. Configure `AUTH_CAPTURE_MERCHANT_KEYPAIR_FILE` with the merchant key and fund it with enough USDC and SOL. `AUTH_CAPTURE_ACTION=reclaim_hold` uses the payer key directly after the capture deadline; it returns only the remaining hold, so a normally completed capture-and-void has nothing left to reclaim. The CLI also supports `capture_hold`, `capture_and_void_hold`, and `void_hold` for a still-open hold. It reads the on-chain operation sequence before signing and reports uncertain submissions for manual reconciliation. An already submitted operation must be checked by signature before retrying.

This is an escrow-only custom Solana binding. The generic `authorization` flow's direct `charge` is unsupported; live Devnet operations have not been verified.

## Batch settlement

The client uses the repository-backed `batch-settlement` SDK binding. Set `PAYMENT_SCHEME=batch-settlement` or `AGENT_SCHEMES=batch-settlement` and configure the gateway's batch route. `BATCH_DEPOSIT_AMOUNT` is a positive number of atomic USDC units reserved in one reusable channel and must fit within the per-run total budget. `BATCH_CLIENT_STORE_FILE` defaults to `.local/anchor-batch-client.json` and holds accepted and pending allocations across CLI restarts. Keep it on private persistent storage and use one client process per store. The spending budget resets on each run.

Each successful batch request accepts a cumulative voucher commitment. Its commitment ID is not an on-chain payout signature; the facilitator's background worker claims the authorized delta later.

### Close a batch channel

Use the same payer key and client store as the paid requests. After channel expiry and the five-minute claim grace period, return unused escrow directly:

```sh
npm run batch:refund:env --workspace @anchoring-payment-channels/client
```

The payer pays the close transaction fee. Claims are no longer accepted after the grace period. Check the returned transaction and channel status before retrying an uncertain close.

For a recording or live walkthrough, set `PAYMENT_DEMO_TRACE=1` in the client `.env` and run either the CLI above or the [LLM agent](AGENT.md). The trace shows the initial GET, decoded `PAYMENT-REQUIRED` terms, the signed retry with `PAYMENT-SIGNATURE` redacted, the decoded `PAYMENT-RESPONSE` settlement, and a short JSON body preview. The CLI also prints the complete paid resource body. The trace does not print signed transaction bytes or private keys. `exact` charges 1000 atomic USDC units; this repository's `upto` route quotes a 1000-unit ceiling and settles the illustrative 300-unit charge. Turn the option off for normal runs. A local mock RPC trace is evidence of the HTTP flow, not a live Devnet transfer.

An illustrative `upto` trace, shortened to the fields to point out during the demo:

```text
[HTTP] → GET /api/trump-insider/upto without payment
[HTTP] ← 402 PAYMENT-REQUIRED (decoded): {"scheme":"upto","amount":"1000",...}
[HTTP] → GET /api/trump-insider/upto PAYMENT-SIGNATURE: [redacted]
[HTTP] ← 200 PAYMENT-RESPONSE (decoded): {"success":true,"transaction":"...","amount":"300"}
[HTTP] ← JSON body preview: {"reportId":"FICTION-...","headline":"...","fictional":true}
```

## Recover an expired upto deposit

If `open` succeeded but `settle` did not, the payer can reclaim the escrow after the channel's expiry without the gateway or facilitator. Use the same `PAYMENT_CLIENT_KEYPAIR_FILE`, `GATEWAY_PAY_TO`, and Devnet RPC as the original payment. The payer needs SOL to pay the refund transaction fee.

```sh
npm run refund:env --workspace @anchoring-payment-channels/client
```

The CLI discovers expired channels owned by the payer. If more than one matches, it prints their addresses and asks you to set `UPTO_CHANNEL_ID` in `examples/client/.env` before running it again. You can also set `UPTO_CHANNEL_ID` to avoid relying on RPC program-account indexing. It verifies the channel's program owner, PDA, payer, merchant, mint, and expiry before signing. A confirmed `settle` already closed the channel and returned its unused deposit, so there is nothing to refund. If submission or confirmation is uncertain, check the printed transaction signature before retrying. The CLI is locally tested against simulated RPC; a live Devnet refund remains unverified.

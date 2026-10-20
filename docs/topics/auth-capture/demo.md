# Auth-capture Demo Day runbook

This runbook supports the [main slides](slides.md) and [speaker script](script.md). The auth-capture flow has been exercised against a real local Solana validator with the deployed Anchor program, a local test token, LM Studio, the gateway, and the browser agent. The program is also deployed on Devnet, but a live Devnet payment remains unverified.

## Browser presentation

The browser demo provides a visual front end for the **real** local agent process. A sequence diagram places the samurai-styled client and blond API provider on opposite lifelines. It highlights each message as it happens: request, 402 quote, signed retry, on-chain settlement, and paid response. A later merchant refund appears as another message. The agent activity strip reports observable stages such as model tool selection, payment tool execution, report evaluation, and verdict revision; it does not expose or invent private model reasoning. The side panel shows token balances and payment counters; updated values flash briefly. Below the diagram, the paid report provides source evidence while the agent gives a short verdict on whether the content is useful and what it cost, without copying the report fields. An expandable details section holds the public addresses, SOL balances, payment PDA, vault balance, and redacted event trace. The page reads a baseline before the run and displays wallet balance changes after settlement. Each RPC read may come from a different slot; the UI reports the observed slots and does not treat the calculated released amount as an independently checked token balance.

## Real local validator rehearsal

Build the SBF v0 program first. Keep `.local/keys/anchoring_payment_channels-keypair.json` from the deployment preparation; its public key must match the declared program ID. In separate terminals, start the validator and configure local test keys, a six-decimal test token, token accounts, and the deployed program:

```sh
solana-test-validator --ledger .local/local-demo/ledger --reset --rpc-port 8899
bash scripts/local-demo-setup.sh
```

The setup script creates ignored local payer, merchant, facilitator, and mint keys if absent, then writes `.local/local-demo/gateway.env` and `client.env`. It funds the test wallets using the local faucet. Add `LM_STUDIO_MODEL=<loaded-model-id>` to `client.env`; start the LM Studio API on `127.0.0.1:1234` with that model loaded. Then start the facilitator, gateway, and browser server in separate terminals from the repository root:

```sh
node --env-file=.local/local-demo/gateway.env --import tsx examples/gateway/src/run-facilitator.ts
node --env-file=.local/local-demo/gateway.env --import tsx examples/gateway/src/main.ts
node --env-file=.local/local-demo/client.env --import tsx examples/client/src/demo-server.ts
```

Open `http://127.0.0.1:4023`. The local test uses the x402 SDK's Devnet CAIP identifier for scheme routing while **all Solana RPC calls go to the local validator**; the browser labels the environment and mint accordingly. The token is an unpegged local test token, so do not convert atomic amounts to dollars. The Devnet identifier in the HTTP headers is a local harness compatibility concession, not proof of a Devnet transfer or a fully portable local x402 network definition. Restart the browser server to authorize another one-request demo run.

After configuring `examples/client/.env`, loading a tool-capable model in LM Studio, starting its local API server, and starting the gateway and facilitator, run:

```sh
npm run demo:env --workspace @anchoring-payment-channels/client
```

Open `http://127.0.0.1:4023` in a browser and press **Run auth-capture demo**. The local server enforces one paid request per start to prevent accidental repeat charges. Restart the server for another run. It forces `AGENT_SCHEMES=auth-capture`, a one-payment 1000-unit session budget, and a redacted HTTP trace. LM Studio is the browser demo's default model provider; set `LM_STUDIO_MODEL` to the exact identifier returned by its [`/v1/models` endpoint](https://lmstudio.ai/docs/developer/openai-compat/models), and optionally set `LM_STUDIO_BASE_URL` when the port differs from 1234. The demo honors the configured payer key, gateway recipient, model, and RPC. `DEMO_AGENT_PROMPT` and `DEMO_PORT` are optional overrides. Do not open the browser run until the gateway, facilitator, LM Studio server and loaded model, and payer balance are ready.

Pre-record the browser agent's payment and a separate merchant-initiated refund as a two-scene clip. Keep the actual order of the 402 quote, signed retry, confirmed hold, merchant capture, paid response, agent answer, refund transaction, and refreshed account panel. The first scene shows a 1000-unit hold, 300-unit capture, and 700-unit release. In the second scene, refund 100 units against that payment PDA and press **Refresh**. The confirmed payment record should then show `funded=1000`, `captured=300`, `released=700`, and `refunded=100`; net payer and merchant changes from the pre-payment baseline should be −200 and +200 token units. The refund is initiated by the merchant operation, **not by the agent**. A buyer could request a refund through an off-chain message or a separate on-chain instruction, but this recording shows no request or causal link from the agent's verdict to the merchant's decision. The local test token and local RPC must remain labeled in the clip. Save the original capture and transaction signatures. The UI's 700-unit remainder is calculated from the quote and settlement response; the account panel independently reads confirmed RPC state. An absent token account is shown as absent rather than zero; RPC failures remain visible. The satirical character artwork depicts fictional API content, not a real person operating the service.

## One-minute walkthrough

| Time | Show | Claim supported |
| --- | --- | --- |
| 0–9 s | Follow the agent activity strip and the GET → 402 → signed retry arrows | The model selects the paid tool; the payment client authorizes the bounded hold. |
| 9–20 s | Follow capture/release → 200, then the model evaluating the paid report | The merchant finalizes the payment after the authorized hold; the agent forms its own verdict. |
| 20–38 s | Show the verdict, then the later refund arrow and refreshed account panel | The merchant-initiated 100-unit refund leaves a 200-unit net payment. |

Do not switch to a payment CLI during the presentation; the merchant refund can run behind the scenes while the browser displays its confirmed result. Deadline reclaim remains a separate Q&A case. Call the recorded run a **local validator transaction**. The HTTP integration test separately uses simulated RPC, and the Rust test uses LiteSVM. Show a Devnet explorer only after recording actual Devnet signatures and checking balances. Never show wallet secrets or raw signed transaction bytes. The latest 38-second two-scene recording uses the client/provider sequence diagram, shows the agent's activity and independent verdict, and highlights updated account values. It is saved under ignored `.local/local-demo/auth-capture-activity.mp4`.

## Reproduce the local evidence

From the repository root, build the SBF v0 program before running the LiteSVM test:

```sh
anchor build --arch v0 --ignore-keys
cargo test -p anchoring-payment-channels --test test_auth_capture
npm run payment:check
npm run payment:test
```

The HTTP integration test is `examples/gateway/test/anchor-auth-capture.integration.test.ts`. It runs the route and facilitator with a simulated RPC. The Rust test runs actual program instructions in LiteSVM. The separate validator rehearsal above executes real local Solana transactions. The fictional paid report contains a disclaimer and a report ID.

## Development-only live Devnet validation

The Devnet program ID is `4PpHEbD82o3bEtTYk478dcbTp4M4G9Q8Jqswcvoozq88`. Its initial-deployment signer is preserved locally at `.local/keys/anchoring_payment_channels-keypair.json` and ignored by Git. Keep the program key and upgrade-authority wallet backed up securely. The deploy authority and fee payer default to `~/.config/solana/id.json` and can be changed with `SOLANA_DEPLOY_WALLET`. The checked-in `Anchor.toml` still defaults to localnet, so use the explicit Devnet script rather than an unqualified `anchor deploy`.

From the repository root, rebuild the SBF v0 artifact, inspect the read-only preflight, and run the deploy command only when ready:

```sh
anchor build --arch v0 --tools-version v1.57 --ignore-keys
bash scripts/deploy-devnet.sh --check
bash scripts/deploy-devnet.sh --deploy
```

The script checks that the program keypair, Rust declaration, TypeScript binding, and both Anchor program entries match. It queries Devnet rent and deploy-wallet balance, deploys with an explicit program signer and RPC URL, then prints the on-chain program information. Re-running `--deploy` upgrades the same address while the current authority remains available; do not make the program immutable with `--final` while further changes are planned. The first deployment finalized at slot 512978628 with signature `3bxoDFG4eZjftZiUgWcwSQJXUzw7UPupsaJufZDDPkJA8AALMPWqQniVJoFq7HXqRhL8RzuS2joi8vAaJmdYuvGT`. The program is 269,472 bytes, its ProgramData balance is 1.3697966 SOL, and the upgrade authority is `Fro8LUsXxcamn8iNuy35KPsmfo7MuEtzhbthMbuTdKk6`. The deploy wallet held 0.58609025 SOL after deployment. Refresh these values before any upgrade or payment test.

Prepare separate payer, merchant, and facilitator keys. Give the payer Devnet USDC and SOL, the merchant a matching USDC associated token account and refund liquidity, and the facilitator SOL for network fees. The merchant key must match `GATEWAY_PAY_TO`.

This section is for validating the implementation before the presentation. The presented payment flow runs through the browser agent above. Copy the two `.env.example` files to local `.env` files. In the gateway environment, set `AUTH_CAPTURE_ENABLED=1`, `AUTH_CAPTURE_MERCHANT_KEYPAIR_FILE`, `FACILITATOR_KEYPAIR_FILE`, and the RPC URL. In the client environment, set `PAYMENT_SCHEME=auth-capture`, `PAYMENT_DEMO_TRACE=1`, `PAYMENT_CLIENT_KEYPAIR_FILE`, `GATEWAY_PAY_TO`, and the same RPC. Start the facilitator, gateway, then client in three terminals:

```sh
npm run facilitator:env --workspace @anchoring-payment-channels/gateway
npm run dev:env --workspace @anchoring-payment-channels/gateway
npm run pay:env --workspace @anchoring-payment-channels/client
```

Save the printed payment PDA and the hold/capture signatures. Query payer, merchant, and vault token balances before and after the request. The expected *delta* for a completed 1000-unit hold is merchant +300, payer −300, and vault 0, excluding SOL fees. The persistent payment record should show `funded=1000`, `captured=300`, `released=700`, and `refunded=0`.

For an optional later merchant-funded refund, set `AUTH_CAPTURE_PAYMENT_ID`, `AUTH_CAPTURE_ACTION=refund_captured`, `AUTH_CAPTURE_AMOUNT=100`, and `AUTH_CAPTURE_MERCHANT_KEYPAIR_FILE` in the client environment. Then run:

```sh
npm run auth-capture:operate:env --workspace @anchoring-payment-channels/client
```

After a confirmed refund, expect merchant net +200, payer net −200, vault 0, and `refunded=100`. This direct operation has been verified on the local validator; Devnet remains unverified. The normal request has already released its entire hold; demonstrate `reclaim_hold` only with a separate deliberately unfinished hold after its capture deadline.

## Presentation fallback

If live Devnet is unavailable, present the local validator recording and its confirmed account panel. The integration test and LiteSVM test provide additional, separately labeled evidence. Do not imply that a local test token is Devnet USDC or that the direct-charge authorization flow is implemented.

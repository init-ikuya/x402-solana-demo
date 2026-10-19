# Auth-capture Demo Day runbook

This runbook supports the [main slides](slides.md) and [speaker script](script.md). The presentation evidence available now is a LiteSVM program test plus an HTTP integration test with simulated RPC. A live Devnet payment and balance reconciliation have not been verified.

## Browser presentation

The browser demo provides a visual front end for the **real** local agent process. It shows a samurai-styled client and a satirical blond API provider, then updates the tool selection, 402 quote, signed retry, settlement response, fictional report, and agent answer as they occur. Separate request and response cards show both HTTP exchanges, with signed payloads redacted. A read-only Devnet RPC panel shows payer and merchant public addresses, SOL and USDC balances, the payment PDA, vault balance, and the payment record's funded, captured, released, and refunded counters. It reads a baseline before the run and displays wallet balance changes after settlement. Each RPC read may come from a different slot; the UI reports the observed slots and does not treat the calculated unused amount as an independently checked token balance.

After configuring `examples/client/.env`, loading a tool-capable model in LM Studio, starting its local API server, and starting the gateway and facilitator, run:

```sh
npm run demo:env --workspace @anchoring-payment-channels/client
```

Open `http://127.0.0.1:4023` in a browser and press **Run auth-capture demo**. The local server enforces one paid request per start to prevent accidental repeat charges. Restart the server for another run. It forces `AGENT_SCHEMES=auth-capture`, a one-payment 1000-unit session budget, and a redacted HTTP trace. LM Studio is the browser demo's default model provider; set `LM_STUDIO_MODEL` to the exact identifier returned by its [`/v1/models` endpoint](https://lmstudio.ai/docs/developer/openai-compat/models), and optionally set `LM_STUDIO_BASE_URL` when the port differs from 1234. The demo honors the configured payer key, gateway recipient, model, and RPC. `DEMO_AGENT_PROMPT` and `DEMO_PORT` are optional overrides. Do not open the browser run until the gateway, facilitator, LM Studio server and loaded model, and payer balance are ready.

Pre-record a successful browser-agent run and use an edited 60-second clip as the presentation's primary demo. Run LM Studio with the model already loaded and start the gateway and facilitator before recording. Keep the actual order of the 402 quote, signed retry, confirmed hold, merchant capture, paid response, and agent answer. Cut or speed up waiting periods visibly; do not present the edited duration as the real settlement latency. Save the full unedited capture and transaction signatures for verification. Label the evidence accurately: local simulated RPC is not a Devnet transfer. The UI's 700-unit remainder is calculated from the 1000-unit quote and 300-unit settlement response. Use the separate account panel to check actual RPC balances and counters before making a live balance claim. An absent USDC token account is shown as absent, rather than zero; RPC failures remain visible. Press **Refresh** to read confirmed account state again. The satirical character artwork depicts the fictional API content, not a real person operating the service.

## One-minute walkthrough

| Time | Show | Claim supported |
| --- | --- | --- |
| 0–8 s | Play the recorded browser run from the agent's tool selection | The model selects the paid API tool within the app's budget. |
| 8–25 s | Point to the 402 quote and redacted `PAYMENT-SIGNATURE` retry | The client authorizes a 1000-unit hold without a manual CLI payment. |
| 25–45 s | Point to the paid report, `PAYMENT-RESPONSE`, 300-unit charge, and 700-unit release | The gateway runs the task after the hold and finalizes the payment. |
| 45–60 s | Show recorded account counters and wallet deltas if the Devnet run was verified; otherwise summarize the labeled local evidence | The displayed evidence supports the stated accounting claim. |

Refund and deadline reclaim are separate lifecycle cases for the slides or Q&A, not steps in the one-minute browser demo. Do not switch to a payment CLI during the presentation. Use the words “local simulated RPC” for the HTTP integration and “LiteSVM execution” for program tests. Show a Devnet explorer only after recording real signatures and checking token balances. Redact signatures only if needed for legibility; never show wallet secrets or raw signed transaction bytes. Export and review the final clip before the talk; the recording has not yet been captured.

## Reproduce the local evidence

From the repository root, build the SBF v0 program before running the LiteSVM test:

```sh
anchor build --arch v0 --ignore-keys
cargo test -p anchoring-payment-channels --test test_auth_capture
npm run payment:check
npm run payment:test
```

The HTTP integration test is `examples/gateway/test/anchor-auth-capture.integration.test.ts`. It runs the route and facilitator with a simulated RPC; it is a useful screen recording source when no deployed program is available. The Rust test runs actual program instructions in LiteSVM. The fictional paid report contains a disclaimer and a report ID.

## Development-only live Devnet validation

Deploy the current program from `Anchor.toml` to Devnet and verify its program ID matches the TypeScript binding. Prepare separate payer, merchant, and facilitator keys. Give the payer Devnet USDC and SOL, the merchant a matching USDC associated token account and refund liquidity, and the facilitator SOL for network fees. The merchant key must match `GATEWAY_PAY_TO`.

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

After a confirmed refund, expect merchant net +200, payer net −200, vault 0, and `refunded=100`. The normal request has already released its entire hold; demonstrate `reclaim_hold` only with a separate deliberately unfinished hold after its capture deadline. The direct operation CLI and live Devnet sequence remain unverified until those signatures and balances are recorded.

## Presentation fallback

If live Devnet is unavailable, present the local integration trace and LiteSVM test output with their labels. The script is written for that evidence level. Do not imply that a mock signature is a real transfer or that the direct-charge authorization flow is implemented.

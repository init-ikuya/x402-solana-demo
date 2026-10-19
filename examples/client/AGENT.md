# Local LLM payment agent

The agent also accepts `AGENT_SCHEMES=auth-capture` or `AGENT_SCHEMES=batch-settlement`. Auth-capture is the Demo Day route: the payer funds a hold and the merchant captures the actual charge after the paid API. The batch tool reuses a cumulative voucher channel; the gateway's worker performs on-chain payout later. Set `AUTH_CAPTURE_RESOURCE_URL` or `BATCH_RESOURCE_URL` to override the matching local route.

The client contains a real model-driven tool loop in `src/agent-core.ts`. The model chooses when to call an enabled paid `exact`, repository-backed `upto` or `auth-capture`, or official SVM `batch-settlement` API and sees each returned parody report before producing its answer. The agent requires at least one paid tool result and includes every report ID and exact headline in its final answer; if it omits them, it gets an answer-only revision turn without another payment. The CLI prints the IDs seen in the tool results so they can be compared with the answer. `src/lm-studio-model.ts` connects to LM Studio's OpenAI-compatible `/v1/chat/completions` tool API; `src/ollama-model.ts` remains available for Ollama's native `/api/chat`. Neither provider receives wallet keys.

For the browser demo, start [LM Studio's local server](https://lmstudio.ai/docs/developer/core/server) and load a model with tool-use support. Configure `examples/client/.env` with the gateway recipient and client keypair described in [README.md](README.md), plus the variables below. Use the exact model ID returned by `GET http://127.0.0.1:1234/v1/models` as `LM_STUDIO_MODEL`. Start the gateway and facilitator as described in [the gateway guide](../gateway/README.md). The standalone agent can be run from the repository root:

```sh
npm run agent:env --workspace @anchoring-payment-channels/client
```

For a presentation-friendly view of the same agent and payment path, start the [browser demo](../../docs/topics/auth-capture/demo.md#browser-presentation) instead. It shows the participants, x402 request sequence, fictional report, and agent answer. The server binds to localhost and allows one paid run per start.

Example settings:

```dotenv
AGENT_MODEL_PROVIDER=lm-studio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=YOUR_LOADED_MODEL_ID
AGENT_PROMPT=Call the fictional paid API twice, then include both report IDs and exact headlines and summarize the total cost.
AGENT_MAX_PAYMENTS=4
AGENT_MAX_TOTAL_AMOUNT=4000
AGENT_MAX_MODEL_TURNS=12
# Enable upto only after configuring the gateway and facilitator for it:
# AGENT_SCHEMES=exact,upto
```

Each tool call is a separate payment authorization. `AGENT_SCHEMES` selects which tools are exposed and defaults to `exact`; `EXACT_RESOURCE_URL`, `UPTO_RESOURCE_URL`, `BATCH_RESOURCE_URL`, and `AUTH_CAPTURE_RESOURCE_URL` override their fixed local routes. The model cannot supply the payment URL, recipient, asset, key, or amount. Application code checks the x402 quote against configured limits, reserves the amount before signing, and stops on an unknown settlement outcome. The model receives the paid resource, charged amount, transaction signature for immediate settlement or batch commitment ID, and remaining budget. The budget lives in one process; inspect transaction history before retrying a run with an unknown outcome.

The demo's API content is fictional parody. The local LLM requires a separately running LM Studio server and a loaded tool-capable model. `AGENT_MODEL_PROVIDER=ollama` selects the existing adapter instead; configure `OLLAMA_BASE_URL` and `OLLAMA_MODEL` for it. CI uses fake model responses and does not download model weights.

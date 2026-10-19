import { runAgent } from "./agent-core.js";
import { AgentPaymentSession } from "./agent-payment-session.js";
import { DEVNET_USDC } from "./constants.js";
import { paidReportEvidence, reviewDemoAnswer } from "./demo-answer.js";
import { createDemoHttpTrace } from "./demo-http-trace.js";
import { loadKeypair } from "./keypair.js";
import { OllamaChatModel } from "./ollama-model.js";
import { LmStudioChatModel } from "./lm-studio-model.js";
import { createPaymentTools, type PaymentScheme } from "./payment-tools.js";
import { BatchPaymentClient, FileBatchClientStorage } from "./batch-client.js";

function positiveInteger(name: string, value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name} must be a positive safe integer`);
  return Number(value);
}

const payTo = process.env.GATEWAY_PAY_TO;
if (!payTo) throw new Error("Set GATEWAY_PAY_TO");
const maxAmount = BigInt(positiveInteger("PAYMENT_MAX_AMOUNT", process.env.PAYMENT_MAX_AMOUNT ?? "1000"));
const maxPayments = positiveInteger("AGENT_MAX_PAYMENTS", process.env.AGENT_MAX_PAYMENTS ?? "4");
const totalAmount = BigInt(positiveInteger("AGENT_MAX_TOTAL_AMOUNT",
  process.env.AGENT_MAX_TOTAL_AMOUNT ?? String(maxAmount * BigInt(maxPayments))));
const maxTurns = positiveInteger("AGENT_MAX_MODEL_TURNS", process.env.AGENT_MAX_MODEL_TURNS ?? "12");
const schemes = (process.env.AGENT_SCHEMES ?? "exact").split(",").map(value => value.trim());
if (!schemes.length || schemes.some(value => value !== "exact" && value !== "upto" && value !== "batch-settlement" && value !== "auth-capture") ||
    new Set(schemes).size !== schemes.length) throw new Error("AGENT_SCHEMES must list exact, upto, batch-settlement, and/or auth-capture");
const signer = await loadKeypair(
  process.env.PAYMENT_CLIENT_KEYPAIR_FILE ?? process.env.EXACT_CLIENT_KEYPAIR_FILE,
  process.env.PAYMENT_CLIENT_SECRET_KEY ?? process.env.EXACT_CLIENT_SECRET_KEY,
);
const session = new AgentPaymentSession({ asset: DEVNET_USDC, maxTotalAmount: totalAmount, maxPayments });
const routes: Partial<Record<PaymentScheme, string>> = {};
if (schemes.includes("exact")) routes.exact = process.env.EXACT_RESOURCE_URL ?? "http://127.0.0.1:4021/api/trump-insider";
if (schemes.includes("upto")) routes.upto = process.env.UPTO_RESOURCE_URL ?? "http://127.0.0.1:4021/api/trump-insider/upto";
if (schemes.includes("batch-settlement")) routes["batch-settlement"] = process.env.BATCH_RESOURCE_URL ?? "http://127.0.0.1:4021/api/trump-insider/batch";
if (schemes.includes("auth-capture")) routes["auth-capture"] = process.env.AUTH_CAPTURE_RESOURCE_URL ?? "http://127.0.0.1:4021/api/trump-insider/auth-capture";
const batchDepositAmount = BigInt(process.env.BATCH_DEPOSIT_AMOUNT ?? totalAmount);
if (schemes.includes("batch-settlement") && (batchDepositAmount <= 0n || batchDepositAmount > totalAmount)) {
  throw new Error("BATCH_DEPOSIT_AMOUNT must fit within AGENT_MAX_TOTAL_AMOUNT");
}
const batchClient = schemes.includes("batch-settlement") ? new BatchPaymentClient(
  signer, process.env.PAYMENT_RPC_URL ?? "https://api.devnet.solana.com",
  new FileBatchClientStorage(process.env.BATCH_CLIENT_STORE_FILE ?? ".batch-client-channels.json"),
  batchDepositAmount,
) : undefined;
const provider = process.env.AGENT_MODEL_PROVIDER ?? "ollama";
if (provider !== "ollama" && provider !== "lm-studio") {
  throw new Error("AGENT_MODEL_PROVIDER must be ollama or lm-studio");
}
const model = provider === "lm-studio"
  ? new LmStudioChatModel({ model: process.env.LM_STUDIO_MODEL ?? "", baseUrl: process.env.LM_STUDIO_BASE_URL })
  : new OllamaChatModel({ model: process.env.OLLAMA_MODEL ?? "qwen3", baseUrl: process.env.OLLAMA_BASE_URL });
try {
  const result = await runAgent({
    model,
    prompt: process.env.AGENT_PROMPT ?? "Use each available paid API tool once. In your answer, include each report ID and exact headline from the API, then summarize the fictional findings and what each call cost.",
    tools: createPaymentTools({
      session, signer, limits: { payTo, asset: DEVNET_USDC, maxAmount }, routes,
      fetchImpl: process.env.PAYMENT_DEMO_TRACE === "1" ? createDemoHttpTrace() : fetch,
      rpcUrl: process.env.PAYMENT_RPC_URL,
      batchClient,
    }),
    maxTurns,
    maxToolCalls: maxPayments,
    onToolCall: process.env.PAYMENT_DEMO_TRACE === "1"
      ? name => console.log(`[AGENT] Selected tool: ${name}`)
      : undefined,
    reviewAnswer: reviewDemoAnswer,
  });
  console.log(result.answer);
  console.log(`API reports used: ${paidReportEvidence(result.toolResults).map(report => report.reportId).join(", ")}`);
  console.log(`Completed paid requests: ${session.records.filter(record => record.state === "settled").length}; authorized/paid ${session.spent}/${session.budget.maxTotalAmount} atomic USDC units`);
} catch (error) {
  if (session.records.at(-1)?.state === "outcome_unknown") {
    console.error("Payment outcome unknown. Check the facilitator and transaction history before retrying.");
  }
  throw error;
}

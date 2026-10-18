import { AgentPaymentSession } from "./agent-payment-session.js";
import { DEVNET_USDC } from "./exact-client.js";
import { createDemoHttpTrace } from "./demo-http-trace.js";
import { loadKeypair } from "./keypair.js";

const scheme = process.env.PAYMENT_SCHEME ?? "exact";
if (scheme !== "exact" && scheme !== "upto") throw new Error("PAYMENT_SCHEME must be exact or upto");
const secret = process.env.PAYMENT_CLIENT_SECRET_KEY ?? process.env.EXACT_CLIENT_SECRET_KEY;
const keypairFile = process.env.PAYMENT_CLIENT_KEYPAIR_FILE ?? process.env.EXACT_CLIENT_KEYPAIR_FILE;
const payTo = process.env.GATEWAY_PAY_TO;
const url = process.env.PAYMENT_RESOURCE_URL ?? process.env.EXACT_RESOURCE_URL ??
  (scheme === "upto" ? "http://127.0.0.1:4021/api/trump-insider/upto"
    : "http://127.0.0.1:4021/api/trump-insider");
const maxAmount = process.env.PAYMENT_MAX_AMOUNT ?? process.env.EXACT_MAX_AMOUNT ?? "1000";
const totalAmount = process.env.AGENT_MAX_TOTAL_AMOUNT ?? maxAmount;
const maxPayments = process.env.AGENT_MAX_PAYMENTS ?? "1";
const requestCount = process.env.AGENT_REQUEST_COUNT ?? "1";

if ((!secret && !keypairFile) || !payTo) {
  throw new Error("Set GATEWAY_PAY_TO and either PAYMENT_CLIENT_KEYPAIR_FILE or PAYMENT_CLIENT_SECRET_KEY");
}
if (!/^[1-9]\d*$/.test(maxAmount)) throw new Error("PAYMENT_MAX_AMOUNT must be positive atomic USDC units");
if (!/^[1-9]\d*$/.test(totalAmount)) throw new Error("AGENT_MAX_TOTAL_AMOUNT must be positive atomic USDC units");
if (!/^[1-9]\d*$/.test(maxPayments) || !Number.isSafeInteger(Number(maxPayments))) throw new Error("AGENT_MAX_PAYMENTS must be a positive safe integer");
if (!/^[1-9]\d*$/.test(requestCount) || !Number.isSafeInteger(Number(requestCount))) throw new Error("AGENT_REQUEST_COUNT must be a positive safe integer");
if (Number(requestCount) > Number(maxPayments)) throw new Error("AGENT_REQUEST_COUNT exceeds AGENT_MAX_PAYMENTS");

const signer = await loadKeypair(keypairFile, secret);
const session = new AgentPaymentSession({
  asset: DEVNET_USDC,
  maxTotalAmount: BigInt(totalAmount),
  maxPayments: Number(maxPayments),
});
const fetchImpl = process.env.PAYMENT_DEMO_TRACE === "1" ? createDemoHttpTrace() : fetch;
for (let request = 1; request <= Number(requestCount); request++) {
  try {
    const limits = { payTo, asset: DEVNET_USDC, maxAmount: BigInt(maxAmount) };
    const payment = scheme === "upto"
      ? session.payUpto(url, limits, signer, fetchImpl)
      : session.payExact(url, limits, signer, fetchImpl);
    const { response, settlement } = await payment;
    console.log(await response.text());
    console.log(`Payment ${request}: ${settlement.transaction}; spent ${session.spent}/${session.budget.maxTotalAmount} atomic USDC units`);
  } catch (error) {
    if (session.records.at(-1)?.state === "outcome_unknown") {
      console.error("Payment outcome unknown. Stop here and check the facilitator or Solana transaction history before another run.");
    }
    throw error;
  }
}

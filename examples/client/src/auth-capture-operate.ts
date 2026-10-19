import { executeAuthOperation, type AuthOperation } from "./auth-capture-operations.js";
import { loadKeypair } from "./keypair.js";

const action = process.env.AUTH_CAPTURE_ACTION as AuthOperation | undefined;
if (!action || !["capture_hold", "capture_and_void_hold", "void_hold", "reclaim_hold", "refund_captured"].includes(action)) {
  throw new Error("Set AUTH_CAPTURE_ACTION to capture_hold, capture_and_void_hold, void_hold, reclaim_hold, or refund_captured");
}
const paymentId = process.env.AUTH_CAPTURE_PAYMENT_ID;
if (!paymentId) throw new Error("Set AUTH_CAPTURE_PAYMENT_ID");
const rawAmount = process.env.AUTH_CAPTURE_AMOUNT ?? "0";
if (!/^\d+$/.test(rawAmount)) throw new Error("AUTH_CAPTURE_AMOUNT must be nonnegative atomic units");
const isReclaim = action === "reclaim_hold";
const authority = await loadKeypair(
  isReclaim ? process.env.PAYMENT_CLIENT_KEYPAIR_FILE : process.env.AUTH_CAPTURE_MERCHANT_KEYPAIR_FILE,
  isReclaim ? process.env.PAYMENT_CLIENT_SECRET_KEY : process.env.AUTH_CAPTURE_MERCHANT_SECRET_KEY,
);
const result = await executeAuthOperation({
  paymentId, action, amount: BigInt(rawAmount), authority,
  rpcUrl: process.env.PAYMENT_RPC_URL ?? "https://api.devnet.solana.com",
});
console.log(JSON.stringify({
  paymentId, action, signature: result.signature,
  captured: result.after.captured.toString(),
  released: result.after.released.toString(),
  refunded: result.after.refunded.toString(),
  holdClosed: result.after.holdClosed,
}));

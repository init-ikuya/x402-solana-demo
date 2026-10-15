import { address } from "@solana/kit";
import { DEVNET_USDC } from "./constants.js";
import { loadKeypair } from "./keypair.js";
import { refundUptoChannel } from "./upto-refund.js";

const merchant = process.env.GATEWAY_PAY_TO;
if (!merchant) throw new Error("Set GATEWAY_PAY_TO to the merchant address used when opening the channel");
const payer = await loadKeypair(
  process.env.PAYMENT_CLIENT_KEYPAIR_FILE ?? process.env.EXACT_CLIENT_KEYPAIR_FILE,
  process.env.PAYMENT_CLIENT_SECRET_KEY ?? process.env.EXACT_CLIENT_SECRET_KEY,
);
const rpcUrl = process.env.PAYMENT_RPC_URL ?? "https://api.devnet.solana.com";
if (!["http:", "https:"].includes(new URL(rpcUrl).protocol)) throw new Error("PAYMENT_RPC_URL must be an HTTP URL");
const channelId = process.env.UPTO_CHANNEL_ID ? address(process.env.UPTO_CHANNEL_ID) : undefined;
const { channel, signature } = await refundUptoChannel({
  payer, merchant: address(merchant), mint: DEVNET_USDC, rpcUrl, channelId,
});
console.log(`Refund confirmed: channel ${channel.id}, transaction ${signature}, original ceiling ${channel.maxAmount} atomic USDC units`);

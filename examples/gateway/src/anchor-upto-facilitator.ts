import {
  address, createNoopSigner, decompileTransactionMessage, getBase58Encoder,
  getCompiledTransactionMessageDecoder, getTransactionDecoder,
  type Instruction,
} from "@solana/kit";
import type { PaymentPayload, PaymentRequirements, SchemeNetworkFacilitator, SettleResponse, VerifyResponse } from "@x402/core/types";
import type { FacilitatorSvmSigner } from "@x402/svm";
import {
  ANCHOR_UPTO_PROGRAM, UPTO_SCHEME, openInstruction, settleInstruction,
} from "../../shared/anchor-upto.js";
import { DEVNET, DEVNET_USDC, UPTO_MAX_AMOUNT } from "./constants.js";

type AnchorPayload = {
  payer: string; nonce: bigint; expiresAt: bigint; channelId: string;
  openTransaction: string; type?: "deposit" | "claim"; settleTransaction?: string;
};

function parsePayload(payload: PaymentPayload): AnchorPayload {
  const raw = payload.payload;
  if (typeof raw.payer !== "string" || typeof raw.nonce !== "string" ||
      !/^\d+$/.test(raw.nonce) || typeof raw.expiresAt !== "string" ||
      !/^\d+$/.test(raw.expiresAt) || typeof raw.channelId !== "string" ||
      typeof raw.openTransaction !== "string" ||
      (raw.type !== undefined && raw.type !== "deposit" && raw.type !== "claim")) {
    throw new Error("Invalid Anchor upto payment payload");
  }
  return {
    payer: raw.payer, nonce: BigInt(raw.nonce), expiresAt: BigInt(raw.expiresAt),
    channelId: raw.channelId, openTransaction: raw.openTransaction,
    type: raw.type, settleTransaction: typeof raw.settleTransaction === "string" ? raw.settleTransaction : undefined,
  };
}

export async function validateSignedTransaction(wire: string, expected: Instruction, feePayer: string, signer: string): Promise<void> {
  const bytes = Buffer.from(wire, "base64");
  if (bytes.length > 1232) throw new Error("Transaction exceeds Solana packet size");
  const transaction = getTransactionDecoder().decode(bytes);
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  if (("addressTableLookups" in message && message.addressTableLookups?.length) ||
      message.staticAccounts[0] !== address(feePayer)) {
    throw new Error("Unexpected transaction accounts or fee payer");
  }
  const instructions = decompileTransactionMessage(message).instructions ?? [];
  if (instructions.length !== 1) throw new Error("Unexpected transaction instructions");
  const actual = instructions[0];
  const expectedRoles = new Map<string, number>();
  for (const account of expected.accounts ?? []) {
    expectedRoles.set(account.address, (expectedRoles.get(account.address) ?? 0) | account.role);
  }
  if (expectedRoles.has(feePayer)) expectedRoles.set(feePayer, 3);
  if (actual.programAddress !== expected.programAddress ||
      !Buffer.from(actual.data ?? []).equals(Buffer.from(expected.data ?? [])) ||
      actual.accounts?.length !== expected.accounts?.length ||
      actual.accounts?.some((account, index) =>
        account.address !== expected.accounts?.[index].address ||
        account.role !== expectedRoles.get(account.address))) {
    throw new Error("Transaction does not match the authorized Anchor instruction");
  }
  if (Object.keys(transaction.signatures).sort().join(",") !== [feePayer, signer].sort().join(",")) {
    throw new Error("Unexpected transaction signers");
  }
  const signature = transaction.signatures[address(signer)];
  if (!signature?.some(byte => byte !== 0)) throw new Error("Missing payer or merchant signature");
  const key = await crypto.subtle.importKey("raw", getBase58Encoder().encode(signer), "Ed25519", false, ["verify"]);
  if (!await crypto.subtle.verify("Ed25519", key, Buffer.from(signature), Buffer.from(transaction.messageBytes))) {
    throw new Error("Invalid payer or merchant signature");
  }
}

export class AnchorUptoFacilitatorScheme implements SchemeNetworkFacilitator {
  readonly scheme = UPTO_SCHEME;
  readonly caipFamily = "solana:*";

  constructor(private readonly signer: FacilitatorSvmSigner, private readonly merchant: string) {}

  getExtra(): Record<string, unknown> {
    return { feePayer: this.signer.getAddresses()[0], programId: ANCHOR_UPTO_PROGRAM };
  }

  getSigners(): string[] { return [...this.signer.getAddresses()]; }

  private checkRequirements(payload: PaymentPayload, requirements: PaymentRequirements): AnchorPayload {
    const feePayer = this.signer.getAddresses()[0];
    if (requirements.scheme !== this.scheme || requirements.network !== DEVNET ||
        requirements.asset !== DEVNET_USDC || requirements.payTo !== this.merchant ||
        requirements.extra.programId !== ANCHOR_UPTO_PROGRAM || requirements.extra.feePayer !== feePayer ||
        payload.accepted.scheme !== this.scheme || payload.accepted.network !== DEVNET ||
        payload.accepted.asset !== DEVNET_USDC || payload.accepted.payTo !== this.merchant ||
        payload.accepted.extra.programId !== ANCHOR_UPTO_PROGRAM || payload.accepted.extra.feePayer !== feePayer ||
        payload.accepted.amount !== UPTO_MAX_AMOUNT || !/^\d+$/.test(requirements.amount) ||
        BigInt(requirements.amount) > BigInt(UPTO_MAX_AMOUNT) ||
        requirements.maxTimeoutSeconds !== 300) throw new Error("Unsupported Anchor upto payment");
    const raw = parsePayload(payload);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (raw.payer === feePayer || raw.payer === this.merchant || raw.expiresAt <= now || raw.expiresAt > now + 300n) {
      throw new Error("Invalid Anchor upto payer or expiry");
    }
    return raw;
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    try {
      const raw = this.checkRequirements(payload, requirements);
      const feePayer = this.signer.getAddresses()[0];
      const { instruction, channel } = await openInstruction({
        payer: createNoopSigner(address(raw.payer)), feePayer, merchant: this.merchant,
        mint: requirements.asset, nonce: raw.nonce,
        maxAmount: BigInt(payload.accepted.amount), expiresAt: raw.expiresAt,
      });
      if (channel !== raw.channelId) throw new Error("Wrong Anchor channel address");
      await validateSignedTransaction(raw.openTransaction, instruction, feePayer, raw.payer);
      await this.signer.simulateTransaction(raw.openTransaction, DEVNET);
      return { isValid: true, payer: raw.payer };
    } catch {
      return { isValid: false, invalidReason: "invalid_anchor_upto_payment" };
    }
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    const raw = this.checkRequirements(payload, requirements);
    const feePayer = this.signer.getAddresses()[0];
    let wire: string;
    let amount: string;
    if (raw.type === "deposit") {
      if (requirements.amount !== UPTO_MAX_AMOUNT || raw.settleTransaction) throw new Error("Invalid Anchor deposit");
      const verified = await this.verify(payload, requirements);
      if (!verified.isValid) throw new Error("Invalid Anchor deposit signature");
      wire = raw.openTransaction;
      amount = "0";
    } else if (raw.type === "claim" && raw.settleTransaction) {
      const { instruction, channel } = await settleInstruction({
        merchant: createNoopSigner(address(this.merchant)),
        payer: raw.payer, feePayer, mint: requirements.asset,
        nonce: raw.nonce, amount: BigInt(requirements.amount),
      });
      if (channel !== raw.channelId) throw new Error("Wrong Anchor channel address");
      await validateSignedTransaction(raw.settleTransaction, instruction, feePayer, this.merchant);
      await this.signer.simulateTransaction(raw.settleTransaction, DEVNET);
      wire = raw.settleTransaction;
      amount = requirements.amount;
    } else throw new Error("Invalid Anchor settlement phase");
    const signed = await this.signer.signTransaction(wire, address(feePayer), DEVNET);
    const signature = await this.signer.sendTransaction(signed, DEVNET);
    await this.signer.confirmTransaction(signature, DEVNET);
    return { success: true, payer: raw.payer, transaction: signature, network: DEVNET, amount };
  }
}

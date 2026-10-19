import { address, createNoopSigner } from "@solana/kit";
import type { PaymentPayload, PaymentRequirements, SchemeNetworkFacilitator, SettleResponse, VerifyResponse } from "@x402/core/types";
import type { FacilitatorSvmSigner } from "@x402/svm";
import {
  AUTH_CAPTURE_BINDING, AUTH_CAPTURE_PROGRAM, AUTH_CAPTURE_SCHEME,
  authorizeHoldInstruction, holdOperationInstruction,
} from "../../shared/anchor-auth-capture.js";
import { DEVNET, DEVNET_USDC } from "./constants.js";
import { validateSignedTransaction } from "./anchor-upto-facilitator.js";

type AuthPayload = {
  payer: string; nonce: bigint; captureDeadline: bigint; refundDeadline: bigint;
  paymentId: string; authorizeTransaction: string;
  type?: "authorize" | "capture" | "void";
  captureTransaction?: string; voidTransaction?: string;
};

function parsePayload(payload: PaymentPayload): AuthPayload {
  const raw = payload.payload;
  if (typeof raw.payer !== "string" || typeof raw.nonce !== "string" || !/^\d+$/.test(raw.nonce) ||
      typeof raw.captureDeadline !== "string" || !/^\d+$/.test(raw.captureDeadline) ||
      typeof raw.refundDeadline !== "string" || !/^\d+$/.test(raw.refundDeadline) ||
      typeof raw.paymentId !== "string" || typeof raw.authorizeTransaction !== "string" ||
      (raw.type !== undefined && raw.type !== "authorize" && raw.type !== "capture" && raw.type !== "void")) {
    throw new Error("Invalid Anchor auth-capture payload");
  }
  return {
    payer: raw.payer, nonce: BigInt(raw.nonce),
    captureDeadline: BigInt(raw.captureDeadline), refundDeadline: BigInt(raw.refundDeadline),
    paymentId: raw.paymentId, authorizeTransaction: raw.authorizeTransaction,
    type: raw.type,
    captureTransaction: typeof raw.captureTransaction === "string" ? raw.captureTransaction : undefined,
    voidTransaction: typeof raw.voidTransaction === "string" ? raw.voidTransaction : undefined,
  };
}

export class AnchorAuthCaptureFacilitatorScheme implements SchemeNetworkFacilitator {
  readonly scheme = AUTH_CAPTURE_SCHEME;
  readonly caipFamily = "solana:*";

  constructor(private readonly signer: FacilitatorSvmSigner, private readonly merchant: string) {}

  getExtra(): Record<string, unknown> {
    return { feePayer: this.signer.getAddresses()[0], programId: AUTH_CAPTURE_PROGRAM, binding: AUTH_CAPTURE_BINDING };
  }

  getSigners(): string[] { return [...this.signer.getAddresses()]; }

  private checkRequirements(payload: PaymentPayload, requirements: PaymentRequirements): AuthPayload {
    const feePayer = this.signer.getAddresses()[0];
    const matches = (value: PaymentRequirements) =>
      value.scheme === AUTH_CAPTURE_SCHEME && value.network === DEVNET &&
      value.asset === DEVNET_USDC && value.payTo === this.merchant &&
      value.extra.programId === AUTH_CAPTURE_PROGRAM &&
      value.extra.binding === AUTH_CAPTURE_BINDING &&
      value.extra.feePayer === feePayer &&
      value.extra.assetTransferMethod === "escrow" &&
      value.extra.paymentFlow === "escrow" &&
      typeof value.extra.captureDeadline === "string" &&
      typeof value.extra.refundDeadline === "string" &&
      value.maxTimeoutSeconds === 300;
    if (!matches(requirements) || !matches(payload.accepted) ||
        requirements.extra.captureDeadline !== payload.accepted.extra.captureDeadline ||
        requirements.extra.refundDeadline !== payload.accepted.extra.refundDeadline ||
        payload.accepted.amount !== "1000" || !/^\d+$/.test(requirements.amount) ||
        BigInt(requirements.amount) > 1000n) throw new Error("Unsupported Anchor auth-capture payment");
    const raw = parsePayload(payload);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (raw.payer === feePayer || raw.payer === this.merchant ||
        raw.captureDeadline.toString() !== requirements.extra.captureDeadline ||
        raw.refundDeadline.toString() !== requirements.extra.refundDeadline ||
        raw.captureDeadline <= now || raw.captureDeadline > now + 300n ||
        raw.refundDeadline < raw.captureDeadline || raw.refundDeadline > now + 600n) {
      throw new Error("Invalid Anchor auth-capture payer or deadlines");
    }
    return raw;
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    try {
      const raw = this.checkRequirements(payload, requirements);
      const feePayer = this.signer.getAddresses()[0];
      const { instruction, payment } = await authorizeHoldInstruction({
        payer: createNoopSigner(address(raw.payer)), feePayer, merchant: this.merchant,
        mint: requirements.asset, nonce: raw.nonce, amount: BigInt(payload.accepted.amount),
        captureDeadline: raw.captureDeadline, refundDeadline: raw.refundDeadline,
      });
      if (payment !== raw.paymentId) throw new Error("Wrong auth-capture payment address");
      await validateSignedTransaction(raw.authorizeTransaction, instruction, feePayer, raw.payer);
      await this.signer.simulateTransaction(raw.authorizeTransaction, DEVNET);
      return { isValid: true, payer: raw.payer };
    } catch {
      return { isValid: false, invalidReason: "invalid_anchor_auth_capture_payment" };
    }
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    const raw = this.checkRequirements(payload, requirements);
    const feePayer = this.signer.getAddresses()[0];
    let wire: string;
    let amount: string;
    if (raw.type === "authorize") {
      if (requirements.amount !== "1000" || raw.captureTransaction || raw.voidTransaction) throw new Error("Invalid auth-capture authorization");
      const verified = await this.verify(payload, requirements);
      if (!verified.isValid) throw new Error("Invalid auth-capture payer signature");
      wire = raw.authorizeTransaction;
      amount = "0";
    } else if ((raw.type === "capture" && raw.captureTransaction && !raw.voidTransaction) ||
               (raw.type === "void" && raw.voidTransaction && !raw.captureTransaction)) {
      if (raw.type === "void" && requirements.amount !== "0") throw new Error("Void must return the full hold");
      const { instruction, payment } = await holdOperationInstruction({
        authority: createNoopSigner(address(this.merchant)), payer: raw.payer,
        merchant: this.merchant, mint: requirements.asset, nonce: raw.nonce,
        type: raw.type === "void" ? "void_hold" : "capture_and_void_hold",
        sequence: 0n, amount: raw.type === "void" ? undefined : BigInt(requirements.amount),
      });
      if (payment !== raw.paymentId) throw new Error("Wrong auth-capture payment address");
      wire = raw.type === "void" ? raw.voidTransaction! : raw.captureTransaction!;
      await validateSignedTransaction(wire, instruction, feePayer, this.merchant);
      await this.signer.simulateTransaction(wire, DEVNET);
      amount = requirements.amount;
    } else throw new Error("Invalid auth-capture settlement phase");
    const signed = await this.signer.signTransaction(wire, address(feePayer), DEVNET);
    const signature = await this.signer.sendTransaction(signed, DEVNET);
    await this.signer.confirmTransaction(signature, DEVNET);
    return { success: true, payer: raw.payer, transaction: signature, network: DEVNET, amount,
      extra: { paymentId: raw.paymentId } };
  }
}

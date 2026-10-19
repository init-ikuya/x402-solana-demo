import type { TransactionSigner } from "@solana/kit";
import type { VerifiedPaymentCanceledContext } from "@x402/core/server";
import type { AssetAmount, PaymentRequirements, Price, SchemeNetworkServer, SupportedKind } from "@x402/core/types";
import {
  AUTH_CAPTURE_BINDING, AUTH_CAPTURE_PROGRAM, AUTH_CAPTURE_SCHEME, holdOperationInstruction,
} from "../../shared/anchor-auth-capture.js";
import { signedTransaction } from "../../shared/anchor-upto.js";
import { DEVNET, DEVNET_USDC } from "./constants.js";

/** Experimental escrow-only Solana auth-capture binding. */
export class AnchorAuthCaptureServerScheme implements SchemeNetworkServer {
  readonly scheme = AUTH_CAPTURE_SCHEME;
  readonly defaultAssetTransferMethod = "escrow";
  readonly paymentFlows = { escrow: { supported: ["escrow"], default: "escrow" } } as const;

  constructor(private readonly merchant: TransactionSigner, private readonly rpcUrl: string) {}

  async parsePrice(price: Price, network: string): Promise<AssetAmount> {
    if (network !== DEVNET || price !== "$0.001") throw new Error("Unsupported auth-capture price");
    return { amount: "1000", asset: DEVNET_USDC };
  }

  getAssetDecimals(asset: string, network: string): number | undefined {
    return asset === DEVNET_USDC && network === DEVNET ? 6 : undefined;
  }

  validateFacilitatorSupport(_network: string, kind: SupportedKind): string | undefined {
    if (kind.extra?.programId !== AUTH_CAPTURE_PROGRAM || kind.extra?.binding !== AUTH_CAPTURE_BINDING ||
        typeof kind.extra.feePayer !== "string") {
      return "Anchor auth-capture facilitator must advertise the binding, program ID, and fee payer";
    }
    return undefined;
  }

  async enhancePaymentRequirements(requirements: PaymentRequirements, kind: SupportedKind): Promise<PaymentRequirements> {
    if (requirements.payTo !== this.merchant.address || kind.extra?.programId !== AUTH_CAPTURE_PROGRAM ||
        kind.extra?.binding !== AUTH_CAPTURE_BINDING || typeof kind.extra.feePayer !== "string") {
      throw new Error("Anchor auth-capture merchant or facilitator mismatch");
    }
    const captureDeadline = Math.floor(Date.now() / 1000) + 300;
    return { ...requirements, extra: {
      ...requirements.extra, assetTransferMethod: "escrow", paymentFlow: "escrow",
      binding: AUTH_CAPTURE_BINDING, programId: AUTH_CAPTURE_PROGRAM, feePayer: kind.extra.feePayer,
      captureDeadline: String(captureDeadline), refundDeadline: String(captureDeadline + 300),
    } };
  }

  readonly enrichSettlementPayload: NonNullable<SchemeNetworkServer["enrichSettlementPayload"]> = async ctx => {
    if (ctx.phase === "before-handler") return { type: "authorize" };
    const raw = ctx.paymentPayload.payload;
    if (typeof raw.payer !== "string" || typeof raw.nonce !== "string" || !/^\d+$/.test(raw.nonce) ||
        typeof ctx.requirements.extra.feePayer !== "string") throw new Error("Invalid auth-capture payload");
    const voidHold = ctx.phase === "cancel" || ctx.requirements.amount === "0";
    const { instruction } = await holdOperationInstruction({
      authority: this.merchant, payer: raw.payer, merchant: this.merchant.address,
      mint: ctx.requirements.asset, nonce: BigInt(raw.nonce),
      type: voidHold ? "void_hold" : "capture_and_void_hold",
      sequence: 0n, amount: voidHold ? undefined : BigInt(ctx.requirements.amount),
    });
    const transaction = await signedTransaction(instruction, ctx.requirements.extra.feePayer, this.rpcUrl);
    return voidHold ? { type: "void", voidTransaction: transaction }
      : { type: "capture", captureTransaction: transaction };
  };

  settleOnCancel(ctx: VerifiedPaymentCanceledContext): PaymentRequirements {
    return { ...ctx.requirements, amount: "0", extra: { ...ctx.requirements.extra } };
  }
}

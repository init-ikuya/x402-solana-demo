import type { TransactionSigner } from "@solana/kit";
import type { VerifiedPaymentCanceledContext } from "@x402/core/server";
import type { AssetAmount, PaymentRequirements, Price, SchemeNetworkServer, SupportedKind } from "@x402/core/types";
import {
  ANCHOR_UPTO_PROGRAM, UPTO_SCHEME, settleInstruction, signedTransaction,
} from "../../shared/anchor-upto.js";
import { DEVNET, DEVNET_USDC } from "./constants.js";

/** Upto flow backed by this repository's Anchor program. */
export class AnchorUptoServerScheme implements SchemeNetworkServer {
  readonly scheme = UPTO_SCHEME;
  readonly defaultAssetTransferMethod = "channel";
  readonly paymentFlows = { channel: { supported: ["escrow"], default: "escrow" } } as const;

  constructor(private readonly merchant: TransactionSigner, private readonly rpcUrl: string) {}

  async parsePrice(price: Price, network: string): Promise<AssetAmount> {
    if (network !== DEVNET || price !== "$0.001") throw new Error("Unsupported upto price");
    return { amount: "1000", asset: DEVNET_USDC };
  }

  getAssetDecimals(asset: string, network: string): number | undefined {
    return asset === DEVNET_USDC && network === DEVNET ? 6 : undefined;
  }

  validateFacilitatorSupport(_network: string, kind: SupportedKind): string | undefined {
    if (kind.extra?.programId !== ANCHOR_UPTO_PROGRAM || typeof kind.extra.feePayer !== "string") {
      return "Anchor upto facilitator must advertise its program ID and fee payer";
    }
    return undefined;
  }

  async enhancePaymentRequirements(requirements: PaymentRequirements, kind: SupportedKind): Promise<PaymentRequirements> {
    if (requirements.payTo !== this.merchant.address || kind.extra?.programId !== ANCHOR_UPTO_PROGRAM ||
        typeof kind.extra.feePayer !== "string") throw new Error("Anchor upto merchant or facilitator mismatch");
    return { ...requirements, extra: {
      ...requirements.extra, assetTransferMethod: "channel", paymentFlow: "escrow",
      programId: ANCHOR_UPTO_PROGRAM, feePayer: kind.extra.feePayer,
    } };
  }

  readonly enrichSettlementPayload: NonNullable<SchemeNetworkServer["enrichSettlementPayload"]> = async ctx => {
    if (ctx.phase === "before-handler") return { type: "deposit" };
    const raw = ctx.paymentPayload.payload;
    if (typeof raw.payer !== "string" || typeof raw.nonce !== "string" ||
        typeof ctx.requirements.extra.feePayer !== "string") throw new Error("Invalid anchor upto payload");
    const { instruction } = await settleInstruction({
      merchant: this.merchant,
      payer: raw.payer,
      feePayer: ctx.requirements.extra.feePayer,
      mint: ctx.requirements.asset,
      nonce: BigInt(raw.nonce),
      amount: BigInt(ctx.requirements.amount),
    });
    return { type: "claim", settleTransaction: await signedTransaction(
      instruction, ctx.requirements.extra.feePayer, this.rpcUrl,
    ) };
  };

  settleOnCancel(ctx: VerifiedPaymentCanceledContext): PaymentRequirements {
    return { ...ctx.requirements, amount: "0", extra: { ...ctx.requirements.extra } };
  }
}

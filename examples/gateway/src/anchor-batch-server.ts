import type { AssetAmount, PaymentRequirements, Price, SchemeNetworkServer, SupportedKind } from "@x402/core/types";
import { ANCHOR_BATCH_BINDING, ANCHOR_BATCH_PROGRAM } from "../../shared/anchor-batch.js";
import { DEVNET, DEVNET_USDC } from "./constants.js";

/** Custom x402 batch binding backed by this repository's Anchor program. */
export class AnchorBatchServerScheme implements SchemeNetworkServer {
  readonly scheme = "batch-settlement";
  readonly defaultAssetTransferMethod = "channel";
  readonly paymentFlows = { channel: { supported: ["authorization"], default: "authorization" } } as const;

  constructor(private readonly merchant: string) {}

  async parsePrice(price: Price, network: string): Promise<AssetAmount> {
    if (network !== DEVNET || price !== "$0.001") throw new Error("Unsupported Anchor batch price");
    return { amount: "1000", asset: DEVNET_USDC };
  }

  getAssetDecimals(asset: string, network: string): number | undefined {
    return asset === DEVNET_USDC && network === DEVNET ? 6 : undefined;
  }

  validateFacilitatorSupport(_network: string, kind: SupportedKind): string | undefined {
    if (kind.extra?.programId !== ANCHOR_BATCH_PROGRAM ||
        kind.extra?.binding !== ANCHOR_BATCH_BINDING || typeof kind.extra.feePayer !== "string") {
      return "Anchor batch facilitator must advertise its binding, program ID, and fee payer";
    }
    return undefined;
  }

  async enhancePaymentRequirements(requirements: PaymentRequirements, kind: SupportedKind): Promise<PaymentRequirements> {
    if (requirements.payTo !== this.merchant ||
        kind.extra?.programId !== ANCHOR_BATCH_PROGRAM ||
        kind.extra?.binding !== ANCHOR_BATCH_BINDING || typeof kind.extra.feePayer !== "string") {
      throw new Error("Anchor batch merchant or facilitator mismatch");
    }
    return { ...requirements, extra: {
      ...requirements.extra, binding: ANCHOR_BATCH_BINDING,
      programId: ANCHOR_BATCH_PROGRAM, feePayer: kind.extra.feePayer,
      assetTransferMethod: "channel", paymentFlow: "authorization", voucherSigner: "client",
    } };
  }
}

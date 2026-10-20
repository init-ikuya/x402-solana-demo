import { createHash } from "node:crypto";
import { address, createNoopSigner } from "@solana/kit";
import type { PaymentPayload, PaymentRequirements, SchemeNetworkFacilitator, SettleResponse, VerifyResponse } from "@x402/core/types";
import type { FacilitatorSvmSigner } from "@x402/svm";
import {
  ANCHOR_BATCH_BINDING, ANCHOR_BATCH_PROGRAM, BATCH_CLAIM_GRACE_SECONDS,
  batchChannelAddress, claimBatchInstructions, closeBatchInstruction,
  openBatchInstruction, readBatchChannel, verifyBatchVoucher,
} from "../../shared/anchor-batch.js";
import { signedInstructions, signedTransaction } from "../../shared/anchor-upto.js";
import { AtomicJsonStore } from "../../shared/atomic-json-store.js";
import { DEVNET, DEVNET_USDC } from "./constants.js";
import { validateSignedTransaction } from "./anchor-upto-facilitator.js";

type BatchPayload = {
  payer: string; nonce: bigint; channelId: string; cumulative: bigint;
  signature: string; deposit?: bigint; expiresAt?: bigint; openTransaction?: string;
};

export type AnchorBatchRecord = {
  channelId: string; payer: string; merchant: string; mint: string;
  nonce: string; deposit: string; expiresAt: string;
  accepted: string; signature: string; openSignature?: string; closed?: boolean;
};

function parsePayload(payload: PaymentPayload): BatchPayload {
  const raw = payload.payload;
  if (typeof raw.payer !== "string" || typeof raw.nonce !== "string" || !/^\d+$/.test(raw.nonce) ||
      typeof raw.channelId !== "string" || typeof raw.cumulative !== "string" || !/^[1-9]\d*$/.test(raw.cumulative) ||
      typeof raw.signature !== "string" ||
      (raw.deposit !== undefined && (typeof raw.deposit !== "string" || !/^[1-9]\d*$/.test(raw.deposit))) ||
      (raw.expiresAt !== undefined && (typeof raw.expiresAt !== "string" || !/^\d+$/.test(raw.expiresAt))) ||
      (raw.openTransaction !== undefined && typeof raw.openTransaction !== "string")) {
    throw new Error("Invalid Anchor batch payload");
  }
  return { payer: raw.payer, nonce: BigInt(raw.nonce), channelId: raw.channelId,
    cumulative: BigInt(raw.cumulative), signature: raw.signature,
    deposit: raw.deposit === undefined ? undefined : BigInt(raw.deposit),
    expiresAt: raw.expiresAt === undefined ? undefined : BigInt(raw.expiresAt),
    openTransaction: raw.openTransaction };
}

/** Verifies and persists cumulative vouchers; a worker claims their latest value on chain. */
export class AnchorBatchFacilitatorScheme implements SchemeNetworkFacilitator {
  readonly scheme = "batch-settlement";
  readonly caipFamily = "solana:*";
  private redeemRunning = false;

  constructor(
    private readonly signer: FacilitatorSvmSigner,
    private readonly merchant: string,
    private readonly rpcUrl: string,
    private readonly store: AtomicJsonStore<AnchorBatchRecord>,
  ) {}

  getExtra(): Record<string, unknown> {
    return { feePayer: this.signer.getAddresses()[0], programId: ANCHOR_BATCH_PROGRAM,
      binding: ANCHOR_BATCH_BINDING };
  }

  getSigners(): string[] { return [...this.signer.getAddresses()]; }

  private checkRequirements(payload: PaymentPayload, requirements: PaymentRequirements): BatchPayload {
    const feePayer = this.signer.getAddresses()[0];
    const matches = (value: PaymentRequirements) => value.scheme === this.scheme &&
      value.network === DEVNET && value.asset === DEVNET_USDC && value.payTo === this.merchant &&
      value.amount === "1000" && value.maxTimeoutSeconds === 300 &&
      value.extra.binding === ANCHOR_BATCH_BINDING && value.extra.programId === ANCHOR_BATCH_PROGRAM &&
      value.extra.feePayer === feePayer && value.extra.voucherSigner === "client" &&
      value.extra.assetTransferMethod === "channel" && value.extra.paymentFlow === "authorization";
    if (!matches(requirements) || !matches(payload.accepted)) throw new Error("Unsupported Anchor batch requirements");
    const raw = parsePayload(payload);
    if (raw.payer === feePayer || raw.payer === this.merchant ||
        !verifyBatchVoucher(raw.payer, raw.channelId, raw.cumulative, raw.signature)) {
      throw new Error("Invalid Anchor batch voucher");
    }
    return raw;
  }

  private async checkChannel(raw: BatchPayload, requirement: PaymentRequirements, current?: AnchorBatchRecord): Promise<void> {
    const feePayer = this.signer.getAddresses()[0];
    if (await batchChannelAddress(raw.payer, this.merchant, requirement.asset, raw.nonce) !== raw.channelId) {
      throw new Error("Wrong Anchor batch channel address");
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    const previous = current ? BigInt(current.accepted) : 0n;
    if (current?.closed || raw.cumulative !== previous + BigInt(requirement.amount)) {
      throw new Error("Batch voucher does not advance by the quoted price");
    }
    if (current) {
      if (raw.openTransaction || raw.deposit !== undefined || raw.expiresAt !== undefined ||
          current.payer !== raw.payer || current.merchant !== this.merchant ||
          current.mint !== requirement.asset || current.nonce !== raw.nonce.toString()) {
        throw new Error("Batch channel terms changed");
      }
      const state = await readBatchChannel(raw.channelId, this.rpcUrl);
      if (state.payer !== raw.payer || state.merchant !== this.merchant || state.mint !== requirement.asset ||
          state.rentPayer !== feePayer || state.deposit.toString() !== current.deposit ||
          state.expiresAt.toString() !== current.expiresAt || state.nonce !== raw.nonce ||
          state.claimed > raw.cumulative || now >= state.expiresAt) {
        throw new Error("Batch channel is not open for this voucher");
      }
    } else {
      if (!raw.openTransaction || raw.deposit === undefined || raw.expiresAt === undefined ||
          raw.deposit < raw.cumulative || raw.expiresAt <= now || raw.expiresAt > now + 3600n) {
        throw new Error("Invalid Anchor batch deposit");
      }
      const { instruction } = await openBatchInstruction({
        payer: createNoopSigner(address(raw.payer)), merchant: this.merchant,
        mint: requirement.asset, feePayer, nonce: raw.nonce,
        deposit: raw.deposit, expiresAt: raw.expiresAt,
      });
      await validateSignedTransaction(raw.openTransaction, instruction, feePayer, raw.payer);
      await this.signer.simulateTransaction(raw.openTransaction, DEVNET);
    }
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    try {
      const raw = this.checkRequirements(payload, requirements);
      await this.checkChannel(raw, requirements, await this.store.get(raw.channelId));
      return { isValid: true, payer: raw.payer };
    } catch (error) {
      console.error("Anchor batch verification failed:", error);
      return { isValid: false, invalidReason: "invalid_anchor_batch_payment" };
    }
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    const raw = this.checkRequirements(payload, requirements);
    return this.store.update(raw.channelId, async current => {
      await this.checkChannel(raw, requirements, current);
      let openSignature = current?.openSignature;
      if (!current) {
        const feePayer = this.signer.getAddresses()[0];
        const signed = await this.signer.signTransaction(raw.openTransaction!, address(feePayer), DEVNET);
        openSignature = await this.signer.sendTransaction(signed, DEVNET);
        await this.signer.confirmTransaction(openSignature, DEVNET);
        const state = await readBatchChannel(raw.channelId, this.rpcUrl);
        if (state.deposit !== raw.deposit || state.expiresAt !== raw.expiresAt || state.claimed !== 0n) {
          throw new Error("Confirmed batch channel differs from the authorized terms");
        }
      }
      const commitmentId = createHash("sha256").update(raw.channelId)
        .update(raw.cumulative.toString()).update(raw.signature).digest("hex");
      const value: AnchorBatchRecord = {
        channelId: raw.channelId, payer: raw.payer, merchant: this.merchant, mint: requirements.asset,
        nonce: raw.nonce.toString(), deposit: (raw.deposit ?? BigInt(current!.deposit)).toString(),
        expiresAt: (raw.expiresAt ?? BigInt(current!.expiresAt)).toString(),
        accepted: raw.cumulative.toString(), signature: raw.signature, openSignature,
      };
      return { value, result: {
        success: true, payer: raw.payer, network: DEVNET,
        transaction: current ? commitmentId : openSignature!, amount: requirements.amount,
        extra: { channelId: raw.channelId, commitmentId, chargedAmount: requirements.amount,
          cumulativeAmount: raw.cumulative.toString(), onchainClaimed: false },
      } };
    });
  }

  /** Claim the latest accepted voucher and close expired channels after the grace period. */
  async redeem(): Promise<void> {
    if (this.redeemRunning) return;
    this.redeemRunning = true;
    try {
      for (const record of await this.store.list()) {
        if (record.closed) continue;
        await this.redeemOne(record).catch(error =>
          console.error(`Anchor batch redemption failed for ${record.channelId}:`, error));
      }
    } finally { this.redeemRunning = false; }
  }

  private async redeemOne(record: AnchorBatchRecord): Promise<void> {
    const state = await readBatchChannel(record.channelId, this.rpcUrl);
    const feePayer = this.signer.getAddresses()[0];
    const now = BigInt(Math.floor(Date.now() / 1000));
    const claimDeadline = state.expiresAt + BigInt(BATCH_CLAIM_GRACE_SECONDS);
    const accepted = BigInt(record.accepted);
    if (state.claimed < accepted && now <= claimDeadline) {
      const { instructions } = await claimBatchInstructions({
        payer: record.payer, merchant: record.merchant, mint: record.mint,
        nonce: BigInt(record.nonce), cumulative: accepted, signature: record.signature,
      });
      const wire = await signedInstructions(instructions, feePayer, this.rpcUrl);
      const signed = await this.signer.signTransaction(wire, address(feePayer), DEVNET);
      const signature = await this.signer.sendTransaction(signed, DEVNET);
      await this.signer.confirmTransaction(signature, DEVNET);
      const after = await readBatchChannel(record.channelId, this.rpcUrl);
      if (after.claimed !== accepted) throw new Error("Batch claim did not advance to the accepted watermark");
      console.log(`Anchor batch claim confirmed: ${signature}`);
    }
    if (now > claimDeadline) {
      if (state.claimed < accepted) throw new Error("Accepted voucher expired before it could be claimed");
      const { instruction } = await closeBatchInstruction({
        payer: record.payer, merchant: record.merchant, mint: record.mint,
        nonce: BigInt(record.nonce), rentPayer: feePayer,
      });
      const wire = await signedTransaction(instruction, feePayer, this.rpcUrl);
      const signed = await this.signer.signTransaction(wire, address(feePayer), DEVNET);
      const signature = await this.signer.sendTransaction(signed, DEVNET);
      await this.signer.confirmTransaction(signature, DEVNET);
      await this.store.update(record.channelId, async current => {
        if (!current || current.accepted !== record.accepted) throw new Error("Batch record changed during close");
        return { value: { ...current, closed: true }, result: undefined };
      });
      console.log(`Anchor batch close confirmed: ${signature}`);
    }
  }
}

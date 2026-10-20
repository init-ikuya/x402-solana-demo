import { randomBytes } from "node:crypto";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import type { BatchClientSigner } from "@x402/svm/batch-settlement/client";
import {
  ANCHOR_BATCH_BINDING, ANCHOR_BATCH_PROGRAM, batchChannelAddress,
  openBatchInstruction, readBatchChannel, signBatchVoucher,
} from "../../shared/anchor-batch.js";
import { signedTransaction } from "../../shared/anchor-upto.js";
import { AtomicJsonStore } from "../../shared/atomic-json-store.js";
import { DEVNET } from "./constants.js";
import type { ExactClientOptions, ExactPaymentLimits, PaidResource } from "./exact-client.js";

export type AnchorBatchClientRecord = {
  channelId: string; payer: string; merchant: string; mint: string; feePayer: string;
  nonce: string; deposit: string; expiresAt: string; accepted: string;
  pending?: string; openTransaction?: string;
};

function acceptable(requirement: PaymentRequirements, limits: ExactPaymentLimits): boolean {
  return requirement.scheme === "batch-settlement" && requirement.network === DEVNET &&
    requirement.asset === limits.asset && requirement.payTo === limits.payTo &&
    /^[1-9]\d*$/.test(requirement.amount) && BigInt(requirement.amount) <= limits.maxAmount &&
    requirement.maxTimeoutSeconds === 300 && requirement.extra.binding === ANCHOR_BATCH_BINDING &&
    requirement.extra.programId === ANCHOR_BATCH_PROGRAM && typeof requirement.extra.feePayer === "string" &&
    requirement.extra.voucherSigner === "client" && requirement.extra.assetTransferMethod === "channel" &&
    requirement.extra.paymentFlow === "authorization";
}

class AnchorBatchClientScheme implements SchemeNetworkClient {
  readonly scheme = "batch-settlement";
  private record?: AnchorBatchClientRecord;

  constructor(
    private readonly signer: BatchClientSigner,
    private readonly rpcUrl: string,
    private readonly store: AtomicJsonStore<AnchorBatchClientRecord>,
    private readonly deposit: bigint,
  ) {}

  async createPaymentPayload(_version: number, requirements: PaymentRequirements) {
    const feePayer = requirements.extra.feePayer;
    if (typeof feePayer !== "string" || requirements.extra.binding !== ANCHOR_BATCH_BINDING ||
        requirements.extra.programId !== ANCHOR_BATCH_PROGRAM) {
      throw new Error("Invalid Anchor batch requirements");
    }
    const key = `${this.signer.address}:${requirements.payTo}:${requirements.asset}:${feePayer}`;
    const record = await this.store.update(key, async current => {
      if (current?.pending) throw new Error(`Batch payment outcome is unresolved for ${current.channelId}`);
      if (current) {
        const state = await readBatchChannel(current.channelId, this.rpcUrl);
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (state.payer !== this.signer.address || state.merchant !== requirements.payTo ||
            state.mint !== requirements.asset || state.rentPayer !== feePayer ||
            state.deposit.toString() !== current.deposit || state.nonce.toString() !== current.nonce ||
            state.expiresAt.toString() !== current.expiresAt ||
            state.claimed > BigInt(current.accepted) || now >= state.expiresAt ||
            BigInt(current.accepted) + BigInt(requirements.amount) > state.deposit) {
          throw new Error("Stored Anchor batch channel is no longer usable");
        }
        const value = { ...current, pending: (BigInt(current.accepted) + BigInt(requirements.amount)).toString() };
        return { value, result: value };
      }
      if (this.deposit < BigInt(requirements.amount)) throw new Error("Batch deposit is less than the quoted price");
      const nonce = randomBytes(8).readBigUInt64LE();
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3000);
      const { channel, instruction } = await openBatchInstruction({
        payer: this.signer, merchant: requirements.payTo, mint: requirements.asset,
        feePayer, nonce, deposit: this.deposit, expiresAt,
      });
      const openTransaction = await signedTransaction(instruction, feePayer, this.rpcUrl);
      const value: AnchorBatchClientRecord = {
        channelId: channel, payer: this.signer.address, merchant: requirements.payTo,
        mint: requirements.asset, feePayer, nonce: nonce.toString(),
        deposit: this.deposit.toString(), expiresAt: expiresAt.toString(),
        accepted: "0", pending: requirements.amount, openTransaction,
      };
      return { value, result: value };
    });
    this.record = record;
    const cumulative = BigInt(record.pending!);
    const signature = await signBatchVoucher(this.signer, record.channelId, cumulative);
    return { x402Version: 2, payload: {
      payer: this.signer.address, nonce: record.nonce, channelId: record.channelId,
      cumulative: cumulative.toString(), signature,
      ...(record.openTransaction ? { deposit: record.deposit, expiresAt: record.expiresAt,
        openTransaction: record.openTransaction } : {}),
    } };
  }

  async commit(cumulative: bigint): Promise<void> {
    const record = this.record;
    if (!record || record.pending !== cumulative.toString()) throw new Error("Wrong batch commitment");
    const key = `${record.payer}:${record.merchant}:${record.mint}:${record.feePayer}`;
    await this.store.update(key, async current => {
      if (!current || current.channelId !== record.channelId || current.pending !== record.pending) {
        throw new Error("Batch channel changed during payment");
      }
      const value = { ...current, accepted: cumulative.toString(), pending: undefined, openTransaction: undefined };
      return { value, result: undefined };
    });
    this.record = undefined;
  }
}

/** Client voucher flow for the repository's Anchor batch program. */
export class AnchorBatchPaymentClient {
  private readonly scheme: AnchorBatchClientScheme;
  private readonly http: x402HTTPClient;

  constructor(
    signer: BatchClientSigner, rpcUrl: string,
    store: AtomicJsonStore<AnchorBatchClientRecord>, deposit: bigint,
  ) {
    if (deposit <= 0n) throw new Error("Batch deposit must be positive");
    const core = new x402Client((_version, requirements) => requirements[0])
      .setSpendControls({ allowedAssets: true });
    this.scheme = new AnchorBatchClientScheme(signer, rpcUrl, store, deposit);
    core.register(DEVNET, this.scheme);
    this.http = new x402HTTPClient(core);
  }

  async pay(url: string, limits: ExactPaymentLimits, fetchImpl: typeof fetch = fetch, options: ExactClientOptions = {}): Promise<PaidResource> {
    const target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Expected an HTTP URL");
    const initial = await fetchImpl(target);
    if (initial.status !== 402) throw new Error(`Expected HTTP 402, received ${initial.status}`);
    let required: PaymentRequired;
    try { required = this.http.getPaymentRequiredResponse(name => initial.headers.get(name)); }
    catch { throw new Error("Invalid batch PAYMENT-REQUIRED header"); }
    if (required.x402Version !== 2 || !Array.isArray(required.accepts) ||
        new URL(required.resource.url, target).href !== target.href) throw new Error("Invalid batch requirements");
    const accepted = required.accepts.find(value => acceptable(value, limits));
    if (!accepted) throw new Error("No acceptable Anchor batch requirement");
    options.onQuoteAccepted?.(BigInt(accepted.amount));
    const payload = await this.http.createPaymentPayload({ ...required, accepts: [accepted] });
    const channelId = payload.payload.channelId;
    const cumulative = payload.payload.cumulative;
    if (typeof channelId !== "string" || typeof cumulative !== "string") throw new Error("Missing batch voucher");
    options.onBeforePaidRequest?.();
    const paid = await fetchImpl(target, { headers: this.http.encodePaymentSignatureHeader(payload) });
    if (!paid.ok) {
      throw new Error(`Batch paid request failed with HTTP ${paid.status}; reconcile ${channelId} before retrying`);
    }
    let settlement;
    try { settlement = this.http.getPaymentSettleResponse(name => paid.headers.get(name)); }
    catch { throw new Error(`Batch response has no PAYMENT-RESPONSE; reconcile ${channelId} before retrying`); }
    if (!settlement.success || settlement.network !== DEVNET ||
        settlement.extra?.channelId !== channelId || settlement.extra?.cumulativeAmount !== cumulative ||
        settlement.extra?.chargedAmount !== accepted.amount || typeof settlement.extra?.commitmentId !== "string") {
      throw new Error(`Batch authorization is unresolved; reconcile ${channelId} before retrying`);
    }
    await this.scheme.commit(BigInt(cumulative));
    return { response: paid, settlement };
  }
}

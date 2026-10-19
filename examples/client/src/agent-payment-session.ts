import type { ClientSvmSigner } from "@x402/svm";
import {
  payForExactResource,
  type ExactClientOptions,
  type ExactPaymentLimits,
  type PaidResource,
} from "./exact-client.js";
import { payForUptoResource } from "./upto-client.js";
import { payForAuthCaptureResource } from "./auth-capture-client.js";
import { BatchPaymentClient } from "./batch-client.js";

export type PaymentState = "reserved" | "outcome_unknown" | "settled" | "cancelled_before_submission";

export interface PaymentRecord {
  id: number;
  scheme: string;
  asset: string;
  ceiling: bigint;
  state: PaymentState;
  charged?: bigint;
  transaction?: string;
  commitmentId?: string;
  paymentId?: string;
}

export interface PaymentBudget {
  asset: string;
  maxTotalAmount: bigint;
  maxPayments: number;
}

/** One-process spending control for an agent. Amounts are atomic units of one asset. */
export class AgentPaymentSession {
  readonly budget: Readonly<PaymentBudget>;
  readonly #records: PaymentRecord[] = [];
  #spent = 0n;
  #activeId: number | undefined;

  constructor(budget: PaymentBudget) {
    if (!budget.asset || budget.maxTotalAmount <= 0n ||
      !Number.isSafeInteger(budget.maxPayments) || budget.maxPayments <= 0) {
      throw new Error("Invalid agent payment budget");
    }
    this.budget = Object.freeze({ ...budget });
  }

  get spent(): bigint { return this.#spent; }
  get reserved(): bigint {
    const active = this.#activeId === undefined ? undefined : this.#records[this.#activeId - 1];
    return active?.ceiling ?? 0n;
  }
  get remaining(): bigint { return this.budget.maxTotalAmount - this.#spent - this.reserved; }
  get records(): readonly PaymentRecord[] { return this.#records.map(record => ({ ...record })); }

  reserve(scheme: string, asset: string, ceiling: bigint): number {
    if (this.#activeId !== undefined) throw new Error("Previous payment is unresolved; check its outcome before paying again");
    if (asset !== this.budget.asset) throw new Error("Payment asset differs from the budget asset");
    if (!scheme || ceiling <= 0n) throw new Error("Invalid payment reservation");
    if (this.#records.length >= this.budget.maxPayments) throw new Error("Agent payment count limit reached");
    if (ceiling > this.remaining) throw new Error("Agent cumulative payment budget exceeded");
    const id = this.#records.length + 1;
    this.#records.push({ id, scheme, asset, ceiling, state: "reserved" });
    this.#activeId = id;
    return id;
  }

  markSubmitted(id: number): void {
    const record = this.#active(id, "reserved");
    // If the HTTP response is lost, settlement may still have succeeded.
    record.state = "outcome_unknown";
  }

  confirm(id: number, charged: bigint, transaction: string, commitmentId?: string, paymentId?: string): void {
    const record = this.#active(id, "outcome_unknown");
    if (charged < 0n || charged > record.ceiling || (!transaction && !commitmentId)) throw new Error("Invalid confirmed payment");
    record.state = "settled";
    record.charged = charged;
    record.transaction = transaction;
    record.commitmentId = commitmentId;
    record.paymentId = paymentId;
    this.#spent += charged;
    this.#activeId = undefined;
  }

  cancelBeforeSubmission(id: number): void {
    const record = this.#active(id, "reserved");
    record.state = "cancelled_before_submission";
    this.#activeId = undefined;
  }

  #active(id: number, state: PaymentState): PaymentRecord {
    const record = this.#records[id - 1];
    if (this.#activeId !== id || !record || record.state !== state) {
      throw new Error(`Payment ${id} is not ${state}`);
    }
    return record;
  }

  /** Exact adapter. Other schemes can reserve their own maximum and confirm their actual charge. */
  async payExact(
    url: string,
    limits: ExactPaymentLimits,
    signer: ClientSvmSigner,
    fetchImpl: typeof fetch = fetch,
    options: Pick<ExactClientOptions, "rpcUrl"> = {},
  ): Promise<PaidResource> {
    return this.#pay("exact", payForExactResource, url, limits, signer, fetchImpl, options);
  }

  /** Upto adapter. Reserve the ceiling and charge only the confirmed actual amount. */
  async payUpto(
    url: string,
    limits: ExactPaymentLimits,
    signer: ClientSvmSigner,
    fetchImpl: typeof fetch = fetch,
    options: Pick<ExactClientOptions, "rpcUrl"> = {},
  ): Promise<PaidResource> {
    return this.#pay("upto", payForUptoResource, url, limits, signer, fetchImpl, options);
  }

  /** Escrow-only auth-capture adapter. The final merchant charge may be below the hold. */
  async payAuthCapture(
    url: string,
    limits: ExactPaymentLimits,
    signer: ClientSvmSigner,
    fetchImpl: typeof fetch = fetch,
    options: Pick<ExactClientOptions, "rpcUrl"> = {},
  ): Promise<PaidResource> {
    return this.#pay("auth-capture", payForAuthCaptureResource, url, limits, signer, fetchImpl, options);
  }

  /** Batch vouchers authorize a charge; token distribution is confirmed later by the worker. */
  async payBatch(
    url: string,
    limits: ExactPaymentLimits,
    signer: ClientSvmSigner,
    client: BatchPaymentClient,
    fetchImpl: typeof fetch = fetch,
  ): Promise<PaidResource> {
    return this.#pay("batch-settlement", (target, accepted, _signer, fetcher, options) =>
      client.pay(target, accepted, fetcher, options), url, limits, signer, fetchImpl, {});
  }

  async #pay(
    scheme: "exact" | "upto" | "batch-settlement" | "auth-capture",
    adapter: typeof payForExactResource,
    url: string,
    limits: ExactPaymentLimits,
    signer: ClientSvmSigner,
    fetchImpl: typeof fetch,
    options: Pick<ExactClientOptions, "rpcUrl">,
  ): Promise<PaidResource> {
    if (this.#activeId !== undefined) throw new Error("Previous payment is unresolved; check its outcome before paying again");
    if (this.#records.length >= this.budget.maxPayments) throw new Error("Agent payment count limit reached");
    let id: number | undefined;
    let amount: bigint | undefined;
    try {
      const result = await adapter(url, limits, signer, fetchImpl, {
        ...options,
        onQuoteAccepted: quoted => {
          id = this.reserve(scheme, limits.asset, quoted);
          amount = quoted;
        },
        onBeforePaidRequest: () => {
          if (id === undefined) throw new Error("Missing payment reservation");
          this.markSubmitted(id);
        },
      });
      if (id === undefined || amount === undefined) throw new Error("Missing payment reservation");
      const charged = scheme === "exact" ? amount : BigInt(
        scheme === "batch-settlement" ? String(result.settlement.extra?.chargedAmount ?? "-1") : result.settlement.amount ?? "-1");
      const commitmentId = scheme === "batch-settlement" ? result.settlement.extra?.commitmentId : undefined;
      const paymentId = scheme === "auth-capture" ? result.settlement.extra?.paymentId : undefined;
      this.confirm(id, charged, result.settlement.transaction,
        typeof commitmentId === "string" ? commitmentId : undefined,
        typeof paymentId === "string" ? paymentId : undefined);
      return result;
    } catch (error) {
      if (id !== undefined && this.#records[id - 1].state === "reserved") {
        this.cancelBeforeSubmission(id);
      }
      throw error;
    }
  }
}

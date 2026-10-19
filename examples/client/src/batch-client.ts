import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { BatchSvmScheme, type BatchClientSigner, type BatchSvmClientConfig } from "@x402/svm/batch-settlement/client";
import { DEVNET } from "./constants.js";
import type { ExactClientOptions, ExactPaymentLimits, PaidResource } from "./exact-client.js";

type Storage = NonNullable<BatchSvmClientConfig["channelStorage"]>;
type RecordValue = NonNullable<Awaited<ReturnType<Storage["get"]>>>;

/** Persist the SDK's confirmed and pending allocations across CLI restarts. */
export class FileBatchClientStorage implements Storage {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work, work);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private async read(): Promise<Record<string, RecordValue>> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"), (_key, value: unknown) => {
        if (value && typeof value === "object" && !Array.isArray(value) &&
          Object.keys(value).length === 1 && "$bigint" in value &&
          typeof value.$bigint === "string" && /^\d+$/.test(value.$bigint)) return BigInt(value.$bigint);
        return value;
      });
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid batch client store");
      return parsed as Record<string, RecordValue>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async save(rows: Record<string, RecordValue>): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(rows, (_key, value: unknown) =>
      typeof value === "bigint" ? { $bigint: value.toString() } : value), { mode: 0o600 });
    await rename(temporary, this.file);
  }

  get(key: string): Promise<RecordValue | undefined> {
    return this.serialize(async () => (await this.read())[key]);
  }

  set(key: string, record: RecordValue): Promise<void> {
    return this.serialize(async () => {
      const rows = await this.read();
      rows[key] = record;
      await this.save(rows);
    });
  }

  delete(key: string): Promise<void> {
    return this.serialize(async () => {
      const rows = await this.read();
      delete rows[key];
      await this.save(rows);
    });
  }
}

function acceptable(requirement: PaymentRequirements, limits: ExactPaymentLimits): boolean {
  return requirement.scheme === "batch-settlement" && requirement.network === DEVNET &&
    requirement.asset === limits.asset && requirement.payTo === limits.payTo &&
    /^[1-9]\d*$/.test(requirement.amount) && BigInt(requirement.amount) <= limits.maxAmount &&
    requirement.extra.assetTransferMethod === "channel" &&
    (requirement.extra.paymentFlow === undefined || requirement.extra.paymentFlow === "authorization") &&
    requirement.extra.voucherSigner === "client" &&
    typeof requirement.extra.feePayer === "string";
}

/** Reuses one SDK channel across paid requests and commits its response hook. */
export class BatchPaymentClient {
  private readonly http: x402HTTPClient;
  private readonly scheme: BatchSvmScheme;

  constructor(signer: BatchClientSigner, rpcUrl: string, store: Storage, depositAmount: bigint) {
    if (depositAmount <= 0n) throw new Error("Batch deposit must be positive");
    const core = new x402Client((_version, requirements) => requirements[0]);
    this.scheme = new BatchSvmScheme(signer, {
      rpcUrl, channelStorage: store, depositAmount,
    });
    core.register(DEVNET, this.scheme);
    this.http = new x402HTTPClient(core);
  }

  async pay(url: string, limits: ExactPaymentLimits, fetchImpl: typeof fetch = fetch, options: ExactClientOptions = {}): Promise<PaidResource> {
    const target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Expected an HTTP URL");
    if (limits.maxAmount <= 0n) throw new Error("maxAmount must be positive");
    let response = await fetchImpl(target);
    if (response.status !== 402) throw new Error(`Expected HTTP 402, received ${response.status}`);
    let reservedAmount: bigint | undefined;
    let submitted = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      let required: PaymentRequired;
      try { required = this.http.getPaymentRequiredResponse(name => response.headers.get(name)); }
      catch { throw new Error("Invalid batch PAYMENT-REQUIRED header"); }
      if (required.x402Version !== 2 || !Array.isArray(required.accepts) ||
        new URL(required.resource.url, target).href !== target.href) throw new Error("Invalid batch payment requirements");
      const accepted = required.accepts.find(value => acceptable(value, limits));
      if (!accepted) throw new Error("No acceptable batch-settlement requirement");
      const quotedAmount = BigInt(accepted.amount);
      if (reservedAmount === undefined) {
        options.onQuoteAccepted?.(quotedAmount);
        reservedAmount = quotedAmount;
      } else if (quotedAmount > reservedAmount) {
        throw new Error("Corrective batch quote exceeds the reserved payment ceiling");
      }
      const payload = await this.http.createPaymentPayload({ ...required, accepts: [accepted] });
      if (!submitted) { options.onBeforePaidRequest?.(); submitted = true; }
      response = await fetchImpl(target, { headers: this.http.encodePaymentSignatureHeader(payload) });
      const result = await this.http.processPaymentResult(payload, name => response.headers.get(name), response.status);
      if (result.recovered && response.status === 402 && attempt === 0) continue;
      if (!response.ok) throw new Error(`Batch paid request failed with HTTP ${response.status}; reconcile channel before retrying`);
      const settlement = result.settleResponse;
      const charged = settlement?.extra?.chargedAmount;
      const commitment = settlement?.extra?.commitmentId;
      if (!settlement?.success || settlement.network !== DEVNET ||
        typeof charged !== "string" || !/^\d+$/.test(charged) ||
        BigInt(charged) > BigInt(accepted.amount) || typeof commitment !== "string" || !commitment) {
        throw new Error("Batch authorization outcome is unknown; reconcile channel before retrying");
      }
      return { response, settlement };
    }
    throw new Error("Batch channel could not resynchronize after a corrective 402");
  }

  refund(url: string, fetchImpl: typeof fetch = fetch): Promise<SettleResponse> {
    return this.scheme.refund(url, { fetch: fetchImpl });
  }
}

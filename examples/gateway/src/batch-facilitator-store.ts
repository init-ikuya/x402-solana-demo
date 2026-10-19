import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  BatchPendingSettlementStore, PaymentChannelOpenWrite,
  PaymentChannelRecord, PaymentChannelStorage,
} from "@x402/svm/batch-settlement/facilitator";

class FileMap<T> {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}

  async transaction<R>(work: (rows: Record<string, T>) => { result: R; changed: boolean } | Promise<{ result: R; changed: boolean }>): Promise<R> {
    const run = async () => {
      let rows: Record<string, T>;
      try {
        const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid facilitator batch store");
        rows = parsed as Record<string, T>;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        rows = {};
      }
      const { result, changed } = await work(rows);
      if (changed) {
        await mkdir(dirname(this.file), { recursive: true });
        const temporary = `${this.file}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(rows), { mode: 0o600 });
        await rename(temporary, this.file);
      }
      return result;
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }
}

/** Durable uncertain-transaction records for one facilitator process. */
export class FileBatchPendingStore implements BatchPendingSettlementStore {
  private readonly map: FileMap<string>;
  constructor(file: string) { this.map = new FileMap(file); }
  get(key: string): Promise<string | undefined> {
    return this.map.transaction(rows => ({ result: rows[key], changed: false }));
  }
  set(key: string, value: string): Promise<void> {
    return this.map.transaction(rows => { rows[key] = value; return { result: undefined, changed: true }; });
  }
  setIfAbsent(key: string, value: string): Promise<boolean> {
    return this.map.transaction(rows => {
      if (Object.hasOwn(rows, key)) return { result: false, changed: false };
      rows[key] = value;
      return { result: true, changed: true };
    });
  }
  deleteIfEquals(key: string, value: string): Promise<boolean> {
    return this.map.transaction(rows => {
      if (rows[key] !== value) return { result: false, changed: false };
      delete rows[key];
      return { result: true, changed: true };
    });
  }
  delete(key: string): Promise<void> {
    return this.map.transaction(rows => { delete rows[key]; return { result: undefined, changed: true }; });
  }
}

type ChannelRow = { record: PaymentChannelRecord; revertToken: string };
const channelKey = (network: string, channelId: string) => `${network}\0${channelId}`;

/** Durable first-writer-wins receiver bindings for one facilitator process. */
export class FileBatchFacilitatorChannelStore implements PaymentChannelStorage {
  private readonly map: FileMap<ChannelRow>;
  constructor(file: string) { this.map = new FileMap(file); }

  recordOpen(record: PaymentChannelRecord): Promise<PaymentChannelOpenWrite> {
    return this.map.transaction(rows => {
      const key = channelKey(record.network, record.channelId);
      const existing = rows[key];
      if (existing) {
        const bound = existing.record;
        if (bound.payTo !== record.payTo || bound.tokenProgram !== record.tokenProgram ||
          (bound.receiverAuthorizer && record.receiverAuthorizer && bound.receiverAuthorizer !== record.receiverAuthorizer) ||
          (bound.callerIdentity && record.callerIdentity && bound.callerIdentity !== record.callerIdentity)) {
          return { result: { record: { ...bound }, revertToken: "" }, changed: false };
        }
        const updated = { ...bound,
          expiresAt: Math.max(bound.expiresAt, record.expiresAt),
          lastActivityAt: Math.max(bound.lastActivityAt, record.lastActivityAt),
        };
        rows[key] = { record: updated, revertToken: randomUUID() };
        return { result: { record: { ...updated }, revertToken: "" }, changed: true };
      }
      const revertToken = randomUUID();
      rows[key] = { record: { ...record }, revertToken };
      return { result: { record: { ...record }, revertToken }, changed: true };
    });
  }

  revertOpen(write: PaymentChannelOpenWrite): Promise<void> {
    return this.map.transaction(rows => {
      const key = channelKey(write.record.network, write.record.channelId);
      if (!write.revertToken || rows[key]?.revertToken !== write.revertToken) return { result: undefined, changed: false };
      delete rows[key];
      return { result: undefined, changed: true };
    });
  }

  recordActivity(...records: PaymentChannelRecord[]): Promise<void> {
    return this.map.transaction(rows => {
      for (const record of records) {
        const key = channelKey(record.network, record.channelId);
        const existing = rows[key];
        rows[key] = existing
          ? { ...existing, record: { ...existing.record, lastActivityAt: Math.max(existing.record.lastActivityAt, record.lastActivityAt) } }
          : { record: { ...record }, revertToken: "" };
      }
      return { result: undefined, changed: records.length > 0 };
    });
  }

  get(network: string, channelId: string): Promise<PaymentChannelRecord | undefined> {
    return this.map.transaction(rows => ({ result: rows[channelKey(network, channelId)]?.record, changed: false }));
  }
  list(network: string): Promise<PaymentChannelRecord[]> {
    return this.map.transaction(rows => ({ result: Object.values(rows).filter(row => row.record.network === network).map(row => row.record), changed: false }));
  }
  delete(network: string, channelId: string): Promise<void> {
    return this.map.transaction(rows => { delete rows[channelKey(network, channelId)]; return { result: undefined, changed: true }; });
  }
}

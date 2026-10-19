import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ChannelState, ChannelStore } from "@x402/svm/batch-settlement/server";

function encode(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? { $bigint: item.toString() } : item);
}

function decode(text: string): Record<string, ChannelState> {
  const value: unknown = JSON.parse(text, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item) &&
      Object.keys(item).length === 1 && "$bigint" in item &&
      typeof item.$bigint === "string" && /^\d+$/.test(item.$bigint)) return BigInt(item.$bigint);
    return item;
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid batch channel store");
  return value as Record<string, ChannelState>;
}

/** Single-process durable channel state for the demo gateway. */
export class FileBatchChannelStore implements ChannelStore {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<Record<string, ChannelState>> {
    try { return decode(await readFile(this.file, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async save(rows: Record<string, ChannelState>): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, encode(rows), { mode: 0o600 });
    await rename(temporary, this.file);
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work, work);
    this.chain = next.catch(() => undefined);
    return next;
  }

  get(channelId: string): Promise<ChannelState | undefined> {
    return this.serialize(async () => (await this.read())[channelId]);
  }

  list(): Promise<ChannelState[]> {
    return this.serialize(async () => Object.values(await this.read()));
  }

  put(state: ChannelState): Promise<void> {
    return this.serialize(async () => {
      const rows = await this.read();
      rows[state.channelId] = state;
      await this.save(rows);
    });
  }

  update(channelId: string, updater: (current: ChannelState | undefined) => ChannelState | Promise<ChannelState>): Promise<ChannelState> {
    return this.serialize(async () => {
      const rows = await this.read();
      const updated = await updater(rows[channelId]);
      if (updated.channelId !== channelId) throw new Error("Batch channel ID changed during update");
      rows[channelId] = updated;
      await this.save(rows);
      return updated;
    });
  }
}

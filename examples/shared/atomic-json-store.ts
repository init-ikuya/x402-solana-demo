import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Serialized, atomic single-process state for the local batch demo. */
export class AtomicJsonStore<T> {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}

  private async read(): Promise<Record<string, T>> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON store");
      return parsed as Record<string, T>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async save(rows: Record<string, T>): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(rows), { mode: 0o600 });
    await rename(temporary, this.file);
  }

  private serialize<R>(work: () => Promise<R>): Promise<R> {
    const next = this.chain.then(work, work);
    this.chain = next.catch(() => undefined);
    return next;
  }

  get(key: string): Promise<T | undefined> {
    return this.serialize(async () => (await this.read())[key]);
  }

  list(): Promise<T[]> {
    return this.serialize(async () => Object.values(await this.read()));
  }

  update<R>(key: string, work: (current: T | undefined) => Promise<{ value: T; result: R }>): Promise<R> {
    return this.serialize(async () => {
      const rows = await this.read();
      const next = await work(rows[key]);
      rows[key] = next.value;
      await this.save(rows);
      return next.result;
    });
  }
}

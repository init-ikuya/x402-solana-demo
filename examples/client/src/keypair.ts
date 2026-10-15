import { readFile } from "node:fs/promises";
import { createKeyPairSignerFromBytes, getBase58Encoder } from "@solana/kit";

export async function loadKeypair(file: string | undefined, secret: string | undefined) {
  if (!file && !secret) throw new Error("Set a keypair file or base58 secret");
  const bytes = file
    ? new Uint8Array(JSON.parse(await readFile(file, "utf8")) as number[])
    : getBase58Encoder().encode(secret!);
  return createKeyPairSignerFromBytes(bytes);
}

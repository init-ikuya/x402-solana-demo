import { createHash, createPublicKey, verify as verifyEd25519 } from "node:crypto";
import {
  AccountRole, address, createNoopSigner, createSignableMessage, getBase58Decoder,
  getBase58Encoder, getI64Encoder, getProgramDerivedAddress, getU64Encoder,
  type Address, type Instruction, type MessagePartialSigner, type TransactionSigner,
} from "@solana/kit";
import {
  ANCHOR_UPTO_PROGRAM, ASSOCIATED_TOKEN_PROGRAM, SYSTEM_PROGRAM, TOKEN_PROGRAM,
  instructionDiscriminator, tokenAddress,
} from "./anchor-upto.js";

export const ANCHOR_BATCH_BINDING = "anchor-batch-v1";
export const ANCHOR_BATCH_PROGRAM = ANCHOR_UPTO_PROGRAM;
export const ED25519_PROGRAM = "Ed25519SigVerify111111111111111111111111111";
export const INSTRUCTIONS_SYSVAR = "Sysvar1nstructions1111111111111111111111111";
export const BATCH_CLAIM_GRACE_SECONDS = 300;
const DOMAIN = new TextEncoder().encode("x402-anchor-batch-v1");
const keyBytes = (key: string) => getBase58Encoder().encode(key);
const readonly = (key: string) => ({ address: address(key), role: AccountRole.READONLY });
const writable = (key: string) => ({ address: address(key), role: AccountRole.WRITABLE });
const signerAccount = (signer: TransactionSigner, writableRole = false) => ({
  address: signer.address,
  role: writableRole ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER,
  signer,
});

export async function batchChannelAddress(payer: string, merchant: string, mint: string, nonce: bigint): Promise<Address> {
  const [channel] = await getProgramDerivedAddress({ programAddress: address(ANCHOR_BATCH_PROGRAM), seeds: [
    new TextEncoder().encode("batch"), keyBytes(payer), keyBytes(merchant), keyBytes(mint), getU64Encoder().encode(nonce),
  ] });
  return channel;
}

export function batchVoucherMessage(channel: string, cumulative: bigint): Uint8Array {
  const bytes = new Uint8Array(DOMAIN.length + 32 + 32 + 8);
  bytes.set(DOMAIN);
  bytes.set(keyBytes(ANCHOR_BATCH_PROGRAM), DOMAIN.length);
  bytes.set(keyBytes(channel), DOMAIN.length + 32);
  bytes.set(getU64Encoder().encode(cumulative), DOMAIN.length + 64);
  return bytes;
}

export async function signBatchVoucher(signer: MessagePartialSigner, channel: string, cumulative: bigint): Promise<string> {
  const [signatures] = await signer.signMessages([createSignableMessage(batchVoucherMessage(channel, cumulative))]);
  const signature = signatures[signer.address];
  if (!signature || signature.length !== 64) throw new Error("Missing batch voucher signature");
  return getBase58Decoder().decode(signature);
}

export function verifyBatchVoucher(payer: string, channel: string, cumulative: bigint, signature: string): boolean {
  try {
    const publicKey = keyBytes(payer);
    const signatureBytes = keyBytes(signature);
    if (publicKey.length !== 32 || signatureBytes.length !== 64) return false;
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey)]);
    return verifyEd25519(null, Buffer.from(batchVoucherMessage(channel, cumulative)),
      createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(signatureBytes));
  } catch { return false; }
}

export function ed25519VerifyInstruction(payer: string, channel: string, cumulative: bigint, signature: string): Instruction {
  if (!verifyBatchVoucher(payer, channel, cumulative, signature)) throw new Error("Invalid batch voucher signature");
  const message = batchVoucherMessage(channel, cumulative);
  const data = new Uint8Array(112 + message.length);
  data[0] = 1;
  for (const [offset, value] of [[2, 48], [4, 65535], [6, 16], [8, 65535],
    [10, 112], [12, message.length], [14, 65535]]) {
    data[offset] = value & 255;
    data[offset + 1] = value >> 8;
  }
  data.set(keyBytes(payer), 16);
  data.set(keyBytes(signature), 48);
  data.set(message, 112);
  return { programAddress: address(ED25519_PROGRAM), accounts: [], data };
}

export async function openBatchInstruction(args: {
  payer: TransactionSigner; merchant: string; mint: string; feePayer: string;
  nonce: bigint; deposit: bigint; expiresAt: bigint;
}): Promise<{ channel: Address; instruction: Instruction }> {
  const channel = await batchChannelAddress(args.payer.address, args.merchant, args.mint, args.nonce);
  const data = new Uint8Array(32);
  data.set(instructionDiscriminator("open_batch"));
  data.set(getU64Encoder().encode(args.nonce), 8);
  data.set(getU64Encoder().encode(args.deposit), 16);
  data.set(getI64Encoder().encode(args.expiresAt), 24);
  return { channel, instruction: { programAddress: address(ANCHOR_BATCH_PROGRAM), accounts: [
    signerAccount(args.payer, true), signerAccount(createNoopSigner(address(args.feePayer)), true),
    readonly(args.merchant), readonly(args.mint),
    writable(await tokenAddress(args.payer.address, args.mint)), writable(channel),
    writable(await tokenAddress(channel, args.mint)), readonly(TOKEN_PROGRAM),
    readonly(ASSOCIATED_TOKEN_PROGRAM), readonly(SYSTEM_PROGRAM),
  ], data } };
}

export async function claimBatchInstructions(args: {
  payer: string; merchant: string; mint: string; nonce: bigint;
  cumulative: bigint; signature: string;
}): Promise<{ channel: Address; instructions: Instruction[] }> {
  const channel = await batchChannelAddress(args.payer, args.merchant, args.mint, args.nonce);
  const data = new Uint8Array(16);
  data.set(instructionDiscriminator("claim_batch"));
  data.set(getU64Encoder().encode(args.cumulative), 8);
  return { channel, instructions: [
    ed25519VerifyInstruction(args.payer, channel, args.cumulative, args.signature),
    { programAddress: address(ANCHOR_BATCH_PROGRAM), accounts: [
      writable(channel), readonly(args.payer), readonly(args.merchant), readonly(args.mint),
      writable(await tokenAddress(channel, args.mint)),
      writable(await tokenAddress(args.merchant, args.mint)),
      readonly(INSTRUCTIONS_SYSVAR), readonly(TOKEN_PROGRAM),
    ], data },
  ] };
}

export async function closeBatchInstruction(args: {
  payer: string; merchant: string; mint: string; nonce: bigint; rentPayer: string;
}): Promise<{ channel: Address; instruction: Instruction }> {
  const channel = await batchChannelAddress(args.payer, args.merchant, args.mint, args.nonce);
  return { channel, instruction: { programAddress: address(ANCHOR_BATCH_PROGRAM), accounts: [
    writable(channel), readonly(args.payer), writable(args.rentPayer), readonly(args.mint),
    writable(await tokenAddress(channel, args.mint)), writable(await tokenAddress(args.payer, args.mint)),
    readonly(TOKEN_PROGRAM),
  ], data: instructionDiscriminator("close_batch") } };
}

const ACCOUNT_DISCRIMINATOR = createHash("sha256").update("account:BatchChannel").digest().subarray(0, 8);
export type BatchChannelState = {
  id: string; payer: string; merchant: string; mint: string; rentPayer: string;
  deposit: bigint; claimed: bigint; expiresAt: bigint; nonce: bigint;
};

export async function readBatchChannel(id: string, rpcUrl: string, fetchImpl: typeof fetch = fetch): Promise<BatchChannelState> {
  const response = await fetchImpl(rpcUrl, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo",
      params: [address(id), { encoding: "base64", commitment: "confirmed" }] }) });
  if (!response.ok) throw new Error(`Batch account RPC returned HTTP ${response.status}`);
  const result = await response.json() as { result?: { value: { owner: string; data: [string, string] } | null }; error?: unknown };
  const account = result.result?.value;
  if (result.error || !account || account.owner !== ANCHOR_BATCH_PROGRAM || account.data[1] !== "base64") {
    throw new Error("Batch channel is missing or has the wrong owner");
  }
  const bytes = Buffer.from(account.data[0], "base64");
  if (bytes.length !== 169 || !bytes.subarray(0, 8).equals(ACCOUNT_DISCRIMINATOR)) {
    throw new Error("Batch channel has an invalid layout");
  }
  const key = (offset: number) => getBase58Decoder().decode(bytes.subarray(offset, offset + 32));
  const state = { id, payer: key(8), merchant: key(40), mint: key(72), rentPayer: key(104),
    deposit: bytes.readBigUInt64LE(136), claimed: bytes.readBigUInt64LE(144),
    expiresAt: bytes.readBigInt64LE(152), nonce: bytes.readBigUInt64LE(160) };
  if (state.claimed > state.deposit || await batchChannelAddress(state.payer, state.merchant, state.mint, state.nonce) !== id) {
    throw new Error("Batch channel state is inconsistent");
  }
  return state;
}

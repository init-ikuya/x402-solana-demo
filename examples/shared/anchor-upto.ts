import { createHash } from "node:crypto";
import {
  AccountRole, address, appendTransactionMessageInstructions, createNoopSigner,
  createSolanaRpc, createTransactionMessage, getBase58Encoder,
  getBase64EncodedWireTransaction, getI64Encoder, getProgramDerivedAddress,
  getU64Encoder, partiallySignTransactionMessageWithSigners, pipe,
  setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash,
  type Address, type Instruction, type TransactionSigner,
} from "@solana/kit";

export const UPTO_SCHEME = "upto";
export const ANCHOR_UPTO_PROGRAM = "TzMc42AtPM8FRnzQyfw2MV9qaD1ChAkMMVuW12jiurd";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";

const keyBytes = (key: string) => getBase58Encoder().encode(key);
const readonly = (key: string) => ({ address: address(key), role: AccountRole.READONLY });
const writable = (key: string) => ({ address: address(key), role: AccountRole.WRITABLE });
const signed = (signer: TransactionSigner, writableRole = false) => ({
  address: signer.address,
  role: writableRole ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER,
  signer,
});

export function instructionDiscriminator(name: "open" | "settle" | "refund"): Uint8Array {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export async function channelAddress(payer: string, merchant: string, mint: string, nonce: bigint): Promise<Address> {
  const [channel] = await getProgramDerivedAddress({ programAddress: address(ANCHOR_UPTO_PROGRAM), seeds: [
    new TextEncoder().encode("channel"), keyBytes(payer), keyBytes(merchant), keyBytes(mint), getU64Encoder().encode(nonce),
  ] });
  return channel;
}

export async function tokenAddress(owner: string, mint: string): Promise<Address> {
  const [token] = await getProgramDerivedAddress({ programAddress: address(ASSOCIATED_TOKEN_PROGRAM), seeds: [
    keyBytes(owner), keyBytes(TOKEN_PROGRAM), keyBytes(mint),
  ] });
  return token;
}

export function openData(nonce: bigint, maxAmount: bigint, expiresAt: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(instructionDiscriminator("open"));
  bytes.set(getU64Encoder().encode(nonce), 8);
  bytes.set(getU64Encoder().encode(maxAmount), 16);
  bytes.set(getI64Encoder().encode(expiresAt), 24);
  return bytes;
}

export function settleData(amount: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set(instructionDiscriminator("settle"));
  bytes.set(getU64Encoder().encode(amount), 8);
  return bytes;
}

export async function openInstruction(args: {
  payer: TransactionSigner; feePayer: string; merchant: string; mint: string;
  nonce: bigint; maxAmount: bigint; expiresAt: bigint;
}): Promise<{ instruction: Instruction; channel: Address }> {
  const channel = await channelAddress(args.payer.address, args.merchant, args.mint, args.nonce);
  return { channel, instruction: {
    programAddress: address(ANCHOR_UPTO_PROGRAM),
    accounts: [
      signed(args.payer, true), signed(createNoopSigner(address(args.feePayer)), true),
      readonly(args.merchant), readonly(args.mint),
      writable(await tokenAddress(args.payer.address, args.mint)), writable(channel),
      writable(await tokenAddress(channel, args.mint)), readonly(TOKEN_PROGRAM),
      readonly(ASSOCIATED_TOKEN_PROGRAM), readonly(SYSTEM_PROGRAM),
    ],
    data: openData(args.nonce, args.maxAmount, args.expiresAt),
  } };
}

export async function settleInstruction(args: {
  merchant: TransactionSigner; payer: string; feePayer: string; mint: string; nonce: bigint; amount: bigint;
}): Promise<{ instruction: Instruction; channel: Address }> {
  const channel = await channelAddress(args.payer, args.merchant.address, args.mint, args.nonce);
  return { channel, instruction: {
    programAddress: address(ANCHOR_UPTO_PROGRAM),
    accounts: [
      writable(channel), signed(args.merchant), readonly(args.payer), writable(args.feePayer),
      readonly(args.mint), writable(await tokenAddress(channel, args.mint)),
      writable(await tokenAddress(args.merchant.address, args.mint)),
      writable(await tokenAddress(args.payer, args.mint)), readonly(TOKEN_PROGRAM),
    ],
    data: settleData(args.amount),
  } };
}

export async function refundInstruction(args: {
  payer: TransactionSigner; merchant: string; rentPayer: string; mint: string; nonce: bigint;
}): Promise<{ instruction: Instruction; channel: Address }> {
  const channel = await channelAddress(args.payer.address, args.merchant, args.mint, args.nonce);
  return { channel, instruction: {
    programAddress: address(ANCHOR_UPTO_PROGRAM),
    accounts: [
      writable(channel), signed(args.payer), writable(args.rentPayer), readonly(args.mint),
      writable(await tokenAddress(channel, args.mint)),
      writable(await tokenAddress(args.payer.address, args.mint)), readonly(TOKEN_PROGRAM),
    ],
    data: instructionDiscriminator("refund"),
  } };
}

export async function signedTransaction(instruction: Instruction, feePayer: string, rpcUrl: string): Promise<string> {
  const blockhash = (await createSolanaRpc(rpcUrl).getLatestBlockhash().send()).value;
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    msg => setTransactionMessageFeePayer(address(feePayer), msg),
    msg => setTransactionMessageLifetimeUsingBlockhash(blockhash, msg),
    msg => appendTransactionMessageInstructions([instruction], msg),
  );
  const wire = getBase64EncodedWireTransaction(await partiallySignTransactionMessageWithSigners(message));
  if (Buffer.from(wire, "base64").length > 1232) throw new Error("Anchor upto transaction exceeds Solana packet size");
  return wire;
}

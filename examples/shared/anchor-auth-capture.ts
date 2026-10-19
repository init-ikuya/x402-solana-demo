import {
  AccountRole, address, createNoopSigner, getBase58Encoder, getI64Encoder,
  getProgramDerivedAddress, getU64Encoder, type Address, type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import {
  ANCHOR_UPTO_PROGRAM, ASSOCIATED_TOKEN_PROGRAM, SYSTEM_PROGRAM, TOKEN_PROGRAM,
  instructionDiscriminator, tokenAddress,
} from "./anchor-upto.js";

export const AUTH_CAPTURE_SCHEME = "auth-capture";
export const AUTH_CAPTURE_BINDING = "anchor-auth-capture-escrow-v1";
export const AUTH_CAPTURE_PROGRAM = ANCHOR_UPTO_PROGRAM;

const keyBytes = (key: string) => getBase58Encoder().encode(key);
const ro = (key: string) => ({ address: address(key), role: AccountRole.READONLY });
const rw = (key: string) => ({ address: address(key), role: AccountRole.WRITABLE });
const signed = (signer: TransactionSigner, writable = false) => ({
  address: signer.address,
  role: writable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER,
  signer,
});

export async function paymentAddress(payer: string, nonce: bigint): Promise<Address> {
  const [payment] = await getProgramDerivedAddress({
    programAddress: address(AUTH_CAPTURE_PROGRAM),
    seeds: [new TextEncoder().encode("auth-capture"), keyBytes(payer), getU64Encoder().encode(nonce)],
  });
  return payment;
}

export function authorizeHoldData(nonce: bigint, amount: bigint, captureDeadline: bigint, refundDeadline: bigint): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set(instructionDiscriminator("authorize_hold"));
  bytes.set(getU64Encoder().encode(nonce), 8);
  bytes.set(getU64Encoder().encode(amount), 16);
  bytes.set(getI64Encoder().encode(captureDeadline), 24);
  bytes.set(getI64Encoder().encode(refundDeadline), 32);
  return bytes;
}

export function holdOperationData(type: "capture_hold" | "capture_and_void_hold" | "void_hold" | "reclaim_hold" | "refund_captured", sequence: bigint, amount = 0n): Uint8Array {
  const hasAmount = type === "capture_hold" || type === "capture_and_void_hold" || type === "refund_captured";
  const bytes = new Uint8Array(hasAmount ? 24 : 16);
  bytes.set(instructionDiscriminator(type));
  if (hasAmount) {
    bytes.set(getU64Encoder().encode(amount), 8);
    bytes.set(getU64Encoder().encode(sequence), 16);
  } else bytes.set(getU64Encoder().encode(sequence), 8);
  return bytes;
}

export async function authorizeHoldInstruction(args: {
  payer: TransactionSigner; feePayer: string; merchant: string; mint: string;
  nonce: bigint; amount: bigint; captureDeadline: bigint; refundDeadline: bigint;
}): Promise<{ instruction: Instruction; payment: Address }> {
  const payment = await paymentAddress(args.payer.address, args.nonce);
  return { payment, instruction: {
    programAddress: address(AUTH_CAPTURE_PROGRAM),
    accounts: [
      signed(args.payer, true), signed(createNoopSigner(address(args.feePayer)), true),
      ro(args.merchant), ro(args.mint), rw(await tokenAddress(args.payer.address, args.mint)),
      ro(await tokenAddress(args.merchant, args.mint)), rw(payment),
      rw(await tokenAddress(payment, args.mint)), ro(TOKEN_PROGRAM),
      ro(ASSOCIATED_TOKEN_PROGRAM), ro(SYSTEM_PROGRAM),
    ],
    data: authorizeHoldData(args.nonce, args.amount, args.captureDeadline, args.refundDeadline),
  } };
}

export async function holdOperationInstruction(args: {
  authority: TransactionSigner; payer: string; merchant: string; mint: string; nonce: bigint;
  type: "capture_hold" | "capture_and_void_hold" | "void_hold" | "reclaim_hold" | "refund_captured";
  sequence: bigint; amount?: bigint;
}): Promise<{ instruction: Instruction; payment: Address }> {
  const payment = await paymentAddress(args.payer, args.nonce);
  return { payment, instruction: {
    programAddress: address(AUTH_CAPTURE_PROGRAM),
    accounts: [
      rw(payment), signed(args.authority), ro(args.payer), ro(args.merchant), ro(args.mint),
      rw(await tokenAddress(payment, args.mint)),
      rw(await tokenAddress(args.payer, args.mint)),
      rw(await tokenAddress(args.merchant, args.mint)), ro(TOKEN_PROGRAM),
    ],
    data: holdOperationData(args.type, args.sequence, args.amount),
  } };
}

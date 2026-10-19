import { tokenAddress } from "../../shared/anchor-upto.js";
import { readAuthPayment } from "./auth-capture-operations.js";
import { DEVNET_USDC } from "./constants.js";

type RpcResult<T> = { context: { slot: number }; value: T };

async function rpc<T>(url: string, method: string, params: unknown[], fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`${method} RPC returned HTTP ${response.status}`);
  const body = await response.json() as { result?: T; error?: { message?: string } };
  if (body.error || body.result === undefined) throw new Error(`${method} RPC failed: ${body.error?.message ?? "missing result"}`);
  return body.result;
}

async function wallet(address: string, url: string, fetchImpl: typeof fetch) {
  const tokenAccount = await tokenAddress(address, DEVNET_USDC);
  const [sol, account] = await Promise.all([
    rpc<RpcResult<number>>(url, "getBalance", [address, { commitment: "confirmed" }], fetchImpl),
    rpc<RpcResult<unknown | null>>(url, "getAccountInfo",
      [tokenAccount, { encoding: "base64", commitment: "confirmed" }], fetchImpl),
  ]);
  const token = account.value === null ? null : await rpc<RpcResult<{ amount: string; decimals: number }>>(
    url, "getTokenAccountBalance", [tokenAccount, { commitment: "confirmed" }], fetchImpl);
  if (!Number.isSafeInteger(sol.value) || sol.value < 0 ||
      (token && (!/^\d+$/.test(token.value.amount) || token.value.decimals !== 6))) {
    throw new Error("RPC returned an invalid wallet balance");
  }
  return {
    address, tokenAccount, lamports: String(sol.value),
    usdc: token?.value.amount ?? null,
    slot: Math.max(sol.context.slot, account.context.slot, token?.context.slot ?? 0),
  };
}

/** Read public Devnet account data only. Each RPC result may have a different slot. */
export async function readDemoSnapshot(options: {
  payer: string; merchant: string; rpcUrl: string; paymentId?: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [payer, merchant] = await Promise.all([
    wallet(options.payer, options.rpcUrl, fetchImpl),
    wallet(options.merchant, options.rpcUrl, fetchImpl),
  ]);
  let payment: Record<string, string | boolean | null> | null = null;
  if (options.paymentId) {
    const state = await readAuthPayment(options.paymentId, options.rpcUrl, fetchImpl);
    if (state.payer !== options.payer || state.merchant !== options.merchant || state.mint !== DEVNET_USDC) {
      throw new Error("Payment account does not match the configured demo participants");
    }
    const vaultAccount = await rpc<RpcResult<unknown | null>>(options.rpcUrl, "getAccountInfo",
      [state.vault, { encoding: "base64", commitment: "confirmed" }], fetchImpl);
    const vault = vaultAccount.value === null ? null : await rpc<RpcResult<{ amount: string; decimals: number }>>(
      options.rpcUrl, "getTokenAccountBalance", [state.vault, { commitment: "confirmed" }], fetchImpl);
    if (vault && (!/^\d+$/.test(vault.value.amount) || vault.value.decimals !== 6)) {
      throw new Error("RPC returned an invalid vault balance");
    }
    payment = {
      id: state.id, vault: state.vault, vaultUsdc: vault?.value.amount ?? null,
      funded: state.funded.toString(), captured: state.captured.toString(),
      released: state.released.toString(), refunded: state.refunded.toString(),
      nextOperation: state.nextOperation.toString(), holdClosed: state.holdClosed,
    };
  }
  return { observedAt: new Date().toISOString(), commitment: "confirmed", payer, merchant, payment };
}

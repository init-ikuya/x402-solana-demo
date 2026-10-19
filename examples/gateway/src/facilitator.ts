import express from "express";
import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from "@x402/core/types";
import { BATCH_AMOUNT, DEVNET, DEVNET_USDC, EXACT_AMOUNT, UPTO_MAX_AMOUNT } from "./constants.js";
import { ANCHOR_UPTO_PROGRAM, UPTO_SCHEME } from "../../shared/anchor-upto.js";
import { AUTH_CAPTURE_BINDING, AUTH_CAPTURE_PROGRAM, AUTH_CAPTURE_SCHEME } from "../../shared/anchor-auth-capture.js";

export interface PaymentFacilitator {
  getSupported(): unknown;
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}

export function createFacilitatorApp(facilitator: PaymentFacilitator, payTo: string, feePayer: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/supported", (_request, response) => response.json(facilitator.getSupported()));

  function parseRequest(body: unknown): { paymentPayload: PaymentPayload; paymentRequirements: PaymentRequirements } | null {
    if (!body || typeof body !== "object") return null;
    const request = body as Record<string, unknown>;
    const payload = request.paymentPayload as PaymentPayload | undefined;
    const requirements = request.paymentRequirements as PaymentRequirements | undefined;
    if (request.x402Version !== 2 || payload?.x402Version !== 2 || !requirements || !payload.accepted) return null;
    if (requirements.network !== DEVNET || requirements.asset !== DEVNET_USDC ||
      requirements.payTo !== payTo || requirements.extra?.feePayer !== feePayer) return null;
    const accepted = payload.accepted;
    if (accepted.scheme !== requirements.scheme || accepted.network !== requirements.network ||
      accepted.asset !== requirements.asset || accepted.payTo !== requirements.payTo ||
      accepted.extra?.feePayer !== feePayer) return null;
    if (requirements.scheme === "exact") {
      if (requirements.amount !== EXACT_AMOUNT || accepted.amount !== EXACT_AMOUNT ||
        typeof payload.payload?.transaction !== "string") return null;
    } else if (requirements.scheme === UPTO_SCHEME) {
      if (accepted.amount !== UPTO_MAX_AMOUNT ||
          !/^\d+$/.test(requirements.amount) || BigInt(requirements.amount) > BigInt(UPTO_MAX_AMOUNT) ||
          requirements.extra?.programId !== ANCHOR_UPTO_PROGRAM ||
          accepted.extra?.programId !== ANCHOR_UPTO_PROGRAM ||
          requirements.maxTimeoutSeconds !== 300 || accepted.maxTimeoutSeconds !== 300 ||
          typeof payload.payload?.openTransaction !== "string") return null;
    } else if (requirements.scheme === "batch-settlement") {
      if (!/^\d+$/.test(requirements.amount) || BigInt(requirements.amount) > BigInt(BATCH_AMOUNT) ||
          !/^\d+$/.test(accepted.amount) || BigInt(accepted.amount) > BigInt(BATCH_AMOUNT) ||
          requirements.extra?.assetTransferMethod !== "channel" ||
          accepted.extra?.assetTransferMethod !== "channel" ||
          ![undefined, "authorization"].includes(requirements.extra?.paymentFlow as string | undefined) ||
          ![undefined, "authorization"].includes(accepted.extra?.paymentFlow as string | undefined) ||
          requirements.extra?.voucherSigner !== "client" || accepted.extra?.voucherSigner !== "client" ||
          typeof payload.payload?.type !== "string") return null;
    } else if (requirements.scheme === AUTH_CAPTURE_SCHEME) {
      if (accepted.amount !== "1000" || !/^\d+$/.test(requirements.amount) ||
          BigInt(requirements.amount) > 1000n ||
          requirements.extra?.programId !== AUTH_CAPTURE_PROGRAM ||
          accepted.extra?.programId !== AUTH_CAPTURE_PROGRAM ||
          requirements.extra?.binding !== AUTH_CAPTURE_BINDING ||
          accepted.extra?.binding !== AUTH_CAPTURE_BINDING ||
          requirements.extra?.assetTransferMethod !== "escrow" ||
          accepted.extra?.assetTransferMethod !== "escrow" ||
          requirements.extra?.paymentFlow !== "escrow" ||
          accepted.extra?.paymentFlow !== "escrow" ||
          requirements.extra?.captureDeadline !== accepted.extra?.captureDeadline ||
          requirements.extra?.refundDeadline !== accepted.extra?.refundDeadline ||
          typeof requirements.extra?.captureDeadline !== "string" ||
          typeof requirements.extra?.refundDeadline !== "string" ||
          requirements.maxTimeoutSeconds !== 300 || accepted.maxTimeoutSeconds !== 300 ||
          typeof payload.payload?.authorizeTransaction !== "string") return null;
    } else return null;
    return { paymentPayload: payload, paymentRequirements: requirements };
  }

  app.post("/verify", async (request, response) => {
    const input = parseRequest(request.body);
    if (!input) return response.status(400).json({ isValid: false, invalidReason: "unsupported_payment" });
    try {
      return response.json(await facilitator.verify(input.paymentPayload, input.paymentRequirements));
    } catch {
      return response.status(400).json({ isValid: false, invalidReason: "verification_failed" });
    }
  });

  app.post("/settle", async (request, response) => {
    const input = parseRequest(request.body);
    if (!input) return response.status(400).json({ success: false, network: DEVNET, transaction: "", errorReason: "unsupported_payment" });
    try {
      return response.json(await facilitator.settle(input.paymentPayload, input.paymentRequirements));
    } catch {
      return response.status(400).json({ success: false, network: DEVNET, transaction: "", errorReason: "settlement_failed" });
    }
  });

  return app;
}

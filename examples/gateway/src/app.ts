import express from "express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware, setSettlementOverrides } from "@x402/express";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { BatchSvmScheme } from "@x402/svm/batch-settlement/server";
import type { TransactionSigner } from "@solana/kit";
import { DEVNET, UPTO_ACTUAL_AMOUNT } from "./constants.js";
import { AUTH_CAPTURE_RESOURCE_PATH, BATCH_RESOURCE_PATH, DEMO_RESOURCE_DESCRIPTION, DEMO_RESOURCE_PATH, UPTO_RESOURCE_PATH, getDemoResource } from "./demo-resource.js";
import { AnchorUptoServerScheme } from "./anchor-upto-server.js";
import { AnchorAuthCaptureServerScheme } from "./anchor-auth-capture-server.js";

export { DEVNET } from "./constants.js";

export interface GatewayConfig {
  payTo: string;
  facilitatorUrl: string;
  anchorMerchantSigner?: TransactionSigner;
  anchorRpcUrl?: string;
  batchScheme?: BatchSvmScheme;
  authCaptureMerchantSigner?: TransactionSigner;
}

export function createApp(config: GatewayConfig) {
  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    DEVNET,
    new ExactSvmScheme(),
  );
  if (config.anchorMerchantSigner) {
    if (config.anchorMerchantSigner.address !== config.payTo || !config.anchorRpcUrl) {
      throw new Error("Anchor upto requires the merchant key and RPC URL");
    }
    resourceServer.register(DEVNET, new AnchorUptoServerScheme(config.anchorMerchantSigner, config.anchorRpcUrl));
  }
  if (config.batchScheme) resourceServer.register(DEVNET, config.batchScheme);
  if (config.authCaptureMerchantSigner) {
    if (config.authCaptureMerchantSigner.address !== config.payTo || !config.anchorRpcUrl) {
      throw new Error("Anchor auth-capture requires the merchant key and RPC URL");
    }
    resourceServer.register(DEVNET, new AnchorAuthCaptureServerScheme(config.authCaptureMerchantSigner, config.anchorRpcUrl));
  }

  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(
    paymentMiddleware(
      {
        [`GET ${DEMO_RESOURCE_PATH}`]: {
          accepts: {
            scheme: "exact",
            network: DEVNET,
            price: "$0.001",
            payTo: config.payTo,
          },
          description: DEMO_RESOURCE_DESCRIPTION,
          mimeType: "application/json",
        },
        ...(config.anchorMerchantSigner ? {
          [`GET ${UPTO_RESOURCE_PATH}`]: {
            accepts: {
              scheme: "upto",
              network: DEVNET,
              price: "$0.001",
              payTo: config.payTo,
              maxTimeoutSeconds: 300,
            },
            description: DEMO_RESOURCE_DESCRIPTION,
            mimeType: "application/json",
          },
        } : {}),
        ...(config.batchScheme ? {
          [`GET ${BATCH_RESOURCE_PATH}`]: {
            accepts: {
              scheme: "batch-settlement",
              network: DEVNET,
              price: "$0.001",
              payTo: config.payTo,
              maxTimeoutSeconds: 300,
              extra: { voucherSigner: "client", assetTransferMethod: "channel", paymentFlow: "authorization" },
            },
            description: DEMO_RESOURCE_DESCRIPTION,
            mimeType: "application/json",
          },
        } : {}),
        ...(config.authCaptureMerchantSigner ? {
          [`GET ${AUTH_CAPTURE_RESOURCE_PATH}`]: {
            accepts: {
              scheme: "auth-capture",
              network: DEVNET,
              price: "$0.001",
              payTo: config.payTo,
              maxTimeoutSeconds: 300,
              extra: { assetTransferMethod: "escrow", paymentFlow: "escrow" },
            },
            description: DEMO_RESOURCE_DESCRIPTION,
            mimeType: "application/json",
          },
        } : {}),
      },
      resourceServer,
    ),
  );

  app.get(DEMO_RESOURCE_PATH, (_request, response) => {
    response.json(getDemoResource());
  });
  if (config.anchorMerchantSigner) {
    app.get(UPTO_RESOURCE_PATH, (_request, response) => {
      setSettlementOverrides(response, { amount: UPTO_ACTUAL_AMOUNT });
      response.json(getDemoResource());
    });
  }
  if (config.batchScheme) app.get(BATCH_RESOURCE_PATH, (_request, response) => response.json(getDemoResource()));
  if (config.authCaptureMerchantSigner) {
    app.get(AUTH_CAPTURE_RESOURCE_PATH, (_request, response) => {
      setSettlementOverrides(response, { amount: UPTO_ACTUAL_AMOUNT });
      response.json(getDemoResource());
    });
  }

  return app;
}

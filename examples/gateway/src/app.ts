import express from "express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware, setSettlementOverrides } from "@x402/express";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import type { TransactionSigner } from "@solana/kit";
import { DEVNET, UPTO_ACTUAL_AMOUNT } from "./constants.js";
import { DEMO_RESOURCE_DESCRIPTION, DEMO_RESOURCE_PATH, UPTO_RESOURCE_PATH, getDemoResource } from "./demo-resource.js";
import { AnchorUptoServerScheme } from "./anchor-upto-server.js";

export { DEVNET } from "./constants.js";

export interface GatewayConfig {
  payTo: string;
  facilitatorUrl: string;
  anchorMerchantSigner?: TransactionSigner;
  anchorRpcUrl?: string;
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

  return app;
}

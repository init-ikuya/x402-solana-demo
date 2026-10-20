import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements, SupportedResponse } from "@x402/core/types";

export class RoutedFacilitatorClient implements FacilitatorClient {
  readonly #local: HTTPFacilitatorClient;
  readonly #exact: HTTPFacilitatorClient;

  constructor(localUrl: string, exactUrl?: string) {
    this.#local = new HTTPFacilitatorClient({ url: localUrl });
    this.#exact = exactUrl ? new HTTPFacilitatorClient({ url: exactUrl }) : this.#local;
  }

  #client(requirements: PaymentRequirements): HTTPFacilitatorClient {
    return requirements.scheme === "exact" ? this.#exact : this.#local;
  }

  verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.#client(requirements).verify(payload, requirements);
  }

  settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.#client(requirements).settle(payload, requirements);
  }

  async getSupported(): Promise<SupportedResponse> {
    if (this.#local === this.#exact) return this.#local.getSupported();
    const [local, exact] = await Promise.all([this.#local.getSupported(), this.#exact.getSupported()]);
    return {
      kinds: [
        ...local.kinds.filter(kind => kind.scheme !== "exact"),
        ...exact.kinds.filter(kind => kind.scheme === "exact"),
      ],
      extensions: [...new Set([...local.extensions, ...exact.extensions])],
      signers: Object.fromEntries(Object.keys({ ...local.signers, ...exact.signers }).map(network => [
        network, [...new Set([...(local.signers[network] ?? []), ...(exact.signers[network] ?? [])])],
      ])),
    };
  }
}

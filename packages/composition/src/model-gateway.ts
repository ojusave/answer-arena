import type { ModelGateway } from "@ragtime/core";
import { createOpenRouterGateway } from "@ragtime/gateway-openrouter";

type ModelGatewayFactory = () => ModelGateway;

const factories: Record<string, ModelGatewayFactory> = {
  openrouter: createOpenRouterGateway,
};

/** Shared composition root for every process that needs a model gateway. */
export function createModelGateway(
  provider = process.env.MODEL_GATEWAY ?? "openrouter"
): ModelGateway {
  const factory = factories[provider];
  if (!factory) {
    throw new Error(
      `Unknown MODEL_GATEWAY "${provider}". Available: ${Object.keys(factories).join(", ")}`
    );
  }
  return factory();
}

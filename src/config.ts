import { FireworksClient } from "./providers/fireworks.js";
import { OpenRouterClient } from "./providers/openrouter.js";

export type InferenceProvider = "fireworks" | "openrouter";

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function nonNegativeInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

export interface AgentEnvironment {
  provider: InferenceProvider;
  fireworksApiKey?: string;
  fireworksModel: string;
  openRouterApiKey?: string;
  openRouterModel: string;
  openRouterSiteUrl?: string;
  openRouterAppName?: string;
  maxSteps: number;
  timeoutMs: number;
  maxRetries: number;
}

export function loadAgentEnvironment(env: NodeJS.ProcessEnv = process.env): AgentEnvironment {
  const providerValue = env.MURMUR_PROVIDER?.trim().toLowerCase() || "fireworks";
  if (providerValue !== "fireworks" && providerValue !== "openrouter") {
    throw new Error('MURMUR_PROVIDER must be either "fireworks" or "openrouter"');
  }
  const fireworksApiKey = env.FIREWORKS_API_KEY?.trim();
  const openRouterApiKey = env.OPENROUTER_API_KEY?.trim();
  if (providerValue === "fireworks" && !fireworksApiKey) throw new Error("FIREWORKS_API_KEY is required when MURMUR_PROVIDER=fireworks");
  if (providerValue === "openrouter" && !openRouterApiKey) throw new Error("OPENROUTER_API_KEY is required when MURMUR_PROVIDER=openrouter");
  const config: AgentEnvironment = {
    provider: providerValue,
    fireworksModel: env.FIREWORKS_MODEL?.trim() || "accounts/fireworks/models/kimi-k2-instruct-0905",
    openRouterModel: env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4.5",
    maxSteps: positiveInteger(env.MURMUR_MAX_STEPS, 12, "MURMUR_MAX_STEPS"),
    timeoutMs: positiveInteger(env.MURMUR_REQUEST_TIMEOUT_MS, 120_000, "MURMUR_REQUEST_TIMEOUT_MS"),
    maxRetries: nonNegativeInteger(env.MURMUR_MAX_RETRIES, 2, "MURMUR_MAX_RETRIES"),
  };
  if (fireworksApiKey) config.fireworksApiKey = fireworksApiKey;
  if (openRouterApiKey) config.openRouterApiKey = openRouterApiKey;
  if (env.OPENROUTER_SITE_URL?.trim()) config.openRouterSiteUrl = env.OPENROUTER_SITE_URL.trim();
  if (env.OPENROUTER_APP_NAME?.trim()) config.openRouterAppName = env.OPENROUTER_APP_NAME.trim();
  return config;
}

export function createModel(config: AgentEnvironment) {
  if (config.provider === "fireworks") {
    if (!config.fireworksApiKey) throw new Error("Fireworks API key is missing");
    return new FireworksClient({
      apiKey: config.fireworksApiKey,
      model: config.fireworksModel,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
  }
  if (!config.openRouterApiKey) throw new Error("OpenRouter API key is missing");
  return new OpenRouterClient({
    apiKey: config.openRouterApiKey,
    model: config.openRouterModel,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    ...(config.openRouterSiteUrl ? { siteUrl: config.openRouterSiteUrl } : {}),
    ...(config.openRouterAppName ? { appName: config.openRouterAppName } : {}),
  });
}

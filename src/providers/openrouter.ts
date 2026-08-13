import type { JsonObject } from "../types.js";
import { OpenAICompatibleClient, type OpenAICompatibleOptions } from "./openai-compatible.js";

export interface OpenRouterOptions
  extends Omit<OpenAICompatibleOptions, "provider" | "baseUrl" | "defaultHeaders" | "defaultBody"> {
  baseUrl?: string;
  siteUrl?: string;
  appName?: string;
  requireParameters?: boolean;
  dataCollection?: "allow" | "deny";
}

export class OpenRouterClient extends OpenAICompatibleClient {
  constructor(options: OpenRouterOptions) {
    const headers: Record<string, string> = { "X-OpenRouter-Metadata": "enabled" };
    if (options.siteUrl) headers["HTTP-Referer"] = options.siteUrl;
    if (options.appName) headers["X-OpenRouter-Title"] = options.appName;

    const provider: JsonObject = {
      require_parameters: options.requireParameters ?? true,
      data_collection: options.dataCollection ?? "deny",
    };
    super({
      ...options,
      provider: "openrouter",
      baseUrl: options.baseUrl ?? "https://openrouter.ai/api/v1",
      defaultHeaders: headers,
      defaultBody: { provider },
    });
  }
}

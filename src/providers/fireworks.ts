import { OpenAICompatibleClient, type OpenAICompatibleOptions } from "./openai-compatible.js";

export interface FireworksOptions
  extends Omit<OpenAICompatibleOptions, "provider" | "baseUrl" | "defaultHeaders"> {
  baseUrl?: string;
}

export class FireworksClient extends OpenAICompatibleClient {
  constructor(options: FireworksOptions) {
    super({
      ...options,
      provider: "fireworks",
      baseUrl: options.baseUrl ?? "https://api.fireworks.ai/inference/v1",
    });
  }
}

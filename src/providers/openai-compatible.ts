import type {
  ChatMessage,
  ChatModel,
  ChatRequest,
  ChatResponse,
  JsonObject,
  TokenUsage,
  ToolCall,
} from "../types.js";

export class InferenceError extends Error {
  readonly provider: string;
  readonly status: number | undefined;
  readonly retriable: boolean;

  constructor(
    message: string,
    options: { provider: string; status?: number; retriable?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "InferenceError";
    this.provider = options.provider;
    this.status = options.status;
    this.retriable = options.retriable ?? false;
  }
}

interface ApiMessage {
  role?: unknown;
  content?: unknown;
  reasoning_content?: unknown;
  tool_calls?: unknown;
}

interface ApiResponse {
  id?: unknown;
  model?: unknown;
  choices?: unknown;
  usage?: unknown;
}

export interface OpenAICompatibleOptions {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  defaultBody?: JsonObject;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseToolCalls(value: unknown, provider: string): ToolCall[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new InferenceError("Provider returned invalid tool_calls", { provider });

  return value.map((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.function)) {
      throw new InferenceError(`Provider returned invalid tool call at index ${index}`, { provider });
    }
    const id = raw.id;
    const name = raw.function.name;
    const args = raw.function.arguments;
    if (typeof id !== "string" || typeof name !== "string" || typeof args !== "string") {
      throw new InferenceError(`Provider returned incomplete tool call at index ${index}`, { provider });
    }
    return { id, type: "function", function: { name, arguments: args } };
  });
}

function parseUsage(value: unknown): TokenUsage | undefined {
  if (!isRecord(value)) return undefined;
  const prompt = value.prompt_tokens;
  const completion = value.completion_tokens;
  const total = value.total_tokens;
  if (typeof prompt !== "number" || typeof completion !== "number" || typeof total !== "number") {
    return undefined;
  }
  return { promptTokens: prompt, completionTokens: completion, totalTokens: total };
}

function abortSignal(parent: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Inference request timed out")), timeoutMs);
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", onAbort, { once: true });
  if (parent?.aborted) onAbort();

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

function retryDelay(response: Response | undefined, attempt: number): number {
  const header = response?.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 30_000);
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.min(Math.max(at - Date.now(), 0), 30_000);
  }
  return Math.min(500 * 2 ** attempt, 8_000);
}

function safeErrorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    const error = body.error;
    if (typeof error === "string") return error;
    if (isRecord(error) && typeof error.message === "string") return error.message;
    if (typeof body.message === "string") return body.message;
  }
  return `Inference request failed with HTTP ${status}`;
}

export class OpenAICompatibleClient implements ChatModel {
  readonly provider: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly defaultBody: JsonObject;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly sleepFn: (milliseconds: number) => Promise<void>;

  constructor(options: OpenAICompatibleOptions) {
    if (!options.apiKey.trim()) throw new Error(`${options.provider} API key is required`);
    this.provider = options.provider;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.endpoint = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
    this.headers = options.defaultHeaders ?? {};
    this.defaultBody = options.defaultBody ?? {};
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.sleepFn = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async complete(request: ChatRequest): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      ...this.defaultBody,
      model: this.model,
      messages: request.messages,
      stream: false,
    };
    if (request.tools?.length) body.tools = request.tools;
    if (request.toolChoice) body.tool_choice = request.toolChoice;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;

    let lastError: InferenceError | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const scoped = abortSignal(request.signal, this.timeoutMs);
      let response: Response | undefined;
      try {
        response = await this.fetchFn(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...this.headers,
          },
          body: JSON.stringify(body),
          signal: scoped.signal,
        });

        const parsed = (await response.json().catch(() => undefined)) as ApiResponse | undefined;
        if (!response.ok) {
          const retriable = response.status === 408 || response.status === 429 || response.status >= 500;
          throw new InferenceError(safeErrorMessage(parsed, response.status), {
            provider: this.provider,
            status: response.status,
            retriable,
          });
        }
        return this.parseResponse(parsed);
      } catch (error) {
        const normalized =
          error instanceof InferenceError
            ? error
            : new InferenceError(
                scoped.signal.aborted ? "Inference request was aborted or timed out" : "Inference network request failed",
                { provider: this.provider, retriable: !request.signal?.aborted, cause: error },
              );
        lastError = normalized;
        if (!normalized.retriable || attempt === this.maxRetries || request.signal?.aborted) throw normalized;
        await this.sleepFn(retryDelay(response, attempt));
      } finally {
        scoped.cleanup();
      }
    }
    throw lastError ?? new InferenceError("Inference request failed", { provider: this.provider });
  }

  private parseResponse(raw: ApiResponse | undefined): ChatResponse {
    if (!raw || !Array.isArray(raw.choices) || raw.choices.length === 0) {
      throw new InferenceError("Provider returned no completion choices", { provider: this.provider });
    }
    const choice = raw.choices[0];
    if (!isRecord(choice) || !isRecord(choice.message)) {
      throw new InferenceError("Provider returned an invalid completion choice", { provider: this.provider });
    }
    const message = choice.message as ApiMessage;
    if (message.content !== null && typeof message.content !== "string" && message.content !== undefined) {
      throw new InferenceError("Provider returned invalid assistant content", { provider: this.provider });
    }
    const assistant: Extract<ChatMessage, { role: "assistant" }> = {
      role: "assistant",
      content: typeof message.content === "string" ? message.content : null,
    };
    const toolCalls = parseToolCalls(message.tool_calls, this.provider);
    if (toolCalls) assistant.tool_calls = toolCalls;
    if (typeof message.reasoning_content === "string") assistant.reasoning_content = message.reasoning_content;

    const response: ChatResponse = {
      id: typeof raw.id === "string" ? raw.id : "unknown",
      model: typeof raw.model === "string" ? raw.model : this.model,
      message: assistant,
      finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
      provider: this.provider,
    };
    const usage = parseUsage(raw.usage);
    if (usage) response.usage = usage;
    return response;
  }
}

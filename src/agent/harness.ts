import { createHash } from "node:crypto";
import type {
  AgentProgressEvent,
  AgentRunResult,
  AgentTraceEntry,
  ChatMessage,
  ChatModel,
  ChatRequest,
  JsonObject,
  JsonValue,
  ReviewDecision,
  ReviewEvent,
  TokenUsage,
  ToolDefinition,
} from "../types.js";
import { eventPrompt, SYSTEM_PROMPT } from "./prompt.js";
import { validateJsonSchema } from "./schema.js";
import { createFinishTool, type AgentTool } from "./tools.js";

export class AgentRunError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgentRunError";
  }
}

export interface AgentHarnessOptions {
  model: ChatModel;
  tools: AgentTool[];
  maxSteps?: number;
  maxRepeatedToolCall?: number;
  maxToolResultChars?: number;
  temperature?: number;
  maxTokens?: number;
  onProgress?: (event: AgentProgressEvent) => void | Promise<void>;
}

function toolDefinition(tool: AgentTool): ToolDefinition {
  return {
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  };
}

function parseArguments(raw: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Tool arguments are not valid JSON", { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return parsed as JsonObject;
}

function serializeToolResult(value: JsonValue, maxChars: number): string {
  const serialized = JSON.stringify({ ok: true, result: value });
  if (serialized.length <= maxChars) return serialized;
  return JSON.stringify({
    ok: true,
    truncated: true,
    originalCharacters: serialized.length,
    result: serialized.slice(0, maxChars),
  });
}

function serializeToolError(error: unknown): string {
  return JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown tool error",
  });
}

function addUsage(total: TokenUsage, next: TokenUsage | undefined): void {
  if (!next) return;
  total.promptTokens += next.promptTokens;
  total.completionTokens += next.completionTokens;
  total.totalTokens += next.totalTokens;
}

function validateEvent(event: ReviewEvent): void {
  if (!event.id || !event.repository || !event.title || !event.description || !event.occurredAt) {
    throw new AgentRunError("Event requires id, repository, title, description, and occurredAt");
  }
  if (!Number.isNaN(Date.parse(event.occurredAt))) return;
  throw new AgentRunError("Event occurredAt must be an ISO-8601 date");
}

export class AgentHarness {
  private readonly options: Required<
    Pick<AgentHarnessOptions, "maxSteps" | "maxRepeatedToolCall" | "maxToolResultChars" | "temperature" | "maxTokens">
  > &
    AgentHarnessOptions;

  constructor(options: AgentHarnessOptions) {
    const names = options.tools.map((tool) => tool.name);
    if (new Set(names).size !== names.length) throw new Error("Agent tool names must be unique");
    if (names.includes("finish_review")) throw new Error("finish_review is reserved by the harness");
    this.options = {
      ...options,
      maxSteps: options.maxSteps ?? 12,
      maxRepeatedToolCall: options.maxRepeatedToolCall ?? 3,
      maxToolResultChars: options.maxToolResultChars ?? 60_000,
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 4_000,
    };
  }

  async run(event: ReviewEvent, signal?: AbortSignal): Promise<AgentRunResult> {
    validateEvent(event);
    let decision: ReviewDecision | undefined;
    const finishTool = createFinishTool((value) => {
      decision = value;
    });
    const tools = [...this.options.tools, finishTool];
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    const definitions = tools.map(toolDefinition);
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: eventPrompt(event) },
    ];
    const trace: AgentTraceEntry[] = [];
    const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const callCounts = new Map<string, number>();

    for (let step = 1; step <= this.options.maxSteps; step += 1) {
      if (signal?.aborted) throw new AgentRunError("Agent run aborted", { cause: signal.reason });
      await this.emit({
        type: "model_start",
        step,
        provider: this.options.model.provider,
        model: this.options.model.model,
      });
      const modelStarted = Date.now();
      const request: ChatRequest = {
        messages,
        tools: definitions,
        toolChoice: "auto",
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
      };
      const response = await this.options.model.complete(signal ? { ...request, signal } : request);
      addUsage(usage, response.usage);
      const toolCalls = response.message.tool_calls ?? [];
      trace.push({
        step,
        kind: "model",
        name: `${response.provider}:${response.model}`,
        summary: toolCalls.length ? `Requested ${toolCalls.map((call) => call.function.name).join(", ")}` : "Returned text",
        durationMs: Date.now() - modelStarted,
      });
      await this.emit({ type: "model_end", step, finishReason: response.finishReason, toolCount: toolCalls.length });
      messages.push(response.message);

      if (toolCalls.length === 0) {
        messages.push({
          role: "user",
          content:
            "You have not finished the run. Use available tools if more evidence is needed, or call finish_review with the best evidence-grounded decision now.",
        });
        continue;
      }

      for (const call of toolCalls) {
        const started = Date.now();
        const tool = toolMap.get(call.function.name);
        let args: JsonObject = {};
        let ok = false;
        let result: string;
        try {
          args = parseArguments(call.function.arguments);
          const fingerprint = createHash("sha256")
            .update(`${call.function.name}:${JSON.stringify(args)}`)
            .digest("hex");
          const count = (callCounts.get(fingerprint) ?? 0) + 1;
          callCounts.set(fingerprint, count);
          if (count > this.options.maxRepeatedToolCall) {
            throw new Error(`Repeated identical tool call limit exceeded for ${call.function.name}`);
          }
          if (!tool) throw new Error(`Unknown tool: ${call.function.name}`);
          validateJsonSchema(args, tool.parameters);
          await this.emit({ type: "tool_start", step, name: tool.name, callId: call.id, arguments: args });
          result = serializeToolResult(await tool.execute(args, signal), this.options.maxToolResultChars);
          ok = true;
        } catch (error) {
          result = serializeToolError(error);
        }
        trace.push({
          step,
          kind: "tool",
          name: call.function.name,
          summary: ok ? "Completed" : `Failed: ${JSON.parse(result).error as string}`,
          durationMs: Date.now() - started,
        });
        await this.emit({ type: "tool_end", step, name: call.function.name, callId: call.id, ok });
        messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: result });
      }

      if (decision) {
        await this.emit({ type: "decision", step, decision });
        return { event, decision, trace, usage };
      }
    }
    throw new AgentRunError(`Agent did not call finish_review within ${this.options.maxSteps} model steps`);
  }

  private async emit(event: AgentProgressEvent): Promise<void> {
    await this.options.onProgress?.(event);
  }
}

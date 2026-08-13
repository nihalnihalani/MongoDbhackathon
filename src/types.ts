export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
      reasoning_content?: string | null;
    }
  | { role: "tool"; content: string; tool_call_id: string; name?: string };

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: JsonPrimitive[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  [key: string]: unknown;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  message: Extract<ChatMessage, { role: "assistant" }>;
  finishReason: string | null;
  usage?: TokenUsage;
  provider: "fireworks" | "openrouter" | string;
}

export interface ChatModel {
  readonly provider: string;
  readonly model: string;
  complete(request: ChatRequest): Promise<ChatResponse>;
}

export type ReviewEventType =
  | "pull_request_opened"
  | "pull_request_updated"
  | "pull_request_merged"
  | "ci_failed"
  | "deployment_failed"
  | "incident_reported";

export interface ReviewEvent {
  id: string;
  type: ReviewEventType;
  repository: string;
  occurredAt: string;
  contributor?: string;
  pullRequestNumber?: number;
  title: string;
  description: string;
  metadata?: JsonObject;
}

export type ReviewAction = "approve" | "comment" | "block" | "investigate" | "no_action";
export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface ReviewFinding {
  severity: FindingSeverity;
  title: string;
  details: string;
  evidence: string[];
}

export interface CredibilityUpdate {
  contributor: string;
  previousScore: number | null;
  proposedScore: number;
  rationale: string;
  evidence: string[];
}

export interface MemoryProposal {
  subject: string;
  kind: "contributor" | "code" | "incident" | "agent_experience";
  summary: string;
  evidence: string[];
  confidence: number;
}

export interface ReviewDecision {
  action: ReviewAction;
  confidence: number;
  summary: string;
  findings: ReviewFinding[];
  credibilityUpdate: CredibilityUpdate | null;
  memoriesToStore: MemoryProposal[];
  selfAssessment: string | null;
}

export interface LearningCommitResult {
  applied: boolean;
  eventId: string;
  credibilityUpdated: boolean;
  memoriesStored: number;
}

/** Durable learning boundary. MongoDB and local JSON stores can implement the same contract. */
export interface AgentLearningStore {
  commitLearning(
    event: ReviewEvent,
    decision: ReviewDecision,
    signal?: AbortSignal,
  ): Promise<LearningCommitResult>;
}

export interface AgentTraceEntry {
  step: number;
  kind: "model" | "tool";
  name: string;
  summary: string;
  durationMs: number;
}

export interface AgentRunResult {
  event: ReviewEvent;
  decision: ReviewDecision;
  trace: AgentTraceEntry[];
  usage: TokenUsage;
  learning?: LearningCommitResult;
}

export type AgentProgressEvent =
  | { type: "model_start"; step: number; provider: string; model: string }
  | { type: "model_end"; step: number; finishReason: string | null; toolCount: number }
  | { type: "tool_start"; step: number; name: string; callId: string; arguments: JsonObject }
  | { type: "tool_end"; step: number; name: string; callId: string; ok: boolean }
  | { type: "decision"; step: number; decision: ReviewDecision }
  | { type: "learning_committed"; step: number; result: LearningCommitResult };

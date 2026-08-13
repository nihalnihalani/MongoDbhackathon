import assert from "node:assert/strict";
import test from "node:test";
import { AgentHarness, AgentRunError } from "../src/agent/harness.js";
import type { AgentTool } from "../src/agent/tools.js";
import type { ChatModel, ChatRequest, ChatResponse, JsonObject, ReviewEvent } from "../src/types.js";

const event: ReviewEvent = {
  id: "event-1",
  type: "pull_request_opened",
  repository: "acme/api",
  occurredAt: "2026-08-13T20:00:00Z",
  contributor: "kevin",
  pullRequestNumber: 481,
  title: "Change auth",
  description: "Updates session expiry logic",
};

const finalDecision: JsonObject = {
  action: "block",
  confidence: 0.92,
  summary: "The new comparison accepts expired sessions.",
  findings: [
    {
      severity: "critical",
      title: "Expired session accepted",
      details: "TTL is compared to elapsed time with the wrong boundary.",
      evidence: ["PR #481 diff", "incident-88"],
    },
  ],
  credibilityUpdate: {
    contributor: "kevin",
    previousScore: 46,
    proposedScore: 32,
    rationale: "A confirmed authentication defect repeats a prior failure mode.",
    evidence: ["PR #481 diff"],
  },
  memoriesToStore: [
    {
      subject: "src/auth/session.ts",
      kind: "code",
      summary: "Session expiry boundaries require explicit tests.",
      evidence: ["PR #481"],
      confidence: 0.95,
    },
  ],
  selfAssessment: null,
};

class ScriptedModel implements ChatModel {
  readonly provider = "test";
  readonly model = "scripted";
  readonly requests: ChatRequest[] = [];
  private index = 0;

  constructor(private readonly responses: ChatResponse[]) {}

  async complete(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    const response = this.responses[this.index++];
    if (!response) throw new Error("No scripted response");
    return response;
  }
}

function toolResponse(name: string, args: JsonObject, step: number): ChatResponse {
  return {
    id: `response-${step}`,
    model: "scripted",
    provider: "test",
    finishReason: "tool_calls",
    message: {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: `call-${step}`,
          type: "function",
          function: { name, arguments: JSON.stringify(args) },
        },
      ],
    },
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };
}

test("agent chooses tools, receives evidence, and returns a validated decision", async () => {
  const dataTool: AgentTool = {
    name: "get_pull_request_diff",
    description: "Get diff",
    parameters: { type: "object" },
    async execute() {
      return { patch: "return expiresAt >= Date.now()" };
    },
  };
  const model = new ScriptedModel([
    toolResponse("get_pull_request_diff", { repository: "acme/api", pullRequestNumber: 481 }, 1),
    toolResponse("finish_review", finalDecision, 2),
  ]);
  const progress: string[] = [];
  const harness = new AgentHarness({
    model,
    tools: [dataTool],
    onProgress: (item) => {
      progress.push(item.type);
    },
  });

  const result = await harness.run(event);

  assert.equal(result.decision.action, "block");
  assert.equal(result.trace.filter((item) => item.kind === "tool").length, 2);
  assert.deepEqual(result.usage, { promptTokens: 20, completionTokens: 10, totalTokens: 30 });
  const secondRequestMessages = model.requests[1]?.messages ?? [];
  assert.ok(secondRequestMessages.some((message) => message.role === "tool" && message.content.includes("expiresAt")));
  assert.ok(progress.includes("decision"));
});

test("tool failures are returned to the model so it can recover", async () => {
  const model = new ScriptedModel([
    {
      ...toolResponse("missing_tool", {}, 1),
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "bad-call", type: "function", function: { name: "missing_tool", arguments: "not-json" } },
        ],
      },
    },
    toolResponse("finish_review", finalDecision, 2),
  ]);
  const harness = new AgentHarness({ model, tools: [] });

  const result = await harness.run(event);

  assert.equal(result.decision.action, "block");
  const recoveryRequest = model.requests[1];
  assert.ok(recoveryRequest?.messages.some((message) => message.role === "tool" && message.content.includes("not valid JSON")));
});

test("validates tool arguments locally before executing an adapter", async () => {
  let executions = 0;
  const protectedTool: AgentTool = {
    name: "read_file",
    description: "Read a file",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute() {
      executions += 1;
      return { content: "secret" };
    },
  };
  const model = new ScriptedModel([
    toolResponse("read_file", { unexpected: "value" }, 1),
    toolResponse("finish_review", finalDecision, 2),
  ]);

  await new AgentHarness({ model, tools: [protectedTool] }).run(event);

  assert.equal(executions, 0);
  assert.ok(model.requests[1]?.messages.some((message) => message.role === "tool" && message.content.includes("is required")));
});

test("fails boundedly if the model never finishes", async () => {
  const textResponse: ChatResponse = {
    id: "text",
    model: "scripted",
    provider: "test",
    finishReason: "stop",
    message: { role: "assistant", content: "I am done" },
  };
  const model = new ScriptedModel([textResponse, textResponse]);
  const harness = new AgentHarness({ model, tools: [], maxSteps: 2 });

  await assert.rejects(harness.run(event), AgentRunError);
});

test("commits learning after a successful decision", async () => {
  const model = new ScriptedModel([toolResponse("finish_review", finalDecision, 1)]);
  const commits: string[] = [];
  const harness = new AgentHarness({
    model,
    tools: [],
    learningStore: {
      async commitLearning(committedEvent, decision) {
        commits.push(`${committedEvent.id}:${decision.action}`);
        return {
          applied: true,
          eventId: committedEvent.id,
          credibilityUpdated: true,
          memoriesStored: decision.memoriesToStore.length,
        };
      },
    },
  });

  const result = await harness.run(event);

  assert.deepEqual(commits, ["event-1:block"]);
  assert.deepEqual(result.learning, {
    applied: true,
    eventId: "event-1",
    credibilityUpdated: true,
    memoriesStored: 1,
  });
});

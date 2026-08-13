import type { JsonObject, JsonSchema, JsonValue, ReviewDecision } from "../types.js";

export interface AgentTool<TArguments extends JsonObject = JsonObject> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute(arguments_: TArguments, signal?: AbortSignal): Promise<JsonValue>;
}

export interface ContributorContextInput extends JsonObject {
  repository: string;
  contributor: string;
}

export interface MemorySearchInput extends JsonObject {
  repository: string;
  query: string;
  contributor?: string;
  limit?: number;
}

export interface PullRequestInput extends JsonObject {
  repository: string;
  pullRequestNumber: number;
}

export interface RepositoryFileInput extends JsonObject {
  repository: string;
  path: string;
  ref?: string;
}

export interface GitHistoryInput extends JsonObject {
  repository: string;
  path: string;
  limit?: number;
}

/** Implement this interface in the backend using GitHub and MongoDB. */
export interface ReviewDataSource {
  getContributorContext(input: ContributorContextInput, signal?: AbortSignal): Promise<JsonValue>;
  searchOrganizationalMemory(input: MemorySearchInput, signal?: AbortSignal): Promise<JsonValue>;
  getPullRequestDiff(input: PullRequestInput, signal?: AbortSignal): Promise<JsonValue>;
  getPullRequestChecks(input: PullRequestInput, signal?: AbortSignal): Promise<JsonValue>;
  readRepositoryFile(input: RepositoryFileInput, signal?: AbortSignal): Promise<JsonValue>;
  getGitHistory(input: GitHistoryInput, signal?: AbortSignal): Promise<JsonValue>;
}

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[],
): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

const repository = { type: "string", description: "Repository in owner/name form." } satisfies JsonSchema;

export function createDataTools(source: ReviewDataSource): AgentTool[] {
  return [
    {
      name: "get_contributor_context",
      description:
        "Retrieve a contributor's current credibility and relevant trust history. Credibility is evidence, not a policy threshold.",
      parameters: objectSchema(
        {
          repository,
          contributor: { type: "string", description: "Contributor login or stable identifier." },
        },
        ["repository", "contributor"],
      ),
      execute: (args, signal) => source.getContributorContext(args as ContributorContextInput, signal),
    },
    {
      name: "search_organizational_memory",
      description:
        "Semantically search prior PRs, incidents, code memories, contributor history, and the agent's previous review mistakes.",
      parameters: objectSchema(
        {
          repository,
          query: { type: "string", description: "A focused semantic search query based on the current evidence." },
          contributor: { type: "string", description: "Optional contributor to narrow the search." },
          limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximum memories to return." },
        },
        ["repository", "query"],
      ),
      execute: (args, signal) => source.searchOrganizationalMemory(args as MemorySearchInput, signal),
    },
    {
      name: "get_pull_request_diff",
      description: "Retrieve the current PR patch and changed-file metadata for code review.",
      parameters: objectSchema(
        {
          repository,
          pullRequestNumber: { type: "integer", minimum: 1, description: "GitHub pull request number." },
        },
        ["repository", "pullRequestNumber"],
      ),
      execute: (args, signal) => source.getPullRequestDiff(args as PullRequestInput, signal),
    },
    {
      name: "get_pull_request_checks",
      description: "Retrieve CI, test, and deployment check results for a pull request.",
      parameters: objectSchema(
        {
          repository,
          pullRequestNumber: { type: "integer", minimum: 1, description: "GitHub pull request number." },
        },
        ["repository", "pullRequestNumber"],
      ),
      execute: (args, signal) => source.getPullRequestChecks(args as PullRequestInput, signal),
    },
    {
      name: "read_repository_file",
      description: "Read an affected or related source file at a branch, commit, or other git ref.",
      parameters: objectSchema(
        {
          repository,
          path: { type: "string", description: "Repository-relative file path." },
          ref: { type: "string", description: "Optional branch, tag, or commit SHA." },
        },
        ["repository", "path"],
      ),
      execute: (args, signal) => source.readRepositoryFile(args as RepositoryFileInput, signal),
    },
    {
      name: "get_git_history",
      description: "Inspect commits and prior changes for an affected path to investigate intent or attribution.",
      parameters: objectSchema(
        {
          repository,
          path: { type: "string", description: "Repository-relative file path." },
          limit: { type: "integer", minimum: 1, maximum: 30, description: "Maximum commits to return." },
        },
        ["repository", "path"],
      ),
      execute: (args, signal) => source.getGitHistory(args as GitHistoryInput, signal),
    },
  ];
}

export const reviewDecisionSchema: JsonSchema = objectSchema(
  {
    action: { type: "string", enum: ["approve", "comment", "block", "investigate", "no_action"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: objectSchema(
        {
          severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
          title: { type: "string" },
          details: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
        },
        ["severity", "title", "details", "evidence"],
      ),
    },
    credibilityUpdate: {
      anyOf: [
        { type: "null" },
        objectSchema(
          {
            contributor: { type: "string" },
            previousScore: { anyOf: [{ type: "number" }, { type: "null" }] },
            proposedScore: { type: "number", minimum: 0, maximum: 100 },
            rationale: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
          },
          ["contributor", "previousScore", "proposedScore", "rationale", "evidence"],
        ),
      ],
    },
    memoriesToStore: {
      type: "array",
      items: objectSchema(
        {
          subject: { type: "string" },
          kind: { type: "string", enum: ["contributor", "code", "incident", "agent_experience"] },
          summary: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        ["subject", "kind", "summary", "evidence", "confidence"],
      ),
    },
    selfAssessment: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  ["action", "confidence", "summary", "findings", "credibilityUpdate", "memoriesToStore", "selfAssessment"],
);

export function createFinishTool(onDecision: (decision: ReviewDecision) => void): AgentTool {
  return {
    name: "finish_review",
    description:
      "Finish this run with an evidence-grounded judgment and proposed memory changes. Call exactly once when investigation is sufficient.",
    parameters: reviewDecisionSchema,
    async execute(args) {
      const decision = validateReviewDecision(args);
      onDecision(decision);
      return { accepted: true };
    },
  };
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${path} must be an array of strings`);
  }
}

function numberInRange(value: unknown, min: number, max: number, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${path} must be a number between ${min} and ${max}`);
  }
}

export function validateReviewDecision(value: JsonObject): ReviewDecision {
  const actions = ["approve", "comment", "block", "investigate", "no_action"] as const;
  if (!actions.includes(value.action as (typeof actions)[number])) throw new Error("action is invalid");
  numberInRange(value.confidence, 0, 1, "confidence");
  if (typeof value.summary !== "string" || !value.summary.trim()) throw new Error("summary is required");
  if (!Array.isArray(value.findings)) throw new Error("findings must be an array");
  const severities = ["info", "low", "medium", "high", "critical"] as const;
  const findings = value.findings.map((raw, index) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`findings[${index}] is invalid`);
    if (!severities.includes(raw.severity as (typeof severities)[number])) throw new Error(`findings[${index}].severity is invalid`);
    if (typeof raw.title !== "string" || typeof raw.details !== "string") throw new Error(`findings[${index}] text is invalid`);
    assertStringArray(raw.evidence, `findings[${index}].evidence`);
    return { severity: raw.severity as (typeof severities)[number], title: raw.title, details: raw.details, evidence: raw.evidence };
  });

  let credibilityUpdate: ReviewDecision["credibilityUpdate"] = null;
  if (value.credibilityUpdate !== null) {
    const raw = value.credibilityUpdate;
    if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("credibilityUpdate is invalid");
    if (typeof raw.contributor !== "string" || typeof raw.rationale !== "string") throw new Error("credibilityUpdate text is invalid");
    if (raw.previousScore !== null) numberInRange(raw.previousScore, 0, 100, "credibilityUpdate.previousScore");
    numberInRange(raw.proposedScore, 0, 100, "credibilityUpdate.proposedScore");
    assertStringArray(raw.evidence, "credibilityUpdate.evidence");
    credibilityUpdate = {
      contributor: raw.contributor,
      previousScore: raw.previousScore,
      proposedScore: raw.proposedScore,
      rationale: raw.rationale,
      evidence: raw.evidence,
    };
  }

  if (!Array.isArray(value.memoriesToStore)) throw new Error("memoriesToStore must be an array");
  const kinds = ["contributor", "code", "incident", "agent_experience"] as const;
  const memoriesToStore = value.memoriesToStore.map((raw, index) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`memoriesToStore[${index}] is invalid`);
    if (!kinds.includes(raw.kind as (typeof kinds)[number])) throw new Error(`memoriesToStore[${index}].kind is invalid`);
    if (typeof raw.subject !== "string" || typeof raw.summary !== "string") throw new Error(`memoriesToStore[${index}] text is invalid`);
    assertStringArray(raw.evidence, `memoriesToStore[${index}].evidence`);
    numberInRange(raw.confidence, 0, 1, `memoriesToStore[${index}].confidence`);
    return {
      subject: raw.subject,
      kind: raw.kind as (typeof kinds)[number],
      summary: raw.summary,
      evidence: raw.evidence,
      confidence: raw.confidence,
    };
  });

  if (value.selfAssessment !== null && typeof value.selfAssessment !== "string") {
    throw new Error("selfAssessment must be a string or null");
  }
  return {
    action: value.action as ReviewDecision["action"],
    confidence: value.confidence,
    summary: value.summary,
    findings,
    credibilityUpdate,
    memoriesToStore,
    selfAssessment: value.selfAssessment,
  };
}

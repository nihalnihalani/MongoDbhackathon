# MURMUR agent harness

The package owns model inference and autonomous decision-making. It intentionally does not own HTTP routes, frontend state, GitHub authentication, MongoDB queries, or persistence. Those systems implement one interface and decide what to do with the returned proposals.

## Runtime flow

```text
ReviewEvent
    │
    ▼
Selected inference provider ── chooses ──► evidence tools supplied by backend
(Fireworks or OpenRouter)                     │
                                             ├─ contributor context
                                             ├─ memory search
                                             ├─ PR diff/checks
                                             └─ file/history inspection
                                                    │
                                                    ▼
                                             finish_review
                                                    │
                                                    ▼
                                   decision + proposed memory updates
```

There are no credibility thresholds or fixed review stages in the harness. The system prompt explicitly treats credibility as evidence. The model chooses which tools to call and how much investigation the current event warrants.

## Provider setup

Node 20 or newer is required. Copy values from `.env.example` into your shell or deployment secret manager:

```bash
# Choose one provider for the complete agent loop.
export MURMUR_PROVIDER="fireworks"
export FIREWORKS_API_KEY="..."
export FIREWORKS_MODEL="accounts/fireworks/models/kimi-k2-instruct-0905"

# Or:
export MURMUR_PROVIDER="openrouter"
export OPENROUTER_API_KEY="..."
export OPENROUTER_MODEL="anthropic/claude-sonnet-4.5"
export OPENROUTER_SITE_URL="https://your-app.example"
export OPENROUTER_APP_NAME="MURMUR"
```

Both clients call the providers' OpenAI-compatible `/chat/completions` APIs directly with `fetch`; there is no runtime SDK dependency. Calls have an abortable timeout, bounded retries for network errors, HTTP 408/429, and 5xx responses, `Retry-After` support, response-shape checks, and errors that never include an API key. OpenRouter routing defaults to providers that support all requested parameters and deny data collection.

The default model IDs are configuration defaults, not assumptions embedded in the agent. Override them as model availability and account access require. Relevant provider documentation: [Fireworks chat completions](https://docs.fireworks.ai/api-reference/post-chatcompletions), [Fireworks tool calling](https://docs.fireworks.ai/guides/function-calling), and [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling).

## Backend integration

Implement `ReviewDataSource` and pass its tools to `AgentHarness`. A MongoDB/GitHub implementation can live in the backend package without coupling those dependencies to inference:

```ts
import {
  AgentHarness,
  createDataTools,
  createModel,
  loadAgentEnvironment,
  type ReviewDataSource,
  type ReviewEvent,
} from "murmur-agent";

const dataSource: ReviewDataSource = {
  getContributorContext: (input, signal) => memory.getContributor(input, signal),
  searchOrganizationalMemory: (input, signal) => memory.semanticSearch(input, signal),
  getPullRequestDiff: (input, signal) => github.getDiff(input, signal),
  getPullRequestChecks: (input, signal) => github.getChecks(input, signal),
  readRepositoryFile: (input, signal) => github.readFile(input, signal),
  getGitHistory: (input, signal) => github.getHistory(input, signal),
};

const config = loadAgentEnvironment();
const model = createModel(config);
const tools = createDataTools(dataSource);

const agent = new AgentHarness({
  model,
  tools,
  maxSteps: config.maxSteps,
  onProgress: (event) => streamToClient(event),
});

const result = await agent.run(webhookEvent as ReviewEvent, request.signal);

// Backend-owned side effects happen after the run and can be transactional.
await reviews.save(result.decision);
await memory.saveProposals(result.decision.memoriesToStore);
```

Every adapter result must be JSON-serializable. The harness validates model-generated arguments locally against each tool schema before invoking the adapter. Tool failures are returned to the model as evidence so it can recover, and oversized results are bounded before being added to context.

## Input and output

`ReviewEvent` supports PR opened/updated/merged, CI failure, deployment failure, and incident events. A stable event ID lets the backend implement idempotency. For PR events, include `contributor` and `pullRequestNumber`; incident events can instead place service, deployment, alert, or suspected-PR data in `metadata`.

`AgentRunResult` contains:

- the original event;
- an evidence-grounded `ReviewDecision`;
- a compact trace of model/tool activity and durations;
- aggregate model token usage.

The decision has an action, confidence, findings with evidence citations, an optional proposed credibility change, durable memory proposals, and an optional agent self-assessment. These are proposals only—the harness never posts a review or writes memory itself.

## Adding a tool

Extra backend capabilities can be registered without changing the loop:

```ts
tools.push({
  name: "request_additional_test",
  description: "Ask the CI service to run a focused existing test target.",
  parameters: {
    type: "object",
    properties: {
      target: { type: "string" },
      rationale: { type: "string" },
    },
    required: ["target", "rationale"],
    additionalProperties: false,
  },
  execute: async (args, signal) => ci.runTarget(args, signal),
});
```

Only register mutating tools if the surrounding product explicitly intends the model to trigger those side effects. Read-only evidence tools are the safer default; final writes can remain backend-controlled.

## Local demo and verification

The snapshot adapter supports a live model demo with no database or GitHub dependency:

```bash
npm run agent -- \
  --event examples/pr-event.json \
  --snapshot examples/review-snapshot.json
```

The included tests use scripted models and mocked HTTP responses, so `npm test` does not spend provider credits. A real smoke test requires provider keys and is intentionally not part of the default suite.

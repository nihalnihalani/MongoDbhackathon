┌───────────────────────────────────────────────────────────────────────────┐
│                          CUSTOMER-FACING WEBSITE                         │
│                                                                           │
│  Org Dashboard                         Contributor Profile                 │
│  ─────────────────                     ───────────────────                 │
│  Liam       118 🟢                     Credibility: 118                   │
│  Alice       83 🟡                     Trust history                      │
│  Kevin       31 🔴                     PR history                         │
│                                         Agent memories                     │
│  Active PR reviews                     Agent's current assessment         │
│  Recent incidents                      Credibility changes               │
│                                                                           │
│                     "Why does the agent distrust Kevin?"                  │
└─────────────────────────────┬─────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API                                  │
│                                                                           │
│  Auth / GitHub integration / API endpoints / streaming agent output       │
│                                                                           │
│  Mostly infrastructure.                                                   │
│  DOES NOT decide trust or review depth.                                   │
└─────────────┬───────────────────────────────────────────────┬─────────────┘
              │                                               │
              │                                               │ webhooks
              ▼                                               ▼
┌──────────────────────────────┐                    ┌───────────────────────┐
│           MONGODB            │                    │        GITHUB         │
│                              │                    │                       │
│ Long-term organizational     │                    │ PR opened            │
│ memory + current state       │                    │ PR changed           │
│                              │                    │ PR merged            │
│ users                        │                    │ CI failed             │
│ PRs                          │                    │ deployment failed     │
│ reviews                      │                    │ incident reported     │
│ incidents                    │                    │                       │
│ credibility events          │                    └───────────┬───────────┘
│ code memories               │                                │
│ embeddings                  │                                │
│                              │                                │
│ MongoDB Vector Search       │                                │
└─────────────▲────────────────┘                                │
              │                                                 │
              │ read/write memory                               │
              │                                                 ▼
┌─────────────┴─────────────────────────────────────────────────────────────┐
│                                                                         │
│                       AUTONOMOUS CODING AGENT                           │
│                                                                         │
│              This is the actual decision-making system.                 │
│                                                                         │
│  Agent receives an event:                                               │
│                                                                         │
│                  "Kevin opened PR #481"                                 │
│                            │                                            │
│                            ▼                                            │
│                   ┌─────────────────┐                                   │
│                   │ Understand event │                                   │
│                   └────────┬────────┘                                   │
│                            │                                            │
│                            ▼                                            │
│                   Retrieve whatever                                     │
│                   memory it considers                                   │
│                   relevant                                              │
│                            │                                            │
│             ┌──────────────┼─────────────────┐                          │
│             ▼              ▼                 ▼                          │
│        credibility      old PRs       similar mistakes                  │
│        history          from Kevin     / incidents                      │
│                                                                         │
│                            │                                            │
│                            ▼                                            │
│                  AGENT FORMS A BELIEF                                   │
│                                                                         │
│       "Kevin has credibility 31. His last auth PR caused a              │
│        regression. This PR modifies authentication again.               │
│        I should investigate this unusually thoroughly."                 │
│                                                                         │
│                            │                                            │
│                            ▼                                            │
│                    AGENT CHOOSES ACTIONS                                │
│                                                                         │
│       • inspect diff                                                     │
│       • inspect related files                                            │
│       • retrieve previous auth failures                                  │
│       • examine tests                                                    │
│       • inspect dependency and caller relationships                      │
│       • inspect git history                                              │
│       • request/generate additional tests                                │
│       • compare against similar historical PRs                           │
│                                                                         │
│                       NO FIXED PIPELINE                                  │
│                                                                         │
│                            │                                            │
│                            ▼                                            │
│                    AGENT MAKES JUDGMENT                                 │
│                                                                         │
│          approve / comment / block / investigate further                │
│                                                                         │
│                            │                                            │
│                            ▼                                            │
│                  AGENT UPDATES ITS MEMORY                               │
│                                                                         │
│       "PR #481 had another auth bug."                                   │
│       Kevin credibility: 31 → 24                                        │
│       Store reasoning + evidence + embedding                            │
│                                                                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
              ┌─────────────────────────────────────────┐
              │       SELECTED INFERENCE PROVIDER       │
              │                                         │
              │       Fireworks AI  OR  OpenRouter      │
              │                                         │
              │ Both run the complete agent loop:       │
              │ reasoning, code analysis, summarization,│
              │ tool selection, and final decisions.    │
              └─────────────────────────────────────────┘

The important distinction is that credibility is memory, not policy.

You don't want:

if credibility < 50:
    run_three_reviews()

You want the agent to see something closer to:

Contributor
-----------
Kevin
Credibility: 31


Relevant history
----------------
- PR #391: introduced authentication regression (-18)
- PR #404: missing authorization check (-12)
- PR #433: clean fix (+4)


Current PR
----------
Touches:
- auth/session.ts
- middleware/permissions.ts


And then tell the agent something like:

You are responsible for protecting the codebase. Use the organization's history and your own previous experiences to decide how much scrutiny each change deserves. You may investigate code, retrieve historical memories, inspect previous PRs, trace related code, and request evidence as needed. Update contributor credibility when new evidence changes how much you trust their engineering work.

Then the interesting emergent behavior is:

Kevin submits CSS change
        ↓
Agent: "Low credibility, but this is isolated CSS.
        I'll inspect it normally."

Kevin submits auth change
        ↓
Agent: "Absolutely not. Last time Kevin touched this subsystem
        production went down. Retrieve those incidents, inspect
        every affected caller, and request focused regression evidence."


That is much better than thresholds. Now you're actually demonstrating memory changing an agent's behavior rather than just using MongoDB as a fancy database behind some if statements.

Delayed failures should work the same way

Suppose CI/deployment/monitoring sends:

Incident:
"Users can occasionally access expired sessions."

incident
   ↓
inspect affected code
   ↓
MongoDB vector search:
"find previous changes semantically related to
session expiry / authentication / token validation"
   ↓
retrieve candidate PRs
   ↓
inspect candidate diffs + git history
   ↓
reason about causal chain
   ↓

Agent conclusion:

"PR #481 changed the expiry comparison from
absolute time to TTL and appears to have introduced
this regression.

Author: Kevin
Confidence: 0.94

I previously approved this PR, but Kevin authored
the defect.

Kevin: 46 → 28

Also record that my original review failed to identify
this defect."

That final line is actually an interesting extension: the agent can remember its own mistakes too. If it repeatedly misses a particular class of issue, future reviews involving that pattern can become more rigorous.

Then you have two intertwined memories:

CONTRIBUTOR MEMORY
"How much do I trust this person?"

             +

AGENT EXPERIENCE
"What kinds of mistakes have I historically missed?"

I would describe the project in one sentence as:

“An autonomous code-review agent that develops trust, suspicion, and grudges based on the long-term consequences of your code.”

## Agent capability checklist

`[x]` means the capability exists in the inference package today. A checked adapter-backed tool is callable by the agent, but still needs the backend team's real GitHub or MongoDB implementation before production use.

### Autonomous reasoning and control

- [x] Accept PR, CI, deployment, merge, and incident events through one event model.
- [x] Let the model choose its own investigation steps instead of following a credibility threshold or fixed pipeline.
- [x] Let the model make multiple tool calls across a bounded, multi-turn investigation.
- [x] Let the model decide when it has enough evidence and terminate with `finish_review`.
- [x] Recover from malformed tool arguments, unknown tools, and adapter failures by returning errors to the model.
- [x] Prevent runaway behavior with maximum steps, repeated-call limits, result-size limits, timeouts, abort signals, and retry limits.
- [x] Validate every tool call locally before invoking an external adapter.
- [x] Distinguish evidence from hypotheses and require evidence references in structured findings.
- [x] Treat credibility as contextual memory rather than hard-coded policy.
- [x] Vary scrutiny based on the combination of current code risk, contributor history, incidents, and prior agent mistakes.

### Autonomous investigation tools

- [x] Retrieve contributor credibility and trust history through an agent-callable adapter.
- [x] Formulate and revise semantic searches over organizational memory through an agent-callable adapter.
- [x] Retrieve and inspect pull-request diffs and changed-file metadata through an agent-callable adapter.
- [x] Inspect pull-request CI and test results through an agent-callable adapter.
- [x] Choose and read related repository files discovered during investigation through an agent-callable adapter.
- [x] Inspect path-level git history through an agent-callable adapter.
- [x] Correlate delayed CI, deployment, and incident failures with prior changes using memory, diffs, and history.
- [x] Investigate contributor memory and the agent's own historical review failures in the same loop.
- [ ] Search the repository by symbol, text, or glob without already knowing a file path.
- [ ] Inspect dependency graphs, callers, callees, and ownership automatically.
- [ ] Inspect line-level blame and compare arbitrary commits or historical file versions.
- [ ] Execute tests, linters, type checks, or static analyzers in a sandbox.
- [ ] Generate a focused regression test and verify that it fails or passes.
- [ ] Request additional CI jobs and continue the same run when results arrive.
- [ ] Delegate bounded investigations to parallel subagents.

### Autonomous judgments and learning

- [x] Produce structured approve, comment, block, investigate, or no-action judgments.
- [x] Produce severity-ranked findings with confidence and evidence.
- [x] Propose evidence-backed contributor credibility changes without persisting them directly.
- [x] Propose durable contributor, code, incident, and agent-experience memories.
- [x] Record a self-assessment when a delayed failure reveals that an earlier review missed something.
- [ ] Produce file-and-line review comments ready for direct GitHub submission.
- [ ] Propose or apply a code patch for a confirmed defect.
- [ ] Track unresolved hypotheses and resume them across separate process runs.
- [ ] Re-evaluate earlier judgments automatically when CI, deployment, or incident evidence arrives.
- [ ] Learn which investigation strategies were effective and adapt tool selection beyond prompt context alone.

### Inference and operations

- [x] Run the complete agent loop on either Fireworks AI or OpenRouter using the same `ChatModel` interface.
- [x] Select the provider and model entirely through environment configuration.
- [x] Send OpenAI-compatible tool-calling requests without a runtime provider SDK dependency.
- [x] Retry transient network, rate-limit, and server errors while honoring `Retry-After`.
- [x] Report provider/model identity, progress events, compact traces, durations, and aggregate token usage.
- [x] Run an end-to-end local demo against snapshot data without MongoDB or GitHub.
- [x] Test provider requests and autonomous tool behavior without spending inference credits.
- [ ] Persist and resume model/tool checkpoints for long-running investigations.
- [ ] Stream model tokens in addition to structured progress events.
- [ ] Track monetary cost and enforce per-run token or dollar budgets.

### External integrations intentionally outside the inference package

- [ ] Implement the real MongoDB contributor-memory queries.
- [ ] Implement MongoDB vector search for organizational memories.
- [ ] Persist proposed memories, credibility events, review decisions, and embeddings transactionally.
- [ ] Implement the real GitHub diff, checks, file, and history adapter.
- [ ] Receive and deduplicate GitHub, CI, deployment, and incident webhooks.
- [ ] Post final reviews, line comments, requested changes, or approvals to GitHub.
- [ ] Connect progress and final results to the backend streaming API and frontend.

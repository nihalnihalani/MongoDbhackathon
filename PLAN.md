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
│       • run another model as critic                                      │
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
└──────────────────┬────────────────────────────┬─────────────────────────┘
                   │                            │
                   ▼                            ▼
         ┌──────────────────┐          ┌─────────────────────┐
         │   FIREWORKS AI   │          │     OPENROUTER      │
         │                  │          │                     │
         │ Main inference   │          │ Agent can call      │
         │                  │          │ alternate models    │
         │ reasoning        │          │ when useful         │
         │ code analysis    │          │                     │
         │ summarization    │          │ critic              │
         │ tool selection   │          │ judge               │
         │ decisions        │          │ second opinion      │
         └──────────────────┘          └─────────────────────┘

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

You are responsible for protecting the codebase. Use the organization's history and your own previous experiences to decide how much scrutiny each change deserves. You may investigate code, retrieve historical memories, use additional models, inspect previous PRs, and request evidence as needed. Update contributor credibility when new evidence changes how much you trust their engineering work.

Then the interesting emergent behavior is:

Kevin submits CSS change
        ↓
Agent: "Low credibility, but this is isolated CSS.
        I'll inspect it normally."

Kevin submits auth change
        ↓
Agent: "Absolutely not. Last time Kevin touched this subsystem
        production went down. Retrieve those incidents, inspect
        every affected caller, and get another model to review it."


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


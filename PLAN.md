# RECEIPTS — implementation-aligned plan

## Product thesis

> An operator-confirmed production failure becomes a durable review contract that every
> future change in that subsystem must satisfy, even after the reviewer agent
> that missed the failure is dead.

RECEIPTS is persistent organizational scar tissue for repositories filled with
coding agents. It remembers **what evidence the organization must require next
time**, not which person deserves a permanent global score.

The current build uses fictional coding-agent contributors, subsystem-scoped
history and concrete proof requirements.

## Product contract

### Input

- A coding-agent PR with an author, subsystem, change type, code/content and
  optional evidence.
- A shipped outcome, including an executable canary result where available.
- Explicit operator confirmation before a failed PR is treated as causal. The
  demo follows this sequence, but the endpoint does not yet enforce a red canary.

### Durable memory

- A receipt for each PR and its eventual outcome.
- A confirmed incident with its failing case and embedding.
- A review contract naming the subsystem, requirement and evidence key created
  by that incident.
- Reviewer generations and heartbeats, so process death is visible.

### Behavior change

- A future PR with an unmet contract is blocked deterministically.
- After contract checks pass, a PR in a contract-bearing or incident-similar
  area receives a deeper model review.
- An unrelated PR follows the standard path.
- A replacement reviewer enforces the same rules with zero conversation
  history because it reconstructs all context from MongoDB.

## Core invariants

1. **No global human credibility score.** Standing is descriptive and scoped to
   `contributor x subsystem`.
2. **Unknown is not trusted.** A contributor with no outcomes begins `unknown`,
   not at 100.
3. **Similarity is not causality.** Embeddings retrieve related incidents and
   influence review depth; they never assign fault.
4. **Attribution is operator-confirmed.** The demo operator confirms the
   failure-to-PR linkage before policy changes. This is a choreography invariant
   until `/confirm` enforces a failed canary.
5. **Incident publication is atomic.** The incident, failed receipt outcome and
   review contract commit together in one MongoDB transaction.
6. **Contracts protect the subsystem.** An active contract applies to every
   future PR in that subsystem, regardless of author.
7. **No trust bypass.** Prior clean outcomes never remove baseline review or an
   active evidence requirement.
8. **The reviewer is disposable.** A new process carries zero in-memory messages
   and retrieves every lesson from MongoDB.
9. **Recovery is evidence-keyed.** A blocked PR is requeued after its required
   evidence key is claimed. The demo also attaches corrected code and executes
   predeclared canary cases, but the evidence artifact is not independently verified.
10. **Fallbacks are explicit.** If a partner model is unavailable, the receipt
    identifies the template fallback rather than silently pretending a model ran.

## System architecture

```text
Operator console
  | POST /submit, /ship, /confirm, /evidence
  v
Express API ------------------------------------------------------+
  |                                                               |
  | writes                                                        | SSE
  v                                                               v
MongoDB Atlas                                               Stage screen
  |  pr_receipts                                                live PRs
  |  incidents + embeddings                                    contracts
  |  review_contracts                                          incidents
  |  contributors                                               standing
  |  reviewer_status                                            liveness
  |
  +-- change stream: submitted PR --> disposable reviewer worker
  |                                    | query active contracts
  |                                    | vector-search incidents
  |                                    | standard or deep review
  |                                    +-------------------------> MongoDB
  |
  +-- transaction: confirmed incident + failed outcome + contract
```

The web server contains no authoritative demo state. It streams MongoDB changes
to the browser. The reviewer worker is a separate process so it can be killed
without taking down the operator console or stage.

## Repository integration status

There are currently two runnable surfaces in the repository:

| Surface | Implemented role | Current boundary |
|---|---|---|
| `receipts/` JavaScript app | Canonical hackathon demo: MongoDB state, review contracts, canary, disposable reviewer and live UI | Uses its own deterministic contract gate and standard/deep review functions |
| Root TypeScript inference harness | Provider-neutral, bounded multi-turn investigation using Fireworks or OpenRouter over a `ReviewDataSource`; persists learned context across runs in local JSON | No MongoDB, GitHub or RECEIPTS adapter is wired |

The root harness preserves useful autonomous investigation work without changing
the product contract. The integration target is to call it as the autonomous
reviewer **after** RECEIPTS has checked binding review contracts. It must not own
operator confirmation, causal attribution or contract publication. Those remain
deterministic, auditable application responsibilities.

Until that adapter exists, the one-minute demo uses `receipts/`. The root
`npm run agent` command independently proves autonomous investigation and local
learning across reviewer processes, not MongoDB-backed contract enforcement.

### Root autonomous harness capability checklist

- [x] Choose Fireworks or OpenRouter as interchangeable inference providers.
- [x] Let the model plan a bounded multi-step investigation and choose evidence tools.
- [x] Retrieve contributor context, organizational memories, PR evidence, related files and history through adapters.
- [x] Return structured findings, a review action, memory proposals and an optional credibility update.
- [x] Persist repository-scoped credibility and memories across local process restarts.
- [x] Apply a completed event at most once and reject stale concurrent score updates.
- [x] Keep current PR evidence separate from durable learned state.
- [ ] Read RECEIPTS contracts, incidents and receipts through a real MongoDB adapter.
- [ ] Treat operator-confirmed RECEIPTS contracts as binding constraints in the autonomous loop.
- [ ] Publish autonomous review results into the RECEIPTS stage UI.
- [ ] Search a real repository and execute tests in a sandbox.

Local agent learning is advisory. It may change investigation depth, but it cannot
create, satisfy or bypass a RECEIPTS contract. Binding behavior still comes only
from operator-confirmed incidents committed through the MongoDB transaction.

## Data model

| Collection | Purpose | Important fields |
|---|---|---|
| `contributors` | Identities of coding agents that submit PRs | `_id`, `kind`, `createdAt` |
| `pr_receipts` | Submitted change, review and later outcome | `prNum`, `author`, `subsystem`, `code`, `evidence[]`, `status`, `outcome`, `review`, `canary` |
| `incidents` | Operator-confirmed failures and retrieval corpus | `num`, `prNum`, `subsystem`, `description`, `failingCase`, `embedding`, `confirmedBy` |
| `review_contracts` | Persistent evidence requirements learned from incidents | `subsystem`, `requirement`, `evidenceKey`, `incidentNum`, `authorAtFault`, `active`, `satisfiedBy[]` |
| `reviewer_status` | Current reviewer generation and heartbeat | `generation`, `msgCount`, `alive`, `lastSeen` |
| `counters` | Stable PR, incident and reviewer generation numbers | `_id`, `seq` |

### Receipt states

```text
submitted
  | reviewer
  +--> approved
  +--> concerns
  +--> blocked -- add evidence/fix --> submitted

approved -- ship --> merged
                     | canary passes --> outcome: clean
                     | canary fails  --> outcome remains pending
                                          | operator confirms
                                          +--> outcome: failed + incident + contract
```

The demo API is operator-driven and presently allows `ship` independently of an
approval check. Production integration must enforce the merge authorization in
GitHub rather than trusting control order.

## Review algorithm

For each submitted PR, the reviewer reconstructs context from MongoDB:

```js
active = review_contracts where subsystem matches and active is true
similar = vector search over confirmed incidents
unmet = active contracts whose evidenceKey is absent from the PR

if (unmet.length > 0) {
  block and cite the originating incident
} else {
  record the claimed evidence key in contract satisfaction
  if (active.length > 0 || any similarity >= 0.75) run deep review
  else run standard review
}
```

Important semantics:

- An active contract is the deterministic enforcement boundary.
- A vector match alone escalates scrutiny; it does not block or assign fault.
- Contracts are subsystem-wide. `authorAtFault` is used to explain the original
  contributor's proof debt, not to exempt other authors.
- A satisfied contract remains active as an organizational safeguard. Its
  `satisfiedBy` list records which later PRs claimed the required evidence key.
- Contract satisfaction is currently written before the executed canary and
  deep-review verdict. Production must record satisfaction only after verified
  evidence passes.

## Contributor standing

Standing is derived with a MongoDB aggregation over PR outcomes and contracts:

| State | Meaning |
|---|---|
| `unknown` | No completed outcome exists in this subsystem. |
| `building` | Some outcome history exists, but it has not met the `proven` rule. |
| `proven` | At least five clean outcomes, no failures and no open proof debt. |
| `proof-debt` | A confirmed incident attributed to this contributor/subsystem has not yet been satisfied by a later PR. |

This view is explanatory. The reviewer does not read the standing label when it
decides whether to block a PR.

## MongoDB responsibilities

| Mechanism | Non-substitutable job |
|---|---|
| Atlas documents | Shared durable state across the server, reviewer generations and stage clients. |
| `$vectorSearch` | Retrieve semantically related confirmed incidents for targeted deep review. |
| Multi-document transaction | Prevent a half-published lesson: incident, failed outcome and contract appear together. |
| Change streams | Deliver submitted PRs to the reviewer and database mutations to the stage. |
| Aggregation + `$lookup` | Compute scoped standing and open proof debt from source records. |
| Unique indexes | Prevent duplicate PR and incident identities. |
| Atomic counters | Preserve human-legible sequence numbers across process restarts. |

Local MiniLM embeddings can keep inference independent of venue Wi-Fi after the
model has been downloaded and cached once. MongoDB stores the vectors and runs
the similarity search. The reviewer currently converts retrieval errors to an
empty result, so a retrieval outage may select the standard lane; production
must fail closed or surface that degraded state loudly.

## Model routing

| Lane | Provider | Trigger | Authority |
|---|---|---|---|
| Standard review | Selected with `REVIEW_PROVIDER` (`fireworks` or `openrouter`) | No active contract and no incident similarity at or above `0.75` | Advisory `approve` or `concerns` |
| Deep review | The same selected provider with the incident-aware prompt | Active subsystem contract or high incident similarity | Advisory `approve` or `concerns` after contract checks pass |
| Contract block | Deterministic application logic | Required evidence is absent | Binding block; no LLM call needed |

Both review depths have loud template fallbacks. The demo's persistence proof
does not depend on either API being available, and provider choice is never used
as review policy.

## HTTP and process surfaces

| Surface | Purpose |
|---|---|
| `POST /submit` | Store a synthetic PR receipt; reviewer change stream picks it up. |
| `POST /ship` | Execute the demo canary and mark the PR merged. |
| `POST /confirm` | Operator confirms linkage; publish incident and contract. |
| `POST /evidence` | Attach required evidence and optional corrected code, then requeue. |
| `GET /state` | Initial stage snapshot from MongoDB. |
| `GET /standing` | Derived contributor-by-subsystem explanation view. |
| `GET /events` | SSE stream populated from MongoDB change streams. |
| `npm run reviewer` | Start a new disposable reviewer generation. |

## Exact 60-second demo

| Time | Beat | Visible proof |
|---|---|---|
| 0-8s | `agent-kevin` submits payment PR #481 | Standard review approves; payments history is `unknown`, not 100. |
| 8-15s | Operator ships #481 | Canary executes the PR code; `1.005` rounds to `1.00`, red. |
| 15-24s | Operator confirms linkage | Incident #41 and the boundary-test contract appear together. |
| 24-31s | Kill reviewer #1 | Heartbeat expires; stage shows `DEAD`. Contracts remain. |
| 31-38s | Start reviewer #2 | Terminal prints `0 prior messages, all knowledge from MongoDB`. |
| 38-47s | Kevin submits similar PR #482 | Successor blocks it and cites Incident #41. |
| 47-52s | Maya submits unrelated docs PR #483 | It passes the standard path, proving the safeguard is scoped. |
| 52-59s | Claim the boundary-test key and attach corrected code to #482 | PR requeues, runs its predeclared canaries, receives deep review, unlocks and records contract satisfaction. |
| 59-60s | Closing card | **The reviewer died. The lesson shipped.** |

## Verification contract

`npm run verify` exercises the core deterministic database and reviewer
mechanics with `REVIEW_LLM=off`:

- PR #481 receives standard approval.
- Its canary fails on the half-cent boundary.
- Operator confirmation atomically creates Incident #41 and its contract.
- A second reviewer closure begins with zero messages and blocks PR #482.
- An unrelated documentation PR passes.
- Corrected code and the claimed evidence key unlock #482.
- Contract satisfaction removes the displayed open proof debt.

The harness deletes all RECEIPTS collections before seeding. It must only run
against a dedicated test/demo database. It does not launch two OS processes or
exercise HTTP, SSE, change streams or browser UIs; the rehearsed manual demo is
the process-death proof.

## Implemented now

- Atlas collections, indexes and programmatic vector-index creation
- Local 384-dimensional incident embeddings
- Synthetic PR submission and receipt lifecycle
- Executable boundary-case canary
- Operator-confirmed transactional incident publication
- Subsystem-wide persistent review contracts
- Disposable reviewer generations, startup recovery and change-stream intake
- Standard/deep prompts on an interchangeable provider with explicit fallbacks
- Live operator and stage UIs backed by database change streams
- Derived scoped standing and proof-debt display
- Destructive DB-backed mechanics proof harness

## Before submission

P0:

- Commit and push the complete `receipts/` application with these canonical docs.
- Keep the root inference harness clearly labeled as a separate, locally persisted
  component until a real RECEIPTS data-source adapter is implemented.
- Run `npm run verify` against a dedicated Atlas hackathon database.
- Run `npm run llm-smoke` once with each `REVIEW_PROVIDER` and confirm both
  providers are visibly labeled.
- Rehearse kill/restart timing at least three times.
- Confirm the Atlas Vector Search index is queryable before recording.
- Correct the historical `satisfiedBy: [452]` seed reference, which currently
  has no corresponding seeded PR receipt.
- Record the one-minute demo from the stage screen and operator console.

If time permits:

- Reject `/confirm` unless the stored PR has a failed canary.
- Reject `/ship` unless the stored review is approved.
- Make submitted evidence verifiable rather than trusting an evidence-key string.

Do not add GitHub integration before the core proof is stable. A reliable
synthetic end-to-end loop is stronger than a half-working webhook.

## Production path

The current build proves the persistent-context primitive, not a production
code-review platform. Production work includes:

- GitHub App webhooks and checks instead of synthetic PR endpoints
- Verified CI artifacts and signed evidence receipts
- Authenticated, auditable incident adjudication with appeal/correction
- Sandboxed code execution instead of `new Function`
- Idempotency and reconciliation around external GitHub actions
- Contract lifecycle/versioning and explicit retirement policies
- Repository/path-aware scopes beyond the current subsystem key
- Authorization, tenancy, secrets management and abuse controls

## Non-goals

- Ranking humans on a public leaderboard
- Automatically deciding whose fault an incident was
- Letting high-history contributors bypass baseline controls
- Treating vector similarity as causal evidence
- Claiming current integration with GitHub, CI or production deployment systems
- Building a dashboard whose charts are the product

The product is the inherited behavior change: **a successor reviewer cannot
review the same confirmed class of failure without first demanding the evidence
key the organization learned to require.**

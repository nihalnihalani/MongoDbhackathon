<div align="center">

# 🧾 PR-Elo

### The reviewer dies. The lesson ships.

*An operator-confirmed production failure becomes a durable review contract in MongoDB — and the reviewer's fresh successor enforces it with zero prior messages.*

<br/>

[![MongoDB Persistent Context Sprint Hackathon](https://img.shields.io/badge/MongoDB%20Persistent%20Context%20Sprint-Cerebral%20Valley%20%C2%B7%20SF-00ED64?style=for-the-badge&logo=mongodb&logoColor=white)](https://cerebralvalley.ai/e/persistent-context-sprint-hackathon)

**Powered by**

[![MongoDB Atlas](https://img.shields.io/badge/MongoDB%20Atlas-change%20streams%20%C2%B7%20%24vectorSearch%20%C2%B7%20transactions-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Fireworks](https://img.shields.io/badge/Fireworks-standard%20review%20lane-FF5A00?style=flat-square)](https://fireworks.ai)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-deep%20review%20lane-6467F2?style=flat-square)](https://openrouter.ai)

**Stack**

[![Node.js](https://img.shields.io/badge/Node.js-20.19+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Embeddings](https://img.shields.io/badge/Embeddings-Xenova%20MiniLM--L6--v2%20(local)-FFD21E?style=flat-square)](https://huggingface.co/Xenova/all-MiniLM-L6-v2)

</div>

---

## 🎯 What it is

Code-review agents start every session cold. A reviewer approves a bug, the bug ships, the incident happens — and after a restart that same reviewer makes the same mistake, because the lesson lived in a conversation that no longer exists. PR-Elo moves the lesson out of the process and into the database:

```text
PR ships → canary fails in production → operator confirms the causal linkage
        → one transaction publishes a review contract
        → every later PR in that subsystem must carry the missing evidence
```

The reviewer is deliberately disposable. Kill it mid-demo and its successor boots with **zero prior messages**, reads the contract from MongoDB, and blocks a PR that its predecessor would have waved through. That behavioral delta — not a longer prompt — is the whole claim.

**How it frames people.** Enforcement stays on the *change*: no contributor score can waive a required check. The live demo also shows a transparent `contributor × subsystem` review-confidence score, computed from linked evidence events rather than inferred ability. It answers “how much proof has this contributor recently carried in this area?”, not “how good is this engineer?”

| Rule | What it means |
|---|---|
| 🎯 **The change is still gated** | Output is a *review-depth requirement* on a PR entering a subsystem. Contributor history can increase scrutiny but never remove baseline controls. |
| ❓ **Unknown by default** | States are `unknown · building · proven · proof-debt`. No evidence ≠ trusted, and ≠ suspect. |
| 🏛️ **Organizational, not personal** | A confirmed payments failure guards *every* future payments PR, regardless of author. |
| ↩️ **Recovery is always open** | Proof debt is paid down by executed evidence; contracts unlock. |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph SURF["🖥️ Surfaces"]
        direction TB
        OP["Operator console<br/><i>public/index.html</i>"]
        ST["Stage screen<br/><i>public/stage.html</i>"]
        WEB["Product-vision UI<br/><i>web/ · React · fixtures</i>"]
    end

    GH["🐙 GitHub fork PR<br/>signed webhook + commit status"]
    API["⚙️ Express API<br/>submit · ship · confirm · evidence<br/>webhook · SSE fan-out"]
    CAN["🐤 Canary<br/><b>executes the PR's function</b><br/>roundMoney(1.005) → 1.00 ❌"]

    subgraph ATLAS["🍃 MongoDB Atlas"]
        direction TB
        DB[("pr_receipts · incidents · review_contracts<br/>github deliveries · publications<br/>contributors · counters · reviewer_status")]
        VEC{{"$vectorSearch<br/>384-dim cosine"}}
    end

    subgraph REV["♻️ Disposable reviewer (generation N — killed and replaced on stage)"]
        direction TB
        GATE["1 · Contract gate<br/><b>before any LLM call</b>"]
        DEPTH["2 · Depth select<br/>similarity ≥ 0.75 → escalate"]
        LLM["3 · Review<br/>Fireworks │ OpenRouter<br/><i>labeled template fallback</i>"]
    end

    GH -->|"pull_request webhook"| API
    OP -->|"submit / ship / confirm"| API
    API --> CAN --> API
    API --> DB
    DB ==>|"🔔 change stream — the ONLY wake signal"| GATE
    GATE -->|"unmet contract"| BLK["⛔ deterministic block"]
    GATE -->|"clear"| DEPTH
    VEC -.->|"related incidents"| DEPTH
    DB --- VEC
    DEPTH --> LLM
    LLM -->|"verdict + contract satisfaction"| DB
    BLK --> DB
    DB -->|"status + review receipt"| GH
    DB -->|"change streams → SSE"| ST
    DB -.->|"not yet wired"| WEB

    classDef mongo fill:#0d2818,stroke:#00ED64,color:#fff
    classDef rev fill:#1a1a2e,stroke:#8B5CF6,color:#fff
    class DB,VEC mongo
    class GATE,DEPTH,LLM,BLK rev
```

### Contract lifecycle

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Submitted: agent opens PR
    Submitted --> Reviewed: reviewer no.1 · standard lane
    Reviewed --> Shipped: operator ships
    Shipped --> CanaryRed: canary executes fn ❌
    CanaryRed --> Confirmed: operator confirms linkage
    Confirmed --> Published: 🔒 one transaction<br/>incident + failed outcome + contract
    Published --> Blocked: reviewer no.2 (0 messages)<br/>blocks PR 482
    Blocked --> Satisfied: evidence attached<br/>canary re-executed ✅
    Satisfied --> [*]: unlocked · proof debt paid
    note right of Published
        reviewer no.1 is killed here.
        Nothing in memory survives.
    end note
```

---

## 🍃 Why MongoDB is load-bearing

Not a datastore behind the demo — the demo *is* MongoDB behaviors. Every row is verifiable in source.

| MongoDB capability | Load-bearing role | Source |
|---|---|---|
| **Change streams** | The reviewer's **sole** wake signal. No polling loop exists anywhere. Kill the process; the successor resumes from the DB and drains `status: submitted` first. | `receipts/src/reviewer.js:104` |
| **Atlas Vector Search** | `$vectorSearch` over incident embeddings; similarity **≥ 0.75** escalates the PR from standard to deep review. Persistent context changes an *action*, not just a prompt. | `receipts/src/ops.js:37`, `receipts/src/reviewer.js:52` |
| **Transactions** | Incident + failed PR outcome + the future review contract commit atomically in one `session.withTransaction`. A lesson is never half-published. | `receipts/src/ops.js:97` |
| **Deterministic enforcement** | The contract gate runs **before any LLM call**. Reviewer #2 blocking PR #482 is database enforcement, not model judgment. | `receipts/src/reviewer.js:29` |
| **Aggregation + `$lookup`** | Explainable `contributor × subsystem` standing derived from outcomes joined against open proof debt — `unknown` is the default. | `receipts/src/ops.js:143` |
| **Atomic counters** | `nextSeq` keeps PR, incident, and **reviewer generation** identity stable across process restarts. Each restart is a new generation with `msgCount: 0`. | `receipts/src/schema.js:35`, `receipts/src/reviewer.js:85-96` |
| **Programmatic search index** | The 384-dim cosine vector index is created from application code at startup. | `receipts/src/schema.js:58-63` |

Embeddings run **locally** (`Xenova/all-MiniLM-L6-v2`, 384-dim) — no embedding API, so retrieval survives venue wifi. Both LLM lanes fall back to a **visibly labeled** template verdict (`REVIEW_LLM=off`), so a partner API being down can never silently decide the demo.

---

## 🖥️ Two surfaces

| Surface | Path | What it is |
|---|---|---|
| **Canonical demo** | `receipts/public/` | The operator console (numbered controls) and the live stage screen. Backed by real MongoDB writes and driven by change streams over SSE. **This is what runs on stage.** |
| **Live GitHub proof** | `receipts/public/live.html` | A PR targeting an authorized fork triggers a signed webhook, becomes an idempotent MongoDB receipt, is reviewed by the disposable worker and receives a GitHub commit status plus review comment. The same page recomputes an evidence-linked contributor leaderboard from MongoDB. |
| **Product vision** | `receipts/web/` | React 19 + TypeScript strict + Vite 8 + Tailwind v4. Routes: `/` Courtroom (live stream), `/contributor/:id` Dossier, `/review/:id` Case File, with a control-condition compare at `/review/rev-512`. Dark/light, WCAG AA tokens, `prefers-reduced-motion` parity. Design spec: [`receipts/web/DESIGN.md`](receipts/web/DESIGN.md) — *"a microfiche reader in a dark evidence room."* |

**Honest boundary:** the React UI runs on **fixture replay** and is not yet wired to the MongoDB API — it renders the product this becomes, not live data. The mechanics claims in this README are all proven by the `public/` demo and the source referenced above.

---

## 🚀 Run locally

**Prerequisites:** Node.js 20.19+, a MongoDB Atlas deployment with Atlas Vector Search, and a **dedicated demo database** — seed and verify reset PR-Elo collections.

```bash
cd receipts
npm install
cp .env.example .env     # set MONGODB_URI, MONGODB_DB, REVIEW_PROVIDER + its API key
npm run seed             # deterministic demo history
```

Then two long-lived processes in separate terminals:

```bash
npm run server           # http://localhost:4000
```
```bash
npm run reviewer         # generation N — 0 prior messages
```

Open the **operator console** at `http://localhost:4000/` and the **stage** at `http://localhost:4000/stage.html`. Follow the numbered controls; at step 4, `Ctrl-C` the reviewer and run `npm run reviewer` again to create a fresh generation.

### Live GitHub fork demo

The repository webhook must be installed on the PR's **base repository**. For the current public demo that is [`gorajing/mongo`](https://github.com/gorajing/mongo), not upstream `mongodb/mongo`.

```bash
cd receipts
npm run seed:github       # upserts the bounded SERVER-132850 lesson; deletes nothing
PORT=4100 npm run server  # signed webhook + live receipt at /live.html
npm run reviewer          # generation N starts with zero prior messages
```

Forward events only to `POST /webhooks/github` through a one-way relay such as Smee, subscribe the fork webhook to `pull_request`, and use the same random `GITHUB_WEBHOOK_SECRET` on both sides. Do **not** reverse-proxy the whole Express app: `/submit` and `/ship` are unauthenticated local-demo controls, and `/ship` executes operator-authored fixture code. Set `GITHUB_TOKEN` for deployment; locally the publisher can reuse an authenticated `gh api` session without exporting its token. Open the live page at `http://localhost:4100/live.html`, then open or update a PR whose base is `gorajing/mongo`.

The webhook acknowledges only after its delivery ID is durably recorded. The worker fetches the real GitHub patch, maps changed paths to a subsystem, lets MongoDB contracts select scrutiny and posts the result as `PR-Elo / persistent review`. Replayed delivery IDs and repeated publications are deduplicated in MongoDB; startup recovery retries both interrupted deliveries and reviewed receipts whose GitHub publication did not finish.

The live leaderboard starts each `contributor × subsystem` scope at 100. Missing required evidence is −5, review concerns are −3, a public auto-revert is −6, a corrective re-land is +4 and verified evidence is +3. The MongoDB contributor rows are a disclosed Aug 6–13 public sample; the `gorajing` row is calculated from append-only verdict events on actual signed-webhook receipts in the demo fork. A repaired PR keeps its earlier failure event before adding its recovery event. Every movement links to its public PR or commit. This is a demo review-readiness signal, not an employment or performance metric.

<details>
<summary><b>Optional checks & the product-vision UI</b></summary>

```bash
npm test                 # node --test test/*.test.js
npm run llm-smoke        # provider reachability
npm run verify           # ⚠️ DESTRUCTIVE: drops + reseeds all PR-Elo collections
cd web && npm install && npm run dev   # fixture-driven React UI, zero backend needed
```

Set `REVIEW_LLM=off` for fully deterministic template verdicts. Prewarm the local embedding model once while online so it is cached before you rely on offline inference.

</details>

---

## 🛡️ Production readiness

Honest scope. What ships on stage vs. what a real deployment needs:

| Area | Demo scope today | Production needs |
|---|---|---|
| **Canary execution** | `new Function()` — flagged demo-scoped in code; input is authored by the operator at a local console. | A real sandbox (isolate/container) before any untrusted submitter. `receipts/src/ops.js:50` |
| **API surface** | No auth, no input-validation layer on the Express API. | AuthN/Z on every mutating route, schema validation, rate limits. |
| **Reviewer availability** | Single-reviewer singleton heartbeat; change stream has **no resume tokens** (process exits on stream error). | Resume tokens, leader election, backoff + replay from the last token. |
| **Known logic gap** | Contract satisfaction is recorded *before* the verdict is known. | Record satisfaction only on a passing verdict. `receipts/src/reviewer.js:44-48` |
| **Source of truth** | Signed GitHub webhooks on an authorized fork; local `gh api` or `GITHUB_TOKEN` publishes a commit status and review comment. | GitHub App installation tokens, Check Runs and verified CI artifacts. |
| **Evidence** | An evidence key plus optional corrected code, re-executed by the canary. | Independently verified CI test artifacts, signed. |
| **Vector failure mode** | Retrieval errors fall back to "no similar incidents," which can select the standard lane. | Fail **closed** or alert visibly — never silently downgrade scrutiny. |
| **Adjudication** | Any operator can confirm a PR→incident linkage; `/confirm` does not enforce that the PR shipped and its canary failed. | Authenticated incident adjudication with an audit trail and state preconditions. |

Standing explains history — it never grants bypasses or reduces baseline review protection.

---

## 📂 Repository layout

```text
MongoDbhackathon/
├── receipts/                  ← the hackathon demo (canonical)
│   ├── public/
│   │   ├── index.html         ← numbered operator console
│   │   ├── stage.html         ← live stage visualization
│   │   └── live.html          ← real GitHub → MongoDB → reviewer → GitHub proof
│   ├── src/                   ← schema · ops · reviewer · embed · llm · server · seed · proof
│   ├── web/                   ← product-vision React UI (fixture replay) + DESIGN.md
│   └── test/                  ← llm.test.js
├── src/ · test/ · examples/   ← standalone TS inference harness (not yet wired to MongoDB — see docs/agent-harness.md)
└── PLAN.md                    ← implementation contract, state transitions, hardening
```

---

## 🏆 Team

**Built by** [@nihalnihalani](https://github.com/nihalnihalani) · [@lachenbach](https://github.com/lachenbach) (Liam Achenbach) · [@gorajing](https://github.com/gorajing) (Jin Choi) — for the [MongoDB Persistent Context Sprint Hackathon](https://cerebralvalley.ai/e/persistent-context-sprint-hackathon), built entirely during the event.

---

<div align="center">

**🧾 PR-Elo — the reviewer dies, the lesson ships.**

</div>

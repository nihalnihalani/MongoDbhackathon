# RECEIPTS — UI/UX Brief & API Contract

**Product one-liner:** An autonomous code-review agent that develops trust, suspicion, and grudges based on the long-term consequences of your code. The agent keeps receipts.

## The critical rubric constraint (non-negotiable)

The hackathon BANS "any project where a dashboard is the main feature." Therefore the UI's hero surface is **the agent thinking, live** — a streaming investigation theater where you watch it retrieve memories, form beliefs, choose actions, and pass judgment. Contributor scores, history, and incidents are *evidence panels* that support the agent's reasoning, never the headline. The test a judge applies: does the system ACT or DISPLAY? Every screen must answer "act."

## Design identity: "The Dossier"

Credit-bureau-meets-case-file aesthetic. The agent is an investigator; every contributor has a dossier; every verdict is stamped. Dark-first (terminal-native audience), light theme supported.

- Type: an editorial serif or strong grotesque for headers, monospace (JetBrains Mono / IBM Plex Mono) for evidence, diffs, scores, timestamps.
- Verdicts render as STAMPS: APPROVED / COMMENTED / BLOCKED / INVESTIGATING — angled, bordered, unmistakable at the back of a demo hall.
- Credibility is a score with a sparkline of its history, color-banded: ≥100 green, 50–99 amber, <50 red. Numbers always monospace.
- Motion: the reasoning stream types/reveals progressively (feels alive); respect prefers-reduced-motion.
- NO generic admin-template look. No sidebar-nav-with-cards cliché. This must look like a product, not a template.

## Routes

1. `/` — **The Courtroom (hero).** Live agent stream front and center: event feed of `belief`, `retrieval`, `action`, `escalation`, `judgment`, `credibility_change` events rendering as a typed investigation log. Right rail (collapsible): docket of active PR reviews + recent incidents. Top strip: org contributors as small credibility chips (click → dossier).
2. `/contributor/:id` — **The Dossier.** Credibility score + history sparkline, the agent's current written assessment ("Why does the agent distrust Kevin?" — verbatim agent prose), PR history with per-PR credibility deltas, agent memories about this person (retrievable evidence cards linking to source PRs/incidents).
3. `/review/:id` — **The Case File.** One PR's full investigation: the belief formed, every action taken with its output, evidence retrieved (past PRs/incidents with similarity scores), the verdict stamp, and the memory written back.

## API contract (frontend types = source of truth; backend implements to match)

Base: `VITE_API_BASE` (default `http://localhost:3001`). **The app must run perfectly with zero backend** via bundled fixtures — demo never depends on the backend being up. Data layer: try fetch, on failure fall back to fixtures with a small "fixture mode" badge.

```ts
GET /api/contributors → Contributor[]
GET /api/contributors/:id → ContributorDetail   // + memories, assessment, history
GET /api/reviews?status=active|done → ReviewSummary[]
GET /api/reviews/:id → ReviewDetail             // full case file
GET /api/incidents → Incident[]
SSE /api/stream                                  // live agent events

interface Contributor { id: string; name: string; credibility: number;
  trend: number[]; band: "trusted"|"watch"|"suspect" }
interface ContributorDetail extends Contributor {
  assessment: string;               // agent prose: why it trusts/distrusts
  history: { prId: string; title: string; delta: number; reason: string; at: string }[];
  memories: { id: string; text: string; kind: "incident"|"pr"|"self";
              sourceId: string; at: string }[] }
interface ReviewSummary { id: string; prId: string; title: string; author: string;
  authorId: string; status: "investigating"|"approved"|"commented"|"blocked";
  scrutiny: "normal"|"elevated"|"maximum"; startedAt: string }
interface ReviewDetail extends ReviewSummary {
  belief: string;                   // "Kevin has credibility 31. Last auth PR regressed..."
  actions: { kind: string; label: string; output: string; at: string;
             causedBy?: string[] }[];      // memory ids that triggered this action — REQUIRED
                                           // for escalations; renders the retrieval→action link
  evidence: { memoryId: string; text: string; similarity: number; sourceId: string }[];
  verdict: { decision: string; reasoning: string; at: string } | null;
  postedReview: { body: string; url: string } | null;  // the ACTUAL GitHub comment artifact
  memoryWritten: string | null; credibilityDelta: number | null }
interface Incident { id: string; title: string; at: string; status: string;
  attributedPrId?: string; attributedAuthorId?: string }

// SSE events (JSON lines, `event:` = type)
type StreamEvent =
  | { type:"review_started"; reviewId; prId; title; author; scrutiny }
  | { type:"belief"; reviewId; text }
  | { type:"retrieval"; reviewId; memories:{text; similarity}[] }
  | { type:"action"; reviewId; kind; label; output?; causedBy?: string[] }
  | { type:"escalation"; reviewId; model:"openrouter-critic"; reason; causedBy: string[] }
  | { type:"judgment"; reviewId; decision; reasoning }
  | { type:"credibility_change"; contributorId; from; to; reason }
  | { type:"incident_attributed"; incidentId; prId; contributorId; confidence }
```

## Fixture narrative (must tell the demo story by itself)

Contributors: **Liam 118** (trusted), **Alice 83** (watch), **Kevin 31** (suspect).
Seeded arc: Kevin's PR #391 auth regression (−18) → #404 missing authz (−12) → #433 clean fix (+4); one delayed-failure incident ("expired sessions accessible") attributed to PR #481 with confidence 0.94, including the agent's self-memory "my original review failed to catch this." One live review script that replays as an SSE fixture stream (looping, ~45s) so `/` is alive with zero backend: Kevin opens auth PR → belief → 3 retrievals → maximum scrutiny → OpenRouter critic escalation → BLOCKED stamp → credibility 31→24.

## Production bar (what "production level" means here)

- Vite + React 18 + TypeScript strict. Tailwind v4. No component-library skins.
- Typed API layer in one module; SSE with auto-reconnect + backoff; fixture fallback.
- Loading skeletons, empty states, error boundaries on every route. No unhandled promise noise; zero console errors.
- Responsive to 360px; keyboard navigable; visible focus; WCAG AA contrast in both themes; `prefers-reduced-motion` honored.
- Dark/light via `data-theme` + system default. Tokens as CSS custom properties in one file.
- `npm run build` clean with no TS errors; bundle sensible (no moment.js-class deps); README with run instructions.

## v2 Amendments (from design review — these OVERRIDE anything above that conflicts)

1. **No contributor strip on `/`.** A row of people-with-scores at rest is a leaderboard (banned dashboard form). Contributor chips appear *inside the stream* only at the moment the agent retrieves that person's history — scores are always something the agent just looked up, never ambient state. At rest, `/` shows the agent and nothing else.
2. **Stream plays ONCE, then rests in completed state.** Never loops while someone watches. No "fixture mode" badge — label the replayed arc "replay" plainly if backend absent.
3. **Control condition fixture (highest priority fixture):** the *identical* auth diff arrives from Liam (118) → normal scrutiny, and from Kevin (31) → maximum scrutiny + critic escalation. UI provides a toggle/side-by-side on the Case File or Courtroom. Same input, different behavior, memory the only variable — this is the theme proof.
4. **Ground the incident attribution in a real diff hunk.** When the agent claims PR #481 "changed expiry comparison from absolute time to TTL," render those highlighted diff lines next to the prose. Generated prose asserting a diff is a story; the diff beside it is evidence.
5. **Causality rendering:** escalation/action cards must name the memory that caused them (`causedBy` → visible link from evidence card to triggered action). A log is RAG; a causal chain is an agent.
6. **Credibility is a checkable sum, scoped to a subsystem.** Render as ledger arithmetic (−18 −12 +4 → 31), displayed as "31 · auth", never a bare per-person number. Show recovery (+4) prominently.
7. **Verdict stamps are scarce.** One stamp per case, large, earned after buildup, lands with overshoot-and-settle (no fade, no rotation animation). Plain text status everywhere else. Stamp the PR, never over the author's name.
8. **Stream rhythm:** typewriter effect ONLY on the belief (editorial-serif pull-quote). Retrievals burst in as a fast cluster of small cards; judgment is full-width. Insert a visible beat of hesitation (~1.5s pause) before escalation — stillness before the climax.
9. **Dossier depth parity:** Liam's dossier must be as finished as Kevin's, with real *positive* memories ("caught a race condition in review of #402"). The agent's assessment reads like an investigator's memo, not bullets. Every evidence card is clickable and lands somewhere real.
10. **Reload/deep-link survival on all three routes** (judges will refresh and hit back). Test with `prefers-reduced-motion` ON — the hero is animation; it must still render everything instantly without it.
11. **Show the external artifact:** Case File includes the actual review comment body as posted to GitHub (`postedReview` field) with the PR URL. The agent must visibly act outside our own app.

## Ownership

- `receipts/web/**` — frontend-builder ONLY.
- `receipts/web/DESIGN.md` + Stitch artifacts — design-director ONLY.
- This brief — orchestrator only.

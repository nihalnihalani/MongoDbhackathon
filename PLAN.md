# MURMUR — Final Plan (architect × devil's advocate synthesis)

**Air traffic control for repos where half the team is an AI.** It blocks colliding work before a line is written, calls you to argue about it, and its policy is rewritten by every argument — so it interrupts less and escalates smarter over time.

**Positioning lines (say these before judges ask):**
- **"Graft is the mutex. We're the memory."** Graft (VC-backed) coordinates parallel agents but deliberately forgets between sessions. SAP's Shared Organizational Memory (July 2026) remembers, but only ingests curated artifacts after the fact. Cursor pauses agents on human edits, but only inside its own editor. **Nobody feeds organizational memory from live, uncommitted work. That's us.**
- Session cold start is solved (Mem0/Zep). **Organizational cold start** — the agent that has never met your team's history — "is not handled by any memory layer" (Atlan). That's the open problem this attacks.

---

## 1. The problem (30 seconds of evidence)

Parallel coding agents collide on *meaning*, not lines — two rate limiters that both compile, lint, and pass CI. Beam's benchmark: coordinated vs uncoordinated swarm = **70,000+ → <1,000 merge conflicts, $9,373 → $411** (20x cost lever, all in coordination). The human review lane can't absorb it: a senior spent 3 days on one junior's Claude Code PRs — *"I didn't actually read all the code. I couldn't."* And 88% of agent pilots die on attribution/governance — every Murmur claim carries a `human_owner`.

## 2. What it does

Every worker — human or agent — declares intent before touching files. Murmur embeds the intent, vector-searches it against live claims + past incidents, multiplies similarity by a **mutable policy stored in MongoDB** (zone heat × actor trust), and returns `ALLOW` / `WARN` / `BLOCK`. On BLOCK, an ElevenLabs voice agent **calls the human first** (outbound — latency invisible) and *negotiates*: it reads evidence mid-call, pushes back, grants overrides, forces scope splits. **The resolution mutates the policy.** Same similarity score → different verdict next time.

### Demo scenario (cross-tool — this is mandatory, see DA-F1)
Repo `acme/payments`. Humans **Priya**, **Diego**. Agents **Ada** (Claude Code) and **Byte** (Cursor). Cross-tool matters: Cursor already pauses agents on same-editor conflicts — our answer is cross-machine, cross-tool, cross-session.

1. Ada claims "protect login from brute force" → `ALLOW (0.11)`, silent, 90ms. Cold state.
2. Priya claims "per-tenant throttling middleware for auth routes." **Different words, different files** — git sees nothing. Vector search: **0.88** vs Ada. Priya's laptop **rings**.
3. Voice agent argues, concedes on evidence (`get_evidence`), splits scope (`grant_override`), records outcome (`record_resolution("split")`).
4. Policy v7→v8: `zone_heat["src/auth/"] 1.0→1.3`, Priya's trust up. Incident written ("scar tissue").
5. Byte claims IP caps on signin: raw **0.74** — the exact score that was ALLOWED in step 1. Now `0.74 × 1.3 = 0.96` → **BLOCK**. Byte's Edit is denied by hook; Byte re-plans.

**The line: "Same input. Same score. Opposite decision. The only thing that changed is what's in MongoDB — and I just killed the process to prove none of it was in memory."**

## 3. Privacy stance (DA-F5 — say it on the slide)
**We send intent strings, embeddings, and file paths. Never source.** Diff summarization (STRETCH) runs locally via Fireworks producing a one-line intent — raw uncommitted diffs never leave the machine.

## 4. Architecture

```
Beacon (per worker)              Control Tower                 Voice
Claude Code PreToolUse hook ─┐                             ElevenLabs Conv. Agent
Cursor / `murmur claim` CLI ─┼─POST→ FastAPI /claim          ▲ │ server tools
git-diff watcher (STRETCH)  ─┘        │ insert               │ ▼
                            ┌─────────▼──────────┐      ┌──────────────┐
                            │ MongoDB Atlas      │◄─────┤ /tool/* hooks│
                            │ claims (TTL+vec)   │      └──────────────┘
                            │ incidents (vec)    │
                            │ verdicts, policy   │
                            │ checkpoints (LG)   │
                            └─────────┬──────────┘
                                      │ change streams (claims insert; verdicts resolution)
                                      ▼
                            LangGraph arbiter: retrieve → score → decide → [interrupt] → record
```

### Collections (shapes)

```js
// claims — TTL 45min on expires_at; vector index on intent_embedding
{ actor:{id:"agent:ada", kind:"agent", human_owner:"priya"},
  intent:"add rate limiting to the login endpoint", intent_embedding:[...],
  files_touched:["src/auth/routes/login.py"], zone:"src/auth/",
  repo, branch, status:"active", created_at, expires_at }

// policy — ONE doc, _id:"active", read on EVERY claim; mutated by resolutions
{ _id:"active", version:8,
  thresholds:{warn_similarity:0.71, block_similarity:0.86},
  actor_trust:{"agent:ada":1.0,"human:priya":1.15},
  zone_heat:{"src/auth/":1.3,"docs/":0.6},
  stats:{escalations:12, overrides_upheld:3, overrides_regretted:1},
  updated_at, updated_by:"voice_resolution:..." }

// verdicts — policy_snapshot proves same-score-different-answer on stage
{ claim_id, decision:"BLOCK", raw_similarity:0.74, effective_score:0.962,
  matched:[{claim_id, actor:"agent:ada", sim:0.74}], policy_version:8,
  policy_snapshot:{warn:0.71, block:0.86, zone_heat:1.3, trust:1.0},
  escalated:true, resolution:null }

// incidents — vector index on narrative_embedding ("scar tissue")
{ title:"Duplicate rate limiters in auth", narrative:"...", narrative_embedding:[...],
  zone:"src/auth/", learned:"Auth throttling needs one owner; split by layer.",
  source_verdict, created_at }
```

### MongoDB features — all load-bearing
| Operation | Mechanism | Why not decorative |
|---|---|---|
| Find overlapping work | `$vectorSearch` on claims (filtered status/repo) | Catches different-files-same-job — git can't see it |
| Recall past pain | `$vectorSearch` on incidents | Voice agent reads the justification aloud |
| Trigger arbitration | Change stream on claims insert | The trigger, not a UI feed |
| Trigger learning | Change stream on verdicts resolution | Decouples voice webhook from policy math |
| The decision itself | `findOne({_id:"active"})` on policy | Its values ARE the verdict |
| Survive kill -9 | LangGraph MongoDBSaver | In-flight negotiation resumes mid-interrupt |
| Expire stale claims | TTL index | Dead agent branches stop faking collisions |

### Policy loop, mechanically (never say "learning" without showing this)
Read (every claim): `score = raw_similarity × zone_heat ÷ actor_trust` → compare thresholds.
Write (on resolution, via change stream):
| Resolution | Mutation | Effect |
|---|---|---|
| `real_collision` | zone_heat +0.3, block_sim −0.03, incident written | Escalates harder in that zone |
| `split` | zone_heat +0.3, actor_trust +0.05, incident | Zone hot; the human who was right gets rope |
| `false_positive` | warn_sim +0.02, trust +0.10, zone_heat −0.10 | **Nudges less — anti-alert-fatigue** |

Every write bumps `version` + stamps `updated_by`. Show the v7→v8 diff live. **Also show a SUPPRESSED alert** (DA-F7): what the system chose NOT to interrupt is the cheapest proof the policy has teeth.

## 5. Build plan — 3 people, ~3.5h (A=data/Atlas, B=graph/server, C=voice)

- **First 5 min:** shared `schemas.py`. Everyone codes against it.
- **1:30–2:05 Rails.** A: sandbox cluster, 4 collections, 2 vector indexes, TTL, `seed.py` (200+ plausible traces — DA-D6) + `reset.py`, Fireworks embed helper. B: FastAPI `/claim`, change-stream watcher proven firing. C: ElevenLabs agent in dashboard, "challenge, don't agree" prompt, 3 server tools declared, ngrok round-trip proven.
- **2:05–2:50 Loop closes.** A: `$vectorSearch` overlaps + `decide()` (unit-test the arithmetic — it's the demo's spine). B: LangGraph retrieve→score→decide→[interrupt]→record on MongoDBSaver; interrupt/resume works with fake resolution before voice is ready. C: real webhook bodies; trigger a live call from a one-liner.
- **⛳ 2:50 checkpoint: claim → verdict end-to-end, or cut all STRETCH and pull C onto B.**
- **2:50–3:30.** A: tuner (verdicts stream → policy mutation → version++, print diff). B: Claude Code PreToolUse hook (deny on BLOCK, reason fed back) + `murmur` CLI fallback; verify a real session gets stopped. C: make it argue; kill narration-sounding sentences.
- **3:30–4:10 Rehearse ×3 from `reset.py`.** Test kill -9 mid-interrupt. Fix, add nothing.
- **4:10–4:40 Record the 1-min video. Owner: ____ (assign NOW — DA-D8). Two takes max.**
- **4:40–5:00 README, Atlas Sandbox confirmation, submit, buffer.**

**Cut order (top first):** OpenRouter adjudication → git-diff watcher → terminal ticker → incidents collection → Claude Code hook (CLI by hand) → LangGraph resume.
**Never cut:** vector overlap detection, policy read/write loop, one live ElevenLabs call, kill-9 + same-score-different-verdict beat.

## 6. Demo hardening (from devil's advocate)
- **Wifi (blast radius: total):** phone hotspot primary, tested from stage; pre-warm Atlas connection; 20s backup screen-recording of the collision beat, cut to it without apology if stalled >3s.
- **Voice latency (~1.7s full-turn):** agent **speaks first** — outbound interruptions have invisible latency. One scripted Q&A turn max.
- **Loud room:** feed venue PA directly, never laptop speakers; burn captions for every agent utterance; headset mic.
- **"Two machines":** run two daemon processes + two worktrees on ONE laptop; say "two machines in production." Heartbeat line so a dead process is seen before the demo, not during.
- **Restart moment:** time it 10×; if p90 >8s, restart daemon only; narrate during reconnect; recalled memory prints at second one.
- **Legibility:** 200% fonts, one focal point per beat, max two panes visible.

## 7. Objections to rehearse (with answers)
- *"Cursor does this."* — Inside one editor process. Murmur is cross-tool (Claude Code + Cursor + vim human), cross-machine, and remembers across sessions.
- *"Isn't this file locking?"* — Locks are on paths; this fires when paths DON'T overlap. Locks say no; this negotiates. Locks are static; the thresholds are different at 5 PM than at 1:30.
- *"Is a threshold bump really learning?"* — We don't claim gradient descent. It's an outcome-weighted policy; here's the document mutating live, and here's the same input getting the opposite verdict. Behavior change is the claim, and it's on screen.
- *"Isn't this RAG?"* — Retrieval feeds a threshold comparison that gates a tool call — the agent's Edit is denied. Retrieval changes a decision, not a prompt.
- *"Who pays?"* — Platform teams running 10+ parallel agents per repo. Beam: $9,373 → $411 per swarm task. And attribution (`human_owner` on every claim) is the exact 88%-of-pilots blocker.
- *"You're exfiltrating unreleased code."* — Intent strings, vectors, and paths. Never source. Diff summarization runs locally.

## 8. Judge mapping
- **Creativity 35%:** memory changes a *verdict*, not a prompt; the voice argument IS the training signal. Defensible white space: live uncommitted work → org memory (SAP doesn't), memory across sessions (Graft refuses), voice at the human-agent boundary (nobody).
- **Tech 25%:** MongoDB in 5 non-substitutable roles + ElevenLabs server tools writing to the DB mid-call + Fireworks on the hot embed path + LangGraph/LangChain arbiter + OpenRouter (stretch).
- **Impact 20%:** 20x swarm cost lever; moves the check from merge time to intent time; attribution built in.
- **Demo 20%:** a ringtone, a real argument, a kill -9, one line of arithmetic.
- **Bans dodged:** no browser at all (not Streamlit, not dashboard — primary surfaces are a phone call and a denied Edit); not basic RAG (retrieval gates decisions); not a chatbot (it initiates, holds evidence, says no).

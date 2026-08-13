# RECEIPTS — web

The front end for RECEIPTS: an autonomous code-review agent that develops trust,
suspicion, and grudges based on the long-term consequences of your code.

The hero surface is **the agent thinking, live** — a streaming investigation
theatre where you watch it retrieve memories, form beliefs, escalate, and pass
judgment. Scores and history are evidence panels supporting that reasoning, never
the headline.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # tsc -b && vite build → dist/
npm run preview  # serve the production build
```

## It runs with no backend

This is the important property. With nothing else running, the app serves a
bundled case file and performs the scripted Kevin investigation end to end:

> Kevin opens an auth PR → the agent forms a belief → retrieves three memories,
> including its own admission that it missed the last one → escalates scrutiny to
> maximum → calls the OpenRouter critic → **BLOCKS** → drops him 31 → 24.

A `Fixture` badge in the masthead discloses this whenever the data is bundled
rather than live. The arc plays **once** and then rests; a `▸ Replay` control in
the case header runs it again. It deliberately does not loop — a feed that jumps
back to the top mid-read is worse than one that ends.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:3001` | Base URL of the RECEIPTS backend. |

Copy `.env.example` to `.env` to override. The data layer probes the backend once
per session; if it is unreachable, every route serves fixtures and no further
requests are attempted. With no backend running, the browser will log one
`ERR_CONNECTION_REFUSED` for that probe — that is the fallback working, not an
application error.

## API contract

`src/lib/types.ts` is the source of truth; the backend implements to match it.
The prose contract lives in [`../UI-BRIEF.md`](../UI-BRIEF.md).

```
GET  /api/contributors        → Contributor[]
GET  /api/contributors/:id    → ContributorDetail   // + assessment, memories, ledger
GET  /api/reviews?status=…    → ReviewSummary[]
GET  /api/reviews/:id         → ReviewDetail        // full case file
GET  /api/incidents           → Incident[]
SSE  /api/stream              → StreamEvent         // live agent events
```

Every endpoint is wrapped in `src/lib/api.ts`, which is the only module that
talks to the network. The SSE client (`src/lib/stream.ts`) reconnects with
exponential backoff once it has connected at least once, and hands off to the
fixture player if the backend was never there.

## Routes

| Route | Surface |
| --- | --- |
| `/` | **The Courtroom** — the live investigation stream, contributor chips, collapsible docket rail. |
| `/contributor/:id` | **The Dossier** — credibility, the agent's written assessment, the ledger, retrievable memories. |
| `/review/:id` | **The Case File** — one PR's belief, evidence, diff, actions, verdict, and the comment it posted. |

## Design

`DESIGN.md` (owned by the design director) is the visual source of truth. Its
colour and spacing blocks are pasted verbatim into `src/styles/tokens.css`; the
only thing that file adds is a documented layer of derived roles built from those
inks with `color-mix`, so every tint tracks the theme.

Dark (`Carbon`) and light (`Manila`) both ship, resolved before first paint by an
inline script in `index.html` and switchable from the masthead. Component classes
live in `@layer components` so Tailwind utilities always win a conflict.

## Structure

```
src/
  lib/         types (the contract), api client, SSE + fixture player, formatting
  fixtures/    the seeded case file and the scripted investigation
  hooks/       stream reducer, typed reveal, count-up, theme, reduced motion
  components/  stamps, sparkline, ledger, diff hunk, evidence cards, log events
  routes/      Courtroom, Dossier, CaseFile, NotFound
  styles/      tokens.css (verbatim design tokens) + global.css
```

No component library and no chart library — the sparkline, stamps, meters, and
diff hunks are hand-rolled SVG and CSS.

## Accessibility and quality bar

- Loading placeholders, empty states, and a per-route error boundary on every surface.
- Responsive to 360px; the stream, tables, and diff hunks scroll inside themselves
  rather than widening the page.
- Keyboard navigable with a visible focus ring and a skip link; WCAG AA contrast
  in both themes (ratios documented in `DESIGN.md` §1).
- `prefers-reduced-motion` is honoured: the typed reveal renders instantly, the
  score tween snaps, and the stamp keeps its rotation but loses its slam. Every
  finding remains present and legible.
- The typed reveal writes to a node hidden from assistive tech and exposes the
  finished sentence once, so a screen reader hears the sentence rather than every
  intermediate prefix. Press `Esc` or click the stream to skip all typing.

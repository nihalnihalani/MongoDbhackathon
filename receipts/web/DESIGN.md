# RECEIPTS — Design Specification (v2)

**Owner:** design-director. **Audience:** frontend-builder. **Status:** implement as written; no clarifying questions needed.

**v2 supersedes v1 in full.** All 11 amendments in `UI-BRIEF.md § v2 Amendments` are folded in below. Where v1 conflicted, v2 wins; the changes are itemized in §12 so nothing already built gets missed.

> **Stitch MCP was unavailable.** `create_project` failed twice with `Incompatible auth server: does not support dynamic client registration` — the server isn't authenticated in this environment. **No Stitch project or screen links exist.** This document is the complete, self-sufficient source of truth; the ASCII wireframes in §9 stand in for the generated screens.

---

## 0. The design idea

**A microfiche reader in a dark evidence room.** A *document surface*, not an app surface: an investigator's reasoning typed onto ledger-ruled paper in real time, verdicts applied as physical stamps, credibility kept as arithmetic you can check.

**Five rules that carry the whole design. Violating any one of them collapses it into a template or a dashboard.**

1. **Max border-radius anywhere is 4px.** No pills. Documents have square corners.
2. **No blurred shadows.** Elevation is a hard offset (`3px 3px 0`) — photocopied paper on a desk.
3. **No nav column, no contributor strip.** Nothing that resembles a leaderboard is ever ambient. Scores appear only where the agent just looked one up.
4. **One stamp per case.** Scarcity is what gives it force. Everywhere else, status is plain text.
5. **Every number is checkable.** Credibility renders as a summed ledger scoped to a subsystem, never a bare score.

---

## 1. Color tokens

Paste into `src/styles/tokens.css`, imported before Tailwind. Theme switches on `data-theme` on `<html>`.

```css
:root {
  color-scheme: dark;

  /* ---- Ground: warm near-black, like exposed photographic paper ---- */
  --bg:            #0C0B0A;
  --surface:       #141310;   /* stream rows, panels */
  --surface-2:     #1C1A16;   /* raised cards, memo blocks */
  --surface-sunk:  #080807;   /* wells, action output, diff hunks */

  /* ---- Rules & borders ---- */
  --line:          #2A2722;   /* hairline separators (decorative only) */
  --line-strong:   #3D3830;   /* panel & card edges (decorative only) */
  --line-control:  #6E655A;   /* REQUIRED on interactive borders — 3.44:1 on --bg */

  /* ---- Ink (text) ---- */
  --ink:           #EDE6D8;   /* primary   — 15.8:1 on --bg, 14.0:1 on --surface-2 */
  --ink-2:         #A9A092;   /* secondary —  7.6:1 on --bg,  6.7:1 on --surface-2 */
  --ink-3:         #8A8174;   /* meta      —  5.1:1 on --bg,  4.5:1 on --surface-2 */

  /* ---- Signal inks: verdicts, credibility bands, deltas ---- */
  --ink-red:       #F26A50;   /* BLOCKED   / suspect / negative delta */
  --ink-amber:     #E8A93C;   /* COMMENTED / watch */
  --ink-green:     #3FBE7C;   /* APPROVED  / trusted / recovery */
  --ink-steel:     #69A9E8;   /* actions, live state */
  --ink-mimeo:     #B48BE8;   /* escalation, causal links, high similarity */

  /* ---- Utility ---- */
  --focus:         #F5C542;   /* 12.1:1 on --bg */
  --shadow-hard:   rgba(0, 0, 0, 0.62);
  --select-bg:     rgba(245, 197, 66, 0.22);
  --tint:          12%;       /* signal-ink field tint strength */
  --texture-ink:   rgba(237, 230, 216, 0.030);
}

:root[data-theme='light'] {
  color-scheme: light;

  /* ---- Ground: manila desk under a lamp ---- */
  --bg:            #EDE7D9;
  --surface:       #F6F1E5;
  --surface-2:     #FCF9F1;
  --surface-sunk:  #E2DAC7;

  --line:          #D6CDBA;
  --line-strong:   #BBB099;
  --line-control:  #847A69;   /* 3.43:1 on --bg */

  --ink:           #1A1712;   /* 14.5:1 on --bg */
  --ink-2:         #4A4237;   /*  8.0:1 */
  --ink-3:         #6E6455;   /*  4.7:1 */

  --ink-red:       #9E2814;
  --ink-amber:     #7A4E05;
  --ink-green:     #155C38;
  --ink-steel:     #1B5285;
  --ink-mimeo:     #6B3FA8;

  --focus:         #8A4B00;   /*  5.5:1 */
  --shadow-hard:   rgba(58, 48, 32, 0.30);
  --select-bg:     rgba(138, 75, 0, 0.18);
  --tint:          12%;
  --texture-ink:   rgba(26, 23, 18, 0.038);
}
```

### Contrast verification (computed, not estimated)

Every value below was calculated from WCAG relative luminance. The reviewer flagged amber-on-dark; **amber on dark is actually the safest token in the set (9.52:1)** — high-luminance amber fails on *light* grounds, not dark ones. But the check surfaced a real bug one layer down: **four inks failed against their own 12% field tint**, which is exactly where band-colored numbers sit.

| Ink | Dark: on `--bg` | Dark: on `--surface-2` | Dark: **on own tint** | Light: on `--bg` | Light: **on own tint** |
|---|---|---|---|---|---|
| red | 6.51 | 5.75 | **4.87** | 6.15 | **5.09** |
| amber | 9.52 | 8.42 | **6.75** | 5.83 | **4.94** |
| green | 8.30 | 7.34 | **6.01** | 6.50 | **5.42** |
| steel | 7.90 | 6.98 | **5.76** | 6.57 | **5.48** |
| mimeo | 7.30 | 6.45 | **5.34** | 5.87 | **4.94** |

All pass AA 4.5:1 in all five contexts. Getting there required moving five tokens off their v1 values — do not revert them:

| Token | v1 | v2 | Why |
|---|---|---|---|
| dark `--ink-red` | `#F0553C` | `#F26A50` | 4.38:1 on own tint — **failed** |
| light `--ink-red` | `#B3301A` | `#9E2814` | 4.25:1 on own tint — **failed** |
| light `--ink-amber` | `#8A5A0B` | `#7A4E05` | 4.11:1 on own tint — **failed** |
| light `--ink-green` | `#1A6B42` | `#155C38` | 4.48:1 on own tint — **failed** |
| light `--ink-steel` | `#1F5E96` | `#1B5285` | 4.66:1 — passed with no margin |

**Rules:**
- Field tints are always `color-mix(in oklab, var(--ink-x) var(--tint), transparent)` — never hardcoded rgba, so they track the theme.
- Do not raise `--tint` above 12%. The table above is only valid at that strength.
- `--line` / `--line-strong` are decorative (1.7:1). Any focusable element's border uses `--line-control`.
- `--ink-3` is for timestamps, IDs, and unit suffixes only. Never a full sentence.
- Color is never the sole signal. Bands always carry their word, deltas always carry explicit `+` / `−`.

### Tailwind v4 mapping

```css
@import 'tailwindcss';

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-sunk: var(--surface-sunk);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-line-control: var(--line-control);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-red: var(--ink-red);
  --color-amber: var(--ink-amber);
  --color-green: var(--ink-green);
  --color-steel: var(--ink-steel);
  --color-mimeo: var(--ink-mimeo);

  --font-display: 'Instrument Serif', 'Iowan Old Style', Georgia, serif;
  --font-sans: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --radius-none: 0px;
  --radius-xs: 2px;
  --radius-sm: 3px;
  --radius-md: 4px;
}
```

`@theme inline` (not plain `@theme`) is required so utilities reference the live custom properties and re-resolve on theme flip.

---

## 2. Typography

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Archivo:wght@400..700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400..700&display=swap" />
```

| Family | Job | Never for |
|---|---|---|
| **Instrument Serif** | Mastheads, route titles, contributor names, **the belief pull-quote** | Anything under 24px |
| **Archivo** | All UI: prose, labels, buttons, table headers | Numbers, timestamps, code |
| **JetBrains Mono** | Every number, score, delta, timestamp, PR id, similarity, diff, action output, stamp text | Prose |

Instrument Serif ships regular + italic only. That is intentional — it is a display face, and reaching for bold means you're using it too small.

| Token | Size / line-height / tracking | Family, weight | Use |
|---|---|---|---|
| `display-xl` | 64 / 0.92 / -0.02em | Instrument Serif 400 | Dossier name |
| `display-l` | 44 / 1.00 / -0.015em | Instrument Serif 400 | Route titles, Case File PR title |
| `belief` | 30 / 1.35 / -0.01em | Instrument Serif 400 | **The belief pull-quote — the only typed element** |
| `display-m` | 30 / 1.10 / -0.01em | Instrument Serif 400 | Section headings |
| `title` | 21 / 1.25 / -0.005em | Archivo 600 | Card titles |
| `prose` | 16.5 / 1.65 / 0 | Archivo 400 | Agent prose (assessments, verdict reasoning) |
| `body` | 15 / 1.55 / 0 | Archivo 400 | General copy |
| `body-sm` | 13.5 / 1.5 / 0 | Archivo 400 | Card secondary text |
| `label` | 11 / 1.2 / **0.16em** uppercase | Archivo 600 | Section labels, band labels, column heads |
| `mono` | 14 / 1.55 / 0 | JetBrains Mono 400 | Evidence text, action output |
| `mono-sm` | 12 / 1.45 / 0.01em | JetBrains Mono 400 | Timestamps, IDs, similarity |
| `numeral-xl` | 72 / 1.0 / -0.03em | JetBrains Mono 700 | Dossier credibility total |
| `numeral` | 20 / 1.1 / -0.01em | JetBrains Mono 700 | Ledger sums, inline scores |
| `numeral-sm` | 15 / 1.2 / 0 | JetBrains Mono 700 | Ledger line deltas |

**Rules:** `font-variant-numeric: tabular-nums` on every element containing digits — non-negotiable, or the ledger columns won't align and the score jitters while it tweens. Agent prose caps at `66ch`; nothing else has a prose measure. The `label` style is the connective tissue that makes this read as filed documentation rather than an app — use it liberally.

---

## 3. The verdict stamp

**Scarce by construction.** Exactly one stamp exists per case, at one size, applied to the PR. Everywhere else — docket, history rows, comparison headers — status is plain `label`-styled text in the verdict ink. If you find yourself adding a second stamp to a screen, the answer is plain text.

### Placement

The stamp is applied **to the PR title block, never over or beside the author's name.** The agent judges code, not people, and the visual grammar has to say so. On the Case File it sits top-right of the PR title, overlapping the header's bottom rule by ~14px (`z-index: 2`) so it reads as applied to the page rather than laid out in a box. Author identity lives on a separate line below, always in plain text.

### Geometry — one size

```html
<span class="stamp stamp--blocked" role="img" aria-label="Verdict: blocked">BLOCKED</span>
```

```css
.stamp {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-weight: 700; font-size: 30px;
  letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap;
  padding: 14px 28px 14px 34px;      /* +6px left: optical, tracking adds trailing space */
  border: 3px solid currentColor; border-radius: 2px;
  background: color-mix(in oklab, currentColor var(--tint), transparent);
  transform: rotate(var(--stamp-rot));
  position: relative;
}
.stamp::before {                      /* double rule */
  content: ''; position: absolute; inset: 5px;
  border: 1px solid currentColor; border-radius: 1px;
  opacity: 0.75; pointer-events: none;
}
```

Narrow viewports (`< 768px`) step down to `font-size: 20px; letter-spacing: 0.18em; padding: 10px 18px 10px 22px; border-width: 2px`.

### Per-verdict

| Verdict | color | `--stamp-rot` |
|---|---|---|
| `blocked` | `var(--ink-red)` | `-4.5deg` |
| `commented` | `var(--ink-amber)` | `-3deg` |
| `approved` | `var(--ink-green)` | `-2deg` |

The tilt is **static identity, not animation** — the same verdict always sits at the same angle, so it reads as one physical stamp reused. `investigating` has no stamp at all: an in-progress case shows plain text `INVESTIGATING` in `--ink-steel` with a pulsing 6px square. Nothing has been decided, so nothing is stamped.

### Ink texture

Rubber stamps bleed and skip. Two cheap layers get most of the way:

```css
.stamp { mix-blend-mode: screen; opacity: 0.94; filter: url(#stamp-distress); }
:root[data-theme='light'] .stamp { mix-blend-mode: multiply; }
```

Mount once in `<App>` (`position:absolute; width:0; height:0`):

```html
<svg aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0">
  <filter id="stamp-distress" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"
                       xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
```

`scale="1.6"` is the ceiling; above ~2 the letterforms mush. Since there is now at most one stamp per screen, the filter cost is negligible.

### Entrance: overshoot and settle

**Scale only. No fade, no rotation tween.** A stamp doesn't materialize — it's suddenly there, hard, and rocks to rest.

```css
@keyframes stamp-press {
  0%   { transform: rotate(var(--stamp-rot)) scale(1.18); }
  55%  { transform: rotate(var(--stamp-rot)) scale(0.965); }
  78%  { transform: rotate(var(--stamp-rot)) scale(1.012); }
  100% { transform: rotate(var(--stamp-rot)) scale(1); }
}
.stamp--press { animation: stamp-press 380ms cubic-bezier(0.34, 1.2, 0.44, 1) both; }
```

Full opacity from frame 0. Pair with a one-shot impact on the **container** (never the stamp): `translateY(0 → 2px → 0)` over 120ms starting at 200ms. That shove is what sells the weight.

Announce the verdict through a visually-hidden `aria-live="polite"` region, not the animation.

---

## 4. Credibility as a ledger

**A bare per-person score is banned.** Credibility renders as visible arithmetic scoped to a subsystem — a column a judge can add up — and it always displays as `31 · auth`, never `31`.

### Format

`numeral` for the figure, a `·` separator in `--ink-3`, subsystem in `label` style. On the Dossier the figure is `numeral-xl`, and the subsystem label sits directly beneath it in the band ink.

### The ledger block

```
CREDIBILITY LEDGER · AUTH
────────────────────────────────────────────────
  OPENING BALANCE                            64
  #391   auth regression, shipped           −18
  #404   missing authz on two routes        −12
▲ #433   clean fix, tested, narrow scope     +4
  #481   repeat of the #391 failure mode     −7
────────────────────────────────────────────────
  BALANCE                              31 · auth
```

- Whole block in `mono`, right-aligned numeric column, `tabular-nums`. PR id `--ink-2`, reason `--ink-2`, delta `numeral-sm` in green/red by sign with explicit `+`/`−`.
- **The column must actually sum.** The backend supplies `openingBalance`; a judge *will* add it up. If the arithmetic doesn't check out the entire premise fails, so assert it in a dev-mode console check and render a visible `LEDGER MISMATCH` warning if the sum ≠ balance.
- The `BALANCE` row is separated by a 1px `--line-strong` rule above and 2px below — a real accounting double-rule.
- Each PR row links to `/review/:id`.

### Recovery is celebrated

`+` rows are the argument that the score is **earnable, not a permanent mark**. They get: a `▲` marker in the left gutter, green ink on the delta, a 12% green field tint across the row, and the reason in `--ink` (not `--ink-2`) — recovery reasons are the only ledger reasons at full ink. On the Dossier, the largest recovery gets a callout above the ledger:

```
┌──────────────────────────────────────────────┐
│ ▲ EARNED BACK                                │   green left border 3px,
│   #433 — clean fix, tested, narrow scope  +4 │   green 12% tint
│   "This is what I want from him."            │   agent prose, --ink
└──────────────────────────────────────────────┘
```

When a `+` delta lands live, the row plays a 700ms left-to-right green sweep (`background-size: 0% → 100%` on a linear-gradient). Negative deltas get no sweep — punishment is quiet, recovery is loud. That asymmetry is a deliberate argument about the product.

### Bands

| Band | Range | Ink | Label |
|---|---|---|---|
| `trusted` | ≥ 100 | `--ink-green` | `TRUSTED` |
| `watch` | 50–99 | `--ink-amber` | `UNDER WATCH` |
| `suspect` | < 50 | `--ink-red` | `SUSPECT` |

### Inline contributor chip

Appears **only inside the stream at a retrieval moment**, and on the Dossier header. Never ambient, never in a row with other people.

```
┌─────────────────────────────┐
│▌KEVIN    31 · auth  SUSPECT │
└─────────────────────────────┘
```

Height 34px, 3px band-ink left bar, `border: 1px solid var(--line-control)`, `border-radius: 3px`, `background: var(--surface)`. Name in `label`, figure in `numeral-sm`, subsystem + band in `label` `--ink-3`. No avatars, no circles, no pills. Links to the Dossier.

### Sparkline

44px tall, `stroke-width: 1.5`, `stroke: currentColor` from the band ink, `vector-effect: non-scaling-stroke`. No axes, no dots — except a 3px **square** marker on the final point. 10% area fill beneath. A 1px dashed `--line-strong` rule marks the nearest band threshold, so the sparkline shows *proximity to demotion*, which is the actual story.

---

## 5. Spacing, borders, elevation

```css
:root {
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px; --s-5: 24px;
  --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px;
  --r-1: 2px;  --r-2: 3px;  --r-3: 4px;        /* 4px is the maximum, anywhere */
  --gutter: var(--s-5);
  --rail-w: 340px;
  --stream-max: 860px;
  --prose-max: 66ch;
}
@media (max-width: 767px) { :root { --gutter: var(--s-4); } }
```

**Borders.** Panels/cards `1px solid var(--line-strong)`. In-list separators `1px solid var(--line)`. Interactive controls `1px solid var(--line-control)`. **Dashed** `1px dashed var(--line)` is reserved for one meaning: *asserted but not yet proven* — the memory the agent wrote back, and loading placeholders.

**Elevation — hard offset only, never `blur > 0`.**

```css
--elev-1: 2px 2px 0 var(--shadow-hard);   /* evidence cards, docket rows */
--elev-2: 3px 3px 0 var(--shadow-hard);   /* memo blocks, Case File header */
--elev-3: 5px 5px 0 var(--shadow-hard);   /* active-investigation banner only */
```

**Focus (global, once):**

```css
:where(a, button, [tabindex], input, select, summary):focus-visible {
  outline: 2px solid var(--focus); outline-offset: 2px; border-radius: inherit;
}
```

**Selection:** `::selection { background: var(--select-bg); color: var(--ink); }`

---

## 6. Surface texture

One layer on `body::before`, `pointer-events: none`, `z-index: 0`; all content at `z-index: 1`+.

```css
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    repeating-linear-gradient(to bottom, transparent 0 27px, var(--texture-ink) 27px 28px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  background-size: auto, 140px 140px;
  opacity: 0.5; mix-blend-mode: overlay;
}
```

Keep it at the threshold of perception. If you can consciously see the noise, halve the opacity.

---

## 7. Motion and stream rhythm

The stream is a piece of **timing**, not a feed. It has a shape: statement → burst → routine → **silence** → twist → judgment. The silence is load-bearing.

### 7.0 Playback contract

- The arc **plays once** per session and then rests in its completed state. It never loops while someone is watching.
- On reload within the same session (`sessionStorage`), `/` renders the completed arc **instantly**, no playback — judges refresh, and a refresh must not restart a 45-second animation.
- A `▸ REPLAY` button (ghost style) sits in the masthead, always available, to run the arc again for the next judge.
- With no backend, the arc is labelled plainly: `REPLAY · RECORDED 14:22` in `label` style, `--ink-3`. **No "fixture mode" badge** — it is a replay of a real case, and calling it a fixture undersells it.

### 7.1 The rhythm

| Beat | Element | Motion | Timing |
|---|---|---|---|
| 1. Case opened | compact mono line | fade+rise | 220ms |
| 2. **Belief** | **serif pull-quote, full stream width** | **typewriter — the only typed element** | 28 ch/s |
| 3. Retrieval | **burst** of 3 small mono cards | rapid stagger | 160ms each, **90ms** apart |
| 4. Actions | compact mono lines | fade+rise | 220ms, 400ms apart |
| 5. **Stillness** | `⋯` in the gutter | fade in, then **nothing moves** | **1500ms** |
| 6. Escalation | mimeo-bordered row | border sweep + tint flash | 600ms |
| 7. **Judgment** | **full-width**, breaks the gutter | stamp press | 380ms |
| 8. Credibility | ledger row appended | number tween + sweep | 700ms |

**The stillness beat (step 5) is the single most important timing in the product.** After the last routine action, hold 1500ms with nothing moving. A `⋯` fades into the gutter in `--ink-3` at 400ms and holds. **Do not skip the visible marker** — without it, a 1.5-second freeze reads as the demo hanging; with it, it reads as the agent hesitating. Then escalation lands into the silence.

### 7.2 Typewriter — belief only

Nothing else types. Retrievals burst, actions appear, judgment lands. Restricting typing to the belief is what makes the belief feel like thought and everything else feel like machinery.

- Rate 28 chars/sec (36ms/char). If `text.length > 240`, switch to word-by-word at 55ms/word.
- Caret `▌` in `--ink-3`, `animation: caret-blink 1.06s steps(2, start) infinite`, removed on completion.
- Set in `belief` type (Instrument Serif 30/1.35), full stream-column width, no card, no border — it sits directly on the page like a pull-quote. A 3px `--ink-2` left rule is the only chrome.
- **Skip:** clicking the stream or pressing `Esc` completes all in-flight timing instantly and jumps to the resting state. Judges will do this.
- **A11y:** the animated node is `aria-hidden="true"`; write the full string once into a visually-hidden sibling inside the `aria-live="polite"` region on completion, so screen readers get one clean announcement rather than per-character noise.

```css
@keyframes caret-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
```

### 7.3 Retrieval burst

Three **small** mono cards (not the full evidence cards of the Case File) arriving as a fast cluster — the visual read is "it grabbed three things at once", so keep them tight and quick.

```css
@keyframes burst-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.retrieval-chip { animation: burst-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

Stagger 90ms. Cards are `--surface-2`, 1px `--line-strong`, one line of `mono-sm` truncated at two lines, kind glyph, similarity number. They lay out in a horizontal row at `≥768px`, stacked below.

### 7.4 Escalation

- 3px `--ink-mimeo` left border sweeps in via `scaleY(0 → 1)`, `transform-origin: top`, 600ms `cubic-bezier(0.16,1,0.3,1)`.
- Row background flashes to `color-mix(in oklab, var(--ink-mimeo) 8%, transparent)`, decaying over 900ms.
- Glyph `▲` scales `1 → 1.25 → 1` over 400ms.
- The row **names its cause** (§8.3).

### 7.5 Judgment

Breaks the 40px gutter and spans the full stream column — the only event that does. Contains the stamp (`stamp-press`), the verdict reasoning in `prose`, and the posted-review artifact (§8.6).

### 7.6 Credibility change

Number tweens over 700ms `easeOutCubic` via `requestAnimationFrame`, `tabular-nums`, rounded each frame. If it crosses a band threshold the ink cross-fades over the same 700ms and the band word swaps at 50%. New ledger row appends with the recovery sweep if positive (§4).

### 7.7 Ambient

- **Live indicator:** 6px **square**, `opacity: 1 → 0.35 → 1`, 1.8s ease-in-out. Removed entirely once the arc rests.
- **Rail:** width `340px ↔ 0`, 260ms `cubic-bezier(0.4,0,0.2,1)`; contents cross-fade in the first 140ms so text never squashes.
- **Route transitions:** none. Instant. On a demo, a page transition reads as latency.
- **Auto-scroll:** pins to bottom only when the user is within 80px of it; otherwise freezes and shows a `↓ N NEW` button (`label`, `--ink-steel`). Nothing is worse in a demo than a feed that yanks you away mid-read.

### 7.8 Reduced motion

The hero *is* animation, so this needs real handling, not just a blanket disable.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important; animation-iteration-count: 1 !important;
    transition-duration: 1ms !important; scroll-behavior: auto !important;
  }
  .stamp { transform: rotate(var(--stamp-rot)); }   /* tilt is identity, keep it */
}
```

Plus five JS-side behaviors, gated on `window.matchMedia('(prefers-reduced-motion: reduce)').matches`:

1. **The arc does not play.** `/` renders the complete, finished stream immediately on load — every event, the stamp, the final ledger. Timed playback is skipped entirely.
2. Typewriter renders the full string at once, no caret.
3. Number tweens snap to final values.
4. The 1500ms stillness beat is not inserted.
5. Live indicator holds a static `opacity: 0.7`.

**This is a required test path, not a fallback.** Everything a judge needs to see must be present and legible with reduced motion on.

---

## 8. Components

### 8.1 Event row

```
 ┌─ 40px ─┐
 │        │
 │   ◆    │  BELIEF                                          14:22:07
 │   │    │
 │   │    │  ▌ Kevin has credibility 31 in auth. His last
 │   │    │  ▌ two auth PRs both regressed.▌
 │   │    │     ↑ Instrument Serif 30px — the only typed element
 └────────┘
```

40px gutter with a continuous 1px `--line` spine at x=20, glyph centered on it, a 3px `--bg` gap punched around the glyph so the spine appears to pass behind. Glyph in mono 13px. Label row in `label` type, verdict-colored, timestamp right-aligned in `mono-sm` `--ink-3`.

| Event | Glyph | Ink | Label |
|---|---|---|---|
| `review_started` | `○` | `--ink-2` | `CASE OPENED` |
| `belief` | `◆` | `--ink` | `BELIEF` |
| `retrieval` | `⧉` | `--ink-2` | `MEMORY RETRIEVED` |
| `action` | `▸` | `--ink-steel` | `ACTION` |
| *(stillness)* | `⋯` | `--ink-3` | *(none)* |
| `escalation` | `▲` | `--ink-mimeo` | `ESCALATED — OPENROUTER CRITIC` |
| `judgment` | `■` | per-verdict | `JUDGMENT` |
| `credibility_change` | `±` | per-direction | `CREDIBILITY REVISED` |
| `incident_attributed` | `!` | `--ink-red` | `INCIDENT ATTRIBUTED` |

### 8.2 Memo block

The agent's own voice: assessments, verdict reasoning. `--surface-2`, `1px solid var(--line-strong)`, `border-left: 3px solid var(--ink-2)`, `--elev-2`, `--r-1`, padding `--s-5`. Prose in `prose`/`--ink`, max `--prose-max`. A `label` header row above (`ASSESSMENT — REVISED 2 HOURS AGO`).

On the Dossier the **first sentence renders in Instrument Serif italic 21px** as a lead-in, then the rest in Archivo. Two lines of CSS; it makes the agent's voice feel authored rather than generated.

### 8.3 Causal links (`causedBy`)

**A log is RAG; a causal chain is an agent.** Every action and escalation that a memory triggered must name it, visibly and bidirectionally.

- The triggering evidence card carries `id={memoryId}` and `data-cause="mem_031"`.
- The triggered row renders a link beneath its label: `⤷ BECAUSE OF: inc_0031 — "expired sessions accessible"`, `mono-sm`, `--ink-mimeo`, underlined on hover.
- **Bidirectional highlight:** hovering or focusing either end adds `.is-linked` to both — a 2px `--ink-mimeo` left border and an 8% mimeo tint, 120ms. Reciprocal highlight is what makes the causality legible rather than decorative.
- Clicking the link scrolls the counterpart into view and flashes it (240ms tint pulse), `scroll-margin-top: var(--s-6)`.
- On the Case File at `≥1024px`, additionally draw a 1px `--ink-mimeo` SVG bezier connector at 45% opacity in the left gutter between the two rows. Below 1024px the text link alone carries it.

### 8.4 Evidence card

```
┌─────────────────────────────────────────────┐
│ ⧉ INCIDENT              0.94 ▰▰▰▰▰▱          │
│ ─────────────────────────────────────────── │
│ Kevin's PR #391 introduced an auth bypass   │
│ that shipped and caused a session leak.     │
│                                              │
│ ⤷ CAUSED: escalate → openrouter-critic      │
│ → inc_0031                    12 DAYS AGO   │
└─────────────────────────────────────────────┘
```

`--surface-2`, `1px solid var(--line-strong)`, `--elev-1`, `--r-1`, padding `--s-4`. Kind badge in `label`/`--ink-3` with glyph — `⧉` pr, `!` incident, `◈` self. Body in `mono`/`--ink-2` (evidence is quoted material). Footer: source id link `mono-sm`/`--ink-steel`, timestamp `mono-sm`/`--ink-3`.

**Every evidence card is clickable and lands somewhere real** — a `/review/:id` or an incident detail. No dead cards; a judge will click one.

**Self-memories** (`kind: "self"`, the agent's memory of its own failures) get `border-left: 3px solid var(--ink-mimeo)` and the label `SELF — REVIEW FAILURE`. The agent admitting its own miss is the emotional peak of the demo and must not look like every other card.

**Similarity meter:** `mono-sm` 700 tabular number, then a 48×6px track (`--surface-sunk`, radius 1px) filled to `similarity × 100%`. Fill: `≥0.85 → --ink-mimeo`, `0.65–0.84 → --ink-2`, `<0.65 → --ink-3`. `role="meter"` with `aria-valuenow/min/max`.

### 8.5 Diff hunk

**Prose asserting a diff is a story; the diff beside it is evidence.** Wherever the agent claims a specific code change, the hunk renders next to the claim.

```
┌ src/auth/session.ts ─────────────────── PR #481 ┐
│  47   const now = Date.now()                     │
│ −48   return session.expiresAt > now             │   red 12% tint row
│ +49   return session.issuedAt + TTL > now        │   green 12% tint row
│  50   }                                           │
└──────────────────────────────────────────────────┘
```

`--surface-sunk`, `1px solid var(--line-strong)`, `--r-1`, `mono` 13px. Header strip: file path `--ink-2`, PR id `--ink-3`, both `mono-sm`. Line numbers in `--ink-3`, `user-select: none`, right-aligned, 3.5ch column. Added rows: 12% green tint + `+` marker in `--ink-green`. Removed: 12% red tint + `−` marker in `--ink-red`. Context rows: `--ink-2`, untinted. `overflow-x: auto` on the hunk body — it must never widen the page.

The `+`/`−` markers are literal characters in the line, not just color, so the diff survives greyscale and colorblindness.

Placement: side by side with the prose at `≥1024px` (prose left 55%, hunk right 45%), stacked below with the hunk second.

### 8.6 Posted review (external artifact)

**The agent must visibly act outside our own app.** The Case File renders the actual comment body it posted to GitHub.

```
◈ POSTED TO GITHUB                    github.com/org/repo/pull/481 ↗
┌──────────────────────────────────────────────────────┐
│  ● RECEIPTS-AGENT  commented 2 hours ago             │
│  ────────────────────────────────────────────────── │
│  **Blocking.** This rotation issues a new refresh    │
│  token but never invalidates the prior one…          │
└──────────────────────────────────────────────────────┘
```

Deliberately styled a half-step toward GitHub's own comment box — `--surface`, `1px solid var(--line-control)`, `--r-3`, a header strip in `--surface-sunk` with the bot handle in `mono-sm` — so it reads as *a thing that exists elsewhere*, quoted here. This is the one place the design intentionally breaks its own document language, and that contrast is the point. The PR URL is a real external link with `↗`, `target="_blank"`, `rel="noopener noreferrer"`.

### 8.7 Control comparison (the theme proof)

**The highest-value screen in the product.** The identical auth diff, from Liam (118) and from Kevin (31). Same input, different behavior, memory the only variable.

Reachable as a toggle on the Case File header (`⇄ COMPARE WITH LIAM`) and as a card in the Courtroom's resting state. Renders as two columns sharing one diff.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  THE SAME DIFF, TWO AUTHORS                                               │
│  ─────────────────────────────────────────────────────────────────────    │
│  ┌ src/auth/session.ts ────────────────────────────────────────────────┐  │
│  │ −48   return session.expiresAt > now                                │  │  ← ONE shared
│  │ +49   return session.issuedAt + TTL > now                           │  │    diff, full width
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌───────────────────────────────┬───────────────────────────────────┐   │
│  │ ▌LIAM  118 · auth   TRUSTED   │ ▌KEVIN  31 · auth   SUSPECT       │   │
│  │ ───────────────────────────── │ ───────────────────────────────── │   │
│  │ SCRUTINY      normal          │ SCRUTINY      maximum             │   │
│  │ RETRIEVALS    1               │ RETRIEVALS    3                   │   │
│  │ ESCALATED     no              │ ESCALATED     yes — critic        │   │
│  │ ACTIONS       2               │ ACTIONS       5                   │   │
│  │ ───────────────────────────── │ ───────────────────────────────── │   │
│  │ BELIEF                        │ BELIEF                            │   │
│  │ "Liam has not regressed auth  │ "Kevin has credibility 31 in      │   │
│  │  in 40 PRs. Reading normally." │  auth. His last two auth PRs      │   │
│  │                                │  both regressed."                 │   │
│  │ ───────────────────────────── │ ───────────────────────────────── │   │
│  │ APPROVED                      │ BLOCKED                           │   │
│  │ ↑ plain text, green           │ ↑ plain text, red                 │   │
│  └───────────────────────────────┴───────────────────────────────────┘   │
│                                                                            │
│  The diff is identical. The only variable is what the agent remembers.    │
│  ↑ Instrument Serif italic 21px, --ink, centered, max 60ch                │
└───────────────────────────────────────────────────────────────────────────┘
```

- Rows are a shared label grid so the two columns align exactly — the comparison only works if the eye can scan across. Use `display: grid` on the pair with a shared row track, not two independent lists.
- **Differing values only** are colored (`--ink`, band ink); identical values stay `--ink-2`. Difference should be the only thing that catches the eye.
- **No stamps here.** Two stamps side by side would halve the force of both. Verdicts are plain `label` text in verdict ink, per §3.
- The closing line is the thesis of the entire project. Give it room: `--s-7` above, centered, serif italic.
- Below `860px` the columns stack with the Liam block first, each keeping its own label column.

### 8.8 Loading, empty, error

**No shimmer.** Shimmer skeletons are the clearest tell of a template. Use dashed document placeholders: `1px dashed var(--line-strong)` at the real component's dimensions with centered `mono-sm` `--ink-3` — `RETRIEVING…`, `AWAITING TRANSMISSION`, `FILE NOT YET OPENED`.

Empty docket: `display-m` in `--ink-3` — `NO ACTIVE CASES` — with `body-sm` beneath: "The agent is idle. It is still watching."

Error boundary: a memo block with `border-left: 3px solid var(--ink-red)`, label `CASE FILE CORRUPTED`, error text in `mono`, and a `RETRY` button.

### 8.9 Buttons

One style, two weights, square-ish and mono so they read as document actions.

- **Primary:** `background: var(--ink)`, `color: var(--bg)`, `1px solid var(--ink)`, `label` type at 12px, padding `9px 16px`, `--r-2`. Hover inverts to transparent/`--ink`.
- **Ghost:** transparent, `--ink-2`, `1px solid var(--line-control)`. Hover → `--ink` text and border.
- Active on both: `translateY(1px)`, shadow drops one level. No scale transforms.

---

## 9. Route layouts

Breakpoints `sm 480 / md 768 / lg 1024 / xl 1280`. Verified to **360px**.

### 9.1 `/` — The Courtroom

**At rest, before the arc runs, the page shows the agent and nothing else.** No contributor strip, no leaderboard, no ambient scores. The docket rail is collapsed to a 44px vertical tab.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  RECEIPTS                     REPLAY · RECORDED 14:22   ▸ REPLAY    ☾/☀   │D│ │  ← rail tab,
│  ──────────────────────────────────────────────────────────────────────  │O│ │    collapsed
├──────────────────────────────────────────────────────────────────────────│C│─┤
│ ■ NOW INVESTIGATING                                                      │K│ │
│ PR #481 · Refresh-token rotation    SCRUTINY: MAXIMUM   ⧗ 00:41  ▪ LIVE  │E│ │  --elev-3
│   ↑ author on its own line below, plain text, never stamped              │T│ │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   ○   CASE OPENED                                              14:22:03       │
│   │   PR #481 · scrutiny MAXIMUM                                              │
│   │                                                                            │
│   ◆   BELIEF                                                   14:22:07       │
│   │                                                                            │
│   │  ▌ Kevin has credibility 31 in auth. His last two                         │
│   │  ▌ auth PRs both regressed in production.▌                                │
│   │     ↑ Instrument Serif 30px. THE ONLY TYPED ELEMENT.                      │
│   │                                                                            │
│   ⧉   MEMORY RETRIEVED                                         14:22:11       │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     │
│   │   │! inc_0031 .94│ │⧉ pr_404  .81 │ │◈ self    .77 │  ← fast burst,      │
│   │   │ session leak │ │ no authz     │ │ I missed it  │    90ms apart        │
│   │   └──────────────┘ └──────────────┘ └──────────────┘                     │
│   │   ┌───────────────────────────────────┐                                   │
│   │   │▌KEVIN   31 · auth       SUSPECT   │  ← chip appears HERE ONLY,        │
│   │   └───────────────────────────────────┘    at the moment of retrieval     │
│   │                                                                            │
│   ▸   ACTION            read_diff · src/auth/session.ts        14:22:14       │
│   ▸   ACTION            search_history · "token rotation"      14:22:19       │
│   │                                                                            │
│   ⋯                                                    ← 1500ms STILLNESS.     │
│   │                                                      Nothing moves.        │
│   │                                                                            │
│   ▲   ESCALATED — OPENROUTER CRITIC                            14:22:26       │
│   │   ⤷ BECAUSE OF: inc_0031 — "expired sessions accessible"                  │
│   │   Confidence below threshold on an auth path with a prior regression.     │
│   │                                                                            │
├───────────────────────────────────────────────────────────────────────────────┤
│  ■  JUDGMENT                                                    14:22:38      │  ← FULL WIDTH,
│                                                  ╔═══════════════╗            │    breaks gutter
│     Same failure mode as #391. I do not believe  ║   BLOCKED     ║            │
│     this rotation invalidates the old token.     ╚═══════════════╝            │
│                                                                                │
│     ◈ POSTED TO GITHUB          github.com/org/repo/pull/481 ↗                │
├───────────────────────────────────────────────────────────────────────────────┤
│   ±   CREDIBILITY REVISED                                      14:22:39       │
│   │   KEVIN   31 → 24 · auth      −7   repeat of the #391 failure mode        │
│                                                                                │
│   ┌────────────────────────────────────────────────────────────────────┐      │
│   │  ⇄  THE SAME DIFF, FROM LIAM                                       │      │  ← resting state
│   │     Liam submitted this exact diff. The agent approved it.  VIEW → │      │    surfaces the
│   └────────────────────────────────────────────────────────────────────┘      │    control proof
│  ← 40px ──────────── stream column, max 860px ──────────────────────►         │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Grid:** `grid-template-columns: minmax(0,1fr) 44px` collapsed, `minmax(0,1fr) var(--rail-w)` expanded. The stream centers its 860px max inside `1fr`.
- **Rail:** collapsed by default at every breakpoint. The 44px tab shows `DOCKET` rotated 90° (`writing-mode: vertical-rl`), `label` type. Expanded it holds ≤4 active cases and ≤3 incidents as plain text with plain-text status — **no filters, no sorting, no status counts.** The moment it grows controls it becomes a dashboard. `aria-expanded`, keyboard-reachable, state in `localStorage`.
- **Scroll:** `body` doesn't scroll. The stream column and rail each own `overflow-y: auto` with `min-height: 0`. Masthead and banner are fixed structure.
- **Resting state** (arc complete): live indicator removed, banner status → `CLOSED · BLOCKED` in plain text, and the control-comparison card appears at the foot of the stream. That card is the last thing a judge reads, which is where the theme proof belongs.
- **Responsive:** `<1024px` rail becomes a bottom sheet at max 40vh. `<768px` masthead → `display-m`, banner stacks to two lines, retrieval burst stacks vertically, judgment stamp steps to 20px. `<480px` gutter narrows to 28px.

### 9.2 `/contributor/:id` — The Dossier

**Depth parity is a hard requirement.** Liam's dossier must be as finished as Kevin's — real positive memories, a real assessment, real ledger entries. A judge will click the trusted contributor to check whether the product only knows how to be suspicious. Liam's memories include things like "caught a race condition in review of #402" as `kind: "self"` — the agent remembering being *helped*.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ← BACK TO COURTROOM                                                          │
│  ──────────────────────────────────────────────────────────────────────────   │
│  SUBJECT FILE · KEV-0031                                                      │
│                                                                                │
│  Kevin                                          ┌──────────────────────────┐  │  display-xl
│                                                 │   ╱╲    ╱╲               │  │
│      31                                         │  ╱  ╲__╱  ╲___           │  │
│      · AUTH        ← scope always shown         │ ╱           ╲__▪         │  │
│      ▌SUSPECT                                   │ - - - - - - - - -  50    │  │
│  ──────────────────────────────────────────────────────────────────────────   │
├──────────────────────────────────────────┬────────────────────────────────────┤
│ ▲ EARNED BACK                             │  WHAT THE AGENT REMEMBERS          │
│ ┌──────────────────────────────────────┐ │  ────────────────────────────────  │
│ │ #433 clean fix, tested, narrow  +4   │ │  ┌──────────────────────────────┐ │
│ │ "This is what I want from him."      │ │  │ ◈ SELF — REVIEW FAILURE      │ │  mimeo border
│ └──────────────────────────────────────┘ │  │ My original review of #481   │ │
│                                            │  │ failed to catch this.        │ │
│ THE ASSESSMENT                             │  │ → pr_481          4d AGO     │ │
│ ┌──────────────────────────────────────┐ │  └──────────────────────────────┘ │
│ │▌ ASSESSMENT — REVISED 2 HOURS AGO    │ │  ┌──────────────────────────────┐ │
│ │                                       │ │  │ ! INCIDENT           0.94    │ │
│ │  I do not trust Kevin on auth.        │ │  │ Expired sessions accessible  │ │
│ │  ↑ Instrument Serif italic 21px       │ │  │ after logout.                │ │
│ │                                       │ │  │ → inc_0031        4d AGO     │ │
│ │  Twice now he has shipped a session   │ │  └──────────────────────────────┘ │
│ │  path that read correct in isolation  │ │  ┌──────────────────────────────┐ │
│ │  and failed in production. His #433   │ │  │ ⧉ PR                         │ │
│ │  fix was clean, which is why he is    │ │  │ #391 auth bypass, merged     │ │
│ │  at 31 and not lower. I am not        │ │  │ → pr_391         31d AGO     │ │
│ │  punishing him. I am watching him.    │ │  └──────────────────────────────┘ │
│ └──────────────────────────────────────┘ │                                    │
│                                            │  Every card is a real link.        │
│ CREDIBILITY LEDGER · AUTH                  │                                    │
│ ────────────────────────────────────────  │                                    │
│   OPENING BALANCE                    64   │                                    │
│   #391  auth regression, shipped    −18   │                                    │
│   #404  missing authz, two routes   −12   │                                    │
│ ▲ #433  clean fix, tested            +4   │  ← green tint row, ▲ marker        │
│   #481  repeat of #391 failure       −7   │                                    │
│ ════════════════════════════════════════  │                                    │
│   BALANCE                     31 · auth   │  ← the column must SUM             │
│                                            │                                    │
│ ◄──────────── 62% ──────────────────────► │◄────────── 38% ──────────────────►│
└───────────────────────────────────────────────────────────────────────────────┘
```

The header is full-bleed on `--surface` with a 1px `--line-strong` bottom rule. Below `lg` the columns stack: earned-back, assessment, memories, ledger. Below 768px `display-xl → display-l`, `numeral-xl → 52px`, sparkline moves under the score.

### 9.3 `/review/:id` — The Case File

A single vertical narrative, max 820px, readable top to bottom.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ← BACK TO COURTROOM                              ⇄ COMPARE WITH LIAM         │
│  ──────────────────────────────────────────────────────────────────────────   │
│  CASE FILE · PR-481                                                           │
│                                                            ╔═══════════════╗  │
│  Refresh-token rotation                                    ║   BLOCKED     ║  │  ← stamp on the
│                                                            ╚═══════════════╝  │    PR TITLE,
│  ──────────────────────────────────────────────────────────────────────────   │    overlapping
│  KEVIN · 31 · auth        SCRUTINY: MAXIMUM   14:22:03 → 14:22:38             │    the rule
│  ↑ author on its own line, plain text, NEVER under the stamp                  │
│                                                                                │
│  ◆ THE BELIEF                                                                 │
│  ┌──────────────────────────────────────────────────────┐                     │
│  │▌ FORMED AT 14:22:07                                   │                     │
│  │  Kevin has credibility 31 in auth. His last two auth  │                     │
│  │  PRs both regressed in production.                    │                     │
│  └──────────────────────────────────────────────────────┘                     │
│                                                                                │
│  ⧉ EVIDENCE RETRIEVED · 3 MEMORIES                                            │
│  ┌────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐│
│  │ ! INCIDENT   0.94 ▰▰▰▰▰│ │ ⧉ PR      0.81 ▰▰▰▰▱ │ │ ◈ SELF     0.77 ▰▰▰▱ ││
│  │ Expired sessions…      │ │ #404 no authz…       │ │ My review of #391…   ││
│  │ ⤷ CAUSED: escalate     │ │ ⤷ CAUSED: read_tests │ │                      ││  ← causal links
│  │ → inc_0031   12d AGO   │ │ → pr_404     9d AGO  │ │ → pr_391    31d AGO  ││
│  └────────────────────────┘ └──────────────────────┘ └──────────────────────┘│
│                                                                                │
│  ⚑ WHAT ACTUALLY CHANGED                                                      │
│  ┌──────────────────────────────┬───────────────────────────────────────────┐ │
│  │ The agent claims #481 changed│ ┌ src/auth/session.ts ──────── PR #481 ┐ │ │
│  │ the expiry comparison from   │ │  47   const now = Date.now()          │ │ │
│  │ absolute time to a TTL       │ │ −48   return session.expiresAt > now  │ │ │  ← red tint
│  │ window — so a token issued   │ │ +49   return session.issuedAt+TTL>now │ │ │  ← green tint
│  │ before logout stays valid.   │ │  50   }                                │ │ │
│  └──────────────────────────────┴───────────────────────────────────────────┘ │
│    ↑ the claim                     ↑ the proof. Never render one without      │
│                                      the other.                                │
│                                                                                │
│  ▸ ACTIONS TAKEN · 5                                                          │
│  ─────────────────────────────────────────────────────────────────────────    │
│  14:22:14  read_diff        src/auth/session.ts                          [+] │
│  14:22:19  search_history   "token rotation" · 4 hits                    [+] │
│  14:22:26  escalate         openrouter-critic                            [+] │
│            ⤷ BECAUSE OF: inc_0031                                             │  ← mimeo border
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ The rotation issues a new refresh token but never invalidates the       │ │  ← --surface-sunk
│  │ prior one. Any leaked token remains valid until natural expiry.         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  14:22:33  read_tests       no test covers reuse of the old token        [+] │
│  14:22:36  compose_verdict  blocked                                      [+] │
│                                                                                │
│  ■ THE VERDICT                                                                │
│  ┌──────────────────────────────────────────────────────┐                     │
│  │▌ DECIDED AT 14:22:38 · BLOCKED                        │                     │  red left border
│  │  Same failure mode as #391. I have been wrong about   │                     │
│  │  Kevin's auth code twice. I am not going to be wrong  │                     │
│  │  a third time on my own recommendation.               │                     │
│  └──────────────────────────────────────────────────────┘                     │
│                                                                                │
│  ◈ POSTED TO GITHUB                    github.com/org/repo/pull/481 ↗         │
│  ┌──────────────────────────────────────────────────────┐                     │
│  │ ● RECEIPTS-AGENT  commented 2 hours ago              │                     │  ← the external
│  │ ──────────────────────────────────────────────────── │                     │    artifact
│  │ **Blocking.** This rotation issues a new refresh     │                     │
│  │ token but never invalidates the prior one…           │                     │
│  └──────────────────────────────────────────────────────┘                     │
│                                                                                │
│  ◈ FILED TO MEMORY                          KEVIN  31 → 24 · auth      −7    │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                       │  dashed: believed,
│  │ "Kevin's #481 repeated the #391 rotation failure.  │                       │  not yet proven
│  │  Escalate auth PRs from him until two clean ships." │                       │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                       │
│  ◄──────────────────── content column, max 820px ─────────────────────────►   │
└───────────────────────────────────────────────────────────────────────────────┘
```

Section markers reuse the stream's glyph + `label` vocabulary, so a judge who watched the Courtroom recognizes the Case File as the same events, filed. Actions use `<details>/<summary>` for free keyboard support. At `≥1280px` a sticky 140px left spine lists the section markers as jump links; below that it simply isn't rendered — no hamburger, no drawer.

Responsive: evidence 3-col → 2-col at `md` → 1-col at `sm`. The claim/diff pair stacks below `lg`, claim first. Action rows stack timestamp above kind/label below 640px. Stamp steps to 20px below 768px and moves above the PR title — still on the PR, never near the author line.

---

## 10. Reload and deep-link survival

Judges refresh and hit back. All three routes must render fully from the URL alone.

- `/contributor/:id` and `/review/:id` fetch (or read fixtures) from the route param on mount. No dependency on having visited `/` first.
- `/` renders correctly on cold load whether the arc has run this session or not (§7.0).
- Back/forward restores scroll position; the stream's own scroll container is exempt (it goes to the resting bottom).
- The control comparison is deep-linkable: `/review/:id?compare=liam`. Toggling it updates the URL via `history.pushState` so back closes the comparison rather than leaving the route.
- The rail's expanded state persists in `localStorage`; theme persists and is applied by a blocking inline script in `<head>` so there is no flash.
- A hard refresh mid-arc must not produce a half-rendered stream — the resting state is always a complete, coherent case.

---

## 11. Implementation checklist

- [ ] `tokens.css` imported before Tailwind; `@theme inline` mapping in place.
- [ ] The five v2 token changes applied (§1) — do not revert to v1 values.
- [ ] `data-theme` set by a blocking inline `<head>` script from `localStorage` → `prefers-color-scheme`.
- [ ] Google Fonts link with both `preconnect` hints and `display=swap`.
- [ ] `font-variant-numeric: tabular-nums` on every mono numeric element.
- [ ] **No contributor strip on `/`.** Chips appear only inside retrieval events and on the Dossier header.
- [ ] **Exactly one stamp per screen**, on the PR title, never adjacent to the author name. Plain text status everywhere else. Grep for `<Stamp` and count.
- [ ] Stamp animation is scale-only overshoot — no opacity fade, no rotation tween.
- [ ] Typewriter runs on the **belief only**.
- [ ] The 1500ms stillness beat is implemented **with its visible `⋯` marker**.
- [ ] Judgment event spans full width and breaks the gutter.
- [ ] Ledger sums check out; dev-mode assertion + visible `LEDGER MISMATCH` if not.
- [ ] Recovery rows carry `▲`, green tint, full-ink reason, and the live sweep.
- [ ] Every credibility figure displays its subsystem (`31 · auth`). Grep for bare renders.
- [ ] `causedBy` links are bidirectional and reciprocally highlight on hover/focus.
- [ ] Every diff claim is accompanied by its hunk.
- [ ] `postedReview` block renders with a working external PR link.
- [ ] Control comparison reachable from both `/` (resting) and the Case File; deep-linkable.
- [ ] Liam's dossier is as complete as Kevin's, with genuine positive memories.
- [ ] Every evidence card links somewhere real. Click all of them.
- [ ] Arc plays once, rests, and offers `▸ REPLAY`. No loop. No "fixture mode" badge.
- [ ] **Full pass with `prefers-reduced-motion: reduce` on** — everything renders instantly and completely, all five JS behaviors handled.
- [ ] All three routes survive hard refresh and deep link.
- [ ] Global `:focus-visible`; no `outline: none` anywhere.
- [ ] Verified at 360, 768, 1024, 1440px.
- [ ] Grep: no `border-radius` > 4px. No `box-shadow` with non-zero blur. No shimmer skeletons.

---

## 12. Changes from v1

If any v1 work already landed, these are the deltas:

| # | Change | Section |
|---|---|---|
| 1 | Contributor strip **removed** from `/`; chips now appear inline at retrieval moments only | §4, §9.1 |
| 2 | Arc plays **once** then rests; `▸ REPLAY` button; **"fixture mode" badge deleted**, replaced by plain `REPLAY · RECORDED` label | §7.0 |
| 3 | **New:** control comparison component — same diff, two authors | §8.7 |
| 4 | **New:** diff hunk component; every diff claim must render its hunk | §8.5, §9.3 |
| 5 | **New:** `causedBy` bidirectional causal links | §8.3 |
| 6 | Credibility rewritten as a summed ledger scoped to subsystem; recovery celebrated; bare scores banned | §4 |
| 7 | Stamp reduced to **one size, one per case**; `sm`/`md` variants and the `investigating` stamp deleted; entrance is scale-only overshoot with no fade or rotation tween; placement fixed to the PR title | §3 |
| 8 | Stream rhythm restructured: typewriter belief-only, retrieval burst, full-width judgment, **1500ms stillness beat** | §7.1–7.5 |
| 9 | Dossier depth parity required for Liam; every evidence card must link somewhere real | §8.4, §9.2 |
| 10 | **New:** reload/deep-link survival requirements; reduced motion promoted to a required test path with five explicit JS behaviors | §7.8, §10 |
| 11 | **New:** posted-review external artifact block | §8.6 |
| — | Five color tokens changed to fix AA failures against their own field tints | §1 |

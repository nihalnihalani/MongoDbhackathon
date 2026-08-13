/**
 * Making causation visible (DESIGN.md §8.3).
 *
 * A log is RAG; a causal chain is an agent. The difference between the two, on
 * screen, is whether a reader can tell that the retrieval *caused* the action or
 * merely *preceded* it. Text alone cannot carry that — the rows are adjacent
 * either way — so the link is drawn three ways at once:
 *
 *   1. a one-shot pulse on the causing card the moment the caused row lands,
 *   2. a reciprocal highlight when either end is hovered or focused,
 *   3. a drawn connector in the gutter on wide viewports.
 *
 * All three are driven from here against `data-mem` / `data-caused-by`
 * attributes rather than through React state, because the two ends of a link
 * live in different, non-adjacent rows of a streaming list and threading state
 * between them would mean re-rendering the whole log to highlight one card.
 */

const LINKED = 'is-linked'
const PULSE = 'cause-pulse'

/** Every element representing memory `id` — the card, and any row citing it. */
function endpoints(ids: string[]): HTMLElement[] {
  if (typeof document === 'undefined') return []
  const found: HTMLElement[] = []
  for (const id of ids) {
    const escaped = CSS.escape(id)
    document
      .querySelectorAll<HTMLElement>(`[data-mem="${escaped}"], [data-caused-by~="${escaped}"]`)
      .forEach((el) => found.push(el))
  }
  return found
}

/**
 * Reciprocal highlight. Hovering the escalation lights the memory that caused
 * it, and hovering that memory lights the escalation — which is what makes the
 * relationship legible rather than decorative.
 */
export function setLinked(ids: string[], on: boolean): void {
  for (const el of endpoints(ids)) el.classList.toggle(LINKED, on)
}

/**
 * Fired once, as the caused row arrives: the memories responsible flash. This is
 * the moment the causal claim is actually made, so it is the moment it has to be
 * visible — a reader looking at the new row sees the old cards react to it.
 */
export function pulseCause(ids: string[]): void {
  const targets = endpoints(ids).filter((el) => el.dataset['mem'])
  for (const el of targets) {
    el.classList.remove(PULSE)
    // Force a reflow so the class re-application restarts the animation rather
    // than being coalesced into a no-op.
    void el.offsetWidth
    el.classList.add(PULSE)
  }
}

/** Clicking a causal link takes the reader to the counterpart and flashes it. */
export function revealCause(id: string): void {
  const target = document.querySelector<HTMLElement>(`[data-mem="${CSS.escape(id)}"]`)
  if (!target) return
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  })
  pulseCause([id])
}

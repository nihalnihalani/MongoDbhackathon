/**
 * Where a piece of evidence goes when you click it.
 *
 * DESIGN.md §8.4: every evidence card is clickable and lands somewhere real. A
 * judge will click one, and a card that goes nowhere — or worse, to a 404 —
 * undoes the argument that the agent's memory is real records rather than
 * generated prose.
 *
 * There is no incident route, so an incident resolves to the case file of the
 * PR it was attributed to, which is where its evidence actually lives.
 */

import { incidents } from '../fixtures/data'

/** "pr-481" → "rev-481". PRs and reviews are 1:1 in this system. */
export function reviewIdForPr(prId: string): string {
  return prId.replace(/^pr-/, 'rev-')
}

/**
 * A memory's `sourceId` → the route that shows the underlying record.
 * Falls back to the contributor dossier for person-scoped memories (standing
 * rules the agent wrote about someone rather than about a change).
 */
export function reviewPathForSource(sourceId: string): string {
  if (sourceId.startsWith('pr-')) return `/review/${reviewIdForPr(sourceId)}`

  if (sourceId.startsWith('inc-')) {
    const incident = incidents.find((i) => i.id === sourceId)
    if (incident?.attributedPrId) return `/review/${reviewIdForPr(incident.attributedPrId)}`
    if (incident?.attributedAuthorId) return `/contributor/${incident.attributedAuthorId}`
  }

  // Person-scoped: "kevin", "liam" — the standing rules live on the dossier.
  return `/contributor/${sourceId}`
}

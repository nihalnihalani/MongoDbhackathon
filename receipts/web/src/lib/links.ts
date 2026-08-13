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

import { caseFileFor, incidents } from '../fixtures/data'

/** "pr-481" → "rev-481". PRs and reviews are 1:1 in this system. */
export function reviewIdForPr(prId: string): string {
  return prId.replace(/^pr-/, 'rev-')
}

/**
 * A memory's `sourceId` → the route that shows the underlying record, or `null`
 * when no record is on file.
 *
 * Returning null rather than a hopeful URL is the whole point: not every PR the
 * agent remembers has a full case file, and a card that navigates to a 404 does
 * more damage than a card that is plainly not a link. The agent's credibility
 * with the reader rests on its records being real.
 */
export function reviewPathForSource(sourceId: string): string | null {
  if (sourceId.startsWith('pr-')) {
    const caseFile = caseFileFor(sourceId)
    return caseFile ? `/review/${caseFile}` : null
  }

  if (sourceId.startsWith('inc-')) {
    const incident = incidents.find((i) => i.id === sourceId)
    if (incident?.attributedPrId) {
      const caseFile = caseFileFor(incident.attributedPrId)
      if (caseFile) return `/review/${caseFile}`
    }
    if (incident?.attributedAuthorId) return `/contributor/${incident.attributedAuthorId}`
    return null
  }

  // Person-scoped: "kevin", "liam" — the standing rules live on the dossier.
  return `/contributor/${sourceId}`
}

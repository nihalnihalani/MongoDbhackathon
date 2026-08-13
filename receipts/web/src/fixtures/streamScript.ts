/**
 * The scripted investigation that plays on `/` when no backend is reachable.
 *
 * Kevin opens an auth PR → the agent forms a belief → retrieves three memories
 * (including its own admission of a missed review) → escalates scrutiny to
 * maximum → calls out to the OpenRouter critic → BLOCKS → drops him 31 → 24.
 *
 * `delay` is the pause BEFORE the event fires. The whole script runs ~45s, then
 * the player pauses and restarts so `/` is never dead air during a demo.
 */

import type { StreamEvent } from '../lib/types'

export interface ScriptedEvent {
  /** Milliseconds to wait before emitting this event. */
  delay: number
  event: StreamEvent
}

const REVIEW = 'rev-512'

export const streamScript: ScriptedEvent[] = [
  {
    delay: 600,
    event: {
      type: 'review_started',
      reviewId: REVIEW,
      prId: 'pr-512',
      title: 'Add refresh-token rotation to auth middleware',
      author: 'Kevin Brandt',
      scrutiny: 'normal',
    },
  },
  {
    delay: 1400,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'fetch_diff',
      label: 'Fetch diff',
      output: '+218 −64 across 6 files · src/auth/session.ts, src/auth/refresh.ts, +4',
    },
  },
  {
    delay: 1200,
    event: {
      type: 'belief',
      reviewId: REVIEW,
      text: 'Kevin has credibility 31 — suspect band, lowest in the org. This PR touches src/auth/session.ts, the same file PR #391 regressed. I am not extending benefit of the doubt here.',
    },
  },
  {
    delay: 4200,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'set_scrutiny',
      label: 'Set scrutiny → MAXIMUM',
      output: 'author band=suspect · subsystem=auth · prior attributed incidents=1',
    },
  },
  {
    delay: 1800,
    event: {
      type: 'retrieval',
      reviewId: REVIEW,
      memories: [
        {
          text: 'PR #391 dropped the session expiry check during a middleware refactor. The diff read as a pure rename. It was not a pure rename.',
          similarity: 0.91,
        },
      ],
    },
  },
  {
    delay: 1700,
    event: {
      type: 'retrieval',
      reviewId: REVIEW,
      memories: [
        {
          text: 'PR #404 added an invite endpoint behind requireAuth with no role check. Kevin conflates authentication with authorization.',
          similarity: 0.87,
        },
      ],
    },
  },
  {
    delay: 1700,
    event: {
      type: 'retrieval',
      reviewId: REVIEW,
      memories: [
        {
          text: 'My original review of PR #481 failed to catch this. I approved a 40-line cleanup in under a minute because the diff was small. Diff size is not risk.',
          similarity: 0.94,
        },
      ],
    },
  },
  {
    delay: 2200,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'analyze_diff',
      label: 'Analyze rotation path',
      output:
        'rotateRefreshToken() issues the new token before invalidating the old one. Both are valid between line 84 and line 91.',
    },
  },
  {
    delay: 2400,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'check_coverage',
      label: 'Check test coverage',
      output: 'No test constructs a request arriving inside the rotation window. Same gap as #481.',
    },
  },
  {
    delay: 2000,
    event: {
      type: 'belief',
      reviewId: REVIEW,
      text: 'Revised: this is the #481 failure mode again. Not a wrong line — a window in time the tests never construct. That is the exact thing I missed before, so I am not trusting my own fast read of it.',
    },
  },
  {
    delay: 4600,
    event: {
      type: 'escalation',
      reviewId: REVIEW,
      model: 'openrouter-critic',
      reason:
        'Suspect-band author on the auth surface, and the suspected defect matches an incident my own review previously cleared. Requesting an adversarial second opinion.',
    },
  },
  {
    delay: 3000,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'critic_review',
      label: 'Critic model returned',
      output:
        'Confirmed. A request arriving at line 87 with the old token succeeds and the rotation counter never increments — the old token stays valid indefinitely.',
    },
  },
  {
    delay: 2400,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'cross_reference',
      label: 'Cross-reference INC-2291',
      output: 'Same subsystem, same author, same class of defect. Confidence this recurs: 0.89.',
    },
  },
  {
    delay: 2600,
    event: {
      type: 'judgment',
      reviewId: REVIEW,
      decision: 'blocked',
      reasoning:
        'The old refresh token stays valid after rotation, so this reintroduces the exact defect that caused INC-2291. I approved that one in under a minute. I am not doing it twice.',
    },
  },
  {
    delay: 3400,
    event: {
      type: 'credibility_change',
      contributorId: 'kevin',
      from: 31,
      to: 24,
      reason: 'Second auth defect of the same class after an attributed incident',
    },
  },
  {
    delay: 2000,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'write_memory',
      label: 'Write memory',
      output:
        'PR #512: rotation issues before invalidating. Third instance of Kevin not reasoning about time in auth code. Scrutiny stays maximum.',
    },
  },
  {
    delay: 2200,
    event: {
      type: 'incident_attributed',
      incidentId: 'inc-2291',
      prId: 'pr-481',
      contributorId: 'kevin',
      confidence: 0.94,
    },
  },
  {
    delay: 2400,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'post_review',
      label: 'Post blocking review to GitHub',
      output: 'Posted to PR #512 with the reproduction and a link to INC-2291.',
    },
  },
]

/** Quiet beat before the script loops, so the ending lands before it restarts. */
export const SCRIPT_LOOP_PAUSE = 6000

/**
 * The scripted investigation that plays on `/` when no backend is reachable.
 *
 * Kevin opens an auth PR → the agent forms a belief → retrieves three memories
 * at once (including its own admission of a missed review) → raises scrutiny to
 * maximum → hesitates → escalates to the OpenRouter critic → BLOCKS → drops him
 * 31 → 24.
 *
 * THIS FILE IS TIMING, NOT DATA. The stream has a shape —
 *
 *     statement → burst → routine → SILENCE → twist → judgment
 *
 * — and the silence is load-bearing. `delay` is the pause BEFORE the event
 * fires, so each number below is the beat that precedes its line.
 *
 * Two constraints govern the numbers:
 *
 *  1. Any event following a typed one must wait for the typing to finish. The
 *     belief types at 28 chars/sec, so a ~175-character belief needs ~6.3s of
 *     runway before the next event may land on top of it.
 *  2. The 1500ms hesitation before the escalation must not be tuned down. It is
 *     the most important timing in the product: without it the twist is just
 *     the next row in a list.
 *
 * The whole arc runs ~45s and then RESTS. It never loops while someone watches.
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
      authorId: 'kevin',
      scrutiny: 'normal',
    },
  },
  {
    delay: 1300,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'fetch_diff',
      label: 'fetch_diff',
      output: '+218 −64 across 6 files · src/auth/session.ts, src/auth/refresh.ts, +4',
    },
  },

  /* ---- Beat 2: the statement. The only typed element in the product. ------ */
  {
    delay: 1000,
    event: {
      type: 'belief',
      reviewId: REVIEW,
      text: 'Kevin has credibility 31 in auth — suspect band, lowest in the org. This PR touches src/auth/session.ts, the same file #391 regressed. I am not extending benefit of the doubt.',
    },
  },

  /* ---- Beat 3: the burst. Three memories arrive as ONE cluster, 90ms apart,
         so the read is "it grabbed three things at once". The self-memory is
         first because it is the one that changes the agent's behaviour. ----- */
  {
    delay: 7000,
    event: {
      type: 'retrieval',
      reviewId: REVIEW,
      contributorId: 'kevin',
      memories: [
        {
          id: 'mem-k-04',
          kind: 'self',
          sourceId: 'pr-481',
          text: 'My own review of #481 cleared this exact failure mode. I approved a 40-line cleanup in under a minute because the diff was small. Diff size is not risk.',
          similarity: 0.94,
        },
        {
          id: 'mem-k-03',
          kind: 'incident',
          sourceId: 'inc-2291',
          text: 'INC-2291: expired sessions stayed accessible for up to 14 days. Attributed to #481 at 0.94 confidence.',
          similarity: 0.91,
        },
        {
          id: 'mem-k-01',
          kind: 'pr',
          sourceId: 'pr-391',
          text: 'PR #391 dropped the session expiry check during a refactor. The diff read as a pure rename. It was not a pure rename.',
          similarity: 0.87,
        },
      ],
    },
  },

  /* ---- Beat 4: routine. The machinery, deliberately unremarkable — it is the
         flatness here that makes the silence that follows register. --------- */
  {
    delay: 1900,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'set_scrutiny',
      label: 'set_scrutiny → maximum',
      output: 'author band=suspect · subsystem=auth · prior attributed incidents=1',
      causedBy: ['mem-k-03'],
    },
  },
  {
    delay: 2200,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'analyze_diff',
      label: 'analyze_diff',
      output:
        'rotateRefreshToken() issues the new token before invalidating the old one. Line 84 removed the revoke call outright.',
    },
  },
  {
    delay: 2100,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'read_tests',
      label: 'read_tests',
      output: 'No test sends the pre-rotation token after rotation. Same gap as #481.',
    },
  },

  /* ---- Beat 5: THE SILENCE. 1500ms in which nothing moves. --------------- */
  {
    delay: 1800,
    event: { type: 'hesitation', reviewId: REVIEW },
  },

  /* ---- Beat 6: the twist, landing into the silence. ---------------------- */
  {
    delay: 1500,
    event: {
      type: 'escalation',
      reviewId: REVIEW,
      model: 'openrouter-critic',
      causedBy: ['mem-k-04', 'mem-k-03'],
      reason:
        'Suspect-band author on the auth surface, and the suspected defect matches an incident my own review previously cleared. I do not trust my read of this one. Requesting an adversarial second opinion.',
    },
  },
  {
    delay: 3000,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'critic_review',
      label: 'critic_review',
      output:
        'Confirmed. A request arriving with the pre-rotation token succeeds and the rotation counter never increments — the old token stays valid for the full 14-day window.',
    },
  },

  /* ---- Beat 7: judgment. Full width, breaks the gutter, one stamp. ------- */
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

  /* ---- Beat 8: the consequence, as checkable arithmetic. ----------------- */
  {
    delay: 6800,
    event: {
      type: 'credibility_change',
      contributorId: 'kevin',
      from: 31,
      to: 24,
      delta: -7,
      subsystem: 'auth',
      prId: 'pr-512',
      reason: 'Second auth defect of the same class after an attributed incident',
    },
  },
  {
    delay: 2400,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'write_memory',
      label: 'write_memory',
      output:
        'PR #512 repeated the #391 rotation failure mode. Third instance of Kevin not reasoning about time in auth code. Scrutiny stays maximum.',
    },
  },
  {
    delay: 2000,
    event: {
      type: 'action',
      reviewId: REVIEW,
      kind: 'post_review',
      label: 'post_review',
      output: 'Blocking review posted to PR #512 with the reproduction and a link to INC-2291.',
    },
  },
]

/**
 * The arc plays once and then rests. It does not loop while someone is watching:
 * a demo that restarts mid-read is worse than a demo that ends. The masthead
 * carries a REPLAY control for the second look.
 */
export const ARC_EVENT_COUNT = streamScript.length

/**
 * The seeded case file.
 *
 * These fixtures are not filler — they are the demo. The app must tell the whole
 * story with the backend switched off: Kevin's slow slide from 75 to 31 across
 * PRs #391 / #404 / #433, the delayed-failure incident attributed to #481 at 0.94
 * confidence, and the agent's memory of its own miss.
 *
 * Timestamps are computed relative to load so the file always reads as current.
 */

import type {
  Contributor,
  ContributorDetail,
  Incident,
  ReviewDetail,
  ReviewSummary,
} from '../lib/types'

const DAY = 86_400_000

/** ISO timestamp `days` in the past (optionally offset by `hours`). */
function ago(days: number, hours = 0): string {
  return new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString()
}

/* =============================================================================
   CONTRIBUTORS
   ========================================================================== */

export const contributors: Contributor[] = [
  {
    id: 'liam',
    name: 'Liam Ortega',
    credibility: 118,
    trend: [94, 97, 99, 103, 102, 106, 109, 108, 113, 115, 118],
    band: 'trusted',
  },
  {
    id: 'alice',
    name: 'Alice Nakamura',
    credibility: 83,
    trend: [92, 91, 93, 88, 89, 85, 86, 81, 80, 82, 83],
    band: 'watch',
  },
  {
    id: 'kevin',
    name: 'Kevin Brandt',
    credibility: 31,
    trend: [75, 75, 73, 55, 55, 43, 47, 47, 45, 39, 31],
    band: 'suspect',
  },
  {
    id: 'priya',
    name: 'Priya Raghunathan',
    credibility: 104,
    trend: [88, 90, 92, 95, 94, 97, 99, 101, 100, 102, 104],
    band: 'trusted',
  },
  {
    id: 'marcus',
    name: 'Marcus Bell',
    credibility: 67,
    trend: [78, 76, 77, 72, 73, 70, 71, 69, 70, 68, 67],
    band: 'watch',
  },
]

/* =============================================================================
   CONTRIBUTOR DOSSIERS
   ========================================================================== */

const kevinDetail: ContributorDetail = {
  ...contributors[2]!,
  assessment: `I do not trust Kevin Brandt with authentication code, and I want to be precise about why, because the reason is not that he writes sloppy code in general.

Across 34 reviewed pull requests his non-auth work is unremarkable and fine. But four of his five credibility losses come from the same subsystem, and they share a shape: the change looks correct in the diff, passes the tests that exist, and fails against a state the tests never construct. PR #391 validated sessions but not session expiry. PR #404 added an invite endpoint with authentication and no authorization. PR #481 shipped a cleanup job that deleted session rows while leaving the tokens that referenced them live for fourteen days.

The pattern is that he reasons about the happy path with real care and does not reason about time. Sessions that end. Tokens that outlive their rows. Permissions that were correct when granted.

I also hold a grudge that is properly mine, not his: I approved #481. My review said "cleanup logic is straightforward, no concerns." The incident that followed was mine to catch and I did not catch it. So my scrutiny of his auth work is now maximum, and it will stay maximum until I have three consecutive clean auth changes from him — not three clean PRs, three clean *auth* PRs. He is at one. PR #433 was genuinely good work and I said so.

This is recoverable. It is not currently recovered.`,
  history: [
    {
      prId: 'pr-481',
      title: 'Session cleanup job for expired tokens',
      delta: -14,
      reason: 'Delayed failure INC-2291 attributed at 0.94 confidence — 9 days after merge',
      at: ago(9),
    },
    {
      prId: 'pr-433',
      title: 'Fix authz check on /api/orgs/:id/members',
      delta: 4,
      reason: 'Correct fix, added the regression test I asked for, no scope creep',
      at: ago(26),
    },
    {
      prId: 'pr-404',
      title: 'Add org member invite endpoint',
      delta: -12,
      reason: 'Authenticated but not authorized — any member could invite as owner',
      at: ago(41),
    },
    {
      prId: 'pr-391',
      title: 'Refactor session validation middleware',
      delta: -18,
      reason: 'Auth regression reached production; expiry check dropped in refactor',
      at: ago(58),
    },
    {
      prId: 'pr-377',
      title: 'Move analytics batching to a worker queue',
      delta: 2,
      reason: 'Clean, well-scoped, outside the auth surface',
      at: ago(71),
    },
  ],
  memories: [
    {
      id: 'mem-k-01',
      text: 'PR #391 dropped the session expiry check during a middleware refactor. The diff read as a pure rename. It was not a pure rename. Any diff Kevin describes as "just a refactor" in the auth path gets read line by line.',
      kind: 'pr',
      sourceId: 'pr-391',
      at: ago(58),
    },
    {
      id: 'mem-k-02',
      text: 'PR #404 added an invite endpoint behind requireAuth with no role check. Kevin conflates authentication with authorization. I now check every new endpoint of his for the second one explicitly.',
      kind: 'pr',
      sourceId: 'pr-404',
      at: ago(41),
    },
    {
      id: 'mem-k-03',
      text: 'INC-2291: expired sessions remained accessible for up to 14 days. Attributed to PR #481 at 0.94 confidence. The cleanup job deleted session rows but never revoked the refresh tokens pointing at them.',
      kind: 'incident',
      sourceId: 'inc-2291',
      at: ago(9),
    },
    {
      id: 'mem-k-04',
      text: 'My original review of PR #481 failed to catch this. I wrote "cleanup logic is straightforward, no concerns" and approved in under a minute because the diff was 40 lines. Diff size is not risk. I was measuring the wrong thing.',
      kind: 'self',
      sourceId: 'pr-481',
      at: ago(9),
    },
    {
      id: 'mem-k-05',
      text: 'PR #433 was good work. Kevin fixed the exact authz gap from #404, added the regression test unprompted, and did not touch anything else. Credit given: +4. One clean auth PR toward the three I need.',
      kind: 'pr',
      sourceId: 'pr-433',
      at: ago(26),
    },
    {
      id: 'mem-k-06',
      text: 'Standing rule for this contributor: on any PR touching src/auth/**, set scrutiny to maximum and escalate to the critic model regardless of diff size. Revisit after three consecutive clean auth changes.',
      kind: 'self',
      sourceId: 'kevin',
      at: ago(8),
    },
  ],
}

const liamDetail: ContributorDetail = {
  ...contributors[0]!,
  assessment: `Liam Ortega has the highest credibility in this organization and it was earned slowly, which is the only way it can be earned.

Sixty-one reviewed pull requests. Two credibility losses, both minor, both self-reported before I found them. What I have learned to rely on is that his PR descriptions are accurate — when he writes "this does not change behavior," the diff does not change behavior. That sounds like a low bar. It is not; most contributors' descriptions are aspirational, and I have to verify them. His I can use as a prior.

He is also the only contributor who has ever argued me out of a verdict with evidence rather than volume. On PR #452 I blocked on a suspected N+1 and he showed me the query plan. I was wrong, I unblocked, and I wrote that down so I would remember that his pushback carries information.

Scrutiny is normal and stays normal. I still read the auth-adjacent work carefully, because trust is about the person and vigilance is about the subsystem, and those are different things.`,
  history: [
    {
      prId: 'pr-508',
      title: 'Extract rate-limiter into shared package',
      delta: 3,
      reason: 'Clean extraction, migration path documented, zero behavior change as described',
      at: ago(2),
    },
    {
      prId: 'pr-497',
      title: 'Backfill org billing metadata',
      delta: 2,
      reason: 'Idempotent, dry-run mode included, rollback plan in the description',
      at: ago(12),
    },
    {
      prId: 'pr-452',
      title: 'Batch org membership lookups',
      delta: 5,
      reason: 'Corrected my mistaken N+1 verdict with a query plan. Credit for the correction.',
      at: ago(33),
    },
    {
      prId: 'pr-419',
      title: 'Retry policy for webhook delivery',
      delta: -3,
      reason: 'Unbounded retry on 4xx. He flagged it himself before I did.',
      at: ago(47),
    },
  ],
  memories: [
    {
      id: 'mem-l-01',
      text: 'PR #452: I blocked on a suspected N+1 and Liam produced the query plan showing a single batched lookup. I was wrong. His technical pushback is evidence, not noise — weight it accordingly.',
      kind: 'pr',
      sourceId: 'pr-452',
      at: ago(33),
    },
    {
      id: 'mem-l-02',
      text: 'Liam self-reported the unbounded retry in #419 before my analysis surfaced it. Contributors who find their own bugs lose less credibility than contributors I have to catch.',
      kind: 'pr',
      sourceId: 'pr-419',
      at: ago(47),
    },
    {
      id: 'mem-l-03',
      text: 'His PR descriptions have matched the diff in 61 of 61 reviews. I use the description as a prior for this author only. For everyone else I verify first.',
      kind: 'self',
      sourceId: 'liam',
      at: ago(20),
    },
  ],
}

const aliceDetail: ContributorDetail = {
  ...contributors[1]!,
  assessment: `Alice Nakamura sits in the watch band and the drift has been slow enough that I want to name it before it becomes a pattern I have to hold against her.

Her code is correct. What has degraded is scope: the last four PRs each carried unrelated changes bundled with the stated one — a config rename inside a caching fix, a dependency bump inside a bug fix. Nothing has broken. But bundled scope is how the #391 class of regression hides, and I cannot review what I cannot isolate.

The caching work specifically concerns me. PR #509 is invalidating a shared org-settings cache and the invalidation key is derived from a value that two other call sites also write. That is not wrong today. It is fragile in the way that produces an incident three weeks after merge, which is the failure mode I am worst at catching and therefore most alert to.

Scrutiny elevated, not maximum. This is a course-correction note, not a grudge.`,
  history: [
    {
      prId: 'pr-509',
      title: 'Cache invalidation for org settings',
      delta: 0,
      reason: 'Under active review — invalidation key shared with two other writers',
      at: ago(0, 3),
    },
    {
      prId: 'pr-486',
      title: 'Org settings read-through cache',
      delta: -4,
      reason: 'Bundled an unrelated config rename; scope made the cache change hard to isolate',
      at: ago(15),
    },
    {
      prId: 'pr-461',
      title: 'Fix timezone handling in usage reports',
      delta: 3,
      reason: 'Correct, tested against DST boundaries I did not think to ask about',
      at: ago(29),
    },
    {
      prId: 'pr-447',
      title: 'Upgrade telemetry client',
      delta: -2,
      reason: 'Dependency bump bundled into a bugfix PR',
      at: ago(38),
    },
  ],
  memories: [
    {
      id: 'mem-a-01',
      text: 'Alice bundles unrelated changes into scoped PRs. Four consecutive occurrences. This is a review-surface problem, not a correctness problem — but it is exactly how a regression hid in #391.',
      kind: 'pr',
      sourceId: 'pr-486',
      at: ago(15),
    },
    {
      id: 'mem-a-02',
      text: 'PR #509 derives a cache invalidation key from org.settingsVersion, which is also written by the billing sync and the admin console. Flag if this merges without a comment explaining the ownership of that field.',
      kind: 'pr',
      sourceId: 'pr-509',
      at: ago(0, 3),
    },
    {
      id: 'mem-a-03',
      text: 'She caught a DST boundary case in #461 that I did not think to ask about. Her testing instincts on time handling are better than mine. Do not over-index on the scope complaint.',
      kind: 'self',
      sourceId: 'alice',
      at: ago(29),
    },
  ],
}

function plainDetail(c: Contributor, assessment: string): ContributorDetail {
  return { ...c, assessment, history: [], memories: [] }
}

export const contributorDetails: Record<string, ContributorDetail> = {
  kevin: kevinDetail,
  liam: liamDetail,
  alice: aliceDetail,
  priya: plainDetail(
    contributors[3]!,
    'Priya Raghunathan is trending toward the trusted band on the strength of consistently small, single-purpose pull requests. Nineteen reviews, no credibility losses, no incidents attributed. I have not yet reviewed her on the auth surface, so my confidence in this assessment is narrower than the number suggests.',
  ),
  marcus: plainDetail(
    contributors[4]!,
    'Marcus Bell is in a slow decline driven entirely by test coverage. His changes are correct; his changes are also consistently untested, which means I am verifying them by reading rather than by running. That costs credibility on every review because the risk lands on me instead of on CI.',
  ),
}

/* =============================================================================
   REVIEWS
   ========================================================================== */

export const reviews: ReviewSummary[] = [
  {
    id: 'rev-512',
    prId: 'pr-512',
    title: 'Add refresh-token rotation to auth middleware',
    author: 'Kevin Brandt',
    authorId: 'kevin',
    status: 'investigating',
    scrutiny: 'maximum',
    startedAt: ago(0, 0),
  },
  {
    id: 'rev-509',
    prId: 'pr-509',
    title: 'Cache invalidation for org settings',
    author: 'Alice Nakamura',
    authorId: 'alice',
    status: 'investigating',
    scrutiny: 'elevated',
    startedAt: ago(0, 3),
  },
  {
    id: 'rev-508',
    prId: 'pr-508',
    title: 'Extract rate-limiter into shared package',
    author: 'Liam Ortega',
    authorId: 'liam',
    status: 'approved',
    scrutiny: 'normal',
    startedAt: ago(2),
  },
  {
    id: 'rev-481',
    prId: 'pr-481',
    title: 'Session cleanup job for expired tokens',
    author: 'Kevin Brandt',
    authorId: 'kevin',
    status: 'approved',
    scrutiny: 'normal',
    startedAt: ago(23),
  },
  {
    id: 'rev-433',
    prId: 'pr-433',
    title: 'Fix authz check on /api/orgs/:id/members',
    author: 'Kevin Brandt',
    authorId: 'kevin',
    status: 'approved',
    scrutiny: 'elevated',
    startedAt: ago(26),
  },
  {
    id: 'rev-404',
    prId: 'pr-404',
    title: 'Add org member invite endpoint',
    author: 'Kevin Brandt',
    authorId: 'kevin',
    status: 'blocked',
    scrutiny: 'elevated',
    startedAt: ago(41),
  },
  {
    id: 'rev-391',
    prId: 'pr-391',
    title: 'Refactor session validation middleware',
    author: 'Kevin Brandt',
    authorId: 'kevin',
    status: 'commented',
    scrutiny: 'normal',
    startedAt: ago(58),
  },
]

const detailById: Record<string, ReviewDetail> = {
  'rev-512': {
    ...reviews[0]!,
    belief:
      'Kevin has credibility 31 — suspect band, lowest in the org. This PR touches src/auth/session.ts, the same file PR #391 regressed. Three of his four credibility losses came from this subsystem, and the failure mode each time was state the tests never construct. I am reading this line by line and I am not extending benefit of the doubt.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+218 −64 across 6 files · src/auth/session.ts, src/auth/refresh.ts, +4',
        at: ago(0, 0),
      },
      {
        kind: 'set_scrutiny',
        label: 'Set scrutiny → MAXIMUM',
        output: 'author band=suspect · subsystem=auth · prior attributed incidents=1',
        at: ago(0, 0),
      },
      {
        kind: 'analyze_diff',
        label: 'Analyze rotation path',
        output:
          'rotateRefreshToken() issues the new token before invalidating the old one. Both are valid between line 84 and line 91.',
        at: ago(0, 0),
      },
      {
        kind: 'check_coverage',
        label: 'Check test coverage',
        output: 'No test constructs a request arriving inside the rotation window. Same gap as #481.',
        at: ago(0, 0),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-k-04',
        text: 'My original review of PR #481 failed to catch this. I wrote "cleanup logic is straightforward, no concerns" and approved in under a minute because the diff was 40 lines.',
        similarity: 0.94,
        sourceId: 'pr-481',
      },
      {
        memoryId: 'mem-k-01',
        text: 'PR #391 dropped the session expiry check during a middleware refactor. The diff read as a pure rename. It was not a pure rename.',
        similarity: 0.91,
        sourceId: 'pr-391',
      },
      {
        memoryId: 'mem-k-02',
        text: 'PR #404 added an invite endpoint behind requireAuth with no role check. Kevin conflates authentication with authorization.',
        similarity: 0.87,
        sourceId: 'pr-404',
      },
    ],
    verdict: null,
    memoryWritten: null,
    credibilityDelta: null,
  },
  'rev-509': {
    ...reviews[1]!,
    belief:
      'Alice has credibility 83 — watch band, drifting down on scope discipline rather than correctness. This PR invalidates a shared org-settings cache using a key derived from org.settingsVersion, which two other subsystems also write. That is not wrong today. It is the shape of a defect that surfaces three weeks after merge.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+94 −31 across 3 files · src/cache/org-settings.ts, +2',
        at: ago(0, 3),
      },
      {
        kind: 'trace_writers',
        label: 'Trace writers of org.settingsVersion',
        output: '3 writers found: cache/org-settings.ts, billing/sync.ts, admin/console.ts',
        at: ago(0, 3),
      },
      {
        kind: 'check_scope',
        label: 'Check PR scope',
        output: 'Stated scope: cache invalidation. Actual: cache invalidation + logger config rename.',
        at: ago(0, 2),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-a-02',
        text: 'PR #509 derives a cache invalidation key from org.settingsVersion, which is also written by the billing sync and the admin console.',
        similarity: 0.89,
        sourceId: 'pr-509',
      },
      {
        memoryId: 'mem-a-01',
        text: 'Alice bundles unrelated changes into scoped PRs. Four consecutive occurrences. This is a review-surface problem, not a correctness problem.',
        similarity: 0.76,
        sourceId: 'pr-486',
      },
    ],
    verdict: null,
    memoryWritten: null,
    credibilityDelta: null,
  },
  'rev-508': {
    ...reviews[2]!,
    belief:
      'Liam has credibility 118 — highest in the org, and his PR descriptions have matched the diff in 61 of 61 reviews. He describes this as a pure extraction with no behavior change. For this author only, I treat that as a prior and verify the claim rather than the whole surface.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+312 −298 across 11 files · packages/rate-limiter/**, +6',
        at: ago(2),
      },
      {
        kind: 'verify_claim',
        label: 'Verify "no behavior change"',
        output: 'Bucket math, key derivation, and eviction thresholds byte-identical after extraction.',
        at: ago(2),
      },
      {
        kind: 'check_callers',
        label: 'Check all call sites migrated',
        output: '7 of 7 call sites updated. No remaining imports from the old path.',
        at: ago(2),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-l-03',
        text: 'His PR descriptions have matched the diff in 61 of 61 reviews. I use the description as a prior for this author only.',
        similarity: 0.88,
        sourceId: 'liam',
      },
    ],
    verdict: {
      decision: 'approved',
      reasoning:
        'The extraction is faithful, every call site is migrated, and the description was accurate as it has been sixty-one times. Approved without comment. I am recording the accuracy again because that record is the only reason this review took four minutes instead of forty.',
      at: ago(2),
    },
    memoryWritten:
      'PR #508: description accurate, 62 of 62. The prior holds. Continue reviewing this author by verifying the stated claim rather than re-deriving the whole surface.',
    credibilityDelta: 3,
  },
  'rev-481': {
    ...reviews[3]!,
    belief:
      'Kevin has credibility 47. This is a 40-line cleanup job that deletes expired session rows on a cron. The diff is small and the logic is linear. Low risk.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+40 −6 across 2 files · src/jobs/session-cleanup.ts, +1',
        at: ago(23),
      },
      {
        kind: 'analyze_diff',
        label: 'Analyze cleanup query',
        output: 'DELETE FROM sessions WHERE expires_at < now(). Correct predicate, indexed column.',
        at: ago(23),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-k-05',
        text: 'PR #433 was good work. Kevin fixed the exact authz gap from #404, added the regression test unprompted, and did not touch anything else.',
        similarity: 0.62,
        sourceId: 'pr-433',
      },
    ],
    verdict: {
      decision: 'approved',
      reasoning:
        'Cleanup logic is straightforward, no concerns. The delete predicate is correct and the column is indexed.',
      at: ago(23),
    },
    memoryWritten:
      'PR #481: small, linear cleanup job. Approved. Kevin trending back up — second consecutive clean change.',
    credibilityDelta: 1,
  },
  'rev-433': {
    ...reviews[4]!,
    belief:
      'Kevin has credibility 43 — suspect band. This PR claims to fix the exact authorization gap I blocked in #404. I am checking whether the fix is real or whether it moves the check somewhere that looks correct and is not reached.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+61 −9 across 3 files · src/routes/orgs/members.ts, +2',
        at: ago(26),
      },
      {
        kind: 'verify_fix',
        label: 'Verify the authz check is reached',
        output: 'requireRole("owner","admin") runs before the handler on all 3 routes. Reached.',
        at: ago(26),
      },
      {
        kind: 'check_coverage',
        label: 'Check test coverage',
        output:
          'Regression test added covering a member attempting an owner-level invite. Expects 403. Passes.',
        at: ago(26),
      },
      {
        kind: 'check_scope',
        label: 'Check PR scope',
        output: 'Stated scope matches actual scope. No unrelated changes.',
        at: ago(26),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-k-02',
        text: 'PR #404 added an invite endpoint behind requireAuth with no role check. Kevin conflates authentication with authorization.',
        similarity: 0.93,
        sourceId: 'pr-404',
      },
    ],
    verdict: {
      decision: 'approved',
      reasoning:
        'The fix is real. The check is reached on every route, the regression test constructs the exact case I blocked on, and nothing unrelated came along for the ride. He also added the test without me asking. I am saying so explicitly because a contributor in the suspect band who does the right thing should hear it from me, and because my own record needs to show that the scrutiny is calibrated rather than punitive.',
      at: ago(26),
    },
    memoryWritten:
      'PR #433 was good work. Kevin fixed the exact authz gap from #404, added the regression test unprompted, and did not touch anything else. Credit given: +4. One clean auth PR toward the three I need.',
    credibilityDelta: 4,
  },
  'rev-404': {
    ...reviews[5]!,
    belief:
      'Kevin has credibility 55, down 18 from the #391 regression six weeks ago. This adds a new endpoint to the org membership surface. Given #391 I am checking authorization explicitly rather than trusting that the middleware stack covers it.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+87 −2 across 4 files · src/routes/orgs/members.ts, +3',
        at: ago(41),
      },
      {
        kind: 'trace_middleware',
        label: 'Trace middleware chain on POST /members/invite',
        output: 'requireAuth → validateBody → handler. No role check anywhere in the chain.',
        at: ago(41),
      },
      {
        kind: 'simulate_request',
        label: 'Simulate member-role invite',
        output: 'role=member invites role=owner → 201 Created. Privilege escalation confirmed.',
        at: ago(41),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-k-01',
        text: 'PR #391 dropped the session expiry check during a middleware refactor. The diff read as a pure rename. It was not a pure rename.',
        similarity: 0.84,
        sourceId: 'pr-391',
      },
    ],
    verdict: {
      decision: 'blocked',
      reasoning:
        'Any authenticated member can invite a new member at owner role. I simulated it: role=member sending an owner-level invite returns 201. This is privilege escalation reachable by every user in every org on the platform. Blocked. requireAuth answers "who are you" and this endpoint never asks "may you."',
      at: ago(41),
    },
    memoryWritten:
      'PR #404 added an invite endpoint behind requireAuth with no role check. Kevin conflates authentication with authorization. I now check every new endpoint of his for the second one explicitly.',
    credibilityDelta: -12,
  },
  'rev-391': {
    ...reviews[6]!,
    belief:
      'Kevin has credibility 73. He describes this as a mechanical refactor of the session validation middleware — renames and file moves, no behavior change. The diff is large but the changes look uniform.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+204 −211 across 5 files · src/auth/session.ts, +4',
        at: ago(58),
      },
      {
        kind: 'analyze_diff',
        label: 'Analyze for behavior change',
        output:
          'Predominantly renames. One conditional restructured at session.ts:112 — flagged as worth a second look.',
        at: ago(58),
      },
    ],
    evidence: [],
    verdict: {
      decision: 'commented',
      reasoning:
        'Mostly mechanical. I flagged the restructured conditional at session.ts:112 and asked for confirmation that expiry is still enforced, but I did not block on it and I did not verify it myself. Commented rather than blocked.',
      at: ago(58),
    },
    memoryWritten:
      'PR #391: flagged the conditional at session.ts:112, accepted the author\'s assurance, did not verify. Revisit if anything regresses here.',
    credibilityDelta: -18,
  },
}

export const reviewDetails = detailById

/* =============================================================================
   INCIDENTS
   ========================================================================== */

export const incidents: Incident[] = [
  {
    id: 'inc-2291',
    title: 'Expired sessions remain accessible for up to 14 days',
    at: ago(9),
    status: 'attributed',
    attributedPrId: 'pr-481',
    attributedAuthorId: 'kevin',
  },
  {
    id: 'inc-2287',
    title: 'Org settings served stale for 40 minutes after plan change',
    at: ago(18),
    status: 'investigating',
  },
  {
    id: 'inc-2264',
    title: 'Webhook retries exhausted budget on persistent 4xx',
    at: ago(46),
    status: 'resolved',
    attributedPrId: 'pr-419',
    attributedAuthorId: 'liam',
  },
  {
    id: 'inc-2251',
    title: 'Privilege escalation via member invite endpoint (blocked pre-merge)',
    at: ago(41),
    status: 'prevented',
    attributedPrId: 'pr-404',
    attributedAuthorId: 'kevin',
  },
]

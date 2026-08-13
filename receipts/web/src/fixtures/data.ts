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
  DiffHunk,
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
    subsystem: 'auth',
  },
  {
    id: 'alice',
    name: 'Alice Nakamura',
    credibility: 83,
    trend: [92, 91, 93, 88, 89, 85, 86, 81, 80, 82, 83],
    band: 'watch',
    subsystem: 'caching',
  },
  {
    id: 'kevin',
    name: 'Kevin Brandt',
    credibility: 31,
    trend: [75, 75, 73, 55, 55, 43, 47, 47, 45, 39, 31],
    band: 'suspect',
    subsystem: 'auth',
  },
  {
    id: 'priya',
    name: 'Priya Raghunathan',
    credibility: 104,
    trend: [88, 90, 92, 95, 94, 97, 99, 101, 100, 102, 104],
    band: 'trusted',
    subsystem: 'api',
  },
  {
    id: 'marcus',
    name: 'Marcus Bell',
    credibility: 67,
    // The recovery arc: down into the suspect band on two attributed cache
    // incidents, then earned back. This is the only proof in the fixture that
    // the score is climbable, which is the first thing a sceptic asks.
    trend: [58, 58, 55, 49, 41, 41, 48, 52, 57, 62, 67],
    band: 'watch',
    subsystem: 'core',
  },
]

/* =============================================================================
   CONTRIBUTOR DOSSIERS
   ========================================================================== */

const kevinDetail: ContributorDetail = {
  ledger: {
    subsystem: 'auth',
    openingBalance: 64,
    entries: [
      { prId: 'pr-391', delta: -18, reason: 'Auth regression, shipped' },
      { prId: 'pr-404', delta: -12, reason: 'Missing authz, two routes' },
      { prId: 'pr-433', delta: 4, reason: 'Clean fix, tested', recovery: true },
      { prId: 'pr-481', delta: -7, reason: 'Repeat of the #391 failure mode' },
    ],
    balance: 31,
  },
  ...contributors[2]!,
  assessment: `I do not trust Kevin Brandt with authentication code, and I want to be precise about why, because the reason is not that he writes sloppy code in general.

Across 34 reviewed pull requests his non-auth work is unremarkable and fine. But four of his five credibility losses come from the same subsystem, and they share a shape: the change looks correct in the diff, passes the tests that exist, and fails against a state the tests never construct. PR #391 validated sessions but not session expiry. PR #404 added an invite endpoint with authentication and no authorization. PR #481 shipped a cleanup job that deleted session rows while leaving the tokens that referenced them live for fourteen days.

The pattern is that he reasons about the happy path with real care and does not reason about time. Sessions that end. Tokens that outlive their rows. Permissions that were correct when granted.

I also hold a grudge that is properly mine, not his: I approved #481. My review said "cleanup logic is straightforward, no concerns." The incident that followed was mine to catch and I did not catch it. So my scrutiny of his auth work is now maximum, and it will stay maximum until I have three consecutive clean auth changes from him — not three clean PRs, three clean *auth* PRs. He is at one. PR #433 was genuinely good work and I said so.

This is recoverable, and I mean that as a statement of fact rather than encouragement. Marcus Bell was at 41 in core last year on two attributed incidents; he is at 67 now and back to normal scrutiny, because he started shipping the evidence with the change instead of leaving me to find it. The path out is not charm and it is not time served. It is three clean auth PRs.

It is not currently recovered.`,
  history: [
    {
      prId: 'pr-481',
      title: 'Session cleanup job for expired tokens',
      delta: -7,
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
  ledger: {
    subsystem: 'auth',
    openingBalance: 106,
    entries: [
      { prId: 'pr-402', delta: 3, reason: 'Caught his own race condition in the session store' },
      { prId: 'pr-428', delta: -3, reason: 'Unbounded introspection cache — self-reported' },
      { prId: 'pr-452', delta: 5, reason: 'Corrected my mistaken verdict with a query plan', recovery: true },
      { prId: 'pr-471', delta: 4, reason: 'Hardened session fixation checks on login' },
      { prId: 'pr-507', delta: 3, reason: 'Refresh-token rotation, reviewed at normal scrutiny' },
    ],
    balance: 118,
  },
  ...contributors[0]!,
  assessment: `Liam Ortega has the highest credibility in this organization and it was earned slowly, which is the only way it can be earned.

Sixty-one reviewed pull requests. Two credibility losses, both minor, both self-reported before I found them. What I have learned to rely on is that his PR descriptions are accurate — when he writes "this does not change behavior," the diff does not change behavior. That sounds like a low bar. It is not; most contributors' descriptions are aspirational, and I have to verify them. His I can use as a prior.

He is also the only contributor who has ever argued me out of a verdict with evidence rather than volume. On PR #452 I blocked on a suspected N+1 and he showed me the query plan. I was wrong, I unblocked, and I wrote that down so I would remember that his pushback carries information.

Scrutiny is normal and stays normal. I still read the auth-adjacent work carefully, because trust is about the person and vigilance is about the subsystem, and those are different things.`,
  history: [
    {
      prId: 'pr-507',
      title: 'Add refresh-token rotation to auth middleware',
      delta: 3,
      reason: 'Rotation invalidates before it issues; description matched the diff, as always',
      at: ago(3),
    },
    {
      prId: 'pr-471',
      title: 'Harden session fixation checks on login',
      delta: 4,
      reason: 'Regenerated the session id on privilege change without being asked',
      at: ago(16),
    },
    {
      prId: 'pr-452',
      title: 'Batch org membership lookups behind the authz filter',
      delta: 5,
      reason: 'Corrected my mistaken N+1 verdict with a query plan. Credit for the correction.',
      at: ago(33),
    },
    {
      prId: 'pr-428',
      title: 'Token introspection endpoint',
      delta: -3,
      reason: 'Unbounded introspection cache. He flagged it himself before I did.',
      at: ago(44),
    },
    {
      prId: 'pr-402',
      title: 'Session store migration',
      delta: 3,
      reason: 'Caught a race condition in his own change during review and fixed it pre-merge',
      at: ago(57),
    },
  ],
  memories: [
    {
      id: 'mem-l-01',
      text: 'PR #452: I blocked on a suspected N+1 and Liam produced the query plan showing a single batched lookup. I was wrong. His technical pushback is evidence, not noise — weight it accordingly.',
      kind: 'self',
      sourceId: 'pr-452',
      at: ago(33),
    },
    {
      id: 'mem-l-02',
      text: 'PR #402: Liam caught a race condition in his own session-store migration during review — two requests could both regenerate the session id — and fixed it before I reached that file. He finds his own bugs.',
      kind: 'pr',
      sourceId: 'pr-402',
      at: ago(57),
    },
    {
      id: 'mem-l-03',
      text: 'PR #471 regenerated the session id on privilege change without being asked. That is the fixation defence I would have had to request from anyone else on this surface.',
      kind: 'pr',
      sourceId: 'pr-471',
      at: ago(16),
    },
    {
      id: 'mem-l-04',
      text: 'Liam self-reported the unbounded introspection cache in #428 before my analysis surfaced it. Contributors who find their own bugs lose less credibility than contributors I have to catch.',
      kind: 'pr',
      sourceId: 'pr-428',
      at: ago(44),
    },
    {
      id: 'mem-l-05',
      text: 'His PR descriptions have matched the diff in 61 of 61 reviews. I use the description as a prior for this author only. For everyone else I verify first.',
      kind: 'self',
      sourceId: 'liam',
      at: ago(20),
    },
  ],
}

const aliceDetail: ContributorDetail = {
  ledger: {
    subsystem: 'caching',
    openingBalance: 86,
    entries: [
      { prId: 'pr-447', delta: -2, reason: 'Dependency bump bundled into a bugfix' },
      { prId: 'pr-461', delta: 3, reason: 'Caught a DST boundary I did not think to ask about', recovery: true },
      { prId: 'pr-486', delta: -4, reason: 'Bundled scope hid the cache change' },
    ],
    balance: 83,
  },
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

/**
 * The recovery case.
 *
 * Every other dossier here shows the score going down or staying high. Marcus is
 * the one that went into the suspect band and came back out, and the ledger has
 * to make that legible as EARNED rather than forgiven — three consecutive
 * positive rows, each naming what he actually changed.
 *
 * Without this file the honest answer to "has anyone ever climbed back?" is
 * "no", and a credibility system that only ratchets downward is a blacklist.
 */
const marcusDetail: ContributorDetail = {
  ...contributors[4]!,
  assessment: `Marcus Bell is the reason I can say that this score is climbable rather than permanent, so I want the record to be specific about how he did it.

Fifteen months ago he was at 41 in core — suspect band, below Kevin's current number. Two cache-invalidation incidents were attributed to him in the same quarter, both the same shape: correct logic, no test, failure only under a concurrency the tests never constructed. I set his scrutiny to maximum and I was right to.

What changed is not that he started writing better code. His code was always correct. What changed is that he started shipping the evidence with it. PR #490 arrived with a table-driven suite covering the exact concurrency case that caused the second incident. #501 covered the retry path. #516 covered the boundary I would have asked about, before I asked. He moved the verification burden off me and onto CI, which is the only thing that was ever costing him credibility.

He is at 67 and his scrutiny came down to normal four reviews ago. I am recording that transition deliberately: scrutiny is a response to evidence, and when the evidence changes the response has to change with it, or it is not a judgment, it is a grudge.`,
  ledger: {
    subsystem: 'core',
    openingBalance: 58,
    balance: 67,
    entries: [
      { prId: 'pr-462', delta: -9, reason: 'cache invalidation shipped untested — INC-2088 attributed' },
      { prId: 'pr-474', delta: -8, reason: 'second incident, same class — INC-2103 attributed' },
      { prId: 'pr-490', delta: 7, reason: 'table-driven tests covering the incident case', recovery: true },
      { prId: 'pr-501', delta: 9, reason: 'retry path tested without being asked', recovery: true },
      { prId: 'pr-516', delta: 10, reason: 'third clean ship — scrutiny returned to normal', recovery: true },
    ],
  },
  history: [
    {
      prId: 'pr-516',
      title: 'Concurrent write guard on the settings cache',
      delta: 10,
      reason: 'Third consecutive tested change. Scrutiny returned to normal on this one.',
      at: ago(5),
    },
    {
      prId: 'pr-501',
      title: 'Retry failed invoice generation',
      delta: 9,
      reason: 'Retry path covered by tests before review. I verified by running, not reading.',
      at: ago(19),
    },
    {
      prId: 'pr-490',
      title: 'Tax rate resolution by region',
      delta: 7,
      reason: 'Table-driven suite covering the exact case that caused INC-2103',
      at: ago(34),
    },
    {
      prId: 'pr-474',
      title: 'Currency rounding on line items',
      delta: -8,
      reason: 'Second untested cache path in a quarter — INC-2103 attributed at 0.88',
      at: ago(61),
    },
    {
      prId: 'pr-462',
      title: 'Proration on mid-cycle plan change',
      delta: -9,
      reason: 'Correct as written, entirely untested — INC-2088 attributed at 0.91',
      at: ago(79),
    },
  ],
  memories: [
    {
      id: 'mem-m-01',
      text: 'Marcus went from 41 to 67 in core over five reviews. He did not start writing more correct code — his code was already correct. He started shipping tests with it, which moved the verification burden off me. That is the whole delta.',
      kind: 'self',
      sourceId: 'marcus',
      at: ago(5),
    },
    {
      id: 'mem-m-02',
      text: 'PR #490 arrived with a table-driven suite covering the exact concurrency case that caused INC-2103. Nobody asked for it. That is the review where I stopped reading his diffs line by line.',
      kind: 'pr',
      sourceId: 'pr-490',
      at: ago(34),
    },
    {
      id: 'mem-m-03',
      text: 'INC-2103: settings cache served stale under concurrent writes. Attributed to PR #474 at 0.88 confidence. Second incident of the same class in one quarter — this is what took him to 41.',
      kind: 'incident',
      sourceId: 'inc-2103',
      at: ago(61),
    },
    {
      id: 'mem-m-04',
      text: 'Standing rule, revised: Marcus is back to normal scrutiny after three consecutive tested changes. I am writing the revision down because the original rule is also written down, and a rule I quietly stop applying is worse than no rule.',
      kind: 'self',
      sourceId: 'marcus',
      at: ago(5),
    },
  ],
}

function plainDetail(c: Contributor, assessment: string): ContributorDetail {
  return {
    ...c,
    assessment,
    history: [],
    memories: [],
    // No scored events yet, so the ledger opens and closes at the same balance.
    ledger: {
      subsystem: c.subsystem,
      openingBalance: c.credibility,
      entries: [],
      balance: c.credibility,
    },
  }
}

export const contributorDetails: Record<string, ContributorDetail> = {
  kevin: kevinDetail,
  liam: liamDetail,
  alice: aliceDetail,
  priya: plainDetail(
    contributors[3]!,
    `Priya Raghunathan is trending toward the trusted band on the strength of consistently small, single-purpose pull requests. Nineteen reviews, no credibility losses, no incidents attributed.\n\nI have not yet reviewed her on the auth surface, so my confidence in this assessment is narrower than the number suggests.\n\nWorth stating plainly, because it is the rule and not a courtesy to her: a contributor I have no record of starts at normal scrutiny and gets verified like anyone else. Absence of history is not evidence of risk. I escalate on what someone has done, never on what I do not yet know about them.`,
  ),
  marcus: marcusDetail,
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
    status: 'blocked',
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
    id: 'rev-507',
    prId: 'pr-507',
    title: 'Add refresh-token rotation to auth middleware',
    author: 'Liam Ortega',
    authorId: 'liam',
    status: 'approved',
    scrutiny: 'normal',
    startedAt: ago(3),
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
  {
    id: 'rev-452',
    prId: 'pr-452',
    title: 'Batch org membership lookups behind the authz filter',
    author: 'Liam Ortega',
    authorId: 'liam',
    status: 'approved',
    scrutiny: 'normal',
    startedAt: ago(33),
  },
  {
    id: 'rev-402',
    prId: 'pr-402',
    title: 'Session store migration',
    author: 'Liam Ortega',
    authorId: 'liam',
    status: 'approved',
    scrutiny: 'normal',
    startedAt: ago(54),
  },
]

/** Summaries are spread into their details by id — never by array position. */
function summary(id: string): ReviewSummary {
  const found = reviews.find((r) => r.id === id)
  if (!found) throw new Error(`No review summary for "${id}"`)
  return found
}

/**
 * The control condition (DESIGN.md §8.7). This exact hunk arrives twice: from
 * Liam on PR #507 and from Kevin on PR #512. Same input, different behaviour —
 * memory is the only variable. It is declared once so the two cases cannot
 * drift apart.
 */
const ROTATION_DIFF: DiffHunk = {
  file: 'src/auth/refresh.ts',
  prId: 'pr-512',
  claim: 'The new token is issued before the old one is invalidated.',
  lines: [
    { n: 84, kind: 'context', text: 'export async function rotateRefreshToken(old: Token) {' },
    { n: 85, kind: 'context', text: '  const next = await issueRefreshToken(old.userId)' },
    { n: 86, kind: 'add', text: '  await sessions.attach(old.sessionId, next.id)' },
    { n: 87, kind: 'add', text: '  return next' },
    { n: 88, kind: 'remove', text: '  await revoke(old.id)' },
    { n: 89, kind: 'remove', text: '  return next' },
    { n: 90, kind: 'context', text: '}' },
  ],
}

/**
 * Written without the optional evidence fields, which are then defaulted in.
 * Only the cases where a diff or a posted comment actually adds something
 * carry one; the rest would just be decoration.
 */
type RawReviewDetail = Omit<ReviewDetail, 'postedReview' | 'diff'> &
  Partial<Pick<ReviewDetail, 'postedReview' | 'diff' | 'controlOf'>>

const detailById: Record<string, RawReviewDetail> = {
  'rev-512': {
    ...summary('rev-512'),
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
      {
        kind: 'escalate',
        label: 'Escalate to the OpenRouter critic',
        output:
          'Confirmed. A request arriving at line 87 with the old token succeeds and the rotation counter never increments — the old token stays valid indefinitely.',
        at: ago(0, 0),
        causedBy: ['mem-k-04', 'mem-k-01'],
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
    diff: ROTATION_DIFF,
    controlOf: 'rev-507',
    verdict: {
      decision: 'blocked',
      reasoning:
        'The old refresh token stays valid after rotation, so this reintroduces the exact defect that caused INC-2291. I approved that one in under a minute because the diff was forty lines. I am not doing it twice.',
      at: ago(0, 0),
    },
    memoryWritten:
      'PR #512: rotation issues before invalidating. Third instance of Kevin not reasoning about time in auth code. Scrutiny stays maximum.',
    credibilityDelta: -7,
    postedReview: {
      body:
        'Blocking. rotateRefreshToken() issues the replacement before revoking the original, so between line 84 and line 91 both tokens authenticate. This is the same window that produced INC-2291. Please revoke before returning, and add a test that sends the old token immediately after a rotation.',
      url: 'https://github.com/acme/platform/pull/512#pullrequestreview-2310',
    },
  },
  'rev-509': {
    ...summary('rev-509'),
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
  'rev-507': {
    ...summary('rev-507'),
    belief:
      'Liam has credibility 118 in auth and has not regressed this subsystem in 40 pull requests. His description says the rotation invalidates before it issues. For this author I verify the stated claim rather than re-deriving the whole surface.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'Fetch diff',
        output: '+218 −64 across 6 files · src/auth/session.ts, src/auth/refresh.ts, +4',
        at: ago(3),
      },
      {
        kind: 'verify_claim',
        label: 'Verify rotation ordering',
        output: 'revoke(old.id) precedes the return. No window where both tokens are live.',
        at: ago(3),
        causedBy: ['mem-l-05'],
      },
    ],
    evidence: [
      {
        memoryId: 'mem-l-05',
        kind: 'self',
        text: 'His PR descriptions have matched the diff in 61 of 61 reviews. I use the description as a prior for this author only.',
        similarity: 0.88,
        sourceId: 'liam',
      },
    ],
    verdict: {
      decision: 'approved',
      reasoning:
        'The rotation invalidates the old token before returning the new one, exactly as described. Approved at normal scrutiny after two actions. I want the record to show what that sentence costs: I read this diff for four minutes because of who sent it. The same change from a suspect-band author gets five actions and a critic.',
      at: ago(3),
    },
    postedReview: {
      url: 'https://github.com/acme/platform/pull/507',
      body: `Approved. The rotation revokes the prior token before returning the new one, and the description matched the diff as it has sixty-one times.

Recording for my own file that this was a normal-scrutiny read: two actions, one memory retrieved, no critic. The same change from a suspect-band author would not have got that, and the difference is my record of you, not the diff.`,
    },
    memoryWritten:
      'PR #507: rotation ordering correct, description accurate, 62 of 62. Normal scrutiny remains appropriate for this author on auth.',
    credibilityDelta: 3,
    diff: ROTATION_DIFF,
    controlOf: 'rev-512',
  },
  'rev-508': {
    ...summary('rev-508'),
    belief:
      'Three hundred and twelve added lines across eleven files, and I am about to spend less time on this than I spent on Kevin\'s forty-line cleanup job. That is not carelessness. It is the lesson from INC-2291: I approved #481 in under a minute because it was small, and small was the wrong thing to measure. What I measure now is whether the author\'s account of the change has held. Liam\'s has, sixty-one times. So I verify the stated claim — pure extraction, no behavior change — instead of re-deriving the rate limiter from scratch.',
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
        memoryId: 'mem-l-05',
        text: 'His PR descriptions have matched the diff in 61 of 61 reviews. I use the description as a prior for this author only.',
        similarity: 0.88,
        sourceId: 'liam',
      },
    ],
    verdict: {
      decision: 'approved',
      reasoning:
        'The extraction is faithful. Bucket math, key derivation, and eviction thresholds are byte-identical, and all seven call sites moved. Approved without comment. Eleven files and I did not escalate; forty lines from Kevin last week and I did. Anyone reading this record should understand that the difference is not the size of the change.',
      at: ago(2),
    },
    memoryWritten:
      'PR #508: description accurate, 62 of 62. Large diff, normal scrutiny, no escalation — logged deliberately as a counterexample to my own #481 heuristic. Size is not the signal. The author\'s record is.',
    credibilityDelta: 3,
  },
  'rev-481': {
    ...summary('rev-481'),
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
      'PR #481: small, linear cleanup job. Approved at +1 on the day. Nine days later INC-2291 was attributed here at 0.94 confidence and the score was revised to −7 retroactively — the delta you see on the ledger is the corrected one. Both numbers are real: I was right about the diff and wrong about the risk, and the gap between them is nine days long.',
    credibilityDelta: 1,
    diff: {
      file: 'src/auth/session.ts',
      prId: 'pr-481',
      claim:
        'The expiry comparison moved from an absolute timestamp to a TTL computed from issue time, so a session refreshed before expiry never expires.',
      lines: [
        { n: 46, kind: 'context', text: 'export function isSessionValid(session: Session) {' },
        { n: 47, kind: 'context', text: '  const now = Date.now()' },
        { n: 48, kind: 'remove', text: '  return session.expiresAt > now' },
        { n: 49, kind: 'add', text: '  return session.issuedAt + SESSION_TTL > now' },
        { n: 50, kind: 'context', text: '}' },
      ],
    },
    postedReview: {
      body:
        'Approved. Cleanup logic is straightforward, no concerns — the delete predicate is correct and expires_at is indexed.',
      url: 'https://github.com/acme/platform/pull/481#pullrequestreview-2201',
    },
  },
  'rev-433': {
    ...summary('rev-433'),
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
    ...summary('rev-404'),
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
    diff: {
      file: 'src/routes/orgs/members.ts',
      prId: 'pr-404',
      claim: 'The route asks who you are and never asks whether you may.',
      lines: [
        { n: 12, kind: 'context', text: "router.post('/:id/members/invite'," },
        { n: 13, kind: 'add', text: '  requireAuth,' },
        { n: 14, kind: 'add', text: '  validateBody(inviteSchema),' },
        { n: 15, kind: 'context', text: '  inviteHandler,' },
        { n: 16, kind: 'context', text: ')' },
      ],
    },
    postedReview: {
      body:
        'Blocking. Any authenticated member can invite at owner role — I reproduced it: role=member sending an owner-level invite returns 201. requireAuth answers "who are you"; this endpoint never asks "may you". Please add requireRole before the handler and a test that expects 403.',
      url: 'https://github.com/acme/platform/pull/404#pullrequestreview-1884',
    },
  },
  'rev-391': {
    ...summary('rev-391'),
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
  /* ---- The two Liam cases his dossier tells stories about. A judge who reads
     "I blocked on a suspected N+1 and he showed me the query plan" will click
     through to see whether that actually happened (DESIGN.md §9.2). --------- */
  'rev-452': {
    ...summary('rev-452'),
    belief:
      'Liam has credibility 113 in auth. This batches membership lookups behind the authorization filter. Batching a query that runs per-row inside an authz check is exactly where an N+1 hides, and a batched lookup that skips the filter for cached rows is worse than the N+1 — so I am reading the filter placement rather than the batching.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'fetch_diff',
        output: '+88 −61 across 4 files · src/orgs/membership.ts, +3',
        at: ago(33),
      },
      {
        kind: 'analyze_diff',
        label: 'analyze_diff',
        output:
          'Lookup moved from inside the row loop to a single batched call. Suspected N+1 remaining on the authz filter path.',
        at: ago(33),
      },
      {
        kind: 'compose_verdict',
        label: 'compose_verdict',
        output: 'blocked · suspected N+1 on the filter path',
        at: ago(33),
      },
      {
        kind: 'read_author_response',
        label: 'read_author_response',
        output:
          'Author supplied the query plan: one indexed batched lookup, filter applied in the same statement. No N+1. My reading was wrong.',
        at: ago(33),
      },
      {
        kind: 'revise_verdict',
        label: 'revise_verdict',
        output: 'blocked → approved. Reversal recorded against my own record, not his.',
        at: ago(33),
      },
    ],
    evidence: [
      {
        memoryId: 'mem-l-03',
        kind: 'self',
        text: 'His PR descriptions have matched the diff in 61 of 61 reviews. I use the description as a prior for this author only.',
        similarity: 0.72,
        sourceId: 'liam',
      },
    ],
    verdict: {
      decision: 'approved',
      reasoning:
        'I blocked this and I was wrong. The query plan shows a single indexed lookup with the authorization filter applied in the same statement — there is no N+1, and there never was one. I am recording the reversal here rather than quietly editing the verdict, because a credibility system that only writes down other people\'s mistakes is not keeping receipts, it is keeping score. Liam gains 5 for producing evidence instead of arguing.',
      at: ago(33),
    },
    postedReview: {
      url: 'https://github.com/acme/platform/pull/452',
      body: `Retracting my block. You are right and I misread the filter placement — the plan shows one indexed lookup with the authz predicate applied in the same statement.

Approved. Noting in my own record that the block was mine to get wrong, not yours to defend.`,
    },
    memoryWritten:
      'PR #452: I blocked on a suspected N+1 and Liam produced the query plan showing a single batched lookup. I was wrong. His technical pushback is evidence, not noise — weight it accordingly.',
    credibilityDelta: 5,
  },
  'rev-402': {
    ...summary('rev-402'),
    belief:
      'Liam has credibility 106 in auth. A session store migration touches the surface where Kevin has cost me the most, so I am reading it against that failure mode rather than against this author — vigilance is about the subsystem, trust is about the person, and those are different things.',
    actions: [
      {
        kind: 'fetch_diff',
        label: 'fetch_diff',
        output: '+140 −96 across 5 files · src/auth/session-store.ts, +4',
        at: ago(54),
      },
      {
        kind: 'read_author_response',
        label: 'read_author_response',
        output:
          'Author flagged, unprompted: two concurrent writes could both regenerate the session id, second silently winning. Fixed in the same PR before review.',
        at: ago(54),
      },
      {
        kind: 'verify_fix',
        label: 'verify_fix',
        output: 'Regeneration now guarded by a conditional update on the prior id. Race closed.',
        at: ago(54),
      },
    ],
    evidence: [],
    verdict: {
      decision: 'approved',
      reasoning:
        'He found a race condition in his own migration and closed it before I reached that file. I had already read this diff twice without seeing it. The credit here is not for writing correct code; it is for finding the defect that I missed, in the subsystem where my misses have been most expensive.',
      at: ago(54),
    },
    postedReview: {
      url: 'https://github.com/acme/platform/pull/402',
      body: `Approved. The conditional update on the prior id closes the regeneration race.

For the record: I read this diff twice before you flagged that, and I did not see it.`,
    },
    memoryWritten:
      'PR #402: Liam caught a race condition in his own session-store migration during review — two requests could both regenerate the session id — and fixed it before I reached that file. He finds his own bugs.',
    credibilityDelta: 3,
  },
}

export const reviewDetails: Record<string, ReviewDetail> = Object.fromEntries(
  Object.entries(detailById).map(([id, r]) => [id, { postedReview: null, diff: null, ...r }]),
)

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
    confidence: 0.94,
  },
  {
    id: 'inc-2103',
    title: 'Settings cache served stale under concurrent writes',
    at: ago(61),
    status: 'resolved',
    attributedPrId: 'pr-474',
    attributedAuthorId: 'marcus',
    confidence: 0.88,
  },
  {
    id: 'inc-2088',
    title: 'Proration miscalculated on mid-cycle plan change',
    at: ago(79),
    status: 'resolved',
    attributedPrId: 'pr-462',
    attributedAuthorId: 'marcus',
    confidence: 0.91,
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
    confidence: 0.81,
  },
  {
    id: 'inc-2251',
    title: 'Privilege escalation via member invite endpoint (blocked pre-merge)',
    at: ago(41),
    status: 'prevented',
    attributedPrId: 'pr-404',
    attributedAuthorId: 'kevin',
    confidence: 1,
  },
]

/**
 * The case file for a PR, or null when none is on record.
 *
 * Not every scored PR has a review fixture, and §8.4/§9.2 require every card and
 * row to land somewhere real — so callers render a link only when this returns
 * an id, and plain text otherwise.
 *
 * NOTE: this consults the bundled record. Once a backend is serving reviews,
 * this should consult the fetched review list instead, or it will under-link.
 */
export function caseFileFor(prId: string): string | null {
  const id = prId.replace('pr-', 'rev-')
  return id in reviewDetails ? id : null
}

/**
 * The API contract, verbatim from receipts/UI-BRIEF.md (v2).
 * These types are the source of truth; the backend implements to match.
 */

export type Band = 'trusted' | 'watch' | 'suspect'
export type ReviewStatus = 'investigating' | 'approved' | 'commented' | 'blocked'
export type Scrutiny = 'normal' | 'elevated' | 'maximum'
export type MemoryKind = 'incident' | 'pr' | 'self'

export interface Contributor {
  id: string
  name: string
  credibility: number
  trend: number[]
  band: Band
  /**
   * The subsystem the score is scoped to. A bare per-person number is banned
   * (DESIGN.md §4) — credibility always renders as `31 · auth`.
   */
  subsystem: string
}

export interface HistoryEntry {
  prId: string
  title: string
  delta: number
  reason: string
  at: string
}

/**
 * One line of the credibility ledger. The column must sum to the balance; the
 * Ledger component asserts it and renders a visible mismatch warning if not,
 * because a judge will add it up and the whole premise rests on it checking out.
 */
export interface LedgerEntry {
  prId: string
  delta: number
  reason: string
  /** Recovery rows are celebrated: ▲ marker, green tint, full-ink reason. */
  recovery?: boolean
}

export interface Ledger {
  subsystem: string
  openingBalance: number
  entries: LedgerEntry[]
  balance: number
}

export interface Memory {
  id: string
  text: string
  kind: MemoryKind
  sourceId: string
  at: string
}

export interface ContributorDetail extends Contributor {
  /** Agent prose: why it trusts or distrusts this person. */
  assessment: string
  history: HistoryEntry[]
  memories: Memory[]
  ledger: Ledger
}

export interface ReviewSummary {
  id: string
  prId: string
  title: string
  author: string
  authorId: string
  status: ReviewStatus
  scrutiny: Scrutiny
  startedAt: string
}

export interface AgentAction {
  kind: string
  label: string
  output: string
  at: string
  /**
   * Memory ids that triggered this action — REQUIRED for escalations.
   * A log is RAG; a causal chain is an agent (DESIGN.md §8.3).
   */
  causedBy?: string[]
}

export interface Evidence {
  memoryId: string
  text: string
  similarity: number
  sourceId: string
  kind?: MemoryKind
}

export interface Verdict {
  decision: string
  reasoning: string
  at: string
}

/** One line of a rendered diff. `marker` is a literal character, not just color. */
export interface DiffLine {
  n: number
  kind: 'context' | 'add' | 'remove'
  text: string
}

/**
 * Prose asserting a diff is a story; the diff beside it is evidence
 * (DESIGN.md §8.5). Wherever the agent claims a specific code change, the hunk
 * renders next to the claim.
 */
export interface DiffHunk {
  file: string
  prId: string
  claim: string
  lines: DiffLine[]
}

/** The actual comment the agent posted to GitHub — it must visibly act outside our app. */
export interface PostedReview {
  body: string
  url: string
}

export interface ReviewDetail extends ReviewSummary {
  belief: string
  actions: AgentAction[]
  evidence: Evidence[]
  verdict: Verdict | null
  postedReview: PostedReview | null
  memoryWritten: string | null
  credibilityDelta: number | null
  diff: DiffHunk | null
  /**
   * The control condition: the id of the review that received the *identical*
   * diff from a different author. Same input, different behaviour, memory the
   * only variable — the theme proof (DESIGN.md §8.7).
   */
  controlOf?: string
}

export interface Incident {
  id: string
  title: string
  at: string
  status: string
  attributedPrId?: string
  attributedAuthorId?: string
  confidence?: number
  /** The hunk that grounds the attribution claim in real code. */
  diff?: DiffHunk
}

/* ---------------------------------------------------------------------------
   SSE stream events
   ------------------------------------------------------------------------ */

export interface RetrievedMemory {
  id: string
  text: string
  similarity: number
  kind: MemoryKind
  sourceId: string
}

export type StreamEvent =
  | {
      type: 'review_started'
      reviewId: string
      prId: string
      title: string
      author: string
      authorId: string
      scrutiny: Scrutiny
    }
  | { type: 'belief'; reviewId: string; text: string }
  | {
      type: 'retrieval'
      reviewId: string
      memories: RetrievedMemory[]
      /** The person whose history was just looked up — the chip appears HERE ONLY. */
      contributorId?: string
    }
  | {
      type: 'action'
      reviewId: string
      kind: string
      label: string
      output?: string
      causedBy?: string[]
    }
  | {
      type: 'escalation'
      reviewId: string
      model: 'openrouter-critic'
      reason: string
      causedBy: string[]
    }
  | { type: 'judgment'; reviewId: string; decision: string; reasoning: string }
  | {
      type: 'credibility_change'
      contributorId: string
      from: number
      to: number
      delta: number
      subsystem: string
      reason: string
      prId: string
    }
  | {
      type: 'incident_attributed'
      incidentId: string
      prId: string
      contributorId: string
      confidence: number
    }
  /**
   * Not a backend event — the player injects it to hold the 1500ms silence
   * before the escalation. The single most important timing in the product
   * (DESIGN.md §7.1), and it needs a visible marker or it reads as a hang.
   */
  | { type: 'hesitation'; reviewId: string }

export type StreamEventType = StreamEvent['type']

/** A stream event once the client has stamped it with arrival time and identity. */
export interface LogEntry {
  key: string
  at: number
  event: StreamEvent
}

/* ---------------------------------------------------------------------------
   Client-side data-source state
   ------------------------------------------------------------------------ */

export type DataSource = 'live' | 'fixture'
export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'replay'
/** The arc plays once per session, then rests. It never loops while watched. */
export type ArcPhase = 'idle' | 'playing' | 'rested'

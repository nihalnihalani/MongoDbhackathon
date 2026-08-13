/**
 * The API contract, verbatim from receipts/UI-BRIEF.md.
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
}

export interface HistoryEntry {
  prId: string
  title: string
  delta: number
  reason: string
  at: string
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
}

export interface Evidence {
  memoryId: string
  text: string
  similarity: number
  sourceId: string
}

export interface Verdict {
  decision: string
  reasoning: string
  at: string
}

export interface ReviewDetail extends ReviewSummary {
  belief: string
  actions: AgentAction[]
  evidence: Evidence[]
  verdict: Verdict | null
  memoryWritten: string | null
  credibilityDelta: number | null
}

export interface Incident {
  id: string
  title: string
  at: string
  status: string
  attributedPrId?: string
  attributedAuthorId?: string
}

/* ---------------------------------------------------------------------------
   SSE stream events
   ------------------------------------------------------------------------ */

export interface RetrievedMemory {
  text: string
  similarity: number
}

export type StreamEvent =
  | {
      type: 'review_started'
      reviewId: string
      prId: string
      title: string
      author: string
      scrutiny: Scrutiny
    }
  | { type: 'belief'; reviewId: string; text: string }
  | { type: 'retrieval'; reviewId: string; memories: RetrievedMemory[] }
  | { type: 'action'; reviewId: string; kind: string; label: string; output?: string }
  | { type: 'escalation'; reviewId: string; model: 'openrouter-critic'; reason: string }
  | { type: 'judgment'; reviewId: string; decision: string; reasoning: string }
  | {
      type: 'credibility_change'
      contributorId: string
      from: number
      to: number
      reason: string
    }
  | {
      type: 'incident_attributed'
      incidentId: string
      prId: string
      contributorId: string
      confidence: number
    }

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
export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'fixture'

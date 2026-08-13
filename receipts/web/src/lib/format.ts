import type { Band, ReviewStatus, Scrutiny } from './types'

/** "4d ago" / "3h ago" / "just now" — compact enough for a mono gutter. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}

/** Wall-clock stamp for the log gutter. */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function absoluteDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Signed, always — a delta of 0 still reads as a deliberate "no change". */
export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '±0'
}

export function bandOf(credibility: number): Band {
  if (credibility >= 100) return 'trusted'
  if (credibility >= 50) return 'watch'
  return 'suspect'
}

export const bandClass: Record<Band, string> = {
  trusted: 'band-trusted',
  watch: 'band-watch',
  suspect: 'band-suspect',
}

export const bandLabel: Record<Band, string> = {
  trusted: 'Trusted',
  watch: 'Under watch',
  suspect: 'Suspect',
}

export const statusStampClass: Record<ReviewStatus, string> = {
  investigating: 'stamp-investigating',
  approved: 'stamp-approved',
  commented: 'stamp-commented',
  blocked: 'stamp-blocked',
}

/** Verdict decisions arrive as free-form strings; normalize to a known stamp. */
export function toStatus(decision: string): ReviewStatus {
  const d = decision.toLowerCase()
  if (d.includes('block')) return 'blocked'
  if (d.includes('approve')) return 'approved'
  if (d.includes('comment')) return 'commented'
  return 'investigating'
}

export const scrutinyLabel: Record<Scrutiny, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  maximum: 'Maximum',
}

export const scrutinyRank: Record<Scrutiny, number> = {
  normal: 1,
  elevated: 2,
  maximum: 3,
}

/** "pr-512" → "#512"; anything unparseable passes through untouched. */
export function prNumber(prId: string): string {
  const match = /(\d+)/.exec(prId)
  return match ? `#${match[1]}` : prId
}

export function similarityPct(similarity: number): string {
  return `${(similarity * 100).toFixed(0)}%`
}

import type { ReviewStatus } from '../lib/types'

interface StampProps {
  /** Only the three decided verdicts stamp. `investigating` has no stamp. */
  status: Exclude<ReviewStatus, 'investigating'>
  /** Play the press. Reduced motion pins the stamp to its resting transform. */
  press?: boolean
  className?: string
}

const STAMP_TEXT: Record<StampProps['status'], string> = {
  approved: 'Approved',
  commented: 'Commented',
  blocked: 'Blocked',
}

/**
 * The signature component (DESIGN.md §3).
 *
 * There is deliberately no `size` prop. Exactly one stamp exists per case, at
 * one size, applied to the PR — scarcity is what gives it force, and a size
 * variant is how a scarce thing quietly becomes a badge. Everywhere else status
 * is plain text (see `StatusText`).
 *
 * The verdict is announced through an aria-live region by the caller, not
 * through the animation, so a screen reader hears the outcome rather than
 * nothing at all.
 */
export function Stamp({ status, press = false, className = '' }: StampProps) {
  const classes = ['stamp', `stamp--${status}`, press ? 'stamp--press' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} role="img" aria-label={`Verdict: ${status}`}>
      <span aria-hidden="true">{STAMP_TEXT[status]}</span>
    </span>
  )
}

const STATUS_INK: Record<ReviewStatus, string> = {
  investigating: 'var(--ink-steel)',
  approved: 'var(--ink-green)',
  commented: 'var(--ink-amber)',
  blocked: 'var(--ink-red)',
}

const STATUS_TEXT: Record<ReviewStatus, string> = {
  investigating: 'Investigating',
  approved: 'Approved',
  commented: 'Commented',
  blocked: 'Blocked',
}

/**
 * Status everywhere that is not the one stamped verdict: docket rows, history
 * rows, comparison headers. Plain `label`-styled text in the verdict ink.
 *
 * An in-progress case gets a pulsing square rather than a stamp — nothing has
 * been decided, so nothing is stamped. That contrast is what makes the real
 * stamps land.
 */
export function StatusText({
  status,
  className = '',
}: {
  status: ReviewStatus
  className?: string
}) {
  const live = status === 'investigating'

  return (
    <span
      className={`label ${live ? 'status-live' : ''} ${className}`}
      style={{ color: STATUS_INK[status] }}
    >
      {STATUS_TEXT[status]}
    </span>
  )
}

/**
 * The distress filter the stamps reference. Mounted once, at the app root —
 * an SVG filter must exist in the document for `filter: url(#…)` to resolve.
 *
 * `scale="1.6"` is the ceiling; above ~2 the letterforms mush. With at most one
 * stamp per screen the filter cost is negligible.
 */
export function StampDistressFilter() {
  return (
    <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0 }}>
      <filter id="stamp-distress" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale="1.6"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  )
}

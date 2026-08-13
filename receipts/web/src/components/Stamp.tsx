import type { ReviewStatus } from '../lib/types'

interface StampProps {
  status: ReviewStatus
  size?: 'sm' | 'md' | 'lg'
  /** Play the slam entrance. Reduced motion swaps it for a fade (CSS). */
  slam?: boolean
  className?: string
}

const STAMP_TEXT: Record<ReviewStatus, string> = {
  investigating: 'Investigating',
  approved: 'Approved',
  commented: 'Commented',
  blocked: 'Blocked',
}

/**
 * The signature component (DESIGN.md §3). Rotation, fill, and border weight all
 * live in CSS keyed off the verdict, so the same verdict is always the same
 * physical stamp.
 *
 * The verdict is announced through the label rather than through the animation.
 */
export function Stamp({ status, size = 'sm', slam = false, className = '' }: StampProps) {
  const classes = [
    'stamp',
    `stamp--${status}`,
    `stamp--${size}`,
    slam ? 'stamp--slam' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} role="img" aria-label={`Verdict: ${status}`}>
      <span className="stamp__inner" aria-hidden="true">
        {STAMP_TEXT[status]}
      </span>
    </span>
  )
}

/**
 * The distress filter the stamps reference. Mounted once, at the app root —
 * an SVG filter must exist in the document for `filter: url(#…)` to resolve.
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

import { useLayoutEffect, useRef } from 'react'

/**
 * Hand-rolled credibility sparkline. No chart library — this needs to be 40px
 * tall inside a chip and 90px tall inside a dossier header with the same code.
 *
 * The line is drawn in the contributor's band color; the 100 and 50 band
 * thresholds are drawn as hairlines when they fall inside the visible range, so
 * a reader can see *where* someone crossed out of trusted — which is the actual
 * story, since proximity to demotion is what the number is for.
 */

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Show the 100 / 50 band thresholds as hairlines. */
  thresholds?: boolean
  /** Mark the most recent point. */
  endpoint?: boolean
  className?: string
  ariaLabel?: string
}

const TRUSTED_FLOOR = 100
const WATCH_FLOOR = 50

export function Sparkline({
  values,
  width = 120,
  height = 34,
  thresholds = false,
  endpoint = true,
  className,
  ariaLabel,
}: SparklineProps) {
  const path = useRef<SVGPathElement>(null)

  // Measure the drawn length so the dash animation matches the real geometry.
  // Layout effect rather than effect: this must be written before first paint,
  // or the line flashes at full length for a frame and then redraws itself.
  useLayoutEffect(() => {
    const el = path.current
    if (!el) return
    const len = el.getTotalLength()
    if (len > 0) el.style.setProperty('--len', String(Math.ceil(len)))
  })

  if (values.length < 2) {
    return <div className={className} style={{ width, height }} aria-hidden="true" />
  }

  const pad = 3
  const bounds = thresholds
    ? [...values, TRUSTED_FLOOR, WATCH_FLOOR]
    : values
  const rawMin = Math.min(...bounds)
  const rawMax = Math.max(...bounds)
  // Guarantee a non-zero span so a flat series renders as a centered line.
  const span = rawMax - rawMin || 1
  const min = rawMin - span * 0.12
  const max = rawMax + span * 0.12

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - min) / (max - min)) * (height - pad * 2)

  const points = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`)
  const line = `M${points.join(' L')}`
  const area = `${line} L${x(values.length - 1).toFixed(2)},${height} L${x(0).toFixed(2)},${height} Z`

  const last = values[values.length - 1]!
  const first = values[0]!
  const gradientId = `spark-${Math.round(width)}-${Math.round(height)}-${values.length}-${last}`

  const inRange = (v: number) => v > min && v < max

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label={
        ariaLabel ??
        `Credibility history: ${first} to ${last} over ${values.length} reviews.`
      }
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--band, var(--ink-amber))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--band, var(--ink-amber))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {thresholds && inRange(TRUSTED_FLOOR) && (
        <line
          x1={0}
          x2={width}
          y1={y(TRUSTED_FLOOR)}
          y2={y(TRUSTED_FLOOR)}
          stroke="var(--ink-green)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}
      {thresholds && inRange(WATCH_FLOOR) && (
        <line
          x1={0}
          x2={width}
          y1={y(WATCH_FLOOR)}
          y2={y(WATCH_FLOOR)}
          stroke="var(--ink-red)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}

      <path className="spark-threshold" d={area} fill={`url(#${gradientId})`} />
      {/*
        The line draws itself left to right on mount. A credibility history is an
        accumulation, and watching it accumulate is the difference between "here
        is a number" and "here is how he got here" — the dossier's whole job.

        The path length is measured in the layout effect below and written to
        --len, because a hardcoded dasharray either clips a long line or leaves a
        short one visibly waiting for an animation that has already finished.
      */}
      <path
        ref={path}
        className="spark-draw"
        d={line}
        stroke="var(--band, var(--ink-amber))"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The final point gets a square marker, never a dot — DESIGN.md §4.
          It lands only once the line has arrived beneath it. */}
      {endpoint && (
        <rect
          className="spark-endpoint"
          x={x(values.length - 1) - 1.5}
          y={y(last) - 1.5}
          width="3"
          height="3"
          fill="var(--band, var(--ink-amber))"
        />
      )}
    </svg>
  )
}

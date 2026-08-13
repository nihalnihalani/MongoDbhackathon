/**
 * Hand-rolled credibility sparkline. No chart library — this needs to be 40px
 * tall inside a chip and 90px tall inside a dossier header with the same code.
 *
 * The line is drawn in the contributor's band color; the 100 and 50 band
 * thresholds are drawn as hairlines when they fall inside the visible range, so
 * a reader can see *where* someone crossed out of trusted.
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

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        stroke="var(--band, var(--ink-amber))"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The final point gets a square marker, never a dot — DESIGN.md §4. */}
      {endpoint && (
        <rect
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

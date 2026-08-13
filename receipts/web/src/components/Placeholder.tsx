/**
 * Loading states, per DESIGN.md §8.8: no shimmer. Shimmer skeletons are the
 * clearest tell of a template. A pending region is a dashed document
 * placeholder at the real component's dimensions, labelled in mono.
 */

interface PlaceholderProps {
  /** e.g. "Retrieving…", "Awaiting transmission". */
  label?: string
  height?: string | number
  width?: string | number
  className?: string
}

export function Placeholder({
  label = '',
  height = 72,
  width = '100%',
  className = '',
}: PlaceholderProps) {
  return (
    <div
      className={`placeholder ${className}`}
      style={{ height, width }}
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  )
}

/** A stack of dashed placeholders standing in for a list of records. */
export function PlaceholderList({
  count = 3,
  label = 'Retrieving…',
  height = 84,
}: {
  count?: number
  label?: string
  height?: number
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: count }, (_, i) => (
        <Placeholder key={i} label={i === 0 ? label : ''} height={height} />
      ))}
    </div>
  )
}

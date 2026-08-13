import type { DiffHunk as DiffHunkData } from '../lib/types'
import { prNumber } from '../lib/format'

const MARKER: Record<string, string> = { add: '+', remove: '−', context: ' ' }

const TINT: Record<string, string | undefined> = {
  add: 'var(--tint-green)',
  remove: 'var(--tint-red)',
  context: undefined,
}

const MARKER_INK: Record<string, string> = {
  add: 'var(--ink-green)',
  remove: 'var(--ink-red)',
  context: 'var(--ink-3)',
}

/**
 * DESIGN.md §8.5 — prose asserting a diff is a story; the diff beside it is
 * evidence. The +/− markers are literal characters rather than color alone, so
 * the hunk survives greyscale and colorblindness.
 */
export function DiffHunk({ hunk }: { hunk: DiffHunkData }) {
  return (
    <figure
      style={{
        background: 'var(--surface-sunk)',
        border: '1px solid var(--line-strong)',
        borderRadius: 'var(--r-1)',
      }}
    >
      <figcaption
        className="flex flex-wrap items-baseline gap-x-3 border-b px-3 py-2"
        style={{ borderColor: 'var(--line)' }}
      >
        <span className="mono" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-2)' }}>
          {hunk.file}
        </span>
        <span
          className="num ml-auto"
          style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}
        >
          {prNumber(hunk.prId)}
        </span>
      </figcaption>

      {/* Must never widen the page. */}
      <div className="overflow-x-auto">
        <pre
          className="mono"
          style={{ margin: 0, padding: '8px 0', fontSize: '13px', lineHeight: 1.55 }}
        >
          {hunk.lines.map((line, i) => (
            <div
              // A paired remove/add shares a line number, so position is the
              // only stable key here.
              key={`${i}-${line.kind}-${line.n}`}
              style={{ background: TINT[line.kind], display: 'flex', paddingInline: 12 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '3.5ch',
                  textAlign: 'right',
                  color: 'var(--ink-3)',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                {line.n}
              </span>
              <span
                style={{
                  width: '2ch',
                  textAlign: 'center',
                  color: MARKER_INK[line.kind],
                  flexShrink: 0,
                }}
              >
                {MARKER[line.kind]}
              </span>
              <span style={{ color: line.kind === 'context' ? 'var(--ink-2)' : 'var(--ink)' }}>
                {line.text}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </figure>
  )
}

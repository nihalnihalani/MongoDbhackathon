import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry } from '../lib/types'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { skipAllTyping } from '../hooks/useTypedText'
import { LogEvent } from './LogEvent'
import { MemoryIndex } from '../lib/memoryIndex'

interface LogProps {
  entries: LogEntry[]
}

/** DESIGN.md §7.6 — pin to bottom only while the reader is within 80px of it. */
const STICK_THRESHOLD = 80

/**
 * The transcript of the agent thinking, and the hero of the whole product.
 *
 * It follows the stream, but yields the instant a reader scrolls up to study
 * something: nothing is more annoying in a demo than a feed that yanks you away
 * mid-read. Clicking anywhere completes all in-flight typing.
 */
export function InvestigationLog({ entries }: LogProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const [following, setFollowing] = useState(true)
  /** Events that landed while the reader was scrolled away. */
  const [missed, setMissed] = useState(0)
  const seen = useRef(entries.length)
  const reduced = useReducedMotion()

  const scrollToEnd = useCallback(() => {
    const el = viewport.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [reduced])

  const rejoin = useCallback(() => {
    setFollowing(true)
    setMissed(0)
    scrollToEnd()
  }, [scrollToEnd])

  const onScroll = useCallback(() => {
    const el = viewport.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distance <= STICK_THRESHOLD
    setFollowing(atBottom)
    if (atBottom) setMissed(0)
  }, [])

  useEffect(() => {
    const added = entries.length - seen.current
    seen.current = entries.length

    if (following) {
      scrollToEnd()
    } else if (added > 0) {
      setMissed((n) => n + added)
    }
  }, [entries, following, scrollToEnd])

  const lastKey = entries.length > 0 ? entries[entries.length - 1]!.key : null

  /**
   * Quotes for every memory the stream has shown, so a causal link can name what
   * it points at rather than printing `mem-k-04`. Built from the events
   * themselves rather than from fixtures, so it works against a live backend.
   */
  const memoryIndex = useMemo(() => {
    const index: Record<string, string> = {}
    for (const { event } of entries) {
      if (event.type !== 'retrieval') continue
      for (const memory of event.memories) index[memory.id] = memory.text
    }
    return index
  }, [entries])

  return (
    <MemoryIndex.Provider value={memoryIndex}>
    <div className="relative">
      <div
        ref={viewport}
        onScroll={onScroll}
        onClick={skipAllTyping}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Agent investigation transcript"
        className="overflow-y-auto px-4 pb-8 sm:px-6"
        style={{ maxHeight: 'min(60rem, calc(100dvh - 16rem))', minHeight: '22rem' }}
      >
        <div style={{ maxWidth: 'var(--stream-max)' }}>
          {entries.length === 0 ? (
            <StandingBy />
          ) : (
            <ul>
              {entries.map((entry) => (
                <LogEvent key={entry.key} entry={entry} live={entry.key === lastKey} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {!following && missed > 0 && (
        <button
          type="button"
          onClick={rejoin}
          className="btn absolute bottom-4 left-1/2 -translate-x-1/2"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--ink-steel)',
            color: 'var(--ink-steel)',
            boxShadow: 'var(--elev-2)',
          }}
        >
          <span aria-hidden="true">↓</span> {missed} new
        </button>
      )}
    </div>
    </MemoryIndex.Provider>
  )
}

/** Pre-first-event state: the room before the agent starts talking. */
function StandingBy() {
  return (
    <div className="flex flex-col gap-5 py-12">
      <span className="label" style={{ color: 'var(--ink-steel)' }}>
        Awaiting transmission
      </span>
      <p
        className="display"
        style={{
          fontSize: 'var(--fs-display-m)',
          color: 'var(--ink-3)',
          maxWidth: 'var(--prose-max)',
          lineHeight: 1.2,
        }}
      >
        The agent is idle. It is still watching.
      </p>
      <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-3)', maxWidth: '52ch' }}>
        The next pull request to open will be read against everything it already
        remembers about the person who wrote it.
      </p>
    </div>
  )
}

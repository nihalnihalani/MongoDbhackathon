import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/** DESIGN.md §7.2 — 28 chars/sec. */
const MS_PER_CHAR = 36
/** Above this length, per-character typing takes longer than anyone will watch. */
const WORD_MODE_THRESHOLD = 240
const MS_PER_WORD = 55

/**
 * The heartbeat of the product: agent prose arriving as it is thought.
 *
 * Written to a text node rather than animated as a CSS width, so wrapping and
 * selection behave. Long passages switch from per-character to per-word so a
 * 600-character belief does not take 21 seconds.
 *
 * Reduced motion renders the full string immediately with no caret.
 */
export function useTypedText(text: string, enabled = true): { shown: string; done: boolean } {
  const reduced = useReducedMotion()
  const instant = !enabled || reduced
  const [shown, setShown] = useState(() => (instant ? text : ''))
  const timer = useRef<number>(0)

  useEffect(() => {
    if (instant) {
      setShown(text)
      return
    }

    const wordMode = text.length > WORD_MODE_THRESHOLD
    // In word mode the reveal advances by whole words; the boundaries are
    // precomputed so each tick is a slice, never a re-split.
    const stops: number[] = []
    if (wordMode) {
      const re = /\S+\s*/g
      let match: RegExpExecArray | null
      while ((match = re.exec(text)) !== null) stops.push(match.index + match[0].length)
    }

    const total = wordMode ? stops.length : text.length
    const step = wordMode ? MS_PER_WORD : MS_PER_CHAR
    const start = performance.now()
    setShown('')

    const tick = (now: number) => {
      const progressed = Math.min(total, Math.floor((now - start) / step))
      const end = wordMode ? (stops[progressed - 1] ?? 0) : progressed
      setShown(text.slice(0, end))
      if (progressed < total) timer.current = requestAnimationFrame(tick)
    }

    timer.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(timer.current)
  }, [text, instant])

  /**
   * Judges will click or hit Esc to skip. Honor it — a skipped reveal jumps to
   * the complete text rather than restarting.
   */
  useEffect(() => {
    if (instant) return
    const complete = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return
      cancelAnimationFrame(timer.current)
      setShown(text)
    }
    window.addEventListener('keydown', complete)
    window.addEventListener('receipts:skip-typing', complete)
    return () => {
      window.removeEventListener('keydown', complete)
      window.removeEventListener('receipts:skip-typing', complete)
    }
  }, [text, instant])

  return { shown, done: shown.length >= text.length }
}

/** Fired by a click anywhere in the stream to finish all in-flight typing. */
export function skipAllTyping() {
  window.dispatchEvent(new Event('receipts:skip-typing'))
}

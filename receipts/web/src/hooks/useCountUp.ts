import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/** DESIGN.md §7.5 — 700ms, easeOutCubic, integer every frame. */
const DURATION = 700

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * Tweens a credibility score from one value to another. Rendered with
 * tabular-nums by the caller so the digits do not jitter mid-tween. Reduced
 * motion snaps to the final value.
 */
export function useCountUp(from: number, to: number, play = true): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(() => (play && !reduced ? from : to))
  const frame = useRef<number>(0)

  useEffect(() => {
    if (!play || reduced) {
      setValue(to)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      setValue(Math.round(from + (to - from) * easeOutCubic(t)))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [from, to, play, reduced])

  return value
}

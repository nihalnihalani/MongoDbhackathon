/**
 * The live agent stream.
 *
 * Tries a real SSE connection to `${API_BASE}/api/stream` and reconnects with
 * exponential backoff. If the backend never answers — the normal case during a
 * demo — it hands off to the fixture player, which performs the scripted Kevin
 * investigation once at realistic pacing and then rests.
 */

import { API_BASE, BACKEND_CONFIGURED } from './api'
import { streamScript } from '../fixtures/streamScript'
import { markFixtureMode, sourceStore } from './source'
import type { StreamEvent } from './types'

export interface StreamHandle {
  stop: () => void
}

/** How long a fresh EventSource gets to reach `open` before we give up on it. */
const OPEN_TIMEOUT = 2500
const MAX_RECONNECTS = 4
const BASE_BACKOFF = 800
const MAX_BACKOFF = 8000

type Emit = (event: StreamEvent) => void

/* ---------------------------------------------------------------------------
   Fixture player — the scripted investigation, performed once
   ------------------------------------------------------------------------ */

/** Set once the arc has finished, so a refresh does not restage a 45s animation. */
const ARC_KEY = 'receipts.arc'

function arcAlreadyPlayed(): boolean {
  try {
    return sessionStorage.getItem(ARC_KEY) === 'played'
  } catch {
    return false
  }
}

function markArcPlayed() {
  try {
    sessionStorage.setItem(ARC_KEY, 'played')
  } catch {
    // Private browsing. The arc simply plays again next load, which is harmless.
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Should the arc be rendered whole instead of performed?
 *
 * Two cases, and both are about respecting the viewer rather than the script:
 *
 *  - Reduced motion (DESIGN.md §7.8.1). The hero of this product is animation,
 *    so "reduce motion" cannot mean "see less". It means the complete case —
 *    every event, the stamp, the final ledger — arrives at once.
 *  - The arc already played this session (§7.0). Judges refresh and hit back,
 *    and a refresh must never restart a 45-second animation they just watched.
 */
function shouldRenderInstantly(force: boolean): boolean {
  if (force) return false
  return prefersReducedMotion() || arcAlreadyPlayed()
}

function playFixtureStream(emit: Emit, onRest: () => void, force: boolean): StreamHandle {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let index = 0

  markFixtureMode()
  sourceStore.setConnection('replay')

  if (shouldRenderInstantly(force)) {
    // The stillness beat is a performance device. With nothing being performed
    // it would render as a stray marker in the transcript, so it is not
    // inserted at all (§7.8.4).
    for (const scripted of streamScript) {
      if (scripted.event.type !== 'hesitation') emit(scripted.event)
    }
    markArcPlayed()
    onRest()
    return { stop() {} }
  }

  const step = () => {
    if (stopped) return

    // The arc plays through and then rests. It does not restart on its own —
    // a feed that loops back to the top mid-read is worse than one that ends.
    if (index >= streamScript.length) {
      markArcPlayed()
      onRest()
      return
    }

    const scripted = streamScript[index]!
    index += 1
    timer = setTimeout(() => {
      if (stopped) return
      emit(scripted.event)
      step()
    }, scripted.delay)
  }

  step()

  return {
    stop() {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}

/* ---------------------------------------------------------------------------
   Live SSE with backoff, falling back to the fixture player
   ------------------------------------------------------------------------ */

function parse(raw: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return parsed as StreamEvent
    }
    return null
  } catch {
    return null
  }
}

/**
 * @param force Replay was asked for explicitly, so perform the arc even if it
 *   already played this session. A judge pressing REPLAY wants the performance.
 */
export function connectStream(
  emit: Emit,
  onRest: () => void = () => {},
  force = false,
): StreamHandle {
  let stopped = false
  let source: EventSource | undefined
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  let everOpened = false
  let fallback: StreamHandle | undefined

  const cleanupSource = () => {
    if (openTimer !== undefined) clearTimeout(openTimer)
    openTimer = undefined
    source?.close()
    source = undefined
  }

  const goToFixtures = () => {
    if (stopped || fallback) return
    cleanupSource()
    fallback = playFixtureStream(emit, onRest, force)
  }

  const scheduleRetry = () => {
    if (stopped) return
    cleanupSource()

    // If we never reached `open`, there is no backend to wait for — start the
    // case file immediately rather than making a demo watch a backoff ladder.
    if (!everOpened) {
      goToFixtures()
      return
    }

    attempts += 1
    if (attempts > MAX_RECONNECTS) {
      goToFixtures()
      return
    }
    sourceStore.setConnection('reconnecting')
    const backoff = Math.min(BASE_BACKOFF * 2 ** (attempts - 1), MAX_BACKOFF)
    retryTimer = setTimeout(open, backoff)
  }

  function open() {
    if (stopped) return

    let es: EventSource
    try {
      es = new EventSource(`${API_BASE}/api/stream`)
    } catch {
      goToFixtures()
      return
    }
    source = es

    // Never let a hung connection hold the demo hostage.
    openTimer = setTimeout(() => {
      if (es.readyState !== EventSource.OPEN) scheduleRetry()
    }, OPEN_TIMEOUT)

    es.onopen = () => {
      if (openTimer !== undefined) clearTimeout(openTimer)
      everOpened = true
      attempts = 0
      sourceStore.setSource('live')
      sourceStore.setConnection('open')
    }

    es.onmessage = (ev: MessageEvent<string>) => {
      const parsed = parse(ev.data)
      if (parsed) emit(parsed)
    }

    es.onerror = () => {
      // EventSource retries internally; we drive our own backoff instead so we
      // can bail out to fixtures after a bounded number of failures.
      scheduleRetry()
    }
  }

  // No backend configured means no backend to reach for. Going straight to the
  // recorded arc keeps the console clean and skips a pointless 2.5s timeout
  // before the hero surface of the product does anything at all.
  if (!BACKEND_CONFIGURED) {
    goToFixtures()
    return {
      stop() {
        stopped = true
        fallback?.stop()
      },
    }
  }

  sourceStore.setConnection('connecting')
  open()

  return {
    stop() {
      stopped = true
      if (retryTimer !== undefined) clearTimeout(retryTimer)
      cleanupSource()
      fallback?.stop()
    },
  }
}

/**
 * The live agent stream.
 *
 * Tries a real SSE connection to `${API_BASE}/api/stream` and reconnects with
 * exponential backoff. If the backend never answers — the normal case during a
 * demo — it hands off to the fixture player, which replays the scripted Kevin
 * investigation on a loop at realistic pacing so `/` is never dead air.
 */

import { API_BASE } from './api'
import { SCRIPT_LOOP_PAUSE, streamScript } from '../fixtures/streamScript'
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
   Fixture player — the scripted investigation, on a loop
   ------------------------------------------------------------------------ */

function playFixtureStream(emit: Emit): StreamHandle {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let index = 0

  const step = () => {
    if (stopped) return

    if (index >= streamScript.length) {
      index = 0
      timer = setTimeout(step, SCRIPT_LOOP_PAUSE)
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

  markFixtureMode()
  sourceStore.setConnection('fixture')
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

export function connectStream(emit: Emit): StreamHandle {
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
    fallback = playFixtureStream(emit)
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

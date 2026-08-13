/**
 * A tiny observable for "is this real data or the bundled case file?".
 *
 * The app is designed to be demoed with the backend switched off, so fixture
 * mode is a first-class state, not an error — but it is always disclosed.
 */

import type { ConnectionState, DataSource } from './types'

type Listener = () => void

interface SourceState {
  source: DataSource
  connection: ConnectionState
}

let state: SourceState = { source: 'live', connection: 'connecting' }
const listeners = new Set<Listener>()

function emit() {
  // Snapshot identity must change for useSyncExternalStore to re-render.
  listeners.forEach((l) => l())
}

export const sourceStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): SourceState {
    return state
  },
  setSource(source: DataSource) {
    if (state.source === source) return
    state = { ...state, source }
    emit()
  },
  setConnection(connection: ConnectionState) {
    if (state.connection === connection) return
    state = { ...state, connection }
    emit()
  },
}

/** Called by the API layer the moment any request falls back to fixtures. */
export function markFixtureMode() {
  sourceStore.setSource('fixture')
}

export function markLiveMode() {
  sourceStore.setSource('live')
}

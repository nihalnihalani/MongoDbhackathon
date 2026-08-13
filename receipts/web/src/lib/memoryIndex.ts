import { createContext } from 'react'

/**
 * Short quotes for memories the stream has already shown, keyed by memory id.
 *
 * This exists so a causal link can say *what* it points at — `⤷ because of
 * "INC-2291: expired sessions stayed accessible…"` — instead of printing an
 * opaque `mem-k-03`. An id names a row in a database; a quote names a reason,
 * and the difference is what makes the chain readable as reasoning.
 *
 * The log builds it from the retrieval events themselves rather than from
 * fixtures, so it works unchanged against a live backend.
 */
export const MemoryIndex = createContext<Record<string, string>>({})

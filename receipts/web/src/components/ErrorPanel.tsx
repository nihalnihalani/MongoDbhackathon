import { Link } from 'react-router-dom'
import { EmptyState } from './EmptyState'

interface ErrorPanelProps {
  error: Error
  onRetry?: () => void
  what?: string
}

/**
 * Data-load failure inside an otherwise healthy route.
 *
 * The two cases need different exits, and conflating them strands the reader.
 * A transport failure is worth retrying. A record that does not exist is not —
 * retrying a bad id fails identically forever — so a missing record offers the
 * way back to the Courtroom instead. A judge who mistypes a URL should land
 * somewhere with a door in it.
 */
export function ErrorPanel({ error, onRetry, what = 'record' }: ErrorPanelProps) {
  const notFound = error.name === 'NotFoundError'

  return (
    <EmptyState
      kicker={notFound ? 'Not on file' : 'Retrieval failed'}
      title={notFound ? `No ${what} under that identifier.` : `Could not retrieve the ${what}.`}
      body={error.message}
      action={
        notFound ? (
          <Link to="/" className="btn btn-primary">
            Return to the courtroom
          </Link>
        ) : (
          onRetry && (
            <button type="button" className="btn" onClick={onRetry}>
              Retry retrieval
            </button>
          )
        )
      }
    />
  )
}

import { EmptyState } from './EmptyState'

interface ErrorPanelProps {
  error: Error
  onRetry?: () => void
  what?: string
}

/** Data-load failure inside an otherwise healthy route. */
export function ErrorPanel({ error, onRetry, what = 'record' }: ErrorPanelProps) {
  const notFound = error.name === 'NotFoundError'

  return (
    <EmptyState
      kicker={notFound ? 'Not on file' : 'Retrieval failed'}
      title={notFound ? `No ${what} under that identifier.` : `Could not retrieve the ${what}.`}
      body={error.message}
      action={
        onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Retry retrieval
          </button>
        )
      }
    />
  )
}

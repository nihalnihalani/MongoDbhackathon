import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'

export function NotFound() {
  return (
    <div className="route-enter mx-auto w-full max-w-2xl px-4 py-20">
      <EmptyState
        kicker="404 · Not in the archive"
        title="No such record."
        body="Nothing is filed under that path. The agent only keeps what it has actually seen."
        action={
          <Link to="/" className="btn btn-primary">
            Return to the courtroom
          </Link>
        }
      />
    </div>
  )
}

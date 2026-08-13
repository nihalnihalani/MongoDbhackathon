import { Link, Outlet, useLocation } from 'react-router-dom'
import { SourceBadge } from './SourceBadge'
import { ThemeToggle } from './ThemeToggle'

function Wordmark() {
  return (
    <Link
      to="/"
      className="flex items-baseline gap-2.5"
      aria-label="RECEIPTS — go to the courtroom"
    >
      <span
        className="display"
        style={{
          fontSize: 'var(--fs-title)',
          letterSpacing: '0.02em',
          color: 'var(--ink)',
        }}
      >
        RECEIPTS
      </span>
      <span
        className="label hidden md:inline"
        style={{ color: 'var(--ink-3)' }}
      >
        the agent keeps receipts
      </span>
    </Link>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const isRoot = pathname === '/'

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{
          borderColor: 'var(--line)',
          background: 'var(--bg-overlay)',
          minHeight: 'var(--header-height)',
        }}
      >
        <div
          className="mx-auto flex w-full items-center gap-3 px-4 py-2.5 sm:px-6"
          style={{ maxWidth: 'var(--content-max)' }}
        >
          {!isRoot && (
            <Link
              to="/"
              className="btn shrink-0"
              aria-label="Back to the courtroom"
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Courtroom</span>
            </Link>
          )}

          <Wordmark />

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SourceBadge />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer
        className="border-t px-4 py-4 sm:px-6"
        style={{ borderColor: 'var(--line)' }}
      >
        <div
          className="mx-auto flex w-full flex-wrap items-center gap-x-4 gap-y-1"
          style={{ maxWidth: 'var(--content-max)' }}
        >
          <span className="label">Receipts · autonomous review agent</span>
          <span className="label" style={{ color: 'var(--ink-3)' }}>
            Memory: MongoDB Atlas Vector Search
          </span>
          <span className="label ml-auto" style={{ color: 'var(--ink-3)' }}>
            Fireworks → OpenRouter critic on escalation
          </span>
        </div>
      </footer>
    </div>
  )
}

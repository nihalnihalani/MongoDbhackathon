import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Named in the fallback so it is obvious which surface failed. */
  surface: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * One boundary per route (DESIGN.md §8.8). A crash in the Dossier must not take
 * down the live stream on the Courtroom, and vice versa.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // A warning, not an error: the fault is handled and the console stays clean
    // of uncaught-error noise during a demo.
    console.warn(`[receipts] ${this.props.surface} failed to render`, error, info.componentStack)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <div
          className="memo flex flex-col items-start gap-4"
          style={{ borderLeftColor: 'var(--ink-red)' }}
          role="alert"
        >
          <span className="label" style={{ color: 'var(--ink-red)' }}>
            Case file corrupted · {this.props.surface}
          </span>
          <p
            className="display"
            style={{ fontSize: 'var(--fs-display-m)', color: 'var(--ink)', lineHeight: 1.15 }}
          >
            This part of the file is unreadable.
          </p>
          <p
            className="mono"
            style={{
              fontSize: 'var(--fs-mono-sm)',
              color: 'var(--ink-2)',
              lineHeight: 1.5,
              maxWidth: '62ch',
            }}
          >
            {error.message || 'The component threw while rendering.'}
          </p>
          <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
            Retry
          </button>
        </div>
      </div>
    )
  }
}

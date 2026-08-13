import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Stamped file-tab label, e.g. "No record". */
  kicker: string
  title: string
  body?: string
  action?: ReactNode
  className?: string
}

/**
 * Empty states in a case-file product are themselves a finding: the absence of a
 * record is information. They are typeset like a stamped notice, not an
 * apology.
 */
export function EmptyState({ kicker, title, body, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-start gap-3 border border-dashed px-5 py-8 ${className}`}
      style={{ borderColor: 'var(--line-strong)', borderRadius: 'var(--r-3)' }}
    >
      <span className="label">{kicker}</span>
      <p
        className="display"
        style={{ fontSize: 'var(--fs-title)', color: 'var(--ink)' }}
      >
        {title}
      </p>
      {body && (
        <p
          className="max-w-prose"
          style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)' }}
        >
          {body}
        </p>
      )}
      {action}
    </div>
  )
}

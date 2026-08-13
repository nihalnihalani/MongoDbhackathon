import type { PostedReview as PostedReviewData } from '../lib/types'

/**
 * DESIGN.md §8.6 — the agent must visibly act outside our own app, so the Case
 * File quotes the comment body it actually posted.
 *
 * This is the one place the design deliberately breaks its own document
 * language and leans toward GitHub's comment box, so it reads as a thing that
 * exists elsewhere rather than another panel of ours.
 */
export function PostedReview({ review }: { review: PostedReviewData }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="label" style={{ color: 'var(--ink-mimeo)' }}>
          <span aria-hidden="true">◈ </span>Posted to GitHub
        </span>
        <a
          href={review.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mono underline decoration-dotted underline-offset-4"
          style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-steel)' }}
        >
          {review.url.replace(/^https:\/\//, '').split('#')[0]}{' '}
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line-control)',
          borderRadius: 'var(--r-3)',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: 'var(--line)', background: 'var(--surface-sunk)' }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              background: 'var(--ink-green)',
              borderRadius: '50%',
            }}
          />
          <span className="mono" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-2)' }}>
            receipts-agent
          </span>
          <span className="label">commented</span>
        </div>
        <p
          className="px-3 py-3"
          style={{
            fontSize: 'var(--fs-body-sm)',
            lineHeight: 'var(--lh-prose)',
            color: 'var(--ink)',
            maxWidth: '72ch',
          }}
        >
          {review.body}
        </p>
      </div>
    </div>
  )
}

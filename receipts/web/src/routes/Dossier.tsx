import { Link, useParams } from 'react-router-dom'
import { getContributor } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { absoluteDate, bandClass, bandLabel, prNumber, signed } from '../lib/format'
import type { ContributorDetail, HistoryEntry } from '../lib/types'
import { EmptyState } from '../components/EmptyState'
import { ErrorPanel } from '../components/ErrorPanel'
import { MemoryCard, reviewIdForSource } from '../components/MemoryCard'
import { Prose } from '../components/Prose'
import { Placeholder, PlaceholderList } from '../components/Placeholder'
import { Sparkline } from '../components/Sparkline'

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const reviewId = reviewIdForSource(entry.prId)
  const tone =
    entry.delta > 0 ? 'var(--ink-green)' : entry.delta < 0 ? 'var(--ink-red)' : 'var(--ink-3)'

  const inner = (
    <>
      <div className="flex items-start gap-3">
        <span className="num shrink-0 pt-0.5" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-amber)' }}>
          {prNumber(entry.prId)}
        </span>
        <span
          className="min-w-0 flex-1"
          style={{
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--ink)',
            lineHeight: 'var(1.25)',
          }}
        >
          {entry.title}
        </span>
        <span
          className="num shrink-0 px-1.5 py-0.5"
          style={{
            fontSize: 'var(--fs-mono-sm)',
            fontWeight: 600,
            color: tone,
            border: `1px solid ${tone}`,
            borderRadius: 'var(--r-2)',
          }}
        >
          {signed(entry.delta)}
        </span>
      </div>
      <p
        className="mt-2 pl-[3.6rem]"
        style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}
      >
        {entry.reason}
      </p>
      <p className="label mt-1.5 pl-[3.6rem]">{absoluteDate(entry.at)}</p>
    </>
  )

  return (
    <li>
      {reviewId ? (
        <Link
          to={`/review/${reviewId}`}
          className="row-link border-b px-4 py-3.5"
          style={{ borderColor: 'var(--line)' }}
        >
          {inner}
        </Link>
      ) : (
        <div className="border-b px-4 py-3.5" style={{ borderColor: 'var(--line)' }}>
          {inner}
        </div>
      )}
    </li>
  )
}

function DossierHeader({ c }: { c: ContributorDetail }) {
  const net = c.history.reduce((sum, h) => sum + h.delta, 0)

  return (
    <header
      className={`rise flex flex-col gap-6 border-b px-4 pt-8 pb-7 sm:px-6 lg:flex-row lg:items-end lg:justify-between ${bandClass[c.band]}`}
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="min-w-0">
        <span className="label">Dossier</span>
        <h1
          className="display mt-2"
          style={{
            fontSize: 'clamp(2.25rem, 7vw, var(--fs-display-xl))',
            color: 'var(--ink)',
          }}
        >
          {c.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className="label px-2 py-1"
            style={{
              color: 'var(--band)',
              border: '1px solid var(--band)',
              background: 'var(--band-tint)',
              borderRadius: 'var(--r-2)',
            }}
          >
            {bandLabel[c.band]} band
          </span>
          <span className="label">{c.history.length} scored reviews</span>
          <span className="label">
            Net {signed(net)} lifetime
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-end gap-6">
        <div className="flex flex-col">
          <span className="label">Credibility</span>
          <span
            className="num"
            style={{
              fontSize: 'clamp(3rem, 12vw, var(--fs-numeral-xl))',
              fontWeight: 600,
              lineHeight: 0.9,
              color: 'var(--band)',
            }}
          >
            {c.credibility}
          </span>
        </div>
        <Sparkline
          values={c.trend}
          width={220}
          height={84}
          thresholds
          className="hidden max-w-full sm:block"
          ariaLabel={`Credibility history for ${c.name}: ${c.trend.join(', ')}.`}
        />
      </div>
    </header>
  )
}

function DossierPlaceholder() {
  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6" style={{ maxWidth: 'var(--content-max)' }}>
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-5 border-b px-6 pt-8 pb-7" style={{ borderColor: 'var(--line)' }}>
          <Placeholder width={60} height={10} />
          <Placeholder width="42%" height={44} />
          <Placeholder width="28%" height={12} />
        </div>
        <div className="px-6 py-8">
          <PlaceholderList count={6} />
        </div>
      </div>
    </div>
  )
}

export function Dossier() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(
    (signal) => getContributor(id, signal),
    [id],
  )

  if (loading) return <DossierPlaceholder />

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <ErrorPanel error={error} onRetry={reload} what="dossier" />
      </div>
    )
  }

  if (!data) return null

  const selfMemories = data.memories.filter((m) => m.kind === 'self')
  const otherMemories = data.memories.filter((m) => m.kind !== 'self')

  return (
    <div className="mx-auto w-full px-4 py-5 sm:px-6" style={{ maxWidth: 'var(--content-max)' }}>
      <article className="panel overflow-hidden">
        <DossierHeader c={data} />

        <section className="px-4 py-7 sm:px-6" aria-labelledby="assessment">
          <h2 id="assessment" className="label label-accent">
            Standing assessment — the agent's own words
          </h2>
          <Prose text={data.assessment} className="mt-4" lead />
        </section>

        <div
          className="dossier-grid border-t px-4 py-6 sm:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <section aria-labelledby="history">
            <h2 id="history" className="label" style={{ color: 'var(--ink-2)' }}>
              Scored history
            </h2>
            {data.history.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  kicker="No entries"
                  title="Nothing scored yet."
                  body="The agent has not adjudicated a pull request from this contributor."
                />
              </div>
            ) : (
              <ul
                className="mt-3 border-t"
                style={{ borderColor: 'var(--line)' }}
              >
                {data.history.map((h) => (
                  <HistoryRow key={h.prId} entry={h} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="memories">
            <h2 id="memories" className="label" style={{ color: 'var(--ink-2)' }}>
              Retrievable memories
            </h2>

            {data.memories.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  kicker="Empty"
                  title="No memories written."
                  body="Nothing about this contributor has been worth remembering yet."
                />
              </div>
            ) : (
              <>
                {selfMemories.length > 0 && (
                  <>
                    <p
                      className="mt-3"
                      style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}
                    >
                      What the agent remembers about its own conduct on this file.
                    </p>
                    <ul className="mt-2 flex flex-col gap-2.5">
                      {selfMemories.map((m) => (
                        <MemoryCard key={m.id} memory={m} />
                      ))}
                    </ul>
                  </>
                )}

                {otherMemories.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {otherMemories.map((m) => (
                      <MemoryCard key={m.id} memory={m} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </article>
    </div>
  )
}

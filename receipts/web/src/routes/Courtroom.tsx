import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAgentStream, type LiveCase } from '../hooks/useAgentStream'
import { ContributorStrip } from '../components/ContributorStrip'
import { DocketRail } from '../components/DocketRail'
import { InvestigationLog } from '../components/InvestigationLog'
import { ScrutinyMeter } from '../components/ScrutinyMeter'
import { Stamp } from '../components/Stamp'
import { prNumber } from '../lib/format'

/** Seconds since the case opened, ticking. */
function useElapsed(since: number | undefined): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (since === undefined) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [since])

  if (since === undefined) return '--:--'
  const total = Math.max(0, Math.floor((now - since) / 1000))
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function CaseHeader({ current, events }: { current: LiveCase | null; events: number }) {
  const elapsed = useElapsed(current?.startedAt)

  return (
    <header
      className="rise border-b px-4 pt-6 pb-5 sm:px-6"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label label-accent">
          {current ? 'Now under investigation' : 'Court in session'}
        </span>
        <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}>
          T+{elapsed}
        </span>
        <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}>
          {String(events).padStart(3, '0')} events logged
        </span>
      </div>

      {current ? (
        <>
          <h1
            className="display mt-3 flex flex-wrap items-baseline gap-x-3"
            style={{ fontSize: 'clamp(1.75rem, 4.2vw, var(--fs-display-l))' }}
          >
            <span className="num" style={{ color: 'var(--ink-amber)', fontSize: '0.72em' }}>
              {prNumber(current.prId)}
            </span>
            <span style={{ color: 'var(--ink)' }}>{current.title}</span>
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)' }}>
              opened by{' '}
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                {current.author}
              </span>
            </span>
            <ScrutinyMeter level={current.scrutiny} />
            <Stamp status={current.status} />
            <Link
              to={`/review/${current.reviewId}`}
              className="btn ml-auto"
            >
              Open case file <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      ) : (
        <h1
          className="display mt-3 max-w-3xl"
          style={{
            fontSize: 'clamp(1.75rem, 4.2vw, var(--fs-display-l))',
            color: 'var(--ink)',
          }}
        >
          The agent is between cases.
        </h1>
      )}
    </header>
  )
}

const RAIL_KEY = 'receipts.rail'

/**
 * The rail starts closed (DESIGN.md §9.1): at rest the page shows the agent and
 * nothing else, because a persistent panel of scores is exactly the dashboard
 * the rubric bans. The reader's choice is remembered.
 */
function useRailState(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === 'open'
    } catch {
      return false
    }
  })

  const toggle = () => {
    setOpen((v) => {
      const next = !v
      try {
        localStorage.setItem(RAIL_KEY, next ? 'open' : 'closed')
      } catch {
        // Private browsing; the in-memory state still applies.
      }
      return next
    })
  }

  return [open, toggle]
}

export function Courtroom() {
  const { entries, current, moves, count } = useAgentStream()
  const [railOpen, toggleRail] = useRailState()

  return (
    <>
      <ContributorStrip moves={moves} />

      <div className="mx-auto w-full px-4 py-5 sm:px-6" style={{ maxWidth: 'var(--content-max)' }}>
        <div className="courtroom-grid" data-rail={railOpen ? 'open' : 'closed'}>
          <section className="panel min-w-0 overflow-hidden">
            <CaseHeader current={current} events={count} />

            <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
              <h2 className="label" style={{ color: 'var(--ink-2)' }}>
                Investigation log
              </h2>
              {railOpen && (
                <button
                  type="button"
                  className="btn ml-auto"
                  onClick={toggleRail}
                  aria-expanded
                  aria-controls="docket-rail"
                >
                  Hide docket
                </button>
              )}
            </div>

            <InvestigationLog entries={entries} />
          </section>

          {railOpen ? (
            <aside id="docket-rail" aria-label="Docket and incidents" className="min-w-0">
              <DocketRail />
            </aside>
          ) : (
            <button
              type="button"
              onClick={toggleRail}
              aria-expanded={false}
              aria-controls="docket-rail"
              className="rail-tab"
            >
              <span className="label" style={{ color: 'var(--ink-2)' }}>
                Docket
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

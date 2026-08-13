import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Ledger as LedgerData } from '../lib/types'
import { prNumber, signed } from '../lib/format'
import { caseFileFor } from '../fixtures/data'
import { useCountUp } from '../hooks/useCountUp'
import { useReducedMotion } from '../hooks/useReducedMotion'

/** Matches the 90ms row stagger in global.css. */
const ROW_STAGGER = 90

/**
 * The credibility ledger (DESIGN.md §9.2). A judge will add this column up, and
 * the entire premise of the product rests on it checking out — so the component
 * does the arithmetic itself and says so loudly if the data does not balance.
 *
 * The rows arrive in sequence and the balance only starts counting once they
 * have all landed. That ordering is the entire point: the reader watches the
 * sum COMPOSE from its parts rather than being handed a total. A number that is
 * simply present has to be taken on faith; a number you saw assembled from four
 * labelled deltas is one you have effectively already checked.
 */
export function Ledger({ ledger }: { ledger: LedgerData }) {
  const summed =
    ledger.openingBalance + ledger.entries.reduce((total, entry) => total + entry.delta, 0)
  const balances = summed === ledger.balance

  const reduced = useReducedMotion()
  const [settled, setSettled] = useState(reduced)

  useEffect(() => {
    if (reduced) {
      setSettled(true)
      return
    }
    // Wait for the last row to arrive before the total resolves.
    const wait = (ledger.entries.length + 1) * ROW_STAGGER + 160
    const id = window.setTimeout(() => setSettled(true), wait)
    return () => window.clearTimeout(id)
  }, [reduced, ledger.entries.length])

  const shownBalance = useCountUp(ledger.openingBalance, ledger.balance, settled && !reduced)

  return (
    <section aria-labelledby="ledger">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id="ledger" className="label" style={{ color: 'var(--ink-2)' }}>
          Credibility ledger
        </h2>
        <span className="label" style={{ color: 'var(--ink-amber)' }}>
          · {ledger.subsystem}
        </span>
      </div>

      <table className="mt-3 w-full border-collapse">
        <caption className="sr-only">
          Credibility ledger for the {ledger.subsystem} subsystem, opening balance{' '}
          {ledger.openingBalance}, closing balance {ledger.balance}.
        </caption>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--line)' }}>
            <td className="label py-2.5" colSpan={2}>
              Opening balance
            </td>
            <td
              className="num py-2.5 text-right"
              style={{ fontSize: 'var(--fs-mono)', color: 'var(--ink-3)' }}
            >
              {ledger.openingBalance}
            </td>
          </tr>

          {ledger.entries.map((entry, i) => (
            <tr
              key={entry.prId}
              className="ledger-row"
              style={{
                ['--row-i' as string]: i + 1,
                borderBottom: '1px solid var(--line)',
                background: entry.recovery ? 'var(--tint-green)' : undefined,
              }}
            >
              <td className="py-2.5 pr-3 align-top" style={{ width: '1%' }}>
                {(() => {
                  const caseFile = caseFileFor(entry.prId)
                  // The recovery marker is a character, so it survives greyscale.
                  const label = `${entry.recovery ? '▲ ' : '  '}${prNumber(entry.prId)}`
                  return caseFile ? (
                    <Link
                      to={`/review/${caseFile}`}
                      className="num whitespace-nowrap underline decoration-dotted underline-offset-4"
                      style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-amber)' }}
                    >
                      {label}
                    </Link>
                  ) : (
                    <span
                      className="num whitespace-nowrap"
                      style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}
                    >
                      {label}
                    </span>
                  )
                })()}
              </td>
              <td
                className="py-2.5 pr-3 align-top"
                style={{
                  fontSize: 'var(--fs-body-sm)',
                  color: entry.recovery ? 'var(--ink)' : 'var(--ink-2)',
                  lineHeight: 1.35,
                }}
              >
                {entry.reason}
              </td>
              {/* The delta flashes its band colour once as its row lands, then
                  rests. It is the number that did the work, so it gets the beat. */}
              <td className="py-2.5 text-right align-top">
                <span
                  className="num delta-flash inline-block"
                  style={{
                    ['--row-i' as string]: i + 1,
                    fontSize: 'var(--fs-numeral-sm)',
                    color: entry.delta > 0 ? 'var(--ink-green)' : 'var(--ink-red)',
                  }}
                >
                  {signed(entry.delta)}
                </span>
              </td>
            </tr>
          ))}

          <tr style={{ borderTop: '3px double var(--line-strong)' }}>
            <td className="label pt-3" colSpan={2} style={{ color: 'var(--ink)' }}>
              Balance
            </td>
            <td className="pt-3 text-right">
              {/* Never a bare figure — the subsystem is part of the number. */}
              <span className="num" style={{ fontSize: 'var(--fs-numeral)', color: 'var(--ink)' }}>
                {shownBalance}
              </span>
              <span className="label" style={{ color: 'var(--ink-amber)' }}>
                {' '}
                · {ledger.subsystem}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {!balances && (
        <p
          className="mono mt-3 px-3 py-2"
          style={{
            fontSize: 'var(--fs-mono-sm)',
            color: 'var(--ink-red)',
            border: '1px solid var(--ink-red)',
            background: 'var(--tint-red)',
            borderRadius: 'var(--r-1)',
          }}
          role="alert"
        >
          Ledger does not balance: entries sum to {summed}, recorded balance is {ledger.balance}.
        </p>
      )}
    </section>
  )
}

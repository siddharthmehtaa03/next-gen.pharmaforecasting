import { ACT, OUTPUTS, UNBIASED, fmtRev, idxOf, mLong, yearOf } from './engine'
import type { OutputId } from './engine'
import { Card, Stat, cx } from './ui'

// Actuals are the reference series before ACT; the last actual month is ACT - 1.
const ACTS = Object.fromEntries((['rev', 'trx', 'pts'] as const).map(o => [o, OUTPUTS[o].fn(UNBIASED).slice(0, ACT)])) as Record<OutputId, number[]>
const LAST = ACT - 1, Y0 = idxOf(yearOf(LAST), 0)
const sum = (o: OutputId, a: number, b: number) => ACTS[o].slice(a, b + 1).reduce((x, y) => x + y, 0)
const pct = (now: number, prev: number) => (prev ? (now / prev - 1) * 100 : 0)
const pctTxt = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`
const ytd = `${mLong(Y0).slice(0, 3)}–${mLong(LAST)}`

/** Actual-to-date KPIs for the baseline dashboard: year to date against the same months last year. */
export function ActualKpis() {
  const kpi = (o: OutputId) => { const now = sum(o, Y0, LAST), d = pct(now, sum(o, Y0 - 12, LAST - 12)); return { now, d } }
  const rev = kpi('rev'), trx = kpi('trx')
  const pNow = ACTS.pts[LAST]!, pD = pct(pNow, ACTS.pts[LAST - 12]!)
  const run = sum('rev', LAST - 2, LAST) * 4
  return (
    <section data-tour="kpis" aria-label="Actuals to date" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat k={`Net revenue · YTD ${ytd}`} v={fmtRev(rev.now, 1)} sub={<><b className={rev.d >= 0 ? 'text-ok' : 'text-err'}>{pctTxt(rev.d)}</b> vs same months last year</>} />
      <Stat k={`TRx · YTD ${ytd}`} v={OUTPUTS.trx.fmt(trx.now)} sub={<><b className={trx.d >= 0 ? 'text-ok' : 'text-err'}>{pctTxt(trx.d)}</b> vs same months last year</>} />
      <Stat k={`Treated patients · ${mLong(LAST)}`} v={OUTPUTS.pts.fmt(pNow)} sub={<><b className={pD >= 0 ? 'text-ok' : 'text-err'}>{pctTxt(pD)}</b> vs {mLong(LAST - 12)}</>} />
      <Stat k="Net revenue run rate" v={fmtRev(run, 0)} sub="Last 3 actual months, annualised" />
    </section>
  )
}

/** Monthly actuals, newest first, with the change against the same month last year. */
export function ActualsView() {
  const rows = Array.from({ length: ACT }, (_, k) => LAST - k)
  const cell = (o: OutputId, i: number) => {
    const v = ACTS[o][i]!, d = i >= 12 ? pct(v, ACTS[o][i - 12]!) : null
    return <><td className="px-3 py-2 text-right font-mono">{o === 'rev' ? fmtRev(v, 1) : OUTPUTS[o].fmt(v)}</td>
      <td className={cx('px-3 py-2 text-right font-mono text-[12px]', d === null ? 'text-text-3' : d >= 0 ? 'text-ok' : 'text-err')}>{d === null ? '—' : pctTxt(d)}</td></>
  }
  return (
    <div className="space-y-5">
      <div><h2 className="text-[22px] font-semibold tracking-tight">Actuals</h2>
        <p className="mt-0.5 text-sm text-text-2">Reported monthly actuals through {mLong(LAST)}. Locked: they anchor every forecast and cannot be edited.</p></div>
      <ActualKpis />
      <Card title="Monthly actuals" sub="Change is against the same month last year." pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-text-3">
              <th className="px-3 py-2.5 text-left font-semibold">Month</th>
              {(['Net revenue', 'TRx', 'Treated patients'] as const).map(h => <th key={h} colSpan={2} className="px-3 py-2.5 text-right font-semibold">{h}<span className="ml-1 font-normal normal-case">· vs LY</span></th>)}
            </tr></thead>
            <tbody>{rows.map(i => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{mLong(i)}</td>{cell('rev', i)}{cell('trx', i)}{cell('pts', i)}
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

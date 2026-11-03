import { useState } from 'react'
import { ACT, ACTUALS, DRV, fmtV, mLabel } from './engine'
import type { DriverId } from './engine'
import { cx } from './ui'

type Verdict = 'Reliable' | 'Watch' | 'Don’t rely on trend'
type Row = { i: number; actual: number; trend: number; naive: number }
export type TrendCheck = { verdict: Verdict; run: number; dir: 'under' | 'over'; avgMiss: number; mape: number; edge: boolean; rows: Row[] }

/** One-step-ahead backtest over the last `months` actuals: refit the 12-month linear trend each month and compare. */
export function trendCheck(s: number[], months = 6): TrendCheck {
  const rows: Row[] = []
  for (let i = s.length - months; i < s.length; i++) {
    const w = s.slice(i - 12, i), xm = 5.5, ym = w.reduce((a, b) => a + b, 0) / 12
    let num = 0, den = 0
    w.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2 })
    rows.push({ i, actual: s[i]!, trend: ym + (num / den) * (12 - xm), naive: s[i - 1]! })
  }
  // A miss only counts toward a run when it is material (over 0.2% of the actual).
  const miss = rows.map(r => (Math.abs(r.actual - r.trend) > Math.abs(r.actual) * 0.002 ? Math.sign(r.actual - r.trend) : 0))
  const dir = miss[miss.length - 1]! >= 0 ? 'under' : 'over'
  let run = 0
  for (let k = miss.length - 1; k >= 0 && miss[k] === (dir === 'under' ? 1 : -1); k--) run++
  const mae = (f: (r: Row) => number) => rows.reduce((a, r) => a + Math.abs(r.actual - f(r)), 0) / rows.length
  const avgMiss = mae(r => r.trend), mape = rows.reduce((a, r) => a + Math.abs(r.actual - r.trend) / Math.abs(r.actual), 0) / rows.length * 100
  const edge = avgMiss < mae(r => r.naive) * 0.9
  const verdict: Verdict = mape > 3 || run >= 5 ? 'Don’t rely on trend' : run >= 3 || !edge ? 'Watch' : 'Reliable'
  return { verdict, run, dir, avgMiss, mape, edge, rows }
}

// Self-check: a clean straight line is always Reliable; a series that breaks upward is flagged.
if (import.meta.env.DEV) {
  const line = Array.from({ length: 24 }, (_, i) => 100 + i)
  console.assert(trendCheck(line).verdict === 'Reliable', 'trendCheck: straight line')
  const kink = Array.from({ length: 24 }, (_, i) => (i < 18 ? 100 : 100 + (i - 17) * 8))
  console.assert(trendCheck(kink).verdict !== 'Reliable', 'trendCheck: break must not be Reliable')
}

const TONE: Record<Verdict, { box: string; dot: string; text: string; note: string }> = {
  Reliable: { box: 'bg-ok-soft', dot: 'bg-ok', text: 'text-ok', note: 'Trend has tracked actuals well. Safe to build on.' },
  Watch: { box: 'bg-warn-soft', dot: 'bg-warn', text: 'text-warn', note: 'Early drift. Sanity-check before you submit.' },
  'Don’t rely on trend': { box: 'bg-err-soft', dot: 'bg-err', text: 'text-err', note: 'Trend keeps missing. Set this assumption yourself.' },
}

/** CR-003: can you depend on the trend? One verdict per metric, evidence one click away. */
/** `id` checks a driver's actuals; pass `series`, `label` and `fmt` instead to check an output such as net revenue. */
export function TrendPanel({ id, series, label, fmt }: { id?: DriverId; series?: number[]; label?: string; fmt?: (v: number) => string }) {
  const [open, setOpen] = useState(false)
  const d = id ? DRV[id] : null
  const c = trendCheck(series ?? ACTUALS[id!]), t = TONE[c.verdict]
  const show = (v: number) => fmt ? fmt(v) : fmtV(id!, v)
  const miss = (v: number) => d?.pct ? `${v.toFixed(2)} pts` : show(v)
  return (
    <aside data-tour="trend" aria-label={`Trend reliability for ${label ?? d!.label}`} className="flex flex-col rounded-2xl border border-border bg-surface shadow-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Can you depend on the trend?</p>
      <div className={cx('mt-2 rounded-md px-3 py-2.5', t.box)}>
        <p className={cx('flex items-center gap-2 text-[15px] font-semibold', t.text)}><span className={cx('h-2.5 w-2.5 rounded-full', t.dot)} />{c.verdict}</p>
        <p className={cx('mt-0.5 text-[12.5px]', t.text)}>{t.note}</p>
      </div>
      {c.run >= 3 && <p className="mt-3 text-[13px]">Trend has {c.dir}-forecast {c.run} months running.</p>}
      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-[12.5px]">
        <div className="flex justify-between gap-2"><dt className="text-text-3">Direction</dt><dd className={c.run >= 3 ? t.text : ''}>{c.run}-mo {c.dir}-forecast</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-text-3">Avg miss</dt><dd className="font-mono">±{miss(c.avgMiss)} · {c.mape.toFixed(1)}%</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-text-3">Vs simple guess</dt><dd className={c.edge ? 'text-ok' : 'text-warn'}>{c.edge ? 'Beats it' : 'No edge'}</dd></div>
      </dl>
      <p className="mt-3 text-[11.5px] text-text-3">Backtest of the last {c.rows.length} months, refitting the trend each month. Sharpens as snapshots accrue.</p>
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="mt-2 self-start text-[12.5px] font-semibold text-brand hover:underline">{open ? 'Hide evidence' : 'Show evidence →'}</button>
      {open && (
        <table className="mt-2 w-full text-[11.5px]">
          <thead><tr className="text-text-3"><th className="py-1 text-left font-medium">Month</th><th className="py-1 text-right font-medium">Actual</th><th className="py-1 text-right font-medium">Trend</th><th className="py-1 text-right font-medium">Miss</th></tr></thead>
          <tbody>{c.rows.map(r => { const m = r.actual - r.trend; return (
            <tr key={r.i} className="border-t border-border"><td className="py-1">{mLabel(r.i)}</td><td className="py-1 text-right font-mono">{show(r.actual)}</td><td className="py-1 text-right font-mono">{show(r.trend)}</td><td className={cx('py-1 text-right font-mono', m >= 0 ? 'text-ok' : 'text-err')}>{m >= 0 ? '+' : '−'}{miss(Math.abs(m))}</td></tr>) })}</tbody>
        </table>
      )}
      {ACT < 18 && <p className="mt-2 text-[11px] text-text-3">Fewer than 18 months of actuals: verdict is indicative.</p>}
    </aside>
  )
}

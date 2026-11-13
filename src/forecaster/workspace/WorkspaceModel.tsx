import { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { ACT, ACTUALS, DRV, GTN, MONTHS, N, OUTPUTS, POP, YEARS, idxOf, mLong, revenue, yearOf } from './engine'
import type { DriverId, Layer, Scenario } from './engine'
import { Btn, COLOR, cx } from './ui'
import { GridCell, Period } from './Drivers'
import type { CellState } from './Drivers'
import { stdSeries, WOH_DEFAULT } from './Modules'

/** Colour of a scenario in every multi-scenario view (matches the Scenario summary). */
export const scColor = (s: Scenario, k: number) => s.color ?? COLOR.alt[k % COLOR.alt.length]!

/* ───────── Scenario chips: show or hide each scenario's line, with its FY value ───────── */
export type Chip = { id: string; name: string; color: string; value: string; focus: boolean; shown: boolean }
/** One chip per line in the chart. The scenario being worked on is drawn thick, the others thin and dotted; click a chip to show or hide a line. */
export function ScenarioChips({ chips, onToggle, year }: { chips: Chip[]; onToggle: (id: string) => void; year: number }) {
  return (
    <div data-tour="scenario-chips" className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Scenarios in the chart">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">In chart · FY{year}</span>
      {chips.map(c => (
        <button key={c.id} type="button" aria-pressed={c.shown} onClick={() => onToggle(c.id)} title={c.shown ? 'In the chart · click to hide' : 'Hidden · click to show'}
          className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors', c.shown ? 'border-border-strong bg-surface text-text' : 'border-border bg-surface-2 text-text-3', c.focus && c.shown && 'border-text font-semibold')}>
          <svg width="18" height="8" aria-hidden><line x1="0" x2="18" y1="4" y2="4" stroke={c.shown ? c.color : '#b9bdc7'} strokeWidth={c.focus ? 3.5 : 1.6} strokeDasharray={c.focus ? undefined : '2 3'} /></svg>
          {c.name}<b className="font-mono font-semibold">{c.value}</b>
        </button>))}
    </div>
  )
}

/* ───────── Start / end month and the growth inside it ───────── */
/** Pick a start and an end month: the chart zooms to it and the growth over it is read out (month on month, quarter on quarter, annualised). Growth can be carried forward into the forecast. */
export function PeriodGrowth({ series, id, range, setRange, fmt, onCarry, carryNote }: {
  series: number[]; id: DriverId | null; range: [number, number]; setRange: (r: [number, number]) => void; fmt: (v: number) => string
  onCarry?: (annualPct: number) => void; carryNote?: string
}) {
  const [a, b] = range, months = b - a, s0 = series[a], s1 = series[b]
  const ok = months >= 1 && s0 !== undefined && s1 !== undefined && s0 > 0 && s1 > 0
  const g = (k: number) => (ok ? ((s1! / s0!) ** (k / months) - 1) * 100 : NaN)
  const total = ok ? (s1! / s0! - 1) * 100 : NaN, mom = g(1), qoq = g(3), ann = g(12)
  const sgn = (v: number, dp = 1) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)}%` : '—')
  const stat = (k: string, v: string, tone?: number) => (
    <div className="min-w-[88px]"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-3">{k}</p>
      <p className={cx('font-mono text-[14px] font-semibold', tone !== undefined && Number.isFinite(tone) && (tone >= 0 ? 'text-ok' : 'text-err'))}>{v}</p></div>
  )
  const pts = id && DRV[id].pct && ok ? s1! - s0! : null
  return (
    <div data-tour="period" className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-md border border-border bg-surface-2/50 px-3.5 py-3">
      <div className="w-[170px]"><Period label="Start month" value={a} min={0} max={N - 1} onChange={v => setRange([v, Math.max(v, b)])} /></div>
      <div className="w-[170px]"><Period label="End month" value={b} min={0} max={N - 1} onChange={v => setRange([Math.min(a, v), v])} /></div>
      {stat(`${mLong(a).slice(0, 3)} ${yearOf(a)}`, ok ? fmt(s0!) : '—')}
      {stat(`${mLong(b).slice(0, 3)} ${yearOf(b)}`, ok ? fmt(s1!) : '—')}
      {stat('Change', ok ? `${sgn(total)}${pts !== null ? ` · ${pts >= 0 ? '+' : '−'}${Math.abs(pts).toFixed(1)} pts` : ''}` : '—', total)}
      {stat('Avg month on month', sgn(mom, 2), mom)}
      {stat('Avg quarter on quarter', sgn(qoq, 2), qoq)}
      {stat('Annualised', sgn(ann), ann)}
      <div className="ml-auto flex flex-col items-end gap-1">
        <Btn size="sm" variant="secondary" disabled={!onCarry || !Number.isFinite(ann)} icon={<TrendingUp size={13} />} onClick={() => onCarry?.(+ann.toFixed(2))}
          title="Use the growth seen in this period as the annual growth rate from the first forecast month">Use this growth going forward</Btn>
        {carryNote && <span className="max-w-[240px] text-right text-[11px] text-text-3">{carryNote}</span>}
      </div>
    </div>
  )
}

/* ───────── Full model grid: every metric of the funnel by month or year ───────── */
const TH = 'sticky top-0 z-[4] h-[29px] whitespace-nowrap border-b border-r border-border bg-surface-2 px-2 py-[5px] text-right text-[10.5px] font-bold text-text-3'
const TD = 'whitespace-nowrap border-b border-r border-border px-2 py-[5px] text-right font-mono text-[11.5px] tabular-nums'
const ROWH = 'sticky left-0 z-[5] w-[300px] min-w-[300px] max-w-[300px] whitespace-nowrap border-r border-border bg-background text-left'
const PINNED_HEADER_STYLE = { backgroundColor: 'var(--color-background)' }
const FYH = 'sticky right-0 z-[4] border-b border-l border-border bg-background font-mono text-[11.5px] font-bold'

type Row = { key: string; label: string; stage: string; series: number[]; fmt: (v: number) => string; sum: boolean; kind: 'input' | 'calc' | 'out'; id?: DriverId; dp: number; go?: string }
const stages: { id: string; name: string; what: string }[] = [
  { id: 'pool', name: 'Patient pool', what: 'how many people could be treated' },
  { id: 'new', name: 'New to brand', what: 'who starts on the brand' },
  { id: 'vol', name: 'Volume', what: 'prescriptions' },
  { id: 'sales', name: 'Sales', what: 'gross price, net price and revenue' },
  { id: 'bridge', name: 'Revenue bridge', what: 'default modules · required in every model' },
]

export function FullModelGrid({ layer, reference, year, title, editable, locked, ue, woh = WOH_DEFAULT, selected, onRow, onCell, hidden = false }: {
  layer: Layer; reference: Layer; year: number; title: string; editable: DriverId[]; locked?: boolean; ue: number[]; woh?: number
  selected: string | null; onRow: (go: string) => void; onCell: (id: DriverId, i: number, v: number) => string | null
  hidden?: boolean
}) {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')
  const lastActYear = yearOf(ACT - 1)
  const [folded, setFolded] = useState<Set<number>>(() => new Set(YEARS.filter(y => idxOf(y, 11) < ACT)))
  const fold = (y: number) => setFolded(f => { const n = new Set(f); if (n.has(y)) n.delete(y); else n.add(y); return n })

  const rows = useMemo<Row[]>(() => {
    const std = stdSeries(layer, ue, woh), pts = OUTPUTS.pts.fn(layer), trx = OUTPUTS.trx.fn(layer)
    const rate = (id: DriverId, label: string, stage: string, go: string): Row => ({ key: id, label, stage, series: layer[id], fmt: v => v.toFixed(1), sum: false, kind: 'input', id, dp: 1, go })
    const stock = (key: string, label: string, stage: string, f: (i: number) => number, dp = 2): Row => ({ key, label, stage, series: Array.from({ length: N }, (_, i) => f(i)), fmt: v => v.toFixed(dp), sum: false, kind: 'calc', dp })
    const dx = (i: number) => POP * layer.diag[i]! / 100, tx = (i: number) => dx(i) * layer.treat[i]! / 100, cx_ = (i: number) => tx(i) * layer.access[i]! / 100
    return [
      stock('prev', 'Prevalent patients · M', 'pool', () => POP / 1e6),
      rate('diag', 'Diagnosis rate · %', 'pool', 'diag'),
      stock('diagn', 'Diagnosed patients · M', 'pool', i => dx(i) / 1e6),
      rate('treat', 'Treatment rate · %', 'pool', 'treat'),
      stock('treatn', 'Treated patients · M', 'pool', i => tx(i) / 1e6),
      rate('access', 'Access · %', 'new', 'access'),
      stock('cov', 'Covered patients · M', 'new', i => cx_(i) / 1e6),
      rate('share', 'Brand share · %', 'new', 'share'),
      { key: 'onb', label: 'Patients on brand · K', stage: 'new', series: pts, fmt: v => v.toFixed(0), sum: false, kind: 'calc', dp: 0 },
      { key: 'rx', label: 'Prescriptions per patient · Rx', stage: 'vol', series: layer.rx, fmt: v => v.toFixed(2), sum: false, kind: 'input', id: 'rx', dp: 2, go: 'rx' },
      { key: 'trx', label: 'Total prescriptions · K Rx', stage: 'vol', series: trx, fmt: v => v.toLocaleString('en-US', { maximumFractionDigits: 0 }), sum: true, kind: 'calc', dp: 0, go: 'rx' },
      { key: 'price', label: 'Weighted gross price · $ / pack', stage: 'sales', series: layer.price, fmt: v => v.toFixed(2), sum: false, kind: 'input', id: 'price', dp: 2, go: 'price' },
      { key: 'netp', label: 'Net sales price · $ / pack', stage: 'sales', series: std.netPrice, fmt: v => v.toFixed(2), sum: false, kind: 'calc', dp: 2, go: 'netp' },
      { key: 'rev', label: 'Net revenue · $M', stage: 'sales', series: revenue(layer), fmt: v => v.toFixed(1), sum: true, kind: 'out', dp: 1, go: 'rev' },
      { key: 'gross', label: 'Gross sales · $M', stage: 'bridge', series: std.gross, fmt: v => v.toFixed(1), sum: true, kind: 'calc', dp: 1 },
      { key: 'tud', label: 'Total underlying demand · $M', stage: 'bridge', series: std.tud, fmt: v => v.toFixed(1), sum: true, kind: 'calc', dp: 1, go: 'tud' },
      { key: 'inv', label: 'Δ Inventory · $M', stage: 'bridge', series: std.inv, fmt: v => v.toFixed(2), sum: true, kind: 'calc', dp: 2, go: 'inv' },
      { key: 'uep', label: 'Unexplained difference · % of gross', stage: 'bridge', series: std.uePct, fmt: v => v.toFixed(1), sum: false, kind: 'calc', dp: 1, go: 'ue' },
      { key: 'fx', label: 'Exchange rate · USD', stage: 'bridge', series: std.fx, fmt: v => v.toFixed(2), sum: false, kind: 'calc', dp: 2, go: 'fx' },
    ]
  }, [layer, ue, woh])

  const yAgg = (r: Row, y: number) => { const v = r.series.slice(idxOf(y, 0), idxOf(y, 0) + 12); const t = v.reduce((a, b) => a + b, 0); return r.sum ? t : t / 12 }
  type Col = { y: number; i: number | null; folded?: boolean }
  const cols: Col[] = period === 'annual' ? YEARS.map(y => ({ y, i: null })) : YEARS.flatMap<Col>(y => folded.has(y) ? [{ y, i: null, folded: true }] : MONTHS.map((_, k) => ({ y, i: idxOf(y, k) })))
  const state = (id: DriverId, i: number): CellState => (Math.abs(layer[id][i]! - reference[id][i]!) > 1e-9 ? 'recalc' : 'system')

  return (
    <div data-tour="model-grid" className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
        <b className="text-[13px] font-semibold">Full model · {title}</b>
        {hidden
          ? <span className="text-[11.5px] text-text-3">hidden · every metric by month or by year</span>
          : <div role="group" aria-label="Full model legend" className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[10.5px] text-text-3">
            <span className="inline-flex items-center gap-1.5"><i aria-hidden className="h-3 w-3 rounded-sm border border-border bg-[#F1F3F8]" />Actual · locked</span>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden className="h-3 w-3 rounded-sm border border-[#F0D98A] bg-[#FFF9E0]" />Editable forecast</span>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden className="w-4 border-t border-dashed border-text-3" />Differs from {locked ? 'the forecast' : 'the reference baseline'}</span>
            <span>Click a year to fold</span>
          </div>}
        {!hidden && <span className="ml-auto flex items-center gap-2">
          <span role="group" aria-label="Grid period" className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
            {(['monthly', 'annual'] as const).map(p => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={cx('rounded px-2.5 py-1 text-[10.5px] font-semibold capitalize', period === p ? 'bg-surface text-text shadow-sm' : 'text-text-2 hover:text-text')}>{p}</button>)}
          </span>
        </span>}
      </div>
      {!hidden && (
        <div className="max-h-[70vh] overflow-auto border-t border-border">
          <table className="min-w-full border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr>
                <th style={PINNED_HEADER_STYLE} className={cx(TH, ROWH, 'z-[6] px-2')}>Metric</th>
                {period === 'monthly'
                  ? YEARS.map(y => folded.has(y)
                    ? <th key={y} onClick={() => fold(y)} title="Click to show the months" className={cx(TH, 'cursor-pointer select-none bg-surface-2 text-center tracking-[.06em] hover:text-brand', y === year && 'bg-brand-soft text-brand')}>{y} ▸</th>
                    : <th key={y} colSpan={12} onClick={() => fold(y)} title="Click to fold the year to one column" className={cx(TH, 'cursor-pointer select-none text-center tracking-[.06em] hover:text-brand', y === year ? 'bg-brand-soft text-brand' : 'bg-surface-2')}>{y} ▾</th>)
                  : <th colSpan={cols.length} title="Totals for flows, averages for rates and stocks" className={cx(TH, 'bg-surface-2 text-center tracking-[.06em] text-brand')}>by year</th>}
                <th style={PINNED_HEADER_STYLE} className={cx(TH, FYH, 'z-[4] text-[10.5px]')} title="Year total for flows, year average for rates">Year {year}</th>
              </tr>
              <tr>
                <th style={PINNED_HEADER_STYLE} className={cx(TH, ROWH, 'top-[29px] z-[6] px-2 font-semibold')}>{period}</th>
                {cols.map((c, k) => c.i === null
                  ? <th key={k} className={cx(TH, 'top-[29px]', c.y < lastActYear && 'text-text-3/70')}>{period === 'annual' ? <>{c.y}{c.y === lastActYear && <span className="ml-1 font-normal">actual + forecast</span>}</> : 'year'}</th>
                  : <th key={k} className={cx(TH, 'top-[29px]', c.i < ACT && 'text-text-3/70')}>{MONTHS[c.i % 12]}</th>)}
                <th style={PINNED_HEADER_STYLE} className={cx(TH, FYH, 'top-[29px] z-[4]')} />
              </tr>
            </thead>
            <tbody>
              {stages.flatMap(st => [
                <tr key={`s-${st.id}`}>
                  <td className={cx(ROWH, 'border-y border-border px-2 py-[5px] text-[10.5px] font-bold uppercase tracking-[.06em] text-brand')}>{st.name} <span className="font-normal normal-case tracking-normal text-text-3">{st.what}</span></td>
                  <td colSpan={cols.length + 1} aria-hidden="true" className="border-y border-border bg-surface-2" />
                </tr>,
                ...rows.filter(r => r.stage === st.id).map(r => {
                  const can = r.kind === 'input' && !!r.id && editable.includes(r.id) && !locked
                  return (
                    <tr key={r.key} className={cx(r.kind === 'out' && 'font-semibold', selected === (r.go ?? r.key) && 'bg-brand-soft/30')}>
                      <td className={cx(TD, ROWH, 'px-2 font-sans')}>
                        {r.go ? <button type="button" onClick={() => onRow(r.go!)} className="flex w-full items-center gap-1.5 text-left hover:text-brand"><b className="text-[11.5px] font-semibold">{r.label}</b></button>
                          : <span className="flex items-center gap-1.5"><b className="text-[11.5px] font-semibold text-text-2">{r.label}</b></span>}
                      </td>
                      {cols.map((c, k) => {
                        if (c.i === null) return <td key={k} title={`${c.y} ${r.sum ? 'total' : 'average'}`} className={cx(TD, c.y < lastActYear ? 'bg-[#F1F3F8] text-text-3' : '', c.folded && 'border-x border-x-border bg-[#F7F8FC] font-semibold', c.folded && c.y < lastActYear && 'bg-[#ECEEF5]')}>{r.fmt(yAgg(r, c.y))}</td>
                        const i = c.i
                        if (i < ACT) return <td key={k} title="Actual · locked" className={cx(TD, 'bg-[#F1F3F8] text-text-3')}>{r.id ? r.fmt(ACTUALS[r.id][i]!) : r.fmt(r.series[i]!)}</td>
                        if (can) return <td key={k} className={cx(TD, 'p-0')}><GridCell value={r.series[i]!} dp={r.dp} state={state(r.id!, i)} onCommit={v => onCell(r.id!, i, v)} onCancel={() => undefined} /></td>
                        return <td key={k} className={TD}>{r.fmt(r.series[i]!)}</td>
                      })}
                      <td className={cx(TD, FYH)}>{r.fmt(yAgg(r, year))}</td>
                    </tr>)
                }),
              ])}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-border px-3.5 py-2 text-[11px] text-text-3">Net price = gross × (1 − {Math.round(GTN * 100)}% GtN). Rates are year averages; patients are an average month; prescriptions and money are year totals. Δ inventory, Unexplained and FX are default modules: open them from the funnel.</p>
    </div>
  )
}

/** The last twelve booked months: where a forecaster looks first before forecasting. */
export const defaultRange = (): [number, number] => [ACT - 13, ACT - 1]

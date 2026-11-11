import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { ACT, ACTUALS, BASELINE, DRIVERS, DRV, FY, OUTPUTS, UNBIASED, fmtRev, fmtV, idxOf, revenue, yearOf } from './engine'
import type { DriverId, Layer, OutputId } from './engine'
import { Card, ForecastChart, InfoTip, PageTitle, Tag, cx, field } from './ui'
import type { ChartSeries } from './ui'
import { ChartActions } from '../../chart/ChartActions'
import { TrendPanel } from './Trend'
import { GTN, UE_PRIOR, bridgeOf } from './Modules'

/** The statistical trend with actuals pinned: what the Data Science baseline says before anyone intervenes. */
const FULL_ACTUALS: Layer = Object.fromEntries(DRIVERS.map(d => [d.id, UNBIASED[d.id].map((v, i) => i < ACT ? ACTUALS[d.id][i]! : v)])) as Layer
// shortcut: Unexplained % held flat at the UE_PRIOR guess across the whole history instead of a real modelled series; upgrade once Data Science supplies monthly Unexplained %.
const stdSeries = (layer: Layer) => {
  const net = revenue(layer), b = net.map(n => bridgeOf(n, UE_PRIOR))
  return { gross: b.map(x => x.gross), tud: b.map(x => x.tud), inv: b.map(x => x.inv), uePct: net.map(() => UE_PRIOR), netPrice: layer.price.map(p => p * (1 - GTN)), fx: net.map(() => 1) }
}

type Group = 'Outcome' | 'Assumption' | 'Standard'
type Metric = { id: string; label: string; short?: string; group: Group; actual: number[]; trend: number[]; lo?: number[]; hi?: number[]; fmt: (v: number) => string; dp: number; unit: string; desc: string; sum?: boolean; driver?: DriverId }
const outcome = (o: OutputId): Metric => ({ id: o, label: OUTPUTS[o].label, group: 'Outcome', actual: OUTPUTS[o].fn(FULL_ACTUALS), trend: OUTPUTS[o].fn(UNBIASED), fmt: v => OUTPUTS[o].fmt(v, 1), dp: 0, unit: OUTPUTS[o].unit, desc: `Monthly ${OUTPUTS[o].label.toLowerCase()} from the statistical trend of every assumption.` })
const SA = stdSeries(FULL_ACTUALS), ST = stdSeries(UNBIASED)
const pctTxt = (v: number) => `${v.toFixed(1)}%`
/** The standard metrics every model carries (Default Modules + Gross Price docs): trend only here, no lower-level detail. The detail and the overrides live in the Forecast workspace. */
const STANDARD: Metric[] = [
  { id: 'price', label: 'Weighted gross price', short: 'Gross price', group: 'Standard', actual: FULL_ACTUALS.price, trend: UNBIASED.price, lo: BASELINE.price.lo, hi: BASELINE.price.hi, fmt: v => fmtV('price', v), dp: 0, unit: '$ / pack', desc: DRV.price.desc, driver: 'price' },
  { id: 'gross', label: 'Gross sales', group: 'Standard', actual: SA.gross, trend: ST.gross, fmt: v => fmtRev(v, 1), dp: 0, unit: '$M', desc: 'Monthly gross sales, before gross-to-net.', sum: true },
  { id: 'tud', label: 'Total underlying demand', short: 'Underlying demand', group: 'Standard', actual: SA.tud, trend: ST.tud, fmt: v => fmtRev(v, 1), dp: 0, unit: '$M', desc: 'Demand dollars from the patient funnel. Calculated, so read-only everywhere.', sum: true },
  { id: 'inv', label: 'Δ Inventory', group: 'Standard', actual: SA.inv, trend: ST.inv, fmt: v => fmtRev(v, 1), dp: 1, unit: '$M', desc: 'Month-over-month change in wholesaler inventory at the default weeks on hand.', sum: true },
  { id: 'ue', label: 'Unexplained difference', short: 'Unexplained %', group: 'Standard', actual: SA.uePct, trend: ST.uePct, fmt: pctTxt, dp: 1, unit: '% of gross', desc: 'Gross less underlying demand less Δ inventory, as a % of gross by month.' },
  { id: 'netp', label: 'Net sales price', group: 'Standard', actual: SA.netPrice, trend: ST.netPrice, fmt: v => fmtV('price', v), dp: 0, unit: '$ / pack', desc: 'Calculated: weighted gross price × (1 − gross-to-net). Never forecast on its own.' },
  { id: 'fx', label: 'Exchange rate', group: 'Standard', actual: SA.fx, trend: ST.fx, fmt: v => v.toFixed(2), dp: 2, unit: 'USD per USD', desc: 'US-only brand, so every month is 1.00 and reported equals constant currency.' },
]
const METRICS: Metric[] = [
  outcome('rev'), outcome('trx'), outcome('pts'),
  ...DRIVERS.filter(d => d.id !== 'price').map((d): Metric => ({ id: d.id, label: d.label, group: 'Assumption', actual: FULL_ACTUALS[d.id], trend: UNBIASED[d.id], lo: BASELINE[d.id].lo, hi: BASELINE[d.id].hi, fmt: v => fmtV(d.id, v), dp: d.dp, unit: d.unit, desc: d.desc, driver: d.id })),
  ...STANDARD,
]
const GROUP_LABEL: Record<Group, string> = { Outcome: 'Outcomes', Assumption: 'Funnel assumptions', Standard: 'Standard metrics (default modules)' }
const usd = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const CUR = yearOf(ACT - 1)
const yAvg = (s: number[], y: number) => s.slice(idxOf(y, 0), idxOf(y, 0) + 12).reduce((a, b) => a + b, 0) / 12

/** Baseline trend: the locked statistical trend per metric. Nothing here is edited; changes start in the Forecast workspace. */
export function BaselineTrend({ onWorkspace }: { onWorkspace: () => void }) {
  const [id, setId] = useState('rev')
  const m = METRICS.find(x => x.id === id)!
  const series: ChartSeries = useMemo(() => ({ actual: m.actual, unbiased: m.trend, lo: m.lo, hi: m.hi }), [m])
  // Trend of each standard metric, below the main chart: weighted gross price, underlying demand, Δ inventory, exchange rate and the Unexplained difference in dollars and as a % of gross.
  const std = STANDARD.reduce((o, x) => ({ ...o, [x.id]: x }), {} as Record<string, Metric>)
  const uePts = (g: number[], p: number[]) => g.map((v, i) => v * p[i]! / 100)
  const ueDollar: Metric = { id: 'ued', label: 'Unexplained difference', group: 'Standard', actual: uePts(SA.gross, SA.uePct), trend: uePts(ST.gross, ST.uePct), fmt: v => fmtRev(v, 1), dp: 1, unit: '$M', desc: 'Gross less underlying demand less Δ inventory, in dollars.', sum: true }
  const TRENDS: { m: Metric; title: string; sub: string }[] = [
    { m: std.price!, title: 'Weighted gross price', sub: 'Pack-weighted list price per pack' },
    { m: std.tud!, title: 'Total underlying demand', sub: 'Demand dollars from the patient funnel' },
    { m: std.inv!, title: 'Change in inventory', sub: 'Month-over-month wholesaler inventory, at the default weeks on hand' },
    { m: std.fx!, title: 'Exchange rates', sub: 'US-only brand: 1.00 every month' },
    { m: ueDollar, title: 'Unexplained difference', sub: 'Dollars, gross less demand less inventory' },
    { m: std.ue!, title: 'Forecast of % unexplained', sub: '% of gross by month; YTD actuals held, the rest backfilled' },
  ]
  const fyOf = (d: (typeof DRIVERS)[number]) => fmtV(d.id, yAvg(UNBIASED[d.id], FY))
  const prevOf = (d: (typeof DRIVERS)[number]) => fmtV(d.id, yAvg(FULL_ACTUALS[d.id], CUR - 1))

  return (
    <div className="space-y-5">
      <header><PageTitle size={26} title="Baseline trend" info="What the latest trends say the full year looks like. Illustrative values. Every chart has a Monthly / Quarterly / Annual toggle; hover for value, %G YoY, period on period and % of Budget. FX layer = 1.0 for a US-only brand such as Nurtec." /></header>

      {/* One layer: the trend chart, the "can you depend on it" verdict, and the assumptions that drive the trend. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px_260px]">
        <Card frame className="min-w-0" title={m.label} info={m.desc} right={<ChartActions target="baseline-trend-main" title={`${m.label} · baseline trend`} />}>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-[13px] font-medium">Metric
              <select aria-label="Metric" value={id} onChange={e => setId(e.target.value)} className={cx(field, 'w-64 font-semibold')}>
                {(['Outcome', 'Assumption', 'Standard'] as const).map(g => <optgroup key={g} label={GROUP_LABEL[g]}>{METRICS.filter(x => x.group === g).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>)}
              </select></label>
          </div>
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-2">
            <span className="inline-flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke="#15172e" strokeWidth="2.5" /></svg>Actuals</span>
            {m.lo && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm" style={{ background: 'rgb(138 143 168 / .25)' }} />Confidence band</span>}
          </div>
          <div data-tour="chart"><ForecastChart key={m.id} title={`${m.label} · baseline trend`} s={series} fmt={m.fmt} dp={m.dp} unit={m.unit} height={330} context="Statistical baseline · read-only" ownActions domId="baseline-trend-main" /></div>
        </Card>
        <TrendPanel key={m.id} series={m.actual} label={m.label} fmt={m.fmt} pct={m.unit === '%'} />
        <aside data-tour="assumptions" aria-label="Underlying assumptions behind the trend" className="rounded-2xl border border-border bg-surface shadow-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2"><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Underlying assumptions behind the trend<InfoTip text="What the model assumes for each driver to produce the trend. Detail comes once Crucible is connected." /></p><Tag tone="neutral">Crucible link later</Tag></div>
          <ul className="divide-y divide-border">
            {DRIVERS.map(d => (
              <li key={d.id} className={cx('py-2', m.driver === d.id && '-mx-2 rounded bg-brand-soft/50 px-2')}>
                <p className="flex items-baseline justify-between gap-2 text-[12.5px]"><span className="font-medium">{d.label}</span><span className="font-mono font-semibold">{fyOf(d)}</span></p>
                <p className="text-[11px] text-text-3">FY{FY} trend · FY{CUR - 1} actual {prevOf(d)} · Crucible model</p>
              </li>))}
          </ul>
        </aside>
      </div>

      <section data-tour="bridge" aria-label="Standard metric trends">
        <h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">Standard metric trends<InfoTip text="Trend only. The detail behind each one (SKU prices, target weeks on hand, the Unexplained %) and any override is in the Forecast workspace." /></h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {TRENDS.map(t => (
            <Card key={t.title} frame title={t.title} info={t.sub} right={<div className="flex items-center gap-2"><Tag tone="neutral"><Lock size={10} />Trend</Tag><ChartActions target={`baseline-trend-${t.m.id}`} title={`${t.title} · baseline trend`} /></div>}>
              <ForecastChart title={`${t.title} · baseline trend`} s={{ actual: t.m.actual, unbiased: t.m.trend, lo: t.m.lo, hi: t.m.hi }} fmt={t.m.fmt} dp={t.m.dp} unit={t.m.unit} height={230} context="Statistical baseline · read-only" canSave={false} ownActions domId={`baseline-trend-${t.m.id}`} />
            </Card>))}
        </div>
      </section>
    </div>
  )
}

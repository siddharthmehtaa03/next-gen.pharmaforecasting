import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DriverGroup } from './models'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Copy, FileText, Lock, Pin, Plus, Settings2, Sparkles, X } from 'lucide-react'

/*
 * Scenario workspace + cycle summary. Mirrors the Clairos reference screens' content and structure:
 * driver-based inputs (baseline / override / final), goal seek, need-to-meet, sensitivity, compare.
 * Revenue is driver-multiplicative: rev(y) = trended(y) × scenario factor × Π(final driver / scenario base driver).
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

export const ALL_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]
export const FYS = [2026, 2027, 2028, 2029, 2030]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MULT: Record<number, number> = { 2023: 0.807, 2024: 0.906, 2025: 0.973, 2026: 1, 2027: 1.07, 2028: 1.12, 2029: 1.1, 2030: 0.94 }
const DECAY: Record<number, number> = { 2026: 1, 2027: 0.6, 2028: 0.4, 2029: 0.3, 2030: 0.2 }

type Driver = { id: string; label: string; group: 'Epidemiology' | 'Share' | 'Conversion' | 'Price'; w: number; fmt: (v: number) => string; base: number[]; step: number }
export const DRIVERS: Driver[] = [
  { id: 'pat', label: 'Advanced Systemic Patients', group: 'Epidemiology', w: 0.2, fmt: v => `${v.toFixed(1)}K`, step: 0.1, base: [150.8, 185.4, 228.5, 262.9, 271, 279, 286, 292] },
  { id: 'jak', label: 'Class Share', group: 'Share', w: 0.3, fmt: v => `${v.toFixed(2)}%`, step: 0.01, base: [6.1, 7.4, 8.5, 9.49, 9.9, 10.3, 10.6, 10.8] },
  { id: 'bshare', label: 'Brand Share within Class', group: 'Share', w: 0.4, fmt: v => `${v.toFixed(2)}%`, step: 0.01, base: [11.2, 12.6, 13.4, 14.17, 14.6, 15, 14.8, 13.5] },
  { id: 'rx', label: 'Rx per Patient', group: 'Conversion', w: 0, fmt: v => v.toFixed(2), step: 0.01, base: [1.05, 1.06, 1.07, 1.07, 1.07, 1.08, 1.08, 1.08] },
  { id: 'compl', label: 'Compliance Rate Overall', group: 'Conversion', w: 0, fmt: v => `${v.toFixed(1)}%`, step: 0.1, base: [74, 76, 77, 78, 79, 79, 80, 80] },
  { id: 'pills', label: 'Pills per Rx', group: 'Conversion', w: 0, fmt: v => v.toFixed(1), step: 0.1, base: [16, 16, 16, 16, 16, 16, 16, 16] },
  { id: 'price', label: 'Price per Pill', group: 'Price', w: 0.1, fmt: v => `$${v.toFixed(2)}`, step: 0.01, base: [96, 100.2, 102.4, 105.1, 108.3, 111.7, 114.9, 111] },
]
const GROUPS = ['Epidemiology', 'Share', 'Conversion', 'Price'] as const
const yi = (y: number) => ALL_YEARS.indexOf(y)

export type Scn = { id: string; net: number }
/** Chart snapshot stored with a knowledge bank entry, so the graph is captured as it looked when pinned. */
export type Snap = { kind: 'line' | 'bar'; labels: string[]; series: { name: string; pts: number[]; tone?: 'brand' | 'muted' | 'ok' | 'err' | 'dark' }[] }
export type PinFn = (title: string, body: string, chart?: Snap) => void
export type Overrides = Record<string, Record<string, Record<number, number>>>
type Ctx = { trend: number; scns: Scn[]; ov: Overrides }

const netOf = (c: Ctx, id: string) => c.scns.find(s => s.id === id)?.net ?? c.trend
const factor = (c: Ctx, id: string, y: number) => 1 + (netOf(c, id) / c.trend - 1) * (DECAY[y] ?? 0)
const scnBase = (c: Ctx, id: string, d: Driver, y: number) => d.base[yi(y)]! * (y < 2026 ? 1 : Math.pow(factor(c, id, y), d.w))
const finalVal = (c: Ctx, id: string, d: Driver, y: number) => c.ov[id]?.[d.id]?.[y] ?? scnBase(c, id, d, y)
function rev(c: Ctx, id: string, y: number) {
  const r0 = c.trend * MULT[y]!
  if (y < 2026) return r0
  let r = r0 * factor(c, id, y)
  for (const d of DRIVERS) r *= finalVal(c, id, d, y) / scnBase(c, id, d, y)
  return r
}
const total = (c: Ctx, id: string, ys = FYS) => ys.reduce((a, y) => a + rev(c, id, y), 0)
const totalWith = (c: Ctx, id: string, d: Driver, f: (y: number, v: number) => number) => FYS.reduce((a, y) => a + rev(c, id, y) * f(y, finalVal(c, id, d, y)) / finalVal(c, id, d, y), 0)

/* ───────── primitives ───────── */

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'err' }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', tone === 'neutral' && 'bg-surface-2 text-text-2', tone === 'brand' && 'bg-brand-soft text-brand', tone === 'ok' && 'bg-ok-soft text-ok', tone === 'warn' && 'bg-warn-soft text-warn', tone === 'err' && 'bg-err-soft text-err')}>{children}</span>
}
function Panel({ title, sub, right, children, className }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-border bg-surface shadow-card', className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3.5"><div className="min-w-0"><h3 className="font-display text-base font-semibold">{title}</h3>{sub && <p className="text-xs text-text-2">{sub}</p>}</div>{right && <div className="flex flex-wrap items-center gap-2">{right}</div>}</header>
      <div className="p-5">{children}</div>
    </section>
  )
}
/** Secondary segmented control — the one style used for sub-views and toggles everywhere. */
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label?: string }) {
  return <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-border bg-surface-2 p-1">{options.map(o => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cx('whitespace-nowrap rounded-full px-3.5 py-1 text-[13px] font-medium transition-all', value === o ? 'bg-brand text-white shadow-sm' : 'text-text-2 hover:bg-white hover:text-brand')}>{o}</button>)}</div>
}
/** Primary tabs — the one style used for page-level sections (cycle and scenario workspaces). */
export function Tabs<T extends string>({ value, options, onChange, label, className }: { value: T; options: readonly { id: T; label: string; badge?: ReactNode }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cx('flex gap-1 overflow-x-auto border-b border-border', className)}>
      {options.map(t => <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
        className={cx('-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', value === t.id ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text')}>{t.label}{t.badge}</button>)}
    </div>
  )
}
export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'ok' | 'err' }) {
  return <div className="min-w-0 rounded-2xl border border-border bg-surface shadow-card p-4"><p className="truncate text-xs text-text-3">{label}</p><p className={cx('mt-1 truncate font-display text-2xl font-semibold tabular-nums', tone === 'ok' && 'text-ok', tone === 'err' && 'text-err')}>{value}</p>{note && <p className="mt-0.5 truncate text-xs text-text-2">{note}</p>}</div>
}
function Select({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="h-8 max-w-full rounded-md border border-border-strong bg-surface px-2 text-[13px] outline-none focus:border-brand">{options.map(o => <option key={o}>{o}</option>)}</select>
}
function PinBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Add to knowledge bank" title="Add to knowledge bank" className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-brand"><Pin size={15} /></button>
}
/** Editable cell. Open slots are bordered in brand; once overridden they turn amber so changes stand out. */
function Num({ value, onChange, step = 0.01, disabled, tone, w = 'w-24', label }: { value: number | ''; onChange: (v: number | null) => void; step?: number; disabled?: boolean; tone?: 'ovr'; w?: string; label?: string }) {
  return <input type="number" aria-label={label} step={step} disabled={disabled} value={value === '' ? '' : Number(value.toFixed(4))} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
    className={cx('h-8 rounded border px-2 text-right font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20', w, tone === 'ovr' ? (value === '' ? 'border-brand/50 bg-surface' : 'border-warn bg-warn-soft font-semibold') : 'border-border-strong bg-surface', disabled && 'opacity-50')} />
}

/* ───────── chart (sized to its container, so it never shrinks to a sliver) ───────── */

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e!.contentRect.width))))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

type Series = { name: string; pts: number[]; tone: 'brand' | 'muted' | 'ok' | 'warn' | 'dark'; dash?: boolean }
const STROKE = { brand: 'stroke-brand', muted: 'stroke-text-3', ok: 'stroke-ok', warn: 'stroke-warn', dark: 'stroke-text' }
const FILL = { brand: 'fill-brand', muted: 'fill-text-3', ok: 'fill-ok', warn: 'fill-warn', dark: 'fill-text' }

function Chart({ labels, series, hist, kind = 'line', height = 300 }: { labels: string[]; series: Series[]; hist: number; kind?: 'line' | 'bar'; height?: number }) {
  const [ref, W] = useWidth()
  const H = height, L = 56, R = 12, B = 28, T = 20
  const n = labels.length
  const max = Math.max(1, ...series.flatMap(s => s.pts)) * 1.1
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1))
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - L) / 64))))
  const hx = x(Math.max(0, Math.min(n - 1, hist - 0.5)))
  const bw = Math.max(3, (W - L - R) / Math.max(1, n) * 0.6 / series.length)
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Chart">
        {hist > 0 && <rect x={L} y={T} width={Math.max(0, hx - L)} height={H - T - B} className="fill-surface-2" />}
        {[0, 0.25, 0.5, 0.75, 1].map(t => <g key={t}><line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} className="stroke-border" strokeWidth={1} /><text x={L - 8} y={y(max * t) + 3} textAnchor="end" className="fill-text-3 font-mono" fontSize={11}>${(max * t).toFixed(0)}M</text></g>)}
        {hist > 0 && hist < n && <g><line x1={hx} x2={hx} y1={T} y2={H - B} className="stroke-text-3" strokeDasharray="3 3" /><text x={hx - 6} y={T - 6} textAnchor="end" className="fill-text-3" fontSize={11}>Actuals</text><text x={hx + 6} y={T - 6} className="fill-text-3" fontSize={11}>Forecast</text></g>}
        {kind === 'line'
          ? series.map((s, k) => {
            const d = s.pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
            return <g key={s.name}>{k === series.length - 1 && <path d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} className={cx(FILL[s.tone], 'opacity-10')} />}<path d={d} fill="none" className={STROKE[s.tone]} strokeWidth={2} strokeDasharray={s.dash ? '6 4' : undefined} /></g>
          })
          : series.map((s, k) => s.pts.map((v, i) => <rect key={`${s.name}${i}`} x={x(i) - bw * series.length / 2 + k * bw} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} className={cx(FILL[s.tone], 'opacity-80')} />))}
        {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-text-3" fontSize={11}>{l}</text>)}
      </svg>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">{series.map(s => <span key={s.name} className="inline-flex items-center gap-1.5"><i className={cx('h-0.5 w-5', s.tone === 'brand' && 'bg-brand', s.tone === 'muted' && 'bg-text-3', s.tone === 'ok' && 'bg-ok', s.tone === 'warn' && 'bg-warn', s.tone === 'dark' && 'bg-text', s.dash && 'opacity-60')} />{s.name}</span>)}</p>
    </div>
  )
}

type Gran = 'Monthly' | 'Quarterly' | 'Yearly'
function buildPoints(c: Ctx, id: string, years: number[], gran: Gran, seasonal: number[]) {
  const tot = seasonal.reduce((a, b) => a + b, 0)
  const labels: string[] = [], pts: number[] = []
  for (const y of years) {
    const r = rev(c, id, y)
    const m = seasonal.map(s => r * s / tot)
    if (gran === 'Yearly') { labels.push(String(y)); pts.push(r) }
    else if (gran === 'Quarterly') for (let q = 0; q < 4; q++) { labels.push(`Q${q + 1}-${String(y).slice(2)}`); pts.push(m[q * 3]! + m[q * 3 + 1]! + m[q * 3 + 2]!) }
    else m.forEach((v, i) => { labels.push(`${MONTHS[i]}-${String(y).slice(2)}`); pts.push(v) })
  }
  return { labels, pts }
}
const histCount = (years: number[], gran: Gran, startM: number) => {
  const before = years.filter(y => y < 2026).length
  const per = gran === 'Monthly' ? 12 : gran === 'Quarterly' ? 4 : 1
  const inYear = years.includes(2026) ? (gran === 'Monthly' ? startM : gran === 'Quarterly' ? Math.floor(startM / 3) : 0) : 0
  return before * per + inYear
}

/* ───────── Cycle summary ───────── */

export function CycleSummary({ ctx, scenario, brand, seasonal, pin }: { ctx: Ctx; scenario: string; brand: string; seasonal: number[]; pin: PinFn }) {
  const ids = ctx.scns.map(s => s.id)
  const [base, setBase] = useState(scenario)
  const [cmp, setCmp] = useState(ids.find(i => i === 'Trended Statistical') ?? ids[0]!)
  const [act, setAct] = useState('Jul 2026 Actuals')
  const [period, setPeriod] = useState('2026 - 2026')
  const [metric, setMetric] = useState('Net revenue')
  const [kind, setKind] = useState<'Line' | 'Bar' | 'Table'>('Line')
  const ys = FYS.filter(y => y <= Number(period.slice(-4)))
  const chartYears = [2025, ...ys]
  const g: Gran = ys.length > 1 ? 'Yearly' : 'Monthly'
  const a = buildPoints(ctx, base, chartYears, g, seasonal), b = buildPoints(ctx, cmp, chartYears, g, seasonal)
  const hist = histCount(chartYears, g, act.startsWith('Jun') ? 5 : 6)

  const avg = (id: string, d: Driver) => ys.reduce((s, y) => s + finalVal(ctx, id, d, y), 0) / ys.length
  const actCtx: Ctx = { ...ctx, ov: {} }
  const Delta = ({ v, ref: r, d }: { v: number; ref: number; d: Driver }) => {
    const dv = v - r
    if (Math.abs(dv) < d.step / 2) return <span className="block text-[11px] text-text-3">▪ 0.00</span>
    return <span className={cx('mt-0.5 inline-block rounded px-1.5 text-[11px] font-semibold', dv > 0 ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err')}>{dv > 0 ? '▲' : '▼'} {Math.abs(dv).toFixed(d.step < 0.1 ? 2 : 1)}</span>
  }

  // Revenue bridge: compare → base, split across drivers by log-ratio
  const revB = ys.reduce((s, y) => s + rev(ctx, base, y), 0), revC = ys.reduce((s, y) => s + rev(ctx, cmp, y), 0)
  const logs = DRIVERS.map(d => ({ d, l: Math.log(avg(base, d) / avg(cmp, d)) }))
  const sumL = logs.reduce((s, x) => s + x.l, 0)
  const steps = Math.abs(sumL) < 1e-9 ? [] : logs.filter(x => Math.abs(x.l) > 1e-6).map(x => ({ label: x.d.label, v: (revB - revC) * x.l / sumL }))
  const bars: { label: string; v: number; kind: 'Total' | 'Increase' | 'Decrease'; from: number }[] = [{ label: cmp, v: revC, kind: 'Total', from: 0 }]
  let run = revC
  for (const s of steps) { bars.push({ label: s.label, v: s.v, kind: s.v >= 0 ? 'Increase' : 'Decrease', from: run }); run += s.v }
  bars.push({ label: base, v: revB, kind: 'Total', from: 0 })
  const bmax = Math.max(...bars.map(x => x.kind === 'Total' ? x.v : Math.max(x.from, x.from + x.v))) * 1.1

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-lg bg-brand-soft/50 px-5 py-4">
        <p className="text-xs italic text-text-2">Track the current cycle performance compared to previous cycles &amp; latest actuals.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-text-2">Base scenario ({brand} · {scenario})<span className="mt-1 block"><Select label="Base scenario" value={base} options={ids} onChange={setBase} /></span></label>
          <label className="text-xs text-text-2">Selection 1 (Cycle · Scenario):<span className="mt-1 block"><Select label="Comparison scenario" value={cmp} options={ids} onChange={setCmp} /></span></label>
          <label className="text-xs text-text-2">Selection 2 (Actuals · Refresh date):<span className="mt-1 block"><Select label="Actuals refresh" value={act} options={['Jul 2026 Actuals', 'Jun 2026 Actuals']} onChange={setAct} /></span></label>
          <label className="text-xs text-text-2">Select period:<span className="mt-1 block"><Select label="Period" value={period} options={['2026 - 2026', '2026 - 2028', '2026 - 2030']} onChange={setPeriod} /></span></label>
        </div>
      </div>

      <div className="space-y-5">
        <Panel title="Summary chart" right={<div className="flex items-center gap-2">
          <Select label="Metric" value={metric} options={['Net revenue', 'Gross revenue']} onChange={setMetric} />
          <Seg value={kind} options={['Line', 'Bar', 'Table'] as const} onChange={setKind} />
          <PinBtn onClick={() => pin(`${base} vs ${cmp}`, `${metric} ${money(revB)} vs ${money(revC)} (${signed((revB / revC - 1) * 100)}%) over ${period}.`, { kind: kind === 'Bar' ? 'bar' : 'line', labels: a.labels, series: [{ name: cmp, pts: b.pts, tone: 'muted' }, { name: base, pts: a.pts, tone: 'brand' }] })} /></div>}>
          {(() => {
            const k = metric === 'Gross revenue' ? 100 / (100 - 78.4) : 1
            const ser: Series[] = [{ name: cmp, pts: b.pts.map(v => v * k), tone: 'muted', dash: true }, { name: base, pts: a.pts.map(v => v * k), tone: 'brand' }]
            return kind === 'Table'
              ? <div className="max-h-[300px] overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-surface text-left text-xs text-text-3"><tr><th className="pb-2 font-medium">Period</th><th className="pb-2 text-right font-medium">{base}</th><th className="pb-2 text-right font-medium">{cmp}</th><th className="pb-2 text-right font-medium">Δ</th></tr></thead>
                <tbody>{a.labels.map((l, i) => <tr key={l} className="border-t border-border"><td className="py-1.5">{l}</td><td className="py-1.5 text-right font-mono">{money(ser[1]!.pts[i]!)}</td><td className="py-1.5 text-right font-mono">{money(ser[0]!.pts[i]!)}</td><td className="py-1.5 text-right font-mono">{signed(ser[1]!.pts[i]! - ser[0]!.pts[i]!)}</td></tr>)}</tbody></table></div>
              : <Chart labels={a.labels} series={ser} hist={hist} kind={kind === 'Bar' ? 'bar' : 'line'} />
          })()}
        </Panel>

        <Panel title={`Assumption comparison summary — ${period}`} right={<PinBtn onClick={() => pin('Assumption comparison', `${base} vs ${cmp} vs actuals across ${DRIVERS.length} drivers.`)} />}>
          <div className="max-h-[340px] overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2 text-xs text-text-2"><tr>
                <th className="px-3 py-2 text-left font-medium">Metric</th>
                <th className="px-3 py-2 text-center font-medium">{base}<span className="block font-normal text-text-3">(w.r.t. {cmp})</span></th>
                <th className="px-3 py-2 text-center font-medium">{cmp}</th>
                <th className="px-3 py-2 text-center font-medium">{act}<span className="block font-normal text-text-3">(w.r.t. {cmp})</span></th></tr></thead>
              <tbody>
                <tr className="border-t border-border"><td className="px-3 py-3 font-semibold">Net revenue</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold">{money(revB)}<br /><span className={cx('text-[11px]', revB >= revC ? 'text-ok' : 'text-err')}>{signed(revB - revC)}M</span></td>
                  <td className="px-3 py-3 text-center font-mono font-semibold">{money(revC)}</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold">{money(ys.reduce((s, y) => s + rev(actCtx, 'Trended Statistical', y), 0))}</td></tr>
                {DRIVERS.map(d => {
                  const vb = avg(base, d), vc = avg(cmp, d), va = ys.reduce((s, y) => s + finalVal(actCtx, 'Trended Statistical', d, y), 0) / ys.length
                  return <tr key={d.id} className="border-t border-border"><td className="px-3 py-3 font-semibold">{d.label}</td>
                    <td className="px-3 py-3 text-center font-mono">{d.fmt(vb)}<br /><Delta v={vb} ref={vc} d={d} /></td>
                    <td className="px-3 py-3 text-center font-mono">{d.fmt(vc)}</td>
                    <td className="px-3 py-3 text-center font-mono">{d.fmt(va)}<br /><Delta v={va} ref={vc} d={d} /></td></tr>
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title={`Revenue bridge — ${period}`} sub={`${cmp} → ${base}`} right={<div className="flex items-center gap-3 text-[11px] text-text-2">{([['Total', 'bg-text'], ['Increase', 'bg-ok'], ['Decrease', 'bg-err'], ['Gap', 'bg-brand']] as const).map(([l, c]) => <span key={l} className="inline-flex items-center gap-1"><i className={cx('h-2 w-2 rounded-sm', c)} />{l}</span>)}<PinBtn onClick={() => pin('Revenue bridge', bars.map(x => `${x.label} ${money(x.v)}`).join(' → '), { kind: 'bar', labels: bars.map(x => x.label), series: [{ name: 'Revenue', pts: bars.map(x => x.v) }] })} /></div>}>
        <div className="flex h-52 items-end gap-3 overflow-x-auto">
          {bars.map((x, i) => {
            const lo = x.kind === 'Total' ? 0 : Math.min(x.from, x.from + x.v), hi = x.kind === 'Total' ? x.v : Math.max(x.from, x.from + x.v)
            return (
              <div key={i} className="flex min-w-[88px] flex-1 flex-col items-center justify-end text-center" style={{ height: '100%' }}>
                <span className="font-mono text-[11px] text-text-2">{x.kind === 'Total' ? money(x.v) : money(x.v).replace(/^(?=\$)/, x.v > 0 ? '+' : '')}</span>
                <div className="relative w-full flex-1"><div className={cx('absolute inset-x-2 rounded-sm', x.kind === 'Total' ? 'bg-text' : x.kind === 'Increase' ? 'bg-ok' : 'bg-err')} style={{ bottom: `${(lo / bmax) * 100}%`, height: `${Math.max(1, ((hi - lo) / bmax) * 100)}%` }} /></div>
                <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-text-2">{x.label}</span>
              </div>
            )
          })}
        </div>
        {steps.length === 0 && <p className="mt-2 text-xs text-text-3">Both selections are identical — choose a different comparison to see what moved revenue.</p>}
      </Panel>
    </div>
  )
}

/* ───────── Workspace ───────── */

export type WsTab = 'Assumptions' | 'Inputs' | 'Result' | 'Analysis' | 'Compare' | 'Review'
export const WS_TABS: { id: WsTab; label: string }[] = [
  { id: 'Assumptions', label: 'Assumptions' }, { id: 'Inputs', label: 'Inputs' }, { id: 'Result', label: 'Forecast result' }, { id: 'Analysis', label: 'Analysis tools' }, { id: 'Compare', label: 'Compare scenarios' },
]
type AnTab = string
export type WorkspaceProps = {
  ctx: Ctx; scenarioId: string; brand: string; seasonal: number[]; eventsOn: number; submitted: boolean; version: string
  tab: WsTab; onTab: (t: WsTab) => void; cycleName: string; onBack: () => void
  groups: DriverGroup[]; moduleInputs: string; assumptionsNode: ReactNode; inputsExtra?: ReactNode
  /** assumptions that differ between two scenarios, for the comparison */
  diff: (a: string, b: string) => { label: string; a: string; b: string }[]
  setOv: (f: (o: Overrides) => Overrides) => void
  onEvents: () => void; onSetup: () => void; onSwitch: (id: string) => void; onNew: (from?: string) => void
  extra?: { label: string; node: ReactNode; onOpen: () => void }; reviewExtra?: ReactNode
  pin: PinFn; notify: (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void
}

export type Editors = { setOne: SetOne; applyMany: ApplyMany }
/** Override writers for one scenario id. Shared by the scenario workspace and the new-scenario builder. */
export function editorsFor(setOv: WorkspaceProps['setOv'], id: string, note: (s: string) => void = () => {}): Editors {
  return {
    setOne: (d, y, v) => {
      setOv(o => { const sc = { ...(o[id] ?? {}) }, dr = { ...(sc[d.id] ?? {}) }; if (v === null) delete dr[y]; else dr[y] = v; sc[d.id] = dr; return { ...o, [id]: sc } })
      note(v === null ? `Cleared override on ${d.label} ${y}` : `${d.label} ${y} set to ${d.fmt(v)}`)
    },
    applyMany: (changes, msg) => {
      setOv(o => { const sc = { ...(o[id] ?? {}) }; for (const ch of changes) sc[ch.d.id] = { ...(sc[ch.d.id] ?? {}), [ch.y]: ch.v }; return { ...o, [id]: sc } })
      note(msg)
    },
  }
}

const DRIVER_SRC: Record<Driver['group'], string> = { Epidemiology: 'NPA market trend · T. Chen · High', Share: 'Blaze extract · R. Osei · High', Conversion: 'Blaze extract · trailing 12 mo · Medium', Price: 'Pricing WAC schedule · M. Duarte · High' }

export function ScenarioWorkspace(p: WorkspaceProps) {
  const { ctx, scenarioId: id, tab, onTab: setTab } = p
  const [an, setAn] = useState<AnTab>('Goal Seek')
  const anTabs = ['Goal Seek', 'Sensitivity', 'Need To Meet', ...(p.extra ? [p.extra.label] : [])]
  const [startM, setStartM] = useState(6)
  const [logOpen, setLogOpen] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const note = (s: string) => setLog(l => [`${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · ${s}`, ...l].slice(0, 40))
  const { setOne, applyMany } = editorsFor(p.setOv, id, note)
  const overrideCount = Object.values(ctx.ov[id] ?? {}).reduce((a, r) => a + Object.keys(r).length, 0)
  const cur = total(ctx, id), trendTotal = total({ ...ctx, ov: {} }, id)
  const readOnly = id === 'Trended Statistical'

  const generate = () => {
    const ranked = DRIVERS.map(d => ({ d, imp: totalWith(ctx, id, d, (_, v) => v * 1.01) - cur })).sort((a, b) => Math.abs(b.imp) - Math.abs(a.imp))
    p.pin(`${id}: FY26–30 net revenue ${money(cur)}`, `${overrideCount ? `${overrideCount} override${overrideCount > 1 ? 's' : ''} move revenue ${signed(cur - trendTotal)}M vs scenario baseline. ` : 'No overrides applied. '}Most sensitive driver: ${ranked[0]!.d.label} (±1% ≈ ${money(Math.abs(ranked[0]!.imp))}).`, { kind: 'bar', labels: FYS.map(String), series: [{ name: 'Baseline', pts: FYS.map(y => rev({ ...ctx, ov: {} }, id, y)), tone: 'muted' }, { name: id, pts: FYS.map(y => rev(ctx, id, y)), tone: 'brand' }] })
  }

  return (
    <div className="rise mx-auto w-full max-w-[1200px] px-5 py-7 sm:px-6">
      <button type="button" onClick={p.onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-2 hover:text-brand"><ArrowLeft size={15} />{p.cycleName}</button>
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Scenario workspace · {p.brand}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-[28px] font-semibold tracking-tight">{id}</h1><Pill tone={p.submitted ? 'ok' : 'neutral'}>{readOnly ? 'Read-only' : p.submitted ? 'Submitted' : 'Draft'}</Pill><Pill>Model {p.version}</Pill></div>
          <p className="mt-1 text-sm text-text-2">{readOnly ? 'The locked statistical baseline. Copy it into a new scenario to make changes.' : overrideCount ? `${overrideCount} override${overrideCount > 1 ? 's' : ''} · ${signed(cur - trendTotal)}M vs baseline over FY26–30` : 'Generated from its own assumptions and inputs. Adjust them in the tabs below and the result updates.'}</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-text-2">Forecast start
            <Select label="Forecast start" value={`${MONTHS[startM]} 2026`} options={MONTHS.slice(5, 9).map(m => `${m} 2026`)} onChange={v => setStartM(MONTHS.indexOf(v.slice(0, 3)))} /></label>
          <button type="button" onClick={() => setLogOpen(o => !o)} aria-expanded={logOpen} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-[13px] font-medium text-text-2 hover:border-brand hover:text-brand"><FileText size={14} />Change log{log.length > 0 && <span className="font-mono text-[11px]">{log.length}</span>}</button>
          <button type="button" onClick={generate} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-[13px] font-medium text-text-2 hover:border-brand hover:text-brand"><Sparkles size={14} />Generate insight</button>
          <button type="button" onClick={() => p.onNew(id)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-dark"><Plus size={14} />New scenario</button>
          {logOpen && (
            <div className="absolute right-0 top-10 z-40 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-surface shadow-card p-3 shadow-xl">
              <p className="mb-2 text-sm font-semibold">Change log</p>
              {log.length ? <ul className="max-h-64 space-y-1.5 overflow-auto text-xs text-text-2">{log.map((l, i) => <li key={i} className="border-b border-border pb-1.5 last:border-0">{l}</li>)}</ul> : <p className="text-xs text-text-3">No changes yet in this session.</p>}
            </div>
          )}
        </div>
      </div>

      <Tabs className="mt-6" label="Scenario sections" value={tab} onChange={setTab}
        options={WS_TABS.map(t => ({ ...t, badge: t.id === 'Inputs' && overrideCount > 0 ? <span className="rounded-full bg-warn-soft px-1.5 font-mono text-[10px] text-warn">{overrideCount}</span> : undefined }))} />

      {tab === 'Assumptions' && <div className="mt-6">{p.assumptionsNode}</div>}
      {tab === 'Inputs' && <InputsTab {...p} startM={startM} setOne={setOne} applyMany={applyMany} cur={cur} trendTotal={trendTotal} log={log} readOnly={readOnly} />}
      {tab === 'Result' && <OutputsTab {...p} cur={cur} trendTotal={trendTotal} overrideCount={overrideCount} startM={startM} />}
      {tab === 'Analysis' && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Seg label="Analysis tool" value={an} options={anTabs} onChange={t => { setAn(t); if (t === p.extra?.label) p.extra.onOpen() }} />
            <span className="text-xs text-text-3">Applying a result writes overrides into Inputs. The impact panel and charts update straight away.</span>
          </div>
          {an === 'Goal Seek' && <GoalSeek {...p} applyMany={applyMany} startM={startM} />}
          {an === 'Need To Meet' && <NeedToMeet {...p} applyMany={applyMany} />}
          {an === 'Sensitivity' && <Sensitivity {...p} />}
          {p.extra && an === p.extra.label && <div>{p.extra.node}</div>}
        </div>
      )}
      {tab === 'Compare' && <CompareTab {...p} startM={startM} />}
      {tab === 'Review' && <>
        <ReviewTab {...p} cur={cur} trendTotal={trendTotal} overrideCount={overrideCount} setOne={setOne} />
        {p.reviewExtra && <div className="mt-8 border-t border-border pt-2">{p.reviewExtra}</div>}
      </>}
    </div>
  )
}

type Sub = WorkspaceProps & { startM: number }
type SetOne = (d: Driver, y: number, v: number | null) => void
type ApplyMany = (c: { d: Driver; y: number; v: number }[], msg: string) => void

function SummaryChart({ ctx, id, seasonal, startM, pin, extra, compact, title = 'Forecast summary' }: { ctx: Ctx; id: string; seasonal: number[]; startM: number; pin: WorkspaceProps['pin']; extra?: Series[]; compact?: boolean; title?: string }) {
  const [gran, setGran] = useState<Gran>(compact ? 'Yearly' : 'Monthly')
  const [per, setPer] = useState(compact ? '2023 - 2030' : '2025 - 2027')
  const [kind, setKind] = useState<'Line' | 'Table'>('Line')
  const [a, b] = per.split(' - ').map(Number) as [number, number]
  const years = ALL_YEARS.filter(y => y >= a && y <= b)
  const proj = buildPoints({ ...ctx, ov: {} }, id, years, gran, seasonal), fin = buildPoints(ctx, id, years, gran, seasonal)
  const hist = histCount(years, gran, startM)
  const series: Series[] = [{ name: 'Baseline (before your overrides)', pts: proj.pts, tone: 'muted', dash: true }, { name: 'Adjusted forecast', pts: fin.pts, tone: 'brand' }, ...(extra ?? [])]
  return (
    <Panel title={title} sub="Net revenue · actuals shaded · updates as you edit" right={<>
      <Seg label="Granularity" value={gran} options={['Monthly', 'Quarterly', 'Yearly'] as const} onChange={setGran} />
      <Select label="Period" value={per} options={['2023 - 2030', '2025 - 2027', '2026 - 2026', '2026 - 2030']} onChange={setPer} />
      <Seg label="View" value={kind} options={['Line', 'Table'] as const} onChange={setKind} />
      <PinBtn onClick={() => pin(`${id} summary`, `Adjusted net revenue ${money(fin.pts.reduce((x, y) => x + y, 0))} vs baseline ${money(proj.pts.reduce((x, y) => x + y, 0))} for ${per} (${gran.toLowerCase()}).`, { kind: 'line', labels: fin.labels, series: [{ name: 'Baseline', pts: proj.pts, tone: 'muted' }, { name: 'Adjusted', pts: fin.pts, tone: 'brand' }] })} /></>}>
      {kind === 'Line' ? <Chart labels={fin.labels} series={series} hist={hist} height={compact ? 260 : 300} />
        : <div className="max-h-[300px] overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-surface text-left text-xs text-text-3"><tr><th className="pb-2 font-medium">Period</th><th className="pb-2 text-right font-medium">Baseline</th><th className="pb-2 text-right font-medium">Adjusted</th><th className="pb-2 text-right font-medium">Δ</th></tr></thead><tbody>{fin.labels.map((l, i) => <tr key={l} className="border-t border-border"><td className="py-1.5">{l}</td><td className="py-1.5 text-right font-mono text-text-2">{money(proj.pts[i]!)}</td><td className="py-1.5 text-right font-mono">{money(fin.pts[i]!)}</td><td className={cx('py-1.5 text-right font-mono', fin.pts[i]! - proj.pts[i]! > 0.05 ? 'text-ok' : fin.pts[i]! - proj.pts[i]! < -0.05 ? 'text-err' : 'text-text-3')}>{signed(fin.pts[i]! - proj.pts[i]!)}</td></tr>)}</tbody></table></div>}
    </Panel>
  )
}

/** Live impact rail beside Inputs: every edit shows its effect on the forecast immediately. */
function ImpactRail({ ctx, id, cur, trendTotal, log }: { ctx: Ctx; id: string; cur: number; trendTotal: number; log: string[] }) {
  const base = { ...ctx, ov: {} }
  const d = cur - trendTotal
  const rows = FYS.map(y => ({ y, b: rev(base, id, y), f: rev(ctx, id, y) }))
  const max = Math.max(...rows.flatMap(r => [r.b, r.f]))
  return (
    <aside className="space-y-3 self-start lg:sticky lg:top-[76px]">
      <section className="rounded-2xl border border-border bg-surface shadow-card p-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Live impact · FY26–30</p>
        <p className="mt-3 text-xs text-text-2">Adjusted net revenue</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">{money(cur)}</p>
        <p className={cx('text-sm font-semibold', Math.abs(d) < 0.05 ? 'text-text-3' : d > 0 ? 'text-ok' : 'text-err')}>{Math.abs(d) < 0.05 ? 'No change vs baseline' : `${signed(d)}M (${signed((cur / trendTotal - 1) * 100, 2)}%) vs baseline`}</p>
        <div className="mt-4 flex h-28 items-end gap-2" aria-hidden>
          {rows.map(r => (
            <div key={r.y} className="flex h-full flex-1 flex-col justify-end">
              <div className="flex flex-1 items-end justify-center gap-0.5">
                <i className="w-2.5 rounded-t-sm bg-border-strong" style={{ height: `${r.b / max * 100}%` }} />
                <i className={cx('w-2.5 rounded-t-sm', r.f >= r.b ? 'bg-brand' : 'bg-err')} style={{ height: `${r.f / max * 100}%` }} />
              </div>
              <span className="mt-1 text-center text-[10px] text-text-3">{String(r.y).slice(2)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 flex gap-3 text-[11px] text-text-2"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-border-strong" />Baseline</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-brand" />Adjusted</span></p>
        <table className="mt-3 w-full text-xs"><tbody>{rows.map(r => { const dv = r.f - r.b; return (
          <tr key={r.y} className="border-t border-border"><td className="py-1.5 text-text-2">{r.y}</td><td className="py-1.5 text-right font-mono">{money(r.f)}</td><td className={cx('w-16 py-1.5 text-right font-mono', Math.abs(dv) < 0.05 ? 'text-text-3' : dv > 0 ? 'text-ok' : 'text-err')}>{Math.abs(dv) < 0.05 ? '–' : signed(dv)}</td></tr>) })}</tbody></table>
      </section>
      <section className="rounded-2xl border border-border bg-surface shadow-card p-4">
        <p className="text-xs font-semibold">Latest changes</p>
        {log.length ? <ul className="mt-2 space-y-1.5 text-xs text-text-2">{log.slice(0, 4).map((l, i) => <li key={i} className="break-words">{l}</li>)}</ul> : <p className="mt-1 text-xs text-text-3">Type in a bordered cell. The impact shows here and in every chart.</p>}
      </section>
    </aside>
  )
}

/** Driver grids for the drivers the assigned model's modules use. Bordered cells are editable. */
export function DriverInputs({ ctx, id, groups, setOne, applyMany, readOnly }: { ctx: Ctx; id: string; groups: DriverGroup[]; setOne: SetOne; applyMany: ApplyMany; readOnly?: boolean }) {
  const [bulk, setBulk] = useState<Record<string, string>>({})
  const base = { ...ctx, ov: {} }
  const hasOv = (dr: Driver) => Object.keys(ctx.ov[id]?.[dr.id] ?? {}).length > 0
  return (
    <div className="space-y-6">
      {GROUPS.filter(g => groups.includes(g)).map(g => (
        <section key={g} aria-labelledby={`grp-${g}`}>
          <h2 id={`grp-${g}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">{g}</h2>
          <div className="space-y-4">
            {DRIVERS.filter(x => x.group === g).map(d => (
              <Panel key={d.id} title={d.label} sub={DRIVER_SRC[d.group]}
                right={!readOnly && <>
                  <label className="flex items-center gap-1.5 text-xs text-text-2">Shift FY26–30 by<Num label={`Shift ${d.label} by percent`} w="w-16" step={0.5} value={bulk[d.id] === undefined || bulk[d.id] === '' ? '' : Number(bulk[d.id])} onChange={v => setBulk(b => ({ ...b, [d.id]: v === null ? '' : String(v) }))} />%</label>
                  <button type="button" disabled={!bulk[d.id]} onClick={() => { applyMany(FYS.map(y => ({ d, y, v: scnBase(ctx, id, d, y) * (1 + Number(bulk[d.id]) / 100) })), `${d.label}: ${bulk[d.id]}% applied to FY26–30`); setBulk(b => ({ ...b, [d.id]: '' })) }} className="h-8 rounded-md border border-border-strong px-3 text-xs font-medium hover:border-brand hover:text-brand disabled:opacity-40">Apply</button>
                  <button type="button" disabled={!hasOv(d)} onClick={() => FYS.forEach(y => setOne(d, y, null))} className="h-8 rounded-md px-2 text-xs font-medium text-text-2 hover:text-err disabled:opacity-40">Clear</button></>}>
                <div className="-mx-5 -my-5 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead><tr className="text-xs text-text-3"><th className="w-44 px-5 py-2 text-left font-medium" />{FYS.map(y => <th key={y} className="px-1.5 py-2 text-right font-medium">{y}</th>)}<th className="w-3" /></tr></thead>
                    <tbody>
                      <tr className="border-t border-border text-text-2"><td className="px-5 py-2 font-medium"><Lock size={11} className="mr-1.5 inline text-text-3" />Model default</td>{FYS.map(y => <td key={y} className="px-1.5 py-2 text-right font-mono text-xs">{d.fmt(scnBase(ctx, id, d, y))}</td>)}<td /></tr>
                      <tr className="border-t border-border"><td className="px-5 py-2 font-semibold text-brand">Your input</td>{FYS.map(y => <td key={y} className="px-1 py-1.5 text-right">{readOnly ? <span className="font-mono text-xs text-text-3">–</span> : <Num label={`${d.label} ${y} input`} tone="ovr" w="w-[84px]" step={d.step} value={ctx.ov[id]?.[d.id]?.[y] ?? ''} onChange={v => setOne(d, y, v)} />}</td>)}<td /></tr>
                      <tr className="border-t border-border bg-surface-2/50"><td className="px-5 py-2 font-semibold">Value used</td>{FYS.map(y => { const o = ctx.ov[id]?.[d.id]?.[y] !== undefined; return <td key={y} className={cx('px-1.5 py-2 text-right font-mono text-xs font-semibold', o && 'text-warn')}>{d.fmt(finalVal(ctx, id, d, y))}</td> })}<td /></tr>
                      <tr className="border-t border-border bg-surface-2/50"><td className="px-5 py-2 text-xs text-text-2">Net revenue impact</td>{FYS.map(y => { const dv = rev(ctx, id, y) - rev(base, id, y); return <td key={y} className={cx('px-1.5 py-2 text-right font-mono text-xs', Math.abs(dv) < 0.05 ? 'text-text-3' : dv > 0 ? 'font-semibold text-ok' : 'font-semibold text-err')}>{Math.abs(dv) < 0.05 ? '–' : `${signed(dv)}M`}</td> })}<td /></tr>
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function InputsTab(p: Sub & { setOne: SetOne; applyMany: ApplyMany; cur: number; trendTotal: number; log: string[]; readOnly: boolean }) {
  const { ctx, scenarioId: id } = p
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-surface shadow-card px-4 py-3 text-xs text-text-2">
          <span className="inline-flex items-center gap-1.5"><i className="h-3 w-4 rounded-sm border border-brand/60 bg-surface" />Your input</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-3 w-4 rounded-sm border border-warn bg-warn-soft" />Changed</span>
          <span className="inline-flex items-center gap-1.5"><Lock size={11} />Model default</span>
          {p.moduleInputs && <button type="button" onClick={p.onEvents} className="ml-auto inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">{p.moduleInputs}<ChevronRight size={12} /></button>}
        </div>
        {p.readOnly && <p className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-2"><Lock size={13} className="mr-1.5 inline" />Trended Statistical is the read-only baseline. <button type="button" onClick={() => p.onNew(id)} className="font-semibold text-brand hover:underline">Create a new scenario from it</button> to make changes.</p>}
        <DriverInputs ctx={ctx} id={id} groups={p.groups} setOne={p.setOne} applyMany={p.applyMany} readOnly={p.readOnly} />
        {p.inputsExtra && !p.readOnly && <div className="border-t border-border pt-6">{p.inputsExtra}</div>}
      </div>
      <ImpactRail ctx={ctx} id={id} cur={p.cur} trendTotal={p.trendTotal} log={p.log} />
    </div>
  )
}

function OutputsTab(p: Sub & { cur: number; trendTotal: number; overrideCount: number }) {
  const { ctx, scenarioId: id } = p
  const base = { ...ctx, ov: {} }
  const dTot = p.cur - p.trendTotal
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="FY26–30 net revenue" value={money(p.cur)} note="Adjusted forecast" />
        <Kpi label="Baseline" value={money(p.trendTotal)} note="Before your overrides" />
        <Kpi label="Impact of your changes" value={`${signed(dTot)}M`} note={`${signed(p.trendTotal ? (p.cur / p.trendTotal - 1) * 100 : 0, 2)}%`} tone={dTot > 0.05 ? 'ok' : dTot < -0.05 ? 'err' : undefined} />
        <Kpi label="Overrides" value={String(p.overrideCount)} note={`${p.eventsOn} events on`} />
      </div>
      <SummaryChart title="Net revenue forecast" ctx={ctx} id={id} seasonal={p.seasonal} startM={p.startM} pin={p.pin} />
      <Panel title="Forecast result by year" sub="Net revenue calculated by the model from this scenario’s assumptions and inputs">
        <div className="-mx-5 -my-5 overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
          <thead><tr className="text-xs text-text-3"><th className="px-5 py-2 text-left font-medium" />{FYS.map(y => <th key={y} className="px-2 py-2 text-right font-medium">{y}</th>)}<th className="px-5 py-2 text-right font-medium">FY26–30</th></tr></thead>
          <tbody>
            <tr className="border-t border-border text-text-2"><td className="px-5 py-2"><Lock size={11} className="mr-1.5 inline text-text-3" />Baseline net revenue</td>{FYS.map(y => <td key={y} className="px-2 py-2 text-right font-mono">{money(rev(base, id, y))}</td>)}<td className="px-5 py-2 text-right font-mono">{money(p.trendTotal)}</td></tr>
            <tr className="border-t border-border font-semibold"><td className="px-5 py-2">Adjusted net revenue</td>{FYS.map(y => <td key={y} className="px-2 py-2 text-right font-mono">{money(rev(ctx, id, y))}</td>)}<td className="px-5 py-2 text-right font-mono">{money(p.cur)}</td></tr>
            <tr className="border-t border-border bg-surface-2/50"><td className="px-5 py-2 text-xs text-text-2">Δ vs baseline</td>{FYS.map(y => { const dv = rev(ctx, id, y) - rev(base, id, y); return <td key={y} className={cx('px-2 py-2 text-right font-mono text-xs', Math.abs(dv) < 0.05 ? 'text-text-3' : dv > 0 ? 'text-ok' : 'text-err')}>{Math.abs(dv) < 0.05 ? '–' : `${signed(dv)}M`}</td> })}<td className={cx('px-5 py-2 text-right font-mono text-xs font-semibold', Math.abs(dTot) < 0.05 ? 'text-text-3' : dTot > 0 ? 'text-ok' : 'text-err')}>{Math.abs(dTot) < 0.05 ? '–' : `${signed(dTot)}M`}</td></tr>
          </tbody></table></div>
      </Panel>
    </div>
  )
}

function ReviewTab(p: WorkspaceProps & { cur: number; trendTotal: number; overrideCount: number; setOne: SetOne }) {
  const { ctx, scenarioId: id } = p
  const rows = DRIVERS.flatMap(d => Object.entries(ctx.ov[id]?.[d.id] ?? {}).map(([ys, v]) => {
    const y = Number(ys), b = scnBase(ctx, id, d, y), pct = (v / b - 1) * 100
    return { d, y, b, v, pct, imp: rev(ctx, id, y) * (1 - b / v) }
  })).sort((a, b) => a.y - b.y)
  const big = rows.filter(r => Math.abs(r.pct) > 10)
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="FY26–30 net revenue" value={money(p.cur)} note="With your overrides" />
        <Kpi label="Scenario baseline" value={money(p.trendTotal)} note="No overrides" />
        <Kpi label="Impact of overrides" value={`${signed(p.cur - p.trendTotal)}M`} note={`${signed(p.trendTotal ? (p.cur / p.trendTotal - 1) * 100 : 0, 2)}%`} />
        <Kpi label="Overrides" value={String(p.overrideCount)} note={`${p.eventsOn} events on`} />
      </div>
      <Panel title="Overrides to review" sub="Every driver value you changed, against the scenario baseline" right={<PinBtn onClick={() => p.pin(`${id}: overrides`, `${rows.length} overrides, net ${signed(p.cur - p.trendTotal)}M vs baseline.`)} />}>
        {rows.length === 0 ? <p className="py-6 text-center text-sm text-text-2">No overrides yet. Add some in Inputs, or run Goal Seek in Analysis Tools.</p> : (
          <table className="w-full text-sm"><thead className="text-left text-xs text-text-3"><tr><th className="pb-2 font-medium">Driver</th><th className="pb-2 font-medium">Year</th><th className="pb-2 text-right font-medium">Baseline</th><th className="pb-2 text-right font-medium">Override</th><th className="pb-2 text-right font-medium">Change</th><th className="pb-2 text-right font-medium">Revenue impact</th><th className="pb-2" /></tr></thead>
            <tbody>{rows.map(r => <tr key={r.d.id + r.y} className="border-t border-border"><td className="py-2 font-medium">{r.d.label}</td><td className="py-2">{r.y}</td><td className="py-2 text-right font-mono text-text-2">{r.d.fmt(r.b)}</td><td className="py-2 text-right font-mono">{r.d.fmt(r.v)}</td>
              <td className={cx('py-2 text-right font-mono', Math.abs(r.pct) > 10 ? 'font-semibold text-warn' : r.pct >= 0 ? 'text-ok' : 'text-err')}>{signed(r.pct)}%</td><td className="py-2 text-right font-mono">{signed(r.imp)}M</td>
              <td className="py-2 text-right"><button type="button" onClick={() => p.setOne(r.d, r.y, null)} aria-label="Remove override" className="text-text-3 hover:text-err"><X size={14} /></button></td></tr>)}</tbody></table>
        )}
      </Panel>
      <Panel title="Checks before submitting">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><Pill tone={big.length ? 'warn' : 'ok'}>{big.length ? 'Review' : 'OK'}</Pill>{big.length ? `${big.length} override${big.length > 1 ? 's' : ''} move a driver by more than 10% — add a rationale.` : 'No override moves a driver by more than 10%.'}</li>
          <li className="flex items-center gap-2"><Pill tone="ok">OK</Pill>Actuals through Jul 2026 are locked and not editable.</li>
        </ul>
      </Panel>
    </div>
  )
}

function GoalSeek(p: Sub & { applyMany: ApplyMany }) {
  const { ctx, scenarioId: id } = p
  const [targets, setTargets] = useState<Record<number, number>>({})
  const [prio, setPrio] = useState(['bshare', 'jak', 'pat', 'price', 'rx', 'compl', 'pills'])
  const [lim, setLim] = useState<Record<string, number>>(Object.fromEntries(DRIVERS.map(d => [d.id, 5])))
  const [res, setRes] = useState<{ ach: Record<number, number>; ch: { d: Driver; y: number; v: number }[] } | null>(null)
  const move = (i: number, dir: -1 | 1) => setPrio(pr => { const n = [...pr], j = i + dir; if (j < 0 || j >= n.length) return pr; [n[i], n[j]] = [n[j]!, n[i]!]; return n })
  const run = () => {
    const ach: Record<number, number> = {}, ch: { d: Driver; y: number; v: number }[] = []
    for (const y of FYS) {
      const t = targets[y]; const c = rev(ctx, id, y)
      if (!t) continue
      let rem = t / c
      for (const did of prio) {
        const d = DRIVERS.find(x => x.id === did)!, l = (lim[did] ?? 0) / 100
        const s = Math.min(1 + l, Math.max(1 - l, rem))
        if (Math.abs(s - 1) > 1e-6) ch.push({ d, y, v: finalVal(ctx, id, d, y) * s })
        rem /= s
      }
      ach[y] = c * (t / c) / rem
    }
    setRes({ ach, ch })
    p.notify({ tone: 'info', text: Object.keys(ach).length ? 'Goal seek complete — review the proposal, then update forecast assumptions.' : 'Enter at least one target revenue first.' })
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={run} className="h-9 rounded-md border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-soft">Run Goal Seek</button>
        <button type="button" disabled={!res || res.ch.length === 0} onClick={() => { p.applyMany(res!.ch, `Goal seek proposal applied (${res!.ch.length} changes)`); p.notify({ tone: 'ok', text: 'Forecast assumptions updated from goal seek.' }); setRes(null) }} className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40">Update Forecast Assumption</button>
      </div>
      <SummaryChart ctx={ctx} id={id} seasonal={p.seasonal} startM={p.startM} pin={p.pin} compact extra={res && Object.keys(res.ach).length ? [{ name: 'Target', tone: 'dark', dash: true, pts: ALL_YEARS.map(y => targets[y] ?? rev(ctx, id, y)) }, { name: 'Revenue achieved', tone: 'ok', pts: ALL_YEARS.map(y => res.ach[y] ?? rev(ctx, id, y)) }] : undefined} />
      <Panel title="Revenue targets" right={<PinBtn onClick={() => p.pin(`${id}: goal seek`, FYS.filter(y => targets[y]).map(y => `${y} target ${money(targets[y]!)}`).join(' · ') || 'No targets set')} />}>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="text-xs text-text-3"><th className="w-52 py-2 text-left font-medium" />{FYS.map(y => <th key={y} className="px-2 py-2 text-right font-medium">{y}</th>)}</tr></thead>
          <tbody>
            <tr className="border-t border-border"><td className="py-2 font-medium">{id}</td>{FYS.map(y => <td key={y} className="px-2 py-2 text-right font-mono">{money(rev(ctx, id, y))}</td>)}</tr>
            <tr className="border-t border-border"><td className="py-2 font-medium">Target Revenues ($M)</td>{FYS.map(y => <td key={y} className="px-2 py-1.5 text-right"><Num tone="ovr" step={1} w="w-24" value={targets[y] ?? ''} onChange={v => setTargets(t => { const n = { ...t }; if (v === null) delete n[y]; else n[y] = v; return n })} /></td>)}</tr>
            <tr className="border-t border-border"><td className="py-2 font-medium">Revenue Achieved From Goal Seek</td>{FYS.map(y => <td key={y} className="px-2 py-2 text-right font-mono">{res?.ach[y] ? money(res.ach[y]!) : '–'}</td>)}</tr>
            <tr className="border-t border-border"><td className="py-2 font-medium">% Difference (Target &amp; Achieved)</td>{FYS.map(y => { const a = res?.ach[y], t = targets[y]; const dpct = a && t ? (a / t - 1) * 100 : null; return <td key={y} className={cx('px-2 py-2 text-right font-mono', dpct !== null && Math.abs(dpct) > 0.05 && 'text-warn')}>{dpct === null ? '–' : `${signed(dpct, 2)}%`}</td> })}</tr>
          </tbody></table></div>
        {res && Object.keys(res.ach).some(y => Math.abs(res.ach[Number(y)]! / targets[Number(y)]! - 1) > 0.0005) && <p className="mt-3 text-xs text-warn">Some targets can't be reached within the limits below. Widen a limit or reorder priority.</p>}
      </Panel>
      <Panel title="Metric priority and limits" sub="Goal seek moves the first metric up to its limit, then the next. Reorder to change the order.">
        <ol className="space-y-1.5">{prio.map((did, i) => { const d = DRIVERS.find(x => x.id === did)!; return (
          <li key={did} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"><span className="w-5 font-mono text-xs text-text-3">{i + 1}</span><span className="flex-1 font-medium">{d.label}</span>
            <label className="flex items-center gap-1.5 text-xs text-text-2">Max change ±<Num w="w-16" step={1} value={lim[did] ?? 0} onChange={v => setLim(l => ({ ...l, [did]: Math.max(0, v ?? 0) }))} />%</label>
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-2 disabled:opacity-30"><ArrowUp size={14} /></button>
            <button type="button" aria-label="Move down" disabled={i === prio.length - 1} onClick={() => move(i, 1)} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-2 disabled:opacity-30"><ArrowDown size={14} /></button></li>) })}</ol>
      </Panel>
      {res && res.ch.length > 0 && (
        <Panel title="Proposed assumption changes" sub={`${res.ch.length} driver-year changes`}>
          <div className="max-h-56 overflow-auto"><table className="w-full text-sm"><tbody>{res.ch.map(c => <tr key={c.d.id + c.y} className="border-t border-border first:border-0"><td className="py-1.5 font-medium">{c.d.label}</td><td className="py-1.5">{c.y}</td><td className="py-1.5 text-right font-mono text-text-2">{c.d.fmt(finalVal(ctx, id, c.d, c.y))}</td><td className="py-1.5 text-center text-text-3">→</td><td className="py-1.5 text-right font-mono font-semibold">{c.d.fmt(c.v)}</td></tr>)}</tbody></table></div>
        </Panel>
      )}
    </div>
  )
}

function NeedToMeet(p: WorkspaceProps & { applyMany: ApplyMany }) {
  const { ctx, scenarioId: id } = p
  const [year, setYear] = useState(2026)
  const c = rev(ctx, id, year)
  const [t, setT] = useState<number | null>(null)
  const target = t ?? Math.round(c * 1.03)
  const r = target / c
  const tone = (pct: number) => Math.abs(pct) <= 5 ? 'ok' : Math.abs(pct) <= 15 ? 'warn' : 'err'
  return (
    <div className="space-y-5">
      <Panel title="What would it take?" sub="For each driver on its own: the value required to land the target revenue.">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-text-2">Year<span className="mt-1 block"><Select label="Year" value={String(year)} options={FYS.map(String)} onChange={v => { setYear(Number(v)); setT(null) }} /></span></label>
          <div className="text-xs text-text-2">Current<span className="mt-1 block font-mono text-lg font-semibold text-text">{money(c)}</span></div>
          <label className="text-xs text-text-2">Target ($M)<span className="mt-1 block"><Num tone="ovr" step={1} w="w-28" value={target} onChange={v => setT(v)} /></span></label>
          <div className="text-xs text-text-2">Gap<span className={cx('mt-1 block font-mono text-lg font-semibold', r >= 1 ? 'text-warn' : 'text-ok')}>{signed(target - c)}M ({signed((r - 1) * 100)}%)</span></div>
          <PinBtn onClick={() => p.pin(`${id}: need to meet ${money(target)} in ${year}`, `Gap ${signed(target - c)}M. Brand share would need ${DRIVERS[2]!.fmt(finalVal(ctx, id, DRIVERS[2]!, year) * r)} on its own.`)} />
        </div>
      </Panel>
      <Panel title="Required driver values">
        <table className="w-full text-sm"><thead className="text-left text-xs text-text-3"><tr><th className="pb-2 font-medium">Driver</th><th className="pb-2 text-right font-medium">Current</th><th className="pb-2 text-right font-medium">Needed alone</th><th className="pb-2 text-right font-medium">Change</th><th className="pb-2 font-medium pl-4">Plausibility</th><th className="pb-2" /></tr></thead>
          <tbody>{DRIVERS.map(d => { const cv = finalVal(ctx, id, d, year), need = cv * r, pct = (r - 1) * 100, tn = tone(pct); return (
            <tr key={d.id} className="border-t border-border"><td className="py-2 font-medium">{d.label}</td><td className="py-2 text-right font-mono text-text-2">{d.fmt(cv)}</td><td className="py-2 text-right font-mono font-semibold">{d.fmt(need)}</td><td className="py-2 text-right font-mono">{signed(pct)}%</td>
              <td className="py-2 pl-4"><Pill tone={tn}>{tn === 'ok' ? 'Within trend' : tn === 'warn' ? 'Stretch' : 'Unlikely'}</Pill></td>
              <td className="py-2 text-right"><button type="button" onClick={() => { p.applyMany([{ d, y: year, v: need }], `Need-to-meet: ${d.label} ${year} → ${d.fmt(need)}`); p.notify({ tone: 'ok', text: `${d.label} ${year} set to ${d.fmt(need)} as an override.` }) }} className="h-7 rounded border border-border-strong px-2 text-xs font-medium hover:border-brand hover:text-brand">Apply</button></td></tr>) })}</tbody></table>
      </Panel>
    </div>
  )
}


type Cfg = { mode: 'Absolute Difference' | 'Relative Difference' | 'Custom Limit'; lo: number; hi: number }
function Sensitivity(p: WorkspaceProps) {
  const { ctx, scenarioId: id } = p
  const [cfg, setCfg] = useState<Record<string, Cfg>>({})
  const cfgOf = (d: Driver): Cfg => cfg[d.id] ?? { mode: 'Relative Difference', lo: -1, hi: 1 }
  const lim = (d: Driver, c: Cfg, y: number, side: 'lo' | 'hi') => {
    const v = finalVal(ctx, id, d, y)
    return c.mode === 'Relative Difference' ? v * (1 + c[side] / 100) : c.mode === 'Absolute Difference' ? v + c[side] : c[side]
  }
  const calc = (d: Driver, c: Cfg) => ({ lo: totalWith(ctx, id, d, (y) => lim(d, c, y, 'lo')), hi: totalWith(ctx, id, d, (y) => lim(d, c, y, 'hi')) })
  const centre = total(ctx, id)
  const res = DRIVERS.map(d => ({ d, c: cfgOf(d), ...calc(d, cfgOf(d)) }))
  const m = Math.max(1e-9, ...res.flatMap(r => [Math.abs(r.lo - centre), Math.abs(r.hi - centre)]))
  const setMode = (d: Driver, v: string) => setCfg(x => ({ ...x, [d.id]: v === 'Custom Limit' ? { mode: 'Custom Limit', lo: +(finalVal(ctx, id, d, 2026) * 0.99).toFixed(2), hi: +(finalVal(ctx, id, d, 2026) * 1.01).toFixed(2) } : { mode: v as Cfg['mode'], lo: v === 'Absolute Difference' ? -d.step * 10 : -1, hi: v === 'Absolute Difference' ? d.step * 10 : 1 } }))
  return (
    <Panel title="Sensitivity" sub={`FY26–30 net revenue range when one driver moves between its limits. Centre ${money(centre)}. Results update as you type.`}
      right={<PinBtn onClick={() => p.pin(`${id}: sensitivity`, res.map(r => `${r.d.label} ${money(r.lo)}–${money(r.hi)}`).join(' · '), { kind: 'bar', labels: res.map(r => r.d.label), series: [{ name: 'Low case', pts: res.map(r => r.lo), tone: 'err' }, { name: 'High case', pts: res.map(r => r.hi), tone: 'ok' }] })} />}>
      <div className="-mx-5 -my-5 overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead><tr className="text-left text-xs text-text-3"><th className="px-5 py-2 font-medium">Driver</th><th className="px-2 py-2 font-medium">Limit type</th><th className="px-2 py-2 text-right font-medium">Lower</th><th className="px-2 py-2 text-right font-medium">Upper</th><th className="px-2 py-2 text-right font-medium">Low case</th><th className="px-3 py-2 text-center font-medium">Swing</th><th className="px-5 py-2 text-right font-medium">High case</th></tr></thead>
          <tbody>{res.sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo)).map(({ d, c, lo, hi }) => {
            const dl = lo - centre, dh = hi - centre, unit = c.mode === 'Relative Difference' ? '%' : ''
            return (
              <tr key={d.id} className="border-t border-border">
                <td className="px-5 py-2 font-medium">{d.label}</td>
                <td className="px-2 py-2"><Select label={`${d.label} limit type`} value={c.mode} options={['Relative Difference', 'Absolute Difference', 'Custom Limit']} onChange={v => setMode(d, v)} /></td>
                <td className="px-2 py-2 text-right"><span className="inline-flex items-center gap-1"><Num label={`${d.label} lower limit`} tone="ovr" w="w-20" step={d.step} value={c.lo} onChange={v => setCfg(x => ({ ...x, [d.id]: { ...c, lo: v ?? 0 } }))} /><span className="w-3 text-xs text-text-3">{unit}</span></span></td>
                <td className="px-2 py-2 text-right"><span className="inline-flex items-center gap-1"><Num label={`${d.label} upper limit`} tone="ovr" w="w-20" step={d.step} value={c.hi} onChange={v => setCfg(x => ({ ...x, [d.id]: { ...c, hi: v ?? 0 } }))} /><span className="w-3 text-xs text-text-3">{unit}</span></span></td>
                <td className="px-2 py-2 text-right font-mono text-xs font-semibold text-err">{money(lo)}<span className="block font-normal text-text-3">{signed(dl)}M</span></td>
                <td className="px-3 py-2"><div className="flex h-3 w-40 overflow-hidden rounded-sm bg-surface-2"><div className="flex w-1/2 justify-end"><i className="h-full bg-err/70" style={{ width: `${Math.min(100, Math.abs(Math.min(dl, dh, 0)) / m * 100)}%` }} /></div><div className="flex w-1/2"><i className="h-full bg-ok/80" style={{ width: `${Math.min(100, Math.max(dl, dh, 0) / m * 100)}%` }} /></div></div></td>
                <td className="px-5 py-2 text-right font-mono text-xs font-semibold text-ok">{money(hi)}<span className="block font-normal text-text-3">{signed(dh)}M</span></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </Panel>
  )
}

function CompareTab(p: Sub) {
  const { ctx, scenarioId: id } = p
  const ids = ctx.scns.map(s => s.id)
  const [a, setA] = useState(id)
  const [b, setB] = useState(ids.find(x => x !== id) ?? id)
  const [gran, setGran] = useState<Gran>('Yearly')
  const A = buildPoints(ctx, a, ALL_YEARS, gran, p.seasonal), B = buildPoints(ctx, b, ALL_YEARS, gran, p.seasonal)
  const ta = total(ctx, a), tb = total(ctx, b), dv = ta - tb
  const assum = p.diff(a, b)
  const drivers = DRIVERS.flatMap(d => FYS.map(y => ({ d, y, va: finalVal(ctx, a, d, y), vb: finalVal(ctx, b, d, y) }))).filter(x => Math.abs(x.va - x.vb) > x.d.step / 2)
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-4 rounded-2xl border border-border bg-surface shadow-card p-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-text-2">Scenario A<span className="mt-1 block"><Select label="Scenario A" value={a} options={ids} onChange={setA} /></span></label>
        <label className="text-xs font-medium text-text-2">Scenario B<span className="mt-1 block"><Select label="Scenario B" value={b} options={ids} onChange={setB} /></span></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label={`Scenario A · ${a}`} value={money(ta)} note="FY26–30 net revenue" />
        <Kpi label={`Scenario B · ${b}`} value={money(tb)} note="FY26–30 net revenue" />
        <Kpi label="Variance (A − B)" value={`${signed(dv)}M`} note={`${signed(tb ? (ta / tb - 1) * 100 : 0, 2)}%`} tone={dv > 0.05 ? 'ok' : dv < -0.05 ? 'err' : undefined} />
      </div>
      <Panel title={`Net revenue: Scenario A vs Scenario B`} sub={`${a} (solid) against ${b} (dashed) · actuals shaded`} right={<><Seg label="Granularity" value={gran} options={['Quarterly', 'Yearly'] as const} onChange={setGran} /><PinBtn onClick={() => p.pin(`${a} vs ${b}`, `FY26–30 net ${money(ta)} vs ${money(tb)} (${signed(dv)}M).`, { kind: 'line', labels: A.labels, series: [{ name: b, pts: B.pts, tone: 'muted' }, { name: a, pts: A.pts, tone: 'brand' }] })} /></>}>
        <Chart labels={A.labels} series={[{ name: `B · ${b}`, pts: B.pts, tone: 'muted', dash: true }, { name: `A · ${a}`, pts: A.pts, tone: 'brand' }]} hist={histCount(ALL_YEARS, gran, p.startM)} />
      </Panel>
      <Panel title="Forecast result by year" sub="Net revenue for each scenario and the variance between them">
        <div className="-mx-5 -my-5 overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="text-xs text-text-3"><tr><th className="px-5 py-2 text-left font-medium" />{FYS.map(y => <th key={y} className="px-2 py-2 text-right font-medium">{y}</th>)}<th className="px-5 py-2 text-right font-medium">FY26–30</th></tr></thead>
          <tbody>
            <tr className="border-t border-border"><td className="px-5 py-2 font-medium">A · {a}</td>{FYS.map(y => <td key={y} className="px-2 py-2 text-right font-mono">{money(rev(ctx, a, y))}</td>)}<td className="px-5 py-2 text-right font-mono font-semibold">{money(ta)}</td></tr>
            <tr className="border-t border-border"><td className="px-5 py-2 font-medium">B · {b}</td>{FYS.map(y => <td key={y} className="px-2 py-2 text-right font-mono">{money(rev(ctx, b, y))}</td>)}<td className="px-5 py-2 text-right font-mono font-semibold">{money(tb)}</td></tr>
            <tr className="border-t border-border bg-surface-2/50"><td className="px-5 py-2 text-xs font-semibold">Variance (A − B)</td>{FYS.map(y => { const v = rev(ctx, a, y) - rev(ctx, b, y); return <td key={y} className={cx('px-2 py-2 text-right font-mono text-xs', Math.abs(v) < 0.05 ? 'text-text-3' : v > 0 ? 'text-ok' : 'text-err')}>{Math.abs(v) < 0.05 ? '–' : `${signed(v)}M`}</td> })}<td className={cx('px-5 py-2 text-right font-mono text-xs font-semibold', Math.abs(dv) < 0.05 ? 'text-text-3' : dv > 0 ? 'text-ok' : 'text-err')}>{Math.abs(dv) < 0.05 ? '–' : `${signed(dv)}M`}</td></tr>
          </tbody></table></div>
      </Panel>
      <Panel title="What is different" sub="Assumptions and inputs that differ between Scenario A and Scenario B">
        {assum.length === 0 && drivers.length === 0 ? <p className="py-3 text-center text-sm text-text-2">{a === b ? 'Pick two different scenarios.' : 'These scenarios use the same assumptions and inputs.'}</p> : (
          <div className="-mx-5 -my-5 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-text-3"><tr><th className="px-5 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 text-right font-medium">A · {a}</th><th className="px-5 py-2 text-right font-medium">B · {b}</th></tr></thead>
            <tbody>
              {assum.map(x => <tr key={x.label} className="border-t border-border"><td className="px-5 py-2"><Pill tone="brand">Assumption</Pill></td><td className="px-3 py-2 font-medium">{x.label}</td><td className="px-3 py-2 text-right font-mono text-xs">{x.a}</td><td className="px-5 py-2 text-right font-mono text-xs">{x.b}</td></tr>)}
              {drivers.map(x => <tr key={x.d.id + x.y} className="border-t border-border"><td className="px-5 py-2"><Pill>Input</Pill></td><td className="px-3 py-2 font-medium">{x.d.label} <span className="text-text-3">{x.y}</span></td><td className="px-3 py-2 text-right font-mono text-xs">{x.d.fmt(x.va)}</td><td className="px-5 py-2 text-right font-mono text-xs">{x.d.fmt(x.vb)}</td></tr>)}
            </tbody></table></div>
        )}
      </Panel>
    </div>
  )
}

export { rev as scnRev, total as scnTotal }
export const useCtx = (trend: number, scns: Scn[], ov: Overrides): Ctx => useMemo(() => ({ trend, scns, ov }), [trend, scns, ov])



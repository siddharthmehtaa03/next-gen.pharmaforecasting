import { PeakCurve } from './Extras'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { FY, GTN, POP, fyAvg, fySum } from './engine'
import type { Scenario } from './engine'
import { Btn, COLOR, Card, Seg, Tag, Toggle, cx, field } from './ui'
import type { Calc } from './Stages'
import type { Notify } from './Drivers'

/*
 * LRF · Long-Range Forecast (CR: LRF tab). Annual, 10 planning years on the same patient funnel as Assumptions.
 * Year 1 (FY2027) is the scenario's monthly forecast; FY2028 onwards grows each metric at its YoY %G (held constant by default,
 * or set per year). Events dated in Years 2-10 are layered on the trend: the carryover guard applies only the gap over trend,
 * and persistence (re-base, overlay, transient) decides what happens after the step. Net revenue is always computed.
 */

export type LrfMetric = 'prev' | 'diag' | 'treat' | 'access' | 'share' | 'price'
export type Persist = 'rebase' | 'overlay' | 'transient'
export type LrfEvent = { id: string; name: string; metric: LrfMetric; mech: 'list' | 'gtn'; year: number; headline: number; prob: number; persist: Persist; on: boolean }
export type LrfPlan = { mode: 'const' | 'peryear'; g: Record<LrfMetric, number>; gy: Record<LrfMetric, Record<number, number>>; ev: LrfEvent[]; gyEdited?: boolean }
export type LrfState = Record<string, LrfPlan>
export type LrfBase = Record<LrfMetric, number> & { net: number }

const BRAND = 'Nurtec'
const YEARS_L = Array.from({ length: 10 }, (_, i) => FY + i)
const Y_LATE = YEARS_L.slice(3)
const METRICS: { id: LrfMetric; label: string; pct: boolean }[] = [
  { id: 'prev', label: 'Prevalent patients', pct: false },
  { id: 'diag', label: 'Diagnosis rate', pct: true },
  { id: 'treat', label: 'Treatment rate', pct: true },
  { id: 'access', label: 'Access / coverage', pct: true },
  { id: 'share', label: 'Brand share', pct: true },
  { id: 'price', label: 'Net price ($/Rx)', pct: false },
]
const MET = Object.fromEntries(METRICS.map(m => [m.id, m])) as Record<LrfMetric, (typeof METRICS)[number]>
const LRF_G: Record<LrfMetric, number> = { prev: 1, diag: 0, treat: 0, access: 0, share: 3, price: 3 }
const STAGES = ['Prevalent patients', 'Diagnosed', 'Treated', 'Covered', `On brand (${BRAND})`]
const RAMP = ['#0000c9', '#3535d3', '#6767de', '#9494e8', '#c0c0f2']
const TAPER = [100, 72, 50, 44, 30]
const PERSIST: Record<Persist, { label: string; desc: string }> = {
  rebase: { label: 'Re-base', desc: 'Sets a new level; the growth rate compounds on the new level afterward. For structural changes: new indication, formulary win, price reset.' },
  overlay: { label: 'Overlay', desc: 'A persistent uplift on the trend; growth keeps running on the original base underneath, so the uplift stays at its event-year size. For a percentage action on top of business-as-usual.' },
  transient: { label: 'Transient', desc: 'Bumps a single year, then reverts to trend. Must be chosen on purpose: most planning events persist.' },
}

/* ── Model ── */
const cl = (m: LrfMetric, v: number) => MET[m].pct ? Math.max(0, Math.min(100, v)) : Math.max(0, v)
const mkPlan = (g: Partial<Record<LrfMetric, number>> = {}, ev: LrfEvent[] = []): LrfPlan => {
  const gg = { ...LRF_G, ...g }
  return { mode: 'const', g: gg, gy: Object.fromEntries(METRICS.map(m => [m.id, Object.fromEntries(YEARS_L.slice(1).map(y => [y, gg[m.id]]))])) as LrfPlan['gy'], ev }
}
const SEED_EVENT: LrfEvent = { id: 'lev1', name: 'October 2030 WAC action', metric: 'price', mech: 'list', year: 2031, headline: 6, prob: 60, persist: 'rebase', on: true }
export const LRF_SEED = (scenarios: Scenario[]): LrfState => Object.fromEntries(scenarios.map(s => [s.id,
  s.id === 'sc3' ? mkPlan({ share: 4.5 }) : s.id === 'sc4' ? mkPlan({ share: 1.5 }) : s.id === 'sc2' ? mkPlan({}, [{ ...SEED_EVENT }]) : mkPlan()]))
export const lrfPlanFor = (st: LrfState, id: string): LrfPlan => st[id] ?? mkPlan()

/** Year-1 values from the scenario's monthly forecast: rates are FY averages, net price is gross × (1 − GtN), net revenue is the FY sum. */
export function lrfBase(calc: Calc, id: string): LrfBase {
  const c = calc[id] ?? calc.__working ?? Object.values(calc)[0]!
  const l = c.layer
  return { prev: POP, diag: fyAvg(l.diag, FY), treat: fyAvg(l.treat, FY), access: fyAvg(l.access, FY), share: fyAvg(l.share, FY), price: fyAvg(l.price, FY) * (1 - GTN), net: fySum(c.rev, FY) }
}

export type LrfPaths = { rate: Record<LrfMetric, number[]>; base: Record<LrfMetric, number[]>; val: Record<LrfMetric, number[]>; net: number[]; netBase: number[] }
export function lrfPaths(base: LrfBase, plan: LrfPlan): LrfPaths {
  const n = YEARS_L.length
  const rate = {} as LrfPaths['rate'], B = {} as LrfPaths['base'], val = {} as LrfPaths['val']
  for (const { id } of METRICS) {
    const r = Array.from({ length: n }, (_, i) => i === 0 ? 0 : plan.mode === 'peryear' ? (plan.gy[id]?.[YEARS_L[i]!] ?? plan.g[id]) : plan.g[id])
    const b = [base[id]]
    for (let i = 1; i < n; i++) b.push(cl(id, b[i - 1]! * (1 + r[i]! / 100)))
    rate[id] = r; B[id] = b; val[id] = [...b]
  }
  for (const e of plan.ev.filter(x => x.on).sort((a, b) => a.year - b.year)) {
    const i = e.year - FY
    if (i < 1 || i >= n) continue
    const v = val[e.metric], eff = lrfGap(e, rate[e.metric]![i]!).applied
    for (let j = i; j < n; j++) {
      if (e.persist === 'transient' && j > i) break
      v[j] = cl(e.metric, e.persist === 'overlay' ? v[j]! + B[e.metric]![i]! * eff / 100 : v[j]! * (1 + eff / 100))
    }
  }
  const ratio = (src: Record<LrfMetric, number[]>, j: number) => METRICS.reduce((a, m) => a * (src[m.id]![0] ? src[m.id]![j]! / src[m.id]![0]! : 1), 1)
  return { rate, base: B, val, net: YEARS_L.map((_, j) => base.net * ratio(val, j)), netBase: YEARS_L.map((_, j) => base.net * ratio(B, j)) }
}
/** Carryover guard: the event applies the gap over the growth the trend already carries, weighted by its probability. */
export const lrfGap = (e: Pick<LrfEvent, 'headline' | 'prob'>, trend: number) => { const gap = e.headline - trend; return { gap, applied: gap * e.prob / 100 } }
export const lrfNet = (base: LrfBase, plan: LrfPlan, year: number) => lrfPaths(base, plan).net[Math.max(0, Math.min(YEARS_L.length - 1, year - FY))]!

/* ── Formatting ── */
const signed = (v: number, dp = 1) => `${v < 0 && +Math.abs(v).toFixed(dp) !== 0 ? '−' : '+'}${Math.abs(v).toFixed(dp)}%`
const fmtNet = (v: number) => `$${Math.round(v).toLocaleString('en-US')}M`
const fmtNetD = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(Math.round(v)).toLocaleString('en-US')}M`
const fmtMet = (m: LrfMetric, v: number, dp = 1) => m === 'prev' ? `${(v / 1e6).toFixed(dp)}M` : m === 'price' ? `$${v.toFixed(dp)}` : `${v.toFixed(dp)}%`
const fmtMetD = (m: LrfMetric, d: number) => m === 'prev' ? `${d < 0 ? '−' : '+'}${Math.abs(d / 1e6).toFixed(2)}M` : m === 'price' ? `${d < 0 ? '−' : '+'}$${Math.abs(d).toFixed(1)}` : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)} pts`
const fmtPts = (v: number, k: number) => `${(v / 1e6).toFixed(k < 2 ? 1 : 2)}M`
const fy = (y: number) => `FY${y}`
const rangeYears = (r: '1-3' | '4-10' | 'all') => r === '1-3' ? YEARS_L.slice(0, 3) : r === '4-10' ? Y_LATE : YEARS_L
const RANGE_OPTS = [{ id: '1-3' as const, label: 'Years 1–3' }, { id: '4-10' as const, label: 'Years 4–10' }, { id: 'all' as const, label: 'All years' }]
const scColor = (s: Scenario, i: number) => s.color ?? COLOR.alt[i % COLOR.alt.length]!

type YV = { year: number; pts: number[]; net: number; rates: number[] }
const yearVals = (P: LrfPaths, i: number): YV => {
  const v = (m: LrfMetric) => P.val[m]![i]!
  const prev = v('prev'), diag = prev * v('diag') / 100, treat = diag * v('treat') / 100, cov = treat * v('access') / 100, on = cov * v('share') / 100
  return { year: FY + i, pts: [prev, diag, treat, cov, on], net: P.net[i]!, rates: [v('diag'), v('treat'), v('access'), v('share')] }
}

/* ── Small pieces ── */
const NewBadge = () => <span className="rounded-full bg-err px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">New</span>
const Note = ({ children }: { children: ReactNode }) => <p className="border-l-2 border-err bg-err-soft px-4 py-3 text-[13px] leading-relaxed text-text-2">{children}</p>
const TH = 'px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-text-3'

function Num({ label, value, onChange, suffix, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  const [txt, setTxt] = useState<string | null>(null)
  return (
    <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">{label}</span>
      <div className="relative"><input type="text" inputMode="decimal" value={txt ?? String(value)} onFocus={e => e.target.select()} onChange={e => { setTxt(e.target.value); const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v) }} onBlur={() => setTxt(null)} data-step={step} className={cx(field, 'font-mono', suffix && 'pr-8')} />
        {suffix && <span className="pointer-events-none absolute right-2.5 top-2 text-[12px] text-text-3">{suffix}</span>}</div>
    </label>
  )
}

/** The yellow editable growth cell of the LRF table. */
function Rate({ value, onChange, id, label }: { value: number; onChange: (v: number) => void; id: string; label: string }) {
  const [txt, setTxt] = useState<string | null>(null)
  return (
    <input id={id} aria-label={label} inputMode="decimal" value={txt ?? signed(value)}
      onFocus={e => { const t = e.currentTarget; setTxt(String(+value.toFixed(2))); requestAnimationFrame(() => t.select()) }}
      onChange={e => { setTxt(e.target.value); const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(Math.max(-50, Math.min(50, v))) }}
      onBlur={() => setTxt(null)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="h-8 w-[84px] rounded-md border border-[#F0DC8C] bg-[#FFF9E0] text-center font-mono text-[13px] font-semibold text-brand outline-none focus:border-brand focus:bg-surface" />
  )
}

/** Tapering patient funnel, one column per year. Net revenue closes each column. */
function FunnelGrid({ cols, netColor = '#007a6c', onDrill, scale = 'by-year' }: { cols: YV[]; netColor?: string; onDrill?: (y: number) => void; scale?: 'by-year' | 'summary' }) {
  const dense = cols.length > 5
  const min = dense ? 78 : 150
  return (
    <div className="overflow-x-auto">
      <div className="grid items-center gap-x-2 gap-y-1.5" style={{ gridTemplateColumns: `${dense ? 118 : 150}px repeat(${cols.length}, minmax(${min}px, 1fr))`, minWidth: dense ? 118 + cols.length * (min + 8) : undefined }}>
        <span />
        {cols.map(c => <div key={c.year} className="text-center text-[13px] font-bold">{onDrill
          ? <button type="button" onClick={() => onDrill(c.year)} title={`Compare scenarios in ${fy(c.year)}`} className="rounded px-1.5 py-0.5 hover:bg-brand-soft hover:text-brand">{scale === 'summary' ? c.year : fy(c.year)}</button>
          : scale === 'summary' ? c.year : fy(c.year)}</div>)}
        {STAGES.map((st, k) => (
          <div key={st} className="contents">
            <span className={cx('text-[12.5px] text-text-2', k === 4 && 'font-semibold text-text')}>{st}</span>
            {cols.map(c => (
              <div key={c.year} className="flex justify-center">
                <div title={k ? `${(c.pts[k]! / c.pts[0]! * 100).toFixed(1)}% of prevalent patients` : undefined} style={{ width: `${TAPER[k]}%`, background: RAMP[k] }}
                  className={cx('rounded-md px-1 text-center font-semibold', dense ? 'py-1.5 text-[11px]' : 'py-2.5 text-[13px]', k === 4 ? 'text-brand-dark' : 'text-white')}>{fmtPts(c.pts[k]!, k)}</div>
              </div>))}
          </div>))}
        <span className="text-[12.5px] font-semibold text-ok">→ Net revenue</span>
        {cols.map(c => <div key={c.year} style={{ background: netColor }} className={cx('rounded-lg px-1 text-center font-bold text-white', dense ? 'py-1.5 text-[12px]' : 'py-2')}>
          {!dense && <span className="block text-[9.5px] font-medium uppercase tracking-wider text-white/80">Net rev</span>}{fmtNet(c.net)}</div>)}
      </div>
    </div>
  )
}

/* ── Charts ── */
function LineChart({ years, a, b, evYear, fmt, aName, bName, bColor = '#007a6c' }: { years: number[]; a: number[]; b: number[]; evYear?: number; fmt: (v: number) => string; aName: string; bName: string; bColor?: string }) {
  const W = 760, H = 230, L = 58, R = 24, T = 26, Bt = 30
  const all = [...a, ...b], lo0 = Math.min(...all), hi0 = Math.max(...all), pad = (hi0 - lo0) * 0.25 || Math.abs(hi0) * 0.02 || 1
  const lo = lo0 - pad, hi = hi0 + pad
  const x = (i: number) => L + (W - L - R) * (years.length < 2 ? 0 : i / (years.length - 1)), y = (v: number) => T + (H - T - Bt) * (1 - (v - lo) / (hi - lo))
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const ei = evYear === undefined ? -1 : years.indexOf(evYear)
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-x-5 text-[12px] text-text-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-border-strong" />{aName}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-5 rounded" style={{ background: bColor }} />{bName}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${aName} against ${bName}`}>
        {[hi, (hi + lo) / 2, lo].map((v, k) => <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COLOR.grid} /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#767676">{fmt(v)}</text></g>)}
        {ei >= 0 && <g><line x1={x(ei)} x2={x(ei)} y1={T - 6} y2={H - Bt} stroke="#b9bdc7" strokeDasharray="4 4" /><text x={x(ei) + 6} y={T} fontSize="11" fill="#767676">{fy(years[ei]!)} event</text></g>}
        <path d={path(a)} fill="none" stroke="#b9bdc7" strokeWidth="2.5" />
        <path d={path(b)} fill="none" stroke={bColor} strokeWidth="3" />
        {years.map((yr, i) => (i === 0 || i === years.length - 1 || i === ei) && <text key={yr} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === years.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#767676">{`FY${String(yr).slice(2)}`}</text>)}
      </svg>
    </div>
  )
}

/** Net revenue per year as base growth plus the event delta on top. */
function DeltaBars({ years, base, total }: { years: number[]; base: number[]; total: number[] }) {
  const W = 760, H = 230, T = 34, Bt = 28, max = Math.max(...total), slot = W / years.length, bw = Math.min(110, slot * 0.46)
  const h = (v: number) => (H - T - Bt) * (v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Net revenue by year: base growth plus event delta">
      {years.map((yr, i) => {
        const cx0 = slot * i + slot / 2, d = total[i]! - base[i]!, hb = h(base[i]!), hd = d > 0.5 ? Math.max(4, h(d)) : 0, top = H - Bt - hb - hd
        return (
          <g key={yr}>
            <rect x={cx0 - bw / 2} y={H - Bt - hb} width={bw} height={hb} rx="3" fill="#b9bdc7" />
            {hd > 0 && <rect x={cx0 - bw / 2} y={top} width={bw} height={hd} rx="2" fill="#007a6c" />}
            {hd > 0 && <text x={cx0} y={H - Bt - hb + 18} textAnchor="middle" fontSize="12" fill="#fff">{fmtNetD(d)}</text>}
            <text x={cx0} y={top - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#15172e">{fmtNet(total[i]!)}</text>
            <text x={cx0} y={H - 8} textAnchor="middle" fontSize="12" fill="#767676">{fy(yr)}</text>
          </g>)
      })}
    </svg>
  )
}

/* ── Event form ── */
type Draft = Omit<LrfEvent, 'id'> & { id?: string }
const newDraft = (metric: LrfMetric = 'price'): Draft => ({ name: `New ${MET[metric].label.toLowerCase().replace(' ($/rx)', '')} event`, metric, mech: 'list', year: 2031, headline: metric === 'price' ? 6 : 5, prob: 60, persist: 'rebase', on: true })

function EventDetail({ ev, base, plan, form, setForm }: { ev: Draft; base: LrfBase; plan: LrfPlan; form: Draft | null; setForm: (d: Draft) => void }) {
  const solo = useMemo(() => lrfPaths(base, { ...plan, ev: [{ ...ev, id: ev.id ?? 'draft', on: true }] }), [base, plan, ev])
  const i = Math.max(1, Math.min(YEARS_L.length - 1, ev.year - FY)), m = ev.metric
  const trend = solo.rate[m]![i]!, { gap, applied } = lrfGap(ev, trend)
  const last = Math.min(YEARS_L.length - 1, Math.max(6, i + 2)), pv = YEARS_L.slice(0, last + 1)
  const start = Math.max(0, Math.min(i - 2, YEARS_L.length - 5)), win = YEARS_L.slice(start, start + 5)
  const edit = (p: Partial<Draft>) => form && setForm({ ...form, ...p })
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-warn/30 bg-warn-soft px-5 py-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-warn">⚠ Carryover guard — apply the gap over trend, not the headline <span className="ml-1 align-middle"><NewBadge /></span></p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="rounded-md border border-border bg-surface px-4 py-2 text-center"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-3">Headline</p><p className="font-mono text-[22px] font-semibold text-text-2">{signed(ev.headline)}</p></div>
          <span className="text-[22px] font-bold text-warn">−</span>
          <div className="rounded-md border border-border bg-surface px-4 py-2 text-center"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-3">Already in trend ({signed(trend)}/yr)</p><p className="font-mono text-[22px] font-semibold text-text-2">{Math.abs(trend).toFixed(1)}%</p></div>
          <span className="text-[22px] font-bold text-warn">=</span>
          <div className="rounded-md bg-ok px-4 py-2 text-center text-white"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-white/80">Event applies (gap)</p><p className="font-mono text-[22px] font-semibold">{signed(gap)}</p></div>
          <p className="text-[12.5px] text-text-2">At {ev.prob}% probability the event moves {MET[m].label.toLowerCase()} by <b className="font-mono text-text">{signed(applied)}</b>.</p>
        </div>
        <p className="mt-3 text-[13px] text-warn">The default growth already carries {signed(trend)}/yr. Applying the full {signed(ev.headline)} would count the increase twice; the event contributes only the gap on top of trend (measured as priceCy ÷ priceLy − 1, generalised to every metric).</p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Persistence after the step <NewBadge /></p>
        <div role="radiogroup" aria-label="Persistence after the step" className="grid gap-3 md:grid-cols-3">
          {(Object.keys(PERSIST) as Persist[]).map(p => (
            <button key={p} type="button" role="radio" aria-checked={ev.persist === p} disabled={!form} onClick={() => edit({ persist: p })}
              className={cx('rounded-lg border bg-surface p-4 text-left transition-colors', ev.persist === p ? 'border-2 border-brand bg-brand-soft/40' : 'border-border', form && ev.persist !== p && 'hover:border-brand/50', !form && 'cursor-default')}>
              <span className="flex items-center gap-2 text-[14px] font-semibold"><span className={cx('grid h-4 w-4 place-items-center rounded-full border-2', ev.persist === p ? 'border-brand' : 'border-border-strong')}>{ev.persist === p && <span className="h-2 w-2 rounded-full bg-brand" />}</span>{PERSIST[p].label}</span>
              <span className="mt-1.5 block text-[12.5px] leading-snug text-text-2">{PERSIST[p].desc}</span>
            </button>))}
        </div>
      </div>

      <Card title={`${MET[m].label} · trend against with event`} sub={`${fy(FY)} to ${fy(pv[pv.length - 1]!)} · ${PERSIST[ev.persist].label.toLowerCase()}`}>
        <LineChart years={pv} a={solo.base[m]!.slice(0, last + 1)} b={solo.val[m]!.slice(0, last + 1)} evYear={ev.year} fmt={v => fmtMet(m, v, m === 'prev' ? 1 : m === 'price' ? 0 : 1)} aName="Trend (default growth)" bName={`With event (${PERSIST[ev.persist].label.toLowerCase()})`} />
        <div className="mt-3"><Note><b className="text-text">How it reads:</b> the event is entered once and flows through {fy(ev.year)}–{fy(2036)}. The carryover guard stops double-counting against the annual growth rate; the persistence mode decides whether growth then compounds on the new level (re-base) or the original one (overlay). Mechanism still gates the metric — a List event moves gross, a GTN event never does.</Note></div>
      </Card>

      <Card title="By year — base growth + event delta" sub="Double-counting and re-basing stay visible instead of blending into one number." right={<span className="flex items-center gap-4 text-[12px] text-text-2"><span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-border-strong" />Base — default growth (trend)</span><span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-ok" />Event delta (gap over trend, from {fy(ev.year)})</span></span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead><tr className="border-b border-border"><th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-3">{MET[m].label}</th>{win.map(y => <th key={y} className={TH}>{fy(y)}</th>)}</tr></thead>
            <tbody><tr>
              <td className="px-3 py-3 text-text-2">trend + event</td>
              {win.map(y => {
                const j = y - FY, b = solo.base[m]![j]!, v = solo.val[m]![j]!, d = v - b
                return <td key={y} className="px-3 py-3 text-right font-mono">{Math.abs(d) > 1e-9 ? <><span className="text-text-2">{fmtMet(m, b)}</span> <b className="text-ok">{fmtMetD(m, d)}</b><span className="block text-[11px] text-text-3">= {fmtMet(m, v)}</span></> : <span className="font-semibold">{fmtMet(m, b)}</span>}</td>
              })}
            </tr></tbody>
          </table>
        </div>
        <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wide text-text-3">Net revenue — base + event, by year</p>
        <DeltaBars years={win} base={win.map(y => solo.netBase[y - FY]!)} total={win.map(y => solo.net[y - FY]!)} />
        <Note><b className="text-text">How it reads:</b> every post-event year is base growth plus event delta. Pre-event years are all base; from {fy(ev.year)} the green shows exactly what the event adds over the growth rate — the carryover gap, not the headline. If it looked like the full {signed(ev.headline)} you would be double-counting; if it vanished after one year the event would be transient by mistake.</Note>
      </Card>
    </div>
  )
}

/* ── LRF tab ── */
type Screen = 'assumptions' | 'funnel'
const SCREENS: { id: Screen; label: string }[] = [{ id: 'assumptions', label: 'LRF assumptions' }, { id: 'funnel', label: 'Patient funnel by year' }]

export function LrfTab({ scenarios, calc, selId, setSelId, lrf, setLrf, notify, onEvents }: { scenarios: Scenario[]; calc: Calc; selId: string; setSelId: (id: string) => void; lrf: LrfState; setLrf: (f: (s: LrfState) => LrfState) => void; notify: Notify; onEvents: (m: LrfMetric) => void }) {
  const [screen, setScreen] = useState<Screen>('assumptions')
  const [exp, setExp] = useState(false)
  const [range, setRange] = useState<'1-3' | '4-10' | 'all'>('1-3')
  const sc = scenarios.find(s => s.id === selId) ?? scenarios[0]
  const sid = sc?.id ?? selId
  const plan = lrfPlanFor(lrf, sid), base = useMemo(() => lrfBase(calc, sid), [calc, sid])
  const P = useMemo(() => lrfPaths(base, plan), [base, plan])
  const update = (f: (p: LrfPlan) => LrfPlan) => setLrf(s => ({ ...s, [sid]: f(lrfPlanFor(s, sid)) }))
  const setG = (m: LrfMetric, v: number) => update(p => ({ ...p, g: { ...p.g, [m]: v } }))
  const setGy = (m: LrfMetric, y: number, v: number) => update(p => ({ ...p, gyEdited: true, gy: { ...p.gy, [m]: { ...p.gy[m], [y]: v } } }))
  const setMode = (mode: LrfPlan['mode']) => update(p => mode === 'peryear' && !p.gyEdited
    ? { ...p, mode, gy: Object.fromEntries(METRICS.map(m => [m.id, Object.fromEntries(YEARS_L.slice(1).map(y => [y, p.g[m.id]]))])) as LrfPlan['gy'] }
    : { ...p, mode })
  const openEvent = (m: LrfMetric) => onEvents(m)
  const cols = (r: typeof range) => rangeYears(r).map(y => yearVals(P, y - FY))
  const vis = exp ? YEARS_L.slice(1) : YEARS_L.slice(1, 3)
  const derived = (P.net[1]! / P.net[0]! - 1) * 100

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[26px] font-semibold tracking-tight">{screen === 'assumptions' ? (plan.mode === 'peryear' ? 'LRF assumptions — per-year growth %' : 'LRF assumptions') : 'Patient funnel — by year'}</h2>
        <p className="mt-1 text-[15px] text-text-2">{screen === 'assumptions' ? (plan.mode === 'peryear' ? 'Set a growth rate for each metric in each year.' : 'The same funnel as Assumptions, set annually. Each metric holds its growth rate.') : 'Each planning year side by side, from prevalent patients to net revenue.'}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <Seg label="LRF screen" value={screen} onChange={setScreen} options={SCREENS} />
        <label className="ml-auto flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-text-3">Scenario
          <select aria-label="LRF scenario" value={sid} onChange={e => setSelId(e.target.value)} className={cx(field, 'w-56 text-[13px] font-semibold normal-case tracking-normal text-text')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </div>

      {screen === 'assumptions' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Growth mode <NewBadge /></span>
              <Seg label="Growth mode" value={plan.mode} onChange={setMode} options={[{ id: 'const', label: 'Constant %G' }, { id: 'peryear', label: 'Per-year %G' }]} /></div>
            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="ghost" onClick={() => { update(p => ({ ...mkPlan(), ev: p.ev })); notify({ tone: 'info', text: `${sc?.name ?? 'The scenario'} is back on the default growth rates. Its LRF events are kept.` }) }}>Reset rates to default</Btn>
              <Btn variant="secondary" onClick={() => setExp(e => !e)}>{exp ? `− Collapse to ${fy(2029)}` : `+ Expand to ${fy(2030)} – ${fy(2036)} (Years 4–10) ▸`}</Btn>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/70 px-4 py-3 text-[13.5px]">
            {plan.mode === 'const'
              ? <><Toggle on onChange={() => setMode('peryear')} label="Hold each metric's YoY %G constant across all years" /><span><b>Default:</b> hold each metric’s YoY %G constant across all years. <span className="text-text-3">Every metric is editable — override a rate or add an event.</span></span></>
              : <span><b>Per-year %G:</b> enter a growth rate for each metric in each year. <span className="text-text-3">Prefilled from the constant default — adjust any cell. Toggle back to Constant to hold one rate across all years.</span></span>}
          </div>

          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className={cx('w-full text-[13.5px]', exp ? 'min-w-[1120px]' : 'min-w-[720px]')}>
                <thead><tr className="border-b border-border">
                  <th className={cx(TH, 'text-left')}>Metric</th><th className={TH}>{fy(FY)} base</th>
                  {plan.mode === 'const' && <th className={TH}>YoY %G (default)</th>}
                  {vis.map(y => <th key={y} className={TH}>{plan.mode === 'peryear' ? `${fy(y)} %G` : fy(y)}</th>)}
                  {!exp && <th className={TH}>Y4–10</th>}
                  {plan.mode === 'const' && <th className={cx(TH, 'text-left')}>Action</th>}
                </tr></thead>
                <tbody>
                  {METRICS.map(m => (
                    <tr key={m.id} className="border-b border-border">
                      <td className="px-3 py-2.5 font-medium">{m.label}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmtMet(m.id, base[m.id], m.id === 'price' ? 2 : 1)}</td>
                      {plan.mode === 'const' && <td className="px-3 py-2 text-right"><Rate id={`lrf-rate-${m.id}`} label={`${m.label} YoY growth`} value={plan.g[m.id]} onChange={v => setG(m.id, v)} /></td>}
                      {vis.map(y => plan.mode === 'peryear'
                        ? <td key={y} className="px-3 py-2 text-right"><Rate id={`lrf-rate-${m.id}-${y}`} label={`${m.label} growth ${fy(y)}`} value={plan.gy[m.id]?.[y] ?? plan.g[m.id]} onChange={v => setGy(m.id, y, v)} /></td>
                        : <td key={y} className={cx('px-3 py-2.5 text-right font-mono', Math.abs(P.val[m.id]![y - FY]! - P.base[m.id]![y - FY]!) > 1e-9 && 'underline decoration-warn decoration-dashed underline-offset-4')} title={Math.abs(P.val[m.id]![y - FY]! - P.base[m.id]![y - FY]!) > 1e-9 ? 'Moved by an LRF event' : undefined}>{fmtMet(m.id, P.val[m.id]![y - FY]!)}</td>)}
                      {!exp && <td className="px-3 py-2.5 text-right text-text-3">···</td>}
                      {plan.mode === 'const' && <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px]">
                        <button type="button" onClick={() => { const el = document.getElementById(`lrf-rate-${m.id}`); el?.focus() }} className="font-medium text-brand hover:underline">override</button><span className="text-text-3"> · </span>
                        <button type="button" onClick={() => openEvent(m.id)} className="font-medium text-brand hover:underline">event</button></td>}
                    </tr>))}
                  <tr className="bg-brand-soft/30">
                    <td className="px-3 py-3 font-semibold text-ok">= Net revenue (outcome)</td>
                    <td className="px-3 py-3 text-right font-mono font-bold">{fmtNet(P.net[0]!)}</td>
                    {plan.mode === 'const' && <td className="px-3 py-3 text-right text-text-3"><span className="font-mono">{signed(derived)}</span> <span className="text-[11px]">derived</span></td>}
                    {vis.map(y => <td key={y} className={cx('px-3 py-3 text-right font-mono', plan.mode === 'const' ? 'font-bold' : 'text-text-3')}>{fmtNet(P.net[y - FY]!)}</td>)}
                    {!exp && <td className="px-3 py-3 text-right text-text-3">···</td>}
                    {plan.mode === 'const' && <td className="px-3 py-3 text-[12.5px] text-text-3">computed</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <PeakCurve years={YEARS_L} share={P.val.share} net={P.net} />
          <p className="text-[12px] text-text-3">Net revenue is computed from the rates — it is never entered. Every metric row is editable{plan.mode === 'peryear' ? ' per year' : ''}. {fy(FY)} is the base: {sc?.name ?? 'the scenario'}’s monthly forecast, so the plan starts exactly where the Forecast workspace ends.</p>
          {plan.mode === 'peryear' && <Note><b className="text-text">Per-year %G:</b> a growth rate per metric per year, prefilled from the constant so nothing is lost on toggle. Brand share can ramp +3.0% → +3.5% → +4.0% and net price step down +3.0% → +2.5% → +2.0% — impossible in constant mode. Overrides and events still apply on top; net revenue stays the computed outcome.</Note>}
          {plan.mode === 'const' && <Note><b className="text-text">Annual-only assumptions on the patient funnel.</b> The default reads each metric’s YoY growth and holds it flat for every year, so a plan exists with zero typing. Override a rate (yellow) or add a dated <b className="text-text">event</b> for a step change. Every funnel metric is editable; net revenue stays the computed outcome.</Note>}

          <Card title="How it works">
            <ul className="grid gap-x-8 gap-y-2 text-[13px] leading-relaxed text-text-2 md:grid-cols-2">
              <li><b className="text-text">Grain.</b> Annual only: the long-range counterpart to the monthly Assumptions tab, on the same funnel structure.</li>
              <li><b className="text-text">Default.</b> Each metric’s YoY %G is held constant across every plan year; the forecaster only touches what they want to change.</li>
              <li><b className="text-text">All metrics editable.</b> Including epidemiology (prevalence, diagnosis, treatment, access) — a deliberate departure from the fixed-vs-responsive rule where epi is source-set.</li>
              <li><b className="text-text">Events across Years 4–10.</b> Dated once, flows through every later year. Model = trend transformed by events.</li>
              <li><b className="text-text">Carryover guard.</b> An event contributes only the gap over what the default growth already carries, not its headline.</li>
              <li><b className="text-text">Persistence.</b> Declared per event: re-base, overlay or transient. Not an implicit default.</li>
              <li><b className="text-text">Decomposition.</b> The by-year view splits each post-event year into base growth + event delta.</li>
              <li><b className="text-text">Scenario divergence.</b> Scenarios share the epidemiology by default and diverge at the demand stages (brand share, price).</li>
            </ul>
            <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn"><b>Open confirmations:</b> the plan horizon (Years 1–10 = FY2027–FY2036?), which metrics are editable vs source-set for this brand, and how this input tab relates to the existing “Long Range Plan” analytics tab (CR-004) — confirm with the LRP and epidemiology owners.</p>
          </Card>
        </div>
      )}

      {screen === 'funnel' && (
        <Card right={<div className="flex flex-wrap items-center gap-2"><Seg label="Year range" value={range} onChange={setRange} options={RANGE_OPTS} />
          <Btn variant="secondary" onClick={() => setRange(r => r === '1-3' ? 'all' : '1-3')}>{range === '1-3' ? '+ Expand to Years 4–10 ▸' : '− Collapse to Years 1–3 ▾'}</Btn></div>}
          title={`${BRAND} patient funnel · ${sc?.name ?? ''}`} sub={`${rangeYears(range).length === 10 ? 'All ten planning years (FY2027–FY2036)' : range === '1-3' ? 'Years 1–3 (FY2027–FY2029)' : 'Years 4–10 (FY2030–FY2036)'} side by side. Reading across the columns shows the plan’s year-over-year growth.`}>
          <FunnelGrid cols={cols(range)} />
          <div className="mt-4"><Note><b className="text-text">Patient funnel by year:</b> the bars taper down each year’s funnel (prevalent → on brand); reading across the columns shows the plan’s year-over-year growth. Use Expand to bring Years 4–10 into the same view. Values are illustrative and read from the model with the planning assumptions applied.</Note></div>
        </Card>
      )}

    </div>
  )
}

/* ── LRF events panel: lives in the Events tab beside the monthly events ── */
export function LrfEventsPanel({ scenarios, calc, selId, lrf, setLrf, notify, start }: { scenarios: Scenario[]; calc: Calc; selId: string; lrf: LrfState; setLrf: (f: (s: LrfState) => LrfState) => void; notify: Notify; start?: { metric: LrfMetric; n: number } | null }) {
  const [form, setForm] = useState<Draft | null>(null)
  const [selEv, setSelEv] = useState<string | null>(null)
  const sc = scenarios.find(s => s.id === selId) ?? scenarios[0]
  const sid = sc?.id ?? selId
  const plan = lrfPlanFor(lrf, sid), base = useMemo(() => lrfBase(calc, sid), [calc, sid])
  const P = useMemo(() => lrfPaths(base, plan), [base, plan])
  const update = (f: (p: LrfPlan) => LrfPlan) => setLrf(s => ({ ...s, [sid]: f(lrfPlanFor(s, sid)) }))
  useEffect(() => { if (start) setForm(newDraft(start.metric)) }, [start?.n])
  const saveEvent = () => {
    if (!form) return
    const d = { ...form, name: form.name.trim() || 'LRF event' }
    const id = d.id ?? `lev${Date.now()}`
    update(p => ({ ...p, ev: d.id ? p.ev.map(e => e.id === id ? { ...d, id } : e) : [...p.ev, { ...d, id }] }))
    setSelEv(id); setForm(null)
    notify({ tone: 'ok', text: `${d.name} saved to ${sc?.name ?? 'the scenario'}. It applies ${signed(lrfGap(d, P.rate[d.metric]![Math.max(1, d.year - FY)]!).applied)} to ${MET[d.metric].label.toLowerCase()} from ${fy(d.year)}, with the carryover guard.` })
  }
  const events = plan.ev
  const shown = form ?? events.find(e => e.id === selEv) ?? events[0] ?? null
  return (
        <div className="space-y-5">
          {!form && (
            <Card title={`LRF events · ${sc?.name ?? ''}`} sub="Dated in Years 2–10 and layered on the default growth. Each event declares how it persists." right={<Btn icon={<Plus size={14} />} onClick={() => setForm(newDraft())}>Add LRF event</Btn>} pad={false}>
              {events.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-text-3">No LRF events in this scenario. The plan follows the default growth.</p> : (
                <ul className="divide-y divide-border">
                  {events.map(e => {
                    const g = lrfGap(e, P.rate[e.metric]![Math.max(1, e.year - FY)]!)
                    return (
                      <li key={e.id} className={cx('flex flex-wrap items-center gap-3 px-5 py-3', shown?.id === e.id && 'bg-brand-soft/30')}>
                        <Toggle on={e.on} onChange={v => update(p => ({ ...p, ev: p.ev.map(x => x.id === e.id ? { ...x, on: v } : x) }))} label={`${e.name} on`} />
                        <button type="button" onClick={() => setSelEv(e.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[14px] font-semibold">{e.name}</span>
                          <span className="block text-[12px] text-text-2">{MET[e.metric].label} · {fy(e.year)} · headline {signed(e.headline)} · gap {signed(g.gap)} · {e.prob}% probability</span></button>
                        <Tag tone={e.persist === 'transient' ? 'warn' : 'brand'}>{PERSIST[e.persist].label}</Tag>
                        <Btn size="sm" variant="secondary" onClick={() => setForm({ ...e })}>Edit</Btn>
                        <Btn size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => { update(p => ({ ...p, ev: p.ev.filter(x => x.id !== e.id) })); notify({ tone: 'info', text: `${e.name} removed from ${sc?.name ?? 'the scenario'}.` }) }}>Remove</Btn>
                      </li>)
                  })}
                </ul>)}
            </Card>)}

          {form && (
            <Card title={form.id ? 'Edit LRF event' : 'New LRF event'} sub="An event dated in Years 2–10 flows through every later year from this one entry.">
              <div className="mb-3 flex flex-wrap gap-2"><Tag tone="brand">Event · {form.metric === 'price' ? 'Pricing' : MET[form.metric].label}</Tag>{form.metric === 'price' && <Tag tone={form.mech === 'list' ? 'ok' : 'neutral'}>{form.mech === 'list' ? 'List · moves gross' : 'GTN · never moves gross'}</Tag>}{form.year >= 2030 && <Tag tone="err">Crosses Years 4–10</Tag>}</div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block sm:col-span-2 lg:col-span-3"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Event name</span>
                  <input aria-label="Event name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={cx(field, 'text-[15px] font-semibold')} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Metric</span>
                  <select aria-label="Metric" value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value as LrfMetric })} className={field}>{METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Mechanism</span>
                  <select aria-label="Mechanism" value={form.mech} disabled={form.metric !== 'price'} onChange={e => setForm({ ...form, mech: e.target.value as 'list' | 'gtn' })} className={field}><option value="list">List · moves gross</option><option value="gtn">GTN · never moves gross</option></select></label>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Start year</span>
                  <select aria-label="Start year" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} className={field}>{YEARS_L.slice(1).map(y => <option key={y} value={y}>{fy(y)}</option>)}</select></label>
                <Num label="Headline impact" suffix="%" value={form.headline} onChange={v => setForm({ ...form, headline: v })} />
                <Num label="Probability" suffix="%" value={form.prob} onChange={v => setForm({ ...form, prob: Math.max(0, Math.min(100, v)) })} />
              </div>
              <p className="mt-3 text-[12px] text-text-3">Target: brand-wide. Mechanism still gates the price metric: a List event moves gross and net, a GTN event moves net only. Other metrics ignore the mechanism.</p>
            </Card>)}

          {shown && <EventDetail ev={shown} base={base} plan={plan} form={form} setForm={setForm} />}

          {form && <div className="sticky bottom-14 z-10 flex justify-end gap-2 rounded-lg border border-border bg-surface/95 px-4 py-3 backdrop-blur">
            <Btn variant="ghost" onClick={() => setForm(null)}>Cancel</Btn><Btn onClick={saveEvent}>{form.id ? 'Save event' : 'Add event'}</Btn></div>}
        </div>
  )
}

/* ── Scenario summary: Years 4–10 by scenario ── */
function ScenarioBars({ items, years, onYear }: { items: { s: Scenario; color: string; P: LrfPaths }[]; years: number[]; onYear: (y: number) => void }) {
  const W = 900, H = 270, T = 18, Bt = 32, n = items.length, slot = W / years.length, bw = Math.min(40, (slot * 0.78) / n)
  const max = Math.max(...items.flatMap(it => years.map(y => it.P.net[y - FY]!)))
  const h = (v: number) => (H - T - Bt) * (v / max)
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-[12.5px] text-text-2">{items.map(it => <span key={it.s.id} className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px]" style={{ background: it.color }} />{it.s.name}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Net revenue by scenario and year">
        {years.map((y, k) => {
          const x0 = slot * k + slot / 2 - (bw * n) / 2
          return (
            <g key={y}>
              {items.map((it, j) => { const v = it.P.net[y - FY]!; return <g key={it.s.id}><rect x={x0 + j * bw} y={H - Bt - h(v)} width={bw - 2} height={h(v)} rx="3" fill={it.color}><title>{`${it.s.name} · ${fy(y)} · ${fmtNet(v)}`}</title></rect>
                {n <= 3 && <text x={x0 + j * bw + (bw - 2) / 2} y={H - Bt - h(v) - 5} textAnchor="middle" fontSize="10" fill="#4a4e5e">{fmtNet(v)}</text>}</g> })}
              <text x={slot * k + slot / 2} y={H - 10} textAnchor="middle" fontSize="12.5" fill="#4a4e5e" className="cursor-pointer" onClick={() => onYear(y)}>{y}</text>
            </g>)
        })}
      </svg>
    </div>
  )
}

function CompareYear({ year, items, onBack }: { year: number; items: { s: Scenario; color: string; P: LrfPaths }[]; onBack: () => void }) {
  const ys = items.map(it => yearVals(it.P, year - FY))
  const same = (k: number) => { const v = ys.map(y => y.pts[k]!); return Math.max(...v) - Math.min(...v) <= Math.abs(v[0]!) * 1e-6 }
  const cell = (k: number) => !(k < 4) ? null : same(k)
  const min = 130
  return (
    <Card title={`Compare scenarios — ${fy(year)} funnel`} sub={`Year ${year - FY + 1}. Epidemiology is common across scenarios; the funnels diverge at brand share and price — so On brand and Net revenue differ, upstream stages do not (unless a scenario changes an epi assumption).`}
      right={<Btn variant="secondary" icon={<ArrowLeft size={14} />} onClick={onBack}>Back to years</Btn>}>
      <div className="mb-3 flex flex-wrap gap-5 text-[12.5px] text-text-2">
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-border-strong" />Epidemiology — same across scenarios</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-brand" />Scenario-specific (brand &amp; net)</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-warn" />Epi stage moved by a scenario</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid items-center gap-x-2 gap-y-1.5" style={{ gridTemplateColumns: `130px repeat(${items.length}, minmax(${min}px, 1fr))`, minWidth: 130 + items.length * (min + 8) }}>
          <span />
          {items.map(it => <div key={it.s.id} className="text-center text-[13.5px] font-bold" style={{ color: it.color }}>{it.s.name}</div>)}
          {STAGES.map((st, k) => (
            <div key={st} className="contents">
              <span className={cx('text-[12.5px] text-text-2', k === 4 && 'font-semibold text-text')}>{st}</span>
              {items.map((it, j) => {
                const epi = cell(k), bg = epi === null ? it.color : epi ? '#b9bdc7' : '#8f5a00'
                return <div key={it.s.id} className="flex justify-center"><div style={{ width: `${TAPER[k]}%`, background: bg }} className="rounded-md px-1 py-2 text-center text-[13px] font-semibold text-white">{fmtPts(ys[j]!.pts[k]!, k)}</div></div>
              })}
            </div>))}
          <span className="text-[12.5px] font-semibold text-brand">→ Net revenue</span>
          {items.map((it, j) => <div key={it.s.id} style={{ background: it.color }} className="rounded-lg px-1 py-2 text-center font-bold text-white"><span className="block text-[9.5px] font-medium uppercase tracking-wider text-white/80">Net rev</span>{fmtNet(ys[j]!.net)}</div>)}
        </div>
      </div>
      <div className="mt-4"><Note><b className="text-text">Per-year drill:</b> shows where scenarios diverge — at the demand stages (brand share, price), not the epidemiology, which the funnel holds common. A scenario that overrides an epi rate moves the grey stages too (shown in amber); otherwise they stay identical and only On brand and Net revenue fan out.</Note></div>
    </Card>
  )
}

export function LrfSummary({ scenarios, calc, selId, setSelId, lrf }: { scenarios: Scenario[]; calc: Calc; selId: string; setSelId: (id: string) => void; lrf: LrfState }) {
  const [pick, setPick] = useState<string>(selId)
  const [range, setRange] = useState<'1-3' | '4-10' | 'all'>('4-10')
  const [drill, setDrill] = useState<number | null>(null)
  const items = useMemo(() => scenarios.map((s, i) => ({ s, color: scColor(s, i), P: lrfPaths(lrfBase(calc, s.id), lrfPlanFor(lrf, s.id)) })), [scenarios, calc, lrf])
  const years = rangeYears(range), cur = items.find(it => it.s.id === pick)
  const rLabel = range === '1-3' ? 'Years 1–3' : range === '4-10' ? 'Years 4–10' : 'Years 1–10'
  const span = `${fy(years[0]!)}–${fy(years[years.length - 1]!)}`
  const choose = (id: string) => { setPick(id); if (id !== 'all') setSelId(id) }
  const top = cur ?? items[0]
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[26px] font-semibold tracking-tight">Patient funnel — {rLabel} by scenario</h2>
        <p className="mt-1 text-[15px] text-text-2">The long-range funnel by scenario, side by side.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Scenario</span>
        <div role="radiogroup" aria-label="LRF scenario" className="flex flex-wrap gap-2">
          {[...items.map(it => ({ id: it.s.id, label: it.s.name, color: it.color })), { id: 'all', label: 'Compare all', color: '' }].map(o => (
            <button key={o.id} type="button" role="radio" aria-checked={pick === o.id} onClick={() => { choose(o.id); setDrill(null) }}
              className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors', pick === o.id ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong bg-surface text-text-2 hover:text-text')}>
              {o.color && <i className="h-2 w-2 rounded-full" style={{ background: o.color }} />}{o.label}</button>))}
        </div>
        <span className="ml-auto"><Seg label="Year range" value={range} onChange={r => { setRange(r); setDrill(null) }} options={RANGE_OPTS} /></span>
      </div>

      {drill !== null
        ? <CompareYear year={drill} items={items} onBack={() => setDrill(null)} />
        : pick === 'all'
          ? <Card title={`Net revenue by scenario — ${span}`} sub="Compare all reads the scenario spread per year. Select a year to drill into the full funnel by scenario." pad={false}>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-border bg-surface-2"><th className={cx(TH, 'text-left')}>Scenario</th>{years.map(y => <th key={y} className={TH}><button type="button" onClick={() => setDrill(y)} title={`Compare funnels in ${fy(y)}`} className="font-semibold uppercase tracking-wide hover:text-brand">{fy(y)}</button></th>)}</tr></thead>
              <tbody>{items.map(it => <tr key={it.s.id} className="border-b border-border"><td className="px-3 py-2.5 font-medium"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: it.color }} />{it.s.name}</td>{years.map(y => <td key={y} className="px-3 py-2.5 text-right font-mono">{fmtNet(it.P.net[y - FY]!)}</td>)}</tr>)}
                <tr className="bg-surface-2"><td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Spread (high − low)</td>{years.map(y => { const v = items.map(it => it.P.net[y - FY]!); return <td key={y} className="px-3 py-2.5 text-right font-mono text-text-2">{fmtNet(Math.max(...v) - Math.min(...v))}</td> })}</tr></tbody>
            </table></div>
          </Card>
          : top && <Card title={`${top.s.name} scenario — funnel by year (${span})`} sub="Select a year to see the full funnel side by side by scenario." right={<Tag tone="neutral">{rLabel}</Tag>}>
            <FunnelGrid cols={years.map(y => yearVals(top.P, y - FY))} netColor={top.color} scale="summary" onDrill={setDrill} />
          </Card>}

      {drill === null && (
        <Card title={`Net revenue by scenario — ${span}`}>
          <ScenarioBars items={items} years={years} onYear={setDrill} />
          <div className="mt-2"><Note><b className="text-text">New on Summary:</b> the LRF patient funnel is reused to view {rLabel.toLowerCase()} side by side, by scenario. Choose a scenario for its funnel grid, or Compare all to read the net-revenue spread per year. Select any year to drill to the full funnel by scenario.</Note></div>
        </Card>)}
    </div>
  )
}

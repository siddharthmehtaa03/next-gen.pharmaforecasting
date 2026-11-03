import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bookmark } from 'lucide-react'
import { ChartActions } from '../../chart/ChartActions'
import { useInsights } from './insightsCtx'
import { ACT, N, START_YEAR, mLabel, mLong } from './engine'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export const COLOR = { actual: '#02005e', unbiased: '#71717a', ci: '#71717a', working: '#0000c9', scenario: '#1474fc', preview: '#a68aff', grid: '#e4e4e7', alt: ['#0095ff', '#007a6c', '#c4122f', '#8f5a00', '#a68aff', '#0000c9'] }
export const field = 'h-10 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-sm outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-3'

export function Btn({ children, variant = 'primary', onClick, icon, disabled, size = 'md', title, className }: { children?: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; onClick?: () => void; icon?: ReactNode; disabled?: boolean; size?: 'sm' | 'md'; title?: string; className?: string }) {
  return <button type="button" title={title} onClick={onClick} disabled={disabled} className={cx('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45', size === 'sm' ? 'h-8 px-3.5 text-xs' : 'h-10 px-5 text-sm', variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark', variant === 'secondary' && 'border border-brand bg-surface text-brand hover:bg-surface-2', variant === 'ghost' && 'text-text-2 hover:bg-surface-2 hover:text-text', variant === 'danger' && 'text-err hover:bg-err-soft', className)}>{icon}{children}</button>
}
/** `fill` stretches the card to its grid row and its body to the card, so paired cards line up. */
export function Card({ title, sub, right, children, className, pad = true, fill }: { title?: ReactNode; sub?: string; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean; fill?: boolean }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-border bg-surface shadow-card', fill && 'flex h-full flex-col', className)}>
      {title && <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4"><div className="min-w-0"><h3 className="font-display text-base font-semibold">{title}</h3></div>{right}</header>}
      <div className={cx(pad && 'p-6', fill && 'flex flex-1 flex-col')}>{children}</div>
    </section>
  )
}
export function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'err'; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', tone === 'neutral' && 'bg-surface-2 text-text-2', tone === 'brand' && 'bg-surface-2 text-text', tone === 'ok' && 'bg-ok-soft text-ok', tone === 'warn' && 'bg-warn-soft text-warn', tone === 'err' && 'bg-err-soft text-err')}>{children}</span>
}
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-text' : 'bg-border-strong')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-full border border-border bg-surface-2 p-1">
      {options.map(o => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={cx('rounded-full px-3.5 py-1 text-[13px] font-medium transition-all', value === o.id ? 'bg-text text-white shadow-sm' : 'text-text-2 hover:bg-white hover:text-text')}>{o.label}</button>)}
    </div>
  )
}
export function Label({ children, hint, className }: { children: ReactNode; hint?: string; className?: string }) {
  return <span className={cx('block text-[11px] font-semibold uppercase tracking-wide text-text-3', className)}>{children}{hint && <span className="ml-1 font-normal normal-case tracking-normal">· {hint}</span>}</span>
}
export function Stat({ k, v, sub, tone }: { k: string; v: ReactNode; sub?: ReactNode; tone?: 'ok' | 'err' | 'brand' }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{k}</p>
      <p className={cx('mt-0.5 font-display text-[22px] font-semibold', tone === 'ok' && 'text-ok', tone === 'err' && 'text-err', tone === 'brand' && 'text-brand')}>{v}</p>
      {sub && <p className="mt-0.5 text-[12px] text-text-2">{sub}</p>}
    </div>
  )
}

export type ChartSeries = {
  actual?: number[]; unbiased?: number[]; lo?: number[]; hi?: number[]; working?: number[]; preview?: number[]; scenario?: number[]; scenarioName?: string
  /** Other lines (e.g. every scenario). `bold` draws a thick solid line; otherwise a thin dotted one. */
  extra?: { name: string; color: string; series: number[]; bold?: boolean }[]
  /** Which line is being worked on: it is drawn thick, the rest thin and dotted. Default: the active forecast. */
  focus?: 'working' | 'scenario'
  scenarioColor?: string
}
const thin = { w: 1.6, dash: '2 3' }, thick = { w: 3.5, dash: undefined as string | undefined }
type Row = Record<string, number | number[] | undefined> & { i: number }

export function Legend({ s }: { s: ChartSeries }) {
  const item = (label: string, node: ReactNode) => <span key={label} className="inline-flex items-center gap-1.5 text-[12px] text-text-2">{node}{label}</span>
  const line = (color: string, dash?: string, w = 2) => <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke={color} strokeWidth={w} strokeDasharray={dash} /></svg>
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {s.actual && item('Actuals', line(COLOR.actual, undefined, 2.5))}
      {s.unbiased && item('Reference baseline · Data Science', line(COLOR.unbiased, '5 4'))}
      {s.lo && item('95% CI (reference)', <span className="h-2.5 w-5 rounded-sm" style={{ background: 'rgb(138 143 168 / .25)' }} />)}
      {s.working && item('Active forecast', s.focus === 'scenario' ? line(COLOR.working, thin.dash, thin.w) : line(COLOR.working, undefined, 2.5))}
      {s.preview && item('Unapplied preview', line(COLOR.preview, '2 3'))}
      {s.scenario && item(s.scenarioName ?? 'Scenario', line(s.scenarioColor ?? COLOR.scenario, undefined, 2.5))}
      {s.extra?.map(x => item(x.name, x.bold ? line(x.color, undefined, 3) : line(x.color, thin.dash, thin.w)))}
    </div>
  )
}

type Grain = 'month' | 'quarter' | 'year'
const SPAN: Record<Grain, number> = { month: 1, quarter: 3, year: 12 }
const roll = (a: number[] | undefined, y: number, agg: 'sum' | 'avg', n = 12) => {
  if (!a) return undefined
  const v = a.slice(y * n, y * n + n)
  if (v.length < n || v.some(x => typeof x !== 'number')) return undefined
  const sum = v.reduce((p, c) => p + c, 0)
  return agg === 'sum' ? sum : sum / n
}
// shortcut: no governed budget feed in the prototype; the plan is the reference baseline +2% for the current year only. Wire to the AOP feed when available.
const BUDGET_YEAR = START_YEAR + Math.floor((ACT - 1) / 12), BUDGET_UPLIFT = 1.02
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** `range` limits the chart to a start and end month (inclusive indexes), at any grain. */
export function ForecastChart({ s, fmt, height = 300, dp = 1, unit, title = 'Forecast chart', context, toolbar, defaultGrain = 'month', canSave = true, range }: { s: ChartSeries; fmt: (v: number) => string; height?: number; dp?: number; unit?: string; title?: string; context?: string; toolbar?: boolean; defaultGrain?: Grain; canSave?: boolean; range?: [number, number] }) {
  const ins = useInsights()
  // The Monthly / Quarterly / Annual switch sits on every chart that is big enough to read, not only the large ones.
  const showBar = toolbar ?? height >= 180
  const agg: 'sum' | 'avg' = unit === '$M' ? 'sum' : 'avg'
  const [grain, setGrain] = useState<Grain>(defaultGrain)
  const [status, setStatus] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const yr = grain !== 'month', n = SPAN[grain], P = N / n
  const data = useMemo(() => {
    if (yr) {
      return Array.from({ length: P }, (_, y): Row => ({
        i: y, actual: roll(s.actual, y, agg, n), unbiased: roll(s.unbiased, y, agg, n),
        ci: s.lo && s.hi && roll(s.lo, y, agg, n) !== undefined ? [roll(s.lo, y, agg, n)!, roll(s.hi, y, agg, n)!] : undefined,
        working: roll(s.working, y, agg, n), preview: roll(s.preview, y, agg, n), scenario: roll(s.scenario, y, agg, n),
        ...Object.fromEntries((s.extra ?? []).map((x, k) => [`x${k}`, roll(x.series, y, agg, n)])),
      }))
    }
    return Array.from({ length: N }, (_, i): Row => {
      const f = i >= ACT - 1
      return {
        i, actual: i < ACT ? s.actual?.[i] : undefined,
        unbiased: f ? s.unbiased?.[i] : undefined,
        ci: f && s.lo && s.hi ? [s.lo[i]!, s.hi[i]!] : undefined,
        working: f ? s.working?.[i] : undefined, preview: f ? s.preview?.[i] : undefined, scenario: f ? s.scenario?.[i] : undefined,
        ...Object.fromEntries((s.extra ?? []).map((x, k) => [`x${k}`, f ? x.series[i] : undefined])),
      }
    })
  }, [s, yr, agg, n, P])
  // Value at each point for the hover box: actuals where booked, else the active forecast.
  const val = (r: Row | undefined) => { if (!r) return undefined; for (const k of ['actual', 'working', 'scenario', 'unbiased'] as const) if (typeof r[k] === 'number') return r[k] as number; return undefined }
  const lag = 12 / n
  const budgetAt = (i: number) => { const from = i * n; if (START_YEAR + Math.floor(from / 12) !== BUDGET_YEAR || !s.unbiased) return undefined; const v = roll(s.unbiased, i, agg, n); return v === undefined ? undefined : v * BUDGET_UPLIFT }
  // Start / end month → the first and last point shown at this grain.
  const lo = range ? Math.max(0, Math.floor(range[0] / n)) : 0, hi = range ? Math.min(P - 1, Math.floor(range[1] / n)) : P - 1
  const vis = range ? data.filter(r => r.i >= lo && r.i <= hi) : data
  const vals = vis.flatMap(r => Object.entries(r).filter(([k]) => k !== 'i').flatMap(([, v]) => Array.isArray(v) ? v : typeof v === 'number' ? [v] : []))
  const min = vals.length ? Math.min(...vals) : 0, max = vals.length ? Math.max(...vals) : 1, pad = (max - min) * 0.1 || 1
  // Scenarios that agree with each other lie exactly on top of one another. Each thin line gets its own slot in the dash pattern, so overlapping lines show as interleaved colours instead of hiding one another.
  const thinKeys = [...(s.extra ?? []).flatMap((x, k) => (x.bold ? [] : [`x${k}`])), ...(s.working && s.focus === 'scenario' ? ['working'] : []), ...(s.scenario && s.focus === 'working' ? ['scenario'] : [])]
  const thinDash = (key: string) => { const m = thinKeys.length, k = thinKeys.indexOf(key); return m <= 1 ? { d: thin.dash, o: 0 } : { d: `3 ${3 * (m - 1)}`, o: -3 * k } }
  const tickEvery =grain === 'year' ? 1 : grain === 'quarter' ? 2 : 6
  const ticks = Array.from({ length: Math.ceil((hi - lo + 1) / tickEvery) }, (_, k) => lo + k * tickEvery)
  const xLabel = (i: number) => grain === 'year' ? String(START_YEAR + i) : grain === 'quarter' ? `Q${(i % 4) + 1} ${String(START_YEAR + Math.floor(i / 4)).slice(2)}` : mLabel(i)
  const pointLabel = (i: number) => grain === 'year' ? String(START_YEAR + i) : grain === 'quarter' ? `Q${(i % 4) + 1} ${START_YEAR + Math.floor(i / 4)}` : mLong(i)

  const lines = useMemo(() => {
    const l: { name: string; color: string; key: string }[] = []
    if (s.actual) l.push({ name: 'Actuals', color: COLOR.actual, key: 'actual' })
    if (s.unbiased) l.push({ name: 'Reference baseline (Data Science)', color: COLOR.unbiased, key: 'unbiased' })
    if (s.working) l.push({ name: 'Active forecast', color: COLOR.working, key: 'working' })
    if (s.preview) l.push({ name: 'Unapplied preview', color: COLOR.preview, key: 'preview' })
    if (s.scenario) l.push({ name: s.scenarioName ?? 'Scenario', color: s.scenarioColor ?? COLOR.scenario, key: 'scenario' })
    ;(s.extra ?? []).forEach((x, k) => l.push({ name: x.name, color: x.color, key: `x${k}` }))
    return l
  }, [s])
  const scope = `${{ month: 'Monthly', quarter: 'Quarterly', year: 'Annual' }[grain]}${unit ? `, ${unit}` : ''}${yr ? (agg === 'sum' ? ` (${grain === 'year' ? 'yearly' : 'quarterly'} total)` : ` (${grain === 'year' ? 'yearly' : 'quarterly'} average)`) : ''}`
  const flash = (m: string) => { setStatus(m); window.setTimeout(() => setStatus(''), 3500) }

  const exportPptx = async () => {
    flash('Preparing PPTX…')
    try {
      const { default: Pptx } = await import('pptxgenjs')
      const p = new Pptx(); p.layout = 'LAYOUT_WIDE'
      const sl = p.addSlide()
      sl.addText(title, { x: 0.5, y: 0.35, w: 12.3, h: 0.5, fontSize: 24, bold: true, color: '0B0F2E' })
      sl.addText([context, scope].filter(Boolean).join(' · '), { x: 0.5, y: 0.85, w: 12.3, h: 0.35, fontSize: 12, color: '5B6078' })
      const labels = data.map(r => xLabel(r.i))
      sl.addChart(p.ChartType.line, lines.map(l => ({ name: l.name, labels, values: data.map(r => { const v = r[l.key]; return typeof v === 'number' ? Number(v.toFixed(3)) : null as unknown as number }) })), {
        x: 0.5, y: 1.4, w: 12.3, h: 5.4, chartColors: lines.map(l => l.color.slice(1).toUpperCase()), lineSize: 2, lineDataSymbol: yr ? 'circle' : 'none',
        showLegend: true, legendPos: 'b', legendFontSize: 11, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, valGridLine: { color: 'DFE2EC', size: 0.5 }, catGridLine: { style: 'none' },
      })
      await p.writeFile({ fileName: `${title.replace(/[^\w]+/g, '-')}-${yr ? 'annual' : 'monthly'}.pptx` })
      flash('PPTX downloaded.')
    } catch { flash('PPTX export failed. Try again.') }
  }
  return (
    <div>
      {showBar && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[12px] text-text-3" aria-live="polite">{status}</span>
          {ins && canSave && <Btn variant="secondary" icon={<Bookmark size={14} />} onClick={() => { ins.save({ title, scenario: s.scenarioName, snap: { series: s, unit: unit ?? '', dp, fmt, grain } }); flash('Saved to Insights.') }}>Save to Insights</Btn>}
          <Seg label="Time aggregation" value={grain} onChange={setGrain} options={[{ id: 'month', label: 'Monthly' }, { id: 'quarter', label: 'Quarterly' }, { id: 'year', label: 'Annual' }]} />
          <ChartActions target={() => ref.current} title={title} subtitle={[context, scope].filter(Boolean).join(' · ')} onPptx={exportPptx} />
        </div>
      )}
      <div className="relative">
      {!showBar && height >= 160 && <ChartActions className="absolute right-0 top-0 z-10" target={() => ref.current} title={title} subtitle={[context, scope].filter(Boolean).join(' · ')} onPptx={exportPptx} />}
      <div ref={ref} style={{ height }} role="img" aria-label={`${title}, ${scope}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLOR.grid} vertical={false} />
            <XAxis dataKey="i" type="number" allowDataOverflow domain={yr ? [lo - 0.2, hi + 0.2] : [lo, hi]} ticks={ticks} tickFormatter={xLabel} tick={{ fontSize: 11, fill: '#767676' }} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
            <YAxis domain={[min - pad, max + pad]} tickFormatter={(v: number) => v.toFixed(dp)} tick={{ fontSize: 11, fill: '#767676' }} tickLine={false} axisLine={false} width={48} />
            {!yr && ACT - 1 >= lo && ACT - 1 <= hi && <ReferenceLine x={ACT - 1} stroke="#b9bdc7" strokeDasharray="3 3" label={{ value: 'Actuals end', position: 'insideTopLeft', fontSize: 10, fill: '#767676' }} />}
            <Tooltip isAnimationActive={false} cursor={{ stroke: '#b9bdc7' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0]!.payload as Row
              const rows: [string, string, string][] = []
              if (typeof r.actual === 'number') rows.push(['Actuals', COLOR.actual, fmt(r.actual)])
              if (typeof r.unbiased === 'number') rows.push(['Reference baseline', COLOR.unbiased, fmt(r.unbiased)])
              if (Array.isArray(r.ci)) rows.push(['95% CI', COLOR.ci, `${fmt(r.ci[0]!)} – ${fmt(r.ci[1]!)}`])
              if (typeof r.working === 'number') rows.push(['Active forecast', COLOR.working, fmt(r.working)])
              if (typeof r.preview === 'number') rows.push(['Unapplied preview', COLOR.preview, fmt(r.preview)])
              if (typeof r.scenario === 'number') rows.push([s.scenarioName ?? 'Scenario', s.scenarioColor ?? COLOR.scenario, fmt(r.scenario)])
              ;(s.extra ?? []).forEach((x, k) => { const v = r[`x${k}`]; if (typeof v === 'number') rows.push([x.name, x.color, fmt(v)]) })
              // CR-002: value, %G YoY and % of Budget for the hovered point. Call feedback: also month over month (monthly) and quarter over quarter (quarterly).
              const v = val(r), prev = val(data[r.i - lag]), bud = budgetAt(r.i), prevStep = val(data[r.i - 1])
              const g = v !== undefined && prev ? (v / prev - 1) * 100 : undefined, b = v !== undefined && bud ? (v / bud) * 100 : undefined
              const gs = v !== undefined && prevStep ? (v / prevStep - 1) * 100 : undefined
              const pct = (x: number | undefined) => x === undefined ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}%`
              const kpi = (label: string, dot: string, text: string, cls = '') => <p className="flex items-center justify-between gap-5"><span className="inline-flex items-center gap-1.5 text-text-2"><span className="h-2 w-2 rounded-full" style={{ background: dot }} />{label}</span><span className={cx('font-mono font-semibold', cls)}>{text}</span></p>
              return (
                <div className="min-w-[200px] rounded-md border border-border bg-surface px-3 py-2 text-[12px] shadow-md">
                  <p className="mb-1.5 border-b border-border pb-1.5 font-semibold">{pointLabel(r.i)}</p>
                  {v !== undefined && <div className="mb-1.5 space-y-0.5 border-b border-border pb-1.5">
                    {kpi('Value', COLOR.working, fmt(v))}
                    {kpi('%G YoY', '#007a6c', pct(g), g === undefined ? 'text-text-3' : g >= 0 ? 'text-ok' : 'text-err')}
                    {grain !== 'year' && kpi(grain === 'month' ? '%G MoM' : '%G QoQ', '#0e7490', pct(gs), gs === undefined ? 'text-text-3' : gs >= 0 ? 'text-ok' : 'text-err')}
                    {kpi('% of Budget', '#b7791f', b === undefined ? '—' : `${b.toFixed(1)}%`, b === undefined ? 'text-text-3' : b >= 100 ? 'text-ok' : 'text-err')}
                  </div>}
                  {rows.map(([n, c, v]) => <p key={n} className="flex items-center justify-between gap-5"><span className="inline-flex items-center gap-1.5 text-text-2"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n}</span><span className="font-mono">{v}</span></p>)}
                </div>
              )
            }} />
            {s.lo && s.hi && <Area dataKey="ci" stroke="none" fill="#767676" fillOpacity={0.2} isAnimationActive={false} activeDot={false} />}
            {s.unbiased && <Line dataKey="unbiased" stroke={COLOR.unbiased} strokeWidth={2} strokeDasharray="5 4" dot={yr ? { r: 3 } : false} isAnimationActive={false} />}
            {s.actual && <Line dataKey="actual" stroke={COLOR.actual} strokeWidth={2.5} dot={yr ? { r: 4 } : false} isAnimationActive={false} />}
            {s.extra?.filter(x => !x.bold).map(x => { const k = `x${s.extra!.indexOf(x)}`; return <Line key={x.name} dataKey={k} stroke={x.color} strokeWidth={thin.w} strokeDasharray={thinDash(k).d} strokeDashoffset={thinDash(k).o} dot={yr ? { r: 2.5 } : false} isAnimationActive={false} /> })}
            {s.working && <Line dataKey="working" stroke={COLOR.working} strokeWidth={s.focus === 'scenario' ? thin.w : thick.w} strokeDasharray={s.focus === 'scenario' ? thinDash('working').d : thick.dash} strokeDashoffset={s.focus === 'scenario' ? thinDash('working').o : 0} dot={yr ? { r: s.focus === 'scenario' ? 2.5 : 4 } : false} isAnimationActive={false} />}
            {s.scenario && <Line dataKey="scenario" stroke={s.scenarioColor ?? COLOR.scenario} strokeWidth={s.focus === 'working' ? thin.w : thick.w} strokeDasharray={s.focus === 'working' ? thinDash('scenario').d : thick.dash} strokeDashoffset={s.focus === 'working' ? thinDash('scenario').o : 0} dot={yr ? { r: 4 } : false} isAnimationActive={false} />}
            {s.extra?.filter(x => x.bold).map(x => <Line key={x.name} dataKey={`x${s.extra!.indexOf(x)}`} stroke={x.color} strokeWidth={thick.w} dot={yr ? { r: 4 } : false} isAnimationActive={false} />)}
            {s.preview && <Line dataKey="preview" stroke={COLOR.preview} strokeWidth={2.5} strokeDasharray="2 3" dot={yr ? { r: 3 } : false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      {yr && <p className="mt-1 text-[11px] text-text-3">{grain === 'year' ? 'Annual' : 'Quarterly'} view. Periods with partial actuals show forecast series only. % of Budget shows for {BUDGET_YEAR} only.</p>}
    </div>
  )
}

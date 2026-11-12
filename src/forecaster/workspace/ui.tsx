import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bookmark, EllipsisVertical, Info } from 'lucide-react'
import { ChartActions } from '../../chart/ChartActions'
import { useInsights } from './insightsCtx'
import { ACT, N, START_YEAR, mLabel, mLong } from './engine'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export const COLOR = { actual: '#0b0f2e', unbiased: '#8a8fa8', ci: '#8a8fa8', working: '#0000c9', scenario: '#0e7490', preview: '#7c3aed', grid: '#dfe2ec', alt: ['#0e7490', '#0a7d4f', '#c4122f', '#a35a00', '#7c3aed', '#0000c9'] }
export const field = 'h-9 w-full rounded-xl border border-border bg-surface px-2.5 text-[13px] shadow-[0_1px_1px_rgba(16,24,40,0.04)] outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-3'

export function Btn({ children, variant = 'primary', onClick, icon, disabled, size = 'md', title, className }: { children?: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; onClick?: () => void; icon?: ReactNode; disabled?: boolean; size?: 'sm' | 'md'; title?: string; className?: string }) {
  return <button type="button" title={title} onClick={onClick} disabled={disabled} className={cx('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]', variant === 'primary' && 'bg-[#1b1b21] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.25)] hover:bg-black disabled:opacity-35', variant === 'secondary' && 'border border-border-strong bg-surface shadow-[0_1px_1px_rgba(16,24,40,0.04)] hover:bg-surface-2', variant === 'ghost' && 'text-text-2 hover:bg-surface-2 hover:text-text', variant === 'danger' && 'text-err hover:bg-err-soft', className)}>{icon}{children}</button>
}
export type MenuItem = { label: string; icon?: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }
/** Three-dot menu for row and card actions (edit, copy, delete…), same trigger as the chart actions menu. */
export function MoreMenu({ items, label = 'More actions', align = 'right' }: { items: MenuItem[]; label?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off) }
  }, [open])
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-text-2 transition-colors hover:border-border-strong hover:text-text"><EllipsisVertical size={15} /></button>
      {open && (
        <div role="menu" className={cx('rise absolute top-full z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map(it => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick() }}
              className={cx('flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent', it.danger ? 'text-err hover:!bg-err-soft' : 'text-text')}>{it.icon}{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
/** Small info icon whose hover/focus tooltip holds a description, so headings stay one line. */
export function InfoTip({ text, size = 13 }: { text: string; size?: number }) {
  return <button type="button" title={text} aria-label={text} className="inline-grid shrink-0 place-items-center align-middle normal-case tracking-normal text-text-3 hover:text-text-2"><Info size={size} /></button>
}
/** Page heading with its description tucked behind an info icon. */
export function PageTitle({ title, info, size = 22 }: { title: ReactNode; info?: string; size?: 22 | 26 }) {
  return <h2 className={cx('flex items-center gap-2 font-semibold tracking-tight', size === 26 ? 'text-[26px]' : 'text-[22px]')}>{title}{info && <InfoTip text={info} size={15} />}</h2>
}
/** `fill` stretches the card to its grid row and its body to the card, so paired cards line up. */
export function Card({ title, sub, info, right, children, className, pad = true, fill, frame }: { title?: ReactNode; sub?: string
  /** Shown as a hover tooltip off a small info icon next to the title, instead of printing as a permanent subtitle line. */
  info?: string; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean; fill?: boolean
  /** Muted outer frame around a white inner panel for the body, titlebar sitting on the frame itself. */
  frame?: boolean }) {
  return (
    <section className={cx('min-w-0 rounded-[20px] border border-border', frame ? 'bg-surface-2' : 'bg-surface shadow-card', fill && 'flex h-full flex-col', className)}>
      {title && <header className={cx('flex flex-wrap items-start justify-between gap-3 pb-0.5', frame ? 'px-3 pt-2.5' : 'px-4 pt-3.5')}>
        <div className="min-w-0">
          <h3 className={cx('flex items-center gap-1.5 font-semibold', frame ? 'text-[11px] uppercase tracking-wider text-text-3' : 'text-[13.5px]')}>{title}{info && <InfoTip text={info} />}</h3>
          {sub && <p className="mt-0.5 text-[12.5px] text-text-3">{sub}</p>}
        </div>{right}</header>}
      <div className={cx(pad && (frame ? 'px-2.5 pb-2.5 pt-2' : title ? 'px-4 pb-4 pt-3' : 'p-4'), fill && 'flex flex-1 flex-col')}>
        {frame ? <div className={cx('rounded-md bg-surface p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]', fill && 'flex flex-1 flex-col')}>{children}</div> : children}
      </div>
    </section>
  )
}
export function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'err'; children: ReactNode }) {
  return <span className={cx('tag inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', tone === 'neutral' && 'bg-surface-2 text-text-2', tone === 'brand' && 'bg-brand-soft text-brand', tone === 'ok' && 'bg-ok-soft text-ok', tone === 'warn' && 'bg-warn-soft text-warn', tone === 'err' && 'bg-err-soft text-err')}>{children}</span>
}
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-border-strong')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-[14px] bg-surface-2 p-0.5">
      {options.map(o => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={cx('rounded-[11px] px-2.5 py-1 text-[13px] font-medium transition-colors', value === o.id ? 'bg-surface text-text shadow-[0_1px_2px_rgba(16,24,40,0.1)]' : 'text-text-2 hover:text-text')}>{o.label}</button>)}
    </div>
  )
}
export function Label({ children, hint, className }: { children: ReactNode; hint?: string; className?: string }) {
  return <span className={cx('block text-[12.5px] font-medium text-text-2', className)}>{children}{hint && <span className="ml-1 font-normal text-text-3">· {hint}</span>}</span>
}
export function Stat({ k, v, sub, tone }: { k: string; v: ReactNode; sub?: ReactNode; tone?: 'ok' | 'err' | 'brand' }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-text-2">{k}</p>
      <p className={cx('mt-1 text-[22px] font-semibold tracking-tight tabular-nums', tone === 'ok' && 'text-ok', tone === 'err' && 'text-err', tone === 'brand' && 'text-brand')}>{v}</p>
      {sub && <p className="mt-0.5 text-[12px] text-text-2">{sub}</p>}
    </div>
  )
}

export type ChartSeries = {
  actual?: number[]; unbiased?: number[]; lo?: number[]; hi?: number[]; working?: number[]; preview?: number[]; scenario?: number[]; scenarioName?: string
  extra?: { name: string; color: string; series: number[] }[]
}
type Row = Record<string, number | number[] | undefined> & { i: number }

export function Legend({ s }: { s: ChartSeries }) {
  const item = (label: string, node: ReactNode) => <span key={label} className="inline-flex items-center gap-1.5 text-[12px] text-text-2">{node}{label}</span>
  const line = (color: string, dash?: string, w = 2) => <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke={color} strokeWidth={w} strokeDasharray={dash} /></svg>
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {s.actual && item('Actuals', line(COLOR.actual, undefined, 2.5))}
      {s.unbiased && item('Reference baseline · Data Science', line(COLOR.unbiased, '5 4'))}
      {s.lo && item('95% CI (reference)', <span className="h-2.5 w-5 rounded-sm" style={{ background: 'rgb(138 143 168 / .25)' }} />)}
      {s.working && item('Active forecast', line(COLOR.working, undefined, 2.5))}
      {s.preview && item('Unapplied preview', line(COLOR.preview, '2 3'))}
      {s.scenario && item(s.scenarioName ?? 'Scenario', line(COLOR.scenario, undefined, 2.5))}
      {s.extra?.map(x => item(x.name, line(x.color)))}
    </div>
  )
}

type Grain = 'month' | 'quarter' | 'year'
const YEARS_N = N / 12
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

export function ForecastChart({ s, fmt, height = 300, dp = 1, unit, title = 'Forecast chart', context, toolbar, defaultGrain = 'month', canSave = true, ownActions, domId }: { s: ChartSeries; fmt: (v: number) => string; height?: number; dp?: number; unit?: string; title?: string; context?: string; toolbar?: boolean; defaultGrain?: Grain; canSave?: boolean
  /** Set when the caller renders its own ChartActions (e.g. next to a card-header badge) instead of this chart's own floating one. */
  ownActions?: boolean; domId?: string }) {
  const ins = useInsights()
  const showBar = toolbar ?? height >= 250
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
  const vals = data.flatMap(r => Object.entries(r).filter(([k]) => k !== 'i').flatMap(([, v]) => Array.isArray(v) ? v : typeof v === 'number' ? [v] : []))
  const min = Math.min(...vals), max = Math.max(...vals), pad = (max - min) * 0.1 || 1
  const xLabel = (i: number) => grain === 'year' ? String(START_YEAR + i) : grain === 'quarter' ? `Q${(i % 4) + 1} ${String(START_YEAR + Math.floor(i / 4)).slice(2)}` : mLabel(i)
  const pointLabel = (i: number) => grain === 'year' ? String(START_YEAR + i) : grain === 'quarter' ? `Q${(i % 4) + 1} ${START_YEAR + Math.floor(i / 4)}` : mLong(i)

  const lines = useMemo(() => {
    const l: { name: string; color: string; key: string }[] = []
    if (s.actual) l.push({ name: 'Actuals', color: COLOR.actual, key: 'actual' })
    if (s.unbiased) l.push({ name: 'Reference baseline (Data Science)', color: COLOR.unbiased, key: 'unbiased' })
    if (s.working) l.push({ name: 'Active forecast', color: COLOR.working, key: 'working' })
    if (s.preview) l.push({ name: 'Unapplied preview', color: COLOR.preview, key: 'preview' })
    if (s.scenario) l.push({ name: s.scenarioName ?? 'Scenario', color: COLOR.scenario, key: 'scenario' })
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
          {!ownActions && <ChartActions target={() => ref.current} title={title} subtitle={[context, scope].filter(Boolean).join(' · ')} onPptx={exportPptx} />}
        </div>
      )}
      <div className="relative">
      {!ownActions && !showBar && height >= 160 && <ChartActions className="absolute right-0 top-0 z-10" target={() => ref.current} title={title} subtitle={[context, scope].filter(Boolean).join(' · ')} onPptx={exportPptx} />}
      <div ref={ref} id={domId} style={{ height }} role="img" aria-label={`${title}, ${scope}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLOR.grid} vertical={false} />
            <XAxis dataKey="i" type="number" domain={yr ? [-0.2, P - 0.8] : [0, N - 1]} ticks={grain === 'year' ? Array.from({ length: YEARS_N }, (_, k) => k) : grain === 'quarter' ? Array.from({ length: P / 2 }, (_, k) => k * 2) : Array.from({ length: N / 6 }, (_, k) => k * 6)} tickFormatter={xLabel} tick={{ fontSize: 11, fill: '#8a8fa8' }} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
            <YAxis domain={[min - pad, max + pad]} tickFormatter={(v: number) => v.toFixed(dp)} tick={{ fontSize: 11, fill: '#8a8fa8' }} tickLine={false} axisLine={false} width={48} />
            {!yr && <ReferenceLine x={ACT - 1} stroke="#b9bed0" strokeDasharray="3 3" label={{ value: 'Actuals end', position: 'insideTopLeft', fontSize: 10, fill: '#8a8fa8' }} />}
            {s.lo && s.hi && <Area dataKey="ci" stroke="none" fill="#8a8fa8" fillOpacity={0.2} isAnimationActive={false} activeDot={false} />}
            {s.unbiased && <Line dataKey="unbiased" stroke={COLOR.unbiased} strokeWidth={2} strokeDasharray="5 4" dot={yr ? { r: 3 } : false} isAnimationActive={false} activeDot={false} />}
            {s.actual && <Line dataKey="actual" stroke={COLOR.actual} strokeWidth={2.5} dot={yr ? { r: 4 } : false} isAnimationActive={false} activeDot={false} />}
            {s.working && <Line dataKey="working" stroke={COLOR.working} strokeWidth={2.5} dot={yr ? { r: 4 } : false} isAnimationActive={false} activeDot={false} />}
            {s.extra?.map((x, k) => <Line key={x.name} dataKey={`x${k}`} stroke={x.color} strokeWidth={2} dot={yr ? { r: 3 } : false} isAnimationActive={false} activeDot={false} />)}
            {s.scenario && <Line dataKey="scenario" stroke={COLOR.scenario} strokeWidth={2.5} dot={yr ? { r: 4 } : false} isAnimationActive={false} activeDot={false} />}
            {s.preview && <Line dataKey="preview" stroke={COLOR.preview} strokeWidth={2.5} strokeDasharray="2 3" dot={yr ? { r: 3 } : false} isAnimationActive={false} activeDot={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      {yr && <p className="mt-1 text-[11px] text-text-3">{grain === 'year' ? 'Annual' : 'Quarterly'} view. Periods with partial actuals show forecast series only. % of Budget shows for {BUDGET_YEAR} only.</p>}
    </div>
  )
}

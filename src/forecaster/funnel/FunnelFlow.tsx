import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, ChevronRight, CircleAlert, FileUp, Flag, History, Layers, Lock, MessageSquareText, Paperclip,
  Plus, Save, Send, ShieldCheck, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Minus, X, Zap, Boxes, Archive,
} from 'lucide-react'
import {
  ACT, DEV_LABEL, INPUTS, METHODS, MONTHS, N, NODE, NODES, SEED_DEVS, START_YEAR, TIERS, YEARS,
  compute, defaultCagr, devStatus, fmt, history, idxOf, mLabel, yearOf, yearly, yv,
} from './engine'
import type { Dev, DevKind, DevStatus, Method, Model, NodeId, Setup, Tier } from './engine'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
const C = { brand: '#0000c9', base: '#767676', act: '#000067', ok: '#007a6c', warn: '#8f5a00', grid: '#dbe8f6', alt: ['#0000c9', '#007a6c', '#8f5a00', '#c4122f'] }
type Notify = (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void
type Stage = 'orient' | 'baseline' | 'deviations' | 'scenarios' | 'publish'
type Gran = 'monthly' | 'yearly'
const STAGES: { id: Stage; n: number; label: string; sub: string }[] = [
  { id: 'orient', n: 1, label: 'Orient', sub: 'Model home' },
  { id: 'baseline', n: 2, label: 'Baseline', sub: 'Funnel + node view' },
  { id: 'deviations', n: 3, label: 'Deviations', sub: 'Events, targets, edits' },
  { id: 'scenarios', n: 4, label: 'Scenarios', sub: 'Save, compare, output' },
  { id: 'publish', n: 5, label: 'Publish', sub: 'Check, name, release' },
]
type ModelRow = { id: string; brand: string; ind: string; type: string; tier: Tier; cycle: string; version: string; horizon: string; scale: number; due: string }
const MODELS: ModelRow[] = [
  { id: 'm1', brand: 'Nurtec ODT', ind: 'Acute + preventive migraine', type: 'Patient funnel · Rx-share', tier: 'tight', cycle: 'FY26 LE', version: 'v3.12', horizon: '10 years', scale: 1, due: 'Due Oct 14' },
  { id: 'm2', brand: 'Vyndaqel', ind: 'ATTR-CM', type: 'Patient funnel · Prevalent-share', tier: 'standard', cycle: 'FY26 LE', version: 'v2.4', horizon: '10 years', scale: 0.9, due: 'Due Oct 21' },
  { id: 'm3', brand: 'PF-07081532', ind: 'Obesity · Phase 2', type: 'Patient funnel · Pipeline', tier: 'open', cycle: 'LRP 2027', version: 'v0.6', horizon: '15 years (shown 10)', scale: 0.6, due: 'Due Nov 4' },
]
type Saved = { id: string; name: string; devs: Dev[]; setup: Setup; at: string }
const now = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const FY = 2027

/* ───────── primitives ───────── */
function Btn({ children, variant = 'primary', onClick, icon, disabled, size = 'md' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; onClick?: () => void; icon?: ReactNode; disabled?: boolean; size?: 'sm' | 'md' }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cx('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45', size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-5 text-sm', variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark', variant === 'secondary' && 'border border-border-strong bg-surface text-brand hover:border-brand hover:bg-brand-soft', variant === 'ghost' && 'text-text-2 hover:bg-surface-2 hover:text-text')}>{icon}{children}</button>
}
function Card({ title, sub, right, children, className, pad = true }: { title?: ReactNode; sub?: string; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-border bg-surface shadow-card', className)}>
      {title && <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5"><div className="min-w-0"><h3 className="font-display text-base font-semibold">{title}</h3>{sub && <p className="mt-0.5 text-[13px] text-text-2">{sub}</p>}</div>{right}</header>}
      <div className={cx(pad && 'p-5')}>{children}</div>
    </section>
  )
}
function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'err'; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', tone === 'neutral' && 'bg-surface-2 text-text-2', tone === 'brand' && 'bg-brand-soft text-brand', tone === 'ok' && 'bg-ok-soft text-ok', tone === 'warn' && 'bg-warn-soft text-warn', tone === 'err' && 'bg-err-soft text-err')}>{children}</span>
}
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-full border border-border bg-surface-2 p-1">
      {options.map(o => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={cx('rounded px-2.5 py-1 text-[13px] font-medium transition-colors', value === o.id ? 'bg-brand-soft text-brand' : 'text-text-2 hover:text-text')}>{o.label}</button>)}
    </div>
  )
}
function StatusChip({ s }: { s: DevStatus }) {
  return s === 'needs' ? <Tag tone="warn"><CircleAlert size={11} />Rationale needed</Tag> : s === 'reviewed' ? <Tag tone="ok"><Check size={11} />Reviewed</Tag> : <Tag>Logged</Tag>
}
const field = 'h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'
function MonthPick({ value, onChange, min = ACT }: { value: number; onChange: (i: number) => void; min?: number }) {
  return (
    <div className="flex gap-1.5">
      <select aria-label="Month" className={field} value={value % 12} onChange={e => onChange(Math.max(min, idxOf(yearOf(value), Number(e.target.value))))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
      <select aria-label="Year" className={field} value={yearOf(value)} onChange={e => onChange(Math.max(min, idxOf(Number(e.target.value), value % 12)))}>{YEARS.filter(y => idxOf(y, 11) >= min).map(y => <option key={y}>{y}</option>)}</select>
    </div>
  )
}

/* ───────── chart ───────── */
function TrendChart({ model, id, gran, extra, height = 260 }: { model: Model; id: NodeId; gran: Gran; extra?: { name: string; m: Model }[]; height?: number }) {
  const n = NODE[id]
  const data = useMemo(() => {
    if (gran === 'monthly') return Array.from({ length: N }, (_, i) => ({ x: mLabel(i), actual: i < ACT ? model.fc[id][i] : null, baseline: i >= ACT - 1 ? model.base[id][i] : null, forecast: i >= ACT - 1 ? model.fc[id][i] : null, ...Object.fromEntries((extra ?? []).map(e => [e.name, i >= ACT - 1 ? e.m.fc[id][i] : null])) }))
    const b = yearly(model.base[id], n.agg), f = yearly(model.fc[id], n.agg), ex = (extra ?? []).map(e => ({ name: e.name, v: yearly(e.m.fc[id], n.agg) }))
    return YEARS.map((y, k) => ({ x: String(y), actual: y <= 2025 ? f[k] : null, baseline: y >= 2025 ? b[k] : null, forecast: y >= 2025 ? f[k] : null, ...Object.fromEntries(ex.map(e => [e.name, y >= 2025 ? e.v[k] : null])) }))
  }, [model, id, gran, extra, n.agg])
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 11, fill: '#767676' }} interval={gran === 'monthly' ? 11 : 0} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis tick={{ fontSize: 11, fill: '#767676' }} width={56} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={v => Number(v).toLocaleString('en-US', { maximumFractionDigits: n.dp > 1 ? 2 : 0 })} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? fmt(id, v) : String(v))} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: C.grid }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          <ReferenceLine x={gran === 'monthly' ? mLabel(ACT - 1) : '2026'} stroke="#a9c4e4" strokeDasharray="2 3" label={{ value: 'Actuals | Forecast', fontSize: 10, fill: '#767676', position: 'insideTopRight' }} />
          <Line dataKey="actual" name="Actuals" stroke={C.act} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="baseline" name="Baseline (trend)" stroke={C.base} strokeDasharray="5 4" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          {!extra && <Line dataKey="forecast" name="Forecast (with deviations)" stroke={C.brand} strokeWidth={2.25} dot={false} isAnimationActive={false} />}
          {extra?.map((e, k) => <Line key={e.name} dataKey={e.name} stroke={C.alt[k % 4]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ───────── funnel navigator (always on) ───────── */
function FunnelNav({ model, sel, onPick, devs, tier }: { model: Model; sel: NodeId | null; onPick: (id: NodeId) => void; devs: Dev[]; tier: Tier }) {
  return (
    <nav aria-label="Funnel navigator" className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-2"><p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Patient funnel</p><p className="text-[11px] text-text-3">FY{String(FY).slice(2)}</p></div>
      <ol className="flex flex-col items-center gap-1">
        {NODES.map((n, k) => {
          const on = sel === n.id
          const nd = devs.filter(d => d.node === n.id)
          const needs = nd.some(d => devStatus(d, tier) === 'needs')
          const width = 100 - k * 4.2
          const derived = n.kind === 'derived'
          return (
            <li key={n.id} style={{ width: `${width}%` }}>
              <button type="button" onClick={() => onPick(n.id)} aria-current={on ? 'true' : undefined}
                className={cx('group relative w-full rounded-md border px-2.5 py-2 text-left transition-colors', on ? 'border-brand bg-brand text-white shadow-sm' : derived ? 'border-dashed border-border-strong bg-surface-2/70 hover:border-text-3' : 'border-border bg-surface hover:border-brand/50')}>
                <span className="flex items-center gap-1.5">
                  {derived && <Lock size={11} className={on ? 'text-white/80' : 'text-text-3'} aria-label="Derived, read-only" />}
                  <span className={cx('truncate text-[12.5px] font-semibold', !on && derived && 'text-text-2')}>{n.label}</span>
                  {nd.length > 0 && <span className={cx('ml-auto grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[10px]', on ? 'bg-white/20' : needs ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand')} title={`${nd.length} deviation${nd.length > 1 ? 's' : ''}`}>{nd.length}</span>}
                </span>
                <span className={cx('mt-0.5 block font-mono text-[11px]', on ? 'text-white/80' : 'text-text-3')}>{fmt(n.id, yv(model, n.id, FY))} <span className="font-sans">{n.unit === '%' || n.unit.startsWith('$') ? '' : n.unit}</span></span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-text-3"><Lock size={11} />Derived nodes are read-only. Edit the drivers upstream.</p>
    </nav>
  )
}

/* ───────── grid (monthly / yearly) ───────── */
function Grid({ model, id, gran, devs, tier, onEdit }: { model: Model; id: NodeId; gran: Gran; devs: Dev[]; tier: Tier; onEdit: (i: number, v: number) => void }) {
  const n = NODE[id]
  const editable = n.kind === 'input' && gran === 'monthly'
  const rows = gran === 'monthly'
    ? Array.from({ length: N }, (_, i) => ({ k: mLabel(i), i, act: i < ACT, b: model.base[id][i]!, f: model.fc[id][i]! }))
    : YEARS.map((y, k) => ({ k: String(y), i: k * 12, act: y < 2026, b: yearly(model.base[id], n.agg)[k]!, f: yearly(model.fc[id], n.agg)[k]! }))
  const tagFor = (i: number) => gran === 'monthly'
    ? devs.filter(d => d.node === id && (d.kind === 'override' ? d.start === i : i >= d.start && i <= (d.end ?? N - 1)))
    : devs.filter(d => d.node === id && yearOf(d.start) <= yearOf(i) && yearOf(d.end ?? N - 1) >= yearOf(i))
  return (
    <div className="max-h-[380px] overflow-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface-2 text-left text-[11px] uppercase tracking-wide text-text-3">
          <tr><th className="px-4 py-2 font-semibold">Period</th><th className="px-3 py-2 text-right font-semibold">Baseline</th><th className="px-3 py-2 text-right font-semibold">Forecast</th><th className="px-3 py-2 text-right font-semibold">Δ</th><th className="px-3 py-2 font-semibold">Source</th><th className="px-3 py-2 font-semibold">State</th></tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const tags = r.act ? [] : tagFor(r.i)
            const ov = tags.find(t => t.kind === 'override')
            const d = r.b ? (r.f / r.b - 1) * 100 : 0
            return (
              <tr key={r.k} className={cx('border-b border-border', r.act && 'bg-surface-2/40 text-text-2')}>
                <td className="whitespace-nowrap px-4 py-1.5 font-medium">{r.k}{r.act && <span className="ml-2 text-[11px] text-text-3">actual</span>}</td>
                <td className="px-3 py-1.5 text-right font-mono text-text-2">{fmt(id, r.b)}</td>
                <td className="px-3 py-1 text-right font-mono">
                  {editable && !r.act
                    ? <input key={`${r.i}-${r.f.toFixed(4)}`} aria-label={`Forecast ${r.k}`} defaultValue={r.f.toFixed(n.dp)} onBlur={e => { const v = Number(e.target.value); if (Number.isFinite(v) && Math.abs(v - r.f) > 1e-9) onEdit(r.i, v) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className={cx('h-7 w-24 rounded border px-1.5 text-right font-mono outline-none focus:border-brand', ov ? 'border-brand bg-brand-soft text-brand' : 'border-transparent hover:border-border-strong')} />
                    : fmt(id, r.f)}
                </td>
                <td className={cx('px-3 py-1.5 text-right font-mono text-[12px]', Math.abs(d) < 0.05 ? 'text-text-3' : d > 0 ? 'text-ok' : 'text-err')}>{r.act ? '' : Math.abs(d) < 0.05 ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}%`}</td>
                <td className="max-w-[200px] truncate px-3 py-1.5 text-[12px] text-text-2" title={ov?.source || n.source}>{r.act ? 'Actuals feed' : ov ? (ov.source || <span className="text-warn">No source</span>) : tags.length ? tags[0]!.source || n.source : n.source}</td>
                <td className="px-3 py-1.5"><div className="flex flex-wrap gap-1">{r.act ? <Tag>Actual</Tag> : tags.length ? tags.slice(0, 2).map(t => <span key={t.id} title={t.label}><Tag tone={devStatus(t, tier) === 'needs' ? 'warn' : 'brand'}>{DEV_LABEL[t.kind]}</Tag></span>) : <Tag>Trend</Tag>}</div></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {n.kind === 'input' && gran === 'yearly' && <p className="px-4 py-2 text-[12px] text-text-3">Switch to monthly to edit cells directly. Each edit is saved as a grid-edit deviation.</p>}
    </div>
  )
}

/* ───────── deviation editor row ───────── */
function DevCard({ d, tier, onChange, onRemove, compact }: { d: Dev; tier: Tier; onChange: (p: Partial<Dev>) => void; onRemove: () => void; compact?: boolean }) {
  const s = devStatus(d, tier), t = TIERS[tier]
  const period = d.kind === 'override' ? mLabel(d.start) : `${mLabel(d.start)}${d.end !== undefined ? ` → ${mLabel(d.end)}` : ' onward'}`
  const val = d.kind === 'target' || d.kind === 'override' ? fmt(d.node, d.value) : `${d.value > 0 ? '+' : ''}${d.value.toFixed(1)}%`
  return (
    <div className={cx('rounded-lg border bg-surface p-4', s === 'needs' ? 'border-warn/40' : 'border-border')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><Tag tone="brand">{DEV_LABEL[d.kind]}</Tag><StatusChip s={s} /></div>
          <p className="mt-1.5 font-semibold">{d.label}</p>
          <p className="text-[12.5px] text-text-2">{NODE[d.node].label} · {period} · <span className="font-mono">{val}</span>{d.shape ? ` · ${d.shape}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          {s !== 'needs' && <Btn size="sm" variant="ghost" onClick={() => onChange({ reviewed: !d.reviewed })} icon={<ShieldCheck size={14} />}>{d.reviewed ? 'Unmark' : 'Mark reviewed'}</Btn>}
          <button type="button" onClick={onRemove} aria-label={`Remove ${d.label}`} className="grid h-8 w-8 place-items-center rounded-md text-text-3 hover:bg-err-soft hover:text-err"><Trash2 size={14} /></button>
        </div>
      </div>
      {!compact && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]">
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Rationale{t.needRat(d) ? ' · required' : ' · optional'}</span>
          <textarea value={d.rationale} onChange={e => onChange({ rationale: e.target.value, reviewed: false })} rows={2} placeholder="Why does this move away from the trend?" className="mt-1 w-full resize-y rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand" /></label>
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Source{t.needSrc ? ' · required' : ''}</span>
          <div className="relative mt-1"><Paperclip size={13} className="absolute left-2.5 top-2.5 text-text-3" /><input value={d.source} onChange={e => onChange({ source: e.target.value })} placeholder="File, link or owner" className={cx(field, 'pl-7')} /></div></label>
      </div>}
      <p className="mt-2 text-[11px] text-text-3">{d.by} · {d.at}</p>
    </div>
  )
}

/* ───────── main ───────── */
export default function FunnelFlow({ notify, onLegacy }: { notify: Notify; onLegacy: () => void }) {
  const [modelId, setModelId] = useState<string | null>(null)
  const row = MODELS.find(m => m.id === modelId)
  if (!row) return <ModelsHome onOpen={setModelId} onLegacy={onLegacy} />
  return <Flow key={row.id} row={row} notify={notify} onBack={() => setModelId(null)} />
}

function ModelsHome({ onOpen, onLegacy }: { onOpen: (id: string) => void; onLegacy: () => void }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Forecaster</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight">My models</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-2">Models are the organising object. Cycle and version are attributes. The flow and governance tier for each model are set by the CoE in the configurator.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {MODELS.map(m => (
            <button key={m.id} type="button" onClick={() => onOpen(m.id)} className="group rounded-2xl border border-border bg-surface shadow-card p-5 text-left transition-shadow hover:border-brand/50 hover:shadow-md">
              <div className="flex items-center justify-between"><Tag tone={m.tier === 'tight' ? 'brand' : m.tier === 'standard' ? 'neutral' : 'ok'}>{TIERS[m.tier].label} tier</Tag><span className="text-[12px] font-medium text-warn">{m.due}</span></div>
              <p className="mt-3 text-lg font-semibold">{m.brand}</p>
              <p className="text-[13px] text-text-2">{m.ind}</p>
              <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-[12px]">
                <dt className="text-text-3">Model</dt><dd className="text-right">{m.type.split(' · ')[1]}</dd>
                <dt className="text-text-3">Cycle</dt><dd className="text-right">{m.cycle}</dd>
                <dt className="text-text-3">Version</dt><dd className="text-right font-mono">{m.version}</dd>
                <dt className="text-text-3">Horizon</dt><dd className="text-right">{m.horizon}</dd>
              </dl>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">Open model<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onLegacy} className="mt-8 inline-flex items-center gap-1.5 text-[13px] text-text-3 hover:text-text"><Archive size={13} />Open the previous step-based prototype</button>
      </main>
    </div>
  )
}

function Flow({ row, notify, onBack }: { row: ModelRow; notify: Notify; onBack: () => void }) {
  const [stage, setStage] = useState<Stage>('orient')
  const [tier, setTier] = useState<Tier>(row.tier)
  const [gran, setGran] = useState<Gran>('yearly')
  const [sel, setSel] = useState<NodeId>('brand')
  const [devs, setDevs] = useState<Dev[]>(SEED_DEVS)
  const [setup, setSetup] = useState<Setup>({ methods: {}, cagr: {} })
  const [saved, setSaved] = useState<Saved[]>([{ id: 'sv0', name: 'Trend only (no deviations)', devs: [], setup: { methods: {}, cagr: {} }, at: 'Sep 10' }])
  const [panel, setPanel] = useState<'ai' | 'log' | null>(null)
  const [nodeFilter, setNodeFilter] = useState<NodeId | null>(null)
  const [published, setPublished] = useState<{ name: string; at: string }[]>([{ name: `${row.cycle} · Jun actuals · ${row.version}`, at: 'Aug 4' }])

  const model = useMemo(() => compute(setup, devs, row.scale), [setup, devs, row.scale])
  const needs = devs.filter(d => devStatus(d, tier) === 'needs')

  const patch = (id: string, p: Partial<Dev>) => setDevs(ds => ds.map(d => d.id === id ? { ...d, ...p } : d))
  const remove = (id: string) => { setDevs(ds => ds.filter(d => d.id !== id)); notify({ tone: 'info', text: 'Deviation removed. The node returns to its trend for that period.' }) }
  const add = (d: Omit<Dev, 'id' | 'by' | 'at' | 'reviewed' | 'mag'> & { mag?: number }) => {
    const before = model.fc[d.node][d.start]!
    const mag = d.mag ?? (d.kind === 'event' || d.kind === 'goalseek' ? d.value : (d.value / before - 1) * 100)
    setDevs(ds => [...ds, { ...d, id: `d${Date.now()}`, by: 'You', at: now(), reviewed: false, mag }])
  }
  const editCell = (i: number, v: number) => {
    const base = model.base[sel][i]!
    setDevs(ds => {
      const ex = ds.find(d => d.kind === 'override' && d.node === sel && d.start === i)
      const mag = (v / base - 1) * 100
      if (ex) return ds.map(d => d === ex ? { ...d, value: v, mag, reviewed: false, at: now() } : d)
      return [...ds, { id: `ov-${sel}-${i}`, kind: 'override', node: sel, label: `${mLabel(i)} ${NODE[sel].label.toLowerCase()}`, start: i, value: v, mag, rationale: '', source: '', reviewed: false, by: 'You', at: now() }]
    })
    const d0: Dev = { id: '', kind: 'override', node: sel, label: '', start: i, value: v, mag: (v / base - 1) * 100, rationale: '', source: '', reviewed: false, by: '', at: '' }
    notify({ tone: 'info', text: devStatus(d0, tier) === 'needs' ? 'Grid edit logged. Add a rationale below the chart.' : 'Grid edit logged as a deviation.' })
  }
  const pick = (id: NodeId) => { setSel(id); if (stage === 'deviations') setNodeFilter(id); else if (stage !== 'baseline') setStage('baseline') }

  const rev = yv(model, 'rev', FY), revB = yv(model, 'rev', FY, 'base')
  return (
    <div className="min-h-dvh bg-background pb-20">
      {/* model header */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onBack} aria-label="Back to my models" className="grid h-9 w-9 place-items-center rounded-md text-text-2 hover:bg-surface-2"><ArrowLeft size={16} /></button>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold">{row.brand}<span className="text-[13px] font-normal text-text-2">{row.type}</span></p>
              <p className="text-[12px] text-text-3">{row.cycle} · {row.version} working · actuals through {mLabel(ACT - 1)} · horizon {row.horizon}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span title="Set per model in the configurator. Forecasters cannot change it." className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px] text-text-2"><Lock size={12} />Governance <b className="text-text">{TIERS[tier].label}</b></span>
            <Btn size="sm" variant={panel === 'log' ? 'primary' : 'secondary'} onClick={() => setPanel(p => p === 'log' ? null : 'log')} icon={<History size={14} />}>Rationale log{needs.length > 0 && <span className={cx('rounded-full px-1.5 font-mono text-[10px]', panel === 'log' ? 'bg-white/20' : 'bg-warn-soft text-warn')}>{needs.length}</span>}</Btn>
            <Btn size="sm" variant={panel === 'ai' ? 'primary' : 'secondary'} onClick={() => setPanel(p => p === 'ai' ? null : 'ai')} icon={<Sparkles size={14} />}>AI assist</Btn>
          </div>
        </div>
        {/* stage rail */}
        <div className="mx-auto max-w-[1400px] overflow-x-auto px-5 pb-3 sm:px-8">
          <ol className="flex min-w-[760px] items-stretch gap-1.5">
            {STAGES.map((s, k) => {
              const on = s.id === stage
              return (
                <li key={s.id} className="flex flex-1 items-center gap-1.5">
                  <button type="button" onClick={() => setStage(s.id)} aria-current={on ? 'step' : undefined} className={cx('flex-1 rounded-md border px-3 py-2 text-left transition-colors', on ? 'border-brand bg-brand text-white' : 'border-border bg-surface hover:border-brand/40')}>
                    <span className={cx('block text-[11px] font-semibold uppercase tracking-wider', on ? 'text-white/75' : 'text-text-3')}>{s.n} · {s.label}</span>
                    <span className="block text-[13px] font-medium">{s.sub}</span>
                  </button>
                  {k < STAGES.length - 1 && <ChevronRight size={14} className="shrink-0 text-text-3" />}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className={cx('mx-auto grid max-w-[1400px] gap-5 px-5 py-6 sm:px-8', panel ? 'lg:grid-cols-[230px_minmax(0,1fr)_340px]' : 'lg:grid-cols-[230px_minmax(0,1fr)]')}>
        <aside className="lg:sticky lg:top-6 lg:self-start"><FunnelNav model={model} sel={stage === 'baseline' || nodeFilter ? sel : null} onPick={pick} devs={devs} tier={tier} /></aside>

        <main className="min-w-0 space-y-5">
          {stage === 'orient' && <Orient model={model} devs={devs} tier={tier} gran={gran} saved={saved} published={published} onGo={setStage} onPick={pick} />}
          {stage === 'baseline' && <NodeWorkspace model={model} id={sel} gran={gran} tier={tier} devs={devs} setup={setup} setSetup={setSetup} add={add} patch={patch} remove={remove} editCell={editCell} scale={row.scale} notify={notify} />}
          {stage === 'deviations' && <Deviations model={model} devs={devs} tier={tier} filter={nodeFilter} setFilter={setNodeFilter} add={add} patch={patch} remove={remove} />}
          {stage === 'scenarios' && <Scenarios model={model} devs={devs} setup={setup} saved={saved} scale={row.scale} gran={gran}
            onSave={name => { setSaved(s => [...s, { id: `sv${Date.now()}`, name, devs, setup, at: now() }]); notify({ tone: 'ok', text: `Working scenario “${name}” saved. It is not published.` }) }}
            onLoad={s => { setDevs(s.devs); setSetup(s.setup); notify({ tone: 'info', text: `Loaded “${s.name}” as the working scenario.` }) }} />}
          {stage === 'publish' && <Publish row={row} model={model} devs={devs} tier={tier} saved={saved} published={published} onFix={() => { setStage('deviations'); setNodeFilter(null) }}
            onPublish={(name) => { setPublished(p => [...p, { name, at: now() }]); notify({ tone: 'ok', text: `Version “${name}” published to finance and the PBF team.` }) }} />}
        </main>

        {panel && <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-120px)] lg:self-start lg:overflow-auto">
          {panel === 'log' ? <RationaleLog devs={devs} tier={tier} patch={patch} remove={remove} onClose={() => setPanel(null)} /> : <AiPanel model={model} devs={devs} tier={tier} onClose={() => setPanel(null)} notify={notify} add={add} />}
        </aside>}
      </div>

      {/* always-on bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-2.5 sm:px-8">
          <div className="flex flex-wrap items-center gap-5 text-[13px]">
            <span><span className="text-text-3">FY{FY} net revenue </span><b className="font-mono">{fmt('rev', rev)}</b></span>
            <span><span className="text-text-3">vs baseline </span><b className={cx('font-mono', rev >= revB ? 'text-ok' : 'text-err')}>{rev >= revB ? '+' : '−'}{fmt('rev', Math.abs(rev - revB))}</b></span>
            <span><span className="text-text-3">Deviations </span><b>{devs.length}</b>{needs.length > 0 && <span className="ml-1 text-warn">· {needs.length} need rationale</span>}</span>
          </div>
          <div className="flex items-center gap-3">
            <Seg label="Grid granularity" value={gran} onChange={setGran} options={[{ id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }]} />
            <label className="hidden items-center gap-1.5 text-[12px] text-text-3 xl:flex" title="Design review only: preview the same screens in each governance tier.">Preview tier
              <select value={tier} onChange={e => setTier(e.target.value as Tier)} className="h-8 rounded-md border border-border-strong bg-surface px-1.5 text-[12px] text-text">{(Object.keys(TIERS) as Tier[]).map(t => <option key={t} value={t}>{TIERS[t].label}</option>)}</select></label>
            {stage !== 'publish' && <Btn size="sm" onClick={() => setStage(STAGES[STAGES.findIndex(s => s.id === stage) + 1]!.id)} icon={<ArrowRight size={14} />}>Next: {STAGES[STAGES.findIndex(s => s.id === stage) + 1]!.label}</Btn>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── 1 · Orient ───────── */
function Orient({ model, devs, tier, gran, saved, published, onGo, onPick }: { model: Model; devs: Dev[]; tier: Tier; gran: Gran; saved: Saved[]; published: { name: string; at: string }[]; onGo: (s: Stage) => void; onPick: (id: NodeId) => void }) {
  const rev = yv(model, 'rev', FY), revB = yv(model, 'rev', FY, 'base'), ly = yv(model, 'rev', 2026)
  const changes = [
    { icon: <Zap size={14} />, text: 'Actuals refreshed through Jul 2026 (+1 month).', tone: 'neutral' as const },
    { icon: <TrendingDown size={14} />, text: 'Brand share of class came in 0.6 pts below trend in Jul.', tone: 'warn' as const },
    ...devs.filter(d => d.by === 'You').map(d => ({ icon: <Flag size={14} />, text: `You added a ${DEV_LABEL[d.kind].toLowerCase()}: ${d.label}.`, tone: 'brand' as const })),
    { icon: <ShieldCheck size={14} />, text: `${devs.filter(d => d.reviewed).length} deviations reviewed by the brand lead since the last version.`, tone: 'ok' as const },
  ]
  return (
    <>
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Model home</h1>
        <p className="mt-1 text-sm text-text-2">What changed, where the forecast sits against its trend, and which funnel metrics have moved off it.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ k: `FY${FY} net revenue`, v: fmt('rev', rev), d: `${((rev / ly - 1) * 100).toFixed(1)}% vs FY26` }, { k: 'Deviation from baseline', v: `${rev >= revB ? '+' : '−'}${fmt('rev', Math.abs(rev - revB))}`, d: `${devs.length} logged deviations` }, { k: 'Last published', v: published.at(-1)!.name.split(' · ').at(-1)!, d: `${published.at(-1)!.at} · ${saved.length} working scenario${saved.length === 1 ? '' : 's'}` }].map(x => (
          <div key={x.k} className="rounded-2xl border border-border bg-surface shadow-card p-4"><p className="text-[12px] text-text-3">{x.k}</p><p className="mt-1 font-mono text-[22px] font-semibold">{x.v}</p><p className="text-[12px] text-text-2">{x.d}</p></div>
        ))}
      </div>
      <Card title="Net revenue: baseline vs forecast" sub="Dashed line is the trend-only baseline. The gap is explained entirely by logged deviations.">
        <TrendChart model={model} id="rev" gran={gran} />
      </Card>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Card title="What changed" sub="Since the last published version">
          <ul className="space-y-2.5">{changes.map((c, k) => <li key={k} className="flex gap-2.5 text-[13.5px]"><span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded', c.tone === 'warn' ? 'bg-warn-soft text-warn' : c.tone === 'ok' ? 'bg-ok-soft text-ok' : c.tone === 'brand' ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-text-2')}>{c.icon}</span>{c.text}</li>)}</ul>
        </Card>
        <Card title="On-trend signals" sub={`FY${FY} forecast vs trend, per funnel metric`} pad={false}>
          <ul className="divide-y divide-border">
            {NODES.map(n => {
              const f = yv(model, n.id, FY), b = yv(model, n.id, FY, 'base'), d = (f / b - 1) * 100
              const s = Math.abs(d) < 1 ? 'on' : d > 0 ? 'above' : 'below'
              return (
                <li key={n.id}><button type="button" onClick={() => onPick(n.id)} className="flex w-full items-center gap-3 px-5 py-2 text-left text-[13px] hover:bg-surface-2/60">
                  <span className={cx('grid h-5 w-5 place-items-center rounded-full', s === 'on' ? 'bg-ok-soft text-ok' : s === 'above' ? 'bg-brand-soft text-brand' : 'bg-warn-soft text-warn')}>{s === 'on' ? <Minus size={11} /> : s === 'above' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}</span>
                  <span className="flex-1 truncate">{n.label}{n.kind === 'derived' && <Lock size={10} className="ml-1 inline text-text-3" />}</span>
                  <span className="font-mono text-text-2">{fmt(n.id, f)}</span>
                  <span className={cx('w-24 text-right text-[12px] font-medium', s === 'on' ? 'text-ok' : s === 'above' ? 'text-brand' : 'text-warn')}>{s === 'on' ? 'On trend' : `${d > 0 ? '+' : ''}${d.toFixed(1)}% vs trend`}</span>
                </button></li>
              )
            })}
          </ul>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2"><Btn onClick={() => onGo('baseline')} icon={<Layers size={15} />}>Review the baseline</Btn><Btn variant="secondary" onClick={() => onGo('deviations')}>Go to deviations{devs.some(d => devStatus(d, tier) === 'needs') && <Tag tone="warn">{devs.filter(d => devStatus(d, tier) === 'needs').length}</Tag>}</Btn></div>
    </>
  )
}

/* ───────── 2 · Baseline: node workspace ───────── */
function NodeWorkspace({ model, id, gran, tier, devs, setup, setSetup, add, patch, remove, editCell, scale, notify }: {
  model: Model; id: NodeId; gran: Gran; tier: Tier; devs: Dev[]; setup: Setup; setSetup: (f: (s: Setup) => Setup) => void
  add: (d: Omit<Dev, 'id' | 'by' | 'at' | 'reviewed' | 'mag'>) => void; patch: (id: string, p: Partial<Dev>) => void; remove: (id: string) => void; editCell: (i: number, v: number) => void; scale: number; notify: Notify
}) {
  const n = NODE[id]
  const derived = n.kind === 'derived'
  const method = setup.methods[id] ?? 'blaze'
  const h = derived ? [] : history(id, scale)
  const cagr = setup.cagr[id] ?? (derived ? 0 : defaultCagr(h))
  const [tgt, setTgt] = useState<{ value: string; by: number; shape: Dev['shape'] } | null>(null)
  const [gs, setGs] = useState<{ year: number; value: string; driver: NodeId } | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [sources, setSources] = useState<Record<string, string>>({})
  const nodeDevs = devs.filter(d => d.node === id)
  const pend = nodeDevs.filter(d => devStatus(d, tier) === 'needs')
  const goalTarget: NodeId = derived ? id : 'rev'
  const gsCur = gs ? yv(model, goalTarget, gs.year) : 0
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-text-3">{derived ? <><Lock size={12} />Derived node · read-only</> : 'Input node'}</p>
          <h1 className="text-[24px] font-semibold tracking-tight">{n.label} <span className="text-base font-normal text-text-3">{n.unit}</span></h1>
          <p className="mt-0.5 text-sm text-text-2">{derived ? <>= {n.formula}. To change it, edit a driver upstream or use goal seek.</> : 'History and trend set the baseline. Anything you change from here is logged as a deviation.'}</p>
        </div>
        <div className="text-right"><p className="text-[12px] text-text-3">FY{FY} forecast</p><p className="font-mono text-xl font-semibold">{fmt(id, yv(model, id, FY))}</p><p className="text-[12px] text-text-2">Baseline {fmt(id, yv(model, id, FY, 'base'))}</p></div>
      </div>

      <div className={cx('flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-[13px]', tier === 'tight' ? 'border-brand/25 bg-brand-soft/60' : tier === 'standard' ? 'border-border bg-surface' : 'border-ok/25 bg-ok-soft/60')}>
        <ShieldCheck size={15} className="mt-0.5 shrink-0" /><p><b>{TIERS[tier].label} governance.</b> {TIERS[tier].rule}</p>
      </div>

      <Card title="History and trend" right={derived && <span className="flex flex-wrap gap-1">{n.upstream!.filter(u => NODE[u].kind === 'input').map(u => <Tag key={u}>{NODE[u].label}</Tag>)}</span>}>
        <TrendChart model={model} id={id} gran={gran} />
      </Card>

      {pend.length > 0 && <Card title={<span className="flex items-center gap-2"><CircleAlert size={15} className="text-warn" />Rationale needed on this node</span>} sub="Add the reason before publishing."><div className="space-y-3">{pend.map(d => <DevCard key={d.id} d={d} tier={tier} onChange={p => patch(d.id, p)} onRemove={() => remove(d.id)} />)}</div></Card>}

      {!derived && <Card title="Baseline method" sub="Trend methods set the baseline. A target by date is a deviation and is logged.">
        <div className="grid gap-2 sm:grid-cols-5">
          {METHODS.map(m => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setSetup(s => ({ ...s, methods: { ...s.methods, [id]: m.id as Method } }))} className={cx('rounded-md border p-3 text-left transition-colors', method === m.id ? 'border-brand bg-brand-soft/60' : 'border-border hover:border-border-strong')}>
              <span className="flex items-center justify-between text-[13.5px] font-semibold">{m.label}{method === m.id && <Check size={14} className="text-brand" />}</span>
              <span className="text-[12px] text-text-2">{m.hint}</span>
            </button>
          ))}
          <button type="button" onClick={() => setTgt(t => t ? null : { value: yv(model, id, 2030).toFixed(n.dp), by: idxOf(2030, 11), shape: 's-curve' })} className={cx('rounded-md border border-dashed p-3 text-left transition-colors', tgt ? 'border-brand bg-brand-soft/40' : 'border-border-strong hover:border-brand/50')}>
            <span className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Target size={14} />Target by date</span><span className="text-[12px] text-text-2">Logs a deviation</span>
          </button>
        </div>
        {method === 'cagr' && <label className="mt-3 flex items-center gap-2 text-[13px]">Annual rate<input type="number" step={0.1} value={Number(cagr.toFixed(2))} onChange={e => setSetup(s => ({ ...s, cagr: { ...s.cagr, [id]: Number(e.target.value) } }))} className={cx(field, 'w-24')} />% p.a.<span className="text-text-3">· fitted {defaultCagr(h).toFixed(2)}%</span></label>}
        {tgt && <div className="mt-4 grid items-end gap-3 rounded-md bg-surface-2/70 p-3 sm:grid-cols-[140px_1fr_170px_auto]">
          <label className="text-[12px] text-text-3">Reach value<input value={tgt.value} onChange={e => setTgt({ ...tgt, value: e.target.value })} className={cx(field, 'mt-1')} /></label>
          <label className="text-[12px] text-text-3">By<div className="mt-1"><MonthPick value={tgt.by} onChange={by => setTgt({ ...tgt, by })} /></div></label>
          <label className="text-[12px] text-text-3">Curve shape<select value={tgt.shape} onChange={e => setTgt({ ...tgt, shape: e.target.value as Dev['shape'] })} className={cx(field, 'mt-1')}><option value="s-curve">S-curve</option><option value="linear">Linear</option><option value="fast">Fast then flat</option></select></label>
          <Btn onClick={() => { const v = Number(tgt.value); if (!Number.isFinite(v)) return; add({ kind: 'target', node: id, label: `${n.label} reaches ${fmt(id, v)} by ${mLabel(tgt.by)}`, start: ACT, end: tgt.by, value: v, shape: tgt.shape, rationale: '', source: '' }); setTgt(null); notify({ tone: 'ok', text: 'Target logged as a deviation.' }) }}>Add target</Btn>
        </div>}
      </Card>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Source" sub="Where this node’s history and trend come from">
          <div className="flex items-center gap-2.5 text-[13.5px]"><Paperclip size={15} className="text-text-3" /><span className="font-medium">{sources[id] ?? n.source}</span>{!derived && <Tag tone="ok">Actuals to {mLabel(ACT - 1)}</Tag>}</div>
          {!derived && (src === null
            ? <Btn size="sm" variant="secondary" onClick={() => setSrc('')} icon={<FileUp size={14} />}>Attach source</Btn>
            : <div className="mt-3 flex gap-2"><input autoFocus value={src} onChange={e => setSrc(e.target.value)} placeholder="e.g. IQVIA NPA extract Aug 2026.xlsx" className={field} /><Btn size="sm" disabled={!src.trim()} onClick={() => { setSources(s => ({ ...s, [id]: src })); setSrc(null); notify({ tone: 'ok', text: 'Source attached to node.' }) }}>Attach</Btn></div>)}
        </Card>
        <Card title="Goal seek" sub={`Solve a ${derived ? n.label.toLowerCase() : 'net revenue'} goal by moving one upstream driver. Logged as a deviation.`}>
          {!gs ? <Btn size="sm" variant="secondary" icon={<Target size={14} />} onClick={() => setGs({ year: FY, value: (yv(model, goalTarget, FY) * 1.05).toFixed(NODE[goalTarget].dp), driver: derived ? n.upstream!.filter(u => NODE[u].kind === 'input').at(-1)! : id })}>Set a goal</Btn>
            : <div className="grid gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[12px] text-text-3">{NODE[goalTarget].label} in<select value={gs.year} onChange={e => setGs({ ...gs, year: Number(e.target.value) })} className={cx(field, 'mt-1')}>{YEARS.filter(y => y >= 2027).map(y => <option key={y}>{y}</option>)}</select></label>
                <label className="text-[12px] text-text-3">Goal ({NODE[goalTarget].unit})<input value={gs.value} onChange={e => setGs({ ...gs, value: e.target.value })} className={cx(field, 'mt-1')} /></label>
              </div>
              <label className="text-[12px] text-text-3">By moving<select value={gs.driver} onChange={e => setGs({ ...gs, driver: e.target.value as NodeId })} className={cx(field, 'mt-1')}>{(NODE[goalTarget].upstream ?? []).filter(u => NODE[u].kind === 'input').map(u => <option key={u} value={u}>{NODE[u].label}</option>)}</select></label>
              <p className="text-[12.5px] text-text-2">Needs <b className="font-mono">{((Number(gs.value) / gsCur - 1) * 100).toFixed(1)}%</b> on {NODE[gs.driver].label.toLowerCase()} through {gs.year} (now {fmt(goalTarget, gsCur)}).</p>
              <div className="flex gap-2"><Btn size="sm" onClick={() => { const pct = (Number(gs.value) / gsCur - 1) * 100; if (!Number.isFinite(pct)) return; add({ kind: 'goalseek', node: gs.driver, label: `Goal seek: ${NODE[goalTarget].label} ${fmt(goalTarget, Number(gs.value))} in ${gs.year}`, start: idxOf(gs.year, 0), end: idxOf(gs.year, 11), value: pct, rationale: '', source: '' }); setGs(null); notify({ tone: 'ok', text: 'Goal seek applied and logged.' }) }}>Apply</Btn><Btn size="sm" variant="ghost" onClick={() => setGs(null)}>Cancel</Btn></div>
            </div>}
        </Card>
      </div>

      <Card title={`Grid · ${gran}`} sub={derived ? 'Calculated from upstream nodes. Cells are locked.' : gran === 'monthly' ? 'Edit any forecast cell directly. Edited cells are tagged and logged.' : 'Yearly view aggregates the monthly detail.'} pad={false} right={nodeDevs.length > 0 && <Tag tone="brand">{nodeDevs.length} deviation{nodeDevs.length > 1 ? 's' : ''}</Tag>}>
        <Grid model={model} id={id} gran={gran} devs={devs} tier={tier} onEdit={editCell} />
      </Card>
    </>
  )
}

/* ───────── 3 · Deviations ───────── */
function Deviations({ model, devs, tier, filter, setFilter, add, patch, remove }: { model: Model; devs: Dev[]; tier: Tier; filter: NodeId | null; setFilter: (n: NodeId | null) => void; add: (d: Omit<Dev, 'id' | 'by' | 'at' | 'reviewed' | 'mag'>) => void; patch: (id: string, p: Partial<Dev>) => void; remove: (id: string) => void }) {
  const [kind, setKind] = useState<DevKind | 'all'>('all')
  const [form, setForm] = useState<{ label: string; node: NodeId; start: number; end: number | null; value: string } | null>(null)
  const shown = devs.filter(d => (!filter || d.node === filter) && (kind === 'all' || d.kind === kind)).sort((a, b) => a.start - b.start)
  const span = N - ACT
  const pos = (i: number) => `${((i - ACT) / span) * 100}%`
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[24px] font-semibold tracking-tight">Deviations</h1><p className="mt-1 text-sm text-text-2">Every move away from the baseline: events, targets, grid edits and goal seek. Each one carries its rationale.</p></div>
        <Btn icon={<Plus size={15} />} onClick={() => setForm({ label: '', node: filter && NODE[filter].kind === 'input' ? filter : 'brand', start: idxOf(2027, 0), end: null, value: '-5' })}>Add event</Btn>
      </div>

      <Card title="Events timeline" sub={`${mLabel(ACT)} → ${mLabel(N - 1)}`}>
        <div className="relative h-[86px]">
          <div className="absolute inset-x-0 top-[38px] h-px bg-border-strong" />
          {YEARS.filter(y => idxOf(y, 0) >= ACT).map(y => <span key={y} className="absolute top-[44px] -translate-x-1/2 text-[10px] text-text-3" style={{ left: pos(idxOf(y, 0)) }}>{y}</span>)}
          {devs.filter(d => d.kind !== 'override').map((d, k) => {
            const s = devStatus(d, tier)
            return (
              <div key={d.id} className="absolute" style={{ left: pos(d.start), width: d.end !== undefined ? `calc(${pos(d.end)} - ${pos(d.start)})` : undefined, top: 8 + (k % 2) * 12 }}>
                <button type="button" title={`${d.label} · ${mLabel(d.start)}`} onClick={() => setFilter(d.node)} className={cx('flex h-2.5 min-w-2.5 items-center rounded-full', s === 'needs' ? 'bg-warn' : d.kind === 'target' ? 'bg-ok' : 'bg-brand')} style={{ width: d.end !== undefined ? '100%' : 10 }} />
              </div>
            )
          })}
          <div className="absolute bottom-0 left-0 flex gap-3 text-[11px] text-text-3"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brand" />Event</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-ok" />Target</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-warn" />Rationale needed</span></div>
        </div>
      </Card>

      {form && <Card title="New event" right={<button type="button" onClick={() => setForm(null)} aria-label="Close" className="text-text-3 hover:text-text"><X size={16} /></button>}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1.2fr_1.2fr_110px]">
          <label className="text-[12px] text-text-3">Event<input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Formulary win at CVS" className={cx(field, 'mt-1')} /></label>
          <label className="text-[12px] text-text-3">Affects<select value={form.node} onChange={e => setForm({ ...form, node: e.target.value as NodeId })} className={cx(field, 'mt-1')}>{INPUTS.map(i => <option key={i} value={i}>{NODE[i].label}</option>)}</select></label>
          <label className="text-[12px] text-text-3">Starts<div className="mt-1"><MonthPick value={form.start} onChange={start => setForm({ ...form, start })} /></div></label>
          <label className="text-[12px] text-text-3">Ends <span className="normal-case">(optional)</span>{form.end === null ? <button type="button" onClick={() => setForm({ ...form, end: Math.min(N - 1, form.start + 11) })} className={cx(field, 'mt-1 text-left text-text-3')}>Ongoing · set end</button> : <div className="mt-1"><MonthPick value={form.end} min={form.start} onChange={end => setForm({ ...form, end })} /></div>}</label>
          <label className="text-[12px] text-text-3">Impact %<input type="number" step={0.5} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className={cx(field, 'mt-1')} /></label>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setForm(null)}>Cancel</Btn><Btn disabled={!form.label.trim() || !Number.isFinite(Number(form.value))} onClick={() => { add({ kind: 'event', node: form.node, label: form.label.trim(), start: form.start, end: form.end ?? undefined, value: Number(form.value), rationale: '', source: '' }); setForm(null) }}>Add event</Btn></div>
      </Card>}

      <div className="flex flex-wrap items-center gap-2">
        <Seg label="Deviation type" value={kind} onChange={setKind} options={[{ id: 'all', label: `All ${devs.length}` }, ...(['event', 'target', 'override', 'goalseek'] as DevKind[]).map(k => ({ id: k, label: `${DEV_LABEL[k]}s ${devs.filter(d => d.kind === k).length}` }))]} />
        {filter && <button type="button" onClick={() => setFilter(null)} className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-soft px-2.5 text-[13px] font-medium text-brand">{NODE[filter].label}<X size={13} /></button>}
      </div>
      <div className="space-y-3">
        {shown.map(d => <DevCard key={d.id} d={d} tier={tier} onChange={p => patch(d.id, p)} onRemove={() => remove(d.id)} />)}
        {shown.length === 0 && <p className="rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-text-2">No deviations here. {filter && NODE[filter].kind === 'derived' ? 'Derived nodes never carry deviations; they move when their drivers do.' : 'This node follows its trend.'}</p>}
      </div>
      <p className="text-[12px] text-text-3">FY{FY} impact of all deviations: <b className="font-mono text-text-2">{fmt('rev', yv(model, 'rev', FY) - yv(model, 'rev', FY, 'base'))}</b></p>
    </>
  )
}

/* ───────── 4 · Scenarios ───────── */
function Scenarios({ model, devs, setup, saved, scale, gran, onSave, onLoad }: { model: Model; devs: Dev[]; setup: Setup; saved: Saved[]; scale: number; gran: Gran; onSave: (n: string) => void; onLoad: (s: Saved) => void }) {
  const [name, setName] = useState(`Working ${saved.length}`)
  const [cmp, setCmp] = useState<string[]>(saved.slice(0, 1).map(s => s.id))
  const [year, setYear] = useState(FY)
  const extra = useMemo(() => [{ name: 'Working', m: model }, ...saved.filter(s => cmp.includes(s.id)).map(s => ({ name: s.name, m: compute(s.setup, s.devs, scale) }))], [model, saved, cmp, scale])
  const bridge = useMemo(() => {
    const steps: [string, DevKind[]][] = [['Targets', ['target']], ['Events', ['target', 'event']], ['Goal seek', ['target', 'event', 'goalseek']], ['Grid edits', ['target', 'event', 'goalseek', 'override']]]
    let prev = yv(model, 'rev', year, 'base')
    const out: [string, number][] = [['Baseline (trend)', prev]]
    for (const [label, ks] of steps) { const v = yv(compute(setup, devs.filter(d => ks.includes(d.kind)), scale), 'rev', year); out.push([label, v - prev]); prev = v }
    return { rows: out, total: prev }
  }, [model, setup, devs, scale, year])
  const max = Math.max(...bridge.rows.map(r => Math.abs(r[1])), bridge.total)
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[24px] font-semibold tracking-tight">Scenarios</h1><p className="mt-1 text-sm text-text-2">Save working versions as you go and compare them. Saving never publishes.</p></div>
        <div className="flex gap-2"><input aria-label="Scenario name" value={name} onChange={e => setName(e.target.value)} className={cx(field, 'w-52')} /><Btn icon={<Save size={15} />} disabled={!name.trim()} onClick={() => { onSave(name.trim()); setName(`Working ${saved.length + 1}`) }}>Save working scenario</Btn></div>
      </div>
      <Card title="Compare net revenue" right={<div className="flex flex-wrap gap-1.5">{saved.map(s => <button key={s.id} type="button" aria-pressed={cmp.includes(s.id)} onClick={() => setCmp(c => c.includes(s.id) ? c.filter(x => x !== s.id) : [...c, s.id].slice(-3))} className={cx('rounded-md border px-2 py-1 text-[12px] font-medium', cmp.includes(s.id) ? 'border-brand bg-brand-soft text-brand' : 'border-border text-text-2 hover:border-border-strong')}>{s.name}</button>)}</div>}>
        <TrendChart model={model} id="rev" gran={gran} extra={extra} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-3"><th className="py-2 pr-3 font-semibold">Scenario</th>{YEARS.filter(y => y >= 2026 && y <= 2031).map(y => <th key={y} className="px-2 py-2 text-right font-semibold">{y}</th>)}<th className="py-2 pl-2 font-semibold" /></tr></thead>
            <tbody>
              {[{ id: 'w', name: 'Working (unsaved)', m: model, s: null as Saved | null, at: 'now', n: devs.length }, ...saved.map(s => ({ id: s.id, name: s.name, m: compute(s.setup, s.devs, scale), s, at: s.at, n: s.devs.length }))].map(r => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pr-3"><p className="font-medium">{r.name}</p><p className="text-[11px] text-text-3">{r.n} deviations · {r.at}</p></td>
                  {YEARS.filter(y => y >= 2026 && y <= 2031).map(y => <td key={y} className="px-2 py-2 text-right font-mono">{fmt('rev', yv(r.m, 'rev', y))}</td>)}
                  <td className="py-2 pl-2 text-right">{r.s && <Btn size="sm" variant="ghost" onClick={() => onLoad(r.s!)}>Load</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Bridge: baseline to forecast" sub="Standard output. Final bridges and sensitivity are pending client decision 5." right={<select aria-label="Bridge year" value={year} onChange={e => setYear(Number(e.target.value))} className={cx(field, 'w-24')}>{YEARS.filter(y => y >= 2026).map(y => <option key={y}>{y}</option>)}</select>}>
          <ul className="space-y-2">
            {[...bridge.rows, ['Forecast', bridge.total] as [string, number]].map(([k, v], i, a) => {
              const end = i === 0 || i === a.length - 1
              return (
                <li key={k} className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-[13px]">
                  <span className={cx(end && 'font-semibold')}>{k}</span>
                  <span className="h-4 rounded-sm bg-surface-2"><span className={cx('block h-full rounded-sm', end ? 'bg-text' : v >= 0 ? 'bg-ok' : 'bg-err')} style={{ width: `${Math.max(1, Math.abs(v) / max * 100)}%` }} /></span>
                  <span className={cx('text-right font-mono', !end && (v >= 0 ? 'text-ok' : 'text-err'))}>{end ? fmt('rev', v) : `${v >= 0 ? '+' : '−'}${fmt('rev', Math.abs(v))}`}</span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="Standard outputs" sub="Generated from the working scenario">
          <ul className="divide-y divide-border text-[13px]">
            {['Net revenue by year (10-year)', 'Patient funnel by year', 'TRx and net price by month', 'Deviation register with rationale'].map(o => <li key={o} className="flex items-center justify-between py-2">{o}<Tag tone="ok">Ready</Tag></li>)}
            <li className="flex items-center justify-between py-2 text-text-3">Custom outputs via AI chat<Tag>Designed · not in MVP</Tag></li>
          </ul>
        </Card>
      </div>
    </>
  )
}

/* ───────── 5 · Publish ───────── */
function Publish({ row, model, devs, tier, saved, published, onFix, onPublish }: { row: ModelRow; model: Model; devs: Dev[]; tier: Tier; saved: Saved[]; published: { name: string; at: string }[]; onFix: () => void; onPublish: (n: string) => void }) {
  const [name, setName] = useState(`${row.cycle} · Jul actuals · ${row.version.replace(/\d+$/, d => String(Number(d) + 1))}`)
  const [notes, setNotes] = useState('')
  const missRat = devs.filter(d => TIERS[tier].needRat(d) && !d.rationale.trim()).length
  const missSrc = TIERS[tier].needSrc ? devs.filter(d => !d.source.trim()).length : 0
  const checks = [
    { ok: true, label: `Actuals loaded through ${mLabel(ACT - 1)}` },
    { ok: missRat === 0, label: missRat ? `${missRat} deviation${missRat > 1 ? 's' : ''} missing a rationale` : 'Every required rationale is written', soft: !TIERS[tier].blocks },
    ...(TIERS[tier].needSrc ? [{ ok: missSrc === 0, label: missSrc ? `${missSrc} deviation${missSrc > 1 ? 's' : ''} missing a source` : 'Every deviation has a source' }] : []),
    { ok: saved.length > 1, label: saved.length > 1 ? 'At least one working scenario saved' : 'Save a working scenario to keep a restore point', soft: true },
    { ok: !!name.trim(), label: 'Version is named' },
  ]
  const blocked = checks.some(c => !c.ok && !c.soft)
  return (
    <>
      <div><h1 className="text-[24px] font-semibold tracking-tight">Publish</h1><p className="mt-1 text-sm text-text-2">Publishing releases a named version to finance and the PBF team. It is separate from saving a working scenario.</p></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card title="Completeness check" sub={`${TIERS[tier].label} governance · ${TIERS[tier].rule}`}>
          <ul className="space-y-2.5">{checks.map(c => <li key={c.label} className="flex items-start gap-2.5 text-[13.5px]">{c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" /> : <CircleAlert size={16} className={cx('mt-0.5 shrink-0', c.soft ? 'text-text-3' : 'text-warn')} />}<span className={cx(!c.ok && !c.soft && 'font-medium')}>{c.label}{!c.ok && c.soft && <span className="text-text-3"> · optional</span>}</span></li>)}</ul>
          {(missRat > 0 || missSrc > 0) && <Btn size="sm" variant="secondary" onClick={onFix}>Fix in deviations</Btn>}
        </Card>
        <Card title="Name and release">
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-text-3">Version name<input value={name} onChange={e => setName(e.target.value)} className={cx(field, 'mt-1 normal-case tracking-normal')} /></label>
          <label className="mt-3 block text-[12px] font-semibold uppercase tracking-wide text-text-3">Notes for reviewers<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What moved and why, in a sentence or two" className="mt-1 w-full rounded-md border border-border-strong px-2.5 py-1.5 text-sm normal-case tracking-normal outline-none focus:border-brand" /></label>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-surface-2/70 px-3 py-2 text-[13px]"><span>FY{FY} net revenue</span><b className="font-mono">{fmt('rev', yv(model, 'rev', FY))}</b></div>
          <div className="mt-4 flex justify-end"><Btn disabled={blocked} icon={<Send size={15} />} onClick={() => onPublish(name.trim())}>Publish version</Btn></div>
        </Card>
      </div>
      <Card title="Published versions" pad={false}>
        <ul className="divide-y divide-border">{[...published].reverse().map(p => <li key={p.name + p.at} className="flex items-center justify-between px-5 py-2.5 text-[13px]"><span className="flex items-center gap-2 font-medium"><Boxes size={14} className="text-text-3" />{p.name}</span><span className="text-text-3">{p.at}</span></li>)}</ul>
      </Card>
    </>
  )
}

/* ───────── always-on panels ───────── */
function RationaleLog({ devs, tier, patch, remove, onClose }: { devs: Dev[]; tier: Tier; patch: (id: string, p: Partial<Dev>) => void; remove: (id: string) => void; onClose: () => void }) {
  const sorted = [...devs].sort((a, b) => Number(devStatus(b, tier) === 'needs') - Number(devStatus(a, tier) === 'needs'))
  return (
    <Card title="Rationale log" sub={`${TIERS[tier].label}: ${TIERS[tier].rule}`} right={<button type="button" onClick={onClose} aria-label="Close rationale log" className="text-text-3 hover:text-text"><X size={16} /></button>}>
      <div className="space-y-2.5">{sorted.map(d => <DevCard key={d.id} d={d} tier={tier} onChange={p => patch(d.id, p)} onRemove={() => remove(d.id)} compact={devStatus(d, tier) !== 'needs'} />)}</div>
    </Card>
  )
}

function AiPanel({ model, devs, tier, onClose, notify, add }: { model: Model; devs: Dev[]; tier: Tier; onClose: () => void; notify: Notify; add: (d: Omit<Dev, 'id' | 'by' | 'at' | 'reviewed' | 'mag'>) => void }) {
  const [tab, setTab] = useState<'import' | 'chat'>('import')
  const [step, setStep] = useState(0)
  const [msgs, setMsgs] = useState<{ me: boolean; t: string }[]>([{ me: false, t: 'Ask about the forecast output. I answer from the working scenario.' }])
  const [q, setQ] = useState('')
  const Q = [
    { q: 'I found a “Formulary win: Express Scripts” event, +2.5% on brand share from Jan 2027. Add it?', a: 'Yes, add it' },
    { q: 'Column “Px_net” maps to Net price. Correct?', a: 'Confirm mapping' },
    { q: 'The file has no source note. Use the file name as the source?', a: 'Use file name' },
  ]
  const answer = (t: string) => {
    const s = t.toLowerCase()
    const f = yv(model, 'rev', FY), b = yv(model, 'rev', FY, 'base')
    const big = [...devs].sort((x, y) => Math.abs(y.mag) - Math.abs(x.mag))[0]
    if (s.includes('why') || s.includes('baseline') || s.includes('differ')) return `FY${FY} sits ${fmt('rev', f - b)} vs the trend baseline across ${devs.length} deviations. The largest single move is “${big?.label ?? 'none'}”.`
    if (s.includes('peak')) { const y = yearly(model.fc.rev, 'sum'); const k = y.indexOf(Math.max(...y)); return `Net revenue peaks in ${START_YEAR + k} at ${fmt('rev', y[k]!)}.` }
    if (s.includes('rationale') || s.includes('missing')) return `${devs.filter(d => devStatus(d, tier) === 'needs').length} deviations still need a rationale under ${TIERS[tier].label.toLowerCase()} governance.`
    return `FY${FY} net revenue is ${fmt('rev', f)} from ${fmt('trx', yv(model, 'trx', FY))}K TRx at ${fmt('price', yv(model, 'price', FY))} per Rx.`
  }
  return (
    <Card title={<span className="flex items-center gap-2"><Bot size={16} className="text-brand" />AI assist</span>} sub="Low fidelity · entry points only" right={<button type="button" onClick={onClose} aria-label="Close AI assist" className="text-text-3 hover:text-text"><X size={16} /></button>}>
      <Seg label="AI mode" value={tab} onChange={setTab} options={[{ id: 'import', label: <span className="flex items-center gap-1"><FileUp size={13} />File import</span> }, { id: 'chat', label: <span className="flex items-center gap-1"><MessageSquareText size={13} />Output chat</span> }]} />
      {tab === 'import' ? (
        <div className="mt-4 space-y-3">
          {step === 0 ? <button type="button" onClick={() => setStep(1)} className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-strong p-6 text-center text-[13px] text-text-2 hover:border-brand/50"><FileUp size={20} className="text-text-3" />Drop a brand team file<span className="text-[12px] text-text-3">Try: Nurtec_brand_inputs_Sep.xlsx</span></button>
            : <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]"><Paperclip size={13} />Nurtec_brand_inputs_Sep.xlsx</p>}
          {step >= 1 && Q.slice(0, Math.min(step, 3)).map((x, k) => (
            <div key={k} className="rounded-md border border-border p-3 text-[13px]">
              <p>{x.q}</p>
              {step === k + 1 ? <div className="mt-2 flex gap-2"><Btn size="sm" onClick={() => { if (k === 0) add({ kind: 'event', node: 'brand', label: 'Formulary win: Express Scripts', start: idxOf(2027, 0), value: 2.5, rationale: 'Imported from brand team file; contract signed Sep 2026.', source: 'Nurtec_brand_inputs_Sep.xlsx' }); setStep(step + 1); if (k === 2) notify({ tone: 'ok', text: 'Import confirmed. 1 event added to deviations.' }) }}>{x.a}</Btn><Btn size="sm" variant="ghost" onClick={() => setStep(step + 1)}>Skip</Btn></div> : <p className="mt-1.5 flex items-center gap-1 text-[12px] text-ok"><Check size={12} />Done</p>}
            </div>
          ))}
          {step > 3 && <p className="text-[12.5px] text-text-2">Quick confirm interview complete. Everything imported is logged with its source.</p>}
        </div>
      ) : (
        <div className="mt-4">
          <div className="max-h-[360px] space-y-2 overflow-auto">{msgs.map((m, k) => <p key={k} className={cx('rounded-lg px-3 py-2 text-[13px]', m.me ? 'ml-6 bg-brand text-white' : 'mr-6 bg-surface-2')}>{m.t}</p>)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{['Why does it differ from baseline?', 'When do we peak?', 'What rationale is missing?'].map(s => <button key={s} type="button" onClick={() => setMsgs(m => [...m, { me: true, t: s }, { me: false, t: answer(s) }])} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-text-2 hover:border-brand/50">{s}</button>)}</div>
          <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); if (!q.trim()) return; setMsgs(m => [...m, { me: true, t: q }, { me: false, t: answer(q) }]); setQ('') }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about the output" className={field} /><Btn size="sm" icon={<Send size={13} />}>Ask</Btn></form>
        </div>
      )}
    </Card>
  )
}

import type { MutableRefObject, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ClipboardPaste, Lock, PencilLine, RotateCcw, Upload, Users } from 'lucide-react'
import {
  ACT, ACTUALS, BASELINE, CURVE_LABEL, DRIVERS, DRV, FY, GTN, METHOD_LABEL, MONTHS, N, OUTPUTS, UNBIASED, YEARS,
  applyEdit, defaultEdit, fmtV, fyAvg, idxOf, mLong, revenue, yearOf, fySum,
} from './engine'
import type { Curve, DriverId, Edit, EventDef, Layer, Method, ModelCfg, OutputId, Scenario } from './engine'
import { Btn, Card, ForecastChart, Label, Legend, Seg, Tag, Toggle, cx, field } from './ui'
import { AgentFrame } from '../../chat/Agent'
import { TrendPanel } from './Trend'
import { bridgeOf, fmtB, ueFy } from './Modules'
import type { ModId } from './Modules'
import { useAgentFocus } from './agent'
import type { ChartSeries } from './ui'

const FULL_ACTUALS: Layer = Object.fromEntries(DRIVERS.map(d => [d.id, UNBIASED[d.id].map((v, i) => i < ACT ? ACTUALS[d.id][i]! : v)])) as Layer
export type Edits = Partial<Record<DriverId, Edit>>
export type Notify = (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void
export type Sel = DriverId | 'rev'

/* ───────── Forecast map (left anchor, generated from the configured model) ───────── */
export function OutputSelect({ model, metric, onChange }: { model: ModelCfg; metric: OutputId; onChange: (m: OutputId) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-text-3">Output
      <select value={metric} onChange={e => onChange(e.target.value as OutputId)} aria-label="Output metric" className={cx(field, 'w-40 normal-case tracking-normal text-text')}>{model.outputs.map(o => <option key={o} value={o}>{OUTPUTS[o].label}</option>)}</select></label>
  )
}

export type MapProps = {
  sel: Sel; metric: OutputId; onSel: (s: Sel) => void; mod: ModId | null; onMod: (m: ModId) => void; onOutcome: (m: OutputId) => void
  edits: Edits; reference: Layer; layer: Layer; scenario: Scenario | null; events: EventDef[]; model: ModelCfg; ue: number[]; woh: number; year: number
}
const signed = (d: number, txt: string) => `${d >= 0 ? '+' : '−'}${txt}`
/** The funnel from the forecast page of the team's reference build: stages that narrow towards revenue, each node showing the selected scenario's value and its change against the active forecast. */
export function ForecastMap({ sel, metric, onSel, mod, onMod, onOutcome, edits, reference: ref, layer, scenario: sc, events, model, ue, woh, year }: MapProps) {
  const agent = useAgentFocus()
  const has = (id: DriverId) => model.modules.some(m => m.id === id)
  const editable = (id: DriverId) => model.modules.find(m => m.id === id)?.editable !== false
  const evN = (id: DriverId) => sc ? events.filter(e => sc.active.includes(e.id) && e.impacts.some(i => i.metric === id)).length : 0
  const moved = (id: DriverId) => sc ? !!sc.adj[id] || (sc.ovr ?? []).some(o => o.driver === id) : !!edits[id]
  const net = fySum(revenue(layer), year), netRef = fySum(revenue(ref), year)
  const b = bridgeOf(net, ueFy(ue), woh), bRef = bridgeOf(netRef, ueFy(ue), woh)

  type N = { key: string; label: string; step?: string; value: string; delta?: number; dtxt?: string; on: boolean; kind: 'input' | 'calc' | 'locked' | 'outcome'; onClick?: () => void; mark?: boolean; ev?: number; live?: boolean; inv?: boolean }
  const Node = (n: N) => {
    const hot = n.delta !== undefined && Math.abs(n.delta) > 0.005 && n.dtxt
    const inner = (
      <>
        <span className="min-w-0">
          {n.step && <span className={cx('block truncate text-[9.5px] font-semibold uppercase tracking-wider', n.on ? 'text-white/70' : 'text-text-3')}>{n.step}</span>}
          <span className="flex items-center gap-1 truncate text-[12.5px] font-semibold">{n.label}
            {n.mark && <span title={sc ? 'Changed in this scenario' : 'Modified in the active forecast'} className={cx('h-1.5 w-1.5 shrink-0 rounded-full', n.on ? 'bg-white' : 'bg-brand')} />}
            {!!n.ev && <span title={`${n.ev} event${n.ev > 1 ? 's' : ''} move this`} className={cx('shrink-0 rounded-full border px-1 text-[9px] font-bold leading-[13px]', n.on ? 'border-white/70 text-white' : 'border-text-3 text-text-2')}>{n.ev}</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={cx('font-mono text-[12.5px]', n.kind === 'outcome' && !n.on && 'font-bold text-brand')}>{n.value}</span>
          {hot ? <span className={cx('font-mono text-[10px]', n.on ? 'text-white/90' : n.delta! > 0 ? 'text-ok' : 'text-err')}>{n.dtxt}</span>
            : n.kind === 'locked' ? <span className={cx('inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase', n.on ? 'text-white/80' : 'text-text-3')}><Lock size={8} />{n.inv ? 'target WOH' : 'read-only'}</span>
            : n.kind === 'calc' ? <span className={cx('inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase', n.on ? 'text-white/80' : 'text-text-3')}><Lock size={8} />calculated</span> : null}
        </span>
      </>
    )
    const cls = cx('mx-auto flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all',
      n.on ? 'border-brand bg-brand text-white shadow-md' : n.kind === 'outcome' ? 'border-brand/50 bg-surface hover:border-brand' : n.kind === 'locked' ? 'border-border bg-surface-2/60 hover:border-brand/60' : n.kind === 'calc' ? 'border-border bg-surface hover:border-brand/60' : 'border-border bg-surface hover:border-brand/60',
      n.live && 'agent-ring', !n.onClick && 'cursor-default border-dashed')
    return n.onClick ? <button key={n.key} type="button" onClick={n.onClick} aria-current={n.on ? 'true' : undefined} className={cls}>{inner}</button> : <div key={n.key} className={cls}>{inner}</div>
  }
  const driver = (id: DriverId): N => {
    const d = DRV[id], v = fyAvg(layer[id], year), dv = v - fyAvg(ref[id], year)
    return { key: id, label: d.label, step: d.step, value: fmtV(id, v), delta: dv, dtxt: signed(dv, d.pct ? `${Math.abs(dv).toFixed(1)} pts` : `$${Math.abs(dv).toFixed(2)}`),
      on: !mod && sel === id, kind: editable(id) ? 'input' : 'locked', onClick: () => onSel(id), mark: moved(id), ev: evN(id), live: agent.section === 'assume' && sel === id }
  }
  const stage = (i: number, name: string, what: string, nodes: (N | null)[]) => (
    <div key={name} className="mx-auto" style={{ width: `${100 - i * 7}%` }}>
      <p className="text-center text-[10px] font-semibold uppercase tracking-[.08em] text-text-3">{name}</p>
      <p className="mb-1 text-center text-[10.5px] text-text-3">{what}</p>
      <div className="space-y-1">{nodes.filter((n): n is N => !!n).map(Node)}</div>
    </div>
  )
  const join = <div aria-hidden className="mx-auto my-1 h-2.5 w-px bg-border-strong" />
  const dnp = (fyAvg(layer.price, year) - fyAvg(ref.price, year)) * (1 - GTN)
  const trx = OUTPUTS.trx, trxV = fySum(trx.fn(layer), year), trxD = trxV - fySum(trx.fn(ref), year)
  const bn = (id: Exclude<ModId, 'gp' | 'netp'>, label: string, value: string, d: number, dtxt: string, kind: N['kind'], inv?: boolean): N => ({ key: id, label, value, delta: d, dtxt, on: mod === id, kind, inv, onClick: () => onMod(id) })
  const money = (d: number) => signed(d, fmtB(Math.abs(d)))
  const stages: ReactNode[][] = [
    [stage(0, 'Patient pool', 'how many people could be treated', [
      { key: 'start', label: model.start.label, step: 'Starting point', value: model.start.value, on: false, kind: 'locked' },
      has('diag') ? driver('diag') : null, has('treat') ? driver('treat') : null])],
    [stage(1, 'New to brand', 'who starts on the brand', [has('access') ? driver('access') : null, has('share') ? driver('share') : null])],
    // Total prescriptions is an input module like the others: it shows TRx and is overridden through prescriptions per patient.
    [stage(2, 'Volume', 'prescriptions', [has('rx') ? { key: 'rx', label: 'Total prescriptions', step: 'TRx', value: trx.fmt(trxV), delta: trxD, dtxt: trx.delta(trxD), on: !mod && sel === 'rx', kind: editable('rx') ? 'input' : 'locked', onClick: () => onSel('rx'), mark: moved('rx'), ev: evN('rx') }
      : { key: 'trx', label: 'Total prescriptions', step: 'TRx', value: trx.fmt(trxV), delta: trxD, dtxt: trx.delta(trxD), on: !mod && sel === 'rev' && metric === 'trx', kind: 'calc', onClick: () => onOutcome('trx') }])],
    // Sales: weighted gross price and change in inventory are modules of the flow (trend + override); net sales price is a read-only calculation.
    [stage(3, 'Sales', 'gross price, inventory and revenue', [
      has('price') ? { ...driver('price'), on: mod === 'gp', onClick: () => onMod('gp'), live: false } : null,
      bn('inv', 'Δ Inventory', `+${fmtB(b.inv)}`, b.inv - bRef.inv, money(b.inv - bRef.inv), 'locked', true),
      { key: 'netp', label: 'Net sales price', step: 'Calculated', value: fmtV('price', fyAvg(layer.price, year) * (1 - GTN)), delta: dnp, dtxt: signed(dnp, `$${Math.abs(dnp).toFixed(2)}`), on: mod === 'netp', kind: 'calc', onClick: () => onMod('netp') },
      { key: 'rev', label: 'Net revenue', step: 'Outcome', value: fmtB(net), delta: net - netRef, dtxt: money(net - netRef), on: !mod && sel === 'rev' && metric !== 'trx', kind: 'outcome', onClick: () => onOutcome('rev') }])],
    [stage(4, 'Revenue bridge', 'default modules · required in every model', [
      bn('tud', 'Total underlying demand', fmtB(b.tud), b.tud - bRef.tud, money(b.tud - bRef.tud), 'calc'),
      bn('inv', 'Δ Inventory', `+${fmtB(b.inv)}`, b.inv - bRef.inv, money(b.inv - bRef.inv), 'locked', true),
      bn('ue','Unexplained difference', `${ueFy(ue).toFixed(1)}%`, 0, '', 'input'),
      bn('fx', 'Exchange rates', '1.00', 0, '', 'locked')])],
  ]
  return (
    <nav data-tour="funnel" aria-label="Forecast map" className="rounded-2xl border border-border bg-surface shadow-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2"><Label>Assumptions</Label><span className="truncate text-[11px] text-text-3">FY{year} · {sc ? sc.name : 'Active forecast'}</span></div>
      {stages.map((s, k) => <Fragment key={k}>{k > 0 && join}{s}</Fragment>)}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-text-3"><Users size={12} className="mt-px shrink-0" /><span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />changed · <span className="mx-0.5 rounded-full border border-text-3 px-1 text-[9px] font-bold">n</span> events move it · change shown against the active forecast. Modules and formulas come from the CoE model.</span></p>
    </nav>
  )
}


/* ───────── Period picker ───────── */
export function Period({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (i: number) => void }) {
  const y = yearOf(value), m = value % 12
  const years = YEARS.filter(x => x >= yearOf(min) && x <= yearOf(max))
  const months = MONTHS.map((n, k) => ({ n, k })).filter(({ k }) => { const i = idxOf(y, k); return i >= min && i <= max })
  const clampIdx = (yy: number, mm: number) => Math.max(min, Math.min(max, idxOf(yy, mm)))
  return (
    <div>
      <Label className="mb-1">{label}</Label>
      <div className="flex gap-1.5">
        <select aria-label={`${label} month`} value={m} onChange={e => onChange(idxOf(y, +e.target.value))} className={field}>{months.map(({ n, k }) => <option key={k} value={k}>{n}</option>)}</select>
        <select aria-label={`${label} year`} value={y} onChange={e => onChange(clampIdx(+e.target.value, m))} className={cx(field, 'w-24')}>{years.map(x => <option key={x}>{x}</option>)}</select>
      </div>
    </div>
  )
}
export function NumField({ label, value, onChange, suffix, step = 0.1, live }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; live?: boolean }) {
  return (
    <label className={cx('block', live && 'agent-field')}><Label className="mb-1">{label}</Label>
      <div className="relative"><input type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(e.target.value === '' ? NaN : +e.target.value)} className={cx(field, 'font-mono', suffix && 'pr-12')} />{suffix && <span className="pointer-events-none absolute right-2.5 top-2 text-[12px] text-text-3">{suffix}</span>}</div>
    </label>
  )
}

export type CellState = 'system' | 'override' | 'recalc'
export function GridCell({ value, dp, state, onCommit, onCancel }: { value: number; dp: number; state: CellState; onCommit: (v: number) => string | null; onCancel: () => void }) {
  const [txt, setTxt] = useState<string | null>(null)
  const [bad, setBad] = useState(false)
  const commit = () => {
    if (txt === null) return
    const e = onCommit(txt.trim() === '' ? NaN : +txt)
    if (e) { setBad(true); return }
    setBad(false); setTxt(null)
  }
  const cancel = () => { setTxt(null); setBad(false); onCancel() }
  return <input aria-label="Monthly value" aria-invalid={bad} inputMode="decimal" value={txt ?? value.toFixed(dp)} onFocus={e => e.target.select()} onChange={e => setTxt(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') cancel() }}
    className={cx('block h-full w-full min-w-[52px] cursor-text bg-[#FFF9E0] px-2 py-[5px] text-right font-mono text-[11.5px] tabular-nums text-text outline-none focus:bg-surface focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand',
      bad ? 'bg-err-soft text-err outline outline-2 -outline-offset-2 outline-err' : state === 'override' ? 'bg-[#FDE9A8] font-semibold' : state === 'recalc' ? 'underline decoration-dashed decoration-text-3 underline-offset-[5px]' : '')} />
}

const parseNums = (t: string) => t.split(/[\s,;]+/).map(s => s.replace(/[%$]/g, '')).filter(s => s !== '' && Number.isFinite(+s)).map(Number)

/* ───────── Driver workspace ───────── */
export type DriverMode = 'overview' | 'assumptions'

export type DriverActions = { apply: () => void; discard: () => void }
/** Multi-scenario view of the Forecast workspace chart: the other scenarios as lines, the chip row and period picker above it, and the month range the chart is zoomed to. */
export type CompareProps = { extra?: ChartSeries['extra']; header?: ReactNode; range?: [number, number]; hideForecast?: boolean; /** a scenario (a bold line in `extra`) is the one being worked on, so the active forecast is drawn thin */ scenarioFocus?: boolean }
export function DriverWorkspace({ mode, sel, edits, setEdits, scenarioLayer, scenarioName, workingLayer, model, metric, setMetric, onOpenAssumptions, onGo, onDirty, actions, notify, compare }: {
  mode: DriverMode; sel: Sel; edits: Edits; setEdits: (f: (e: Edits) => Edits) => void; scenarioLayer: Layer; scenarioName: string; workingLayer: Layer
  model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void; onOpenAssumptions: () => void
  onGo: (s: 'assumptions' | 'events') => void; onDirty: (v: boolean) => void; actions?: MutableRefObject<DriverActions | null>; notify: Notify; compare?: CompareProps
}) {
  if (sel === 'rev') return <RevenueView {...{ workingLayer, scenarioLayer, scenarioName, model, metric, setMetric, compare }} />
  const cfg = model.modules.find(m => m.id === sel)
  return <DriverEditorView key={sel} id={sel} locked={!!cfg && !cfg.editable} {...{ mode, edits, setEdits, scenarioLayer, scenarioName, workingLayer, onOpenAssumptions, onGo, onDirty, actions, notify, compare }} />
}

function RevenueView({ workingLayer, scenarioLayer, scenarioName, model, metric, setMetric, compare }: { workingLayer: Layer; scenarioLayer: Layer; scenarioName: string; model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void; compare?: CompareProps }) {
  const o = OUTPUTS[metric]
  const s: ChartSeries = { actual: o.fn(FULL_ACTUALS), unbiased: o.fn(UNBIASED), working: compare?.hideForecast ? undefined : o.fn(workingLayer), scenario: compare ? undefined : o.fn(scenarioLayer), scenarioName, extra: compare?.extra, focus: compare?.scenarioFocus ? 'scenario' : 'working' }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[26px] font-semibold tracking-tight">{o.label}</h2></div>
        <OutputSelect model={model} metric={metric} onChange={setMetric} />
      </div>
      <Card title={`Monthly ${o.label.toLowerCase()}`} sub={o.unit} right={<Legend s={s} />}>{compare?.header && <div className="mb-3 space-y-3">{compare.header}</div>}<ForecastChart title={`${o.label} forecast`} s={s} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={320} range={compare?.range} /></Card>
    </div>
  )
}

function DriverEditorView({ id, mode, locked, edits, setEdits, scenarioLayer, scenarioName, workingLayer, onOpenAssumptions, onGo, onDirty, actions, notify, compare }: {
  id: DriverId; mode: DriverMode; locked: boolean; edits: Edits; setEdits: (f: (e: Edits) => Edits) => void; scenarioLayer: Layer; scenarioName: string; workingLayer: Layer
  onOpenAssumptions: () => void; onGo: (s: 'assumptions' | 'events') => void; onDirty: (v: boolean) => void; actions?: MutableRefObject<DriverActions | null>; notify: Notify; compare?: CompareProps
}) {
  const d = DRV[id], applied = edits[id]
  // The draft follows the applied value (including changes Charles makes) until the user starts their own edit.
  const [own, setOwn] = useState<Edit | null>(null)
  const latest = useRef(applied); latest.current = applied
  const draft = own ?? applied ?? defaultEdit(id)
  const setDraft = (f: null | ((x: Edit) => Edit)) => setOwn(o => f === null ? null : f(o ?? latest.current ?? defaultEdit(id)))
  const agent = useAgentFocus()
  const [paste, setPaste] = useState<string | null>(null)
  const [cascade, setCascade] = useState(true)
  const [gridErr, setGridErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const eff = draft
  const editing = mode === 'assumptions' && !locked
  const dirty = editing && JSON.stringify(eff) !== JSON.stringify(applied ?? defaultEdit(id))
  const preview = useMemo(() => applyEdit(id, UNBIASED[id], eff), [id, eff])
  const unb = UNBIASED[id], work = workingLayer[id], scn = scenarioLayer[id]
  const scnDiffers = scn.some((v, i) => Math.abs(v - work[i]!) > 1e-9)
  const patch = (p: Partial<Edit>) => setDraft(x => ({ ...x, ...p }))
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])

  const series: ChartSeries = { actual: ACTUALS[id], unbiased: unb, lo: BASELINE[id].lo, hi: BASELINE[id].hi, working: compare?.hideForecast ? undefined : work, preview: dirty ? preview : undefined, scenario: scnDiffers && !compare ? scn : undefined, scenarioName, extra: compare?.extra, focus: 'working' }
  const lastActual = ACTUALS[id][ACT - 1]!

  const apply = () => {
    if (eff.method === 'target' && !Number.isFinite(eff.target)) return notify({ tone: 'err', text: 'Enter a target value first. Your other changes are kept.' })
    setEdits(e => ({ ...e, [id]: eff })); setDraft(null)
    notify({ tone: 'ok', text: `${d.label} applied to the active forecast. The reference baseline is unchanged.` })
  }
  if (actions) actions.current = { apply: () => apply(), discard: () => { setDraft(null); setGridErr(null) } }
  const reset = () => { setEdits(e => { const n = { ...e }; delete n[id]; return n }); setDraft(null); setGridErr(null); notify({ tone: 'info', text: `${d.label} override removed. Back to the system-provided values.` }) }
  const loadValues = (vals: number[], source: Edit['source'], from = eff.start) => {
    const values: Record<number, number> = {}
    vals.forEach((v, k) => { if (from + k < N) values[from + k] = v })
    setDraft(x => ({ ...x, method: 'direct', values, pinned: [], source }))
    return Math.min(vals.length, N - from)
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (/\.(csv|txt)$/i.test(f.name)) {
      const n = loadValues(parseNums(await f.text()), 'excel', eff.start)
      notify({ tone: n ? 'ok' : 'err', text: n ? `Loaded ${n} monthly values from ${f.name}. Review the chart, then Apply.` : `No numeric values found in ${f.name}.` })
    } else {
      loadValues(Array.from({ length: N - ACT }, (_, k) => UNBIASED[id][ACT + k]! * (d.pct ? 1.02 : 1.015) + (d.pct ? 0 : 0.5 * Math.sin(k))), 'excel', ACT)
      notify({ tone: 'info', text: `${f.name} attached. This prototype does not read .xlsx files, so sample values were loaded to show the flow.` })
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  const setCell = (i: number, v: number): string | null => {
    if (!Number.isFinite(v)) { setGridErr('Enter a number. Your other entries are kept.'); return 'nan' }
    if (v < 0 || (d.pct && v > 100)) { const m = `${mLong(i)}: ${d.label} must be between 0 and ${d.pct ? '100%' : 'a positive value'}. Your other entries are kept.`; setGridErr(m); return m }
    setGridErr(null)
    setDraft(x => {
      const prev = preview[i]!, values: Record<number, number> = {}
      const pinned = x.pinned.includes(i) ? x.pinned : [...x.pinned, i]
      for (let k = ACT; k < N; k++) {
        const cur = x.method === 'direct' && x.values[k] !== undefined && x.pinned.includes(k) ? x.values[k]! : preview[k]!
        values[k] = k > i && cascade && !pinned.includes(k) ? (d.pct ? cur + (v - prev) : prev ? cur * (v / prev) : cur) : cur
      }
      values[i] = v
      return { ...x, method: 'direct', values, pinned }
    })
    return null
  }
  const cellState = (i: number): CellState => eff.method === 'direct' && eff.pinned.includes(i) ? 'override' : Math.abs(preview[i]! - unb[i]!) > 1e-9 ? 'recalc' : 'system'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[26px] font-semibold tracking-tight">{d.label}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-text-2">{d.desc}</p>
        </div>
        {mode === 'overview' && !locked && <Btn onClick={onOpenAssumptions} icon={<PencilLine size={15} />}>Open in Forecast workspace</Btn>}
      </div>

      {id === 'rx' && (() => {
        const t = OUTPUTS.trx, ts: ChartSeries = { actual: t.fn(FULL_ACTUALS), unbiased: t.fn(UNBIASED), working: t.fn(workingLayer), scenario: scnDiffers ? t.fn(scenarioLayer) : undefined, scenarioName }
        return <Card title="Total prescriptions (TRx) · monthly" sub="K Rx. Patients on brand × prescriptions per patient: it moves with share and with the override below." right={<Legend s={ts} />}>
          <ForecastChart title="Total prescriptions" s={ts} fmt={v => t.fmt(v, 0)} dp={0} unit={t.unit} height={240} range={compare?.range} /></Card>
      })()}
      <div className={cx('grid gap-4', mode === 'overview' && 'xl:grid-cols-[minmax(0,1fr)_260px]')}>
        <div data-tour="chart" className="min-w-0"><Card title={`${d.label} · monthly`} sub={d.unit === '%' ? 'Percent' : d.unit} right={<Legend s={series} />}>
          {compare?.header && <div className="mb-3 space-y-3">{compare.header}</div>}
          <ForecastChart title={`${d.label} forecast`} s={series} fmt={v => fmtV(id, v)} dp={d.dp} unit={d.unit} height={mode === 'overview' ? 340 : 300} range={compare?.range} />
        </Card></div>
        {mode === 'overview' && <TrendPanel id={id} />}
      </div>

      {mode === 'overview' && (
        <Card><div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-text-2">The dashed line is the Data Science reference baseline. It is supplied externally and cannot be edited. Adjust permitted assumptions in the <b>Forecast workspace</b> to move the active forecast.</p>
          <Btn onClick={onOpenAssumptions} icon={<ArrowRight size={15} />}>Start with assumptions</Btn>
        </div></Card>
      )}

      {mode === 'assumptions' && locked && (
        <Card><p className="flex items-start gap-2 text-sm text-text-2"><Lock size={15} className="mt-0.5 shrink-0" /><span><b className="font-medium text-text">{d.label} is system-fed for this model.</b> The CoE has not exposed it as an override, so its values and formula cannot be changed here. Pick another module from the forecast map.</span></p></Card>
      )}

      {editing && (
        <AgentFrame on={agent.section === 'assume'} label={`${agent.name} is adjusting ${d.label.toLowerCase()}`}>
        <Card title="Adjust assumption" sub="Override permitted values or change the projection method. The calculation formula stays locked and the reference baseline never changes."
          right={dirty ? <Tag tone="warn">Unapplied changes</Tag> : applied ? <Tag tone="brand">Applied</Tag> : undefined}>
          <div className="space-y-5">
            <div><Label className="mb-1.5">Projection method</Label>
              <Seg label="Method" value={eff.method} onChange={m => patch({ method: m as Method })} options={(Object.keys(METHOD_LABEL) as Method[]).map(m => ({ id: m, label: METHOD_LABEL[m] }))} /></div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Period label="Start" value={eff.start} min={ACT} max={N - 1} onChange={v => patch({ start: v, end: Math.max(eff.end, v) })} />
              <Period label="End" value={eff.end} min={eff.start} max={N - 1} onChange={v => patch({ end: v })} />
              {eff.method === 'target' && <>
                <NumField live={agent.field === 'target'} label="Target value" value={eff.target} suffix={d.unit === '%' ? '%' : '$'} onChange={v => patch({ target: v })} />
                <label className="block"><Label className="mb-1">Curve</Label><select value={eff.curve} onChange={e => patch({ curve: e.target.value as Curve })} className={field}>{(Object.keys(CURVE_LABEL) as Curve[]).map(c => <option key={c} value={c}>{CURVE_LABEL[c]}</option>)}</select></label>
              </>}
              {eff.method === 'linear' && <NumField label="Change per month" value={eff.step} suffix={d.unit === '%' ? 'pts' : '$'} step={d.pct ? 0.05 : 0.25} onChange={v => patch({ step: v })} />}
              {eff.method === 'growth' && <NumField live={agent.field === 'growth'} label="Growth / change per year" value={eff.growth} suffix="%" onChange={v => patch({ growth: v })} />}
              {eff.method === 'hold' && <div className="sm:col-span-2"><Label className="mb-1">Carried value</Label><p className="flex h-9 items-center rounded-lg bg-surface-2 px-3 font-mono text-sm">{fmtV(id, lastActual)} <span className="ml-2 font-sans text-text-3">last actual, {mLong(ACT - 1)}</span></p></div>}
            </div>

            {eff.method !== 'direct' && (
              <label className="flex items-center gap-3 text-sm"><Toggle on={eff.hold} onChange={v => patch({ hold: v })} label="Hold flat after end" />
                <span><b className="font-medium">Hold flat after end</b><span className="text-text-2"> · {eff.hold ? 'the end value carries forward' : 'the series rejoins the reference baseline'}</span></span></label>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Label className="mr-1">Bring in values</Label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              <Btn variant="secondary" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>Upload Excel</Btn>
              <Btn variant={paste !== null ? 'primary' : 'secondary'} icon={<ClipboardPaste size={14} />} onClick={() => setPaste(p => p === null ? '' : null)}>Paste from Excel</Btn>
              {eff.method === 'direct' && eff.source !== 'manual' && <Tag tone="brand">From {eff.source === 'excel' ? 'file' : 'paste'}</Tag>}
            </div>
            {paste !== null && (
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <textarea autoFocus value={paste} onChange={e => setPaste(e.target.value)} rows={3} placeholder={`Paste a row or column of monthly values, starting ${mLong(eff.start)}`} className="w-full resize-y rounded-md border border-border-strong bg-surface p-2.5 font-mono text-[12px] outline-none focus:border-brand" />
                <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[12px] text-text-2">{parseNums(paste).length} values detected</span>
                  <div className="flex gap-2"><Btn variant="ghost" onClick={() => setPaste(null)}>Cancel</Btn>
                    <Btn disabled={!parseNums(paste).length} onClick={() => { const n = loadValues(parseNums(paste), 'paste', eff.start); setPaste(null); notify({ tone: 'ok', text: `Pasted ${n} monthly values. Review the chart, then Apply.` }) }}>Use values</Btn></div></div>
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <label className="flex items-center gap-3 text-sm"><Toggle on={cascade} onChange={setCascade} label="Recalculate later periods" />
                  <span><b className="font-medium">Recalculate later periods</b><span className="text-text-2"> · {cascade ? 'editing a month moves every later month by the same change' : 'editing a month changes only that month'}</span></span></label>
              </div>
              <AssumptionGrid id={id} preview={preview} cellState={cellState} onCell={setCell} onCancel={() => setGridErr(null)} />
              {gridErr && <p role="alert" className="mt-2 rounded-md border border-err/30 bg-err-soft px-3 py-2 text-[13px] text-err">{gridErr}</p>}
            </div>

            <label className="block"><Label className="mb-1" hint="optional">Notes on change</Label>
              <textarea value={draft.notes} onChange={e => patch({ notes: e.target.value })} rows={2} placeholder="What changed, and why? Shown on the Review screen." className="w-full resize-y rounded-md border border-border-strong bg-surface p-2.5 text-sm outline-none focus:border-brand" /></label>

            <div className="flex justify-start border-t border-border pt-3">
              <Btn variant="ghost" icon={<RotateCcw size={15} />} disabled={!applied && !dirty} onClick={reset}>Reset to system value</Btn>
            </div>
          </div>
        </Card>
        </AgentFrame>
      )}
    </div>
  )
}

/* ───────── Assumption grid · same format as the forecast page's full-model grid ───────── */
const TH = 'sticky top-0 z-[2] h-[29px] whitespace-nowrap border-b border-border bg-surface px-2 py-[5px] text-right text-[10.5px] font-bold text-text-3'
const TD = 'whitespace-nowrap border-b border-border/60 px-2 py-[5px] text-right font-mono text-[11.5px] tabular-nums'
const ROWH = 'sticky left-0 z-[3] min-w-[240px] max-w-[300px] whitespace-normal border-r border-border bg-surface text-left'
const FYH = 'sticky right-0 border-l border-border bg-surface font-mono text-[11.5px] font-bold'

function AssumptionGrid({ id, preview, cellState, onCell, onCancel }: {
  id: DriverId; preview: number[]; cellState: (i: number) => CellState; onCell: (i: number, v: number) => string | null; onCancel: () => void
}) {
  const d = DRV[id], unb = UNBIASED[id], act = ACTUALS[id]
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')
  // Years made entirely of actuals start folded to one column; click a year to fold or unfold it.
  const [folded, setFolded] = useState<Set<number>>(() => new Set(YEARS.filter(y => idxOf(y, 11) < ACT)))
  const [hidden, setHidden] = useState(false)
  const lastActYear = yearOf(ACT - 1)
  const fold = (y: number) => setFolded(f => { const n = new Set(f); if (n.has(y)) n.delete(y); else n.add(y); return n })
  const val = (series: number[], i: number) => (i < ACT ? act[i]! : series[i]!)
  const avg = (series: number[], y: number) => { let t = 0; for (let k = 0; k < 12; k++) t += val(series, idxOf(y, k)); return t / 12 }
  const f = (v: number) => v.toFixed(d.dp)

  type Col = { y: number; i: number | null; folded?: boolean }
  const cols: Col[] = period === 'annual'
    ? YEARS.map(y => ({ y, i: null }))
    : YEARS.flatMap<Col>(y => folded.has(y) ? [{ y, i: null, folded: true }] : MONTHS.map((_, k) => ({ y, i: idxOf(y, k) })))
  const yearTone = (y: number) => (y < lastActYear ? 'text-text-3/70' : y === lastActYear ? 'text-text-3' : '')
  const anyOverride = (y: number) => MONTHS.some((_, k) => { const i = idxOf(y, k); return i >= ACT && cellState(i) === 'override' })

  const rows: { key: string; label: string; hint: string; series: number[]; input?: boolean }[] = [
    { key: 'base', label: 'Base value', hint: 'Data Science reference baseline · read-only', series: unb },
    { key: 'work', label: 'Active forecast', hint: 'Used in every forecast calculation · type over a forecast month', series: preview, input: true },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
        <b className="text-[13px] font-semibold">{d.label} · {d.unit === '%' ? 'percent' : d.unit}</b>
        <span className="text-[11.5px] text-text-3">{hidden ? 'hidden · every month or every year' : <>grey = actual · <i className="mx-0.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" /> assumption you can type over · blue fill = overridden · dashed underline = recalculated</>}</span>
        <span className="ml-auto flex items-center gap-2">
          {!hidden && <span role="group" aria-label="Grid period" className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
            {(['monthly', 'annual'] as const).map(p => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={cx('rounded px-2.5 py-1 text-[10.5px] font-semibold capitalize', period === p ? 'bg-surface text-text shadow-sm' : 'text-text-2 hover:text-text')}>{p}</button>)}
          </span>}
          <button type="button" onClick={() => setHidden(h => !h)} className="rounded-md px-2 py-1 text-[11.5px] font-medium text-text-2 hover:bg-surface-2 hover:text-text">{hidden ? 'Show grid' : 'Hide grid'}</button>
        </span>
      </div>
      {!hidden && (
        <div className="max-h-[70vh] overflow-auto border-t border-border">
          <table className="min-w-full border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr>
                <th className={cx(TH, ROWH, 'z-[4] px-2')}>Metric</th>
                {period === 'monthly'
                  ? YEARS.map(y => folded.has(y)
                    ? <th key={y} onClick={() => fold(y)} title="Click to show the months" className={cx(TH, 'cursor-pointer select-none bg-[#EEF0F6] text-center tracking-[.06em] hover:text-brand')}>{y} ▸</th>
                    : <th key={y} colSpan={12} onClick={() => fold(y)} title="Click to fold the year to one column" className={cx(TH, 'cursor-pointer select-none bg-background text-center tracking-[.06em] hover:text-brand', y === FY && 'text-brand')}>{y} ▾</th>)
                  : <th colSpan={cols.length} title="Year averages, since every assumption is a rate" className={cx(TH, 'bg-background text-center tracking-[.06em] text-brand')}>by year</th>}
                <th className={cx(TH, FYH, 'z-[3] text-[10.5px]')} title="The year average">Year {FY}</th>
              </tr>
              <tr>
                <th className={cx(TH, ROWH, 'top-[29px] z-[4] px-2 font-semibold')}>{period}</th>
                {cols.map((c, k) => c.i === null
                  ? <th key={k} className={cx(TH, 'top-[29px]', yearTone(c.y))}>{period === 'annual' ? <>{c.y}{c.y === lastActYear && <span className="ml-1 font-normal">actual + forecast</span>}</> : 'year'}</th>
                  : <th key={k} className={cx(TH, 'top-[29px]', c.i < ACT && 'text-text-3/70')}>{MONTHS[c.i % 12]}</th>)}
                <th className={cx(TH, FYH, 'top-[29px] z-[3]')} />
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={cols.length + 2} className="sticky left-0 border-b border-border/60 bg-background px-2 py-[5px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-brand">{d.step} <span className="font-normal normal-case tracking-normal text-text-3">{d.desc}</span></td></tr>
              {rows.map(r => (
                <tr key={r.key}>
                  <td className={cx(TD, ROWH, 'px-2 font-sans')}>
                    <span className="flex items-center gap-1.5">{r.input && <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" title="Assumption" />}<b className="text-[11.5px] font-semibold text-text">{r.label}</b></span>
                    <span className="block text-[10.5px] text-text-3">{r.hint}</span>
                  </td>
                  {cols.map((c, k) => {
                    if (c.i === null) {
                      const past = c.y < lastActYear
                      return <td key={k} title={`${c.y} average`} className={cx(TD, past ? 'bg-[#F1F3F8] text-text-3' : '', c.folded && 'border-x border-x-border bg-[#F7F8FC] font-semibold', c.folded && past && 'bg-[#ECEEF5]', r.input && !past && anyOverride(c.y) && 'bg-[#FDE9A8] font-semibold')}>{f(avg(r.series, c.y))}</td>
                    }
                    const i = c.i
                    if (i < ACT) return <td key={k} title="Actual · locked" className={cx(TD, 'bg-[#F1F3F8] text-text-3')}>{f(act[i]!)}</td>
                    if (!r.input) return <td key={k} className={TD}>{f(r.series[i]!)}</td>
                    return <td key={k} className={cx(TD, 'p-0')}><GridCell value={preview[i]!} dp={d.dp} state={cellState(i)} onCommit={v => onCell(i, v)} onCancel={onCancel} /></td>
                  })}
                  <td className={cx(TD, FYH)}>{f(avg(r.series, FY))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


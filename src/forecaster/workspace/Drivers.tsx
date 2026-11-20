import type { ReactNode } from 'react'
import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, FileSpreadsheet, Lock, Pause, Play, PanelRightClose, PencilLine, Upload, Users, X } from 'lucide-react'
import {
  ACT, ACTUALS, BASELINE, CURVE_LABEL, DRIVERS, DRV, FY, GTN, METHOD_LABEL, MONTHS, N, OUTPUTS, UNBIASED, YEARS,
  applyEdit, defaultEdit, fmtV, fyAvg, idxOf, mLong, netPrice, revenue, yearOf, fySum,
} from './engine'
import type { Curve, DriverId, Edit, Layer, Method, ModelCfg, OutputId } from './engine'
import { AssumptionCard, Btn, Card, ForecastChart, GroupHead, Label, Legend, PageHeader, PageTitle, Toggle, cx, field, InfoTip } from './ui'
import { AgentFrame } from '../../chat/Agent'
import type { Grain } from './ui'
import { TrendPanel } from './Trend'
import { MODS, bridgeOf, fmtB } from './Modules'
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

export function ForecastMap({ sel, onSel, edits, working, model, metric, mod, onMod, uePct, onCollapse, funnelHandled, embedded }: { sel: Sel; onSel: (s: Sel) => void; edits: Edits; working: Layer; model: ModelCfg; metric: OutputId; mod: ModId | null; onMod: (m: ModId) => void; uePct: number; onCollapse?: () => void
  /** The percentage stages are drawn by FunnelChart above, so this map only shows what the funnel cannot: non-percentage inputs and the revenue bridge. */
  funnelHandled?: boolean
  /** Drops this component's own card border/background so it can sit inside a shared card with other sections. */
  embedded?: boolean }) {
  const agent = useAgentFocus()
  const node = (id: DriverId, editable: boolean) => {
    const d = DRV[id], on = !mod && sel === id
    return (
      <AssumptionCard key={id} step={d.step} label={d.label}
        value={id === 'rx' ? OUTPUTS.trx.fmt(fySum(OUTPUTS.trx.fn(working))) : fmtV(id, fyAvg(working[id]))}
        sub={id === 'rx' ? `${fmtV(id, fyAvg(working[id]))} per patient` : undefined}
        locked={!editable} changed={!!edits[id]} on={on} onClick={() => onSel(id)}
        title={editable ? 'Editable input' : 'Locked by the model'}
        className={cx(on && agent.section === 'assume' && 'agent-ring')} />
    )
  }
  const funnel = funnelHandled ? [] : model.modules.filter(m => DRV[m.id].pct), side = model.modules.filter(m => !DRV[m.id].pct)
  const out = OUTPUTS[metric]
  return (
    <nav aria-label="Forecast map" className={cx(!embedded && 'rounded-xl border border-border bg-surface p-4')}>
      {(!embedded || onCollapse) && (
        <div className={cx('mb-3 flex items-center justify-between gap-2')}>
          {!embedded && <>
            <Label>{funnelHandled ? 'Other inputs' : 'Forecast map'}</Label>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-text-3">{model.modules.length} modules · from model<InfoTip text="Modules, order and editable inputs come from the model published by the CoE. Formulas are locked." /></span>
          </>}
          {onCollapse && <button type="button" onClick={onCollapse} aria-label="Collapse forecast map" title="Collapse" className="-mr-1 grid h-7 w-7 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><PanelRightClose size={15} /></button>}
        </div>
      )}
      {!funnelHandled && (
        <>
          <GroupHead title="Patient pool" sub="How many people can be treated?" />
          <div className="flex flex-col gap-1.5">
            <AssumptionCard step="Core archetype" label={model.start.label} value={model.start.value} locked title="Set by the published model" />
            {funnel.map(m => node(m.id, m.editable))}
          </div>
        </>
      )}
      <GroupHead title="Volume and price" sub="How much is used, and at what price?" />
      <div className="flex flex-col gap-1.5">
        {side.map(m => node(m.id, m.editable))}
        {side.some(m => m.id === 'price') && (
          <AssumptionCard label="Net sales price" step="Calculated" value={fmtV('price', netPrice(fyAvg(working.price)))}
            locked title={`× (1 − ${Math.round(GTN * 100)}% GTN)`} />
        )}
      </div>
      <div data-tour="bridge">
        <GroupHead title="Revenue bridge" sub="Required in every model" />
        <div className="flex flex-col gap-1.5">{MODS.map(m => {
          const b = bridgeOf(fySum(revenue(working)), uePct)
          const v = m.id === 'tud' ? fmtB(b.tud) : m.id === 'inv' ? `+${fmtB(b.inv)}` : m.id === 'ue' ? `${uePct.toFixed(1)}%` : m.id === 'fx' ? '1.00' : undefined
          return <AssumptionCard key={m.id} label={m.label} value={v} sub={m.kind} locked={!m.edit} on={mod === m.id} onClick={() => onMod(m.id)}
            title={m.edit ? 'Editable input' : 'Calculated by the model'} />
        })}</div>
      </div>
      <GroupHead title="Outcome" sub="What this model produces" />
      <AssumptionCard step="Calculated" label={out.label} value={out.fmt(fySum(out.fn(working)))}
        on={!mod && sel === 'rev'} onClick={() => onSel('rev')} title="Open the outcome view" />
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
    className={cx('block h-full w-full min-w-[52px] cursor-text border border-[#F0D98A] bg-[#FFF9E0] px-2 py-[5px] text-right font-mono text-[11.5px] tabular-nums text-text outline-none focus:border-brand focus:bg-surface focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand',
      bad ? 'border-err bg-err-soft text-err outline outline-2 -outline-offset-2 outline-err' : state === 'override' ? 'bg-[#FDE9A8] font-semibold' : state === 'recalc' ? 'underline decoration-dashed decoration-text-3 underline-offset-[5px]' : '')} />
}

const parseNums = (t: string) => t.split(/[\s,;]+/).map(s => s.replace(/[%$]/g, '')).filter(s => s !== '' && Number.isFinite(+s)).map(Number)
const fmtBytes = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} KB`

export function AssumptionAccordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 bg-surface-2 px-3 py-2.5 text-left text-[13px] font-medium text-text">
        {title}<ChevronDown size={15} className={cx('shrink-0 text-text-2 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t border-border bg-surface p-3">{children}</div>}
    </section>
  )
}

/* ───────── Driver workspace ───────── */
export type DriverMode = 'overview' | 'assumptions'

export type DriverActions = { apply: () => void; discard: () => void }
export function DriverWorkspace({ mode, sel, edits, setEdits, scenarioLayer, scenarioName, workingLayer, model, metric, setMetric, onOpenAssumptions, onGo, onDirty, actions, notify, bar, grain, setGrain, panelOpen }: {
  mode: DriverMode; sel: Sel; edits: Edits; setEdits: (f: (e: Edits) => Edits) => void; scenarioLayer: Layer; scenarioName: string; workingLayer: Layer
  model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void; onOpenAssumptions: () => void
  onGo: (s: 'assumptions' | 'events') => void; onDirty: (v: boolean) => void; actions?: MutableRefObject<DriverActions | null>; notify: Notify
  grain: Grain; setGrain: (grain: Grain) => void
  /** Sits in the chart column, directly above the chart (the scenario "Working on" bar). */
  bar?: ReactNode
  /** Whether the "Adjust Assumptions" side panel is shown; defaults to open. */
  panelOpen?: boolean
}) {
  if (sel === 'rev') return <RevenueView {...{ workingLayer, scenarioLayer, scenarioName, model, metric, setMetric }} />
  const cfg = model.modules.find(m => m.id === sel)
  return <DriverEditorView key={sel} id={sel} locked={!!cfg && !cfg.editable} {...{ mode, edits, setEdits, scenarioLayer, scenarioName, workingLayer, onOpenAssumptions, onGo, onDirty, actions, notify, bar, grain, setGrain, panelOpen }} />
}

function RevenueView({ workingLayer, scenarioLayer, scenarioName, model, metric, setMetric }: { workingLayer: Layer; scenarioLayer: Layer; scenarioName: string; model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void }) {
  const o = OUTPUTS[metric]
  const s: ChartSeries = { actual: o.fn(FULL_ACTUALS), unbiased: o.fn(UNBIASED), working: o.fn(workingLayer), scenario: o.fn(scenarioLayer), scenarioName }
  return (
    <div className="space-y-5">
      <PageHeader>
        <PageTitle title={o.label} info="Combines every module in the forecast map. It is not edited directly. Change an assumption, or turn on events in a scenario, to move it. The reference baseline never moves." />
        <OutputSelect model={model} metric={metric} onChange={setMetric} />
      </PageHeader>
      <Card frame title={`Monthly ${o.label.toLowerCase()}`} sub={o.unit} right={<Legend s={s} />}><ForecastChart title={`${o.label} forecast`} s={s} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={320} /></Card>
    </div>
  )
}

function DriverEditorView({ id, mode, locked, edits, setEdits, scenarioLayer, scenarioName, workingLayer, onOpenAssumptions, onGo, onDirty, actions, notify, bar, grain, setGrain, panelOpen = true }: {
  id: DriverId; mode: DriverMode; locked: boolean; edits: Edits; setEdits: (f: (e: Edits) => Edits) => void; scenarioLayer: Layer; scenarioName: string; workingLayer: Layer
  onOpenAssumptions: () => void; onGo: (s: 'assumptions' | 'events') => void; onDirty: (v: boolean) => void; actions?: MutableRefObject<DriverActions | null>; notify: Notify
  grain: Grain; setGrain: (grain: Grain) => void
  bar?: ReactNode
  panelOpen?: boolean
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
  const [upload, setUpload] = useState<{ file: File; progress: number; paused: boolean; done: boolean } | null>(null)
  const uploadTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (uploadTimer.current) clearInterval(uploadTimer.current) }, [])
  const eff = draft
  const editing = mode === 'assumptions' && !locked
  const dirty = editing && JSON.stringify(eff) !== JSON.stringify(applied ?? defaultEdit(id))
  const preview = useMemo(() => applyEdit(id, UNBIASED[id], eff), [id, eff])
  const unb = UNBIASED[id], work = workingLayer[id], scn = scenarioLayer[id]
  const scnDiffers = scn.some((v, i) => Math.abs(v - work[i]!) > 1e-9)
  const patch = (p: Partial<Edit>) => setDraft(x => ({ ...x, ...p }))
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])

  const series: ChartSeries = { actual: ACTUALS[id], unbiased: unb, lo: BASELINE[id].lo, hi: BASELINE[id].hi, working: work, preview: dirty ? preview : undefined, scenario: scnDiffers ? scn : undefined, scenarioName }
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
  const startUpload = (f: File | undefined) => {
    if (!f) return
    setUpload({ file: f, progress: 0, paused: false, done: false })
    if (uploadTimer.current) clearInterval(uploadTimer.current)
    uploadTimer.current = setInterval(() => {
      setUpload(u => {
        if (!u || u.paused) return u
        const next = Math.min(100, u.progress + 8 + Math.random() * 10)
        if (next >= 100) {
          if (uploadTimer.current) clearInterval(uploadTimer.current)
          onFile(u.file)
          return { ...u, progress: 100, done: true }
        }
        return { ...u, progress: next }
      })
    }, 200)
  }
  const cancelUpload = () => {
    if (uploadTimer.current) clearInterval(uploadTimer.current)
    setUpload(null)
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

  const adjustPanel = editing && panelOpen && (
    <AgentFrame on={agent.section === 'assume'} label={`${agent.name} is adjusting ${d.label.toLowerCase()}`}>
    <Card title="Adjust Assumptions"
      frame fill className="lg:h-[calc(100dvh-220px)]"
      right={<Btn variant="ghost" size="sm" disabled={!applied && !dirty} onClick={reset}>Reset</Btn>}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <label className="block"><Label className="mb-1">Project method</Label>
          <select value={eff.method} onChange={e => patch({ method: e.target.value as Method })} className={field}>{(Object.keys(METHOD_LABEL) as Method[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></label>

        <AssumptionAccordion title="Date" defaultOpen>
          <div className="space-y-3">
            <Period label="Start date" value={eff.start} min={ACT} max={N - 1} onChange={v => patch({ start: v, end: Math.max(eff.end, v) })} />
            <Period label="End date" value={eff.end} min={eff.start} max={N - 1} onChange={v => patch({ end: v })} />
          </div>
        </AssumptionAccordion>

        {eff.method !== 'direct' && <AssumptionAccordion title="Projection settings">
          {eff.method === 'target' && <>
            <NumField live={agent.field === 'target'} label="Target value" value={eff.target} suffix={d.unit === '%' ? '%' : '$'} onChange={v => patch({ target: v })} />
            <label className="block"><Label className="mb-1">Phase to target</Label><select value={eff.curve} onChange={e => patch({ curve: e.target.value as Curve })} className={field}>{(Object.keys(CURVE_LABEL) as Curve[]).map(c => <option key={c} value={c}>{CURVE_LABEL[c]}</option>)}</select></label>
          </>}
          {eff.method === 'linear' && <NumField label="Change per month" value={eff.step} suffix={d.unit === '%' ? 'pts' : '$'} step={d.pct ? 0.05 : 0.25} onChange={v => patch({ step: v })} />}
          {eff.method === 'growth' && <NumField live={agent.field === 'growth'} label="Growth / change per year" value={eff.growth} suffix="%" onChange={v => patch({ growth: v })} />}
          {eff.method === 'hold' && <div><Label className="mb-1">Carried value</Label><p className="flex h-9 items-center rounded-md bg-surface-2 px-3 font-mono text-sm">{fmtV(id, lastActual)} <span className="ml-2 font-sans text-text-3">last actual, {mLong(ACT - 1)}</span></p></div>}

          {eff.method === 'target' && (
            <p className="rounded-md bg-surface-2 p-3 text-[13px] text-text-2"><b className="font-medium text-text">Phase to target</b> is how the value travels from {fmtV(id, lastActual)} (last actual, {mLong(ACT - 1)}) to {fmtV(id, eff.target)} by {mLong(eff.end)} · {CURVE_LABEL[eff.curve].toLowerCase()}.</p>
          )}

        </AssumptionAccordion>}

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={e => startUpload(e.target.files?.[0])} />
        <AssumptionAccordion title="Notes">
          <label className="block"><Label className="mb-1" hint="optional">Notes on change</Label>
            <textarea value={draft.notes} onChange={e => patch({ notes: e.target.value })} rows={2} placeholder="What changed, and why? Shown on the Review screen." className="w-full resize-y rounded-md border border-border-strong bg-surface p-2.5 text-sm outline-none focus:border-brand" /></label>
        </AssumptionAccordion>

        {eff.method !== 'direct' && <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Hold flat after end</span><Toggle on={eff.hold} onChange={v => patch({ hold: v })} label="Hold flat after end" />
        </label>}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Recalculate later period</span><Toggle on={cascade} onChange={setCascade} label="Recalculate later period" />
        </label>

        <div>
          {!upload ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); startUpload(e.dataTransfer.files?.[0]) }}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-6 text-center transition-colors hover:border-brand"
            >
              <Upload size={18} className="text-text-2" />
              <span className="text-sm font-semibold">Drag &amp; drop your file</span>
              <span className="text-[12px] text-text-3">Supported formats: XLSX, XLS, CSV, TXT</span>
              <Btn variant="secondary" size="sm" className="mt-1" onClick={() => fileRef.current?.click()}>Select file</Btn>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <span className="grid shrink-0 place-items-center rounded-md bg-ok-soft p-2"><FileSpreadsheet size={16} className="text-ok" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{upload.file.name}</span>
                <span className="mt-1 flex items-center gap-2 text-[12px] text-text-3">
                  <span>{fmtBytes(upload.file.size)}</span>
                  {!upload.done && <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${upload.progress}%` }} /></span>}
                  <span className="shrink-0">{upload.done ? 'Uploaded' : `${Math.round(upload.progress)}%`}</span>
                </span>
              </span>
              {!upload.done && (
                <Btn variant="ghost" size="sm" title={upload.paused ? 'Resume' : 'Pause'} onClick={() => setUpload(u => u && { ...u, paused: !u.paused })} icon={upload.paused ? <Play size={14} /> : <Pause size={14} />} />
              )}
              <Btn variant="ghost" size="sm" title="Remove" onClick={cancelUpload} icon={<X size={14} />} />
            </div>
          )}
          {eff.method === 'direct' && eff.source !== 'manual' && <p className="mt-2 text-[12px] text-text-3">Values from {eff.source === 'excel' ? 'file' : 'paste'}</p>}
          {paste !== null && (
            <div className="mt-2 rounded-md border border-border bg-surface-2 p-3">
              <textarea autoFocus value={paste} onChange={e => setPaste(e.target.value)} rows={3} placeholder={`Paste a row or column of monthly values, starting ${mLong(eff.start)}`} className="w-full resize-y rounded-md border border-border-strong bg-surface p-2.5 font-mono text-[12px] outline-none focus:border-brand" />
              <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[12px] text-text-2">{parseNums(paste).length} values detected</span>
                <div className="flex gap-2"><Btn variant="ghost" onClick={() => setPaste(null)}>Cancel</Btn>
                  <Btn disabled={!parseNums(paste).length} onClick={() => { const n = loadValues(parseNums(paste), 'paste', eff.start); setPaste(null); notify({ tone: 'ok', text: `Pasted ${n} monthly values. Review the chart, then Apply.` }) }}>Use values</Btn></div></div>
            </div>
          )}
        </div>

      </div>
    </Card>
    </AgentFrame>
  )

  return editing ? (
    <div>
      <div className={cx('grid min-w-0 gap-6', panelOpen && 'lg:grid-cols-[minmax(0,1fr)_300px]')}>
        <Card title={d.label} sub={d.unit === '%' ? 'Percent' : d.unit} frame fill className="lg:h-[calc(100dvh-220px)]" right={bar}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <div data-tour="chart" className="min-w-0">
              <ForecastChart title={`${d.label} forecast`} s={series} fmt={v => fmtV(id, v)} dp={d.dp} unit={d.unit}
                height={460} grain={grain} onGrainChange={setGrain} hideAggregation toolbarStart={<Legend s={series} />} />
            </div>
            <AssumptionGrid id={id} preview={preview} cellState={cellState} onCell={setCell} onCancel={() => setGridErr(null)} />
            {gridErr && <p role="alert" className="rounded-md border border-err/30 bg-err-soft px-3 py-2 text-[13px] text-err">{gridErr}</p>}
          </div>
        </Card>
        {panelOpen && <div className="min-w-0 lg:sticky lg:top-[98px] lg:self-start">{adjustPanel}</div>}
      </div>
    </div>
  ) : (
    <div className="space-y-5">
      <PageHeader className="items-start">
        <div className="min-w-0"><PageTitle title={d.label} info={`${d.desc} Source: Data Science baseline · monthly · brand level.`} /></div>
        {mode === 'overview' && !locked && <Btn variant="secondary" onClick={onOpenAssumptions} icon={<PencilLine size={14} />}>Edit assumption</Btn>}
      </PageHeader>

      <div className="space-y-3">
        <div data-tour="chart" className="min-w-0"><Card frame title={`${d.label} · monthly`} sub={d.unit === '%' ? 'Percent' : d.unit} right={<Legend s={series} />}>
          <ForecastChart title={`${d.label} forecast`} s={series} fmt={v => fmtV(id, v)} dp={d.dp} unit={d.unit} height={mode === 'overview' ? 340 : 280} />
        </Card></div>
        {mode === 'overview' && <TrendPanel series={ACTUALS[id]} label={d.label} fmt={v => fmtV(id, v)} pct={d.pct} />}
      </div>

      {mode === 'assumptions' && locked && (
        <Card><p className="flex items-start gap-2 text-sm text-text-2"><Lock size={15} className="mt-0.5 shrink-0" /><span><b className="font-medium text-text">{d.label} is system-fed for this model.</b> The CoE has not exposed it as an override, so its values and formula cannot be changed here. Pick another module from the forecast map.</span></p></Card>
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
        {!hidden && <InfoTip text="Grey = actual · dot = assumption you can type over · blue fill = overridden · dashed underline = recalculated." />}
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

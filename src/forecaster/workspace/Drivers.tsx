import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ClipboardPaste, Lock, PanelRightClose, PencilLine, RotateCcw, Upload, Users } from 'lucide-react'
import {
  ACT, ACTUALS, BASELINE, CURVE_LABEL, DRIVERS, DRV, FY, GTN, METHOD_LABEL, MONTHS, N, OUTPUTS, UNBIASED, YEARS,
  applyEdit, defaultEdit, fmtV, fyAvg, idxOf, mLong, netPrice, revenue, yearOf, fySum,
} from './engine'
import type { Curve, DriverId, Edit, Layer, Method, ModelCfg, OutputId } from './engine'
import { Btn, Card, ForecastChart, Label, Legend, Seg, Tag, Toggle, cx, field, PageTitle, InfoTip, MoreMenu } from './ui'
import { AgentFrame } from '../../chat/Agent'
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

export function ForecastMap({ sel, onSel, edits, working, model, metric, mod, onMod, uePct, onCollapse }: { sel: Sel; onSel: (s: Sel) => void; edits: Edits; working: Layer; model: ModelCfg; metric: OutputId; mod: ModId | null; onMod: (m: ModId) => void; uePct: number; onCollapse?: () => void }) {
  const agent = useAgentFocus()
  const node = (id: DriverId, editable: boolean, width?: string) => {
    const d = DRV[id], on = !mod && sel === id, changed = !!edits[id]
    return (
      <button key={id} type="button" onClick={() => onSel(id)} aria-current={on ? 'true' : undefined} style={{ width }}
        className={cx('group mx-auto flex min-w-0 items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2.5 text-left transition-all', on ? 'border-[#266df0] ring-2 ring-[#266df0]/15 shadow-[0_1px_2px_rgba(16,24,40,0.06)]' : 'border-border hover:border-border-strong hover:shadow-[0_1px_2px_rgba(16,24,40,0.04)]', on && agent.section === 'assume' && 'agent-ring')}>
        <span className="min-w-0">
          <span className="block truncate text-[11px] text-text-3">{d.step}</span>
          <span className="block truncate text-[13px] font-medium text-text">{d.label}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-[13px] text-text" title={id === 'rx' ? `${fmtV(id, fyAvg(working[id]))} Rx per patient` : undefined}>{id === 'rx' ? OUTPUTS.trx.fmt(fySum(OUTPUTS.trx.fn(working))) : fmtV(id, fyAvg(working[id]))}</span>
          {!editable ? <span className="inline-flex items-center gap-1 text-[10.5px] text-text-3"><Lock size={9} />System-fed</span>
            : changed ? <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-brand"><span className="h-1.5 w-1.5 rounded-full bg-[#e07b18]" />Modified</span>
            : <span className="text-[10.5px] text-text-3">{id === 'rx' ? `TRx FY${FY}` : `FY${FY} avg`}</span>}
        </span>
      </button>
    )
  }
  const link = (k: string) => <div key={k} className="mx-auto h-3 w-px bg-border-strong" />
  const funnel = model.modules.filter(m => DRV[m.id].pct), side = model.modules.filter(m => !DRV[m.id].pct)
  const out = OUTPUTS[metric]
  return (
    <nav aria-label="Forecast map" className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><Label>Forecast map</Label>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-text-3">{model.modules.length} modules · from model<InfoTip text="Modules, order and editable inputs come from the model published by the CoE. Formulas are locked." /></span>
        {onCollapse && <button type="button" onClick={onCollapse} aria-label="Collapse forecast map" title="Collapse" className="-mr-1 grid h-7 w-7 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><PanelRightClose size={15} /></button>}</div>
      <div className="mx-auto flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 px-3 py-2.5">
        <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-text-3">Starting point</span><span className="block truncate text-[13px] font-semibold">{model.start.label}</span></span>
        <span className="flex items-center gap-1 font-mono text-[13px] text-text-2"><Lock size={11} />{model.start.value}</span>
      </div>
      {funnel.flatMap((m, k) => [link(`l${m.id}`), node(m.id, m.editable, `${Math.max(60, 100 - k * 8)}%`)])}
      {side.length > 0 && <div className="relative mx-auto my-2 flex items-center gap-2 pl-2 text-[11px] text-text-3"><span className="h-px flex-1 bg-border" />combined with<span className="h-px flex-1 bg-border" /></div>}
      {side.map(m => node(m.id, m.editable, '70%'))}
      {side.some(m => m.id === 'price') && <div className="mx-auto mt-1 flex w-[70%] items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-3 py-2">
        <span className="min-w-0"><span className="block truncate text-[11px] text-text-3">Calculated</span><span className="block truncate text-[13px] font-medium text-text-2">Net sales price</span></span>
        <span className="flex shrink-0 flex-col items-end"><span className="font-mono text-[13px] text-text-2">{fmtV('price', netPrice(fyAvg(working.price)))}</span><span className="inline-flex items-center gap-1 text-[10.5px] text-text-3"><Lock size={9} />× (1 − {Math.round(GTN * 100)}% GTN)</span></span>
      </div>}
      {link('bridge')}
      <div data-tour="bridge" className="rounded-md border border-border bg-surface-2/60 p-2">
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-text-3">Revenue bridge · required in every model</p>
        <div className="space-y-1">{MODS.map(m => {
          const on = mod === m.id, b = bridgeOf(fySum(revenue(working)), uePct)
          const v = m.id === 'tud' ? fmtB(b.tud) : m.id === 'inv' ? `+${fmtB(b.inv)}` : m.id === 'ue' ? `${uePct.toFixed(1)}%` : m.id === 'fx' ? '1.00' : ''
          return (
            <button key={m.id} type="button" onClick={() => onMod(m.id)} aria-current={on ? 'true' : undefined}
              className={cx('flex w-full items-center justify-between gap-2 rounded-lg border bg-surface px-2.5 py-1.5 text-left transition-all', on ? 'border-[#266df0] ring-2 ring-[#266df0]/15 shadow-[0_1px_2px_rgba(16,24,40,0.06)]' : 'border-border hover:border-border-strong hover:shadow-[0_1px_2px_rgba(16,24,40,0.04)]')}>
              <span className="min-w-0"><span className="block truncate text-[12.5px] font-medium text-text">{m.label}</span>
                <span className={cx('inline-flex items-center gap-1 text-[10.5px]', m.edit ? 'text-warn' : 'text-text-3')}>{!m.edit && <Lock size={9} />}{m.kind}</span></span>
              {v && <span className="shrink-0 font-mono text-[12px] text-text">{v}</span>}
            </button>)
        })}</div>
      </div>
      {link('out')}
      <button type="button" onClick={() => onSel('rev')} aria-current={!mod && sel === 'rev' ? 'true' : undefined}
        className={cx('flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-3 text-left transition-all', !mod && sel === 'rev' ? 'border-[#266df0] ring-2 ring-[#266df0]/15 shadow-[0_1px_2px_rgba(16,24,40,0.06)]' : 'border-border hover:border-border-strong hover:shadow-[0_1px_2px_rgba(16,24,40,0.04)]')}>
        <span className="min-w-0"><span className="block text-[11px] text-text-3">Outcome</span><span className="block truncate text-[13px] font-medium text-text">{out.label}</span></span>
        <span className="font-mono text-[13px] font-medium text-text">{out.fmt(fySum(out.fn(working)))}</span>
      </button>
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

type CellState = 'system' | 'override' | 'recalc'
function GridCell({ value, dp, state, onCommit, onCancel }: { value: number; dp: number; state: CellState; onCommit: (v: number) => string | null; onCancel: () => void }) {
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
export function DriverWorkspace({ mode, sel, edits, setEdits, scenarioLayer, scenarioName, workingLayer, model, metric, setMetric, onOpenAssumptions, onGo, onDirty, actions, notify }: {
  mode: DriverMode; sel: Sel; edits: Edits; setEdits: (f: (e: Edits) => Edits) => void; scenarioLayer: Layer; scenarioName: string; workingLayer: Layer
  model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void; onOpenAssumptions: () => void
  onGo: (s: 'assumptions' | 'events') => void; onDirty: (v: boolean) => void; actions?: MutableRefObject<DriverActions | null>; notify: Notify
}) {
  if (sel === 'rev') return <RevenueView {...{ workingLayer, scenarioLayer, scenarioName, model, metric, setMetric }} />
  const cfg = model.modules.find(m => m.id === sel)
  return <DriverEditorView key={sel} id={sel} locked={!!cfg && !cfg.editable} {...{ mode, edits, setEdits, scenarioLayer, scenarioName, workingLayer, onOpenAssumptions, onGo, onDirty, actions, notify }} />
}

function RevenueView({ workingLayer, scenarioLayer, scenarioName, model, metric, setMetric }: { workingLayer: Layer; scenarioLayer: Layer; scenarioName: string; model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void }) {
  const o = OUTPUTS[metric]
  const s: ChartSeries = { actual: o.fn(FULL_ACTUALS), unbiased: o.fn(UNBIASED), working: o.fn(workingLayer), scenario: o.fn(scenarioLayer), scenarioName }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title={o.label} info="Combines every module in the forecast map. It is not edited directly. Change an assumption, or turn on events in a scenario, to move it. The reference baseline never moves." />
        <OutputSelect model={model} metric={metric} onChange={setMetric} />
      </div>
      <Card title={`Monthly ${o.label.toLowerCase()}`} sub={o.unit} right={<Legend s={s} />}><ForecastChart title={`${o.label} forecast`} s={s} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={320} /></Card>
    </div>
  )
}

function DriverEditorView({ id, mode, locked, edits, setEdits, scenarioLayer, scenarioName, workingLayer, onOpenAssumptions, onGo, onDirty, actions, notify }: {
  id: DriverId; mode: DriverMode; locked: boolean; edits: Edits; setEdits: (f: (e: Edits) => Edits) => void; scenarioLayer: Layer; scenarioName: string; workingLayer: Layer
  onOpenAssumptions: () => void; onGo: (s: 'assumptions' | 'events') => void; onDirty: (v: boolean) => void; actions?: MutableRefObject<DriverActions | null>; notify: Notify
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
        <div className="min-w-0"><PageTitle title={d.label} info={`${d.desc} Source: Data Science baseline · monthly · brand level.`} /></div>
        {mode === 'overview' && !locked && <Btn variant="secondary" onClick={onOpenAssumptions} icon={<PencilLine size={14} />}>Edit assumption</Btn>}
      </div>

      <div className="space-y-3">
        <div data-tour="chart" className="min-w-0"><Card title={`${d.label} · monthly`} sub={d.unit === '%' ? 'Percent' : d.unit} right={<Legend s={series} />}>
          <ForecastChart title={`${d.label} forecast`} s={series} fmt={v => fmtV(id, v)} dp={d.dp} unit={d.unit} height={mode === 'overview' ? 340 : 280} />
        </Card></div>
        {mode === 'overview' && <TrendPanel series={ACTUALS[id]} label={d.label} fmt={v => fmtV(id, v)} pct={d.pct} />}
      </div>


      {mode === 'assumptions' && locked && (
        <Card><p className="flex items-start gap-2 text-sm text-text-2"><Lock size={15} className="mt-0.5 shrink-0" /><span><b className="font-medium text-text">{d.label} is system-fed for this model.</b> The CoE has not exposed it as an override, so its values and formula cannot be changed here. Pick another module from the forecast map.</span></p></Card>
      )}

      {editing && (
        <AgentFrame on={agent.section === 'assume'} label={`${agent.name} is adjusting ${d.label.toLowerCase()}`}>
        <Card title="Adjust assumption" info="Override permitted values or change the projection method. The calculation formula stays locked and the reference baseline never changes."
          right={<div className="flex items-center gap-2">{dirty ? <Tag tone="warn">Unapplied changes</Tag> : applied ? <Tag tone="brand">Applied</Tag> : null}
            <MoreMenu label="Assumption actions" items={[
              { label: 'Upload Excel', icon: <Upload size={14} />, onClick: () => fileRef.current?.click() },
              { label: paste !== null ? 'Close paste box' : 'Paste from Excel', icon: <ClipboardPaste size={14} />, onClick: () => setPaste(p => p === null ? '' : null) },
              { label: 'Reset to system value', icon: <RotateCcw size={14} />, disabled: !applied && !dirty, onClick: reset },
            ]} /></div>}>
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
              {eff.method === 'hold' && <div className="sm:col-span-2"><Label className="mb-1">Carried value</Label><p className="flex h-9 items-center rounded-md bg-surface-2 px-3 font-mono text-sm">{fmtV(id, lastActual)} <span className="ml-2 font-sans text-text-3">last actual, {mLong(ACT - 1)}</span></p></div>}
            </div>

            {eff.method !== 'direct' && (
              <label className="flex items-center gap-3 text-sm"><Toggle on={eff.hold} onChange={v => patch({ hold: v })} label="Hold flat after end" />
                <span><b className="font-medium">Hold flat after end</b><span className="text-text-2"> · {eff.hold ? 'the end value carries forward' : 'the series rejoins the reference baseline'}</span></span></label>
            )}

            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
            {eff.method === 'direct' && eff.source !== 'manual' && <Tag tone="brand">Values from {eff.source === 'excel' ? 'file' : 'paste'}</Tag>}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentType } from 'react'
import { scrollFrameTop } from '../../frame'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Lock, Maximize2, Minimize2, Save } from 'lucide-react'
import { CountryCompare, FunnelTable, Guardrails, RevenueMath } from './Extras'
import { ACT, ACTUALS, DEFAULT_MODEL, DRIVERS, DRV, FY, GTN, N, OUTPUTS, SEED_EVENTS, SEED_SCENARIOS, UNBIASED, defaultEdit, fmtV, fyAvg, fySum, measure, mLong, revenue, scenarioLayer, workingLayer } from './engine'
import type { DriverId, EventDef, Layer, ModelCfg, OutputId, Override, Scenario } from './engine'
import { Btn, COLOR, Seg, Tag, cx } from './ui'
import { DriverWorkspace, ForecastMap } from './Drivers'
import type { CompareProps, DriverActions, Edits, Notify, Sel } from './Drivers'
import { LRF_SEED, LrfEventsPanel, LrfSummary, LrfTab } from './Lrf'
import type { LrfMetric, LrfState } from './Lrf'
import { FullModelGrid, PeriodGrowth, ScenarioChips, defaultRange, scColor } from './WorkspaceModel'
import { EventsStage, GoalSeekStage, ReviewStage, ScenariosStage } from './Stages'
import { SensitivityStage } from './Analysis'
import { ScenarioSummary } from './Summary'
import type { Calc } from './Stages'
import { BaselineTrend } from './BaselineTrend'
import { FORECAST, ScenarioBar, ScenarioChanges, ScenarioDriverView } from './WorkspaceScenarios'
import { GrossPriceModule, ModuleView, NetSalesPriceView, WOH_DEFAULT, gpDefault, gpEdit, stdSeries, ueDefault, ueFy } from './Modules'
import type { GpState, ModId, ModTrend } from './Modules'
import { InsightsCtx } from './insightsCtx'
import type { SaveReq } from './insightsCtx'
import type { Insight } from './insights'
import { AgentBanner, AgentButton } from '../../chat/Agent'
import { AgentFocusCtx, useForecastAgent } from './agent'
import type { AgentView, CopilotProps } from './agent'
import { RotateCcw } from 'lucide-react'

type View = AgentView
/** Actuals through the last booked month, the statistical trend after: the reference every module trend is drawn against. */
const FULL_ACT: Layer = Object.fromEntries(DRIVERS.map(d => [d.id, UNBIASED[d.id].map((v, i) => i < ACT ? ACTUALS[d.id][i]! : v)])) as Layer
const usd2 = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// Working order. Scenarios are created in the Forecast workspace and compared in the Scenario summary, so there is no separate Scenarios tab.
const STEPS: View[] = ['Overview', 'Assumptions', 'LRF', 'Events', 'Summary', 'Sensitivity', 'Goal seek', 'Review']
// CR-004: the analytics layer sits below the workflow tabs on every screen, greyed out until each tab's content is defined in a later change request.
const LIVE = ['Patient Funnel', 'Markets']
const ANALYTICS = ['Patient Funnel', 'Performance Dashboard', 'Sales Drivers', 'Judgement Layer', 'Long Range Plan', 'Competition', 'Financial Bridges', 'Needs-to-Meet', 'GTN Analysis', 'Markets']
const LABEL: Record<View, string> = { Overview: 'Baseline trend', Assumptions: 'Forecast workspace', LRF: 'LRF', Events: 'Events', Scenarios: 'Scenario summary', Summary: 'Scenario summary', Sensitivity: 'Sensitivity', 'Goal seek': 'Goal seek', Review: 'Review' }
const NEXT: Partial<Record<View, View>> = Object.fromEntries(STEPS.slice(0, -1).map((v, i) => [v, STEPS[i + 1]!]))
const canon = (v: View): View => (v === 'Scenarios' ? 'Summary' : v)

export default function ForecastWorkspace({ notify, onHome, brand = 'Nurtec', brandId = 'nurtec', cycle = 'AOP 2027', stream = 'US net revenue', model = DEFAULT_MODEL, insights, setInsights, onAsk, Copilot, assistant = 'Charles', onPublished }: { notify: Notify; onHome?: () => void; brand?: string; brandId?: string; cycle?: string; stream?: string; model?: ModelCfg; insights: Insight[]; setInsights: (f: (x: Insight[]) => Insight[]) => void; onAsk?: (brandId?: string) => void; Copilot?: ComponentType<CopilotProps>; assistant?: string
  /** Called when a scenario is finalised: files it as the brand's submitted version for Forecast AI. */
  onPublished?: (brandId: string, scenario: string) => void }) {
  const [view, setView] = useState<View>('Overview')
  const [an, setAn] = useState<string | null>(null)
  const [lrfStart, setLrfStart] = useState<{ metric: LrfMetric; n: number } | null>(null)
  const [anOpen, setAnOpen] = useState(false)
  const anRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!anOpen) return; const h = (e: MouseEvent) => { if (!anRef.current?.contains(e.target as Node)) setAnOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [anOpen])
  const [ue, setUe] = useState(ueDefault)
  const [woh, setWoh] = useState(WOH_DEFAULT)
  const [gp, setGp] = useState<GpState>(gpDefault)
  // A default module picked in the forecast map replaces the driver view; picking a driver clears it.
  const [mod, setMod] = useState<ModId | null>(null)
  // Weighted gross price is a module of its own (SKU mix and price), not a generic driver, so picking it opens the module.
  const selDriver = (s: Sel) => { if (s === 'price') { setMod('gp'); return } setMod(null); setSel(s) }
  const [sel, setSel] = useState<Sel>(model.modules.find(m => m.editable && m.id !== 'price')?.id ?? model.modules[0]!.id)
  const [edits, setEdits] = useState<Edits>({})
  const [events, setEvents] = useState<EventDef[]>(SEED_EVENTS)
  const [scenarios, setScenarios] = useState<Scenario[]>(SEED_SCENARIOS)
  const [selId, setSelId] = useState('sc2')
  // What the Forecast workspace edits: the active forecast, or one scenario's own changes.
  const [scope, setScopeState] = useState<string>(FORECAST)
  const [year, setYear] = useState(FY)
  const [metric, setMetric] = useState<OutputId>(model.outputs[0]!)
  const [presenting, setPresenting] = useState(false)
  const [full, setFull] = useState(false)
  useEffect(() => { const h = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const toggleFull = () => { try { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen() } catch { /* unsupported */ } }
  const [driverDirty, setDriverDirty] = useState(false)
  const actions = useRef<DriverActions | null>(null)
  // Long-range plan per scenario (LRF tab) and the workspace chart's view: hidden lines, start / end month, price tab.
  const [lrf, setLrf] = useState<LrfState>(() => LRF_SEED(SEED_SCENARIOS))
  const [hidden, setHidden] = useState<string[]>([])
  const [range, setRange] = useState<[number, number]>(defaultRange)
  const [gpTab, setGpTab] = useState<'trend' | 'sku'>('trend')
  const snapshot = useMemo(() => JSON.stringify({ edits, events, scenarios, ue, woh, gp, lrf }), [edits, events, scenarios, ue, woh, gp, lrf])
  const [saved, setSaved] = useState(snapshot)
  const dirty = snapshot !== saved

  const calc = useMemo<Calc>(() => {
    const work = workingLayer(edits)
    const out: Calc = { __working: { layer: work, rev: revenue(work), fy: fySum(revenue(work)), events: [] } }
    for (const s of scenarios) {
      const evs = events.filter(e => s.active.includes(e.id))
      const layer = scenarioLayer(work, s, events), rev = revenue(layer)
      out[s.id] = { layer, rev, fy: fySum(rev), events: evs }
    }
    return out
  }, [edits, events, scenarios])

  useEffect(() => {
    if (!dirty && !driverDirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty, driverDirty])

  // A new scenario replicates the forecast assumptions, so its long-range plan starts as a copy of the Base Case plan.
  useEffect(() => {
    setLrf(st => {
      const miss = scenarios.filter(s => !st[s.id]), src = st.sc2 ?? Object.values(st)[0]
      return miss.length && src ? { ...st, ...Object.fromEntries(miss.map(s => [s.id, structuredClone(src)])) } : st
    })
  }, [scenarios])
  // A scenario deleted in the workspace must not stay selected on the other tabs.
  useEffect(() => { if (!scenarios.some(s => s.id === selId)) setSelId(scenarios[0]?.id ?? '') }, [scenarios, selId])
  const work = calc.__working!
  const sc = calc[selId] ?? calc[scenarios[0]!.id]!
  const scName = (scenarios.find(s => s.id === selId) ?? scenarios[0]!).name
  // A scenario deleted elsewhere falls back to the active forecast.
  const scenario = scenarios.find(s => s.id === scope) ?? null
  const scopeCalc = scenario ? calc[scenario.id]! : work
  const finalised = scenarios.some(s => s.locked)
  const modified = Object.keys(edits).length
  const leaveOk = () => !driverDirty || window.confirm('You have unapplied changes to this assumption. Discard them?')
  const go = (v: View) => { const t = canon(v); if ((t === view && !an) || !leaveOk()) return; setAn(null); setView(t); scrollFrameTop() }
  const setScope = (s: string) => { if (s !== scope && !leaveOk()) return; setScopeState(s); if (s !== FORECAST) setSelId(s) }
  const pick = (s: Sel) => { if ((s !== sel || mod) && leaveOk()) selDriver(s) }
  const onDirty = useCallback((v: boolean) => setDriverDirty(v), [])
  const save = () => { setSaved(snapshot); notify({ tone: 'ok', text: 'Draft saved. Assumptions, events and scenarios are kept.' }) }
  const saveInsight = useCallback((r: SaveReq) => {
    setInsights(xs => [{ id: `u${Date.now()}`, brandId, brand, cycle, kind: r.scenario ? 'Scenario' : 'View', title: r.title, note: `Saved from the ${LABEL[view]} view.`, snap: r.snap, scenario: r.scenario, by: 'me', at: 'Just now', tagged: [], thread: [] }, ...xs])
    notify({ tone: 'ok', text: `Saved to ${brand} Insights. Open it from the Knowledge bank to comment and tag people.` })
  }, [setInsights, brandId, brand, cycle, view, notify])
  const home = () => { if ((dirty || driverDirty) && !window.confirm('You have unsaved changes. Leave without saving?')) return; onHome?.() }
  const show = (v: AgentView) => { setView(canon(v)); scrollFrameTop() }
  const agent = useForecastAgent({ name: assistant, brand, state: { edits, events, scenarios, selId }, show, blocked: () => driverDirty,
    editable: model.modules.filter(m => m.editable).map(m => m.id), set: { edits: setEdits, events: setEvents, scenarios: setScenarios, selId: setSelId, sel: selDriver } })
  const st = agent.status
  const toggleFinal = (id: string) => {
    const s = scenarios.find(x => x.id === id)
    if (!s) return
    setScenarios(ss => ss.map(x => x.id === id ? { ...x, locked: !x.locked } : x))
    // Reopening keeps the filed version; only a new finalise files another one.
    if (!s.locked) onPublished?.(brandId, s.name)
    notify({ tone: s.locked ? 'info' : 'ok', text: s.locked ? `${s.name} reopened for editing. The submitted version Forecast AI uses is unchanged.` : `${s.name} finalised, locked and submitted for review. Forecast AI now answers from this version.` })
  }
  const applyGp = (g: GpState) => {
    const e = gpEdit(g)
    setGp(g); setEdits(ed => { const n = { ...ed }; if (e) n.price = e; else delete n.price; return n })
    notify({ tone: 'ok', text: e ? `Weighted gross price applied: ${e.notes} Gross, net and the revenue bridge recalculate.` : 'Weighted gross price is back at the system value.' })
  }
  const resetGp = () => { setGp(gpDefault()); setEdits(ed => { const n = { ...ed }; delete n.price; return n }); notify({ tone: 'info', text: 'Weighted gross price is back at the system value.' }) }
  const priceEditable = model.modules.find(m => m.id === 'price')?.editable !== false

  /* ───── Forecast workspace: every scenario on the chart, the month range, and typing over the model grid ───── */
  const focusId = scenario ? scenario.id : FORECAST
  const editableIds = model.modules.filter(m => m.editable).map(m => m.id)
  const toggleLine = (id: string) => { if (id !== focusId) setHidden(h => h.includes(id) ? h.filter(x => x !== id) : [...h, id]) }
  const carry = (id: DriverId, pct: number) => {
    const note = `Growth of ${pct}% a year seen ${mLong(range[0])} to ${mLong(range[1])}, carried forward`
    if (scenario) {
      if (scenario.locked) return
      const o: Override = { id: `ov${Date.now()}`, driver: id, kind: 'growth', start: ACT, end: N - 1, value: pct, curve: 'linear', years: {}, note, by: 'period growth' }
      setScenarios(ss => ss.map(s => s.id === scenario.id ? { ...s, ovr: [...(s.ovr ?? []), o] } : s))
    } else setEdits(e => ({ ...e, [id]: { ...defaultEdit(id), method: 'growth', start: ACT, end: N - 1, growth: pct, hold: false, notes: note } }))
    notify({ tone: 'ok', text: `${DRV[id].label}: ${note}${scenario ? ` in ${scenario.name}` : ' in the active forecast'}.` })
  }
  /** Chart context for one metric: the other scenarios as lines, the chips and period picker above it, and the month range. */
  const compareFor = (key: DriverId | OutputId, includeFocus: boolean): CompareProps => {
    const isOut = key in OUTPUTS, o = OUTPUTS[key as OutputId]
    const line = (l: Layer): number[] => isOut ? o.fn(l) : l[key as DriverId]
    const val = (l: Layer) => isOut ? o.fmt(measure(key as OutputId, l, year), 0) : fmtV(key as DriverId, fyAvg(l[key as DriverId], year))
    const shown = (id: string) => id === focusId || !hidden.includes(id)
    const chips = [
      { id: FORECAST, name: 'Active forecast', color: COLOR.working, value: val(work.layer), focus: !scenario, shown: shown(FORECAST) },
      ...scenarios.map((s, k) => ({ id: s.id, name: s.name, color: scColor(s, k), value: val(calc[s.id]!.layer), focus: s.id === focusId, shown: shown(s.id) })),
    ]
    const extra = scenarios.map((s, k) => ({ name: s.name, color: scColor(s, k), series: line(calc[s.id]!.layer), bold: s.id === focusId, id: s.id })).filter(x => shown(x.id) && (includeFocus || x.id !== focusId)).map(({ id: _id, ...x }) => x)
    const driver = isOut ? null : key as DriverId, canCarry = !!driver && editableIds.includes(driver) && !scenario?.locked
    return {
      extra, range, hideForecast: !shown(FORECAST), scenarioFocus: !!scenario,
      header: <>
        <ScenarioChips chips={chips} onToggle={toggleLine} year={year} />
        <PeriodGrowth series={line(scopeCalc.layer)} id={driver} range={range} setRange={setRange} fmt={v => isOut ? o.fmt(v, 1) : fmtV(key as DriverId, v)}
          onCarry={canCarry ? pct => carry(driver!, pct) : undefined} carryNote={canCarry ? `Sets ${DRV[driver!].label.toLowerCase()} to grow at the annualised rate from ${mLong(ACT)}${scenario ? ` in ${scenario.name} only` : ''}.` : isOut ? 'Outcomes are calculated, so growth cannot be carried forward.' : undefined} />
      </>,
    }
  }
  const onCell = (id: DriverId, i: number, v: number): string | null => {
    const d = DRV[id], cur = scopeCalc.layer[id], old = cur[i]!
    if (!Number.isFinite(v) || v < 0 || (d.pct && v > 100)) return 'out of range'
    if (Math.abs(v - old) < 1e-9) return null
    const note = `Typed over ${mLong(i)} in the model grid; later months follow.`
    if (scenario) {
      if (scenario.locked) return 'locked'
      const o: Override = { id: `ov${Date.now()}`, driver: id, kind: 'shift', start: i, end: N - 1, value: d.pct ? v - old : (v / old - 1) * 100, curve: 'linear', years: {}, note, by: 'grid' }
      setScenarios(ss => ss.map(s => s.id === scenario.id ? { ...s, ovr: [...(s.ovr ?? []), o] } : s))
    } else {
      const values: Record<number, number> = {}
      for (let k = ACT; k < N; k++) values[k] = k >= i ? (d.pct ? cur[k]! + (v - old) : cur[k]! * (v / old)) : cur[k]!
      setEdits(e => ({ ...e, [id]: { ...defaultEdit(id), method: 'direct', start: i, values, pinned: [i], notes: note, source: 'manual' } }))
    }
    notify({ tone: 'ok', text: `${d.label} ${mLong(i)} set to ${fmtV(id, v)}${scenario ? ` in ${scenario.name}` : ' in the active forecast'}; later months follow.` })
    return null
  }
  const openRow = (go: string) => {
    if (!leaveOk()) return
    if (go === 'rev' || go === 'trx') { setMod(null); setSel('rev'); setMetric(go); return }
    if (go === 'tud' || go === 'inv' || go === 'ue' || go === 'fx' || go === 'netp') { setMod(go); return }
    selDriver(go as DriverId)
  }
  const gridSel = mod === 'gp' ? 'price' : mod ?? (sel === 'rev' ? (metric === 'trx' ? 'trx' : 'rev') : sel)
  const trendOn = !mod || (mod === 'gp' && gpTab === 'trend')
  const shownSel: Sel = mod === 'gp' ? 'price' : sel
  const cmp = trendOn ? compareFor(shownSel === 'rev' ? metric : shownSel, shownSel === 'rev' && !!scenario) : undefined
  /** Monthly trend of a default module: actuals, the statistical reference and the active forecast (or the scenario being worked on). */
  const modTrend = (id: Exclude<ModId, 'gp'>): ModTrend => {
    const k = ({ tud: 'tud', inv: 'inv', ue: 'uePct', fx: 'fx', netp: 'netPrice' } as const)[id]
    const a = stdSeries(FULL_ACT, ue, woh)[k], r = stdSeries(UNBIASED, ue, woh)[k], w = stdSeries(scopeCalc.layer, ue, woh)[k]
    const spec = { tud: { fmt: (v: number) => `$${v.toFixed(1)}M`, dp: 0, unit: '$M' }, inv: { fmt: (v: number) => `$${v.toFixed(2)}M`, dp: 1, unit: '$M' }, ue: { fmt: (v: number) => `${v.toFixed(1)}%`, dp: 1, unit: '% of gross' },
      fx: { fmt: (v: number) => v.toFixed(2), dp: 2, unit: 'USD per USD' }, netp: { fmt: usd2, dp: 0, unit: '$ / pack' } }[id]
    return { s: { actual: a, unbiased: r, working: w, scenarioName: scenario?.name }, ...spec }
  }
  const grossFy = fyAvg(scopeCalc.layer.price, year)

  return (
    <InsightsCtx.Provider value={{ save: saveInsight }}>
    <AgentFocusCtx.Provider value={{ ...agent.focus, name: assistant }}>
    {Copilot && <Copilot {...agent.copilot(() => show('Review'))} />}
    {typeof document !== 'undefined' && document.getElementById('topbar-ws') && createPortal(
      <>
        {onHome && <button type="button" onClick={home} aria-label="Back to your forecasts" title="Back to your forecasts" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><ArrowLeft size={15} /></button>}
        <span className="truncate text-[13.5px] font-semibold text-text">{brand} forecast</span>
        <span className="hidden truncate text-[12px] text-text-3 md:inline">{cycle} · {stream}</span>
        <Tag tone={finalised ? 'ok' : modified ? 'brand' : 'neutral'}>{finalised ? 'Finalised' : modified ? `Modified · ${modified} assumption${modified === 1 ? '' : 's'}` : 'Draft'}</Tag>
      </>,
      document.getElementById('topbar-ws')!
    )}
    <div className="min-h-full bg-background">
      {!presenting && (
        <div className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <nav data-tour="tabs" aria-label="Forecast sections" className="mx-auto max-w-[1240px] px-6">
            <div role="tablist" className="flex flex-nowrap items-end gap-0.5">
              {STEPS.map(v => {
                const badge = v === 'Assumptions' ? modified : v === 'Summary' ? scenarios.length : v === 'Events' ? events.length : 0
                return (
                  <button key={v} type="button" role="tab" aria-selected={!an && v === view} onClick={() => go(v)}
                    className={cx('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors', !an && v === view ? 'border-text text-text' : 'border-transparent text-text-2 hover:text-text')}>
                    {LABEL[v]}{badge > 0 && <span className={cx('rounded-full px-1.5 text-[11px] font-semibold', !an && v === view ? 'bg-text text-white' : 'bg-surface-2 text-text-2')}>{badge}</span>}
                  </button>)
              })}
              <div ref={anRef} data-tour="analytics" className="relative -mb-px ml-1">
                <button type="button" aria-haspopup="menu" aria-expanded={anOpen} onClick={() => setAnOpen(o => !o)}
                  className={cx('inline-flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors', an ? 'border-text text-text' : 'border-transparent text-text-2 hover:text-text')}>{an ?? 'Analytics'}<ChevronDown size={14} /></button>
                {anOpen && <ul role="menu" className="rise absolute left-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
                  {ANALYTICS.map(a => LIVE.includes(a)
                    ? <li key={a}><button type="button" role="menuitem" onClick={() => { setAnOpen(false); if (leaveOk()) { setAn(a); scrollFrameTop() } }} className={cx('w-full px-4 py-2 text-left text-[13px] font-medium hover:bg-surface-2', an === a && 'bg-surface-2 font-semibold')}>{a}</button></li>
                    : <li key={a}><span role="menuitem" aria-disabled="true" title="Content comes in a later release" className="flex w-full cursor-not-allowed items-center justify-between px-4 py-2 text-[13px] text-text-3">{a}<Lock size={11} /></span></li>)}
                </ul>}
              </div>
              <button type="button" onClick={toggleFull} title={full ? 'Exit full screen' : 'Full screen'} aria-label={full ? 'Exit full screen' : 'Full screen'} className="mb-1.5 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
            </div>
          </nav>
          {st && (
            <div className="mx-auto max-w-[1240px] px-6 pb-3 pt-3">
              <AgentBanner assistant={assistant} running={st.running} step={st.step} progress={st.progress} title={st.title} onStop={agent.stop} onDismiss={() => agent.setStatus(null)}
                actions={<>{view !== 'Review' && st.after !== undefined && <AgentButton onClick={() => go('Review')}>Review the forecast</AgentButton>}{agent.undo && <AgentButton variant="outline" icon={<RotateCcw size={13} />} onClick={agent.undo}>Undo</AgentButton>}</>}>
                {st.body}
              </AgentBanner>
            </div>
          )}
        </div>
      )}

      {an === 'Patient Funnel' && <FunnelTable calc={calc} scenarios={scenarios} />}
      {an === 'Markets' && <CountryCompare calc={calc} scenarios={scenarios} />}
      {!an && <div className="mx-auto max-w-[1240px] px-6 py-8">
        {view === 'Overview' && <BaselineTrend onWorkspace={() => go('Assumptions')} onEvents={() => go('Events')} />}
        {view === 'Assumptions' && (
          <div className="space-y-6">
            <ScenarioBar scenarios={scenarios} setScenarios={setScenarios} scope={scenario ? scenario.id : FORECAST} setScope={setScope} year={year} setYear={setYear} calc={calc} notify={notify} />
            <Guardrails layer={scopeCalc.layer} />
            <div className={cx('grid gap-6', !presenting && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
              <aside className="lg:sticky lg:top-[112px] lg:order-last lg:self-start">
                <ForecastMap sel={sel} metric={metric} onSel={pick} mod={mod} onMod={m => { if (m !== mod && leaveOk()) setMod(m) }} onOutcome={m => { if (leaveOk()) { setMod(null); setSel('rev'); setMetric(m) } }}
                  edits={edits} reference={work.layer} layer={scopeCalc.layer} scenario={scenario} events={events} model={model} ue={ue} woh={woh} year={year} />
              </aside>
              <main className="min-w-0">
                {mod && mod !== 'gp' && scenario && <p className="mb-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-2.5 text-[12.5px] text-text-2">Default modules are set once for the whole forecast and apply to every scenario, including {scenario.name}.</p>}
                {mod === 'gp' && (
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Edit level</span>
                    <Seg label="Weighted gross price edit level" value={gpTab} onChange={setGpTab} options={[{ id: 'trend', label: 'Weighted brand' }, { id: 'sku', label: 'By SKU' }]} />
                    <span className="text-[12.5px] text-text-3">{gpTab === 'trend' ? 'Actual and forecast trend of the brand price, with every scenario. Override the brand price below, like any assumption.' : 'Each pack’s list price and mix. The brand price recomputes live as Σ(price × mix).'}</span>
                  </div>)}
                {mod === 'gp' && gpTab === 'trend' && (
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-surface shadow-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Weighted gross price</p><p className="mt-0.5 font-mono text-[22px] font-semibold">{usd2(grossFy)} <span className="text-[12px] font-normal text-text-3">/ pack</span></p><p className="text-[12px] text-text-2">FY{year} average · {scenario ? scenario.name : 'active forecast'}</p></div>
                    <div className="rounded-2xl border border-border bg-surface shadow-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Price per tablet (calc)</p><p className="mt-0.5 font-mono text-[22px] font-semibold">{usd2(grossFy / 8)} <span className="text-[12px] font-normal text-text-3">/ tab</span></p><p className="text-[12px] text-text-2">= {usd2(grossFy)} ÷ 8 pills per pack</p></div>
                    <button type="button" onClick={() => setMod('netp')} className="rounded-lg border border-brand/30 bg-brand-soft/40 p-4 text-left hover:border-brand"><p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Net sales price · calculated view</p><p className="mt-0.5 font-mono text-[22px] font-semibold text-brand">{usd2(grossFy * (1 - GTN))} <span className="text-[12px] font-normal text-text-3">/ pack</span></p><p className="text-[12px] text-text-2">= gross × (1 − GtN) · not forecast · open the view</p></button>
                  </div>)}
                {mod === 'gp' && gpTab === 'sku' && scenario && <p className="mb-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-2.5 text-[12.5px] text-text-2">The SKU build is set once for the active forecast. For a price change in {scenario.name} only, add a price event in Events or an override on the weighted gross price in this scenario (Trend &amp; override).</p>}
                {mod === 'gp' && gpTab === 'sku' && <GrossPriceModule gp={gp} applied={!!edits.price} onApply={applyGp} onReset={resetGp} readOnly={!priceEditable} working={work.layer} scenario={scenario ? scopeCalc.layer : undefined} scenarioName={scenario?.name}
                  events={events} scenarios={scenarios} onEvents={() => go('Events')} onDirty={onDirty} actions={actions} />}
                {mod === 'netp' && <NetSalesPriceView gross={grossFy} trend={modTrend('netp')} scenarioName={scenario?.name} />}
                {mod && mod !== 'gp' && mod !== 'netp' && <ModuleView id={mod} net={fySum(scopeCalc.rev, year)} ue={ue} setUe={setUe} woh={woh} setWoh={setWoh} editable onEdit={() => go('Assumptions')} trend={modTrend(mod)} />}
                {trendOn && scenario && shownSel !== 'rev' && <ScenarioDriverView key={`${scenario.id}-${shownSel}`} id={shownSel} scenario={scenario} setScenarios={setScenarios} work={work.layer} layer={scopeCalc.layer} events={events} model={model} notify={notify} compare={cmp} color={scColor(scenario, scenarios.indexOf(scenario))} />}
                {trendOn && !(scenario && shownSel !== 'rev') && <DriverWorkspace mode="assumptions" sel={shownSel} edits={edits} setEdits={setEdits}
                  scenarioLayer={scenario ? scopeCalc.layer : sc.layer} scenarioName={scenario ? scenario.name : scName} workingLayer={work.layer} model={model} metric={metric} setMetric={setMetric}
                  onOpenAssumptions={() => go('Assumptions')} onGo={() => go('Events')} onDirty={onDirty} actions={actions} notify={notify} compare={cmp} />}
              </main>
            </div>
            <FullModelGrid layer={scopeCalc.layer} reference={scenario ? work.layer : UNBIASED} year={year} title={scenario ? scenario.name : 'Active forecast'} editable={editableIds} locked={scenario?.locked}
              ue={ue} woh={woh} selected={gridSel} onRow={openRow} onCell={onCell} />
            <RevenueMath layer={scopeCalc.layer} reference={work.layer} year={year} name={scenario ? scenario.name : 'Active forecast'} />
            <ScenarioChanges scenarios={scenarios} calc={calc} events={events} model={model} scope={scenario ? scenario.id : FORECAST} year={year}
              onPick={(sid, did) => { if (!leaveOk()) return; setScopeState(sid); if (sid !== FORECAST) setSelId(sid); if (did) selDriver(did) }} />
          </div>
        )}
        {view === 'LRF' && <div data-tour="lrf"><LrfTab scenarios={scenarios} calc={calc} selId={selId} setSelId={setSelId} lrf={lrf} setLrf={setLrf} notify={notify} onEvents={m => { setLrfStart({ metric: m, n: Date.now() }); go('Events') }} /></div>}
        {view === 'Events' && <div className="space-y-10">
          <EventsStage events={events} setEvents={setEvents} scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} metric={metric} setMetric={setMetric} modified={modified} notify={notify} onNext={() => go('Summary')} />
          <section aria-labelledby="lre-title" className="space-y-3">
            <div><h2 id="lre-title" className="font-display text-[20px] font-semibold">Long-range events</h2>
              <p className="mt-0.5 text-[13.5px] text-text-2">Dated in Years 2–10 (FY2028–FY2036) for {(scenarios.find(s => s.id === selId) ?? scenarios[0]!).name}. They sit with the other events and feed the LRF plan.</p></div>
            <LrfEventsPanel scenarios={scenarios} calc={calc} selId={selId} lrf={lrf} setLrf={setLrf} notify={notify} start={lrfStart} />
          </section>
        </div>}
        {view === 'Summary' && <div className="space-y-8">
          <ScenarioSummary uePct={ueFy(ue)} woh={woh} scenarios={scenarios} setScenarios={setScenarios} calc={calc} events={events} selId={selId} setSelId={setSelId} model={model} notify={notify} renderPart={part => <ScenariosStage events={events} scenarios={scenarios} setScenarios={setScenarios} selId={selId} setSelId={setSelId} calc={calc} workFy={work.fy} model={model} metric={metric} setMetric={setMetric} toggleFinal={toggleFinal} notify={notify} part={part} />} />
          <LrfSummary scenarios={scenarios} calc={calc} selId={selId} setSelId={setSelId} lrf={lrf} />
        </div>}
        {view === 'Sensitivity' && <SensitivityStage scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} notify={notify} />}
        {view === 'Goal seek' && <GoalSeekStage scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} notify={notify} onNext={() => go('Review')} />}
        {view === 'Review' && <ReviewStage scenarios={scenarios} selId={selId} setSelId={setSelId} calc={calc} events={events} edits={edits} workFy={work.fy} toggleFinal={toggleFinal}
          onEdit={(id: DriverId) => { selDriver(id); go('Assumptions') }} onStage={s => go(s === 'events' ? 'Events' : 'Summary')} presenting={presenting} setPresenting={setPresenting} model={model} />}
      </div>}
      {!presenting && (
        <div data-tour="bottombar" className="sticky bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-6 py-3">
            <span className={cx('text-[13px]', driverDirty ? 'font-medium text-warn' : 'text-text-3')} aria-live="polite">
              {driverDirty ? 'You have unapplied changes to this assumption.' : `Step ${STEPS.indexOf(view) + 1} of ${STEPS.length} · ${LABEL[view]}`}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              <span className={cx('text-[12px] font-medium', dirty || driverDirty ? 'text-warn' : 'text-text-3')} aria-live="polite">{driverDirty ? 'Unapplied changes' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <Btn variant={NEXT[view] ? 'secondary' : 'primary'} disabled={!dirty} onClick={save} icon={<Save size={14} />}>Save draft</Btn>
              {driverDirty && <Btn variant="secondary" onClick={() => actions.current?.discard()}>Discard</Btn>}
              {driverDirty && <Btn onClick={() => actions.current?.apply()} icon={<Check size={15} />}>Apply</Btn>}
              {NEXT[view] && <Btn variant={driverDirty ? 'secondary' : 'primary'} onClick={() => go(NEXT[view]!)} icon={<ArrowRight size={15} />}>Next: {LABEL[NEXT[view]!].toLowerCase()}</Btn>}
            </div>
          </div>
        </div>
      )}
    </div>
    </AgentFocusCtx.Provider>
    </InsightsCtx.Provider>
  )
}


import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentType } from 'react'
import { scrollFrameTop } from '../../frame'
import { ArrowLeft, ArrowRight, Check, ChevronDown, PanelRightOpen, Save } from 'lucide-react'
import { DEFAULT_MODEL, FY, SEED_EVENTS, SEED_SCENARIOS, fyAvg, fySum, revenue, scenarioLayer, workingLayer } from './engine'
import type { DriverId, EventDef, ModelCfg, OutputId, Scenario } from './engine'
import { Btn, Tag, cx, field } from './ui'
import { DriverWorkspace, ForecastMap } from './Drivers'
import type { DriverActions, Edits, Notify, Sel } from './Drivers'
import { ScenarioBar, ScenarioDriverView, FORECAST } from './WorkspaceScenarios'
import { BaselineTrend } from './BaselineTrend'
import { EventsStage, GoalSeekStage, ReviewStage, ScenariosStage } from './Stages'
import { SensitivityStage } from './Analysis'
import { ScenarioSummary } from './Summary'
import type { Calc } from './Stages'
import { ActualKpis } from './Actuals'
import { LrfView } from './Lrf'
import { PerformanceView } from './Performance'
import { BridgesView } from './Bridges'
import { ModuleView, ueDefault, ueFy } from './Modules'
import type { ModId } from './Modules'
import { InsightsCtx } from './insightsCtx'
import type { SaveReq } from './insightsCtx'
import type { Insight } from './insights'
import { AgentBanner, AgentButton } from '../../chat/Agent'
import { AgentFocusCtx, useForecastAgent } from './agent'
import type { AgentView, CopilotProps } from './agent'
import { RotateCcw } from 'lucide-react'

type View = AgentView | 'LRF'
// Scenarios are created inside the Forecast workspace (ScenarioBar), so there is no separate step for them.
const STEPS: View[] = ['Overview', 'Assumptions', 'LRF', 'Events', 'Summary', 'Sensitivity', 'Goal seek', 'Review']
// Tab names shown to forecasters; internal ids stay stable for the assistant.
// CR-004: analytics layer below the workflow tabs. Tab content is defined in follow-up change requests.
const ANALYTICS = ['Performance Dashboard', 'Financial Bridges', 'Patient Funnel', 'Sales Drivers', 'Judgement Layer', 'Long Range Plan', 'Competition', 'Needs-to-Meet', 'GTN Analysis']
// Only these views are built; the rest show as coming soon and can't be opened.
const AN_BUILT = ['Performance Dashboard', 'Financial Bridges']
// Tab structure per the forecaster team's reference: eight tabs; Actuals under Baseline trend, Analytics under Forecast workspace.
// 'Scenario' stays in GROUPS (for the assistant's own `view` lookups) but is left out of the rendered tab bar below.
const GROUPS: { id: string; items: string[] }[] = [
  { id: 'Baseline trend', items: ['Overview'] }, { id: 'Forecast workspace', items: ['Assumptions'] },
  { id: 'LRF', items: ['LRF'] }, { id: 'Events', items: ['Events'] }, { id: 'Scenario summary', items: ['Summary'] },
  { id: 'Sensitivity', items: ['Sensitivity'] }, { id: 'Goal seek', items: ['Goal seek'] }, { id: 'Review', items: ['Review'] },
  { id: 'Scenario', items: ['Scenarios'] },
]
const LABEL: Record<View, string> = { Overview: 'Baseline trend', Assumptions: 'Forecast workspace', LRF: 'LRF', Events: 'Events', Scenarios: 'Scenario', Sensitivity: 'Sensitivity', 'Goal seek': 'Goal seek', Summary: 'Scenario summary', Review: 'Review' }
const NEXT: Partial<Record<View, View>> = Object.fromEntries(STEPS.slice(0, -1).map((v, i) => [v, STEPS[i + 1]!]))

export default function ForecastWorkspace({ notify, onHome, brand = 'Nurtec', brandId = 'nurtec', cycle = 'AOP 2027', stream = 'US net revenue', model = DEFAULT_MODEL, insights, setInsights, onAsk, Copilot, assistant = 'Charles', onPublished }: { notify: Notify; onHome?: () => void; brand?: string; brandId?: string; cycle?: string; stream?: string; model?: ModelCfg; insights: Insight[]; setInsights: (f: (x: Insight[]) => Insight[]) => void; onAsk?: (brandId?: string) => void; Copilot?: ComponentType<CopilotProps>; assistant?: string
  /** Called when a scenario is finalised: files it as the brand's submitted version for Forecast AI. */
  onPublished?: (brandId: string, scenario: string) => void }) {
  const [view, setView] = useState<View>('Overview')
  const [an, setAn] = useState<string | null>(null)
  const [ue, setUe] = useState(ueDefault)
  // A default module picked in the forecast map replaces the driver view; picking a driver clears it.
  const [mod, setMod] = useState<ModId | null>(null)
  const [mapOpen, setMapOpen] = useState(true)
  const selDriver = (s: Sel) => { setMod(null); setSel(s) }
  const [sel, setSel] = useState<Sel>(model.modules.find(m => m.editable)?.id ?? model.modules[0]!.id)
  const [edits, setEdits] = useState<Edits>({})
  const [events, setEvents] = useState<EventDef[]>(SEED_EVENTS)
  const [scenarios, setScenarios] = useState<Scenario[]>(SEED_SCENARIOS)
  const [selId, setSelId] = useState('sc2')
  const [metric, setMetric] = useState<OutputId>(model.outputs[0]!)
  // Scope of the Forecast workspace: the active forecast every scenario starts from, or one scenario's own changes.
  const [scope, setScope] = useState(FORECAST)
  const [wsYear, setWsYear] = useState(FY)
  const [presenting, setPresenting] = useState(false)
  const [driverDirty, setDriverDirty] = useState(false)
  const actions = useRef<DriverActions | null>(null)
  const snapshot = useMemo(() => JSON.stringify({ edits, events, scenarios }), [edits, events, scenarios])
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

  const work = calc.__working!
  const sc = calc[selId] ?? calc[scenarios[0]!.id]!
  const scName = (scenarios.find(s => s.id === selId) ?? scenarios[0]!).name
  const finalised = scenarios.some(s => s.locked)
  const modified = Object.keys(edits).length
  const leaveOk = () => !driverDirty || window.confirm('You have unapplied changes to this assumption. Discard them?')
  const go = (v: View) => { if ((v === view && !an) || !leaveOk()) return; setAn(null); setView(v); scrollFrameTop() }
  const openAn = (a: string) => { if (an !== a && leaveOk()) { setAn(a); scrollFrameTop() } }
  const group = an ? 'Analytics' : GROUPS.find(g => g.items.includes(view))!.id
  const subs = GROUPS.find(g => g.id === group)?.items ?? []
  const [anMenu, setAnMenu] = useState(false)
  // Top-bar slot for brand and status; looked up after commit because the top bar unmounts in full view.
  const [wsSlot, setWsSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { const el = document.getElementById('topbar-ws'); if (el !== wsSlot) setWsSlot(el) })
  const anRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!anMenu) return
    const off = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !anRef.current?.contains(e.target as Node)) setAnMenu(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off) }
  }, [anMenu])
  const pick = (s: Sel) => { if ((s !== sel || mod) && leaveOk()) selDriver(s) }
  const onDirty = useCallback((v: boolean) => setDriverDirty(v), [])
  const mapView = view === 'Assumptions'
  const save = () => { setSaved(snapshot); notify({ tone: 'ok', text: 'Draft saved. Assumptions, events and scenarios are kept.' }) }
  const saveInsight = useCallback((r: SaveReq) => {
    setInsights(xs => [{ id: `u${Date.now()}`, brandId, brand, cycle, kind: r.scenario ? 'Scenario' : 'View', title: r.title, note: `Saved from the ${view} view.`, snap: r.snap, scenario: r.scenario, by: 'me', at: 'Just now', tagged: [], thread: [] }, ...xs])
    notify({ tone: 'ok', text: `Saved to ${brand} Insights. Open it from the Knowledge bank to comment and tag people.` })
  }, [setInsights, brandId, brand, cycle, view, notify])
  const home = () => { if ((dirty || driverDirty) && !window.confirm('You have unsaved changes. Leave without saving?')) return; onHome?.() }
  const show = (v: AgentView) => { setView(v); scrollFrameTop() }
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

  return (
    <InsightsCtx.Provider value={{ save: saveInsight }}>
    <AgentFocusCtx.Provider value={{ ...agent.focus, name: assistant }}>
    {Copilot && <Copilot {...agent.copilot(() => show('Review'))} />}
    {wsSlot && createPortal(
      <>
        <span aria-hidden className="text-border-strong">/</span>
        {onHome && <button type="button" onClick={home} aria-label="Back to your forecasts" title="Back to your forecasts" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><ArrowLeft size={15} /></button>}
        <span className="truncate text-[13.5px] font-semibold text-text">{brand} forecast</span>
        <span className="hidden truncate text-[12px] text-text-3 md:inline">{cycle} · {stream}</span>
        <Tag tone={finalised ? 'ok' : modified ? 'brand' : 'neutral'}>{finalised ? 'Finalised' : modified ? `Modified · ${modified} assumption${modified === 1 ? '' : 's'}` : 'Draft'}</Tag>
      </>,
      wsSlot
    )}
    <div className="min-h-full bg-bg">
      {!presenting && (
        <div className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          {/* Two levels: a few global tabs, and one sub-tab row for the active group. */}
          <nav data-tour="tabs" aria-label="Forecast sections" className="mx-auto px-10">
            <div role="tablist" className="flex flex-wrap items-center gap-0.5 py-2">
              {GROUPS.filter(g => g.id !== 'Scenario').map(g => (
                <button key={g.id} type="button" role="tab" aria-selected={g.id === group} onClick={() => g.id !== group && go(g.items[0] as View)}
                  className={cx('inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition-colors', g.id === group ? 'bg-[#f1f1f3] text-text shadow-[inset_0_0_0_1px_rgba(16,24,40,0.04)]' : 'text-text-2 hover:bg-black/[0.04] hover:text-text')}>
                  {g.id}</button>
              ))}
              {/* Analytics views live in one dropdown so they don't crowd the workflow tabs. */}
              <div ref={anRef} className="relative">
                <button data-tour="analytics" type="button" role="tab" aria-selected={group === 'Analytics'} aria-haspopup="menu" aria-expanded={anMenu} onClick={() => setAnMenu(v => !v)}
                  className={cx('inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition-colors', group === 'Analytics' ? 'bg-[#f1f1f3] text-text shadow-[inset_0_0_0_1px_rgba(16,24,40,0.04)]' : 'text-text-2 hover:bg-black/[0.04] hover:text-text')}>
                  {an ? `Analytics · ${an}` : 'Analytics'}<ChevronDown size={14} className={cx('transition-transform', anMenu && 'rotate-180')} /></button>
                {anMenu && <>
                  <div role="menu" className="rise absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
                    <p className="px-3 pb-1 pt-1.5 text-[12px] text-text-3">Analytics views · read-only</p>
                    {ANALYTICS.map(a => !AN_BUILT.includes(a)
                      ? <span key={a} role="menuitem" aria-disabled="true" title="Coming soon" className="flex w-full cursor-not-allowed items-center justify-between px-3 py-1.5 text-[13px] text-text-3">{a}<span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-3">Coming soon</span></span>
                      : <button key={a} type="button" role="menuitem" onClick={() => { setAnMenu(false); openAn(a) }}
                      className={cx('flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-surface-2', an === a ? 'font-medium text-text' : 'text-text-2')}>{a}{an === a && <Check size={14} className="text-brand" />}</button>)}
                  </div>
                </>}
              </div>
            </div>
          </nav>
          {subs.length > 1 && (
            <div>
              <div data-tour="subtabs" role="tablist" aria-label={`${group} views`} className="mx-auto flex gap-1 overflow-x-auto px-10 py-2">
                {subs.map((v, k) => {
                  const isAn = ANALYTICS.includes(v), on = isAn ? an === v : !an && view === v
                  const badge = v === 'Assumptions' ? modified : v === 'Summary' ? scenarios.length : v === 'Events' ? events.length : 0
                  return (
                    <Fragment key={v}>
                    {isAn && k === 1 && <span className="mx-1 shrink-0 self-center text-[10.5px] font-semibold uppercase tracking-wider text-text-3">Analytics</span>}
                    <button type="button" role="tab" aria-selected={on} onClick={() => isAn ? openAn(v) : go(v as View)}
                      className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors', on ? 'bg-surface text-brand shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-border' : 'text-text-2 hover:bg-surface hover:text-text')}>
                      {v === 'Overview' ? 'Dashboard' : v === 'Assumptions' ? 'Workspace' : isAn ? v : LABEL[v as View]}{badge > 0 && <span className={cx('rounded-full px-1.5 text-[11px] font-semibold', on ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-text-2')}>{badge}</span>}
                    </button>
                    </Fragment>
                  )
                })}
              </div>
            </div>
          )}
          {st && (
            <div className="mx-auto px-10 pb-3 pt-3">
              <AgentBanner assistant={assistant} running={st.running} step={st.step} progress={st.progress} title={st.title} onStop={agent.stop} onDismiss={() => agent.setStatus(null)}
                actions={<>{view !== 'Review' && st.after !== undefined && <AgentButton onClick={() => go('Review')}>Review the forecast</AgentButton>}{agent.undo && <AgentButton variant="outline" icon={<RotateCcw size={13} />} onClick={agent.undo}>Undo</AgentButton>}</>}>
                {st.body}
              </AgentBanner>
            </div>
          )}
        </div>
      )}

      {an === 'Financial Bridges' ? (
        <div className="mx-auto px-10 py-8"><BridgesView scenarios={scenarios} calc={calc} events={events} selId={selId} /></div>
      ) : an === 'Performance Dashboard' ? (
        <div className="mx-auto px-10 py-8"><PerformanceView brand={brand} scenarios={scenarios} calc={calc} selId={selId} uePct={ueFy(ue)} /></div>
      ) : an ? (
        <div className="mx-auto px-10 py-8">
          <div className="grid place-items-center rounded-lg border border-dashed border-border-strong bg-surface-2/50 px-6 py-16 text-center">
            <div><p className="text-[15px] font-semibold">{an}</p><p className="mt-1 text-[13px] text-text-3">Tab content is defined in a follow-up change request.</p>
              <Btn variant="secondary" className="mt-4" onClick={() => go(view)}>Back to {LABEL[view].toLowerCase()}</Btn></div>
          </div>
        </div>
      ) : <>
      <div className={cx('mx-auto px-10', view === 'Overview' ? 'pb-8 pt-6' : 'py-8', mapView && !presenting && 'grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]')}>
        {mapView && <aside className="lg:sticky lg:top-[98px] lg:self-start"><ForecastMap sel={sel} onSel={pick} edits={edits} working={work.layer} model={model} metric={metric} mod={mod} onMod={m => { if (m !== mod && leaveOk()) setMod(m) }} uePct={ueFy(ue)} onCollapse={undefined} /></aside>}
        <main className="min-w-0">
          {view === 'Overview' && <BaselineTrend onWorkspace={() => go('Assumptions')} />}
          {view === 'Assumptions' && <div className="mb-6"><ScenarioBar scenarios={scenarios} setScenarios={setScenarios} scope={scope} setScope={setScope} year={wsYear} setYear={setWsYear} calc={calc} notify={notify} /></div>}
          {mapView && mod && <ModuleView id={mod} net={work.fy} gp={fyAvg(work.layer.price)} ue={ue} setUe={setUe} editable={view === 'Assumptions'} onEdit={() => go('Assumptions')} />}
          {mapView && !mod && (view === 'Assumptions' && scope !== FORECAST && sel !== 'rev'
            ? <ScenarioDriverView id={sel} scenario={scenarios.find(s => s.id === scope)!} setScenarios={setScenarios} work={work.layer} layer={calc[scope]!.layer} events={events} model={model} notify={notify} />
            : <DriverWorkspace mode="assumptions" sel={sel} edits={edits} setEdits={setEdits}
                scenarioLayer={sc.layer} scenarioName={scName} workingLayer={work.layer} model={model} metric={metric} setMetric={setMetric}
                onOpenAssumptions={() => go('Assumptions')} onGo={() => go('Assumptions')} onDirty={onDirty} actions={actions} notify={notify} />)}
          {view === 'Scenarios' && <ScenariosStage events={events} scenarios={scenarios} setScenarios={setScenarios} selId={selId} setSelId={setSelId} calc={calc} workFy={work.fy} model={model} metric={metric} setMetric={setMetric} toggleFinal={toggleFinal} notify={notify} />}
          {view === 'LRF' && <LrfView scenarios={scenarios} calc={calc} selId={selId} setSelId={setSelId} onEvent={() => go('Events')} />}
          {view === 'Events' && <EventsStage events={events} setEvents={setEvents} scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} metric={metric} setMetric={setMetric} modified={modified} notify={notify} onNext={() => go('Sensitivity')} />}
          {view === 'Sensitivity' && <SensitivityStage scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} notify={notify} />}
          {view === 'Goal seek' && <GoalSeekStage scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} notify={notify} onNext={() => go('Summary')} />}
          {view === 'Summary' && <ScenarioSummary uePct={ueFy(ue)} scenarios={scenarios} setScenarios={setScenarios} calc={calc} events={events} selId={selId} setSelId={setSelId} model={model} notify={notify} renderPart={part => <ScenariosStage events={events} scenarios={scenarios} setScenarios={setScenarios} selId={selId} setSelId={setSelId} calc={calc} workFy={work.fy} model={model} metric={metric} setMetric={setMetric} toggleFinal={toggleFinal} notify={notify} part={part} />} />}
          {view === 'Review' && <ReviewStage scenarios={scenarios} selId={selId} setSelId={setSelId} calc={calc} events={events} edits={edits} workFy={work.fy} toggleFinal={toggleFinal}
            onEdit={(id: DriverId) => { selDriver(id); go('Assumptions') }} onStage={s => go(s === 'events' ? 'Events' : 'Assumptions')} presenting={presenting} setPresenting={setPresenting} model={model} />}
        </main>
      </div>
      </>}
      {!presenting && (
        <div data-tour="bottombar" className="sticky bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex flex-wrap items-center gap-3 px-10 py-3">
            <span className={cx('text-[13px]', driverDirty ? 'font-medium text-warn' : 'text-text-3')} aria-live="polite">
              {driverDirty ? 'You have unapplied changes to this assumption.' : !an && STEPS.includes(view) ? `Step ${STEPS.indexOf(view) + 1} of ${STEPS.length} · ${LABEL[view]}` : (an ?? LABEL[view])}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              <span className={cx('text-[12px] font-medium', dirty || driverDirty ? 'text-warn' : 'text-text-3')} aria-live="polite">{driverDirty ? 'Unapplied changes' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <Btn variant={!an && NEXT[view] ? 'secondary' : 'primary'} disabled={!dirty} onClick={save} icon={<Save size={14} />}>Save draft</Btn>
              {driverDirty && <Btn variant="secondary" onClick={() => actions.current?.discard()}>Discard</Btn>}
              {driverDirty && <Btn onClick={() => actions.current?.apply()} icon={<Check size={15} />}>Apply</Btn>}
              {!an && NEXT[view] && <Btn variant={driverDirty ? 'secondary' : 'primary'} onClick={() => go(NEXT[view]!)} icon={<ArrowRight size={15} />}>Next: {LABEL[NEXT[view]!].toLowerCase()}</Btn>}
            </div>
          </div>
        </div>
      )}
    </div>
    </AgentFocusCtx.Provider>
    </InsightsCtx.Provider>
  )
}

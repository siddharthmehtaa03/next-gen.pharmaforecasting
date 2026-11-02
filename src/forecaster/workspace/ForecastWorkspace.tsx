import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentType } from 'react'
import { scrollFrameTop } from '../../frame'
import { ArrowLeft, ArrowRight, Check, PanelRightOpen, Save } from 'lucide-react'
import { DEFAULT_MODEL, SEED_EVENTS, SEED_SCENARIOS, fySum, revenue, scenarioLayer, workingLayer } from './engine'
import type { DriverId, EventDef, ModelCfg, OutputId, Scenario } from './engine'
import { Btn, Tag, cx, field } from './ui'
import { DriverWorkspace, ForecastMap } from './Drivers'
import type { DriverActions, Edits, Notify, Sel } from './Drivers'
import { EventsStage, GoalSeekStage, ReviewStage, ScenariosStage } from './Stages'
import { SensitivityStage } from './Analysis'
import { ScenarioSummary } from './Summary'
import type { Calc } from './Stages'
import { ActualKpis, ActualsView } from './Actuals'
import { Tour } from './Tour'
import type { TourStep } from './Tour'
import { TOUR_FLAG } from './WhatsNew'
import { ModuleView, ueDefault, ueFy } from './Modules'
import type { ModId } from './Modules'
import { InsightsCtx } from './insightsCtx'
import type { SaveReq } from './insightsCtx'
import type { Insight } from './insights'
import { AgentBanner, AgentButton } from '../../chat/Agent'
import { AgentFocusCtx, useForecastAgent } from './agent'
import type { AgentView, CopilotProps } from './agent'
import { RotateCcw } from 'lucide-react'

type View = AgentView | 'Actuals'
const STEPS: View[] = ['Overview', 'Assumptions', 'Events', 'Scenarios', 'Sensitivity', 'Goal seek', 'Summary', 'Review']
// Tab names shown to forecasters; internal ids stay stable for the assistant.
// CR-004: analytics layer below the workflow tabs. Tab content is defined in follow-up change requests.
const ANALYTICS = ['Patient Funnel', 'Performance Dashboard', 'Sales Drivers', 'Judgement Layer', 'Long Range Plan', 'Competition', 'Financial Bridges', 'Needs-to-Meet', 'GTN Analysis']
// Tab structure per the forecaster team's reference: eight tabs; Actuals under Baseline dashboard, Analytics under Forecast workspace.
const GROUPS: { id: string; items: string[] }[] = [
  { id: 'Baseline dashboard', items: ['Overview', 'Actuals'] }, { id: 'Forecast workspace', items: ['Assumptions', ...ANALYTICS] },
  { id: 'Events', items: ['Events'] }, { id: 'Scenario', items: ['Scenarios'] }, { id: 'Sensitivity', items: ['Sensitivity'] },
  { id: 'Goal seek', items: ['Goal seek'] }, { id: 'Summary', items: ['Summary'] }, { id: 'Review', items: ['Review'] },
]
// Guided tour of the workflow changes: each step opens its tab and spotlights the changed component.
const TOUR: (TourStep & { view: View })[] = [
  { view: 'Overview', target: 'tabs', title: 'Eight tabs, in working order', body: 'Baseline dashboard → Forecast workspace → Events → Scenario → Sensitivity → Goal seek → Summary → Review. Sub-tabs appear only where a tab has more inside.' },
  { view: 'Overview', target: '#topbar-ws', title: 'Brand and status moved to the top bar', body: 'The back arrow, brand, cycle and Draft / Modified / Finalised status now sit next to the breadcrumb, freeing the page for your work.' },
  { view: 'Overview', target: 'kpis', title: 'Actual KPIs on the baseline', body: 'Year-to-date net revenue and TRx against last year, latest treated patients and the run rate. The Actuals sub-tab has the month-by-month history.' },
  { view: 'Overview', target: 'chart', title: 'Quarterly view and richer hover', body: 'Switch Monthly · Quarterly · Annual. Hover any point to see the value, %G YoY and % of budget for that period.' },
  { view: 'Overview', target: 'trend', title: 'Can you depend on the trend?', body: 'One verdict per metric (Reliable, Watch or Don’t rely), from a backtest of recent months. Show evidence opens the month-by-month misses.' },
  { view: 'Overview', target: 'bridge', title: 'Five default modules in the forecast map', body: 'Every model carries the revenue bridge: weighted gross price, total underlying demand, Δ inventory, unexplained difference and exchange rates. Click one to open it.' },
  { view: 'Assumptions', target: 'subtabs', title: 'Forecast workspace and Analytics', body: 'Edit drivers and modules here; yellow cells are yours to change. The nine Analytics views sit beside Workspace in this row.' },
  { view: 'Events', target: 'add-event', title: 'Category, then event type', body: 'New events take a category and a matching event type. MFN Policy Implementation under Pricing adds a sub-stratification.' },
  { view: 'Summary', target: 'summary', title: 'One comparison table', body: 'Summary is now just the scenario comparison, with the revenue bridge rows (TUD, Δ inventory, unexplained, gross) for every scenario.' },
  { view: 'Summary', target: 'bottombar', title: 'Save draft lives at the bottom', body: 'The saved state, Save draft and Next stay in this bar on every tab. That’s the tour; reopen it any time from What’s new on Your forecasts.' },
]
const LABEL: Record<View, string> = { Overview: 'Baseline dashboard', Actuals: 'Actuals', Assumptions: 'Forecast workspace', Events: 'Events', Scenarios: 'Scenario', Sensitivity: 'Sensitivity', 'Goal seek': 'Goal seek', Summary: 'Summary', Review: 'Review' }
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
  const [tour, setTour] = useState<number | null>(() => { try { return sessionStorage.getItem(TOUR_FLAG) ? 0 : null } catch { return null } })
  const tourTo = (k: number) => { const t = TOUR[k]!; setAn(null); setMod(null); setMapOpen(true); setView(t.view); setTour(k) }
  // Clear the start flag after mount (not in the initializer, which StrictMode runs twice).
  useEffect(() => { try { sessionStorage.removeItem(TOUR_FLAG) } catch { /* ignore */ } if (tour === 0) tourTo(0) }, [])
  const selDriver = (s: Sel) => { setMod(null); setSel(s) }
  const [sel, setSel] = useState<Sel>(model.modules.find(m => m.editable)?.id ?? model.modules[0]!.id)
  const [edits, setEdits] = useState<Edits>({})
  const [events, setEvents] = useState<EventDef[]>(SEED_EVENTS)
  const [scenarios, setScenarios] = useState<Scenario[]>(SEED_SCENARIOS)
  const [selId, setSelId] = useState('sc2')
  const [metric, setMetric] = useState<OutputId>(model.outputs[0]!)
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
  const group = an ? 'Forecast workspace' : GROUPS.find(g => g.items.includes(view))!.id
  const subs = GROUPS.find(g => g.id === group)!.items
  const pick = (s: Sel) => { if ((s !== sel || mod) && leaveOk()) selDriver(s) }
  const onDirty = useCallback((v: boolean) => setDriverDirty(v), [])
  const mapView = view === 'Overview' || view === 'Assumptions'
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
    {tour !== null && <Tour steps={TOUR} step={tour} onStep={tourTo} onClose={() => setTour(null)} />}
    {typeof document !== 'undefined' && document.getElementById('topbar-ws') && createPortal(
      <>
        {onHome && <button type="button" onClick={home} aria-label="Back to your forecasts" title="Back to your forecasts" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><ArrowLeft size={15} /></button>}
        <span className="truncate text-[13.5px] font-semibold text-text">{brand} forecast</span>
        <span className="hidden truncate text-[12px] text-text-3 md:inline">{cycle} · {stream}</span>
        <Tag tone={finalised ? 'ok' : modified ? 'brand' : 'neutral'}>{finalised ? 'Finalised' : modified ? `Modified · ${modified} assumption${modified === 1 ? '' : 's'}` : 'Draft'}</Tag>
      </>,
      document.getElementById('topbar-ws')!
    )}
    <div className="min-h-full bg-bg">
      {!presenting && (
        <div className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          {/* Two levels: a few global tabs, and one sub-tab row for the active group. */}
          <nav data-tour="tabs" aria-label="Forecast sections" className="mx-auto max-w-[1240px] overflow-x-auto px-6">
            <div role="tablist" className="flex min-w-max items-end gap-1">
              {GROUPS.map(g => (
                <button key={g.id} type="button" role="tab" aria-selected={g.id === group} onClick={() => g.id !== group && go(g.items[0] as View)}
                  className={cx('-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors', g.id === group ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text')}>{g.id}</button>
              ))}
            </div>
          </nav>
          {subs.length > 1 && (
            <div className="border-t border-border bg-background">
              <div data-tour="subtabs" role="tablist" aria-label={`${group} views`} className="mx-auto flex max-w-[1240px] flex-wrap gap-1 px-6 py-2">
                {subs.map((v, k) => {
                  const isAn = ANALYTICS.includes(v), on = isAn ? an === v : !an && view === v
                  const badge = v === 'Assumptions' ? modified : v === 'Scenarios' || v === 'Summary' ? scenarios.length : v === 'Events' ? events.length : 0
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
            <div className="mx-auto max-w-[1240px] px-6 pb-3 pt-3">
              <AgentBanner assistant={assistant} running={st.running} step={st.step} progress={st.progress} title={st.title} onStop={agent.stop} onDismiss={() => agent.setStatus(null)}
                actions={<>{view !== 'Review' && st.after !== undefined && <AgentButton onClick={() => go('Review')}>Review the forecast</AgentButton>}{agent.undo && <AgentButton variant="outline" icon={<RotateCcw size={13} />} onClick={agent.undo}>Undo</AgentButton>}</>}>
                {st.body}
              </AgentBanner>
            </div>
          )}
        </div>
      )}

      {an ? (
        <div className="mx-auto max-w-[1240px] px-6 py-8">
          <div className="grid place-items-center rounded-lg border border-dashed border-border-strong bg-surface-2/50 px-6 py-16 text-center">
            <div><p className="text-[15px] font-semibold">{an}</p><p className="mt-1 text-[13px] text-text-3">Tab content is defined in a follow-up change request.</p>
              <Btn variant="secondary" className="mt-4" onClick={() => go(view)}>Back to {LABEL[view].toLowerCase()}</Btn></div>
          </div>
        </div>
      ) : <>
      <div className={cx('mx-auto max-w-[1240px] px-6', view === 'Overview' ? 'pb-8 pt-6' : 'py-8', mapView && !presenting && cx('grid gap-6', mapOpen ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : 'lg:grid-cols-[minmax(0,1fr)_44px]'))}>
        {mapView && <aside className="lg:sticky lg:top-[98px] lg:order-last lg:self-start">{mapOpen
          ? <ForecastMap sel={sel} onSel={pick} edits={edits} working={work.layer} model={model} metric={metric} mod={mod} onMod={m => { if (m !== mod && leaveOk()) setMod(m) }} uePct={ueFy(ue)} onCollapse={() => setMapOpen(false)} />
          : <button type="button" onClick={() => setMapOpen(true)} aria-label="Expand forecast map" title="Expand forecast map"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface shadow-card py-3 text-text-2 hover:border-brand/60 hover:text-brand lg:h-[calc(100dvh-220px)] lg:flex-col lg:justify-start">
              <PanelRightOpen size={16} className="shrink-0" /><span className="text-[12px] font-semibold uppercase tracking-wider lg:[writing-mode:vertical-rl]">Forecast map</span></button>}</aside>}
        <main className="min-w-0">
          {mapView && mod && <ModuleView id={mod} net={work.fy} ue={ue} setUe={setUe} editable={view === 'Assumptions'} onEdit={() => go('Assumptions')} />}
          {mapView && !mod && <DriverWorkspace mode={view === 'Overview' ? 'overview' : 'assumptions'} sel={sel} edits={edits} setEdits={setEdits}
            scenarioLayer={sc.layer} scenarioName={scName} workingLayer={work.layer} model={model} metric={metric} setMetric={setMetric}
            onOpenAssumptions={() => go('Assumptions')} onGo={() => go('Scenarios')} onDirty={onDirty} actions={actions} notify={notify} />}
          {view === 'Scenarios' && <ScenariosStage events={events} scenarios={scenarios} setScenarios={setScenarios} selId={selId} setSelId={setSelId} calc={calc} workFy={work.fy} model={model} metric={metric} setMetric={setMetric} toggleFinal={toggleFinal} notify={notify} />}
          {view === 'Events' && <EventsStage events={events} setEvents={setEvents} scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} metric={metric} setMetric={setMetric} modified={modified} notify={notify} onNext={() => go('Sensitivity')} />}
          {view === 'Sensitivity' && <SensitivityStage scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} notify={notify} />}
          {view === 'Goal seek' && <GoalSeekStage scenarios={scenarios} setScenarios={setScenarios} calc={calc} selId={selId} setSelId={setSelId} model={model} notify={notify} onNext={() => go('Summary')} />}
          {view === 'Summary' && <ScenarioSummary uePct={ueFy(ue)} scenarios={scenarios} setScenarios={setScenarios} calc={calc} events={events} selId={selId} setSelId={setSelId} model={model} notify={notify} renderPart={part => <ScenariosStage events={events} scenarios={scenarios} setScenarios={setScenarios} selId={selId} setSelId={setSelId} calc={calc} workFy={work.fy} model={model} metric={metric} setMetric={setMetric} toggleFinal={toggleFinal} notify={notify} part={part} />} />}
          {view === 'Actuals' && <ActualsView />}
          {view === 'Review' && <ReviewStage scenarios={scenarios} selId={selId} setSelId={setSelId} calc={calc} events={events} edits={edits} workFy={work.fy} toggleFinal={toggleFinal}
            onEdit={(id: DriverId) => { selDriver(id); go('Assumptions') }} onStage={s => go(s === 'events' ? 'Events' : 'Scenarios')} presenting={presenting} setPresenting={setPresenting} model={model} />}
        </main>
      </div>
      </>}
      {!presenting && (
        <div data-tour="bottombar" className="sticky bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-6 py-3">
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

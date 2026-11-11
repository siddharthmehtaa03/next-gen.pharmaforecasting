import { useEffect, useRef, useState } from 'react'
import { Copy, EllipsisVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { ACTUALS, DRV, FC_YEARS, UNBIASED, fmtDelta, fmtRev, fmtV, fyAvg, fySum } from './engine'
import type { DriverId, EventDef, Layer, ModelCfg, Scenario } from './engine'
import { Btn, Card, ForecastChart, Legend, cx, field } from './ui'
import type { ChartSeries } from './ui'
import { NumField } from './Drivers'
import type { CompareProps, Notify } from './Drivers'
import { ScenarioOverrides } from './Analysis'
import type { Calc } from './Stages'

type SetScenarios = (f: (s: Scenario[]) => Scenario[]) => void
/** Scope of the workspace: the active forecast every scenario starts from, or one scenario's own changes. */
export const FORECAST = '__forecast'

/** Scenario bar of the forecast page: pick what you are working on, create a scenario that replicates the forecast assumptions, and set the year the funnel shows. */
export function ScenarioBar({ scenarios, setScenarios, scope, setScope, year, setYear, calc, notify }: {
  scenarios: Scenario[]; setScenarios: SetScenarios; scope: string; setScope: (s: string) => void; year: number; setYear: (y: number) => void; calc: Calc; notify: Notify
}) {
  const [form, setForm] = useState<{ mode: 'new' | 'rename'; name: string; from: string } | null>(null)
  const sc = scenarios.find(s => s.id === scope) ?? null
  const lock = !!sc?.locked
  const create = () => {
    if (!form || !form.name.trim()) return
    const src = form.from === FORECAST ? null : scenarios.find(s => s.id === form.from) ?? null
    const stamp = Date.now()
    const n: Scenario = { id: `sc${stamp}`, name: form.name.trim(), active: src ? [...src.active] : [], adj: src ? { ...src.adj } : {}, locked: false, ovr: src?.ovr ? src.ovr.map((o, k) => ({ ...o, id: `ov${stamp}${k}` })) : [] }
    setScenarios(ss => [...ss, n]); setScope(n.id); setForm(null)
    notify({ tone: 'ok', text: src ? `${n.name} created as a copy of ${src.name}. Change anything in it; ${src.name} is untouched.` : `${n.name} created. It replicates the active forecast assumptions: nothing is changed in it yet.` })
  }
  const rename = () => { if (!form || !sc || !form.name.trim()) return; setScenarios(ss => ss.map(s => s.id === sc.id ? { ...s, name: form.name.trim() } : s)); setForm(null) }
  const dup = () => {
    if (!sc) return
    const stamp = Date.now(), n: Scenario = { ...sc, id: `sc${stamp}`, name: `${sc.name} (copy)`, active: [...sc.active], adj: { ...sc.adj }, locked: false, ovr: (sc.ovr ?? []).map((o, k) => ({ ...o, id: `ov${stamp}${k}` })) }
    setScenarios(ss => [...ss, n]); setScope(n.id); notify({ tone: 'info', text: `${sc.name} duplicated with the same events, adjustments and overrides.` })
  }
  const del = () => {
    if (!sc || scenarios.length < 2 || !window.confirm(`Delete “${sc.name}”? Its events, adjustments and overrides go with it.`)) return
    setScenarios(ss => ss.filter(s => s.id !== sc.id)); setScope(FORECAST); notify({ tone: 'info', text: `${sc.name} deleted.` })
  }
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const off = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off) }
  }, [menu])
  const item = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div data-tour="scenario-bar" className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface px-5 py-3 shadow-card">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Working on</span>
          <select aria-label="Working on" value={scope} onChange={e => { setScope(e.target.value); setForm(null) }} className={cx(field, 'h-10 w-56 font-semibold text-text')}>
            <option value={FORECAST}>Active forecast</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}{s.locked ? ' · Final' : ''}</option>)}
          </select>
          <div ref={menuRef} className="relative">
            <button type="button" title="Scenario actions" aria-label="Scenario actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(v => !v)}
              className="grid h-9 w-9 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text"><EllipsisVertical size={16} /></button>
            {menu && (
              <div role="menu" className="rise absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
                <button type="button" role="menuitem" className={item} disabled={!sc} onClick={() => { setMenu(false); dup() }}><Copy size={14} />Duplicate</button>
                <button type="button" role="menuitem" className={item} disabled={!sc || lock} onClick={() => { setMenu(false); sc && setForm({ mode: 'rename', name: sc.name, from: FORECAST }) }}><Pencil size={14} />Rename</button>
                <button type="button" role="menuitem" className={cx(item, 'text-err hover:!bg-err-soft')} disabled={!sc || lock || scenarios.length < 2} onClick={() => { setMenu(false); del() }}><Trash2 size={14} />Delete</button>
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Btn size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setForm({ mode: 'new', name: `Scenario ${scenarios.length + 1}`, from: FORECAST })}>New scenario</Btn>
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-3">Values for
            <select aria-label="Values for" value={year} onChange={e => setYear(+e.target.value)} className={cx(field, 'h-9 w-24 normal-case tracking-normal text-text')}>
              {FC_YEARS.map(y => <option key={y} value={y}>FY{y}</option>)}
            </select></label>
        </div>
      </div>
      {form && (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-brand/30 bg-brand-soft/30 px-4 py-3" onSubmit={e => { e.preventDefault(); form.mode === 'new' ? create() : rename() }}>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">{form.mode === 'new' ? 'New scenario name' : 'Scenario name'}</span>
            <input autoFocus aria-label="Scenario name" value={form.name} onFocus={e => e.target.select()} onChange={e => setForm({ ...form, name: e.target.value })} className={cx(field, 'w-60')} /></label>
          {form.mode === 'new' && <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Start from</span>
            <select aria-label="Start from" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} className={cx(field, 'w-64')}>
              <option value={FORECAST}>Active forecast assumptions (replicate)</option>
              {scenarios.map(s => <option key={s.id} value={s.id}>Copy of {s.name}</option>)}
            </select></label>}
          <Btn onClick={form.mode === 'new' ? create : rename} disabled={!form.name.trim()}>{form.mode === 'new' ? 'Create scenario' : 'Save name'}</Btn>
          <Btn variant="ghost" onClick={() => setForm(null)}>Cancel</Btn>
        </form>
      )}

    </div>
  )
}

/** One assumption inside one scenario: the chart against the active forecast, a quick adjustment and the scenario's own overrides. */
export function ScenarioDriverView({ id, scenario, setScenarios, work, layer, events, model, notify, compare, color }: {
  id: DriverId; scenario: Scenario; setScenarios: SetScenarios; work: Layer; layer: Layer; events: EventDef[]; model: ModelCfg; notify: Notify; compare?: CompareProps; color?: string
}) {
  const d = DRV[id], lock = scenario.locked
  const v = scenario.adj[id] ?? 0
  // The scenario being worked on is the thick line; the active forecast and every other scenario stay visible as thin dotted lines.
  const series: ChartSeries = { actual: ACTUALS[id], unbiased: UNBIASED[id], working: compare?.hideForecast ? undefined : work[id], scenario: layer[id], scenarioName: scenario.name, scenarioColor: color, extra: compare?.extra, focus: 'scenario' }
  const setAdj = (x: number) => setScenarios(ss => ss.map(s => { if (s.id !== scenario.id) return s; const adj = { ...s.adj }; if (Number.isFinite(x) && x) adj[id] = x; else delete adj[id]; return { ...s, adj } }))
  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h2 className="text-[26px] font-semibold tracking-tight">{d.label}</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-text-2">{d.desc}</p>
      </div>
      <Card title={`${d.label} · ${scenario.name}`} sub={d.unit === '%' ? 'Percent' : d.unit} right={<Legend s={series} />}>
        {compare?.header && <div className="mb-3 space-y-3">{compare.header}</div>}
        <ForecastChart title={`${d.label} · ${scenario.name}`} s={series} fmt={x => fmtV(id, x)} dp={d.dp} unit={d.unit} height={300} range={compare?.range} />
      </Card>
      <Card title="Scenario adjustment" sub={`Shift ${d.label.toLowerCase()} across the whole forecast for ${scenario.name} only. For a path by date, add an override below.`}
        right={v !== 0 && !lock ? <Btn variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={() => setAdj(0)}>Reset</Btn> : undefined}>
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-40"><NumField label={`Adjustment (${d.pct ? 'pts' : '%'})`} value={v} step={d.pct ? 0.1 : 0.5} onChange={x => !lock && setAdj(x)} /></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Active forecast · FY avg</p><p className="font-mono text-[17px]">{fmtV(id, fyAvg(work[id]))}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{scenario.name} · FY avg</p><p className="font-mono text-[17px] font-semibold text-brand">{fmtV(id, fyAvg(layer[id]))}</p></div>
        </div>
        {lock && <p className="mt-3 text-[12px] text-text-3">{scenario.name} is final. Reopen it to change adjustments.</p>}
      </Card>
      <ScenarioOverrides sel={scenario} setScenarios={setScenarios} work={work} events={events} model={model} notify={notify} driver={id} />
    </div>
  )
}

/** Every scenario's assumptions next to the active forecast: see what each one changed, and jump in to update it. */
export function ScenarioChanges({ scenarios, calc, events, model, scope, year, onPick }: {
  scenarios: Scenario[]; calc: Calc; events: EventDef[]; model: ModelCfg; scope: string; year: number; onPick: (scenario: string, driver: DriverId | null) => void
}) {
  const work = calc.__working!
  const ids = model.modules.map(m => m.id)
  const sign = (n: number, t: string) => `${n >= 0 ? '+' : '−'}${t}`
  const head = (k: string, on: boolean) => cx('px-3 py-2.5 text-right font-semibold', on && 'bg-brand-soft/60 text-brand', k)
  return (
    <Card title="Scenario changes" sub={`What each scenario changes against the active forecast, FY${year}. Select a value to view and update it above.`} pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead><tr className="border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-text-3">
            <th className="px-4 py-2.5 text-left font-semibold">Assumption</th>
            <th className={head('', scope === '__forecast')}><button type="button" onClick={() => onPick(FORECAST, null)} className="uppercase tracking-wide">Active forecast</button></th>
            {scenarios.map(s => <th key={s.id} className={head('', scope === s.id)}><button type="button" onClick={() => onPick(s.id, null)} className="uppercase tracking-wide">{s.name}</button></th>)}
          </tr></thead>
          <tbody>
            {ids.map(id => {
              const d = DRV[id], base = fyAvg(work.layer[id], year)
              return (
                <tr key={id} className="border-b border-border">
                  <td className="px-4 py-2.5 font-medium">{d.label}</td>
                  <td className={cx('px-3 py-2.5 text-right font-mono', scope === FORECAST && 'bg-brand-soft/30')}>{fmtV(id, base)}</td>
                  {scenarios.map(s => {
                    const v = fyAvg(calc[s.id]!.layer[id], year), dv = v - base, own = !!s.adj[id] || (s.ovr ?? []).some(o => o.driver === id), same = Math.abs(dv) < 0.005
                    return (
                      <td key={s.id} className={cx('px-3 py-1.5 text-right', scope === s.id && 'bg-brand-soft/30')}>
                        <button type="button" onClick={() => onPick(s.id, id)} title={`Open ${d.label} in ${s.name}`} className="w-full rounded px-1.5 py-1 text-right hover:bg-surface-2">
                          <span className="font-mono">{fmtV(id, v)}</span>{own && <span title="Changed in this scenario" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />}
                          <span className={cx('block font-mono text-[10.5px]', same ? 'text-text-3' : dv > 0 ? 'text-ok' : 'text-err')}>{same ? 'same as forecast' : sign(dv, d.pct ? `${Math.abs(dv).toFixed(1)} pts` : `$${Math.abs(dv).toFixed(2)}`)}</span>
                        </button>
                      </td>)
                  })}
                </tr>)
            })}
            <tr className="border-b border-border">
              <td className="px-4 py-2.5 font-medium">Events on</td>
              <td className={cx('px-3 py-2.5 text-right text-text-3', scope === FORECAST && 'bg-brand-soft/30')}>none</td>
              {scenarios.map(s => <td key={s.id} className={cx('px-3 py-2.5 text-right', scope === s.id && 'bg-brand-soft/30')} title={events.filter(e => s.active.includes(e.id)).map(e => e.name).join(' · ')}>
                <span className="font-mono">{s.active.length}</span><span className="block truncate text-[10.5px] text-text-3">{events.filter(e => s.active.includes(e.id)).map(e => e.name).join(' · ') || '—'}</span></td>)}
            </tr>
            <tr className="bg-surface-2">
              <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">FY{year} net revenue</td>
              <td className={cx('px-3 py-2.5 text-right font-mono font-medium', scope === FORECAST && 'text-brand')}>{fmtRev(fySum(work.rev, year))}</td>
              {scenarios.map(s => { const dv = fySum(calc[s.id]!.rev, year) - fySum(work.rev, year); return <td key={s.id} className={cx('px-3 py-2.5 text-right font-mono font-medium', scope === s.id && 'text-brand')}>{fmtRev(fySum(calc[s.id]!.rev, year))}<span className={cx('block text-[10.5px] font-normal', Math.abs(dv) < 0.05 ? 'text-text-3' : dv > 0 ? 'text-ok' : 'text-err')}>{Math.abs(dv) < 0.05 ? 'same' : fmtDelta(dv)}</span></td> })}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

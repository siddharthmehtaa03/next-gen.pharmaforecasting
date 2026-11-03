import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Copy, CalendarClock, GitCompare, Lock, LockOpen, Pencil, Plus, Presentation, RotateCcw, Save, Trash2, X } from 'lucide-react'
import {
  ACT, ACTUAL_LAYER, CURVE_LABEL, DRIVERS, DRV, EVENT_CURVE_LABEL, EVENT_SUBTYPES, EVENT_TYPES, MFN_SUB, FY, METHOD_LABEL, N, OUTPUTS, REPEAT_LABEL, UNBIASED,
  adjusted, applyEvents, describeOverride, fmtDelta, fmtRev, fmtV, fySum, fyAvg, mLong, revenue,
} from './engine'
import type { DriverId, Edit, EventCurve, EventDef, EventType, Impact, Layer, ModelCfg, OutputId, Scenario } from './engine'
import { Btn, COLOR, Card, ForecastChart, Label, Legend, Seg, Tag, Toggle, cx, field } from './ui'
import type { ChartSeries } from './ui'
import { NumField, OutputSelect, Period } from './Drivers'
import type { Edits, Notify } from './Drivers'
import { AgentFrame } from '../../chat/Agent'
import { useAgentFocus } from './agent'
import { ChartActions } from '../../chart/ChartActions'
import { FunnelCompare, GoalSeekPanel, ScenarioOverrides } from './Analysis'
import { ScenarioBuilder } from './Summary'

export type Calc = Record<string, { layer: Layer; rev: number[]; fy: number; events: EventDef[] }>
export const UNB_REV = revenue(UNBIASED)
export const ACT_REV = UNB_REV
const UNB_FY = fySum(UNB_REV)
const typeTone = (t: EventType): 'brand' | 'ok' | 'warn' | 'neutral' => t === 'Market Event' ? 'brand' : t === 'Product Event' ? 'ok' : t === 'Pricing Event' ? 'warn' : 'neutral'

/* ───────── Events ───────── */
const blankEvent = (): EventDef => ({ id: '', name: '', type: 'Market Event', date: ACT + 5, prob: 50, impacts: [], notes: '' })

export function EventsStage({ events, setEvents, scenarios, setScenarios, calc, selId, setSelId, model, metric, setMetric, modified, notify, onNext }: {
  events: EventDef[]; setEvents: (f: (e: EventDef[]) => EventDef[]) => void; scenarios: Scenario[]; setScenarios: (f: (s: Scenario[]) => Scenario[]) => void; calc: Calc; selId: string; setSelId: (id: string) => void
  model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void; modified: number; notify: Notify; onNext: () => void
}) {
  const [form, setForm] = useState<EventDef | null>(null)
  const [filterMode, setFilterMode] = useState<'scenario' | 'all'>('all')
  const agent = useAgentFocus()
  const sel = scenarios.find(s => s.id === selId) ?? scenarios[0]!
  const c = calc[sel.id]!, work = calc.__working!, o = OUTPUTS[metric]
  const series: ChartSeries = { actual: o.fn(UNBIASED), unbiased: o.fn(UNBIASED), working: o.fn(work.layer), scenario: o.fn(c.layer), scenarioName: `${sel.name} · with events` }
  const evDelta = o.fn(c.layer).slice((FY - 2025) * 12, (FY - 2025) * 12 + 12).reduce((a, b) => a + b, 0) - o.fn(work.layer).slice((FY - 2025) * 12, (FY - 2025) * 12 + 12).reduce((a, b) => a + b, 0)
  const save = (e: EventDef, scIds: string[]) => {
    const isNew = !e.id
    const evId = isNew ? `ev${Date.now()}` : e.id
    const saved = { ...e, id: evId }
    setEvents(xs => isNew ? [...xs, saved] : xs.map(x => x.id === e.id ? saved : x))
    // The picked scenarios carry the event; final scenarios are locked and left as they are.
    setScenarios(ss => ss.map(s => s.locked ? s : scIds.includes(s.id) ? (s.active.includes(evId) ? s : { ...s, active: [...s.active, evId] }) : { ...s, active: s.active.filter(x => x !== evId) }))
    setForm(null)
    const n = scIds.length
    notify({ tone: 'ok', text: `“${e.name}” ${isNew ? 'created' : 'updated'}${n ? ` and applied to ${n === 1 ? scenarios.find(s => s.id === scIds[0])?.name ?? '1 scenario' : `${n} scenarios`}` : ' and kept in the library, off in every scenario'}.` })
  }
  const dup = (e: EventDef) => { setEvents(xs => [...xs, { ...e, id: `ev${Date.now()}`, name: `${e.name} (copy)` }]); notify({ tone: 'info', text: 'Event duplicated. The copy is off in every scenario.' }) }
  const del = (e: EventDef) => { setEvents(xs => xs.filter(x => x.id !== e.id)); notify({ tone: 'info', text: `“${e.name}” deleted from the library and removed from all scenarios.` }) }
  const displayed = filterMode === 'scenario' ? events.filter(e => sel.active.includes(e.id)) : events
  const flip = (sid: string, eid: string, on: boolean) => {
    if (scenarios.find(s => s.id === sid)?.locked) return notify({ tone: 'info', text: 'This scenario is final and locked. Reopen it to change events.' })
    setScenarios(ss => ss.map(s => s.id === sid ? { ...s, active: on ? [...s.active, eid] : s.active.filter(x => x !== eid) } : s))
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Tag tone="brand">Events</Tag><h2 className="mt-2 text-[22px] font-semibold tracking-tight">Scenario events</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-text-2">Create an event once, then add it to as many scenarios as you like. The chart shows <b className="text-text">{sel.name}</b>; each event lists the scenarios it is in.</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">Chart scenario
            <select value={sel.id} onChange={e => setSelId(e.target.value)} aria-label="Selected scenario for events" className={cx(field, 'w-44 font-medium text-text')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <span data-tour="add-event" className="inline-flex"><Btn onClick={() => setForm(blankEvent())} icon={<Plus size={15} />} disabled={!!form && !form.id}>Add event</Btn></span>
        </div>
      </div>

      <Card title="Event impact" sub={`${sel.name}: forecast with events applied`}
        right={<OutputSelect model={model} metric={metric} onChange={setMetric} />}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><Legend s={{ ...series, lo: undefined }} />
          <span className="text-[13px] text-text-2">{c.events.length} event{c.events.length === 1 ? '' : 's'} applied · FY{FY} impact <b className={cx('font-mono', evDelta >= 0 ? 'text-ok' : 'text-err')}>{o.delta(evDelta)}</b></span></div>
        <ForecastChart title="Events impact" s={series} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={280} />
      </Card>

      <div>
        <AgentFrame on={agent.section === 'events'} label={`${agent.name} is updating events`}>
        <Card pad={false} title={`Events for ${sel.name}`} right={<Seg label="Filter" value={filterMode} onChange={setFilterMode} options={[{ id: 'scenario', label: `Included in ${sel.name} (${c.events.length})` }, { id: 'all', label: `All library events (${events.length})` }]} />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead><tr className="border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-text-3"><th className="px-4 py-2.5 font-semibold">Event</th><th className="px-3 py-2.5 font-semibold">Timing</th><th className="px-3 py-2.5 font-semibold">Impacted metrics</th><th className="px-3 py-2.5 text-right font-semibold">Probability</th><th className="px-3 py-2.5 font-semibold">In scenarios</th><th className="px-3 py-2.5" /></tr></thead>
              <tbody>
                {displayed.map(e => {
                  const isApplied = sel.active.includes(e.id)
                  return (
                    <tr key={e.id} className={cx('border-b border-border last:border-0', form?.id === e.id && 'bg-brand-soft/40', agent.field === e.id && 'agent-row')}>
                      <td className="px-4 py-3"><p className="font-medium">{e.name}</p><span className="mt-1 inline-block"><Tag tone={typeTone(e.type)}>{e.type}</Tag>{e.sub && <span className="ml-1.5 text-[12px] text-text-2">{e.sub}{e.mfn && ` · ${e.mfn}`}</span>}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-text-2">{mLong(e.date)}</td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{e.impacts.map(i => <span key={i.metric} className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">{DRV[i.metric].label}<b className={cx('font-mono', i.dir === 'up' ? 'text-ok' : 'text-err')}>{i.dir === 'up' ? '+' : '−'}{i.mag}%</b></span>)}{e.impacts.length === 0 && <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[12px] font-semibold text-warn" title="Gross-to-net events land on net, downstream, and never touch gross price">GTN · moves net, not gross</span>}{e.impacts.some(i => i.metric === 'price') && <span className="rounded bg-ok-soft px-1.5 py-0.5 text-[12px] font-semibold text-ok" title="Only List / WAC events move gross price">List · moves gross</span>}{!!e.repeat && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-text-2">{REPEAT_LABEL[e.repeat].toLowerCase()}</span>}</div></td>
                      <td className="px-3 py-3 text-right font-mono">{e.prob}%</td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[260px] flex-wrap items-center gap-1">
                          {scenarios.filter(s => s.active.includes(e.id)).map(s => (
                            <span key={s.id} className={cx('inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 text-[12px] font-medium', s.id === sel.id ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong bg-surface text-text-2', s.locked ? 'pr-2 opacity-70' : 'pr-0.5')}>
                              {s.name}{s.locked ? <Lock size={10} aria-label="Final" /> : <button type="button" onClick={() => flip(s.id, e.id, false)} aria-label={`Remove ${e.name} from ${s.name}`} title={`Remove from ${s.name}`} className="grid h-4 w-4 place-items-center rounded-full hover:bg-surface-2"><X size={10} /></button>}
                            </span>))}
                          {!isApplied && !scenarios.some(s => s.active.includes(e.id)) && <span className="text-[12px] text-text-3">No scenario</span>}
                          {scenarios.some(s => !s.active.includes(e.id) && !s.locked) && (
                            <select aria-label={`Add a scenario to ${e.name}`} value="" onChange={x => { if (x.target.value) flip(x.target.value, e.id, true) }} className="h-6 rounded-full border border-dashed border-border-strong bg-surface px-2 text-[12px] font-medium text-brand outline-none hover:border-brand focus:border-brand">
                              <option value="">+ Add scenario</option>
                              {scenarios.filter(s => !s.active.includes(e.id) && !s.locked).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>)}
                        </div>
                      </td>
                      <td className="px-3 py-3"><div className="flex justify-end gap-0.5">
                        <Btn variant="ghost" title="Edit" onClick={() => setForm(structuredClone(e))} icon={<Pencil size={14} />} />
                        <Btn variant="ghost" title="Duplicate" onClick={() => dup(e)} icon={<Copy size={14} />} />
                        <Btn variant="danger" title="Delete from library" onClick={() => del(e)} icon={<Trash2 size={14} />} /></div></td>
                    </tr>
                  )
                })}
                {!displayed.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-text-3">{filterMode === 'scenario' ? `No events applied to ${sel.name}. Switch to all library events or click Add event.` : 'No events in the library yet.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        </AgentFrame>
        {form && <EventForm key={form.id || 'new'} initial={form} scenarios={scenarios} picked={form.id ? scenarios.filter(s => s.active.includes(form.id)).map(s => s.id) : [sel.id]} onSave={save} onCancel={() => setForm(null)} model={model} work={work.layer} metric={metric} />}
      </div>
      <p className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-3 text-[13px] text-text-2">Testing “share 2 points higher”? Use <b>Sensitivity</b>, not an event.</p>
    </div>
  )
}

function EventForm({ initial, scenarios, picked, onSave, onCancel, model, work, metric }: { initial: EventDef; scenarios: Scenario[]; picked: string[]; onSave: (e: EventDef, scenarioIds: string[]) => void; onCancel: () => void; model: ModelCfg; work: Layer; metric: OutputId }) {
  const [e, setE] = useState(initial)
  const [scIds, setScIds] = useState(picked)
  useEffect(() => { const k = (ev: KeyboardEvent) => ev.key === 'Escape' && onCancel(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onCancel])
  const set = (p: Partial<EventDef>) => setE(x => ({ ...x, ...p }))
  const has = (m: DriverId) => e.impacts.some(i => i.metric === m)
  const toggle = (m: DriverId) => set({ impacts: has(m) ? e.impacts.filter(i => i.metric !== m) : [...e.impacts, { metric: m, dir: 'down', mag: 2, curve: 'ramp', duration: null }] })
  const patchImpact = (m: DriverId, p: Partial<Impact>) => set({ impacts: e.impacts.map(i => i.metric === m ? { ...i, ...p } : i) })
  const none = e.impacts.length === 0
  const ok = e.name.trim() && !none && e.impacts.every(i => Number.isFinite(i.mag) && i.mag > 0)
  const o = OUTPUTS[metric]
  const pv = useMemo(() => (none ? null : { working: o.fn(work), scenario: o.fn(applyEvents(work, [e])), actual: o.fn(UNBIASED), scenarioName: 'With this event' } as ChartSeries), [e, work, o, none])
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-text/30 backdrop-blur-[1px]" onClick={onCancel} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={initial.id ? 'Edit event' : 'New event'} className="relative flex h-full w-full max-w-[560px] flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div><h3 className="text-[17px] font-semibold">{initial.id ? 'Edit event' : 'New event'}</h3></div>
          <Btn variant="ghost" onClick={onCancel} icon={<X size={16} />} title="Close" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="space-y-4">
        <label className="block"><Label className="mb-1">Event name</Label><input autoFocus value={e.name} onChange={x => set({ name: x.target.value })} placeholder="e.g. Competitor entry" className={field} /></label>
        <div><Label className="mb-1.5">Category</Label><Seg label="Event category" value={e.type} onChange={t => set({ type: t, sub: EVENT_SUBTYPES[t][0], mfn: undefined })} options={EVENT_TYPES.map(t => ({ id: t, label: t.replace(' Event', '') }))} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><Label className="mb-1" hint={`filtered to ${e.type.replace(' Event', '')}`}>Event type</Label>
            <select value={e.sub ?? EVENT_SUBTYPES[e.type][0]} onChange={x => set({ sub: x.target.value, mfn: x.target.value === 'MFN Policy Implementation' ? MFN_SUB[0] : undefined })} className={field}>{EVENT_SUBTYPES[e.type].map(o => <option key={o}>{o}</option>)}</select></label>
          {e.sub === 'MFN Policy Implementation' && <label className="block"><Label className="mb-1">MFN sub-stratification</Label>
            <select value={e.mfn ?? MFN_SUB[0]} onChange={x => set({ mfn: x.target.value })} className={field}>{MFN_SUB.map(o => <option key={o}>{o}</option>)}</select></label>}
        </div>
        <div className="grid grid-cols-2 gap-3"><Period label="Expected date" value={e.date} min={ACT} max={N - 1} onChange={v => set({ date: v })} />
          <label className="block"><Label className="mb-1">Probability · {e.prob}%</Label><input type="range" min={0} max={100} step={5} value={e.prob} onChange={x => set({ prob: +x.target.value })} className="mt-2.5 w-full accent-[#0000c9]" /></label></div>
        <label className="block max-w-xs"><Label className="mb-1" hint="a regular price action is one event">Repeats</Label>
          <select aria-label="Repeats" value={e.repeat ?? 0} onChange={x => set({ repeat: +x.target.value as 0 | 6 | 12 })} className={field}>{([0, 6, 12] as const).map(r => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}</select>
          {!!e.repeat && <span className="mt-1 block text-[11.5px] text-text-3">The same impact is applied again every {e.repeat} months after {mLong(e.date)}. Use it for the increment above what the trend already carries, for example a biannual increase.</span>}</label>
        <div><Label className="mb-1.5">Impacted metrics</Label>
          <div className="flex flex-wrap gap-1.5">{model.modules.map(m => DRV[m.id]).map(d => <button key={d.id} type="button" aria-pressed={has(d.id)} onClick={() => toggle(d.id)} className={cx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors', has(d.id) ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong text-text-2 hover:border-text')}>{has(d.id) && <Check size={12} />}{d.label}</button>)}</div></div>
        <fieldset disabled={none} className={cx('space-y-3 rounded-md border border-border p-3 transition-opacity', none && 'opacity-50')}>
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">Impact{none && ' · select a metric first'}</legend>
          {e.impacts.map(i => (
            <div key={i.metric} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
              <p className="text-[13px] font-semibold">{DRV[i.metric].label}</p>
              <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                <Seg label="Direction" value={i.dir} onChange={d => patchImpact(i.metric, { dir: d })} options={[{ id: 'up', label: 'Up' }, { id: 'down', label: 'Down' }]} />
                <NumField label="Magnitude" value={i.mag} suffix="%" onChange={v => patchImpact(i.metric, { mag: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><Label className="mb-1">Curve</Label><select value={i.curve} onChange={x => patchImpact(i.metric, { curve: x.target.value as EventCurve })} className={field}>{(Object.keys(EVENT_CURVE_LABEL) as EventCurve[]).map(c => <option key={c} value={c}>{EVENT_CURVE_LABEL[c]}</option>)}</select></label>
                <label className="block"><Label className="mb-1">Duration</Label><select value={i.duration ?? 0} onChange={x => patchImpact(i.metric, { duration: +x.target.value || null })} className={field}><option value={0}>Ongoing</option><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select></label>
              </div>
            </div>
          ))}
          <p className="text-[12px] text-text-3">Magnitude is a relative change to the metric, weighted by probability.</p>
        </fieldset>
        <div><Label className="mb-1.5" hint="add it to one or more">Apply to scenarios</Label>
          <div className="flex flex-wrap gap-1.5">{scenarios.map(s => { const on = scIds.includes(s.id); return (
            <button key={s.id} type="button" aria-pressed={on} disabled={s.locked} title={s.locked ? 'Final scenarios are locked' : undefined} onClick={() => setScIds(x => on ? x.filter(i => i !== s.id) : [...x, s.id])}
              className={cx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', on ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong text-text-2 hover:border-text')}>{on && <Check size={12} />}{s.name}</button>) })}</div>
          <p className="mt-1 text-[12px] text-text-3">{scIds.length ? `On in ${scIds.length} scenario${scIds.length === 1 ? '' : 's'}.` : 'Saved to the library and off in every scenario.'} You can add or remove scenarios from the event list later.</p></div>
        {pv && <div><Label className="mb-1.5">Impact preview · {o.label}</Label><div className="mb-1"><Legend s={pv} /></div><ForecastChart s={pv} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={170} /></div>}
        <label className="block"><Label className="mb-1" hint="optional">Notes</Label><textarea value={e.notes} onChange={x => set({ notes: x.target.value })} rows={2} placeholder="Source, rationale, assumptions" className="w-full resize-y rounded-md border border-border-strong bg-surface p-2.5 text-sm outline-none focus:border-brand" /></label>
      </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-surface px-6 py-3"><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn disabled={!ok} onClick={() => onSave({ ...e, name: e.name.trim() }, scIds)} icon={<Save size={15} />}>Save event</Btn></footer>
      </aside>
    </div>
  )
}

/* ───────── Compare table ───────── */
function CompareTable({ scenarios, calc, workFy, selId, onSelect }: { scenarios: Scenario[]; calc: Calc; workFy: number; selId?: string; onSelect?: (id: string) => void }) {
  const max = Math.max(...scenarios.map(s => calc[s.id]!.fy), UNB_FY, workFy)
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13px]">
      <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3"><th className="py-2 pr-3 font-semibold">Scenario</th><th className="px-3 py-2 font-semibold">FY{FY} net revenue</th><th className="px-3 py-2 text-right font-semibold">vs active</th><th className="px-3 py-2 text-right font-semibold">vs reference</th><th className="px-3 py-2 text-right font-semibold">Events on</th></tr></thead>
      <tbody>{scenarios.map((s, k) => {
        const fy = calc[s.id]!.fy
        return (
          <tr key={s.id} onClick={() => onSelect?.(s.id)} className={cx('border-b border-border last:border-0', onSelect && 'cursor-pointer hover:bg-surface-2', selId === s.id && 'bg-brand-soft/40')}>
            <td className="py-2.5 pr-3 font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COLOR.alt[k % COLOR.alt.length] }} />{s.name}</td>
            <td className="px-3 py-2.5"><div className="flex items-center gap-3"><span className="w-20 font-mono">{fmtRev(fy)}</span><span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 sm:block"><span className="block h-full rounded-full" style={{ width: `${(fy / max) * 100}%`, background: COLOR.alt[k % COLOR.alt.length] }} /></span></div></td>
            <td className={cx('px-3 py-2.5 text-right font-mono', fy - workFy >= 0 ? 'text-ok' : 'text-err')}>{fmtDelta(fy - workFy)}</td>
            <td className={cx('px-3 py-2.5 text-right font-mono', fy - UNB_FY >= 0 ? 'text-ok' : 'text-err')}>{fmtDelta(fy - UNB_FY)}</td>
            <td className="px-3 py-2.5 text-right font-mono">{s.active.length}</td>
          </tr>
        )
      })}</tbody>
    </table></div>
  )
}

/* ───────── Scenarios ───────── */
/** Scenario editing, in parts: `editor` (opened as a modal from the summary), `assumptions` and `outcome` (summary sub-tabs). */
export type ScenarioPart = 'editor' | 'assumptions' | 'outcome'
export function ScenariosStage({ events, scenarios, setScenarios, selId, setSelId, calc, workFy, model, metric, setMetric, toggleFinal, notify, part = 'editor' }: {
  events: EventDef[]; scenarios: Scenario[]; setScenarios: (f: (s: Scenario[]) => Scenario[]) => void; selId: string; setSelId: (id: string) => void; calc: Calc; workFy: number
  model: ModelCfg; metric: OutputId; setMetric: (m: OutputId) => void; toggleFinal: (id: string) => void; notify: Notify; onNext?: () => void; part?: ScenarioPart
}) {
  const [compare, setCompare] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const agent = useAgentFocus()
  const sel = scenarios.find(s => s.id === selId) ?? scenarios[0]!
  const c = calc[sel.id]!, o = OUTPUTS[metric], lock = sel.locked
  const work = calc.__working!
  const base = scenarios.find(s => s.name === 'Base Case') ?? scenarios[0]!
  const baseFy = calc[base.id]?.fy ?? workFy

  const postureOf = (s: Scenario) => {
    const scCalc = calc[s.id]
    const fy = scCalc?.fy ?? 0
    const d = fy - baseFy
    const adjCount = Object.values(s.adj).filter(Boolean).length
    const ovrCount = s.ovr?.length ?? 0
    const isBase = s.id === base.id
    let tone: 'ok' | 'err' | 'warn' | 'brand' | 'neutral' = 'neutral'
    let label = 'Custom Scenario'
    let rationale = ''

    if (s.name.toLowerCase().includes('base')) {
      tone = 'brand'
      label = 'Planning Baseline'
      rationale = 'Standard commercial plan with approved Part D formulary access and planned January WAC price increase. Normal execution.'
    } else if (s.name.toLowerCase().includes('pessimist') || d < -30) {
      tone = 'err'
      label = 'Pessimistic / Downside'
      rationale = 'Downside assumptions: Share reduced by −0.5 pts across the horizon. Zero positive market or pricing events active. Reflects commercial headwinds and access friction.'
    } else if (s.name.toLowerCase().includes('optimist') || d > 30) {
      tone = 'ok'
      label = 'Optimistic / Upside'
      rationale = 'Upside assumptions: Share increased by +0.5 pts with peak target at 14% by Dec 2028. All 3 positive events active (Part D formulary win, WAC increase, pediatric label expansion).'
    } else if (s.name.toLowerCase().includes('trend') || s.name.toLowerCase().includes('statist')) {
      tone = 'neutral'
      label = 'Statistical Trend'
      rationale = 'Direct statistical extrapolation from historical claims and prescription actuals. Carries no assumption adjustments or market events.'
    } else if (s.name.toLowerCase().includes('gca')) {
      tone = 'warn'
      label = 'Commercial Access Only'
      rationale = 'Assumes Part D commercial formulary win only, without pricing expansion or pediatric label changes.'
    } else if (s.name.toLowerCase().includes('finance')) {
      tone = 'warn'
      label = 'Conservative Finance'
      rationale = 'Reflects finance committee view: January WAC list price increase applied, but no commercial volume events.'
    } else {
      tone = d > 0 ? 'ok' : d < 0 ? 'err' : 'neutral'
      label = d > 0 ? 'Upside Variant' : d < 0 ? 'Downside Variant' : 'Alternative'
      rationale = `${s.active.length} active events, ${adjCount} assumption adjustments, ${ovrCount} manual overrides.`
    }

    return { tone, label, fy, d, isBase, rationale, adjCount, ovrCount }
  }
  const patchSel = (p: Partial<Scenario>) => setScenarios(ss => ss.map(s => s.id === sel.id ? { ...s, ...p } : s))
  const flip = (sid: string, eid: string, on: boolean) => {
    if (scenarios.find(s => s.id === sid)?.locked) return notify({ tone: 'info', text: 'This scenario is final and locked. Reopen it to change events.' })
    setScenarios(ss => ss.map(s => s.id === sid ? { ...s, active: on ? [...s.active, eid] : s.active.filter(x => x !== eid) } : s))
  }
  const fresh = (name: string, from?: Scenario): Scenario => ({ id: `sc${Date.now()}`, name, active: from ? [...from.active] : [], adj: from ? { ...from.adj } : {}, locked: false, ovr: from?.ovr ? from.ovr.map(o => ({ ...o })) : [] })
  const add = () => { const n = fresh(`Scenario ${scenarios.length + 1}`); setScenarios(ss => [...ss, n]); setSelId(n.id); setRenaming(n.id); notify({ tone: 'info', text: 'New scenario created from the current active forecast. Its assumptions are pulled from the model.' }) }
  const dup = () => { const n = fresh(`${sel.name} (copy)`, sel); setScenarios(ss => [...ss, n]); setSelId(n.id); notify({ tone: 'info', text: `${sel.name} duplicated with the same events, adjustments and overrides.` }) }
  const del = () => { const rest = scenarios.filter(s => s.id !== sel.id); setScenarios(() => rest); setSelId(rest[0]!.id); notify({ tone: 'info', text: `${sel.name} deleted.` }) }
  const setAdj = (id: DriverId, v: number) => patchSel({ adj: { ...sel.adj, [id]: Number.isFinite(v) ? v : 0 } })
  const resetAdj = (id: DriverId) => { const n = { ...sel.adj }; delete n[id]; patchSel({ adj: n }) }
  const series: ChartSeries = {
    actual: o.fn(UNBIASED), unbiased: o.fn(UNBIASED), working: o.fn(work.layer), scenario: o.fn(c.layer), scenarioName: sel.name,
    extra: compare ? scenarios.filter(s => s.id !== sel.id).map(s => ({ name: s.name, color: COLOR.alt[scenarios.indexOf(s) % COLOR.alt.length]!, series: o.fn(calc[s.id]!.layer) })) : undefined,
  }
  const editable = model.modules.filter(m => m.editable).map(m => DRV[m.id])
  const adjCount = Object.values(sel.adj).filter(Boolean).length + (sel.ovr?.length ?? 0)
  return (
    <div className="space-y-5">
      {part === 'editor' && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Tag tone="brand">Scenarios</Tag>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Scenario configuration</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OutputSelect model={model} metric={metric} onChange={setMetric} />
            <Btn onClick={() => setBuilding(true)} icon={<Plus size={15} />}>Build a scenario</Btn>
          </div>
        </div>
      )}

      {part === 'editor' && <AgentFrame on={agent.section === 'scenarios'} label={`${agent.name} is updating ${sel.name}`}>
      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-3">
          <p className="text-[13px] text-text-2">{scenarios.length} scenarios · compared against <span className="font-medium text-text">{base.name}</span></p>
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">Active scenario</span>
            <select
              aria-label="Active scenario"
              value={sel.id}
              onChange={e => setSelId(e.target.value)}
              className={cx(field, 'h-9 w-auto min-w-[300px] max-w-md font-semibold text-text')}
            >
              {scenarios.map(s => {
                const p = postureOf(s)
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} · {p.label} (FY27 {fmtRev(p.fy)}{!p.isBase ? ` · ${p.d >= 0 ? '+' : '−'}$${Math.abs(p.d).toFixed(0)}M` : ''}){s.locked ? ' · Final' : ''}
                  </option>
                )
              })}
            </select>
          </label>
        </div>

        {(() => {
          const p = postureOf(sel)
          return (
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold text-text">{sel.name}</h3>
                    <Tag tone={p.tone}>{p.label}</Tag>
                    {sel.locked && <Tag tone="ok"><Lock size={11} />Final · Locked</Tag>}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-2">{p.rationale}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Btn variant="ghost" size="sm" onClick={dup} icon={<Copy size={13} />}>Duplicate</Btn>
                  <Btn variant="ghost" size="sm" disabled={lock} onClick={() => setRenaming(sel.id)} icon={<Pencil size={13} />}>Rename</Btn>
                  <Btn variant="danger" size="sm" disabled={scenarios.length < 2 || lock} onClick={del} icon={<Trash2 size={13} />}>Delete</Btn>
                  <Btn variant="secondary" size="sm" disabled={lock} onClick={() => notify({ tone: 'ok', text: `${sel.name} saved with ${sel.active.length} events and ${adjCount} adjustments/overrides.` })} icon={<Save size={13} />}>Save</Btn>
                  <Btn variant={lock ? 'secondary' : 'primary'} size="sm" onClick={() => toggleFinal(sel.id)} icon={lock ? <LockOpen size={13} /> : <Lock size={13} />}>{lock ? 'Reopen' : 'Finalise'}</Btn>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">FY27 Net Revenue</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold text-brand-dark">{fmtRev(p.fy)}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Gap vs Base Case</p>
                  <p className={cx('mt-0.5 font-mono text-[17px] font-bold', p.isBase ? 'text-text-3' : p.d >= 0 ? 'text-ok' : 'text-err')}>
                    {p.isBase ? 'Baseline' : `${p.d >= 0 ? '+' : '−'}$${Math.abs(p.d).toFixed(1)}M (${(p.d / baseFy * 100).toFixed(1)}%)`}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Active Events</p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold text-text">{c.events.length} of {events.length} applied</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Overrides & Adjs</p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold text-text">{p.adjCount + p.ovrCount} custom entries</p>
                </div>
              </div>
            </div>
          )
        })()}

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2.5 bg-surface-2/30">
          <span className="text-xs font-semibold text-text-3">Event assignments for this scenario:</span>
          <Btn variant="ghost" size="sm" onClick={add} icon={<Plus size={14} />}>New blank scenario</Btn>
        </div>
        {lock
          ? <p className="flex items-center gap-2 border-b border-border bg-ok-soft px-4 py-2 text-[13px] text-ok"><Lock size={13} />{sel.name} is final. Assumptions and events are locked. Reopen to edit.</p>
          : <p className="border-b border-border bg-surface-2 px-4 py-2 text-[12px] text-text-3">Finalise is provisional. Approval rules are still to be confirmed.</p>}
        {renaming === sel.id && <form className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5" onSubmit={e => { e.preventDefault(); setRenaming(null) }}>
          <Label>Name</Label><input autoFocus aria-label="Scenario name" value={sel.name} onFocus={e => e.target.select()} onChange={e => patchSel({ name: e.target.value })} className={cx(field, 'max-w-xs')} />
          <Btn onClick={() => setRenaming(null)}>Done</Btn></form>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3">
              <th className="px-4 py-2.5 text-left font-semibold">Event · {events.length} in library</th>
              {scenarios.map(s => <th key={s.id} className={cx('px-3 py-2.5 text-center font-semibold', s.id === sel.id && 'bg-brand-soft/60 text-brand')}><button type="button" onClick={() => setSelId(s.id)} className="uppercase tracking-wide">{s.name}</button></th>)}
            </tr></thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} className={cx('border-b border-border', agent.field === e.id && 'agent-row')}>
                  <td className="px-4 py-2.5"><p className="font-medium">{e.name}</p><p className="text-[12px] text-text-3">{e.type} · {mLong(e.date)} · {e.prob}% · {e.impacts.map(i => DRV[i.metric].label).join(', ')}</p></td>
                  {scenarios.map(s => <td key={s.id} className={cx('px-3 py-2.5', s.id === sel.id && 'bg-brand-soft/40', s.locked && 'opacity-60')}><div className="flex justify-center"><Toggle on={s.active.includes(e.id)} onChange={v => flip(s.id, e.id, v)} label={`${e.name} in ${s.name}`} /></div></td>)}
                </tr>
              ))}
              {!events.length && <tr><td colSpan={scenarios.length + 1} className="px-4 py-8 text-center text-text-3">Add events in the library first.</td></tr>}
            </tbody>
            <tfoot><tr className="bg-surface-2"><td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">FY{FY} net revenue</td>{scenarios.map(s => <td key={s.id} className={cx('px-3 py-2.5 text-center font-mono font-medium', s.id === sel.id && 'text-brand')}>{fmtRev(calc[s.id]!.fy)}</td>)}</tr></tfoot>
          </table>
        </div>
      </Card>
      </AgentFrame>}

      {part !== 'outcome' && <Card title={`${sel.name} assumptions`} sub="Each starts at the active forecast. Other scenarios are unaffected.">
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[13px]">
          <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3"><th className="py-2 pr-3 font-semibold">Assumption</th><th className="px-3 py-2 font-semibold">Active forecast · FY{FY} avg</th><th className="px-3 py-2 font-semibold">Scenario adjustment</th><th className="px-3 py-2 font-semibold">Scenario value</th><th className="py-2 pl-3" /></tr></thead>
          <tbody>{editable.map(d => {
            const base = fyAvg(work.layer[d.id]), adjusted_ = fyAvg(adjusted(work.layer, { [d.id]: sel.adj[d.id] ?? 0 })[d.id]), v = sel.adj[d.id] ?? 0
            return (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-3 font-medium">{d.label}</td>
                <td className="px-3 py-2.5 font-mono text-text-2">{fmtV(d.id, base)}</td>
                <td className="px-3 py-2.5"><div className="relative w-32"><input type="number" step={d.pct ? 0.1 : 0.5} disabled={lock} aria-label={`${d.label} adjustment`} value={v} onChange={e => setAdj(d.id, e.target.value === '' ? 0 : +e.target.value)} className={cx(field, 'font-mono pr-10', v !== 0 && 'border-brand bg-brand-soft/50')} /><span className="pointer-events-none absolute right-2.5 top-2 text-[12px] text-text-3">{d.pct ? 'pts' : '%'}</span></div></td>
                <td className="px-3 py-2.5"><span className="font-mono">{fmtV(d.id, adjusted_)}</span> {v !== 0 ? <Tag tone="brand">Scenario override</Tag> : <Tag>Inherited</Tag>}</td>
                <td className="py-2.5 pl-3 text-right">{v !== 0 && !lock && <Btn variant="ghost" onClick={() => resetAdj(d.id)} icon={<RotateCcw size={13} />}>Reset</Btn>}</td>
              </tr>)
          })}</tbody>
        </table></div>
        {model.modules.some(m => !m.editable) && <p className="mt-3 text-[12px] text-text-3">System-fed modules ({model.modules.filter(m => !m.editable).map(m => DRV[m.id].label).join(', ')}) are not exposed for override.</p>}
      </Card>}

      {part !== 'outcome' && <ScenarioOverrides sel={sel} setScenarios={setScenarios} work={work.layer} events={events} model={model} notify={notify} />}

      {part === 'outcome' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card title={`${sel.name} outcome`} sub={`Monthly ${o.label.toLowerCase()}, ${o.unit}`} right={<div className="flex items-center gap-2"><OutputSelect model={model} metric={metric} onChange={setMetric} /><Btn variant={compare ? 'primary' : 'secondary'} onClick={() => setCompare(v => !v)} icon={<GitCompare size={14} />}>Compare</Btn></div>}>
          <div className="mb-2"><Legend s={series} /></div>
          <ForecastChart title={`${sel.name} outcome`} s={series} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={300} />
        </Card>
        <div className="space-y-4">
          <Card title="Active events" sub={`${c.events.length} in ${sel.name}`}>
            {c.events.length ? <ul className="space-y-2.5">{c.events.map(e => <li key={e.id} className="text-[13px]"><p className="font-medium">{e.name}</p><p className="text-[12px] text-text-2">{e.impacts.map(i => `${DRV[i.metric].label} ${i.dir === 'up' ? '+' : '−'}${i.mag}%`).join(' · ')}</p></li>)}</ul>
              : <p className="text-[13px] text-text-2">No events on. This scenario equals the active forecast{adjCount ? ' plus its assumption adjustments' : ''}.</p>}
          </Card>
        </div>
      </div>}

      {part === 'outcome' && compare && <Card title="Scenario comparison" sub="Select a row to edit that scenario.">
        <CompareTable scenarios={scenarios} calc={calc} workFy={workFy} selId={sel.id} onSelect={setSelId} />
      </Card>}

      {building && (
        <ScenarioBuilder
          scenarios={scenarios}
          calc={calc}
          events={events}
          model={model}
          year={FY}
          base={base}
          onAdd={s => {
            setScenarios(ss => [...ss, s])
            setSelId(s.id)
            setBuilding(false)
            notify({ tone: 'ok', text: `${s.name} created and added to scenarios.` })
          }}
          onClose={() => setBuilding(false)}
        />
      )}
    </div>
  )
}

/* ───────── Goal seek (its own tab) ───────── */
export function GoalSeekStage({ scenarios, setScenarios, calc, selId, setSelId, model, notify }: {
  scenarios: Scenario[]; setScenarios: (f: (s: Scenario[]) => Scenario[]) => void; calc: Calc; selId: string; setSelId: (id: string) => void; model: ModelCfg; notify: Notify; onNext: () => void
}) {
  const sel = scenarios.find(s => s.id === selId) ?? scenarios[0]!
  const [nonce, setNonce] = useState(0)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Tag tone="brand">Goal seek</Tag><h2 className="mt-2 text-[22px] font-semibold tracking-tight">Set the outcome, see what it takes</h2></div>
        <div className="flex items-center gap-2"><Label>Scenario</Label><select aria-label="Scenario" value={sel.id} onChange={e => setSelId(e.target.value)} className={cx(field, 'w-40')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <Btn variant="ghost" onClick={() => setNonce(n => n + 1)} icon={<RotateCcw size={15} />}>Reset</Btn></div>
      </div>
      <GoalSeekPanel key={`${sel.id}-${nonce}`} base={calc[sel.id]!.layer} sel={sel} setScenarios={setScenarios} model={model} notify={notify} />
    </div>
  )
}

/* ───────── Review ───────── */
export function describeEdit(id: DriverId, e: Edit) {
  const d = DRV[id], win = `${mLong(e.start)} to ${mLong(e.end)}`
  const tail = e.hold ? ', held flat after' : ''
  switch (e.method) {
    case 'hold': return `Hold last actual (${fmtV(id, ACT_VAL(id))}) · ${win}${tail}`
    case 'target': return `Target ${fmtV(id, e.target)} · ${CURVE_LABEL[e.curve]} · ${win}${tail}`
    case 'linear': return `Linear ${e.step >= 0 ? '+' : '−'}${Math.abs(e.step)} ${d.unit === '%' ? 'pts' : '$'} per month · ${win}${tail}`
    case 'growth': return `${e.growth}% growth per year · ${win}${tail}`
    default: return `${METHOD_LABEL.direct}${e.source !== 'manual' ? ` (from ${e.source === 'excel' ? 'file' : 'paste'})` : ''}`
  }
}
const ACT_VAL = (id: DriverId) => ACTUAL_LAYER[id][ACT - 1]!

export function ReviewStage({ scenarios, selId, setSelId, calc, events, edits, workFy, onEdit, onStage, presenting, setPresenting, toggleFinal, model }: {
  scenarios: Scenario[]; selId: string; setSelId: (id: string) => void; calc: Calc; events: EventDef[]; edits: Edits; workFy: number; model: ModelCfg
  onEdit: (id: DriverId) => void; onStage: (s: 'events' | 'scenarios') => void; presenting: boolean; setPresenting: (v: boolean) => void; toggleFinal: (id: string) => void
}) {
  const sel = scenarios.find(s => s.id === selId) ?? scenarios[0]!
  const c = calc[sel.id]!, work = calc.__working!
  const series: ChartSeries = { actual: ACT_REV, unbiased: UNB_REV, working: work.rev, scenario: c.rev, scenarioName: sel.name }
  const contrib = useMemo(() => c.events.map(e => ({ e, d: c.fy - fySum(revenue(applyEvents(work.layer, c.events.filter(x => x.id !== e.id)))) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)), [c, work])
  const modified = DRIVERS.filter(d => edits[d.id])
  const ovr = sel.ovr ?? []
  const steps = [
    { k: 'Reference baseline', v: UNB_FY, sub: 'Statistical trend. Reference only.', color: COLOR.unbiased },
    { k: 'Active forecast', v: workFy, sub: `${fmtDelta(workFy - UNB_FY)} · ${modified.length} driver${modified.length === 1 ? '' : 's'} modified`, color: COLOR.working },
    { k: ovr.length ? 'Events & overrides' : 'Events', v: c.fy - workFy, delta: true, sub: `${c.events.length} event${c.events.length === 1 ? '' : 's'}${ovr.length ? ` · ${ovr.length} override${ovr.length === 1 ? '' : 's'}` : ''} in ${sel.name}`, color: COLOR.alt[1]! },
    { k: `${sel.name} outcome`, v: c.fy, sub: `${fmtDelta(c.fy - UNB_FY)} vs reference`, color: COLOR.scenario },
  ]
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Tag tone="brand">Review &amp; finalise</Tag><h2 className="mt-2 text-[22px] font-semibold tracking-tight">Why the forecast differs from the baseline</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-text-2">FY{FY} net revenue, traced from the reference baseline to the selected scenario.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg label="Scenario" value={sel.id} onChange={setSelId} options={scenarios.map(s => ({ id: s.id, label: s.name }))} />
          {sel.locked ? <Tag tone="ok"><Lock size={11} />Final · locked</Tag> : <Tag tone="neutral">Draft</Tag>}
          <Btn variant={sel.locked ? 'secondary' : 'primary'} onClick={() => toggleFinal(sel.id)} icon={sel.locked ? <LockOpen size={15} /> : <Lock size={15} />}>{sel.locked ? 'Reopen' : 'Finalise version'}</Btn>
          <Btn variant={presenting ? 'primary' : 'secondary'} onClick={() => setPresenting(!presenting)} icon={<Presentation size={15} />}>{presenting ? 'Exit presentation' : 'Present outcome'}</Btn>
        </div>
      </div>

      <ol className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
        {steps.flatMap((s, k) => [
          <li key={s.k} className={cx('rounded-lg border bg-surface px-4 py-3.5', k === 3 ? 'border-brand/50 shadow-[var(--shadow-card)]' : 'border-border')}>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-3"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.k}</p>
            <p className={cx('mt-1 font-mono text-[22px] font-medium', s.delta && (s.v >= 0 ? 'text-ok' : 'text-err'))}>{s.delta ? fmtDelta(s.v) : fmtRev(s.v)}</p>
            <p className="mt-0.5 text-[12px] text-text-2">{s.sub}</p>
          </li>,
          k < 3 ? <li key={`a${k}`} aria-hidden className="hidden items-center text-text-3 md:flex"><ArrowRight size={16} /></li> : null,
        ])}
      </ol>

      <Card title="Net revenue path" sub="Monthly, $M" right={<Legend s={series} />}><ForecastChart title="Net revenue path" s={series} fmt={v => fmtRev(v, 1)} dp={0} unit="$M" height={320} /></Card>

      <Card title="Scenarios side by side" sub="Each scenario from funnel to net revenue." right={<ChartActions target="export-review-funnel" title="Scenarios side by side" subtitle={`FY${FY}`} />}>
        <FunnelCompare key={sel.id} scenarios={scenarios} calc={calc} selId={sel.id} onSelect={setSelId} model={model} exportId="export-review-funnel" />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Active events" sub={`${sel.name} · contribution to FY${FY}`} right={<Btn variant="ghost" onClick={() => onStage('scenarios')} icon={<CalendarClock size={14} />}>Edit in scenarios</Btn>}>
          {contrib.length ? <ul className="divide-y divide-border">{contrib.map(({ e, d }) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0"><p className="text-[13px] font-medium">{e.name}</p><p className="text-[12px] text-text-2">{e.type} · {mLong(e.date)} · {e.prob}%</p>
                <div className="mt-1 flex flex-wrap gap-1">{e.impacts.map(i => <span key={i.metric} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">{DRV[i.metric].label} {i.dir === 'up' ? '+' : '−'}{i.mag}%</span>)}</div></div>
              <span className={cx('shrink-0 font-mono text-[13px]', d >= 0 ? 'text-ok' : 'text-err')}>{fmtDelta(d)}</span>
            </li>))}</ul>
            : <p className="text-sm text-text-2">No events are active in {sel.name}, so its outcome equals the active forecast. Switch scenario above, or turn events on in <button type="button" onClick={() => onStage('scenarios')} className="text-brand underline-offset-2 hover:underline">Scenarios</button>.</p>}
          <p className="mt-3 border-t border-border pt-2 text-[11px] text-text-3">{events.length - c.events.length} other library event{events.length - c.events.length === 1 ? ' is' : 's are'} off in this scenario.</p>
        </Card>
        <Card title="Notes on change" sub="Active forecast edits and scenario overrides">
          {modified.length ? <ul className="divide-y divide-border">{modified.map(d => { const e = edits[d.id]!; return (
            <li key={d.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[13px] font-medium">{d.label}</p><p className="text-[12px] text-text-2">{describeEdit(d.id, e)}</p></div>
                <Btn variant="ghost" onClick={() => onEdit(d.id)} icon={<Pencil size={13} />}>Edit</Btn></div>
              <p className={cx('mt-1.5 rounded bg-surface-2 px-2.5 py-1.5 text-[13px]', !e.notes && 'italic text-text-3')}>{e.notes || 'No note added'}</p>
            </li>) })}</ul>
            : <p className="text-sm text-text-2">No driver has been overridden. The active forecast matches the reference baseline.</p>}
          {ovr.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{sel.name} overrides</p>
            <ul className="mt-1.5 space-y-1.5">{ovr.map(o => <li key={o.id} className="text-[13px]"><p className="font-medium">{describeOverride(o)}</p>{(o.note || o.by) && <p className="text-[12px] text-text-2">{o.note || `From ${o.by}`}</p>}</li>)}</ul>
            <button type="button" onClick={() => onStage('scenarios')} className="mt-2 text-[12px] font-semibold text-brand hover:underline">Edit in scenarios</button></div>}
        </Card>
      </div>

      <Card title="All scenarios" sub={`FY${FY} net revenue`}><CompareTable scenarios={scenarios} calc={calc} workFy={workFy} selId={sel.id} onSelect={setSelId} /></Card>
    </div>
  )
}

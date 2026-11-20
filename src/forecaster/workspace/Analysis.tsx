import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { Overlay } from '../../components/Overlay'
import { Check, ChevronDown, CircleCheck, CircleAlert, CircleMinus, GitBranch, GripVertical, Lock, Plus, Save, Target, Trash2, X, Zap } from 'lucide-react'
import {
  ACT, BASELINE, CURVE_LABEL, DRV, FC_YEARS, FY, HORIZON_LABEL, MEASURE_LABEL, N, OUTPUTS, OVR_LABEL, UNBIASED,
  adjusted, applyEvents, applyOverrides, bridge, describeOverride, fmtDelta, fmtRev, fmtV, funnelOf, fyAvg, netPrice, idxOf, mLong, measure,
} from './engine'
import type { Curve, DriverId, EventDef, Horizon, Layer, ModelCfg, OutputId, OvrKind, Override, Scenario } from './engine'
import { Btn, COLOR, Card, FiscalYearSelect, ForecastChart, Label, Legend, PageHeader, PageTitle, Seg, Tag, cx, field, InfoTip } from './ui'
import type { ChartSeries } from './ui'
import { NumField, Period } from './Drivers'
import type { Notify } from './Drivers'
import { ChartActions } from '../../chart/ChartActions'

type Calc = Record<string, { layer: Layer; rev: number[]; fy: number; events: EventDef[] }>
type SetScenarios = (f: (s: Scenario[]) => Scenario[]) => void

const unitOf = (id: DriverId) => DRV[id].pct ? 'pts' : '%'
const fmtVol = (v: number, unit: string) => unit === '$M' ? fmtRev(v) : `${v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K` : Math.round(v)}`
/** Display formatting for a measure value (revenue in $M, patients and TRx in thousands). */
export const fmtM = (m: OutputId, v: number, dp?: number) => m === 'rev' ? fmtRev(v, dp ?? (Math.abs(v) < 100 ? 1 : 0)) : `${v.toLocaleString('en-US', { maximumFractionDigits: dp ?? 1 })}K`
const fmtMDelta = (m: OutputId, v: number) => m === 'rev' ? fmtDelta(v) : `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`
const tone = (v: number) => v > 1e-9 ? 'text-ok' : v < -1e-9 ? 'text-err' : 'text-text-3'
const HORIZONS: Horizon[] = ['all', ...FC_YEARS]
const editableOf = (model: ModelCfg) => model.modules.filter(m => m.editable).map(m => m.id)

function addOverrides(setScenarios: SetScenarios, sel: Scenario, ovr: Override[]) {
  setScenarios(ss => ss.map(s => s.id === sel.id ? { ...s, ovr: [...(s.ovr ?? []), ...ovr] } : s))
}

/* ───────── Side-by-side scenario funnel ───────── */
export function FunnelCompare({ scenarios, calc, selId, onSelect, model, defaultYear = FY, exportId }: {
  scenarios: Scenario[]; calc: Calc; selId: string; onSelect?: (id: string) => void; model: ModelCfg; defaultYear?: number; exportId?: string
}) {
  const [year, setYear] = useState(defaultYear)
  const [picks, setPicks] = useState<string[]>(() => {
    const base = scenarios.find(s => s.name === 'Base Case')?.id
    return Array.from(new Set([base, selId, ...scenarios.map(s => s.id)].filter((x): x is string => !!x))).slice(0, 4)
  })
  const [scenarioMenu, setScenarioMenu] = useState(false)
  const scenarioMenuRef = useRef<HTMLButtonElement>(null)
  const closeScenarioMenu = useCallback(() => setScenarioMenu(false), [])
  const live = picks.filter(id => calc[id])
  const [anchor, setAnchor] = useState(live[0] ?? scenarios[0]!.id)
  const anc = calc[anchor] ? anchor : live[0]!
  const cols = live.map(id => ({ s: scenarios.find(x => x.id === id)!, k: scenarios.findIndex(x => x.id === id), f: funnelOf(calc[id]!.layer, year), br: id === anc ? null : bridge(calc[anc]!.layer, calc[id]!.layer, 'rev', year), ovr: scenarios.find(x => x.id === id)!.ovr?.length ?? 0 }))
  const shown = new Set<string>(['prev', 'trx', ...model.modules.map(m => m.id)])
  const rows = cols[0]?.f.filter(r => shown.has(r.id)) ?? []
  const locked = new Set(model.modules.filter(m => !m.editable).map(m => m.id))
  const toggle = (id: string) => setPicks(p => {
    const current = p.filter(pick => scenarios.some(s => s.id === pick))
    if (current.includes(id)) return current.length > 1 ? current.filter(x => x !== id) : current
    return current.length >= 5 ? current : [...current, id]
  })
  const revOf = (c: (typeof cols)[number]) => c.f.find(r => r.id === 'price')!.vol
  const ancRev = revOf(cols.find(c => c.s.id === anc) ?? cols[0]!)
  const maxAbs = Math.max(1e-9, ...cols.flatMap(c => c.br?.map(b => Math.abs(b.d)) ?? []))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FiscalYearSelect value={year} years={FC_YEARS} onChange={setYear} />
        <InfoTip text={`Rates are FY${year} averages. Each driver’s dollar figure is its share of the net revenue gap, swapping drivers in funnel order, so the figures add up to the total.`} />
        <>
          <button ref={scenarioMenuRef} type="button" aria-haspopup="menu" aria-expanded={scenarioMenu} aria-label={`Scenarios to compare, ${live.length} selected`}
            onClick={() => setScenarioMenu(open => !open)}
            className={cx('inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[14px] font-medium transition-colors', scenarioMenu ? 'border-border-strong bg-surface-2 text-text' : 'border-border-strong bg-surface text-text-2 hover:bg-surface-2 hover:text-text')}>
            Scenarios ({live.length})<ChevronDown size={15} className={cx('transition-transform', scenarioMenu && 'rotate-180')} />
          </button>
          <Overlay anchor={scenarioMenuRef} open={scenarioMenu} onClose={closeScenarioMenu} align="left" width={256}>
              <p className="px-2 py-1.5 text-[12px] text-text-3">Choose up to 5 scenarios</p>
              {scenarios.map((s, k) => {
                const selected = live.includes(s.id)
                const disabled = selected ? live.length <= 1 : live.length >= 5
                return (
                  <button key={s.id} type="button" role="menuitemcheckbox" aria-checked={selected} disabled={disabled} onClick={() => toggle(s.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[14px] text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45">
                    <span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded border', selected ? 'border-brand bg-brand text-white' : 'border-border-strong bg-surface')}>
                      {selected && <Check size={12} />}
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR.alt[k % COLOR.alt.length] }} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  </button>
                )
              })}
          </Overlay>
        </>
      </div>
      <div id={exportId} className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left align-bottom">
              <th className="w-[180px] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Funnel step · FY{year}</th>
              {cols.map(c => (
                <th key={c.s.id} className={cx('px-3 py-2.5 font-normal', c.s.id === anc && 'bg-brand-soft/50')}>
                  <button type="button" onClick={() => onSelect?.(c.s.id)} className="flex items-center gap-1.5 text-left text-[13px] font-semibold"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR.alt[c.k % COLOR.alt.length] }} />{c.s.name}{c.s.locked && <Lock size={11} aria-label="Final" />}</button>
                  <p className="mt-0.5 text-[11px] text-text-3">{calc[c.s.id]!.events.length} event{calc[c.s.id]!.events.length === 1 ? '' : 's'} · {c.ovr} override{c.ovr === 1 ? '' : 's'}</p>
                  {c.s.id === anc ? <span className="mt-1 inline-block"><Tag tone="brand">Compared against</Tag></span>
                    : <button type="button" onClick={() => setAnchor(c.s.id)} className="mt-1 text-[11px] font-semibold text-brand hover:underline">Compare against this</button>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isDrv = r.id !== 'prev' && r.id !== 'trx'
              const ancRow = (cols.find(c => c.s.id === anc) ?? cols[0]!).f.find(x => x.id === r.id)!
              return (
                <tr key={r.id} className="border-b border-border">
                  <td className="px-3 py-2.5 align-top">
                    <p className="font-medium">{isDrv ? DRV[r.id as DriverId].label : r.label}</p>
                    <p className="text-[11px] text-text-3">{isDrv ? (r.id === 'price' ? 'Gross × (1 − GTN) → net revenue' : r.id === 'rx' ? 'Rx per on-brand patient → TRx' : `→ ${r.label.toLowerCase()} patients`) : r.id === 'prev' ? 'Starting population' : `Rx from on-brand patients`}{locked.has(r.id as DriverId) && <> · <Lock size={9} className="inline" /> system-fed</>}</p>
                  </td>
                  {cols.map(c => {
                    const x = c.f.find(y => y.id === r.id)!, b = c.br?.find(y => y.id === r.id)
                    const dr = x.rate !== undefined && ancRow.rate !== undefined ? x.rate - ancRow.rate : 0
                    return (
                      <td key={c.s.id} className={cx('px-3 py-2.5 align-top', c.s.id === anc && 'bg-brand-soft/25')}>
                        {x.rate !== undefined ? <>
                          <div className="flex items-baseline justify-between gap-2"><span className="font-mono font-medium">{fmtV(r.id as DriverId, x.rate)}</span>
                            {c.s.id !== anc && Math.abs(dr) > 0.005 && <span className={cx('font-mono text-[11px]', tone(dr))}>{dr >= 0 ? '+' : '−'}{Math.abs(dr).toFixed(DRV[r.id as DriverId].dp)}{DRV[r.id as DriverId].pct ? ' pts' : ''}</span>}</div>
                          {DRV[r.id as DriverId].pct && <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${Math.min(100, x.rate)}%`, background: COLOR.alt[c.k % COLOR.alt.length] }} /></div>}
                          <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px] text-text-2"><span>{r.id === 'price' ? `per pack · net ${fmtV('price', netPrice(x.rate))}` : `${fmtVol(x.vol, x.unit)} ${r.id === 'rx' ? 'TRx' : r.label.toLowerCase()}`}</span>
                            {b && Math.abs(b.d) > 0.05 && <span className={cx('font-mono', tone(b.d))} title="Contribution to the net revenue gap">{fmtDelta(b.d)}</span>}</div>
                        </> : <span className="font-mono">{fmtVol(x.vol, x.unit)}</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="bg-surface-2">
              <td className="px-3 py-3 align-top"><p className="font-semibold">Net revenue</p><p className="text-[11px] text-text-3">FY{year} · what drives the gap</p></td>
              {cols.map(c => {
                const v = revOf(c), gap = v - ancRev
                return (
                  <td key={c.s.id} className={cx('px-3 py-3 align-top', c.s.id === anc && 'bg-brand-soft/40')}>
                    <div className="flex items-baseline justify-between gap-2"><span className="font-mono text-[16px] font-semibold">{fmtRev(v)}</span>{c.s.id !== anc && <span className={cx('font-mono text-[12px] font-medium', tone(gap))}>{fmtDelta(gap)}</span>}</div>
                    {c.br ? (
                      <ul className="mt-2 space-y-1" aria-label={`${c.s.name} gap by driver`}>
                        {c.br.filter(b => Math.abs(b.d) > 0.05).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).map(b => (
                          <li key={b.id} className="grid grid-cols-[64px_1fr] items-center gap-2 text-[11px]"><span className="truncate text-text-2">{DRV[b.id].label}</span>
                            <span className="relative h-2.5"><span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
                              <span className={cx('absolute inset-y-0 rounded-sm', b.d >= 0 ? 'bg-ok/70' : 'bg-err/70')} style={b.d >= 0 ? { left: '50%', width: `${Math.abs(b.d) / maxAbs * 50}%` } : { right: '50%', width: `${Math.abs(b.d) / maxAbs * 50}%` }} /></span></li>
                        ))}
                        {c.br.every(b => Math.abs(b.d) <= 0.05) && <li className="text-[11px] text-text-3">Same funnel as the comparison scenario.</li>}
                      </ul>
                    ) : <p className="mt-2 text-[11px] text-text-3">Other columns are explained against this one.</p>}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ───────── Scenario overrides (no events) ───────── */
const blankOvr = (driver: DriverId, work: Layer): Override => ({
  id: '', driver, kind: 'target', start: ACT, end: idxOf(2028, 11), value: +work[driver][N - 1]!.toFixed(DRV[driver].dp), curve: 's',
  years: Object.fromEntries(FC_YEARS.map(y => [y, +fyAvg(work[driver], y).toFixed(DRV[driver].dp)])), note: '',
})

export function ScenarioOverrides({ sel, setScenarios, work, events, model, notify }: { sel: Scenario; setScenarios: SetScenarios; work: Layer; events: EventDef[]; model: ModelCfg; notify: Notify }) {
  const editable = editableOf(model)
  const [draft, setDraft] = useState<Override | null>(null)
  const lock = sel.locked, list = sel.ovr ?? []
  const pre = useMemo(() => applyEvents(adjusted(work, sel.adj), events.filter(e => sel.active.includes(e.id))), [work, sel, events])
  const set = (p: Partial<Override>) => setDraft(d => d && ({ ...d, ...p }))
  const save = () => {
    if (!draft) return
    const o = { ...draft, id: draft.id || `ov${Date.now()}` }
    setScenarios(ss => ss.map(s => s.id === sel.id ? { ...s, ovr: draft.id ? (s.ovr ?? []).map(x => x.id === draft.id ? o : x) : [...(s.ovr ?? []), o] } : s))
    setDraft(null)
    notify({ tone: 'ok', text: `Override saved in ${sel.name}: ${describeOverride(o)}. Other scenarios and the active forecast are unchanged.` })
  }
  const del = (o: Override) => { setScenarios(ss => ss.map(s => s.id === sel.id ? { ...s, ovr: (s.ovr ?? []).filter(x => x.id !== o.id) } : s)); notify({ tone: 'info', text: 'Override removed.' }) }
  const d = draft && DRV[draft.driver]
  const before = draft ? applyOverrides(pre, list.filter(x => x.id !== draft.id)) : null
  const pv: ChartSeries | null = draft && before ? { actual: UNBIASED[draft.driver], working: before[draft.driver], scenario: applyOverrides(before, [draft])[draft.driver], scenarioName: 'With this override' } : null
  return (
    <Card title={`${sel.name} overrides`} info="Scenario-only values by month or year. Not events."
      right={<Btn variant="secondary" disabled={lock || !!draft || !editable.length} onClick={() => setDraft(blankOvr(editable.includes('share') ? 'share' : editable[0]!, pre))} icon={<Plus size={14} />}>Add override</Btn>}>
      {list.length ? (
        <ul className="divide-y divide-border">{list.map(o => (
          <li key={o.id} className={cx('flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0', draft?.id === o.id && 'rounded bg-brand-soft/40 px-2')}>
            <div className="min-w-[220px] flex-1"><p className="text-[13px] font-medium">{describeOverride(o)}</p>
              <p className="text-[12px] text-text-2">{OVR_LABEL[o.kind]}{o.by ? ` · from ${o.by}` : ''}{o.note ? ` · ${o.note}` : ''}</p></div>
            {!lock && <div className="flex gap-0.5"><Btn variant="ghost" onClick={() => setDraft(structuredClone(o))}>Edit</Btn><Btn variant="danger" title="Remove override" onClick={() => del(o)} icon={<Trash2 size={14} />} /></div>}
          </li>))}</ul>
      ) : !draft && <p className="text-[13px] text-text-2">No overrides. {sel.name} follows the active forecast, its adjustments and its events.</p>}
      {lock && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-text-3"><Lock size={12} />{sel.name} is final. Reopen it to change overrides.</p>}
      {draft && d && (
        <div className="mt-4 grid gap-5 rounded-md border border-brand/30 bg-brand-soft/20 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3 lg:order-last">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><Label className="mb-1">Assumption</Label><select value={draft.driver} onChange={e => setDraft(blankOvr(e.target.value as DriverId, pre))} className={field}>{editable.map(id => <option key={id} value={id}>{DRV[id].label}</option>)}</select></label>
              <label className="block"><Label className="mb-1">Type</Label><select value={draft.kind} onChange={e => set({ kind: e.target.value as OvrKind, value: e.target.value === 'shift' ? 0 : +pre[draft.driver][N - 1]!.toFixed(d.dp) })} className={field}>{(Object.keys(OVR_LABEL) as OvrKind[]).map(k => <option key={k} value={k}>{OVR_LABEL[k]}</option>)}</select></label>
            </div>
            {draft.kind === 'byYear' ? (
              <div><Label className="mb-1">{d.label} by year · {d.unit}</Label>
                <div className="grid grid-cols-3 gap-2">{FC_YEARS.map(y => <NumField key={y} label={y === FC_YEARS[0] ? `${y} (from ${mLong(ACT).slice(0, 3)})` : String(y)} value={draft.years[y] ?? NaN} step={d.pct ? 0.1 : 1} onChange={v => set({ years: { ...draft.years, [y]: v } })} />)}</div>
                <p className="mt-1 text-[12px] text-text-3">Leave a year blank to keep the scenario’s value for that year.</p></div>
            ) : <>
              <div className="grid grid-cols-2 gap-3">
                <Period label={draft.kind === 'target' ? 'Start moving from' : 'From'} value={Math.max(ACT, draft.start)} min={ACT} max={N - 1} onChange={v => set({ start: v, end: Math.max(v, draft.end) })} />
                <Period label={draft.kind === 'target' ? 'Reach it by' : 'Until'} value={draft.end} min={Math.max(ACT, draft.start)} max={N - 1} onChange={v => set({ end: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label={draft.kind === 'shift' ? `Change (${unitOf(draft.driver)})` : `Value (${d.unit})`} value={draft.value} step={d.pct ? 0.1 : 1} onChange={v => set({ value: v })} />
                {draft.kind === 'target' && <label className="block"><Label className="mb-1">Path</Label><select value={draft.curve} onChange={e => set({ curve: e.target.value as Curve })} className={field}>{(Object.keys(CURVE_LABEL) as Curve[]).map(c => <option key={c} value={c}>{CURVE_LABEL[c]}</option>)}</select></label>}
              </div>
            </>}
            <label className="block"><Label className="mb-1" hint="optional">Rationale</Label><input value={draft.note} onChange={e => set({ note: e.target.value })} placeholder="e.g. Brand plan: peak share by Dec 2028" className={field} /></label>
            <p className="text-[12px] text-text-2">{describeOverride(draft)}</p>
            <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={() => setDraft(null)}>Cancel</Btn><Btn disabled={draft.kind === 'byYear' ? !Object.values(draft.years).some(Number.isFinite) : !Number.isFinite(draft.value)} onClick={save} icon={<Save size={14} />}>Save override</Btn></div>
          </div>
          {pv && <div><Label className="mb-1.5">{d.label} · {sel.name}</Label><div className="mb-1"><Legend s={{ ...pv, working: pv.working }} /></div>
            <ForecastChart title={`${d.label} override`} s={pv} fmt={v => fmtV(draft.driver, v)} dp={d.dp} unit={d.unit} height={220} canSave={false} /></div>}
        </div>
      )}
    </Card>
  )
}

/* ───────── Sensitivity: what if one or more assumptions were different? ─────────
   Simplified after the team's Velsipity page: write the change as a sentence, see the result against the scenario as it
   is and with the change reversed, then rank which assumption matters most (±1 step or the planning ranges). */
type Conf = 'High' | 'Medium' | 'Low'
type Range = { lo: number; hi: number; conf: Conf; src: string }
const RANGES: Record<DriverId, Range> = {
  diag: { lo: 8, hi: 8, conf: 'High', src: 'Claims-derived diagnosis rate, 3-year history' },
  treat: { lo: 12, hi: 12, conf: 'Medium', src: 'Claims treated rate + KOL panel' },
  access: { lo: 6, hi: 4, conf: 'Medium', src: 'Payer contracting outlook' },
  share: { lo: 25, hi: 25, conf: 'Low', src: 'Analog launches + market research (n=120 neurologists)' },
  rx: { lo: 3, hi: 3, conf: 'High', src: 'Claims Rx per patient, 3-year history' },
  price: { lo: 8, hi: 5, conf: 'High', src: 'Pricing committee guidance, gross-to-net model' },
}
type Change = { id: string; driver: DriverId; how: 'pts' | 'pct'; step: number; from: number; to: number }
/** Applies each change over its window only, exactly as a kept override would. */
const windowed = (l: Layer, cs: Change[], sign: 1 | -1 = 1): Layer => cs.reduce((acc, c) => {
  const d = DRV[c.driver], s = [...acc[c.driver]]
  for (let i = Math.max(ACT, c.from); i <= Math.min(N - 1, c.to); i++) {
    const v = c.how === 'pts' ? s[i]! + sign * c.step : s[i]! * (1 + sign * c.step / 100)
    s[i] = d.pct ? Math.max(0, Math.min(100, v)) : Math.max(0, v)
  }
  return { ...acc, [c.driver]: s }
}, l)
const winAvg = (s: number[], from: number, to: number) => { const xs = s.slice(Math.max(ACT, from), Math.min(N - 1, to) + 1); return xs.reduce((a, b) => a + b, 0) / (xs.length || 1) }

type LeverRow = { id: DriverId; on: boolean; weight: number; cap: number }
const leverHow = (id: DriverId): 'pts' | 'pct' => DRV[id].pct ? 'pts' : 'pct'
/** One target, several levers. Each ticked lever takes its weighted share of the gap, capped by its own limit,
 *  then one scalar is bisected across all of them so the levers interacting still lands on the target. */
function solveLevers(base: Layer, metric: OutputId, h: Horizon, target: number, rows: LeverRow[], start: number) {
  const on = rows.filter(r => r.on && r.weight > 0)
  const apply = (steps: { id: DriverId; step: number }[]) =>
    windowed(base, steps.map(s => ({ id: s.id, driver: s.id, how: leverHow(s.id), step: s.step, from: start, to: N - 1 })))
  const before = measure(metric, base, h), LIM = 400
  // The step that would close the whole gap with this lever alone; the weights then divide it.
  const full = on.map(r => {
    const f = (x: number) => measure(metric, apply([{ id: r.id, step: x }]), h)
    if (Math.abs(f(LIM) - f(-LIM)) < 1e-9) return 0
    const up = f(LIM) > f(-LIM)
    let lo = -LIM, hi = LIM
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; (f(mid) < target) === up ? lo = mid : hi = mid }
    return (lo + hi) / 2
  })
  const wsum = on.reduce((a, r) => a + r.weight, 0) || 1
  const at = (t: number) => on.map((r, i) => {
    const want = t * (r.weight / wsum) * full[i]!
    return { id: r.id, step: Math.sign(want) * Math.min(Math.abs(want), r.cap) }
  })
  const g = (t: number) => measure(metric, apply(at(t)), h) - target
  const T = 60
  let t = 0
  if (on.length && Math.abs(g(0)) > 1e-9) {
    if (g(0) * g(T) > 0) t = T
    else { let lo = 0, hi = T; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; (g(mid) < 0) === (g(0) < 0) ? lo = mid : hi = mid } t = (lo + hi) / 2 }
  }
  const steps = at(t).map((s, i) => ({ ...s, weight: on[i]!.weight, cap: on[i]!.cap, capped: Math.abs(s.step) >= on[i]!.cap - 1e-6 }))
  const layer = apply(steps), after = measure(metric, layer, h)
  return { steps, layer, before, after, target, met: Math.abs(after - target) <= Math.max(1e-6, Math.abs(target) * 1e-3) }
}
if (import.meta.env.DEV) {
  // Two levers at equal weight with room to move must land on the target, both pushing the same way.
  const t0 = measure('rev', UNBIASED, FY) * 1.05
  const r = solveLevers(UNBIASED, 'rev', FY, t0, [{ id: 'share', on: true, weight: 50, cap: 50 }, { id: 'diag', on: true, weight: 50, cap: 50 }], ACT)
  console.assert(r.met && r.steps.every(s => s.step > 0), 'solveLevers: equal weights must reach the target')
}
const stepTxt = (c: Change) => `${c.step >= 0 ? '+' : '−'}${Math.abs(+c.step.toFixed(2))}${c.how === 'pts' ? (Math.abs(c.step) === 1 ? ' pt' : ' pts') : '%'}`
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Month and year as two short pickers instead of one long list of months. */
function MonthPick({ value, min, onChange, label, grow }: { value: number; min: number; onChange: (v: number) => void; label: string; grow?: boolean }) {
  const y = 2025 + Math.floor(value / 12), mo = value % 12
  const set = (yy: number, mm: number) => onChange(Math.min(N - 1, Math.max(min, idxOf(yy, mm))))
  const sel = cx(grow ? 'h-9 min-w-0 flex-1' : 'h-8', 'rounded-md border border-border-strong bg-surface px-1.5 text-[13px] outline-none focus:border-brand')
  return (
    <span className={cx('gap-1', grow ? 'flex min-w-0 flex-1' : 'inline-flex')} role="group" aria-label={label}>
      <select aria-label={`${label} month`} value={mo} onChange={e => set(y, +e.target.value)} className={sel}>{MON.map((m, k) => <option key={m} value={k} disabled={idxOf(y, k) < min}>{m}</option>)}</select>
      <select aria-label={`${label} year`} value={y} onChange={e => set(+e.target.value, mo)} className={sel}>{FC_YEARS.filter(yy => idxOf(yy, 11) >= min).map(yy => <option key={yy} value={yy}>{yy}</option>)}</select>
    </span>
  )
}
const OUT_ROWS: OutputId[] = ['rev', 'trx', 'pts']

export function SensitivityStage({ scenarios, setScenarios, calc, selId, setSelId, model, notify }: {
  scenarios: Scenario[]; setScenarios: SetScenarios; calc: Calc; selId: string; setSelId: (id: string) => void; model: ModelCfg; notify: Notify
}) {
  const sel = scenarios.find(s => s.id === selId) ?? scenarios[0]!
  const base = calc[sel.id]!.layer
  const editable = editableOf(model)
  const first = editable.includes('share') ? 'share' : editable[0] ?? 'share'
  const [changes, setChanges] = useState<Change[]>(() => [{ id: 'c1', driver: first, how: DRV[first].pct ? 'pts' : 'pct', step: 1, from: Math.max(ACT, idxOf(FY, 0)), to: idxOf(FY, 11) }])
  const [open, setOpen] = useState<string | null>('c1')
  const [year, setYear] = useState(FY)
  const [rank, setRank] = useState<'step' | 'range'>('step')
  const [pick, setPick] = useState<DriverId | null>(null)
  const [view, setView] = useState<'chart' | 'tornado'>('tornado')
  const [sensStream, setSensStream] = useState('all')
  const [dragId, setDragId] = useState<string | null>(null)
  const reorder = (from: number, to: number) => setChanges(cs => { const n = [...cs]; n.splice(to, 0, ...n.splice(from, 1)); return n })
  const patch = (id: string, p: Partial<Change>) => setChanges(cs => cs.map(c => {
    if (c.id !== id) return c
    const n = { ...c, ...p }
    if (p.driver && p.driver !== c.driver) n.how = DRV[p.driver].pct ? 'pts' : 'pct'
    if (!DRV[n.driver].pct) n.how = 'pct'
    if (n.to < n.from) n.to = n.from
    return n
  }))
  const push = (c: Omit<Change, 'id'>) => { const id = `c${Date.now()}`; setChanges(cs => [...cs, { ...c, id }]); setOpen(id) }
  const addChange = () => { const l = changes[changes.length - 1]!, nxt = editable.find(id => !changes.some(c => c.driver === id)) ?? l.driver; push({ driver: nxt, how: DRV[nxt].pct ? 'pts' : 'pct', step: 1, from: l.from, to: l.to }) }

  const up = useMemo(() => windowed(base, changes, 1), [base, changes])
  const dn = useMemo(() => windowed(base, changes, -1), [base, changes])
  const m = (l: Layer, o: OutputId = 'rev') => measure(o, l, year)
  const bN = m(base), uN = m(up), dN = m(dn)
  const plural = changes.length > 1
  const what = plural ? `${changes.length} changes` : `${DRV[changes[0]!.driver].label} ${stepTxt(changes[0]!)}`
  const series: ChartSeries = { actual: OUTPUTS.rev.fn(UNBIASED), scenario: OUTPUTS.rev.fn(base), scenarioName: `${sel.name} as it is`,
    extra: [{ name: `With the change${plural ? 's' : ''}`, color: COLOR.preview, series: OUTPUTS.rev.fn(up) }, { name: 'Reversed', color: '#b9bed0', series: OUTPUTS.rev.fn(dn) }] }
  const alone = plural ? changes.map(c => ({ c, d: m(windowed(base, [c])) - bN })) : []
  const inter = (uN - bN) - alone.reduce((a, p) => a + p.d, 0)

  // Tornado: every assumption moved on its own around the scenario as it is, over a fixed window.
  // Only an assumption you change on the left takes your step and period; every other bar stays put.
  const wFrom = Math.max(ACT, idxOf(FY, 0)), wTo = idxOf(FC_YEARS[FC_YEARS.length - 1]!, 11)
  const tB = bN
  const ranked = model.modules.map(({ id }) => {
    const pct = DRV[id].pct, r = RANGES[id], mine = changes.filter(c => c.driver === id)
    const step = rank === 'step' ? 1 : r.hi
    const how: Change['how'] = rank === 'step' ? (pct ? 'pts' : 'pct') : 'pct'
    const hiC: Change = mine.length === 1 ? mine[0]! : { id, driver: id, how, step, from: wFrom, to: wTo }
    const loC: Change = mine.length === 1 ? { ...hiC, step: -hiC.step } : { ...hiC, step: rank === 'step' ? -step : -r.lo }
    const hiL = mine.length ? windowed(base, mine, 1) : windowed(base, [hiC]), loL = mine.length ? windowed(base, mine, -1) : windowed(base, [loC])
    const lab = mine.length ? mine.map(stepTxt).join(', ') : rank === 'step' ? `±${+step.toFixed(2)}${how === 'pts' ? ' pts' : '%'}` : `−${r.lo}% / +${r.hi}%`
    return { id, hiC, loC, mine: mine.length > 0, hi: m(hiL) - tB, lo: m(loL) - tB, hiV: winAvg(hiL[id], hiC.from, hiC.to), loV: winAvg(loL[id], hiC.from, hiC.to), now: winAvg(base[id], hiC.from, hiC.to), lab, r }
  }).sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo))
  const total = ranked.reduce((a, r) => a + Math.abs(r.hi - r.lo), 0) || 1
  const sp = ranked.find(r => r.id === pick) ?? ranked[0]!
  const lo0 = Math.min(0, ...ranked.map(r => Math.min(r.lo, r.hi))), hi0 = Math.max(0, ...ranked.map(r => Math.max(r.lo, r.hi)))
  const padV = (hi0 - lo0) * 0.12 || 1, dMin = tB + lo0 - padV, dMax = tB + hi0 + padV
  const xp = (v: number) => ((v - dMin) / (dMax - dMin)) * 100
  const ticks = Array.from({ length: 5 }, (_, k) => dMin + ((dMax - dMin) * k) / 4)

  const ovrs = (): Override[] => changes.map((c, k) => {
    const d = DRV[c.driver], before = winAvg(base[c.driver], c.from, c.to)
    // A % change on a rate is kept as the equivalent points so the override reads the same way as the preview.
    const value = d.pct && c.how === 'pct' ? +(before * c.step / 100).toFixed(3) : c.step
    return { id: `ov${Date.now()}${k}`, driver: c.driver, kind: 'shift', start: Math.max(ACT, c.from), end: c.to, value, curve: 'linear', years: {}, note: `Sensitivity: ${d.label} ${stepTxt(c)}, ${mLong(c.from)}–${mLong(c.to)}`, by: 'sensitivity' }
  })
  const keep = () => {
    if (sel.locked) return notify({ tone: 'info', text: `${sel.name} is final and locked. Save the change as a new scenario instead.` })
    addOverrides(setScenarios, sel, ovrs()); notify({ tone: 'ok', text: `Kept in ${sel.name} as ${changes.length} override${plural ? 's' : ''}.` })
  }
  const saveNew = () => {
    const n: Scenario = { id: `sc${Date.now()}`, name: `${sel.name} · what-if`, active: [...sel.active], adj: { ...sel.adj }, locked: false, ovr: [...(sel.ovr ?? []), ...ovrs()] }
    setScenarios(ss => [...ss, n]); setSelId(n.id); notify({ tone: 'ok', text: `${n.name} created. It now appears in the Scenario summary.` })
  }
  const dd = (x: number, o: OutputId = 'rev') => Math.abs(x) < 1e-6 ? <span className="text-text-3">no change</span> : <span className={tone(x)}>{fmtMDelta(o, x)}</span>
  const pct = (x: number) => bN ? ` · ${x >= 0 ? '+' : '−'}${Math.abs(x / bN * 100).toFixed(1)}%` : ''
  const yearSelect = <FiscalYearSelect value={year} years={FC_YEARS} onChange={setYear} />

  return (
    <div className="space-y-5">
      <PageHeader>
        <PageTitle title="What if assumptions were different?" info="Test changes on a scenario. Nothing is saved until you keep it." />
        {yearSelect}
      </PageHeader>

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card title="Assumption changes" info="Each change applies over its own period." fill className="lg:order-last">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><Label className="mb-1">Scenario</Label>
              <select aria-label="Scenario" value={sel.id} onChange={e => setSelId(e.target.value)} className={cx(field, 'font-medium')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="block"><Label className="mb-1">Target stream</Label>
              <select aria-label="Stream" value={sensStream} onChange={e => setSensStream(e.target.value)} className={cx(field, 'font-medium')}>
                <option value="all">All streams (Model total)</option>
                <option value="primary">Primary stream · US net revenue</option>
              </select></label>
          </div>
          <ul className="mt-4 space-y-2.5">
            {changes.map((c, k) => {
              const d = DRV[c.driver], before = winAvg(base[c.driver], c.from, c.to), after = c.how === 'pts' ? before + c.step : before * (1 + c.step / 100)
              const isOpen = open === c.id
              return (
                <li key={c.id} draggable={dragId === c.id} onDragEnd={() => setDragId(null)}
                  onDragOver={e => { if (!dragId || dragId === c.id) return; e.preventDefault(); reorder(changes.findIndex(x => x.id === dragId), k) }}
                  className={cx('overflow-hidden rounded-lg border bg-surface transition-colors', isOpen ? 'border-brand/40 shadow-[0_1px_3px_rgba(16,24,40,0.06)]' : 'border-border', dragId === c.id && 'opacity-60')}>
                  <div className={cx('flex items-center gap-2 px-3 py-2.5', isOpen && 'bg-brand-soft/30')}>
                    <button type="button" title="Drag to reorder" disabled={!plural} aria-label={`Reorder ${d.label} change, ${k + 1} of ${changes.length}. Arrow keys move it.`}
                      onPointerDown={() => setDragId(c.id)} onPointerUp={() => setDragId(null)}
                      onKeyDown={e => { const n = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; if (!n || k + n < 0 || k + n >= changes.length) return; e.preventDefault(); reorder(k, k + n) }}
                      className="grid h-7 w-7 shrink-0 cursor-grab place-items-center rounded text-text-3 hover:bg-surface-2 hover:text-text active:cursor-grabbing disabled:pointer-events-none disabled:opacity-30"><GripVertical size={14} /></button>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{d.label} {stepTxt(c)}</span>
                        <span className="block truncate text-[12px] text-text-3">{mLong(c.from)} – {mLong(c.to)} · <span className="font-mono">{fmtV(c.driver, before)} → <span className={tone(after - before)}>{fmtV(c.driver, after)}</span></span></span></span>
                      <ChevronDown size={16} className={cx('shrink-0 text-text-3 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    <button type="button" title="Remove change" disabled={!plural} aria-label={`Remove ${d.label} change`} onClick={() => setChanges(cs => cs.filter(x => x.id !== c.id))} className="grid h-7 w-7 shrink-0 place-items-center rounded text-text-3 hover:bg-err-soft hover:text-err disabled:pointer-events-none disabled:opacity-30"><Trash2 size={13} /></button>
                  </div>
                  {isOpen && (
                    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t border-border px-3 py-3.5">
                      <Label>Assumption</Label>
                      <select aria-label="Assumption" value={c.driver} onChange={e => patch(c.id, { driver: e.target.value as DriverId })} className={field}>{editable.map(id => <option key={id} value={id}>{DRV[id].label}</option>)}</select>
                      <Label>Change by</Label>
                      <div className="flex h-9 w-full items-stretch overflow-hidden rounded-md border border-border-strong bg-surface">
                        <button type="button" aria-label="Decrease" onClick={() => patch(c.id, { step: +(c.step - 0.5).toFixed(2) })} className="w-9 shrink-0 text-[15px] text-text-2 hover:bg-surface-2">−</button>
                        <input type="number" step={0.5} aria-label="Change by" value={c.step} onChange={e => patch(c.id, { step: e.target.value === '' ? 0 : +e.target.value })} className="min-w-0 flex-1 border-x border-border-strong bg-surface text-center font-mono text-[13px] outline-none" />
                        <button type="button" aria-label="Increase" onClick={() => patch(c.id, { step: +(c.step + 0.5).toFixed(2) })} className="w-9 shrink-0 border-r border-border-strong text-[15px] text-text-2 hover:bg-surface-2">+</button>
                        {(d.pct ? (['pts', 'pct'] as const) : (['pct'] as const)).map(u => (
                          <button key={u} type="button" aria-pressed={c.how === u} onClick={() => patch(c.id, { how: u })} className={cx('w-12 shrink-0 text-[12.5px] font-medium transition-colors', c.how === u ? 'bg-brand-soft text-brand' : 'text-text-2 hover:bg-surface-2')}>{u === 'pts' ? 'pts' : '%'}</button>
                        ))}
                      </div>
                      <Label>Period</Label>
                      <div className="flex w-full items-center gap-2"><MonthPick grow label="From" value={c.from} min={ACT} onChange={v => patch(c.id, { from: v })} /><span className="shrink-0 text-[12px] text-text-3">to</span><MonthPick grow label="To" value={c.to} min={c.from} onChange={v => patch(c.id, { to: v })} /></div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
            <Btn variant="secondary" onClick={addChange} disabled={changes.length >= editable.length} icon={<Plus size={14} />}>Add a change</Btn>
            <span className="text-[12px] text-text-3">Points add to a rate; % scales it.</span>
          </div>
        </Card>

        <Card frame title={view === 'chart' ? `Net revenue · ${sel.name}` : 'What moves net revenue most'} info={view === 'chart' ? 'As it is, with the changes, and reversed.' : `Swings around ${sel.name} as it is. Only the assumptions you change on the left move.`} fill
          right={<div className="flex items-center gap-2"><Seg label="View" value={view} onChange={setView} options={[{ id: 'chart', label: 'Net revenue' }, { id: 'tornado', label: 'Tornado' }]} />{view === 'tornado' && <ChartActions target="export-tornado" title="What moves net revenue most" subtitle={`${sel.name} · FY${year}`} />}</div>}>
          <div className="flex min-h-[480px] flex-1 flex-col">
          {view === 'chart' ? <>
            <div className="mb-1"><Legend s={series} /></div>
            <ForecastChart title="Sensitivity" s={series} fmt={v => fmtRev(v, 1)} dp={0} unit="$M" height={290} canSave={false} toolbar={false} />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-surface-2 px-3.5 py-2.5"><p className="text-[12px] text-text-2">FY{year} as it is</p><p className="font-mono text-[19px] font-semibold">{fmtRev(bN, 1)}</p></div>
              <div className="rounded-md border border-[#7c3aed]/30 bg-[#7c3aed]/[0.06] px-3.5 py-2.5"><p className="truncate text-[12px] text-text-2" title={`With ${what}`}>With {what}</p><p className="font-mono text-[19px] font-semibold">{fmtRev(uN, 1)}</p><p className={cx('text-[12px] font-semibold', tone(uN - bN))}>{fmtDelta(uN - bN)}{pct(uN - bN)}</p></div>
              <div className="rounded-md bg-surface-2 px-3.5 py-2.5"><p className="text-[12px] text-text-2">Reversed</p><p className="font-mono text-[19px] font-semibold">{fmtRev(dN, 1)}</p><p className={cx('text-[12px] font-semibold', tone(dN - bN))}>{fmtDelta(dN - bN)}{pct(dN - bN)}</p></div>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-4">
              {sel.locked && <p className="mr-auto text-[12px] text-text-3"><Lock size={11} className="inline" /> {sel.name} is final.</p>}
              <Btn variant="secondary" onClick={saveNew} icon={<GitBranch size={14} />}>Save as new scenario</Btn>
              <Btn disabled={sel.locked} onClick={keep} icon={<Zap size={14} />}>Keep in {sel.name}</Btn>
            </div>
          </> : <>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex gap-4 text-[12px] text-text-2">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-err/55" />Lower</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-ok/70" />Higher</span>
              </div>
              <Seg label="Move each by" value={rank} onChange={setRank} options={[{ id: 'step', label: '±1 pt / 1%' }, { id: 'range', label: 'Planning range' }]} />
            </div>
            <div id="export-tornado" className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 bg-surface">
              <span />
              <div className="relative h-7"><span className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap rounded bg-text px-1.5 py-0.5 font-mono text-[10.5px] text-white" style={{ left: `${xp(tB)}%` }}>As it is {fmtRev(tB, 1)}</span></div>
              {ranked.map(r => {
                const a = tB + Math.min(r.lo, r.hi), z = tB + Math.max(r.lo, r.hi), on = r.id === sp.id
                return (
                  <Fragment key={r.id}>
                    <button type="button" onClick={() => setPick(r.id)} aria-pressed={on} className={cx('flex min-w-0 flex-col justify-center rounded-l-md py-2 pl-2 text-left', on && 'bg-surface-2')}>
                      <span className={cx('truncate text-[13px]', on ? 'font-semibold' : 'font-medium')}>{DRV[r.id].label}</span>
                      <span className="truncate text-[11px] text-text-3">{r.lab}{rank === 'range' ? ` · ${r.r.conf}` : ''}{r.mine && <span className="ml-1 rounded bg-[#7c3aed]/10 px-1 font-semibold text-[#7c3aed]">changed</span>}</span>
                    </button>
                    <button type="button" onClick={() => setPick(r.id)} aria-label={`${DRV[r.id].label}: ${fmtRev(a, 1)} to ${fmtRev(z, 1)}`} className={cx('relative h-11 rounded-r-md', on && 'bg-surface-2')}>
                      {ticks.map((t, k) => <span key={k} aria-hidden className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${xp(t)}%` }} />)}
                      <span aria-hidden className="absolute inset-y-0 w-px bg-text" style={{ left: `${xp(tB)}%` }} />
                      <span className="absolute top-1/2 h-5 -translate-y-1/2 rounded-l-sm bg-err/55 transition-all duration-300" style={{ left: `${xp(a)}%`, width: `${xp(tB) - xp(a)}%` }} />
                      <span className="absolute top-1/2 h-5 -translate-y-1/2 rounded-r-sm bg-ok/70 transition-all duration-300" style={{ left: `${xp(tB)}%`, width: `${xp(z) - xp(tB)}%` }} />
                      <span className="absolute top-1/2 -translate-x-full -translate-y-1/2 pr-1.5 font-mono text-[11px] text-text-2" style={{ left: `${xp(a)}%` }}>{fmtRev(a, 1)}</span>
                      <span className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] text-text-2" style={{ left: `${xp(z)}%` }}>{fmtRev(z, 1)}</span>
                    </button>
                  </Fragment>
                )
              })}
              <span />
              <div className="relative mt-1 h-5 border-t border-border text-[10.5px] text-text-3">{ticks.map((t, k) => <span key={k} className="absolute top-1 -translate-x-1/2 font-mono" style={{ left: `${xp(t)}%` }}>{fmtRev(t)}</span>)}</div>
            </div>
            <div className="mt-auto pt-4">
              <div className="grid items-center gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <div className="min-w-0"><p className="truncate text-[14px] font-semibold">{DRV[sp.id].label}</p>
                  <p className={cx('truncate text-[12px]', rank === 'range' ? (sp.r.conf === 'Low' ? 'text-err' : sp.r.conf === 'Medium' ? 'text-warn' : 'text-ok') : 'text-text-3')} title={sp.r.src}>{rank === 'range' ? `${sp.r.conf} confidence · ${sp.r.src}` : `Now ${fmtV(sp.id, sp.now)} · swing ${fmtRev(Math.abs(sp.hi - sp.lo), 1)} (${Math.round(Math.abs(sp.hi - sp.lo) / total * 100)}%)`}</p></div>
                {[['Low', sp.loV, sp.lo], ['High', sp.hiV, sp.hi]].map(([k, v, dlt]) => (
                  <div key={k as string} className="text-right"><p className="text-[11px] text-text-3">{k} · {fmtV(sp.id, v as number)}</p><p className="font-mono text-[14px] font-semibold">{fmtRev(tB + (dlt as number), 1)}</p></div>
                ))}
                <Btn variant="secondary" disabled={!editable.includes(sp.id)} onClick={() => push({ driver: sp.id, how: sp.hiC.how, step: sp.hiC.step, from: wFrom, to: wTo })} icon={<Plus size={14} />}>Test this</Btn>
              </div>
            </div>
          </>}
          </div>
        </Card>
      </div>

      <Card title={`Key outputs · FY${year}`} info="The scenario as it is against the changes above.">
        <div className={cx('grid gap-6', plural && 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]')}>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3"><th className="py-2 text-left font-semibold">Output</th><th className="py-2 text-right font-semibold">As it is</th><th className="py-2 text-right font-semibold">With change{plural ? 's' : ''}</th><th className="py-2 text-right font-semibold">Difference</th><th className="py-2 text-right font-semibold">Reversed</th></tr></thead>
            <tbody>{OUT_ROWS.filter(o => model.outputs.includes(o)).map(o => { const b0 = m(base, o), u = m(up, o), d0 = m(dn, o); return (
              <tr key={o} className="border-b border-border last:border-0"><td className="py-2.5 font-medium">{MEASURE_LABEL[o]}</td><td className="py-2.5 text-right font-mono">{fmtM(o, b0)}</td><td className="py-2.5 text-right font-mono font-semibold">{fmtM(o, u)}</td><td className="py-2.5 text-right font-mono">{dd(u - b0, o)}</td><td className="py-2.5 text-right font-mono">{dd(d0 - b0, o)}</td></tr>) })}</tbody>
          </table>
          {plural && <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Each change on its own · net revenue</p>
            <ul className="mt-1.5 divide-y divide-border text-[13px]">
              {alone.map((p, k) => <li key={p.c.id} className="flex justify-between py-1.5"><span><span className="text-text-3">{k + 1}.</span> {DRV[p.c.driver].label} <span className="text-text-3">{stepTxt(p.c)}</span></span><span className="font-mono">{dd(p.d)}</span></li>)}
              {Math.abs(inter) >= 0.05 && <li className="flex justify-between py-1.5 text-text-2"><span>Overlap between changes</span><span className="font-mono">{dd(inter)}</span></li>}
              <li className="flex justify-between py-1.5 font-semibold"><span>All together</span><span className="font-mono">{dd(uN - bN)}</span></li>
            </ul></div>}
        </div>
      </Card>
    </div>
  )
}

/* ───────── Goal seek: one target, the levers share the gap ───────── */
export function GoalSeekPanel({ base, sel, setScenarios, model, notify }: { base: Layer; sel: Scenario; setScenarios: SetScenarios; model: ModelCfg; notify: Notify }) {
  const editable = editableOf(model)
  const [metric, setMetric] = useState<OutputId>(model.outputs.includes('rev') ? 'rev' : model.outputs[0]!)
  const [h, setH] = useState<Horizon>(FY)
  const [start, setStart] = useState(ACT)
  const [split, setSplit] = useState<'weight' | 'fix' | 'order'>('weight')
  const even = (ls: LeverRow[]) => { const n = ls.filter(l => l.on).length || 1; return ls.map(l => ({ ...l, weight: l.on ? +(100 / n).toFixed(1) : 0 })) }
  /** Keeps the ticked rows summing to 100, a newly ticked row taking an even share and the rest scaling to fit. */
  const rebalance = (ls: LeverRow[], justOn?: DriverId) => {
    const on = ls.filter(l => l.on)
    if (!on.length) return ls.map(l => ({ ...l, weight: 0 }))
    const share = 100 / on.length, others = on.filter(l => l.id !== justOn)
    const sum = others.reduce((a, l) => a + l.weight, 0), room = justOn ? 100 - share : 100
    return ls.map(l => !l.on ? { ...l, weight: 0 }
      : l.id === justOn ? { ...l, weight: +share.toFixed(1) }
      : { ...l, weight: +(sum > 0 ? (l.weight / sum) * room : room / (others.length || 1)).toFixed(1) })
  }
  const [levers, setLevers] = useState<LeverRow[]>(() => even(editable.map((id, i) => ({ id, on: i < 3, weight: 0, cap: 3 }))))
  const before = measure(metric, base, h)
  const [target, setTarget] = useState(() => +(before * 1.1).toFixed(model.outputs.includes('rev') ? 0 : 1))
  const [res, setRes] = useState<ReturnType<typeof solveLevers> | null>(null)
  const [applied, setApplied] = useState(false)
  const reset = () => { setRes(null); setApplied(false) }
  const rebase = (m: OutputId, hh: Horizon) => { setTarget(+(measure(m, base, hh) * 1.1).toFixed(m === 'rev' ? 0 : 1)); reset() }
  const patchL = (id: DriverId, p: Partial<LeverRow>) => { setLevers(ls => ls.map(l => l.id === id ? { ...l, ...p } : l)); reset() }
  const toggle = (id: DriverId) => { setLevers(ls => { const next = ls.map(l => l.id === id ? { ...l, on: !l.on } : l); return rebalance(next, next.find(l => l.id === id)!.on ? id : undefined) }); reset() }
  const total = levers.filter(l => l.on).reduce((a, l) => a + (l.weight || 0), 0)
  const gap = target - before
  const unit = metric === 'rev' ? '$M' : 'K'
  const valid = Number.isFinite(target) && levers.some(l => l.on && l.weight > 0)
  const run = () => { setRes(solveLevers(base, metric, h, target, levers, start)); setApplied(false) }
  const moves = res?.steps.filter(s => Math.abs(s.step) > 1e-6) ?? []
  const apply = () => {
    if (!res) return
    if (sel.locked) return notify({ tone: 'info', text: `${sel.name} is final and locked. Reopen it to apply a result.` })
    // shortcut: a pts move is filed as the equivalent % shift, since overrides carry no additive kind. Upgrade when OvrKind gains one.
    addOverrides(setScenarios, sel, moves.map((s, k) => {
      const now = winAvg(base[s.id], start, N - 1)
      const pct = leverHow(s.id) === 'pts' ? (now ? (s.step / now) * 100 : 0) : s.step
      return { id: `ov${Date.now()}${k}`, driver: s.id, kind: 'shift' as const, start, end: N - 1, value: +pct.toFixed(4), curve: 'linear' as const, years: {},
        note: `Goal seek · ${MEASURE_LABEL[metric]} ${HORIZON_LABEL(h)} to ${fmtM(metric, target)}` }
    }))
    setApplied(true)
    notify({ tone: 'ok', text: `Goal seek added to ${sel.name} as ${moves.length} override${moves.length === 1 ? '' : 's'}. The active forecast and other scenarios are unchanged.` })
  }
  const o = OUTPUTS[metric]
  const chart: ChartSeries = { actual: o.fn(UNBIASED), scenario: o.fn(base), scenarioName: `${sel.name} · current`,
    ...(res ? { extra: [{ name: 'After goal seek', color: COLOR.preview, series: o.fn(res.layer) }] } : {}) }
  const num = 'h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-right font-mono text-[13px] outline-none focus:border-brand disabled:bg-surface-2 disabled:text-text-3'
  return (
    <div className="space-y-5">
      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card title="Target and levers" info="Set one target, then tick the inputs that may move to close the gap." fill className="lg:order-last">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><Label className="mb-1">Target</Label>
              <select value={metric} onChange={e => { const m = e.target.value as OutputId; setMetric(m); rebase(m, h) }} className={field}>{model.outputs.map(o => <option key={o} value={o}>{MEASURE_LABEL[o]}</option>)}</select></label>
            <label className="block"><Label className="mb-1">Period</Label>
              <select value={String(h)} onChange={e => { const hh = e.target.value === 'all' ? 'all' : +e.target.value as Horizon; setH(hh); rebase(metric, hh) }} className={field}>{HORIZONS.map(x => <option key={String(x)} value={String(x)}>{HORIZON_LABEL(x)}</option>)}</select></label>
            <label className="block"><Label className="mb-1">Target value ({unit})</Label>
              <input type="number" value={target} onChange={e => { setTarget(e.target.value === '' ? NaN : +e.target.value); reset() }} className={cx(field, 'font-mono')} /></label>
          </div>
          <p className="mt-2 text-[12.5px] text-text-2">Now <b className="font-mono text-text">{fmtM(metric, before)}</b> · gap to target <b className={cx('font-mono', gap >= 0 ? 'text-ok' : 'text-err')}>{gap >= 0 ? '+' : '−'}{fmtM(metric, Math.abs(gap))}</b>{before ? ` (${(gap / before * 100).toFixed(1)}%)` : ''}</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Seg label="How the gap is split" value={split} onChange={setSplit} options={[
              { id: 'weight', label: 'Split by weight' },
              { id: 'fix', label: 'Fix, then split', disabled: true, title: 'Not built yet' },
              { id: 'order', label: 'Fix, then fill in order', disabled: true, title: 'Not built yet' }]} />
            <button type="button" onClick={() => { setLevers(even); reset() }} className="text-[13px] font-semibold text-brand hover:underline">Even split</button>
          </div>
          <p className="mt-2 text-[12px] text-text-3">Each ticked input covers its share of the gap, up to its limit. If one hits its limit, the others take over its share.</p>

          <table className="mt-3 w-full table-fixed text-[13px]">
            <colgroup><col /><col className="w-[92px]" /><col className="w-[92px]" /></colgroup>
            <thead><tr className="border-b border-border bg-surface-2 text-[11px] uppercase leading-tight tracking-wide text-text-3">
              <th className="px-3 py-2 text-left font-semibold">Input</th>
              <th className="px-2 py-2 text-right font-semibold">Share of gap</th>
              <th className="px-2 py-2 text-right font-semibold">May move up to</th></tr></thead>
            <tbody>{levers.map(l => {
              const d = DRV[l.id], r = RANGES[l.id], now = winAvg(base[l.id], start, N - 1)
              return (
                <tr key={l.id} className={cx('border-b border-border last:border-0', !l.on && 'text-text-3')}>
                  <td className="px-3 py-2.5">
                    <label className="flex items-start gap-2.5">
                      <input type="checkbox" checked={l.on} onChange={() => toggle(l.id)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
                      <span className="min-w-0"><span className={cx('block truncate font-medium', l.on && 'text-text')}>{d.label}</span>
                        <span className="block text-[12px] leading-snug text-text-3">Now {fmtV(l.id, now)} · plausible {fmtV(l.id, now * (1 - r.lo / 100))}–{fmtV(l.id, now * (1 + r.hi / 100))}</span></span>
                    </label>
                  </td>
                  <td className="px-2 py-2.5"><div className="relative">
                    <input type="number" aria-label={`${d.label} share of gap`} disabled={!l.on} value={l.on ? l.weight : 0} onChange={e => patchL(l.id, { weight: e.target.value === '' ? 0 : +e.target.value })} className={cx(num, 'pr-6')} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-text-3">%</span></div></td>
                  <td className="px-2 py-2.5"><div className="relative">
                    <input type="number" aria-label={`${d.label} limit`} disabled={!l.on} value={l.cap} onChange={e => patchL(l.id, { cap: e.target.value === '' ? 0 : +e.target.value })} className={cx(num, 'pr-8')} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-text-3">{leverHow(l.id) === 'pts' ? 'pts' : '%'}</span></div></td>
                </tr>)
            })}</tbody>
            <tfoot><tr className="bg-surface-2 text-[13px] font-semibold"><td className="px-3 py-2">Total{Math.abs(total - 100) > 0.5 && <span className="ml-1.5 font-normal text-text-3">· split in this proportion</span>}</td>
              <td className="px-2 py-2 text-right font-mono">{total.toFixed(total % 1 ? 1 : 0)}%</td><td /></tr></tfoot>
          </table>
          <p className="mt-2 text-[12px] text-text-3">Only inputs can move. Outputs such as TRx and net revenue follow from them and are never set directly.</p>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
            <div className="w-48"><Period label="Changes start" value={start} min={ACT} max={N - 1} onChange={v => { setStart(v); reset() }} /></div>
            <Btn onClick={run} disabled={!valid} icon={<Target size={15} />}>Run goal seek</Btn>
          </div>
        </Card>

        <Card frame title={`${MEASURE_LABEL[metric]} · ${sel.name}`} info={res ? 'Current path against the path after goal seek.' : 'Run goal seek to see the new path.'} fill>
          <div className="mb-1"><Legend s={chart} /></div>
          <ForecastChart title={`Goal seek · ${MEASURE_LABEL[metric]}`} s={chart} fmt={v => o.fmt(v, 1)} dp={0} unit={o.unit} height={360} canSave={false} toolbar={false} />
          {res && <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-4">
            <span className="mr-auto text-[12.5px] text-text-2">{res.met ? 'Target reached' : 'Target not reachable inside the limits'} · {moves.length} move{moves.length === 1 ? '' : 's'}</span>
            <Btn disabled={applied || !moves.length || sel.locked} onClick={apply} icon={applied ? <Check size={14} /> : undefined}>{applied ? 'Applied' : `Apply to ${sel.name}`}</Btn>
          </div>}
        </Card>
      </div>

      {res && (
        <Card title="What it takes" info="How far each ticked input has to move, and where the target lands.">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3">
              <th className="w-8 py-2 text-left font-semibold" /><th className="py-2 text-left font-semibold">Input</th><th className="py-2 text-right font-semibold">Share of gap</th>
              <th className="py-2 text-right font-semibold">Move</th><th className="py-2 text-right font-semibold">Limit</th></tr></thead>
            <tbody>{res.steps.map(s => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="py-2.5">{s.capped ? <CircleAlert size={15} className="text-warn" /> : Math.abs(s.step) > 1e-6 ? <CircleCheck size={15} className="text-ok" /> : <CircleMinus size={15} className="text-text-3" />}</td>
                <td className="py-2.5 font-medium">{DRV[s.id].label}</td>
                <td className="py-2.5 text-right font-mono">{s.weight}%</td>
                <td className="py-2.5 text-right"><b className="font-mono">{s.step >= 0 ? '+' : '−'}{Math.abs(s.step).toFixed(2)} {leverHow(s.id) === 'pts' ? 'pts' : '%'}</b></td>
                <td className="py-2.5 text-right font-mono text-text-3">{s.capped ? `at limit ${s.cap}` : s.cap}</td>
              </tr>))}</tbody>
          </table>
          <p className="mt-3 text-[12px] text-text-3">{MEASURE_LABEL[metric]} {HORIZON_LABEL(h)} {fmtM(metric, res.before)} → <b className="font-mono text-text">{fmtM(metric, res.after)}</b> against a target of {fmtM(metric, res.target)}. Moves start {mLong(start)}. Applying adds them to {sel.name} as overrides.</p>
        </Card>
      )}
    </div>
  )
}

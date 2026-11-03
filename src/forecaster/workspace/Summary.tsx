import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ScenarioPart } from './Stages'
import { useAgentFocus } from './agent'
import { UE_PRIOR, bridgeOf, fmtB } from './Modules'
import { ChartActions } from '../../chart/ChartActions'
import { ArrowDown, ArrowUp, Check, Info, Lock, Pencil, Plus, Sparkles, X } from 'lucide-react'
import { DRV, FC_YEARS, FY, describeOverride, fmtRev, fmtV, funnelOf, fySum, mLong, revenue, scenarioLayer } from './engine'
import type { DriverId, EventDef, FunnelRow, Layer, ModelCfg, Override, Scenario } from './engine'
import { Btn, COLOR, Label, Seg, Tag, Toggle, cx, field } from './ui'
import type { Notify } from './Drivers'

/* Scenario summary: every scenario as a column with its own funnel, the parameters behind it and the gap to the
   scenario it is compared against. A builder adds a new scenario as a new column. Adapted from the team's
   Velsipity forecaster page and restyled to this workspace. */

type Calc = Record<string, { layer: Layer; rev: number[]; fy: number; events: EventDef[] }>
type SetScenarios = (f: (s: Scenario[]) => Scenario[]) => void

const PAT = ['prev', 'diag', 'treat', 'access', 'share'] as const
const STEP_LABEL: Record<(typeof PAT)[number], string> = { prev: 'Prevalent', diag: 'Diagnosed', treat: 'Treated', access: 'Covered', share: 'On brand' }
/** A scenario's own colour if one was picked in the builder, otherwise the palette by position. */
export const PALETTE = ['#0095ff', '#007a6c', '#c4122f', '#8f5a00', '#a68aff', '#0000c9', '#be185d', '#4d7c0f', '#000067', '#ea580c', '#0891b2', '#9333ea']
const colorOf = (s: Scenario | null, k: number) => s?.color ?? COLOR.alt[k % COLOR.alt.length]!
const fmtN = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K` : `${Math.round(v)}`)
const fmtNDelta = (d: number) => `${d >= 0 ? '+' : '−'}${fmtN(Math.abs(d))}`
const pctTxt = (d: number, b: number) => (b ? ` · ${d >= 0 ? '+' : '−'}${Math.abs((d / b) * 100).toFixed(1)}%` : '')
const near = (d: number, ref: number) => Math.abs(d) <= Math.max(1e-9, Math.abs(ref) * 5e-4)
const tone = (d: number) => (d > 0 ? 'text-ok' : 'text-err')

type Row = FunnelRow
const get = (f: Row[], id: Row['id']) => f.find(r => r.id === id)!
/** The figures shown for a scenario in one year, keyed for the comparison table. */
function figures(f: Row[]) {
  return {
    prev: get(f, 'prev').vol, diag: get(f, 'diag').vol, treat: get(f, 'treat').vol, access: get(f, 'access').vol, share: get(f, 'share').vol,
    trx: get(f, 'trx').vol, price: get(f, 'price').rate!, rev: get(f, 'price').vol,
  }
}
type Figs = ReturnType<typeof figures>

/** Short, one-line description of an override, so every column keeps the same rhythm. Full wording sits in the tooltip. */
function brief(o: Override) {
  const d = DRV[o.driver], u = d.pct ? 'pts' : '%'
  if (o.kind === 'target') return `${d.label} → ${fmtV(o.driver, o.value)} by ${mLong(o.end)}`
  if (o.kind === 'step') return `${d.label} = ${fmtV(o.driver, o.value)} from ${mLong(o.start)}`
  if (o.kind === 'shift') return `${d.label} ${o.value >= 0 ? '+' : '−'}${Math.abs(+o.value.toFixed(2))} ${u} from ${mLong(o.start)}`
  return `${d.label} set by year`
}

function MiniFunnel({ f, base, color, width, label }: { f: Row[]; base: Row[] | null; color: string; width: (v: number) => number; label: string }) {
  return (
    <ol className="space-y-0.5" aria-label={label}>
      {PAT.map((id, i) => {
        const v = get(f, id).vol, w1 = width(v), w2 = i + 1 < PAT.length ? width(get(f, PAT[i + 1]!).vol) : w1 * 0.9
        const b = base ? get(base, id).vol : null, d = b === null ? 0 : v - b
        const rate = get(f, id).rate
        return (
          <li key={id} className="grid grid-cols-[58px_minmax(0,1fr)_12px] items-center gap-1.5" title={`${STEP_LABEL[id]} · ${fmtN(v)} patients${rate !== undefined ? ` · ${fmtV(id as DriverId, rate)} of the step above` : ''}${b !== null && !near(d, v) ? ` · ${fmtNDelta(d)} vs comparison` : ''}`}>
            <span className="truncate text-[11px] text-text-2">{STEP_LABEL[id]}</span>
            <span className="relative flex h-6 items-center justify-center text-[11px] font-semibold text-white"
              style={{ background: color, opacity: 1 - i * 0.1, clipPath: `polygon(${50 - w1 / 2}% 0,${50 + w1 / 2}% 0,${50 + w2 / 2}% 100%,${50 - w2 / 2}% 100%)`, transition: 'clip-path .35s ease' }}>
              <span className="font-mono">{fmtN(v)}</span>
            </span>
            <span aria-hidden className="grid place-items-center">{b !== null && !near(d, v) && (d > 0 ? <ArrowUp size={11} className="text-ok" /> : <ArrowDown size={11} className="text-err" />)}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Tile({ k, v, d, base, sameAs }: { k: string; v: string; d?: string | null; base?: boolean; sameAs?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 px-2 py-1.5">
      <p className="truncate text-[10.5px] text-text-3">{k}</p>
      <p className="truncate font-mono text-[12.5px] font-semibold">{v}</p>
      <p className={cx('truncate text-[10.5px]', d ? (d.startsWith('+') ? 'text-ok' : 'text-err') : 'text-text-3')}>{base ? 'comparison' : sameAs || !d ? 'same' : d}</p>
    </div>
  )
}

export function ScenarioSummary({ scenarios, setScenarios, calc, events, selId, setSelId, model, notify, renderPart, uePct = UE_PRIOR, woh }: {
  scenarios: Scenario[]; setScenarios: SetScenarios; calc: Calc; events: EventDef[]; selId: string; setSelId: (id: string) => void
  model: ModelCfg; notify: Notify; renderPart: (p: ScenarioPart) => ReactNode; uePct?: number; woh?: number
}) {
  const [editing, setEditing] = useState(false)
  const [hovStep, setHovStep] = useState<string | null>(null)
  const openEdit = (id: string) => { setSelId(id); setEditing(true) }
  // When the assistant edits a scenario, open the editor so its changes are visible.
  const agentFocus = useAgentFocus()
  useEffect(() => { if (agentFocus.section === 'scenarios') setEditing(true) }, [agentFocus.section])
  useEffect(() => { if (!editing) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [editing])
  const [year, setYear] = useState(FY)
  const [baseId, setBaseId] = useState(() => scenarios.find(s => s.name === 'Base Case')?.id ?? scenarios[0]!.id)
  const [fresh, setFresh] = useState<string | null>(null)
  const cards = useRef<Record<string, HTMLElement | null>>({})
  const base = scenarios.find(s => s.id === baseId) ?? scenarios[0]!
  const work = calc.__working!.layer
  const fun = useMemo(() => Object.fromEntries(scenarios.map(s => [s.id, funnelOf(calc[s.id]!.layer, year)])), [scenarios, calc, year])
  const figs = useMemo(() => Object.fromEntries(scenarios.map(s => [s.id, figures(fun[s.id]!)])) as Record<string, Figs>, [scenarios, fun])
  // One log scale across every column, so the same width means the same number of patients.
  const all = scenarios.flatMap(s => PAT.map(id => Math.max(1, get(fun[s.id]!, id).vol)))
  const lmin = Math.log10(Math.min(...all)), lmax = Math.log10(Math.max(...all))
  const width = (v: number) => 34 + 66 * ((Math.log10(Math.max(1, v)) - lmin) / Math.max(1e-9, lmax - lmin))
  // What each switched-on event adds to this year's net revenue in that scenario.
  const evImpact = (s: Scenario, e: EventDef) => fySum(calc[s.id]!.rev, year) - fySum(revenue(scenarioLayer(work, { ...s, active: s.active.filter(x => x !== e.id) }, events)), year)

  useEffect(() => {
    if (!fresh) return
    cards.current[fresh]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    const t = window.setTimeout(() => setFresh(null), 2600)
    return () => window.clearTimeout(t)
  }, [fresh])

  const add = (s: Scenario) => {
    setScenarios(ss => [...ss, s]); setSelId(s.id); setFresh(s.id)
    notify({ tone: 'ok', text: `${s.name} added to the summary as a new column. Edit it to add overrides or finalise.` })
  }
  const b = figs[base.id]!
  const fmtF = (id: keyof Figs, v: number) => (id === 'rev' ? fmtRev(v, 1) : id === 'price' ? fmtV('price', v) : fmtN(v))
  const fmtD = (id: keyof Figs, d: number, b0: number) => (id === 'rev' ? `${d >= 0 ? '+' : '−'}$${Math.abs(d).toFixed(1)}M` : id === 'price' ? `${d >= 0 ? '+' : '−'}$${Math.abs(d).toFixed(2)}` : fmtNDelta(d)) + (id === 'price' ? '' : pctTxt(d, b0))

  const n = scenarios.length
  const cols = { gridTemplateColumns: `210px repeat(${n}, minmax(220px, 1fr))` }
  const lab = 'sticky left-0 z-10 border-r border-t border-r-border-strong border-t-border bg-[#f4f5f9] px-4'
  const col = (s: Scenario) => cx('border-l border-t border-border px-3 text-center', s.id === base.id && 'bg-brand-soft/25', fresh === s.id && 'bg-brand-soft/50')
  const rowLabel = (name: string, tip: string, strong?: boolean) => (
    <div className={cx(lab, 'flex items-center gap-1.5 py-2.5')}><span className={cx('text-[13px]', strong ? 'font-semibold' : 'font-medium')}>{name}</span><InfoTip text={tip} /></div>
  )
  const grp = (t: string) => (
    <>
      <div className={cx(lab, 'border-t bg-surface-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-3')}>{t}</div>
      {scenarios.map(s => <div key={s.id} className="border-t border-border bg-surface-2" />)}
    </>
  )
  const stat = (id: keyof Figs, name: string, tip: string) => (
    <>
      {rowLabel(name, tip, id === 'rev')}
      {scenarios.map(s => { const v = figs[s.id]![id], b0 = b[id], d = v - b0, isB = s.id === base.id; return (
        <div key={s.id} className={cx(col(s), 'flex flex-col items-center justify-center py-2')}>
          <span className={cx('font-mono text-[13px]', (isB || id === 'rev') && 'font-semibold')}>{fmtF(id, v)}</span>
          <span className={cx('font-mono text-[11px]', isB || near(d, v) ? 'text-text-3' : tone(d))}>{isB ? 'comparison' : near(d, v) ? 'same' : fmtD(id, d, b0)}</span>
        </div>) })}
    </>
  )
  // Revenue bridge rows from the default modules, worked back from each scenario's net revenue.
  const bridgeRow = (k: 'gross' | 'tud' | 'inv' | 'ueD', name: string, tip: string) => (
    <>
      {rowLabel(name, tip)}
      {scenarios.map(s => { const v = bridgeOf(figs[s.id]!.rev, uePct, woh)[k], b0 = bridgeOf(b.rev, uePct, woh)[k], d = v - b0, isB = s.id === base.id; return (
        <div key={s.id} className={cx(col(s), 'flex flex-col items-center justify-center py-2')}>
          <span className={cx('font-mono text-[13px]', isB && 'font-semibold')}>{v < 0 ? '−' : ''}{fmtB(Math.abs(v))}</span>
          <span className={cx('font-mono text-[11px]', isB || near(d, v) ? 'text-text-3' : tone(d))}>{isB ? 'comparison' : near(d, v) ? 'same' : `${d >= 0 ? '+' : '−'}$${Math.abs(d).toFixed(1)}M`}</span>
        </div>) })}
    </>
  )
  const TIPS: Record<(typeof PAT)[number], string> = {
    prev: 'People with the condition. The starting population.',
    diag: 'Prevalent patients with a confirmed diagnosis. Year average.',
    treat: 'Diagnosed patients on a prescription treatment. Year average.',
    access: 'Treated patients whose payer coverage allows the brand. Year average.',
    share: 'Covered patients on the brand. Year average.',
  }
  const stepLabel = (i: number) => { const id = PAT[i]!; return (
    <div className={cx(lab, 'flex h-11 items-center gap-1.5', i > 0 && '[border-top-style:dashed]')}>
      <span className="text-[13px] font-medium">{STEP_LABEL[id]}</span><InfoTip text={TIPS[id]} />
    </div>) }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Tag tone="brand">Scenario summary</Tag><h2 className="mt-2 text-[22px] font-semibold tracking-tight">All scenarios side by side</h2>
          <p className="mt-0.5 text-sm text-text-2">Every scenario’s funnel and figures, compared against <b className="font-semibold text-text">{base.name}</b>.</p></div>
        <div className="flex flex-wrap items-center gap-2">
            <Seg label="Year" value={String(year)} onChange={v => setYear(+v)} options={FC_YEARS.map(y => ({ id: String(y), label: `FY${y}` }))} />
            <select aria-label="Compare against" title="Scenario the others are compared against" value={base.id} onChange={e => setBaseId(e.target.value)} className={cx(field, 'h-8 w-auto max-w-[170px] pr-7 text-[13px]')}>{scenarios.map(s => <option key={s.id} value={s.id}>vs {s.name}</option>)}</select>
            <ChartActions target="export-scenario-comparison" title="Scenario summary" subtitle={`FY${year} · compared against ${base.name}`} />
        </div>
      </div>


      <section data-tour="summary" className="overflow-x-auto rounded-lg border border-border bg-surface" aria-label={`Scenario comparison, FY${year}`}>
        <div id="export-scenario-comparison" className="grid min-w-max bg-surface" style={cols}>
          <div className={cx(lab, 'flex items-end py-3 text-[11px] font-semibold uppercase tracking-wide text-text-3')}>FY{year} · {n} scenarios</div>
          {scenarios.map((s, k) => {
            const x = figs[s.id]!, isBase = s.id === base.id, gap = x.rev - b.rev, c = colorOf(s, k)
            const ovN = (s.ovr?.length ?? 0) + Object.values(s.adj).filter(Boolean).length
            return (
              <div key={s.id} ref={el => { cards.current[s.id] = el }} className={cx(col(s), 'relative flex flex-col items-center pb-3 pt-4')}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c }} />
                <div className="flex max-w-full items-center justify-center gap-1">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                  <span title={s.name} className={cx('min-w-0 truncate text-[13.5px] font-semibold', s.id === selId && 'text-brand')}>{s.name}</span>
                  {s.locked && <Lock size={11} className="shrink-0 text-ok" aria-label="Final" />}
                  <button type="button" onClick={() => openEdit(s.id)} aria-label={`Edit ${s.name}`} title="Edit scenario" className="grid h-6 w-6 shrink-0 place-items-center rounded text-text-3 hover:bg-surface-2 hover:text-brand"><Pencil size={12} /></button>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                  {isBase ? <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-brand">Comparison</span>
                    : near(gap, x.rev) ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-text-2">Same net revenue</span>
                    : <span className={cx('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-semibold', gap > 0 ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err')}>{gap > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{fmtD('rev', gap, b.rev)}</span>}
                  <span className="text-[10.5px] text-text-3">{s.active.length} event{s.active.length === 1 ? '' : 's'} · {ovN} change{ovN === 1 ? '' : 's'}</span>
                </div>
              </div>
            )
          })}

          {grp('Patient pool · funnel')}
          {/* Funnel: one continuous shape per scenario, spanning all five steps. Hover a step for its detail. */}
          {stepLabel(0)}
          {scenarios.map((s, k) => {
            const f = fun[s.id]!, isB = s.id === base.id
            return (
              <div key={s.id} className={cx(col(s), 'relative')} style={{ gridRow: 'span 5' }}>
                {PAT.map((id, i) => {
                  const v = get(f, id).vol, w1 = width(v), w2 = i + 1 < PAT.length ? width(get(f, PAT[i + 1]!).vol) : w1 * 0.88
                  const rate = get(f, id).rate, d = v - get(fun[base.id]!, id).vol, key = `${s.id}:${id}`, on = hovStep === key, dim = !!hovStep?.startsWith(`${s.id}:`) && !on
                  return (
                    <div key={id} className={cx('relative h-11', i > 0 && 'border-t border-dashed border-border')} onMouseEnter={() => setHovStep(key)} onMouseLeave={() => setHovStep(null)}>
                      <span className="flex h-full items-center justify-center text-[11.5px] font-semibold text-white transition-[opacity,filter] duration-150"
                        style={{ background: colorOf(s, k), opacity: dim ? 0.35 : 1 - i * 0.1, filter: on ? 'brightness(1.12)' : undefined, clipPath: `polygon(${50 - w1 / 2}% 0,${50 + w1 / 2}% 0,${50 + w2 / 2}% 100%,${50 - w2 / 2}% 100%)`, transition: 'clip-path .35s ease' }}>
                        <span className="font-mono">{fmtN(v)}</span>
                      </span>
                      {on && <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-44 -translate-x-1/2 rounded-md bg-text px-2.5 py-1.5 text-left text-[11.5px] leading-snug text-white shadow-lg">
                        <b className="block">{STEP_LABEL[id]} · {fmtN(v)}</b>
                        {rate !== undefined && <span className="block text-white/75">{fmtV(id as DriverId, rate)} of the step above</span>}
                        {!isB && <span className={cx('block font-mono', near(d, v) ? 'text-white/60' : d > 0 ? 'text-[#68d1ff]' : 'text-[#fda4af]')}>{near(d, v) ? 'Same as comparison' : `${fmtNDelta(d)} vs ${base.name}`}</span>}
                      </span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {PAT.slice(1).map((_, i) => <Fragment key={i}>{stepLabel(i + 1)}</Fragment>)}

          {grp('Volume and sales')}
          {stat('share', 'Patients on brand', 'Average month across the year.')}
          {stat('trx', 'TRx', 'Prescriptions, total for the year.')}
          {stat('price', 'Weighted gross price', 'Per pack, before gross-to-net. Year average.')}
          {stat('rev', 'Net revenue', 'Total for the year, $M.')}
          {grp('Revenue bridge · default modules')}
          {bridgeRow('tud', 'Total underlying demand', 'Calculated demand dollars. Change it upstream.')}
          {bridgeRow('inv', 'Δ Inventory', 'Wholesaler on-hand move at target weeks on hand.')}
          {bridgeRow('ueD', 'Unexplained difference', `Forecast at ${uePct.toFixed(1)}% of gross.`)}
          {bridgeRow('gross', 'Gross sales', 'TUD + Δ inventory + unexplained.')}

          {grp('What was changed')}
          {rowLabel('Changes', 'Adjustments, overrides and events switched on.')}
          {scenarios.map(s => {
            const evs = events.filter(e => s.active.includes(e.id)), adj = (Object.entries(s.adj) as [DriverId, number][]).filter(([, v]) => v), ovr = s.ovr ?? []
            return (
              <div key={s.id} className={cx(col(s), 'py-2.5')}>
                {adj.length + ovr.length + evs.length ? (
                  <ul className="flex flex-col items-center gap-1 text-[11.5px]">
                    {adj.map(([id, v]) => <li key={`a-${id}`} className="inline-flex max-w-full items-center gap-1.5"><span className="shrink-0 rounded bg-brand-soft px-1 text-[9.5px] font-semibold uppercase text-brand">adj</span><span className="truncate">{DRV[id].label} {v >= 0 ? '+' : '−'}{Math.abs(v)} {DRV[id].pct ? 'pts' : '%'}</span></li>)}
                    {ovr.map(o => <li key={o.id} className="inline-flex max-w-full items-center gap-1.5" title={describeOverride(o)}><span className="shrink-0 rounded bg-brand-soft px-1 text-[9.5px] font-semibold uppercase text-brand">ovr</span><span className="truncate">{brief(o)}</span></li>)}
                    {evs.map(e => { const d = evImpact(s, e); return <li key={e.id} className="inline-flex max-w-full items-center gap-1.5" title={`${e.name} · ${mLong(e.date)} · ${e.prob}% likely`}><span className="shrink-0 rounded bg-surface-2 px-1 text-[9.5px] font-semibold uppercase text-text-2">event</span><span className="truncate">{e.name}</span>{Math.abs(d) > 0.05 && <span className={cx('shrink-0 font-mono text-[10.5px]', tone(d))}>{d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}M</span>}</li> })}
                  </ul>
                ) : <p className="text-[11.5px] text-text-3">Follows the active forecast</p>}
              </div>
            )
          })}
        </div>
      </section>

      {editing && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center bg-text/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-sc-title" onClick={() => setEditing(false)}>
          <div className="rise flex h-[min(92dvh,940px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3.5">
              <div><h2 id="edit-sc-title" className="text-[17px] font-semibold">Edit scenario</h2></div>
              <div className="flex items-center gap-2"><Btn onClick={() => setEditing(false)}>Done</Btn><Btn variant="ghost" onClick={() => setEditing(false)} icon={<X size={16} />} title="Close" /></div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{renderPart('editor')}</div>
          </div>
        </div>, document.body)}
    </div>
  )
}

/** Small info icon; the description shows on hover or keyboard focus. */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={text} className="grid h-4 w-4 place-items-center rounded-full text-text-3 outline-none hover:text-brand focus-visible:text-brand"><Info size={13} /></button>
      <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 w-52 -translate-y-1/2 rounded-md bg-text px-2.5 py-1.5 text-[11.5px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">{text}</span>
    </span>
  )
}

/* ───────── Scenario builder ───────── */
export function ScenarioBuilder({ scenarios, calc, events, model, year, base, onAdd, onClose }: {
  scenarios: Scenario[]; calc: Calc; events: EventDef[]; model: ModelCfg; year: number; base: Scenario; onAdd: (s: Scenario) => void; onClose: () => void
}) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const work = calc.__working!.layer
  const [name, setName] = useState(`Scenario ${scenarios.length + 1}`)
  const [desc, setDesc] = useState('')
  const [stream, setStream] = useState('all')
  const [horizon, setHorizon] = useState('carry')
  const [from, setFrom] = useState('active')
  const src = scenarios.find(s => s.id === from)
  const [active, setActive] = useState<string[]>([])
  const [adj, setAdj] = useState<Partial<Record<DriverId, number>>>({})
  const used = new Set(scenarios.map((s, k) => colorOf(s, k).toLowerCase()))
  const [color, setColor] = useState(() => PALETTE.find(c => !used.has(c.toLowerCase())) ?? PALETTE[0]!)
  const pickFrom = (id: string) => { const s = scenarios.find(x => x.id === id); setFrom(id); setActive(s ? [...s.active] : []); setAdj(s ? { ...s.adj } : {}); if (s && /^Scenario \d+$/.test(name)) setName(`${s.name} (variant)`) }
  const draft: Scenario = { id: `sc${Date.now()}`, name: name.trim(), color, active, adj, locked: false, ovr: src?.ovr?.map(o => ({ ...o, id: `${o.id}-c${Date.now()}` })) ?? [] }
  const layer = useMemo(() => scenarioLayer(work, draft, events), [work, active, adj, from, events]) // eslint-disable-line react-hooks/exhaustive-deps
  const f = funnelOf(layer, year), x = figures(f), bx = figures(funnelOf(calc[base.id]!.layer, year))
  const gap = x.rev - bx.rev
  const taken = scenarios.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase())
  const editable = model.modules.filter(m => m.editable).map(m => DRV[m.id])
  const width = (v: number) => 34 + 66 * ((Math.log10(Math.max(1, v)) - Math.log10(Math.max(1, x.share))) / Math.max(1e-9, Math.log10(x.prev) - Math.log10(Math.max(1, x.share))))
  const sec = (n: number, t: string, sub: string) => <div className="mb-2.5 flex items-start gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11.5px] font-semibold text-white">{n}</span><div><p className="text-[14px] font-semibold">{t}</p><p className="text-[12px] text-text-2">{sub}</p></div></div>

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-text/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="sb-title" className="relative flex h-full w-full max-w-[880px] flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand"><Sparkles size={12} />Scenario builder</p>
            <h3 id="sb-title" className="mt-0.5 text-[18px] font-semibold">Build a new scenario</h3></div>
          <Btn variant="ghost" onClick={onClose} icon={<X size={16} />} title="Close" />
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
            <section>{sec(1, 'Name and starting point', 'Start from the active forecast or copy a scenario.')}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><Label className="mb-1">Scenario name</Label><input autoFocus value={name} onChange={e => setName(e.target.value)} onFocus={e => e.target.select()} className={cx(field, taken && 'border-err')} />
                  {taken && <span className="mt-1 block text-[12px] text-err">A scenario with this name already exists.</span>}</label>
                <label className="block"><Label className="mb-1">Start from</Label>
                  <select value={from} onChange={e => pickFrom(e.target.value)} className={field}><option value="active">Active forecast</option>{scenarios.map(s => <option key={s.id} value={s.id}>Copy of {s.name}</option>)}</select></label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block"><Label className="mb-1">Target stream</Label>
                  <select value={stream} onChange={e => setStream(e.target.value)} className={field}>
                    <option value="all">All revenue streams (Model total)</option>
                    <option value="main">Primary stream · US net revenue</option>
                    <option value="sub">Specialty & hospital channel</option>
                  </select></label>
                <label className="block"><Label className="mb-1">Effective horizon</Label>
                  <select value={horizon} onChange={e => setHorizon(e.target.value)} className={field}>
                    <option value="carry">FY27 onwards (carry forward)</option>
                    <option value="fy27">FY27 only</option>
                    <option value="fy28">FY28 only</option>
                    <option value="phased">FY27–FY29 phased change</option>
                  </select></label>
              </div>
              <label className="mt-3 block"><Label className="mb-1" hint="optional">Description / rationale</Label>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Higher diagnosis rate from new treatment guidelines" className={field} /></label>
              <div className="mt-3"><Label className="mb-1.5">Colour</Label>
                <div role="radiogroup" aria-label="Scenario colour" className="flex flex-wrap gap-2">
                  {PALETTE.map(c => { const taken_ = used.has(c.toLowerCase()); return (
                    <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`${c}${taken_ ? ', already used' : ''}`} title={taken_ ? 'Already used by another scenario' : undefined} onClick={() => setColor(c)}
                      className={cx('relative grid h-7 w-7 place-items-center rounded-full ring-offset-2 transition-shadow', color === c ? 'ring-2 ring-text' : 'hover:ring-2 hover:ring-border-strong', taken_ && color !== c && 'opacity-40')} style={{ background: c }}>
                      {color === c && <Check size={13} className="text-white" />}</button>) })}
                </div>
                {used.has(color.toLowerCase()) && <p className="mt-1 text-[12px] text-warn">Another scenario already uses this colour, which may be confusing in comparisons.</p>}</div>
              {src && (src.ovr?.length ?? 0) > 0 && <p className="mt-2 text-[12px] text-text-3">Includes {src.ovr!.length} override{src.ovr!.length === 1 ? '' : 's'} from {src.name}. Edit them later under Edit scenario.</p>}
            </section>

            <section>{sec(2, 'Events', 'Switch on the events this scenario assumes.')}
              <ul className="divide-y divide-border rounded-md border border-border">
                {events.map(e => {
                  const on = active.includes(e.id)
                  return (
                    <li key={e.id} className={cx('flex items-center gap-3 px-3 py-2.5', on && 'bg-brand-soft/30')}>
                      <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{e.name}</p>
                        <p className="text-[12px] text-text-3">{mLong(e.date)} · {e.prob}% likely · {e.impacts.map(i => `${DRV[i.metric].label} ${i.dir === 'up' ? '+' : '−'}${i.mag}%`).join(', ')}</p></div>
                      <Toggle on={on} onChange={v => setActive(a => v ? [...a, e.id] : a.filter(z => z !== e.id))} label={`${e.name} in this scenario`} />
                    </li>
                  )
                })}
                {!events.length && <li className="px-3 py-4 text-center text-[13px] text-text-3">No events in the library yet.</li>}
              </ul>
            </section>

            <section>{sec(3, 'Assumption adjustments', 'Adjust assumptions for the whole period. 0 keeps the forecast.')}
              <ul className="space-y-2">
                {editable.map(d => {
                  const v = adj[d.id] ?? 0
                  return (
                    <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_120px_92px] items-center gap-3 rounded-md border border-border px-3 py-2">
                      <div className="min-w-0"><p className="text-[13px] font-medium">{d.label}</p><p className="text-[11.5px] text-text-3">FY{year} {fmtV(d.id, get(f, d.id).rate!)}</p></div>
                      <div className="relative"><input type="number" step={d.pct ? 0.1 : 0.5} aria-label={`${d.label} adjustment`} value={v} onChange={e => setAdj(a => ({ ...a, [d.id]: e.target.value === '' ? 0 : +e.target.value }))} className={cx(field, 'pr-10 font-mono', v !== 0 && 'border-brand bg-brand-soft/50')} /><span className="pointer-events-none absolute right-2.5 top-2 text-[12px] text-text-3">{d.pct ? 'pts' : '%'}</span></div>
                      {v !== 0 ? <button type="button" onClick={() => setAdj(a => { const n = { ...a }; delete n[d.id]; return n })} className="justify-self-end text-[12px] font-semibold text-text-2 hover:text-brand">Reset</button> : <span className="justify-self-end text-[11.5px] text-text-3">Inherited</span>}
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border bg-background px-5 py-5 md:border-l md:border-t-0" aria-label="Preview">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Preview · FY{year} net revenue</p>
              <p className="mt-0.5 font-mono text-[24px] font-semibold tracking-tight">{fmtRev(x.rev, 1)}</p>
              <p className={cx('text-[12.5px] font-medium', near(gap, x.rev) ? 'text-text-3' : tone(gap))}>{near(gap, x.rev) ? `Same as ${base.name}` : `${gap >= 0 ? '+' : '−'}$${Math.abs(gap).toFixed(1)}M${pctTxt(gap, bx.rev)} vs ${base.name}`}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface shadow-card p-3" style={{ borderTopWidth: 3, borderTopColor: color }}>
              <p className="mb-2 truncate text-[13px] font-semibold">{name.trim() || 'New scenario'}</p>
              <MiniFunnel f={f} base={funnelOf(calc[base.id]!.layer, year)} color={color} width={width} label="Preview funnel" />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Tile k="TRx" v={fmtN(x.trx)} d={fmtNDelta(x.trx - bx.trx)} sameAs={near(x.trx - bx.trx, x.trx)} />
                <Tile k="Gross price" v={fmtV('price', x.price)} d={`${x.price - bx.price >= 0 ? '+' : '−'}$${Math.abs(x.price - bx.price).toFixed(2)}`} sameAs={near(x.price - bx.price, x.price)} />
              </div>
            </div>
            <ul className="space-y-1 text-[12px] text-text-2">
              <li className="flex items-center gap-1.5"><Check size={12} className="text-ok" />{active.length} event{active.length === 1 ? '' : 's'} on</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-ok" />{Object.values(adj).filter(Boolean).length} assumption adjustment{Object.values(adj).filter(Boolean).length === 1 ? '' : 's'}</li>
            </ul>
          </aside>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border bg-surface px-6 py-3">
          <p className="mr-auto text-[12px] text-text-3">Add overrides later in Edit scenario.</p>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!name.trim() || taken} onClick={() => onAdd(draft)} icon={<Plus size={15} />}>Add to summary</Btn>
        </footer>
      </aside>
    </div>
  )
}


import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ACT, DRIVERS, DRV, FY, MONTHS, N, bridge, defaultEdit, describeOverride, fmtDelta, fmtRev, fmtV, fySum, idxOf, measure, revenue, scaled, scenarioLayer, workingLayer } from './engine'
import type { DriverId, Edit, EventDef, Override, Scenario } from './engine'

/* Charles in the forecast workspace: a scripted base-case build plus bounded edits on request.
   Every change goes through the same edits / events / scenarios state the forecaster uses, so it
   shows on the page, can be saved or undone, and never finalises anything. */

export type DemoRun = { i: number; done: boolean } | null
export type AgentFocus = { section: string | null; field: string | null; name: string }
export const AgentFocusCtx = createContext<AgentFocus>({ section: null, field: null, name: 'Charles' })
export const useAgentFocus = () => useContext(AgentFocusCtx)

/** What the workspace hands the app-level Charles panel. */
export type CopilotProps = {
  busy: boolean; greeting: string; context: string[]; chips: string[]
  respond: (q: string) => { title: string; body: string }
  demo: { title: string; prompt: string; steps: string[]; demo: DemoRun; onRun: () => void; onStop: () => void; onReview: () => void; reviewLabel: string; note: string }
}

export type AgentStatus = { running: boolean; title: string; body: string; step?: string; progress?: [number, number]; before?: number; after?: number }
type Edits = Partial<Record<DriverId, Edit>>
type State = { edits: Edits; events: EventDef[]; scenarios: Scenario[]; selId: string }
export type AgentView = 'Assumptions' | 'Scenarios' | 'Events' | 'Sensitivity' | 'Goal seek' | 'Summary' | 'Review'
type Wait = (ms: number) => Promise<void>
/** One step of a chat request: what it is, where it shows, and how to animate it. */
type Action = { label: string; view: AgentView; section: string; field: string | null; run: (wait: Wait) => Promise<void> }

const COMP_ID = 'ev-charles-comp'
const STEPS = ['Read the brief and the reference baseline', 'Share: 11.5% by Dec 2027 on an S-curve', 'Access: 90% by Dec 2027', 'Gross price: 3% annual growth', 'Event: competitor CGRP launch, Apr 2027', 'Base Case: switch the new event on', 'Hand over for your review']

/** FY revenue for one scenario, computed with the same engine path as the workspace. */
export function fyFor(st: State, id = st.selId) {
  const s = st.scenarios.find(x => x.id === id) ?? st.scenarios[0]!
  return fySum(revenue(scenarioLayer(workingLayer(st.edits), s, st.events)))
}

export function useForecastAgent({ name, brand, state, set, show, blocked, editable }: {
  name: string; brand: string; state: State
  /** Drivers the CoE exposed for override; everything else is off limits. */
  editable: DriverId[]
  /** True while the forecaster has an unapplied assumption draft; Charles waits rather than discard it. */
  blocked: () => boolean
  set: { edits: (f: (e: Edits) => Edits) => void; events: (f: (e: EventDef[]) => EventDef[]) => void; scenarios: (f: (s: Scenario[]) => Scenario[]) => void; selId: (id: string) => void; sel: (id: DriverId) => void }
  /** Switch view without the unapplied-changes prompt; the agent owns the change. */
  show: (v: AgentView) => void
}) {
  const [focus, setFocus] = useState<{ section: string | null; field: string | null }>({ section: null, field: null })
  const [demo, setDemo] = useState<DemoRun>(null)
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [undo, setUndo] = useState<State | null>(null)
  const st = useRef(state); st.current = state
  const run = useRef(0)
  useEffect(() => () => { run.current++ }, [])

  const scName = (id: string) => st.current.scenarios.find(s => s.id === id)?.name ?? 'Base Case'
  const baseId = () => st.current.scenarios.find(s => s.name === 'Base Case')?.id ?? st.current.selId
  const editOf = (id: DriverId, e: Edits = st.current.edits): Edit => e[id] ?? defaultEdit(id)
  const mLongOf = (i: number) => `${MONTHS[i % 12]} ${2025 + Math.floor(i / 12)}`
  const valueAt = (id: DriverId) => workingLayer(st.current.edits)[id][idxOf(FY, 11)]!

  const start = () => {
    const id = ++run.current
    const wait = (ms: number) => new Promise<void>((ok, no) => setTimeout(() => run.current === id ? ok() : no(new Error('cancelled')), ms))
    return wait
  }
  /** Animate one driver field from its current value to the target so the numbers visibly move. */
  const tween = async (wait: (ms: number) => Promise<void>, id: DriverId, key: 'target' | 'growth', to: number, base: Partial<Edit>) => {
    const cur = editOf(id), from = cur.method === base.method ? cur[key] : key === 'target' ? +valueAt(id).toFixed(DRV[id].dp) : 0
    const dp = key === 'growth' ? 1 : DRV[id].dp
    for (let k = 1; k <= 16; k++) {
      const v = +(from + (to - from) * (k / 16)).toFixed(dp)
      set.edits(e => ({ ...e, [id]: { ...editOf(id, e), ...base, [key]: v } }))
      await wait(55)
    }
  }
  const stop = () => { run.current++; setFocus({ section: null, field: null }); setDemo(null); setStatus(null) }

  const BLOCKED = { title: 'Apply or discard your draft first', body: `You have an unapplied change to an assumption. Apply or discard it, then ask again so I don't overwrite your work.` }
  const runDemo = async () => {
    if (blocked()) { setStatus({ running: false, ...BLOCKED }); return }
    const wait = start()
    const snap = st.current, before = fyFor(snap, baseId())
    setUndo(snap)
    const step = (i: number, section: string | null, field: string | null = null) => {
      setDemo({ i, done: false }); setFocus({ section, field })
      setStatus({ running: true, title: `${name} is building the ${scName(baseId())}`, step: STEPS[i], progress: [i, STEPS.length], body: `Step ${i + 1} of ${STEPS.length}. Watch the assumptions and revenue update. Stop at any point and keep what has been changed.` })
    }
    const note = (id: DriverId, text: string) => set.edits(e => ({ ...e, [id]: { ...editOf(id, e), notes: text } }))
    try {
      step(0, null); show('Assumptions'); await wait(1300)
      show('Assumptions')
      const plan: [number, DriverId, 'target' | 'growth', number, Partial<Edit>, string][] = [
        [1, 'share', 'target', 11.5, { method: 'target', curve: 's', start: ACT, end: idxOf(FY, 11), hold: true }, 'brief asks for 11.5% exit share; S-curve matches the last two launches.'],
        [2, 'access', 'target', 90, { method: 'target', curve: 'linear', start: ACT, end: idxOf(FY, 11), hold: true }, '90% coverage assumes the Part D wins hold through 2027.'],
        [3, 'price', 'growth', 3, { method: 'growth', start: ACT, end: idxOf(2028, 11), hold: true }, '3% gross price growth, in line with the pricing committee guidance.'],
      ]
      for (const [i, id, key, to, base, why] of plan) {
        step(i, 'assume', key)
        if (!editable.includes(id)) { await wait(900); continue } // CoE-locked for this model: leave it alone
        set.sel(id); await wait(800)
        await tween(wait, id, key, to, base)
        note(id, `${name}: ${why}`); await wait(700)
      }
      step(4, 'events', COMP_ID); show('Events'); await wait(800)
      const ev: EventDef = { id: COMP_ID, name: '', type: 'Market Event', date: idxOf(FY, 3), prob: 0, notes: `Added by ${name}: analog from the last oral CGRP entrant. Check the probability against competitive intelligence.`, impacts: [{ metric: 'share', dir: 'down', mag: 6, curve: 'ramp', duration: null }] }
      set.events(es => [...es.filter(e => e.id !== COMP_ID), ev])
      const title = 'Competitor CGRP launch'
      for (let k = 1; k <= title.length; k++) { const v = title.slice(0, k); set.events(es => es.map(e => e.id === COMP_ID ? { ...e, name: v } : e)); await wait(35) }
      for (let p = 5; p <= 60; p += 5) { set.events(es => es.map(e => e.id === COMP_ID ? { ...e, prob: p } : e)); await wait(70) }
      await wait(600)
      step(5, 'scenarios', COMP_ID); const bid = baseId(); set.selId(bid); show('Scenarios'); await wait(900)
      const locked = st.current.scenarios.find(s => s.id === bid)?.locked
      if (!locked) set.scenarios(ss => ss.map(s => s.id === bid && !s.active.includes(COMP_ID) ? { ...s, active: [...s.active, COMP_ID] } : s))
      await wait(1100)
      step(6, null); await wait(500)
      show('Review'); setFocus({ section: null, field: null })
      const after = fyFor(st.current, bid)
      setDemo({ i: STEPS.length, done: true })
      setStatus({ running: false, title: `${name} built the ${scName(bid)}: FY${FY} ${fmtRev(before)} → ${fmtRev(after)}`, before, after,
        body: `Share, access and price assumptions are set, a competitor event is added${locked ? '' : ` and switched on in ${scName(bid)}`}. Check each change, edit anything, then save and finalise yourself. Nothing is finalised for you.` })
    } catch { setFocus({ section: null, field: null }) }
  }

  /** One bounded change asked for in chat: animate it, then report revenue before and after. */
  const apply = async (label: string, view: AgentView, steps: ((wait: (ms: number) => Promise<void>) => Promise<void>)[], section: string, field: string | null) => {
    const wait = start()
    const snap = st.current, bid = st.current.selId, before = fyFor(snap, bid)
    setUndo(snap); setDemo(d => d && d.done ? d : null)
    setFocus({ section, field }); show(view)
    setStatus({ running: true, title: `${name} is updating the forecast`, step: label, body: 'Watch the value and revenue change on the page.' })
    try {
      await wait(500)
      for (const s of steps) await s(wait)
      await wait(400)
      const after = fyFor(st.current, bid)
      setFocus({ section: null, field: null })
      setStatus({ running: false, title: `${label}: FY${FY} ${scName(bid)} ${fmtRev(before)} → ${fmtRev(after)}`, before, after, body: `${fmtDelta(after - before)} on ${scName(bid)}. Review the change, keep editing, or undo it. Saving and finalising stay with you.` })
    } catch { setFocus({ section: null, field: null }) }
  }

  /** Several requested changes in one message, run in order with progress so each one is visible. One undo covers all. */
  const applyPlan = async (acts: Action[]) => {
    const wait = start()
    const snap = st.current, bid = st.current.selId, before = fyFor(snap, bid)
    setUndo(snap); setDemo(d => d && d.done ? d : null)
    try {
      for (const [k, a] of acts.entries()) {
        setFocus({ section: a.section, field: a.field }); show(a.view)
        setStatus({ running: true, title: `${name} is working through ${acts.length} steps`, step: a.label, progress: [k, acts.length], body: `Step ${k + 1} of ${acts.length}. Stop at any point; finished steps stay and one undo reverts them all.` })
        await wait(700); await a.run(wait); await wait(500)
      }
      const after = fyFor(st.current, bid)
      setFocus({ section: null, field: null })
      setStatus({ running: false, title: `${acts.length} steps done: FY${FY} ${scName(bid)} ${fmtRev(before)} → ${fmtRev(after)}`, before, after, body: `${acts.map((a, k) => `${k + 1}. ${a.label}`).join(' · ')}. Review each change, keep editing, or undo all. Saving and finalising stay with you.` })
    } catch { setFocus({ section: null, field: null }) }
  }

  const drvOf = (t: string): DriverId | null => /share/.test(t) ? 'share' : /diagnos/.test(t) ? 'diag' : /treat/.test(t) ? 'treat' : /access|coverage/.test(t) ? 'access' : /price|wac/.test(t) ? 'price' : null
  /** "by Dec 2028", "from May 2027", "next year" → month index. */
  const dateOf = (t: string): { kind: 'by' | 'from'; i: number } | null => {
    const m = t.match(/\b(by|from|starting|in)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d\d)/)
    if (m) return { kind: m[1] === 'by' ? 'by' : 'from', i: Math.max(ACT, Math.min(N - 1, idxOf(+m[3]!, MONTHS.findIndex(x => x.toLowerCase() === m[2]))) ) }
    const y = t.match(/\b(by|from|in)\s+(20\d\d)\b/)
    if (y) return y[1] === 'by' ? { kind: 'by', i: Math.max(ACT, Math.min(N - 1, idxOf(+y[2]!, 11))) } : { kind: 'from', i: Math.max(ACT, Math.min(N - 1, idxOf(+y[2]!, 0))) }
    if (/next year/.test(t)) return { kind: 'from', i: idxOf(FY, 0) }
    return null
  }
  /** First number in an instruction, ignoring dates such as "Dec 2028". */
  const numIn = (t: string) => { const m = t.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+20\d\d|\b20\d\d\b/g, ' ').match(/([+-]?\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]!) : null }
  const scenarioIn = (t: string) => st.current.scenarios.find(s => t.includes(s.name.toLowerCase())) ?? st.current.scenarios.find(s => s.id === st.current.selId)!
  /** A scenario-only override (never an event): reach a value by a date, set it from a date, or shift it from a date. */
  const overrideAct = (t: string, id: DriverId, n: number, when: { kind: 'by' | 'from'; i: number }): Action | string => {
    const sc = scenarioIn(t), d = DRV[id]
    if (!editable.includes(id)) return `${d.label} is CoE-locked in this model, so I can't override it.`
    if (sc.locked) return `${sc.name} is final and locked. Reopen it first, or name another scenario.`
    const shift = /\bby\s+[+-]?\d|increase|raise|lift|cut|lower|reduce|\+|−|-\d/.test(t.replace(/by\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+20\d\d/, '').replace(/by\s+20\d\d/, '')) && when.kind === 'from'
    const down = /cut|lower|reduce|decrease|−|-\d/.test(t)
    const value = shift ? (down ? -Math.abs(n) : Math.abs(n)) : n
    if (!shift && d.pct && (value < 0 || value > 100)) return `${d.label} has to stay between 0% and 100%.`
    const o: Override = { id: `ov-ai${Date.now()}`, driver: id, kind: shift ? 'shift' : when.kind === 'by' ? 'target' : 'step', start: when.kind === 'by' ? ACT : when.i, end: when.kind === 'by' ? when.i : N - 1, value, curve: 's', years: {}, note: `Added by ${name} from chat.`, by: name }
    return { label: `${sc.name}: ${describeOverride(o)}`, view: 'Scenarios', section: 'scenarios', field: null, run: async w => {
      set.selId(sc.id); await w(400)
      set.scenarios(ss => ss.map(s => s.id === sc.id ? { ...s, ovr: [...(s.ovr ?? []), o] } : s))
    } }
  }
  const targetAct = (id: DriverId, target: number): Action | string => {
    if (!editable.includes(id)) return `${DRV[id].label} is CoE-locked in this model, so I can't change it.`
    if (DRV[id].pct && (target <= 0 || target > 100)) return `${DRV[id].label} has to be between 0% and 100%.`
    const base: Partial<Edit> = { method: 'target', start: ACT, end: idxOf(FY, 11), hold: true, ...(editOf(id).method === 'target' ? {} : { curve: 'linear' as const }) }
    return { label: `${DRV[id].label} to ${fmtV(id, target)} by Dec ${FY}`, view: 'Assumptions', section: 'assume', field: 'target', run: async w => { set.sel(id); await w(300); await tween(w, id, 'target', target, base) } }
  }
  const growthAct = (g: number): Action | string => {
    if (!editable.includes('price')) return 'Price is CoE-locked in this model.'
    if (g > 15) return 'Gross price growth above 15% a year is outside the guardrails.'
    const base: Partial<Edit> = { method: 'growth', start: ACT, end: idxOf(2028, 11), hold: true }
    return { label: `Gross price growth ${g}%`, view: 'Assumptions', section: 'assume', field: 'growth', run: async w => { set.sel('price'); await w(300); await tween(w, 'price', 'growth', g, base) } }
  }
  const probAct = (t: string, n: number): Action | string => {
    const ev = st.current.events.find(e => t.includes(e.name.toLowerCase().split(' ')[0]!) || (/pediatric|label/.test(t) && /pediatric/i.test(e.name)) || (/competitor|cgrp/.test(t) && e.id === COMP_ID) || (/formulary|part d/.test(t) && /formulary/i.test(e.name)) || (/wac/.test(t) && /wac/i.test(e.name)))
    if (!ev) return `I couldn't tell which event “${t.trim()}” means.`
    const p = Math.max(0, Math.min(100, Math.round(n / 5) * 5))
    return { label: `${ev.name} at ${p}%`, view: 'Events', section: 'events', field: ev.id, run: async w => { const from = st.current.events.find(e => e.id === ev.id)?.prob ?? ev.prob; for (let k = 1; k <= 10; k++) { const v = Math.round((from + (p - from) * k / 10) / 5) * 5; set.events(es => es.map(e => e.id === ev.id ? { ...e, prob: v } : e)); await w(70) } } }
  }
  /** Turn one instruction into a step, or explain why it can't be done. */
  const actionOf = (part: string): Action | string => {
    const t = part.toLowerCase(), n = numIn(t)
    const id = drvOf(t), when = dateOf(t)
    if (/probab|likel|chance/.test(t) && n != null) return probAct(t, n)
    if (id && n != null && when) return overrideAct(t, id, n, when)
    if (id === 'price' && n != null && /grow/.test(t)) return growthAct(n)
    if (id && n != null) return targetAct(id, n)
    return `I couldn't turn “${part.trim()}” into a change.`
  }

  const undoAll = () => {
    if (!undo) return
    stop(); set.edits(() => undo.edits); set.events(() => undo.events); set.scenarios(() => undo.scenarios); setUndo(null)
  }

  const respond = (q: string): { title: string; body: string } => {
    const t = q.toLowerCase(), num = t.match(/(\d+(?:\.\d+)?)\s*%?/), n = num ? parseFloat(num[1]!) : null
    const rel = /\bby\b|\+|increase|decrease|lower|cut|raise .* by/.test(t) && !/\bto\b/.test(t)
    const down = /lower|decrease|cut|reduce|drop/.test(t)
    const fy = (s = st.current) => fyFor(s)
    const projected = (e: Edits) => fyFor({ ...st.current, edits: e })
    const driver = (id: DriverId, target: number, label: string) => {
      if (!editable.includes(id)) return { title: `${DRV[id].label} is CoE-locked`, body: `The CoE has not exposed **${DRV[id].label}** for override in this model, so I can't change it. Ask the CoE if it needs to open up.` }
      const base: Partial<Edit> = { method: 'target', start: ACT, end: idxOf(FY, 11), hold: true, ...(editOf(id).method === 'target' ? {} : { curve: 'linear' as const }) }
      const after = projected({ ...st.current.edits, [id]: { ...editOf(id), ...base, target } })
      set.sel(id)
      void apply(label, 'Assumptions', [w => tween(w, id, 'target', target, base)], 'assume', 'target')
      return { title: label, body: `Moving **${DRV[id].label}** to **${fmtV(id, target)}** by Dec ${FY}. FY${FY} ${scName(st.current.selId)} goes from **${fmtRev(fy())}** to about **${fmtRev(after)}**.\n\nThe change is on the Assumptions page now. Undo it from the banner if it isn't right.` }
    }
    const cur = (id: DriverId) => editOf(id).method === 'target' ? editOf(id).target : +valueAt(id).toFixed(DRV[id].dp)

    if (/undo|revert|put it back/.test(t)) {
      if (!undo) return { title: 'Nothing to undo', body: `I haven't changed anything in this forecast yet.` }
      undoAll(); return { title: 'Undone', body: `Back to how the forecast was before my last change. FY${FY} is **${fmtRev(fyFor(undo))}**.` }
    }
    if (/what changed|summar|vs\.? the baseline|difference/.test(t)) {
      const ids = Object.keys(st.current.edits) as DriverId[]
      const base = fyFor({ ...st.current, edits: {} })
      return { title: 'What changed vs. the baseline', body: `${ids.length ? ids.map(id => `- **${DRV[id].label}**: ${editOf(id).method === 'growth' ? `${editOf(id).growth}% annual growth` : `${fmtV(id, cur(id))} by Dec ${FY}`}`).join('\n') : 'No assumptions changed yet.'}\n\nFY${FY} ${scName(st.current.selId)}: **${fmtRev(fy())}** against **${fmtRev(base)}** on the reference baseline (${fmtDelta(fy() - base)}).` }
    }
    if (/what moves|sensitiv|biggest driver|most important driver|what matters/.test(t)) {
      const sc = scenarioIn(t), l = scenarioLayer(workingLayer(st.current.edits), sc, st.current.events), b = measure('rev', l, FY)
      const rows = DRIVERS.map(d => ({ d, lo: measure('rev', scaled(l, d.id, -10), FY) - b, hi: measure('rev', scaled(l, d.id, 10), FY) - b })).sort((a, z) => Math.abs(z.hi - z.lo) - Math.abs(a.hi - a.lo))
      return { title: `What moves FY${FY} ${sc.name}`, body: `Each driver moved ±10% from ${mLongOf(ACT)}, everything else held (FY${FY} ${fmtRev(b)}):\n${rows.map((r, k) => `${k + 1}. **${r.d.label}**: ${fmtDelta(r.lo)} / ${fmtDelta(r.hi)}`).join('\n')}\n\n**Sensitivity** lets you test one or several changes over a chosen period and ranks which assumption matters most.` }
    }
    if (/compare|side by side|versus|\bvs\b/.test(t) && !/baseline/.test(t)) {
      const work = workingLayer(st.current.edits), base = st.current.scenarios.find(s => s.name === 'Base Case') ?? st.current.scenarios[0]!
      const bl = scenarioLayer(work, base, st.current.events)
      const lines = st.current.scenarios.map(s => {
        const l = scenarioLayer(work, s, st.current.events), v = measure('rev', l, FY)
        if (s.id === base.id) return `- **${s.name}**: ${fmtRev(v)} (comparison point)`
        const top = bridge(bl, l, 'rev', FY).sort((a, z) => Math.abs(z.d) - Math.abs(a.d))[0]!
        return `- **${s.name}**: ${fmtRev(v)} (${fmtDelta(v - measure('rev', bl, FY))}${Math.abs(top.d) > 0.05 ? `, mostly ${DRV[top.id].label.toLowerCase()} ${fmtDelta(top.d)}` : ''})`
      })
      return { title: `Scenarios side by side · FY${FY}`, body: `${lines.join('\n')}\n\nThe funnel view in **Scenarios** and **Review** shows each driver’s rate and its share of the gap.` }
    }
    if (/publish|finali[sz]e|submit|lock|approve/.test(t))
      return { title: 'That stays with you', body: `I can change assumptions, events and scenarios, but saving, finalising and submitting are yours. Open **Review** to check the numbers, then finalise there.` }
    if (/probab|likel|chance/.test(t) && n != null) {
      const ev = st.current.events.find(e => t.includes(e.name.toLowerCase().split(' ')[0]!.toLowerCase()) || (/pediatric|label/.test(t) && /pediatric/i.test(e.name)) || (/competitor|cgrp/.test(t) && e.id === COMP_ID) || (/formulary|part d/.test(t) && /formulary/i.test(e.name)) || (/wac|pricing/.test(t) && /wac/i.test(e.name)))
      if (!ev) return { title: 'Which event?', body: `Name the event, for example: ${st.current.events.map(e => `“${e.name}”`).join(', ')}.` }
      const p = Math.max(0, Math.min(100, Math.round(n / 5) * 5)), from = ev.prob
      const after = fyFor({ ...st.current, events: st.current.events.map(e => e.id === ev.id ? { ...e, prob: p } : e) })
      void apply(`${ev.name} at ${p}%`, 'Events', [async w => { for (let k = 1; k <= 10; k++) { const v = Math.round((from + (p - from) * k / 10) / 5) * 5; set.events(es => es.map(e => e.id === ev.id ? { ...e, prob: v } : e)); await w(70) } }], 'events', ev.id)
      return { title: `${ev.name}: ${p}%`, body: `Probability **${from}% → ${p}%**. FY${FY} ${scName(st.current.selId)} goes from **${fmtRev(fy())}** to about **${fmtRev(after)}**${st.current.scenarios.find(s => s.id === st.current.selId)?.active.includes(ev.id) ? '' : ' (this event is off in the selected scenario, so revenue does not move until you switch it on)'}.` }
    }
    if (blocked()) return BLOCKED
    const parts = q.split(/\bthen\b|;|\n/i).map(x => x.replace(/^[\s,.\d)]*(and\s+)?/i, '').trim()).filter(x => x.length > 2)
    if (parts.length > 1) {
      const acts = parts.map(actionOf), bad = acts.filter((a): a is string => typeof a === 'string')
      if (bad.length) return { title: 'I need a clearer plan', body: `I didn't change anything, because some steps weren't clear:\n${bad.map(b => `- ${b}`).join('\n')}\n\nWrite one change per step, for example: “Share to 12%, then access to 92%, then peak share 14% by Dec 2028 in Optimistic”.` }
      const ok = acts as Action[]
      void applyPlan(ok)
      return { title: `${ok.length} steps, one at a time`, body: `${ok.map((a, k) => `${k + 1}. ${a.label}`).join('\n')}\n\nWatch each step on the page. You can stop between steps, and one undo reverts them all. You can keep asking questions while I work.` }
    }
    {
      const id = drvOf(t), when = dateOf(t), n = numIn(t)
      if (id && when && n != null && !/probab|likel|chance/.test(t)) {
        const a = overrideAct(t, id, n, when)
        if (typeof a === 'string') return { title: 'Can’t add that override', body: a }
        void applyPlan([a])
        return { title: 'Scenario override', body: `${a.label}.\n\nThis is a scenario override, not an event: no probability and nothing added to the library. It shows under the scenario’s overrides in **Scenarios**, and undo reverts it.` }
      }
    }
    if (/conservative|downside|pessimis/.test(t)) {
      const target = +(cur('share') - 0.5).toFixed(1)
      return driver('share', target, `More conservative share (${target}%)`)
    }
    if (/aggressive|upside|optimis|bullish/.test(t)) {
      const target = +(cur('share') + 0.5).toFixed(1)
      return driver('share', target, `More upside on share (${target}%)`)
    }
    if (/share/.test(t)) {
      const target = +(n == null ? cur('share') + (down ? -0.5 : 0.5) : rel ? cur('share') + (down ? -n : n) : n).toFixed(1)
      if (target <= 0 || target > 40) return { title: 'Out of range', body: `Share has to stay between 0% and 40% in this model. Try a value like 12%.` }
      return driver('share', target, `Share target ${target}%`)
    }
    if (/access|coverage/.test(t)) {
      const target = +(n == null ? cur('access') + (down ? -2 : 2) : rel ? cur('access') + (down ? -n : n) : n).toFixed(1)
      if (target <= 0 || target > 100) return { title: 'Out of range', body: 'Access has to be between 0% and 100%.' }
      return driver('access', target, `Access target ${target}%`)
    }
    if (/price|wac|growth/.test(t)) {
      const g = n ?? 3
      if (!editable.includes('price')) return { title: 'Price is CoE-locked', body: `The CoE has not exposed **price** for override in this model, so I can't change it.` }
      if (g > 15) return { title: 'Out of range', body: 'Gross price growth above 15% a year falls outside the guardrails for this model.' }
      const base: Partial<Edit> = { method: 'growth', start: ACT, end: idxOf(2028, 11), hold: true }
      const after = projected({ ...st.current.edits, price: { ...editOf('price'), ...base, growth: g } })
      set.sel('price')
      void apply(`Gross price growth ${g}%`, 'Assumptions', [w => tween(w, 'price', 'growth', g, base)], 'assume', 'growth')
      return { title: `Gross price growth ${g}%`, body: `Setting **gross price** to grow **${g}%** a year. FY${FY} goes from **${fmtRev(fy())}** to about **${fmtRev(after)}**.` }
    }
    return { title: 'What I can change', body: `I can change numbers in this forecast and show the effect on FY${FY} revenue. Try:\n- “Raise share target to 12%”\n- “Peak share 14% by Dec 2028 in Optimistic”\n- “Increase share by 1 point from May 2027”\n- “Share to 12%, then access to 92%” (I'll do them one at a time)\n- “What moves revenue most?” or “Compare the scenarios”\n- “Set access to 92%”\n- “Gross price growth 2%”\n- “Set pediatric label probability to 70%”\n- “Make it more conservative”\n\nOr run the demo to watch me build the base case. Engine math, CoE-locked inputs and finalising stay out of my reach.` }
  }

  const copilot = (onReview: () => void): CopilotProps => ({
    busy: !!status?.running,
    greeting: `Hi, I'm working in the ${brand} forecast with you. Ask me to change a number and I'll make the change on the page, then show what it does to FY${FY} revenue.`,
    context: [brand, `FY${FY}`, scName(state.selId)],
    chips: ['Peak share 14% by Dec 2028 in Optimistic', 'Share to 12%, then access to 92%', 'What moves revenue most?', 'Compare the scenarios', 'Undo your last change'],
    respond,
    demo: { title: `Build the ${brand} base case from the brief`, prompt: 'Build the base case: share to 11.5% by end of 2027, access to 90%, 3% gross price growth, and factor in the competitor launch in April.', steps: STEPS, demo, onRun: () => void runDemo(), onStop: stop, onReview, reviewLabel: 'Review the forecast', note: 'Changes assumptions, events and the Base Case, then stops at Review. Saving and finalising stay with you.' },
  })

  return { focus, status, setStatus, undo: undo ? undoAll : null, stop, copilot }
}

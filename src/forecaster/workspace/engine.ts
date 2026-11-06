/*
 * Engine for the Forecaster workspace (PRD v1.0).
 * Layers, in order: actuals → unbiased baseline (+95% CI) → working baseline (driver edits) → scenario (active events).
 * The unbiased baseline is never mutated; every other layer is derived from it.
 * Figures are illustrative (Nurtec-like patient flow), not client data.
 */

export const START_YEAR = 2025
export const N = 48 // Jan 2025 – Dec 2028
export const ACT = 19 // actuals through Jul 2026
export const FY = 2027
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const YEARS = [2025, 2026, 2027, 2028]
export const mLabel = (i: number) => `${MONTHS[i % 12]} ${String(START_YEAR + Math.floor(i / 12)).slice(2)}`
export const mLong = (i: number) => `${MONTHS[i % 12]} ${START_YEAR + Math.floor(i / 12)}`
export const idxOf = (year: number, month: number) => (year - START_YEAR) * 12 + month
export const yearOf = (i: number) => START_YEAR + Math.floor(i / 12)

export type DriverId = 'diag' | 'treat' | 'access' | 'share' | 'price'
export type Driver = { id: DriverId; label: string; step: string; unit: string; dp: number; sens: 'pts' | '%'; desc: string; pct: boolean }
export const DRIVERS: Driver[] = [
  { id: 'diag', label: 'Diagnosis rate', step: 'Diagnosed', unit: '%', dp: 1, sens: 'pts', pct: true, desc: 'Share of the prevalent population that has a confirmed diagnosis.' },
  { id: 'treat', label: 'Treatment rate', step: 'Treated', unit: '%', dp: 1, sens: 'pts', pct: true, desc: 'Share of diagnosed patients who receive a prescription treatment.' },
  { id: 'access', label: 'Access', step: 'Covered', unit: '%', dp: 1, sens: 'pts', pct: true, desc: 'Share of treated patients with payer coverage that lets them start the brand.' },
  { id: 'share', label: 'Share', step: 'Brand share', unit: '%', dp: 1, sens: 'pts', pct: true, desc: 'Brand share of covered, treated patients.' },
  { id: 'price', label: 'Price', step: 'Net price', unit: '$ / Rx', dp: 2, sens: '%', pct: false, desc: 'Net price realised per prescription after gross-to-net.' },
]
export const DRV = Object.fromEntries(DRIVERS.map(d => [d.id, d])) as Record<DriverId, Driver>
export const fmtV = (id: DriverId, v: number) => { const d = DRV[id], s = v.toFixed(d.dp); return d.unit === '%' ? `${s}%` : d.unit === '$ / Rx' ? `$${s}` : s }
export const fmtRev = (v: number, dp = 0) => `$${v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}M`
export const fmtDelta = (v: number, dp = 1) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}M`

export type Layer = Record<DriverId, number[]>
const nz = (i: number, s: number) => Math.sin(i * 1.7 + s) * 0.5 + Math.sin(i * 0.63 + s * 2) * 0.5
const HIST: Record<DriverId, (i: number) => number> = {
  diag: i => 58 + 0.9 * i / 12 + 0.25 * nz(i, 2),
  treat: i => 40.5 + 0.5 * i / 12 + 0.3 * nz(i, 3),
  access: i => 84 + 1.2 * i / 12 + 0.35 * nz(i, 4),
  share: i => 8.4 + 0.9 * i / 12 + 0.12 * nz(i, 5),
  price: i => 285 + 6 * i / 12 + 1.4 * nz(i, 7),
}
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1)

export const ACTUALS = Object.fromEntries(DRIVERS.map(d => [d.id, Array.from({ length: ACT }, (_, i) => HIST[d.id](i))])) as Layer

function trendFor(id: DriverId) {
  const h = ACTUALS[id], w = h.slice(ACT - 12), xm = (w.length - 1) / 2, ym = avg(w)
  let num = 0, den = 0
  w.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2 })
  const slope = num / den, fitEnd = ym + slope * (w.length - 1 - xm)
  const resid = Math.sqrt(avg(w.map((y, x) => (y - (ym + slope * (x - xm))) ** 2)))
  const sigma = Math.max(resid, Math.abs(fitEnd) * 0.004)
  const base = [...h], lo = [...h], hi = [...h]
  for (let i = ACT; i < N; i++) {
    const t = i - ACT + 1
    const v = fitEnd + slope * (1 - 0.97 ** t) / 0.03, half = 1.96 * sigma * Math.sqrt(t)
    base[i] = v; lo[i] = v - half; hi[i] = v + half
  }
  return { base, lo, hi }
}
export const BASELINE = Object.fromEntries(DRIVERS.map(d => [d.id, trendFor(d.id)])) as Record<DriverId, { base: number[]; lo: number[]; hi: number[] }>
export const ACTUAL_LAYER: Layer = Object.fromEntries(DRIVERS.map(d => [d.id, ACTUALS[d.id]])) as Layer
export const UNBIASED: Layer = Object.fromEntries(DRIVERS.map(d => [d.id, BASELINE[d.id].base])) as Layer

/* ── Driver edits (PRD 8.3) ── */
export type Method = 'hold' | 'target' | 'linear' | 'growth' | 'direct'
export type Curve = 'linear' | 's' | 'fast'
export type Edit = {
  method: Method; start: number; end: number; target: number; growth: number; step: number; curve: Curve
  hold: boolean; values: Record<number, number>; pinned: number[]; notes: string; source: 'manual' | 'excel' | 'paste'
}
export const METHOD_LABEL: Record<Method, string> = { hold: 'Hold last actual', target: 'Target value', linear: 'Linear growth', growth: 'Annual growth %', direct: 'Monthly entry' }
export const CURVE_LABEL: Record<Curve, string> = { linear: 'Linear', s: 'S-curve', fast: 'Front-loaded' }
const shape = (f: number, c: Curve) => c === 's' ? f * f * (3 - 2 * f) : c === 'fast' ? 1 - (1 - f) ** 2 : f

export function defaultEdit(id: DriverId): Edit {
  const d = DRV[id]
  return { method: 'target', start: ACT, end: idxOf(2027, 11), target: +ACTUALS[id][ACT - 1]!.toFixed(d.dp), growth: 2, step: d.pct ? 0.1 : 0.5, curve: 'linear', hold: true, values: {}, pinned: [], notes: '', source: 'manual' }
}

export function applyEdit(id: DriverId, base: number[], e: Edit | undefined): number[] {
  if (!e) return base
  const d = DRV[id], s = [...base], last = ACTUALS[id][ACT - 1]!, v0 = s[e.start - 1] ?? last
  const clamp = (v: number) => d.pct ? Math.max(0, Math.min(100, v)) : Math.max(0, v)
  if (e.method === 'direct') {
    for (let i = ACT; i < N; i++) if (e.values[i] !== undefined) s[i] = clamp(e.values[i]!)
    return s
  }
  const span = Math.max(1, e.end - e.start + 1)
  for (let i = e.start; i <= Math.min(e.end, N - 1); i++) {
    const k = i - e.start + 1
    s[i] = clamp(e.method === 'hold' ? last
      : e.method === 'target' ? v0 + (e.target - v0) * shape(k / span, e.curve)
      : e.method === 'linear' ? v0 + e.step * k
      : v0 * (1 + e.growth / 100) ** (k / 12))
  }
  if (e.hold) for (let i = e.end + 1; i < N; i++) s[i] = s[Math.min(e.end, N - 1)]!
  return s
}

export const workingLayer = (edits: Partial<Record<DriverId, Edit>>): Layer =>
  Object.fromEntries(DRIVERS.map(d => [d.id, applyEdit(d.id, UNBIASED[d.id], edits[d.id])])) as Layer

/* ── Events (PRD 8.4) ── */
export type EventType = 'Market Event' | 'Product Event' | 'Pricing Event' | 'Other'
export const EVENT_TYPES: EventType[] = ['Market Event', 'Product Event', 'Pricing Event', 'Other']
export type EventCurve = 'step' | 'ramp' | 's'
export const EVENT_CURVE_LABEL: Record<EventCurve, string> = { step: 'Immediate step', ramp: '6-month ramp', s: 'S-curve (9 mo)' }
export type Impact = { metric: DriverId; dir: 'up' | 'down'; mag: number; curve: EventCurve; duration: number | null }
export type EventDef = { id: string; name: string; type: EventType; date: number; prob: number; impacts: Impact[]; notes: string; sub?: string; mfn?: string }
/** CR-001: event types filtered by category. The first option is the default when the category changes. */
export const EVENT_SUBTYPES: Record<EventType, string[]> = {
  'Market Event': ['Competitive Entrant', 'Regulatory Change', 'Access/HTA Decision', 'Disease Awareness Campaign', 'Epidemiology Shift', 'Supply Chain Disruption', 'Other Market Event'],
  'Product Event': ['New Indication Approval', 'Line Extension / New Formulation', 'Label Change', 'Safety Signal', 'Loss of Exclusivity', 'Other Product Event'],
  'Pricing Event': ['List Price (WAC) Change', 'Gross-to-Net / Rebate Change', 'Contract or Formulary Change', 'IRA Negotiated Price', 'MFN Policy Implementation', 'Other Pricing Event'],
  Other: ['Other Event'],
}
export const MFN_SUB = ['Medicaid', 'Medicare Part B', 'Medicare Part D', 'Commercial']

const evFrac = (k: number, c: EventCurve) => c === 'step' ? 1 : c === 'ramp' ? Math.min(1, (k + 1) / 6) : shape(Math.min(1, (k + 1) / 9), 's')

export function applyEvents(layer: Layer, events: EventDef[]): Layer {
  const out = { ...layer }
  for (const ev of events) for (const im of ev.impacts) {
    const d = DRV[im.metric], s = [...out[im.metric]], sign = im.dir === 'up' ? 1 : -1
    for (let i = Math.max(ev.date, ACT); i < N; i++) {
      const k = i - ev.date
      if (im.duration !== null && k >= im.duration) break
      const v = s[i]! * (1 + sign * im.mag / 100 * (ev.prob / 100) * evFrac(k, im.curve))
      s[i] = d.pct ? Math.min(100, v) : v
    }
    out[im.metric] = s
  }
  return out
}

/* ── Outcome: monthly net revenue, $M ── */
export const POP = 39e6, RX_PER_PT = 0.55
export function revenue(l: Layer): number[] {
  return Array.from({ length: N }, (_, i) => POP * (l.diag[i]! / 100) * (l.treat[i]! / 100) * (l.access[i]! / 100) * (l.share[i]! / 100) * RX_PER_PT * l.price[i]! / 1e6)
}
export type OutputId = 'rev' | 'pts' | 'trx'
export const OUTPUTS: Record<OutputId, { label: string; unit: string; fn: (l: Layer) => number[]; fmt: (v: number, dp?: number) => string; delta: (v: number) => string; dp: number }> = {
  rev: { label: 'Net revenue', unit: '$M', fn: revenue, fmt: (v, dp = 0) => fmtRev(v, dp), delta: v => fmtDelta(v), dp: 0 },
  pts: { label: 'Treated patients', unit: 'K patients', fn: l => Array.from({ length: N }, (_, i) => POP * (l.diag[i]! / 100) * (l.treat[i]! / 100) * (l.access[i]! / 100) * (l.share[i]! / 100) / 1e3), fmt: (v, dp = 0) => `${v.toLocaleString('en-US', { maximumFractionDigits: dp })}K`, delta: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`, dp: 1 },
  trx: { label: 'TRx', unit: 'K Rx', fn: l => Array.from({ length: N }, (_, i) => POP * (l.diag[i]! / 100) * (l.treat[i]! / 100) * (l.access[i]! / 100) * (l.share[i]! / 100) * RX_PER_PT / 1e3), fmt: (v, dp = 0) => `${v.toLocaleString('en-US', { maximumFractionDigits: dp })}K`, delta: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`, dp: 1 },
}

/* Model configuration published by the CoE: which modules a brand's forecast exposes, in order. */
export type ModuleCfg = { id: DriverId; editable: boolean }
export type ModelCfg = { modules: ModuleCfg[]; outputs: OutputId[]; start: { label: string; value: string } }
export const DEFAULT_MODEL: ModelCfg = { modules: DRIVERS.map(d => ({ id: d.id, editable: true })), outputs: ['rev', 'pts', 'trx'], start: { label: 'Prevalent patients', value: '39.0M' } }

export const fySum = (s: number[], year = FY) => s.slice((year - START_YEAR) * 12, (year - START_YEAR) * 12 + 12).reduce((a, b) => a + b, 0)
export const fyAvg = (s: number[], year = FY) => fySum(s, year) / 12

/* ── Analysis ── */
export function adjusted(l: Layer, adj: Partial<Record<DriverId, number>>): Layer {
  let out = l
  for (const d of DRIVERS) { const v = adj[d.id]; if (v) out = shifted(out, d.id, v) }
  return out
}
export function shifted(l: Layer, id: DriverId, delta: number, start = ACT): Layer {
  const d = DRV[id], s = [...l[id]]
  for (let i = Math.max(ACT, start); i < N; i++) s[i] = d.pct ? Math.max(0, Math.min(100, s[i]! + delta)) : s[i]! * (1 + delta / 100)
  return { ...l, [id]: s }
}
export function goalSeek(l: Layer, id: DriverId, target: number): { delta: number; reached: boolean } {
  let lo = -30, hi = 30
  const f = (x: number) => fySum(revenue(shifted(l, id, x)))
  if (f(hi) < target || f(lo) > target) return { delta: f(hi) < target ? hi : lo, reached: false }
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; f(mid) < target ? lo = mid : hi = mid }
  return { delta: (lo + hi) / 2, reached: true }
}

/* ── Seed data ── */
export type Scenario = { id: string; name: string; color?: string; active: string[]; adj: Partial<Record<DriverId, number>>; locked: boolean; ovr?: Override[] }
export const SEED_EVENTS: EventDef[] = [
  { id: 'ev1', name: 'Part D formulary win', type: 'Market Event', date: idxOf(2027, 0), prob: 70, notes: 'Preferred-tier placement on two national Part D plans.', impacts: [{ metric: 'access', dir: 'up', mag: 4, curve: 'ramp', duration: null }, { metric: 'share', dir: 'up', mag: 3, curve: 'ramp', duration: null }] },
  { id: 'ev2', name: 'January WAC increase', type: 'Pricing Event', date: idxOf(2027, 0), prob: 85, notes: 'Pricing committee option: 2.5% list increase, partly offset by gross-to-net.', impacts: [{ metric: 'price', dir: 'up', mag: 2.5, curve: 'step', duration: null }] },
  { id: 'ev3', name: 'Pediatric label expansion', type: 'Product Event', date: idxOf(2027, 6), prob: 50, notes: 'Regulatory decision expected mid-2027.', impacts: [{ metric: 'diag', dir: 'up', mag: 1.5, curve: 's', duration: null }, { metric: 'share', dir: 'up', mag: 4, curve: 's', duration: null }] },
]
export const SEED_SCENARIOS: Scenario[] = [
  { id: 'sc1', name: 'Trended Statistical', active: [], adj: {}, locked: false },
  { id: 'sc2', name: 'Base Case', active: ['ev1', 'ev2'], adj: {}, locked: false },
  { id: 'sc3', name: 'Optimistic', active: ['ev1', 'ev2', 'ev3'], adj: { share: 0.5 }, locked: false, ovr: [
    { id: 'ov-seed1', driver: 'share', kind: 'target', start: ACT, end: idxOf(2028, 11), value: 14, curve: 's', years: {}, note: 'Brand team view: peak share of 14% reached by Dec 2028.' },
  ] },
  { id: 'sc4', name: 'Pessimistic', active: [], adj: { share: -0.5 }, locked: false },
  { id: 'sc5', name: 'GCA', active: ['ev1'], adj: {}, locked: false },
  { id: 'sc6', name: 'Finance', active: ['ev2'], adj: {}, locked: false },
]

/* ── Scenario overrides ──
   Manual values that belong to one scenario only. They are not events: no probability, no library entry.
   Applied after events, so for the months they cover the forecaster's value wins. */
export type OvrKind = 'target' | 'step' | 'shift' | 'byYear'
export type Override = { id: string; driver: DriverId; kind: OvrKind; start: number; end: number; value: number; curve: Curve; years: Record<number, number>; note: string; by?: string }
export const OVR_LABEL: Record<OvrKind, string> = { target: 'Reach a value by a date', step: 'Set a value from a date', shift: 'Shift from a date', byYear: 'Value by year' }
export const FC_YEARS = YEARS.filter(y => idxOf(y, 11) >= ACT)

export function applyOverrides(l: Layer, ovr: Override[] = []): Layer {
  let out = l
  for (const o of ovr) {
    const d = DRV[o.driver], s = [...out[o.driver]], from = Math.max(ACT, o.start), end = Math.max(from, Math.min(N - 1, o.end))
    const clamp = (v: number) => d.pct ? Math.max(0, Math.min(100, v)) : Math.max(0, v)
    if (o.kind === 'target') {
      const v0 = s[from - 1]!, span = end - from + 1
      for (let i = from; i <= end; i++) s[i] = v0 + (o.value - v0) * shape((i - from + 1) / span, o.curve)
      for (let i = end + 1; i < N; i++) s[i] = s[end]!
    } else if (o.kind === 'step') for (let i = from; i <= end; i++) s[i] = o.value
    else if (o.kind === 'shift') for (let i = from; i <= end; i++) s[i] = d.pct ? s[i]! + o.value : s[i]! * (1 + o.value / 100)
    else for (let i = from; i < N; i++) { const v = o.years[yearOf(i)]; if (v !== undefined && Number.isFinite(v)) s[i] = v }
    out = { ...out, [o.driver]: s.map((v, i) => i >= ACT ? clamp(v) : v) }
  }
  return out
}
export function describeOverride(o: Override) {
  const d = DRV[o.driver], u = d.pct ? 'pts' : '%'
  switch (o.kind) {
    case 'target': return `${d.label} reaches ${fmtV(o.driver, o.value)} by ${mLong(o.end)} (${CURVE_LABEL[o.curve].toLowerCase()} from ${mLong(Math.max(ACT, o.start))}), held after`
    case 'step': return `${d.label} set to ${fmtV(o.driver, o.value)} from ${mLong(Math.max(ACT, o.start))}${o.end < N - 1 ? ` to ${mLong(o.end)}` : ''}`
    case 'shift': return `${d.label} ${o.value >= 0 ? '+' : '−'}${Math.abs(+o.value.toFixed(2))} ${u} from ${mLong(Math.max(ACT, o.start))}${o.end < N - 1 ? ` to ${mLong(o.end)}` : ''}`
    default: return `${d.label} by year: ${Object.entries(o.years).filter(([, v]) => Number.isFinite(v)).map(([y, v]) => `${y} ${fmtV(o.driver, v)}`).join(' · ')}`
  }
}
/** The one path every scenario takes: active forecast → scenario adjustments → events → manual overrides. */
export const scenarioLayer = (work: Layer, s: Scenario, events: EventDef[]): Layer =>
  applyOverrides(applyEvents(adjusted(work, s.adj), events.filter(e => s.active.includes(e.id))), s.ovr)

/* ── Measures, funnel and bridge ── */
export type Horizon = number | 'all'
export const HORIZON_LABEL = (h: Horizon) => h === 'all' ? `${FC_YEARS[0]}–${String(FC_YEARS[FC_YEARS.length - 1]).slice(2)}` : `FY${h}`
/** Revenue and TRx are summed over the period; patients are an average month. */
export function measure(m: OutputId, l: Layer, h: Horizon): number {
  const s = OUTPUTS[m].fn(l), ys = h === 'all' ? FC_YEARS : [h]
  const tot = ys.reduce((a, y) => a + fySum(s, y), 0)
  return m === 'pts' ? tot / (12 * ys.length) : tot
}
export const MEASURE_LABEL: Record<OutputId, string> = { rev: 'Net revenue', pts: 'Treated patients (avg month)', trx: 'TRx' }

export type FunnelRow = { id: 'prev' | DriverId | 'trx' | 'rev'; label: string; rate?: number; vol: number; unit: string }
/** Funnel for one year: driver rates (year average) and the patients or money each step carries. */
export function funnelOf(l: Layer, year: number): FunnelRow[] {
  const a = (id: DriverId) => fyAvg(l[id], year)
  const p = (k: number) => { let v = POP; for (const id of (['diag', 'treat', 'access', 'share'] as DriverId[]).slice(0, k)) v *= fyAvg(l[id], year) / 100; return v }
  return [
    { id: 'prev', label: 'Prevalent patients', vol: POP, unit: 'pts' },
    { id: 'diag', label: 'Diagnosed', rate: a('diag'), vol: p(1), unit: 'pts' },
    { id: 'treat', label: 'Treated', rate: a('treat'), vol: p(2), unit: 'pts' },
    { id: 'access', label: 'Covered', rate: a('access'), vol: p(3), unit: 'pts' },
    { id: 'share', label: 'On brand', rate: a('share'), vol: fyAvg(OUTPUTS.pts.fn(l), year) * 1e3, unit: 'pts' },
    { id: 'trx', label: 'TRx', vol: fySum(OUTPUTS.trx.fn(l), year) * 1e3, unit: 'Rx' },
    { id: 'price', label: 'Net price', rate: a('price'), vol: fySum(revenue(l), year), unit: '$M' },
  ]
}
/** Exact sequential bridge: swap each driver from one layer to the other in funnel order. Parts sum to the gap. */
export function bridge(from: Layer, to: Layer, m: OutputId, h: Horizon): { id: DriverId; d: number }[] {
  let cur = from, prev = measure(m, from, h)
  return DRIVERS.map(d => { cur = { ...cur, [d.id]: to[d.id] }; const v = measure(m, cur, h), r = { id: d.id, d: v - prev }; prev = v; return r })
}

/* ── Simulation ── */
export const shiftAll = (l: Layer, deltas: Partial<Record<DriverId, number>>, start = ACT): Layer =>
  DRIVERS.reduce((acc, d) => deltas[d.id] ? shifted(acc, d.id, deltas[d.id]!, start) : acc, l)
/** Relative scaling of a driver's whole path from `start` (the sensitivity convention: low −x%, high +x%). */
export function scaled(l: Layer, id: DriverId, pct: number, start = ACT): Layer {
  const d = DRV[id], s = [...l[id]]
  for (let i = Math.max(ACT, start); i < N; i++) s[i] = d.pct ? Math.min(100, Math.max(0, s[i]! * (1 + pct / 100))) : Math.max(0, s[i]! * (1 + pct / 100))
  return { ...l, [id]: s }
}

export type Goal = { id: string; metric: OutputId; h: Horizon; min: number; max: number; lever: DriverId }
export type GoalStep = { goal: Goal; before: number; after: number; delta: number; status: 'met' | 'solved' | 'partial' | 'no-effect' }
/** Ordered goal seek: solve goal 1 inside its range with its lever, keep that, then move to goal 2, and so on. */
export function goalSeekOrdered(base: Layer, goals: Goal[], start = ACT, limit = 30) {
  let cur = base
  const steps: GoalStep[] = []
  for (const g of goals) {
    const f = (x: number) => measure(g.metric, shifted(cur, g.lever, x, start), g.h)
    const before = f(0)
    if (before >= g.min && before <= g.max) { steps.push({ goal: g, before, after: before, delta: 0, status: 'met' }); continue }
    const target = before < g.min ? g.min : g.max
    if (Math.abs(f(limit) - f(-limit)) < 1e-9) { steps.push({ goal: g, before, after: before, delta: 0, status: 'no-effect' }); continue }
    const up = f(limit) > f(-limit)
    let lo = -limit, hi = limit
    for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; (f(mid) < target) === up ? lo = mid : hi = mid }
    const delta = (lo + hi) / 2, after = f(delta)
    const status = Math.abs(after - target) <= Math.max(1e-6, Math.abs(target) * 1e-4) ? 'solved' : 'partial'
    cur = shifted(cur, g.lever, delta, start)
    steps.push({ goal: g, before, after, delta, status })
  }
  const final = goals.map(g => { const v = measure(g.metric, cur, g.h); return { goal: g, v, ok: v >= g.min - Math.abs(g.min) * 1e-4 && v <= g.max + Math.abs(g.max) * 1e-4 } })
  return { steps, final, layer: cur }
}

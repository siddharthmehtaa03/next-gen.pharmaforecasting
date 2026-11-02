/*
 * Funnel engine for the reimagined forecaster flow.
 * Two layers: a trend-based baseline per input node, and logged deviations (events, targets,
 * grid edits, goal seek) that explain every move away from it. Derived nodes are read-only.
 * Figures are illustrative (Nurtec-like patient funnel), not client data.
 */

export const START_YEAR = 2024
export const N = 144 // Jan 2024 – Dec 2035: 10-year forecast horizon after actuals
export const ACT = 31 // actuals through Jul 2026
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const YEARS = Array.from({ length: N / 12 }, (_, i) => START_YEAR + i)
export const mLabel = (i: number) => `${MONTHS[i % 12]} ${String(START_YEAR + Math.floor(i / 12)).slice(2)}`
export const yearOf = (i: number) => START_YEAR + Math.floor(i / 12)
export const idxOf = (year: number, month: number) => (year - START_YEAR) * 12 + month

export type NodeId = 'prev' | 'diag' | 'treat' | 'pts' | 'cls' | 'brand' | 'written' | 'rxpp' | 'trx' | 'price' | 'rev'
export type Method = 'blaze' | 'linear' | 'flat' | 'cagr'
export const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: 'blaze', label: 'Blaze', hint: 'Auto-fit, damped trend' },
  { id: 'linear', label: 'Linear', hint: 'Straight-line on 24 mo' },
  { id: 'flat', label: 'Hold flat', hint: 'Last 3-month average' },
  { id: 'cagr', label: 'CAGR', hint: 'Compound annual rate' },
]

export type NodeDef = {
  id: NodeId; label: string; unit: string; kind: 'input' | 'derived'; agg: 'sum' | 'avg'; dp: number
  formula?: string; upstream?: NodeId[]; source: string; hist?: (i: number) => number
}
const nz = (i: number, s: number) => Math.sin(i * 1.7 + s) * 0.5 + Math.sin(i * 0.63 + s * 2) * 0.5

export const NODES: NodeDef[] = [
  { id: 'prev', label: 'Migraine prevalence', unit: 'M patients', kind: 'input', agg: 'avg', dp: 2, source: 'Published epi (AMPP)', hist: i => 39 * (1 + 0.008 * i / 12) * (1 + 0.002 * nz(i, 1)) },
  { id: 'diag', label: 'Diagnosed rate', unit: '%', kind: 'input', agg: 'avg', dp: 1, source: 'Claims-derived', hist: i => 58 + 0.4 * i / 12 + 0.3 * nz(i, 2) },
  { id: 'treat', label: 'Rx-treated rate', unit: '%', kind: 'input', agg: 'avg', dp: 1, source: 'Claims-derived', hist: i => 41 + 0.2 * i / 12 + 0.4 * nz(i, 3) },
  { id: 'pts', label: 'Treated patients', unit: 'M patients', kind: 'derived', agg: 'avg', dp: 2, formula: 'Prevalence × diagnosed × treated', upstream: ['prev', 'diag', 'treat'], source: 'Calculated' },
  { id: 'cls', label: 'CGRP class share', unit: '%', kind: 'input', agg: 'avg', dp: 1, source: 'IQVIA NPA', hist: i => 18 + 3.2 * i / 12 + 0.5 * nz(i, 4) },
  { id: 'brand', label: 'Brand share of class', unit: '%', kind: 'input', agg: 'avg', dp: 1, source: 'IQVIA NPA', hist: i => 39 - 0.15 * i / 12 + 0.6 * nz(i, 5) },
  { id: 'written', label: 'Written patients', unit: 'K patients', kind: 'derived', agg: 'avg', dp: 0, formula: 'Treated patients × class share × brand share', upstream: ['prev', 'diag', 'treat', 'cls', 'brand'], source: 'Calculated' },
  { id: 'rxpp', label: 'Rx per patient', unit: 'Rx / mo', kind: 'input', agg: 'avg', dp: 3, source: 'Claims-derived', hist: i => 0.55 + 0.006 * nz(i, 6) },
  { id: 'trx', label: 'Total Rx', unit: 'K Rx', kind: 'derived', agg: 'sum', dp: 0, formula: 'Written patients × Rx per patient', upstream: ['prev', 'diag', 'treat', 'cls', 'brand', 'rxpp'], source: 'Calculated' },
  { id: 'price', label: 'Net price', unit: '$ / Rx', kind: 'input', agg: 'avg', dp: 2, source: 'Pricing committee', hist: i => 290 * (1 + 0.012 * i / 12) + 1.5 * nz(i, 7) },
  { id: 'rev', label: 'Net revenue', unit: '$M', kind: 'derived', agg: 'sum', dp: 1, formula: 'Total Rx × net price', upstream: ['prev', 'diag', 'treat', 'cls', 'brand', 'rxpp', 'price'], source: 'Calculated' },
]
export const NODE = Object.fromEntries(NODES.map(n => [n.id, n])) as Record<NodeId, NodeDef>
export const INPUTS = NODES.filter(n => n.kind === 'input').map(n => n.id)

export type DevKind = 'event' | 'target' | 'override' | 'goalseek'
export type Dev = {
  id: string; kind: DevKind; node: NodeId; label: string
  start: number; end?: number
  /** event / goalseek: % impact; target: absolute value; override: absolute value at `start` */
  value: number
  shape?: 'linear' | 's-curve' | 'fast'
  /** % move vs the forecast before this deviation, for rationale thresholds */
  mag: number
  rationale: string; source: string; reviewed: boolean; by: string; at: string
}
export const DEV_LABEL: Record<DevKind, string> = { event: 'Event', target: 'Target', override: 'Grid edit', goalseek: 'Goal seek' }

export type Setup = { methods: Record<string, Method>; cagr: Record<string, number> }
export type Model = { base: Record<NodeId, number[]>; fc: Record<NodeId, number[]> }

export function history(id: NodeId, scale = 1) {
  const h = NODE[id].hist!
  return Array.from({ length: ACT }, (_, i) => h(i) * (id === 'prev' ? scale : 1))
}
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1)
export function defaultCagr(h: number[]) { return (avg(h.slice(ACT - 12)) / avg(h.slice(ACT - 24, ACT - 12)) - 1) * 100 }

export function trend(h: number[], m: Method, cagr: number) {
  const w = h.slice(ACT - 24)
  const xm = (w.length - 1) / 2, ym = avg(w)
  let num = 0, den = 0
  w.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2 })
  const slope = num / den, fitEnd = ym + slope * (w.length - 1 - xm)
  const last3 = avg(h.slice(ACT - 3))
  const out = [...h]
  for (let i = ACT; i < N; i++) {
    const t = i - ACT + 1
    out[i] = m === 'flat' ? last3 : m === 'linear' ? fitEnd + slope * t : m === 'cagr' ? fitEnd * (1 + cagr / 100) ** (t / 12) : fitEnd + slope * (1 - 0.97 ** t) / 0.03
  }
  return out
}

const shapeF = (f: number, s: Dev['shape']) => s === 's-curve' ? f * f * (3 - 2 * f) : s === 'fast' ? 1 - (1 - f) ** 2 : f

export function applyDevs(series: number[], devs: Dev[]) {
  const s = [...series]
  const order: DevKind[] = ['target', 'event', 'goalseek', 'override']
  for (const k of order) for (const d of devs.filter(x => x.kind === k)) {
    if (k === 'target') {
      const e = d.end ?? N - 1, v0 = s[d.start - 1] ?? s[d.start]!
      for (let i = d.start; i < N; i++) s[i] = i <= e ? v0 + (d.value - v0) * shapeF((i - d.start + 1) / (e - d.start + 1), d.shape) : d.value
    } else if (k === 'event') {
      for (let i = d.start; i <= (d.end ?? N - 1); i++) s[i] = s[i]! * (1 + d.value / 100 * Math.min(1, (i - d.start + 1) / 6))
    } else if (k === 'goalseek') {
      for (let i = d.start; i <= (d.end ?? N - 1); i++) s[i] = s[i]! * (1 + d.value / 100)
    } else s[d.start] = d.value
  }
  return s
}

function derive(x: Record<NodeId, number[]>) {
  const r = (f: (i: number) => number) => Array.from({ length: N }, (_, i) => f(i))
  x.pts = r(i => x.prev[i]! * x.diag[i]! / 100 * x.treat[i]! / 100)
  x.written = r(i => x.pts[i]! * 1000 * x.cls[i]! / 100 * x.brand[i]! / 100)
  x.trx = r(i => x.written[i]! * x.rxpp[i]!)
  x.rev = r(i => x.trx[i]! * x.price[i]! / 1000)
  return x
}

export function compute(setup: Setup, devs: Dev[], scale = 1): Model {
  const base = {} as Record<NodeId, number[]>, fc = {} as Record<NodeId, number[]>
  for (const id of INPUTS) {
    const h = history(id, scale)
    base[id] = trend(h, setup.methods[id] ?? 'blaze', setup.cagr[id] ?? defaultCagr(h))
    fc[id] = applyDevs(base[id], devs.filter(d => d.node === id))
  }
  return { base: derive(base), fc: derive(fc) }
}

export function yearly(series: number[], agg: 'sum' | 'avg') {
  return YEARS.map((_, y) => { const sl = series.slice(y * 12, y * 12 + 12); return agg === 'sum' ? sl.reduce((a, b) => a + b, 0) : avg(sl) })
}
export const yv = (m: Model, id: NodeId, year: number, layer: 'base' | 'fc' = 'fc') => yearly(m[layer][id], NODE[id].agg)[year - START_YEAR]!

export function fmt(id: NodeId, v: number) {
  const n = NODE[id]
  const s = v.toLocaleString('en-US', { minimumFractionDigits: n.dp, maximumFractionDigits: n.dp })
  return n.unit === '$M' ? `$${s}M` : n.unit === '$ / Rx' ? `$${s}` : n.unit === '%' ? `${s}%` : s
}

/* ── Governance tiers: set per model in the configurator. Forecasters never change them. ── */
export type Tier = 'tight' | 'standard' | 'open'
export const TIERS: Record<Tier, { label: string; who: string; rule: string; needRat: (d: Dev) => boolean; needSrc: boolean; blocks: boolean }> = {
  tight: { label: 'Tight', who: 'Mature brands', rule: 'Every deviation needs a rationale and a source before you can publish.', needRat: () => true, needSrc: true, blocks: true },
  standard: { label: 'Standard', who: 'Volatile brands', rule: 'Events, targets and goal seek need a rationale. Grid edits only need one when they move more than 5%.', needRat: d => d.kind !== 'override' || Math.abs(d.mag) > 5, needSrc: false, blocks: true },
  open: { label: 'Open', who: 'Pipeline assets', rule: 'Rationale is encouraged but never blocks publishing.', needRat: () => false, needSrc: false, blocks: false },
}
export type DevStatus = 'needs' | 'reviewed' | 'logged'
export function devStatus(d: Dev, tier: Tier): DevStatus {
  const t = TIERS[tier]
  if ((t.needRat(d) && !d.rationale.trim()) || (t.needSrc && !d.source.trim())) return 'needs'
  return d.reviewed ? 'reviewed' : 'logged'
}

export const SEED_DEVS: Dev[] = [
  { id: 'd1', kind: 'event', node: 'brand', label: 'Qulipta DTC campaign', start: idxOf(2027, 0), value: -4, mag: -4, rationale: 'Competitor DTC spend doubled in Q2; analog from 2023 Ubrelvy campaign.', source: 'Competitive intel · Jun 2026', reviewed: true, by: 'M. Ortiz', at: 'Sep 12' },
  { id: 'd2', kind: 'event', node: 'brand', label: 'Pediatric label expansion', start: idxOf(2027, 6), value: 3, mag: 3, rationale: '', source: '', reviewed: false, by: 'M. Ortiz', at: 'Sep 18' },
  { id: 'd3', kind: 'target', node: 'cls', label: 'Class share exit at 38%', start: ACT, end: idxOf(2030, 11), value: 38, shape: 's-curve', mag: 6, rationale: 'Aligned with CGRP class consensus from the brand team offsite.', source: 'IQVIA class outlook 2026', reviewed: false, by: 'M. Ortiz', at: 'Sep 20' },
  { id: 'd4', kind: 'event', node: 'brand', label: 'Generic entry (LOE)', start: idxOf(2033, 0), value: -60, mag: -60, rationale: 'LOE erosion per CoE generic analog curve, month 1–6 ramp.', source: 'CoE LOE analog library', reviewed: true, by: 'K. Brandt', at: 'Aug 30' },
  { id: 'd5', kind: 'override', node: 'price', label: 'Jan 27 net price', start: idxOf(2027, 0), value: 305, mag: 4.1, rationale: '', source: '', reviewed: false, by: 'M. Ortiz', at: 'Sep 22' },
]

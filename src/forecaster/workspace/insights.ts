import { SEED_EVENTS, SEED_SCENARIOS, UNBIASED, adjusted, applyEvents, fmtRev, fySum, revenue, workingLayer, DRV } from './engine'
import type { ChartSeries } from './ui'
import { COLOR } from './ui'
import type { Snap } from './insightsCtx'

export type Person = { id: string; name: string; role: string; color: string }
export const ME = 'me'
export const PEOPLE: Person[] = [
  { id: 'me', name: 'J. Andersen', role: 'Forecaster · you', color: '#2E29FF' },
  { id: 'priya', name: 'Priya Nair', role: 'Brand lead', color: '#0e7490' },
  { id: 'daniel', name: 'Daniel Reyes', role: 'Finance', color: '#a35a00' },
  { id: 'tom', name: 'Tom Becker', role: 'Market access', color: '#0a7d4f' },
  { id: 'sara', name: 'Sara Lindqvist', role: 'Commercial analytics', color: '#7c3aed' },
  { id: 'aiko', name: 'Aiko Tanaka', role: 'Forecasting CoE', color: '#c4122f' },
]
export const person = (id: string) => PEOPLE.find(p => p.id === id) ?? PEOPLE[0]!

export type Msg = { id: string; by: string; text: string; at: string; parent?: string }
export type InsightKind = 'View' | 'Scenario' | 'Note'
export type Insight = {
  id: string; brandId: string; brand: string; cycle: string; kind: InsightKind; title: string; note: string
  snap?: Snap; scenario?: string; by: string; at: string; pinned?: boolean; tagged: string[]; thread: Msg[]
}

/* Illustrative scaling so each brand's saved graphs look distinct. */
export const BRAND_SCALE: Record<string, number> = { nurtec: 1, vyndaq: 0.62, zavzpret: 0.4, abrysvo: 0.8, cibinqo: 0.45, elrexfio: 1.3 }
const work = workingLayer({})
export const scenarioLayer = (id: string) => {
  const s = SEED_SCENARIOS.find(x => x.id === id)!
  return applyEvents(adjusted(work, s.adj), SEED_EVENTS.filter(e => s.active.includes(e.id)))
}
export const scenarioName = (id: string) => SEED_SCENARIOS.find(x => x.id === id)!.name
const k = (a: number[], m: number) => a.map(v => v * m)
export const brandRev = (brandId: string, scId: string) => k(revenue(scenarioLayer(scId)), BRAND_SCALE[brandId] ?? 1)
export const fy27 = (brandId: string, scId: string) => fySum(brandRev(brandId, scId))

export function scenarioSeries(brandId: string, ids: string[]): ChartSeries {
  const m = BRAND_SCALE[brandId] ?? 1, ref = k(revenue(UNBIASED), m)
  return {
    actual: ref, unbiased: ref, scenario: brandRev(brandId, ids[0]!), scenarioName: scenarioName(ids[0]!),
    extra: ids.slice(1).map((id, i) => ({ name: scenarioName(id), color: COLOR.alt[(i + 1) % COLOR.alt.length]!, series: brandRev(brandId, id) })),
  }
}
export const revSnap = (series: ChartSeries, grain: 'month' | 'year' = 'month'): Snap => ({ series, unit: '$M', dp: 0, fmt: v => fmtRev(v, 1), grain })
export function driverSnap(brandId: string, id: 'share' | 'access' | 'price'): Snap {
  const d = DRV[id], l = scenarioLayer('sc2'), m = id === 'price' ? 1 : 1
  void brandId
  return { series: { actual: UNBIASED[id].map(v => v * m), unbiased: UNBIASED[id], working: l[id], scenarioName: 'Base Case' }, unit: d.unit, dp: d.dp, fmt: v => `${v.toFixed(d.dp)}${d.unit === '%' ? '%' : ''}`, grain: 'month' }
}

const msg = (id: string, by: string, text: string, at: string, parent?: string): Msg => ({ id, by, text, at, parent })
const FY = (b: string, s: string) => fmtRev(fy27(b, s))
const gap = (b: string, a: string, c: string) => fmtRev(Math.abs(fy27(b, a) - fy27(b, c)))

export const SEED_INSIGHTS: Insight[] = [
  { id: 's1', brandId: 'nurtec', brand: 'Nurtec', cycle: 'AOP 2027', kind: 'Scenario', scenario: 'Optimistic vs Base Case', by: 'me', at: 'Today, 9:12', pinned: true, tagged: ['priya', 'daniel'],
    title: 'Optimistic opens a gap to Base Case from mid-2027',
    note: `The pediatric label expansion is what separates the two. Optimistic reaches ${FY('nurtec', 'sc3')} for FY27 against ${FY('nurtec', 'sc2')} in Base Case, a gap of ${gap('nurtec', 'sc3', 'sc2')}.`,
    snap: revSnap(scenarioSeries('nurtec', ['sc3', 'sc2'])),
    thread: [msg('s1a', 'priya', 'Regulatory timing is still the swing factor. Can we see the same view with the label decision slipping to Q4?', 'Today, 9:40'), msg('s1b', 'me', 'Good call @Priya Nair. I will add a delayed-approval scenario and share it here.', 'Today, 9:52', 's1a'), msg('s1c', 'daniel', 'Finance case assumes no label upside, so Base Case is the one I will carry into the AOP bridge.', 'Today, 10:05')] },
  { id: 's2', brandId: 'nurtec', brand: 'Nurtec', cycle: 'AOP 2027', kind: 'View', scenario: 'Base Case', by: 'sara', at: 'Yesterday, 16:30', tagged: ['me', 'tom'],
    title: 'Share flattens once the formulary ramp completes',
    note: 'Share climbs for six months after the Part D win, then returns to the reference slope. We should not extrapolate the ramp past mid-2027.',
    snap: driverSnap('nurtec', 'share'),
    thread: [msg('s2a', 'tom', 'Agree. Two of the plans have a prior-auth step, so the ramp could be slower than six months.', 'Yesterday, 17:02')] },
  { id: 's3', brandId: 'nurtec', brand: 'Nurtec', cycle: 'AOP 2027', kind: 'Note', by: 'me', at: 'Mon, 14:05', tagged: ['daniel'],
    title: 'Pricing committee: WAC +2.5% assumed in Base Case',
    note: 'Gross-to-net absorbs about a third of the increase. If the committee lands below 2.0% we should revisit the January WAC event.', thread: [] },
  { id: 'v1', brandId: 'vyndaq', brand: 'Vyndaq', cycle: 'AOP 2027', kind: 'Scenario', scenario: 'Pessimistic vs Base Case', by: 'daniel', at: 'Today, 8:20', tagged: ['me'],
    title: `Downside case costs ${gap('vyndaq', 'sc4', 'sc2')} of FY27 net revenue`,
    note: 'Pessimistic drops the formulary win and takes half a point off share. Finance wants the downside visible in the review pack.',
    snap: revSnap(scenarioSeries('vyndaq', ['sc4', 'sc2']), 'year'),
    thread: [msg('v1a', 'me', 'Saved with the annual toggle so it reads cleanly in the pack. @Daniel Reyes is half a point the right downside?', 'Today, 8:41')] },
  { id: 'v2', brandId: 'vyndaq', brand: 'Vyndaq', cycle: 'AOP 2027', kind: 'View', scenario: 'Base Case', by: 'tom', at: 'Tue, 11:48', tagged: ['priya'],
    title: 'Access gain is front-loaded into Q1 2027',
    note: 'Most of the coverage step happens in the first quarter, so any slip in plan decisions hits the full year.', snap: driverSnap('vyndaq', 'access'), thread: [] },
  { id: 'c1', brandId: 'cibinqo', brand: 'Corvane', cycle: 'Q3 reforecast', kind: 'View', scenario: 'Submitted', by: 'sara', at: 'Mon, 10:15', tagged: [],
    title: 'Actuals are tracking above the reference baseline',
    note: 'Three consecutive months above the statistical trend. Worth checking whether this is timing or a real step change before the next cycle.',
    snap: revSnap(scenarioSeries('cibinqo', ['sc2'])), thread: [msg('c1a', 'aiko', 'Data release notes show a one-off stocking order in May. I would treat part of it as timing.', 'Mon, 11:30')] },
  { id: 'l1', brandId: 'abrysvo', brand: 'Lumera', cycle: 'AOP 2027', kind: 'Note', by: 'aiko', at: 'Last week', tagged: ['me', 'tom'],
    title: 'EU5 access module is not in the published model',
    note: 'Access is held at the reference trend for Lumera until the CoE publishes the next model version. Treat share upside with caution.', thread: [] },
]

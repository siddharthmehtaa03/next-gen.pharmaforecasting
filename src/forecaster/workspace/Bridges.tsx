import { useState } from 'react'
import { GTN, MONTHS, POP, idxOf, netPrice, scenarioLayer } from './engine'
import type { DriverId, EventDef, Layer, Scenario } from './engine'
import type { Calc } from './Stages'
import { Card, Seg, cx, field, PageTitle } from './ui'
import { BUDGET } from './Performance'
import { ChartTip, useHoverTip } from '../../chart/ChartTip'

/* Financial bridges: one attribution engine, three views. Every view walks from the comparison to the scenario by
   substituting one driver (or event) at a time, so the bars always sum exactly to the change. */
type Plane = { name: string; l: Layer; w: number[]; gtn: number }
type Step = { label: string; sub: string; v: number }
const DRV: DriverId[] = ['diag', 'treat', 'access', 'share', 'rx', 'price']
const DRV_LABEL: Record<DriverId, string> = { diag: 'Diagnosis rate', treat: 'Treatment rate', access: 'Access', share: 'Brand share', rx: 'Total prescriptions', price: 'Weighted gross price' }
// Budget plans 0.4 pt less gross-to-net than the scenarios (placeholder plane, as on Performance).
const BUDGET_GTN = GTN - 0.004
const PERIODS = [{ id: 'ytd', label: `YTD ${MONTHS[6]} 2026` }, { id: '2026', label: 'FY2026' }, { id: '2027', label: 'FY2027' }, { id: '2028', label: 'FY2028' }] as const
type PeriodId = (typeof PERIODS)[number]['id']

const series = (p: Plane) => Object.fromEntries(DRV.map(d => [d, p.w.map(i => p.l[d][i]!)])) as Record<DriverId, number[]>
const netOf = (s: Record<DriverId, number[]>) => s.diag.reduce((a, _, k) => a + POP * (s.diag[k]! / 100) * (s.treat[k]! / 100) * (s.access[k]! / 100) * (s.share[k]! / 100) * s.rx[k]! * netPrice(s.price[k]!) / 1e6, 0)
const trxOf = (s: Record<DriverId, number[]>) => s.diag.reduce((a, _, k) => a + POP * (s.diag[k]! / 100) * (s.treat[k]! / 100) * (s.access[k]! / 100) * (s.share[k]! / 100) * s.rx[k]!, 0)
const $m = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
const $d = (v: number) => `${v >= 0 ? '+' : '−'}${$m(Math.abs(v))}`
const pct = (v: number) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)}%`

export function BridgesView({ scenarios, calc, events, selId }: { scenarios: Scenario[]; calc: Calc; events: EventDef[]; selId: string }) {
  const [scId, setScId] = useState(selId)
  const [cmp, setCmp] = useState('budget')
  const [period, setPeriod] = useState<PeriodId>('2027')
  const [mode, setMode] = useState<'finance' | 'drivers' | 'events'>('finance')
  const tip = useHoverTip()
  const [hv, setHv] = useState<number | null>(null)
  const sc = scenarios.find(s => s.id === scId) ?? scenarios[0]!
  const W = period === 'ytd' ? Array.from({ length: 7 }, (_, m) => idxOf(2026, m)) : Array.from({ length: 12 }, (_, m) => idxOf(+period, m))
  const pLabel = PERIODS.find(p => p.id === period)!.label
  const to: Plane = { name: sc.name, l: calc[sc.id]!.layer, w: W, gtn: GTN }
  const work = calc.__working!.layer
  const from: Plane = mode === 'events' || cmp === 'work' ? { name: 'Active forecast', l: work, w: W, gtn: GTN }
    : cmp === 'budget' ? { name: 'Budget', l: BUDGET, w: W, gtn: BUDGET_GTN }
    : cmp === 'ly' ? { name: 'Last year', l: to.l, w: W.map(i => i - 12), gtn: GTN }
    : { name: scenarios.find(s => s.id === cmp)?.name ?? 'Scenario', l: calc[cmp]!.layer, w: W, gtn: GTN }

  const a = series(from), b = series(to), start = netOf(a), end = netOf(b)
  let steps: Step[]
  if (mode === 'finance') {
    // Price–volume–GtN on gross price per Rx: volume at the starting price, price at the new volume, then the GtN rate.
    const ta = trxOf(a), tb = trxOf(b), gpa = start / ta / (1 - from.gtn), gpb = end / tb / (1 - to.gtn)
    steps = [
      { label: 'Volume (demand)', sub: 'units', v: (tb - ta) * gpa * (1 - from.gtn) },
      { label: 'Channel inventory & unexplained', sub: 'ex-factory vs demand', v: 0 },
      { label: 'Price (WAC)', sub: 'list', v: tb * (gpb - gpa) * (1 - from.gtn) },
      { label: 'Gross-to-net', sub: 'rate', v: -tb * gpb * (to.gtn - from.gtn) },
    ]
  } else if (mode === 'drivers') {
    const cur = { ...a }; let prev = start
    steps = DRV.map(d => { cur[d] = b[d]; const n = netOf(cur), v = n - prev; prev = n; return { label: DRV_LABEL[d], sub: 'model driver', v } })
  } else {
    const on = events.filter(e => sc.active.includes(e.id)); let prev = start
    steps = on.map((e, k) => { const n = netOf(series({ ...to, l: scenarioLayer(work, { ...sc, adj: {}, ovr: [], active: on.slice(0, k + 1).map(x => x.id) }, events) })); const v = n - prev; prev = n; return { label: e.name, sub: `${e.prob}% likely`, v } })
    steps.push({ label: 'Adjustments & overrides', sub: 'scenario-only', v: end - prev })
  }
  const total = end - start, sum = steps.reduce((x, s) => x + s.v, 0), ok = Math.abs(sum - total) < 0.05
  const lift = [...steps].sort((x, y) => y.v - x.v)[0], drag = [...steps].sort((x, y) => x.v - y.v)[0]

  // Waterfall geometry: the value axis does not start at zero so movements are readable.
  const bars: { label: string; sub: string; y0: number; y1: number; kind: 'start' | 'up' | 'down' | 'end'; v: number }[] = []
  let run = start
  bars.push({ label: from.name, sub: '', y0: 0, y1: start, kind: 'start', v: start })
  steps.forEach(s => { bars.push({ label: s.label, sub: s.sub, y0: run, y1: run + s.v, kind: s.v >= 0 ? 'up' : 'down', v: s.v }); run += s.v })
  bars.push({ label: to.name, sub: '', y0: 0, y1: end, kind: 'end', v: end })
  const tops = bars.flatMap(x => x.kind === 'start' || x.kind === 'end' ? [x.y1] : [x.y0, x.y1])
  const lo0 = Math.min(...tops), hi0 = Math.max(...tops), padV = (hi0 - lo0) * 0.35 || hi0 * 0.02, lo = lo0 - padV, hi = hi0 + padV * 0.6
  const VW = 1000, TOP = 26, H = 250, L = 64, slot = (VW - L - 10) / bars.length, bw = Math.min(90, slot * 0.6)
  const y = (v: number) => TOP + (1 - (Math.max(lo, v) - lo) / (hi - lo)) * H
  const ticks = Array.from({ length: 5 }, (_, k) => lo + ((hi - lo) * k) / 4)
  const FILL = { start: '#0b0f2e', end: '#2E29FF', up: '#4f8a64', down: '#c0434f' }

  return (
    <div className="space-y-5">
      <PageTitle title="Financial bridges" info="What moved net revenue between two forecasts. Read-only; follows your scenarios and events." />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-text-2">Scenario</span>
            <select value={sc.id} onChange={e => setScId(e.target.value)} className={cx(field, 'w-44')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-text-2">Compare against</span>
            <select value={mode === 'events' ? 'work' : cmp} disabled={mode === 'events'} onChange={e => setCmp(e.target.value)} className={cx(field, 'w-44')}>
              <option value="budget">Budget</option><option value="ly">Last year</option><option value="work">Active forecast</option>
              {scenarios.filter(s => s.id !== sc.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <div><span className="mb-1 block text-[12.5px] font-medium text-text-2">Period</span>
            <Seg label="Period" value={period} onChange={setPeriod} options={PERIODS.map(p => ({ id: p.id, label: p.label }))} /></div>
          <p className="ml-auto max-w-sm text-[12px] text-text-3">One attribution engine, three views. The commercial drivers add up exactly to Finance’s volume and channel bars, so both teams quote the same movement.</p>
        </div>
      </Card>

      <Card title={`Net revenue bridge · ${from.name} → ${to.name} · ${pLabel}`}
        right={<Seg label="Bridge view" value={mode} onChange={setMode} options={[{ id: 'finance', label: 'Finance · price–volume–GtN' }, { id: 'drivers', label: 'Commercial · model drivers' }, { id: 'events', label: 'Commercial · by event (vs forecast)' }]} />}>
        <div ref={tip.wrap} className="relative">
        <svg viewBox={`0 0 ${VW} ${TOP + H + 52}`} className="w-full" role="img" aria-label={`Waterfall from ${from.name} ${$m(start)} to ${to.name} ${$m(end)}`}>
          {ticks.map(t => <g key={t}><line x1={L} x2={VW - 10} y1={y(t)} y2={y(t)} stroke="#ebebed" strokeDasharray="4 4" /><text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-[#8f9199] text-[11px]">{`$${Math.round(t).toLocaleString('en-US')}M`}</text></g>)}
          {bars.map((x, k) => {
            const cx0 = L + slot * k + slot / 2, top = Math.min(y(x.y0), y(x.y1)), ht = Math.max(2, Math.abs(y(x.y1) - y(x.y0))), solid = x.kind === 'start' || x.kind === 'end'
            const next = bars[k + 1]
            const card = (
              <ChartTip title={x.sub ? `${x.label} · ${x.sub}` : x.label} sections={[{ rows: solid
                ? [
                    { label: x.kind === 'start' ? from.name : to.name, value: $m(x.v) },
                    ...(x.kind === 'end' ? [{ label: `Change vs ${from.name}`, value: `${$d(total)} (${pct((total / start) * 100)})`, tone: total >= 0 ? 'ok' as const : 'err' as const }] : []),
                  ]
                : [
                    { label: 'Impact', value: $d(x.v), tone: x.v >= 0 ? 'ok' as const : 'err' as const },
                    { label: '% of start', value: pct((x.v / start) * 100) },
                    { label: 'Share of change', value: total ? pct((x.v / total) * 100) : '—' },
                    { label: 'Running total', value: $m(x.y1) },
                  ] }]} />
            )
            return (
              <g key={k} opacity={hv === null || hv === k ? 1 : 0.5} onPointerEnter={e => { setHv(k); tip.move(e, card) }} onPointerMove={e => tip.move(e, card)} onPointerLeave={() => { setHv(null); tip.hide() }}>
                <rect x={L + slot * k} y={TOP - 20} width={slot} height={H + 74} fill="transparent" />
                <rect x={cx0 - bw / 2} y={solid ? y(x.y1) : top} width={bw} height={solid ? TOP + H - y(x.y1) : ht} fill={FILL[x.kind]} rx={2} />
                {next && <line x1={cx0 + bw / 2} x2={cx0 + slot - bw / 2} y1={y(x.kind === 'start' ? x.y1 : x.kind === 'end' ? x.y1 : x.y1)} y2={y(x.kind === 'start' ? x.y1 : x.y1)} stroke="#8f9199" strokeDasharray="2 3" />}
                <text x={cx0} y={(solid ? y(x.y1) : top) - 7} textAnchor="middle" className={cx('text-[12.5px] font-semibold', x.kind === 'up' ? 'fill-[#0a7d4f]' : x.kind === 'down' ? 'fill-[#c4122f]' : 'fill-[#1c1d21]')}>{solid ? $m(x.v) : $d(x.v)}</text>
                <text x={cx0} y={TOP + H + 18} textAnchor="middle" className={cx('text-[12px]', solid ? 'fill-[#1c1d21] font-semibold' : 'fill-[#1c1d21]')}>{x.label.length > 24 ? `${x.label.slice(0, 23)}…` : x.label}</text>
                {x.sub && <text x={cx0} y={TOP + H + 33} textAnchor="middle" className="fill-[#8f9199] text-[11px]">{x.sub}</text>}
              </g>)
          })}
        </svg>
        {tip.node}
        </div>
        <p className="mt-1 text-[12px] text-text-3">The value axis does not start at zero, so the movements are readable.</p>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-left text-[12px] text-text-3"><th className="py-2 font-medium">Driver</th><th className="py-2 text-right font-medium">Impact</th><th className="py-2 text-right font-medium">% of start</th><th className="py-2 text-right font-medium">Share of change</th></tr></thead>
            <tbody>
              {steps.map(s => <tr key={s.label} className="border-b border-border"><td className="py-2">{s.label}</td><td className={cx('py-2 text-right tabular-nums', s.v > 0.05 ? 'text-ok' : s.v < -0.05 ? 'text-err' : 'text-text-2')}>{$d(s.v)}</td><td className="py-2 text-right tabular-nums text-text-2">{pct((s.v / start) * 100)}</td><td className="py-2 text-right tabular-nums text-text-2">{total ? `${Math.round((s.v / total) * 100)}%` : '—'}</td></tr>)}
              <tr className="bg-surface-2/60 font-semibold"><td className="py-2 pl-1">Total change</td><td className="py-2 text-right tabular-nums">{$d(total)}</td><td className="py-2 text-right tabular-nums">{pct((total / start) * 100)}</td><td className="py-2 text-right tabular-nums">100%</td></tr>
            </tbody>
          </table>
          <div className="space-y-2.5">
            <p className="rounded-lg border-l-2 border-brand bg-brand-soft/40 px-4 py-3 text-[13px]"><b className="font-semibold">Read-out:</b> {to.name} is {$d(total)} ({pct((total / start) * 100)}) against {from.name} for {pLabel}.{lift && lift.v > 0.05 && <> The biggest lift is {lift.label} ({$d(lift.v)})</>}{drag && drag.v < -0.05 && <>; the biggest drag is {drag.label} ({$d(drag.v)})</>}.</p>
            <p className={cx('rounded-lg px-4 py-2.5 text-[13px]', ok ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err')}>{ok ? 'Reconciles: the bars sum to the change exactly.' : `Does not reconcile: bars sum to ${$d(sum)}.`}</p>
            <p className="text-[12px] text-text-3">{mode === 'events' ? 'By event always starts from the active forecast and adds each switched-on event in turn; adjustments and overrides close the gap.' : from.name === 'Budget' ? 'Budget is the placeholder plane used on Performance until the FP&A plane is connected. Its bars will change once real budget drivers load.' : 'Both sides are read from the same forecast engine, so the movement is like for like.'}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

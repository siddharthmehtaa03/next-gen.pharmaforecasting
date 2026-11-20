import { useMemo, useState } from 'react'
import { GTN, MONTHS, POP, idxOf, netPrice, scenarioLayer } from './engine'
import type { DriverId, EventDef, Layer, Scenario } from './engine'
import type { Calc } from './Stages'
import { Card, PageHeader, PageTitle, Seg, cx, field } from './ui'
import { BUDGET } from './Performance'
import { ChartTip, useHoverTip } from '../../chart/ChartTip'
import { ChartActions } from '../../chart/ChartActions'

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
const capt = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3'
const pct = (v: number) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)}%`

export function BridgesView({ scenarios, calc, events, selId }: { scenarios: Scenario[]; calc: Calc; events: EventDef[]; selId: string }) {
  const [scId, setScId] = useState(selId)
  const [cmp, setCmp] = useState('budget')
  const [period, setPeriod] = useState<PeriodId>('2027')
  const [mode, setMode] = useState<'finance' | 'drivers'>('finance')
  const tip = useHoverTip()
  const [hv, setHv] = useState<number | null>(null)
  const sc = scenarios.find(s => s.id === scId) ?? scenarios[0]!
  const W = period === 'ytd' ? Array.from({ length: 7 }, (_, m) => idxOf(2026, m)) : Array.from({ length: 12 }, (_, m) => idxOf(+period, m))
  const pLabel = PERIODS.find(p => p.id === period)!.label
  const to: Plane = { name: sc.name, l: calc[sc.id]!.layer, w: W, gtn: GTN }
  const work = calc.__working!.layer
  const from: Plane = cmp === 'work' ? { name: 'Active forecast', l: work, w: W, gtn: GTN }
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
  } else {
    const cur = { ...a }; let prev = start
    steps = DRV.map(d => { cur[d] = b[d]; const n = netOf(cur), v = n - prev; prev = n; return { label: DRV_LABEL[d], sub: 'model driver', v } })
  }
  const onEv = events.filter(e => sc.active.includes(e.id)).slice().sort((x, y) => x.date - y.date)
  const evKey = `${sc.id}|${onEv.map(e => e.id).join(',')}|${period}|${scId}`
  const eventRows = useMemo(() => {
    const net = (ids: string[]) => netOf(series({ ...to, l: scenarioLayer(work, { ...sc, adj: {}, ovr: [], active: ids }, events) }))
    let prev = net([])
    return onEv.map((e, k) => { const n = net(onEv.slice(0, k + 1).map(x => x.id)); const v = n - prev; prev = n; return { e, v } })
  }, [evKey])  // eslint-disable-line react-hooks/exhaustive-deps
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
      <PageHeader><PageTitle title="Financial bridges" info="What moved net revenue between two forecasts. Read-only; follows your scenarios and events." /></PageHeader>

      <Card>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="block"><span className={capt}>Scenario</span>
            <select value={sc.id} onChange={e => setScId(e.target.value)} className={cx(field, 'w-44')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="block"><span className={capt}>Compare against</span>
            <select value={cmp} onChange={e => setCmp(e.target.value)} className={cx(field, 'w-44')}>
              <option value="budget">Budget</option><option value="ly">Last year</option><option value="work">Active forecast</option>
              {scenarios.filter(s => s.id !== sc.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <div><span className={capt}>Period</span>
            <Seg label="Period" value={period} onChange={setPeriod} options={PERIODS.map(x => ({ id: x.id, label: x.label }))} /></div>
          <div><span className={capt}>View</span>
            <Seg label="Bridge view" value={mode} onChange={setMode} options={[{ id: 'finance', label: 'Finance · price–volume–GtN' }, { id: 'drivers', label: 'Commercial · model drivers' }]} /></div>
        </div>
      </Card>

      <Card title={`Net revenue bridge · ${from.name} → ${to.name} · ${pLabel}`}
          right={<ChartActions target="financial-bridge-chart" title="Net revenue bridge" subtitle={`${from.name} → ${to.name} · ${pLabel}`} />}>
        <div id="financial-bridge-chart" ref={tip.wrap} className="relative">
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
          <p className="mt-1 text-[12px] text-text-3">The value axis does not start at zero, so the movements are readable. Hover a bar for its exact value.</p>
        </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card title="What moved">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-3">
                <th className="py-2 font-semibold">Driver</th><th className="py-2 text-right font-semibold">Impact</th>
                <th className="py-2 text-right font-semibold">% of start</th><th className="py-2 text-right font-semibold">Share of change</th></tr></thead>
              <tbody>
                {steps.map(s => <tr key={s.label} className="border-b border-border"><td className="py-2">{s.label}</td>
                  <td className={cx('py-2 text-right font-mono', s.v > 0 ? 'text-ok' : s.v < 0 ? 'text-err' : 'text-text-2')}>{$d(s.v)}</td>
                  <td className="py-2 text-right font-mono text-text-2">{pct((s.v / start) * 100)}</td>
                  <td className="py-2 text-right font-mono text-text-2">{total ? pct((s.v / total) * 100) : '—'}</td></tr>)}
                <tr className="bg-surface-2/60 font-semibold"><td className="py-2">Total change</td>
                  <td className="py-2 text-right font-mono">{$d(total)}</td>
                  <td className="py-2 text-right font-mono">{pct((total / start) * 100)}</td>
                  <td className="py-2 text-right font-mono">100%</td></tr>
              </tbody>
            </table>
          </Card>

          <Card title="Events behind these drivers" info="Each switched-on event, and what it adds to net revenue over the period.">
            {eventRows.length === 0
              ? <p className="py-2 text-[13px] text-text-3">No events are switched on in {sc.name}.</p>
              : <ul>{eventRows.map(({ e, v }) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0">
                    <span className="min-w-0"><span className="block text-[13.5px] font-medium">{e.name}</span>
                      <span className="block text-[12px] text-text-3">{e.impacts.length
                        ? `moves ${e.impacts.map(i => `${DRV_LABEL[i.metric].toLowerCase()} ${i.dir === 'up' ? '+' : '−'}${i.mag}%`).join(', ')}`
                        : e.sub === 'Gross-to-Net / Rebate Change' ? 'moves gross-to-net, not gross' : 'no modelled driver move'}</span></span>
                    <span className={cx('shrink-0 font-mono text-[13px] font-semibold', v >= 0 ? 'text-ok' : 'text-err')}>{$d(v)}</span>
                  </li>))}</ul>}
            <p className="mt-3 text-[12px] text-text-3">An event moves the same drivers shown above, so its effect is already inside those bars. This list splits out what each event adds to net revenue for the period, in date order.</p>
          </Card>
      </div>

      <div className="space-y-2.5">
          <p className="rounded-lg border-l-2 border-brand bg-brand-soft/40 px-4 py-3 text-[13px]"><b className="font-semibold">Read-out:</b> {to.name} is {$d(total)} ({pct((total / start) * 100)}) against {from.name} for {pLabel}. The biggest lift is {lift!.label} ({$d(lift!.v)}); the biggest drag is {drag!.label} ({$d(drag!.v)}).</p>
          <p className={cx('rounded-lg px-4 py-2.5 text-[13px]', ok ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err')}>{ok ? '✓ Reconciles: the bars sum to the change exactly.' : 'The bars do not reconcile with the total. Check the drivers.'}</p>
          {cmp === 'budget' && <p className="text-[12px] text-text-3">Budget is the placeholder plane used on the Performance dashboard until the FP&amp;A plane is connected: the statistical trend with 3% more volume and 0.4 pt less gross-to-net. Its bars will change once real Budget drivers load.</p>}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ACT, MONTHS, OUTPUTS, UNBIASED, idxOf, yearOf } from './engine'
import type { Layer, Scenario } from './engine'
import type { Calc } from './Stages'
import { COLOR, Card, Seg, Tag, cx, field, PageTitle } from './ui'
import { bridgeOf } from './Modules'

/* Performance summary (Analytics): how the forecast is tracking against budget, last year and its own trend.
   shortcut: no FP&A budget feed yet; the budget plane is the reference baseline with +0.15 pt share and +3% price, and plans no unexplained difference. */
export const BUDGET: Layer = { ...UNBIASED, share: UNBIASED.share.map(v => v + 0.15), price: UNBIASED.price.map(v => v * 1.03) }
type Period = 'ytd' | 'month' | 'quarter' | 'fy'
type K = { net: number; trx: number; mkt: number; share: number; inv: number; allow: number; ue: number; gross: number; tud: number }
type KpiId = 'net' | 'mkt' | 'share' | 'inv' | 'allow' | 'ue'

function kpis(l: Layer, w: number[], uePct: number): K {
  const rev = OUTPUTS.rev.fn(l), trx = OUTPUTS.trx.fn(l), ok = w.filter(i => i >= 0)
  const net = ok.reduce((a, i) => a + rev[i]!, 0), t = ok.reduce((a, i) => a + trx[i]!, 0)
  const b = bridgeOf(net, uePct)
  return { net, trx: t, mkt: ok.reduce((a, i) => a + trx[i]! / (l.share[i]! / 100), 0), share: ok.reduce((a, i) => a + l.share[i]!, 0) / (ok.length || 1), inv: b.inv, allow: b.gross - net, ue: b.ueD, gross: b.gross, tud: b.tud }
}

const $m = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString('en-US') : Math.abs(v).toFixed(1)}M`
const $d = (v: number) => `${v >= 0 ? '+' : '−'}${$m(Math.abs(v))}`
const pc = (a: number, b: number) => (b ? ((a / b - 1) * 100) : 0)
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`
const kfmt = (v: number) => `${Math.round(v).toLocaleString('en-US')}K`

const KPIS: { id: KpiId; label: string; tag: string; fmt: (v: number) => string; delta: 'pct' | 'pts' | 'abs'; good: 1 | -1 | 0 }[] = [
  { id: 'net', label: 'Net sales', tag: 'Funnel exit', fmt: $m, delta: 'pct', good: 1 },
  { id: 'mkt', label: 'Market TRx', tag: 'Eligible pool', fmt: kfmt, delta: 'pct', good: 1 },
  { id: 'share', label: 'TRx share', tag: 'Capture', fmt: v => `${v.toFixed(1)}%`, delta: 'pts', good: 1 },
  { id: 'inv', label: 'Inventory change', tag: 'Channel', fmt: $m, delta: 'abs', good: 0 },
  { id: 'allow', label: 'Total sales allowances', tag: 'Access / GTN', fmt: $m, delta: 'pct', good: -1 },
  { id: 'ue', label: 'Unexplained difference', tag: 'Data artifact', fmt: $m, delta: 'abs', good: 0 },
]

export function PerformanceView({ brand, scenarios, calc, selId, uePct }: { brand: string; scenarios: Scenario[]; calc: Calc; selId: string; uePct: number }) {
  const last = ACT - 1
  const [scId, setScId] = useState(selId)
  const [period, setPeriod] = useState<Period>('ytd')
  const [year, setYear] = useState(yearOf(last))
  const [thru, setThru] = useState(last % 12)
  const [kpi, setKpi] = useState<KpiId>('net')
  const sc = scenarios.find(s => s.id === scId) ?? scenarios[0]!, layer = calc[sc.id]!.layer
  const months = period === 'fy' ? [...Array(12).keys()] : period === 'month' ? [thru] : period === 'quarter' ? Array.from({ length: thru % 3 + 1 }, (_, k) => thru - thru % 3 + k) : Array.from({ length: thru + 1 }, (_, k) => k)
  const W = months.map(m => idxOf(year, m)), LY = W.map(i => i - 12)
  const label = period === 'fy' ? `FY${year}` : period === 'month' ? `${MONTHS[thru]} ${year}` : `${period === 'ytd' ? 'YTD' : `Q${Math.floor(thru / 3) + 1}`} through ${MONTHS[thru]} ${year}`
  const cur = useMemo(() => kpis(layer, W, uePct), [layer, W.join(), uePct])
  const bud = kpis(BUDGET, W, 0), ly = kpis(layer, LY, uePct)
  const deltaOf = (d: (typeof KPIS)[number], a: K, b: K) => { const x = a[d.id], y = b[d.id]; return d.delta === 'pct' ? pc(x, y) : x - y }
  const deltaTxt = (d: (typeof KPIS)[number], v: number) => d.delta === 'pct' ? pct(v) : d.delta === 'pts' ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pt` : $d(v)
  const toneOf = (d: (typeof KPIS)[number], v: number) => Math.abs(v) < 0.05 || d.good === 0 ? 'bg-warn-soft text-warn' : v * d.good > 0 ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'
  const monthly = (l: Layer, id: KpiId, y: number, ue: number) => Array.from({ length: 12 }, (_, m) => kpis(l, [idxOf(y, m)], ue)[id])
  const def = KPIS.find(k => k.id === kpi)!
  const trend = useMemo(() => { const s = monthly(layer, kpi, year, uePct), b = monthly(BUDGET, kpi, year, 0), p = monthly(layer, kpi, year - 1, uePct); return MONTHS.map((m, k) => ({ m, sc: s[k], bud: b[k], ly: p[k] })) }, [layer, kpi, year, uePct])
  const actEnd = year === yearOf(last) ? last % 12 : year < yearOf(last) ? 11 : -1

  // Insights, worked from the same window.
  const perRxB = bud.net / bud.trx, volume = (cur.trx - bud.trx) * perRxB, mix = cur.net - bud.net - volume
  const work = kpis(calc.__working!.layer, W, uePct), rev = OUTPUTS.rev.fn(layer), l = W[W.length - 1]!
  const mm = pc(rev[l]!, rev[l - 1]!), mmLY = pc(rev[l - 12]!, rev[l - 13]!), r3 = pc(rev[l]! + rev[l - 1]! + rev[l - 2]!, rev[l - 3]! + rev[l - 4]! + rev[l - 5]!)
  const booked = W.filter(i => i < ACT).length / W.length, uePg = cur.ue / cur.gross * 100
  const lead = Math.abs(volume) >= Math.abs(mix) ? ['volume', volume] as const : ['price and mix', mix] as const
  const insights: [string, string][] = [
    ['Vs budget · plan execution', `Volume ${$d(volume)} (prescriptions ${pct(pc(cur.trx, bud.trx))}), price and mix ${$d(mix)}. Budget is a placeholder plane, so read the direction and the mix of causes, not the exact dollars.`],
    ['Growth vs last year · underlying momentum', `Net revenue ${pct(pc(cur.net, ly.net))} on last year (${$d(cur.net - ly.net)}). Prescriptions ${pct(pc(cur.trx, ly.trx))}, so price, mix and gross-to-net add ${pct(pc(cur.net, ly.net) - pc(cur.trx, ly.trx))}.`],
    ['Vs the active forecast · what changed', Math.abs(cur.net - work.net) < 0.05 ? `${sc.name} equals the active forecast for these months: no scenario change has reached them yet.` : `${sc.name} is ${$d(cur.net - work.net)} against the active forecast over these months, from its adjustments and events.`],
    ['Vs trend · trajectory and signal', `The last month moved ${pct(mm)} on the one before, against ${pct(mmLY)} in the same month last year; the rolling three months are ${pct(r3)} on the prior three. ${Math.abs(mm - mmLY) < 1.5 ? 'That mirrors last year’s pattern: seasonality, not an inflection.' : 'That breaks from last year’s pattern and is worth a closer look.'}`],
    ['Context and risks', `Forecast confidence: ${booked === 1 ? 'High (every month in the window is booked)' : booked >= 0.5 ? 'Medium (part of the window is forecast)' : 'Low (the window is mostly forecast)'}. Unexplained difference is ${uePg.toFixed(1)}% of gross, ${Math.abs(uePg) <= 5 ? 'inside' : 'outside'} the ±5% trigger.`],
    ['So what, now what', `The brand is ${cur.net >= bud.net ? 'ahead of' : 'behind'} Budget, mostly through ${lead[0]}. ${Math.abs(uePg) <= 5 ? 'The reconciliation is clean enough to present.' : 'Resolve the unexplained difference before presenting.'}`],
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Performance summary" info={`${brand} · ${label} · ${sc.name}. Follows your scenarios and events; nothing here edits the forecast.`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-text-2">Scenario</span>
            <select value={sc.id} onChange={e => setScId(e.target.value)} className={cx(field, 'w-44')}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div><span className="mb-1 block text-[12.5px] font-medium text-text-2">Period</span>
            <Seg label="Period" value={period} onChange={setPeriod} options={[{ id: 'ytd', label: 'YTD' }, { id: 'month', label: 'Month' }, { id: 'quarter', label: 'Quarter' }, { id: 'fy', label: 'Full year' }]} /></div>
          <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-text-2">Year</span>
            <select value={year} onChange={e => setYear(+e.target.value)} className={cx(field, 'w-24')}>{[2026, 2027, 2028].map(y => <option key={y}>{y}</option>)}</select></label>
          {period !== 'fy' && <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-text-2">Through</span>
            <select value={thru} onChange={e => setThru(+e.target.value)} className={cx(field, 'w-24')}>{MONTHS.map((m, k) => <option key={m} value={k}>{m}</option>)}</select></label>}
          <p className="ml-auto max-w-xs text-[12px] text-text-3">Budget is a placeholder until the FP&amp;A plane is connected. Last year is the same months a year earlier.</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {KPIS.map(d => {
          const on = d.id === kpi, vb = deltaOf(d, cur, bud), vl = deltaOf(d, cur, ly), sp = monthly(layer, d.id, year, uePct)
          const lo = Math.min(...sp), hi = Math.max(...sp), pts = sp.map((v, k) => `${(k / 11) * 100},${28 - ((v - lo) / (hi - lo || 1)) * 24}`).join(' ')
          return (
            <button key={d.id} type="button" aria-pressed={on} onClick={() => setKpi(d.id)}
              className={cx('rounded-xl border bg-surface px-4 py-3.5 text-left transition-colors', on ? 'border-[#266df0] ring-2 ring-[#266df0]/15 shadow-[0_1px_2px_rgba(16,24,40,0.06)]' : 'border-border hover:border-border-strong hover:shadow-[0_1px_2px_rgba(16,24,40,0.04)]')}>
              <span className="flex items-start justify-between gap-2"><span className="text-[12.5px] font-medium text-text-2">{d.label}</span><span className="shrink-0 text-[11px] text-text-3">{d.tag}</span></span>
              <span className="mt-1 block text-[22px] font-semibold tracking-tight tabular-nums">{d.fmt(cur[d.id])}</span>
              <span className="mt-1.5 flex flex-wrap gap-1"><span className={cx('rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', toneOf(d, vb))}>{deltaTxt(d, vb)} Bud</span><span className={cx('rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', toneOf(d, vl))}>{deltaTxt(d, vl)} LY</span></span>
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-2 h-7 w-full" aria-hidden><polyline points={pts} fill="none" stroke={on ? COLOR.working : '#8f9199'} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /></svg>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card title={`Trend · ${def.label} · ${year}`} info="Selected scenario against budget and last year. The shaded band is the selected window."
          right={<div className="flex flex-wrap gap-3 text-[12px] text-text-2">{[['Scenario', COLOR.working, ''], ['Budget', '#b7791f', ''], ['Last year', '#8f9199', '4 3']].map(([n, c, dash]) => <span key={n} className="inline-flex items-center gap-1.5"><svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke={c} strokeWidth={2} strokeDasharray={dash} /></svg>{n}</span>)}</div>}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={COLOR.grid} vertical={false} />
                <ReferenceArea x1={MONTHS[months[0]!]} x2={MONTHS[months[months.length - 1]!]} fill={COLOR.working} fillOpacity={0.06} />
                {actEnd >= 0 && actEnd < 11 && <ReferenceLine x={MONTHS[actEnd]} stroke="#b9bed0" strokeDasharray="3 3" label={{ value: 'Actuals end', position: 'insideTopLeft', fontSize: 10, fill: '#8f9199' }} />}
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#8f9199' }} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
                <YAxis tick={{ fontSize: 11, fill: '#8f9199' }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => def.fmt(v)} domain={['auto', 'auto']} />
                <Line dataKey="ly" stroke="#8f9199" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} activeDot={false} />
                <Line dataKey="bud" stroke="#b7791f" strokeWidth={2} dot={false} isAnimationActive={false} activeDot={false} />
                <Line dataKey="sc" stroke={COLOR.working} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Attainment by scenario" info={`Net sales, ${label}. The bar is attainment of budget.`} pad={false}>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-left text-[12px] text-text-3"><th className="px-4 py-2 font-medium">Scenario</th><th className="px-2 py-2 text-right font-medium">Net sales</th><th className="px-2 py-2 text-right font-medium">vs Bud</th><th className="px-2 py-2 text-right font-medium">vs LY</th><th className="px-4 py-2 text-right font-medium">FY{year} vs Bud</th></tr></thead>
            <tbody>{scenarios.map((s, k) => {
              const L = calc[s.id]!.layer, n = kpis(L, W, uePct).net, b = pc(n, bud.net), y = pc(n, kpis(L, LY, uePct).net)
              const fy = pc(kpis(L, [...Array(12).keys()].map(m => idxOf(year, m)), uePct).net, kpis(BUDGET, [...Array(12).keys()].map(m => idxOf(year, m)), 0).net)
              return (
                <tr key={s.id} className={cx('border-b border-border last:border-0', s.id === sc.id && 'bg-surface-2/60')}>
                  <td className="px-4 py-2"><span className="flex items-center gap-1.5 font-medium"><span className="h-2 w-2 rounded-full" style={{ background: s.color ?? COLOR.alt[k % COLOR.alt.length] }} />{s.name}</span>
                    <span className="mt-1 block h-1 w-28 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (n / bud.net) * 100)}%` }} /></span></td>
                  <td className="px-2 py-2 text-right tabular-nums">{$m(n)}</td>
                  <td className={cx('px-2 py-2 text-right tabular-nums', b >= 0 ? 'text-ok' : 'text-err')}>{pct(b)}</td>
                  <td className={cx('px-2 py-2 text-right tabular-nums', y >= 0 ? 'text-ok' : 'text-err')}>{pct(y)}</td>
                  <td className={cx('px-4 py-2 text-right tabular-nums', fy >= 0 ? 'text-ok' : 'text-err')}>{pct(fy)}</td>
                </tr>)
            })}</tbody>
          </table>
        </Card>
      </div>

      <Card title={`Insights · ${label}`} info="Generated from the numbers above for the selected scenario.">
        <p className="rounded-lg border-l-2 border-brand bg-brand-soft/40 px-4 py-3 text-[13.5px]"><b className="font-semibold">Executive anchor:</b> {brand} net revenue for {label} is {$m(cur.net)} in {sc.name}: {pct(pc(cur.net, bud.net))} against Budget ({$d(cur.net - bud.net)}) and {pct(pc(cur.net, ly.net))} against last year, led by {lead[0]} ({$d(lead[1])}).</p>
        <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">{insights.map(([h, t]) => <div key={h}><p className="text-[12.5px] font-semibold text-brand">{h}</p><p className="mt-0.5 text-[13px] leading-relaxed text-text-2">{t}</p></div>)}</div>
      </Card>

      <RevenueRiver k={cur} label={label} scenario={sc.name} />
    </div>
  )
}

/* The revenue river: demand → capture → patients → value → shipments → what survives gross-to-net.
   Allowance and capture splits are the CoE gross-to-net and new-start inputs (illustrative). */
const GTN_SPLIT: [string, number, string][] = [['Commercial rebates', 0.237, '#c4122f'], ['Copay assistance', 0.186, '#d9506a'], ['Medicare Part D', 0.132, '#e27a8c'], ['Medicaid rebates', 0.091, '#eaa0ad'], ['Distribution fees and other', 0.084, '#f0c2ca']]
type RN = { id: string; col: number; label: string; sub: string; v: number; c: string }
function RevenueRiver({ k, label, scenario }: { k: K; label: string; scenario: string }) {
  const gap = Math.abs(k.ue), ueNeg = k.ue < 0
  const nodes: RN[] = [
    { id: 'md', col: 0, label: 'Market demand', sub: `${$m(k.tud)} · ${kfmt(k.mkt)} Rx market · ${k.share.toFixed(1)}% captured`, v: k.tud, c: '#8f9199' },
    { id: 'nb', col: 1, label: 'NBRx · new to brand', sub: $m(k.tud * 0.077), v: k.tud * 0.077, c: '#6f7ae0' },
    { id: 'nr', col: 1, label: 'NRx · other new starts', sub: $m(k.tud * 0.031), v: k.tud * 0.031, c: '#8f98ea' },
    { id: 'rf', col: 1, label: 'Refill · persistence', sub: `${$m(k.tud * 0.892)} · 89.2% of scripts`, v: k.tud * 0.892, c: '#9aa2f0' },
    { id: 'ps', col: 2, label: 'Patient starts', sub: $m(k.tud * 0.108), v: k.tud * 0.108, c: '#6f7ae0' },
    { id: 'pt', col: 2, label: 'Patients on therapy', sub: $m(k.tud * 0.892), v: k.tud * 0.892, c: '#9aa2f0' },
    { id: 'tud', col: 3, label: 'Underlying demand', sub: $m(k.tud), v: k.tud, c: COLOR.working },
    { id: 'inv', col: 3, label: 'Timing & inventory', sub: `${$m(k.inv)} · adds to shipments`, v: Math.max(0, k.inv), c: '#b7791f' },
    { id: 'gap', col: ueNeg ? 4 : 3, label: 'Unexplained gap', sub: `${$m(gap)} · demand ≠ shipments`, v: gap, c: '#b9bed0' },
    { id: 'gr', col: 4, label: 'Gross revenue', sub: `${$m(k.gross)} · shipments at list price`, v: k.gross, c: '#3b3bd6' },
    ...GTN_SPLIT.map(([n, f, c], i) => ({ id: `g${i}`, col: 5, label: n, sub: `${$m(k.gross * f)} · ${(f * 100).toFixed(1)}% of gross`, v: k.gross * f, c })),
    { id: 'net', col: 5, label: 'Net sales', sub: `${$m(k.net)} · ${((k.net / k.gross) * 100).toFixed(1)}¢ of every gross $`, v: k.net, c: '#0a7d4f' },
  ]
  const links: [string, string, number][] = [
    ['md', 'nb', k.tud * 0.077], ['md', 'nr', k.tud * 0.031], ['md', 'rf', k.tud * 0.892], ['nb', 'ps', k.tud * 0.077], ['nr', 'ps', k.tud * 0.031], ['rf', 'pt', k.tud * 0.892],
    ['ps', 'tud', k.tud * 0.108], ['pt', 'tud', k.tud * 0.892],
    ...(ueNeg ? [['tud', 'gap', gap], ['tud', 'gr', k.tud - gap]] as [string, string, number][] : [['tud', 'gr', k.tud], ['gap', 'gr', gap]] as [string, string, number][]),
    ['inv', 'gr', Math.max(0, k.inv)], ...GTN_SPLIT.map(([, f], i) => ['gr', `g${i}`, k.gross * f] as [string, string, number]), ['gr', 'net', k.net],
  ]
  const VW = 1180, H = 330, TOP = 34, NW = 10, GAP = 14, X = [10, 205, 400, 595, 790, 950]
  const cols = [0, 1, 2, 3, 4, 5].map(c => nodes.filter(n => n.col === c))
  const scale = Math.min(...cols.map(c => (H - GAP * (c.length - 1)) / c.reduce((a, n) => a + n.v, 0)))
  const pos: Record<string, { x: number; y: number; h: number; o: number; i: number }> = {}
  cols.forEach(c => { let y = TOP; c.forEach(n => { const h = Math.max(2, n.v * scale); pos[n.id] = { x: X[n.col]!, y, h, o: 0, i: 0 }; y += h + GAP }) })
  return (
    <Card title={`The revenue river · ${label}`} info="Flows are window sums for the selected scenario." right={<Tag tone="neutral">{scenario}</Tag>}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${VW} ${H + TOP + 10}`} className="min-w-[900px]" role="img" aria-label={`Revenue river for ${label}: demand to net sales`}>
          {['Market demand', 'Capture', 'Patient metrics', 'Value', 'Ships', 'Survives'].map((t, i) => <text key={t} x={X[i]} y={14} className="fill-[#8f9199] text-[11px] font-medium">{t}</text>)}
          {links.map(([a, b, v]) => {
            const s = pos[a]!, t = pos[b]!, w = v * scale, x0 = s.x + NW, x1 = t.x, y0 = s.y + s.o, y1 = t.y + t.i, xm = (x0 + x1) / 2
            s.o += w; t.i += w
            return <path key={a + b} d={`M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + w}C${xm},${y1 + w} ${xm},${y0 + w} ${x0},${y0 + w}Z`} fill={nodes.find(n => n.id === b)!.c} fillOpacity={0.28} />
          })}
          {nodes.map(n => { const p = pos[n.id]!; return (
            <g key={n.id}>
              <rect x={p.x} y={p.y} width={NW} height={p.h} rx={2} fill={n.c} />
              <text x={p.x + NW + 6} y={p.y + Math.min(p.h / 2, 14) + 2} className={cx('text-[11.5px] font-semibold', n.id === 'net' ? 'fill-[#0a7d4f]' : 'fill-[#1c1d21]')}>{n.label}</text>
              <text x={p.x + NW + 6} y={p.y + Math.min(p.h / 2, 14) + 15} className="fill-[#5c5e66] text-[10.5px]">{n.sub}</text>
            </g>) })}
        </svg>
      </div>
      <p className="mt-2 text-[12px] text-text-3">The allowance split follows the CoE gross-to-net inputs; market demand is the eligible pool valued at the brand’s price.</p>
    </Card>
  )
}

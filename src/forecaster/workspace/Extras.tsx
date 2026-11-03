import { useMemo, useState } from 'react'
import { Card, Seg, Tag, cx, field } from './ui'
import { YEARS, fmtRev, funnelOf, fySum, revenue } from './engine'
import type { Calc } from './Stages'
import type { Scenario } from './engine'

const num = (v: number, u: string) => u === '$M' ? fmtRev(v) : u === 'Rx' ? `${(v / 1e6).toFixed(2)}M` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0)
const th = 'px-3 py-2 text-right text-[12px] font-semibold text-text-2'
const td = 'px-3 py-2 text-right tabular-nums text-[13px]'

/** F-10: annualised patient funnel, patients to revenue, for the chosen scenario. */
export function FunnelTable({ calc, scenarios }: { calc: Calc; scenarios: Scenario[] }) {
  const [src, setSrc] = useState('__working')
  const [mode, setMode] = useState<'funnel' | 'channel'>('funnel')
  const layer = (calc[src] ?? calc.__working!).layer
  const rows = useMemo(() => YEARS.map(y => funnelOf(layer, y)), [layer])
  const labels = rows[0]!
  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Seg label="Funnel view" value={mode} onChange={setMode} options={[{ id: 'funnel', label: 'Patient funnel' }, { id: 'channel', label: 'Retail / non-retail' }]} />
        <select aria-label="Scenario" value={src} onChange={e => setSrc(e.target.value)} className={cx(field, 'w-auto min-w-[200px]')}>
          <option value="__working">Working forecast</option>
          {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Tag tone="brand">2025 actuals to 2028 plan</Tag>
      </div>
      {mode === 'funnel' ? (
        <Card title="Annual patient funnel" sub="Patients to revenue by year. Rates are year averages; volumes follow from them.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead><tr className="border-b border-border"><th className="px-3 py-2 text-left text-[12px] font-semibold text-text-2">Step</th>{YEARS.map(y => <th key={y} className={th}>{y}</th>)}<th className={th}>CAGR</th></tr></thead>
              <tbody>
                {labels.map((l, i) => {
                  const a = rows[0]![i]!.vol, b = rows[rows.length - 1]![i]!.vol, cagr = a > 0 ? (Math.pow(b / a, 1 / (YEARS.length - 1)) - 1) * 100 : 0
                  return (
                    <tr key={l.id} className={cx('border-b border-border/60 hover:bg-surface-2/60', (l.id === 'rev' || l.id === 'price') && 'bg-brand-soft/40 font-semibold')}>
                      <td className="px-3 py-2 text-[13px] font-medium">{l.id === 'price' ? 'Net revenue' : l.label}{l.rate !== undefined && l.id !== 'price' && <span className="ml-2 text-[11px] font-normal text-text-3">rate</span>}</td>
                      {rows.map((r, k) => <td key={k} className={td}>{l.id === 'price' ? fmtRev(r[i]!.vol) : <>{num(r[i]!.vol, r[i]!.unit)}{r[i]!.rate !== undefined && <span className="ml-1.5 text-[11px] text-text-3">{r[i]!.rate!.toFixed(1)}%</span>}</>}</td>)}
                      <td className={td}>{cagr >= 0 ? '+' : '−'}{Math.abs(cagr).toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : <ChannelTable layer={layer} />}
    </div>
  )
}

// F-14: illustrative retail share, shifting to non-retail (specialty, institutional) over time. Replace with archetype data.
const RETAIL = [0.72, 0.68, 0.64, 0.6]
function ChannelTable({ layer }: { layer: Calc[string]['layer'] }) {
  const rev = revenue(layer)
  return (
    <Card title="Retail and non-retail channels" sub="Illustrative split of net revenue and TRx. Real splits depend on the vaccine archetype and model setup.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead><tr className="border-b border-border"><th className="px-3 py-2 text-left text-[12px] font-semibold text-text-2">Channel</th>{YEARS.map(y => <th key={y} className={th}>{y}</th>)}</tr></thead>
          <tbody>
            {([['Retail pharmacy', 1], ['Non-retail (clinic, institutional)', -1]] as const).map(([n, s]) => (
              <tr key={n} className="border-b border-border/60 hover:bg-surface-2/60"><td className="px-3 py-2 text-[13px] font-medium">{n}</td>
                {YEARS.map((y, k) => { const f = s > 0 ? RETAIL[k]! : 1 - RETAIL[k]!; return <td key={y} className={td}>{fmtRev(fySum(rev, y) * f)}<span className="ml-1.5 text-[11px] text-text-3">{Math.round(f * 100)}%</span></td> })}</tr>
            ))}
            <tr className="bg-brand-soft/40 font-semibold"><td className="px-3 py-2 text-[13px]">Total net revenue</td>{YEARS.map(y => <td key={y} className={td}>{fmtRev(fySum(rev, y))}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// F-12: illustrative country scale factors against the US forecast.
const COUNTRIES: [string, number][] = [['United States', 1], ['Germany', 0.11], ['France', 0.08], ['Japan', 0.09], ['United Kingdom', 0.06]]
export function CountryCompare({ calc, scenarios }: { calc: Calc; scenarios: Scenario[] }) {
  const [sel, setSel] = useState<string[]>(COUNTRIES.map(c => c[0]))
  const sc = scenarios[0]
  const layer = (sc ? calc[sc.id] : calc.__working)!.layer
  const rev = revenue(layer)
  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-6 py-8">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Countries">
        {COUNTRIES.map(([c]) => { const on = sel.includes(c); return <button key={c} type="button" aria-pressed={on} onClick={() => setSel(s => on ? s.filter(x => x !== c) : [...s, c])}
          className={cx('rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors', on ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong text-text-2 hover:border-brand/60')}>{c}</button> })}
        <Tag tone="warn">Illustrative scaling of the US model</Tag>
      </div>
      <Card title="Submitted forecasts side by side" sub={`Net revenue by country, ${sc?.name ?? 'working forecast'}. Read-only comparison.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead><tr className="border-b border-border"><th className="px-3 py-2 text-left text-[12px] font-semibold text-text-2">Country</th>{YEARS.map(y => <th key={y} className={th}>{y}</th>)}</tr></thead>
            <tbody>{COUNTRIES.filter(([c]) => sel.includes(c)).map(([c, f]) => <tr key={c} className="border-b border-border/60 hover:bg-surface-2/60"><td className="px-3 py-2 text-[13px] font-medium">{c}</td>{YEARS.map(y => <td key={y} className={td}>{fmtRev(fySum(rev, y) * f)}</td>)}</tr>)}
              <tr className="bg-brand-soft/40 font-semibold"><td className="px-3 py-2 text-[13px]">Selected total</td>{YEARS.map(y => <td key={y} className={td}>{fmtRev(fySum(rev, y) * COUNTRIES.filter(([c]) => sel.includes(c)).reduce((a, [, f]) => a + f, 0))}</td>)}</tr></tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// F-04: pipeline-to-launch view. Illustrative assets; probability of success is editable.
const ASSETS = [
  { name: 'Asset A (Phase 3)', launch: 2027, pos: 65, peak: 900, ramp: 5 },
  { name: 'Asset B (Phase 2)', launch: 2029, pos: 35, peak: 1400, ramp: 6 },
  { name: 'Asset C (Filed)', launch: 2026, pos: 90, peak: 450, ramp: 4 },
]
export function PipelineView() {
  const [pos, setPos] = useState(ASSETS.map(a => a.pos))
  const yrs = [2026, 2027, 2028, 2029, 2030, 2031, 2032]
  const curve = (a: typeof ASSETS[number], y: number) => y < a.launch ? 0 : Math.min(1, (y - a.launch + 1) / a.ramp)
  const rows = ASSETS.map((a, i) => yrs.map(y => a.peak * curve(a, y) * pos[i]! / 100))
  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-6 py-8">
      <Card title="Pipeline to launch" sub="Risk-adjusted revenue by asset: peak revenue × launch ramp × probability of success. Edit success rates to see the effect.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead><tr className="border-b border-border"><th className="px-3 py-2 text-left text-[12px] font-semibold text-text-2">Asset</th><th className={th}>Success %</th>{yrs.map(y => <th key={y} className={th}>{y}</th>)}</tr></thead>
            <tbody>{ASSETS.map((a, i) => <tr key={a.name} className="border-b border-border/60 hover:bg-surface-2/60"><td className="px-3 py-2 text-[13px] font-medium">{a.name}<span className="ml-2 text-[11px] text-text-3">launch {a.launch}</span></td>
              <td className="px-3 py-1.5 text-right"><input aria-label={`${a.name} probability of success`} type="number" min={0} max={100} value={pos[i]} onChange={e => setPos(p => p.map((v, k) => k === i ? Math.max(0, Math.min(100, +e.target.value || 0)) : v))} className={cx(field, 'h-8 w-20 text-right')} /></td>
              {rows[i]!.map((v, k) => <td key={k} className={td}>{v ? fmtRev(v) : '–'}</td>)}</tr>)}
              <tr className="bg-brand-soft/40 font-semibold"><td className="px-3 py-2 text-[13px]">Pipeline total</td><td />{yrs.map((_, k) => <td key={k} className={td}>{fmtRev(rows.reduce((a, r) => a + r[k]!, 0))}</td>)}</tr></tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

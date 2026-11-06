import { useState } from 'react'
import { FY, POP, RX_PER_PT, fmtRev, fyAvg } from './engine'
import type { DriverId, Scenario } from './engine'
import type { Calc } from './Stages'
import { Btn, Card, Seg, Toggle, cx, field } from './ui'

type RowId = 'prev' | DriverId
const ROWS: { id: RowId; label: string; defG: number; fmt: (v: number) => string }[] = [
  { id: 'prev', label: 'Prevalent patients', defG: 1.0, fmt: v => `${(v / 1e6).toFixed(1)}M` },
  { id: 'diag', label: 'Diagnosis rate', defG: 0.0, fmt: v => `${v.toFixed(1)}%` },
  { id: 'treat', label: 'Treatment rate', defG: 0.0, fmt: v => `${v.toFixed(1)}%` },
  { id: 'access', label: 'Access / coverage', defG: 0.0, fmt: v => `${v.toFixed(1)}%` },
  { id: 'share', label: 'Brand share', defG: 3.0, fmt: v => `${v.toFixed(1)}%` },
  { id: 'price', label: 'Net price ($/Rx)', defG: 3.0, fmt: v => `$${v.toFixed(2)}` },
]
const LRF_YEARS = [2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]
const defRates = () => Object.fromEntries(ROWS.map(r => [r.id, Object.fromEntries(LRF_YEARS.map(y => [y, r.defG]))])) as Record<RowId, Record<number, number>>

/** Long-range forecast (LRF): annual patient funnel and YoY %G assumptions across Years 1–10 (FY2027–FY2036). */
export function LrfView({ scenarios, calc, selId, setSelId, onEvent }: {
  scenarios: Scenario[]; calc: Calc; selId: string; setSelId: (id: string) => void; onEvent: () => void
}) {
  const [subView, setSubView] = useState<'assumptions' | 'funnel'>('assumptions')
  const [mode, setMode] = useState<'constant' | 'perYear'>('constant')
  const [holdConst, setHoldConst] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [rates, setRates] = useState<Record<RowId, Record<number, number>>>(defRates)

  const sc = scenarios.find(s => s.id === selId) ?? scenarios[0]!
  const layer = calc[sc.id]!.layer
  const base27: Record<RowId, number> = {
    prev: POP,
    diag: fyAvg(layer.diag, FY),
    treat: fyAvg(layer.treat, FY),
    access: fyAvg(layer.access, FY),
    share: fyAvg(layer.share, FY),
    price: fyAvg(layer.price, FY),
  }

  const setConst = (id: RowId, g: number) => setRates(rs => ({ ...rs, [id]: Object.fromEntries(LRF_YEARS.map(y => [y, g])) }))
  const setYearRate = (id: RowId, y: number, g: number) => setRates(rs => ({ ...rs, [id]: { ...rs[id], [y]: g } }))

  // Project each row across FY2027..FY2036 by compounding YoY %G from FY2027 base.
  const allYears = [FY, ...LRF_YEARS]
  const proj: Record<RowId, Record<number, number>> = { prev: {}, diag: {}, treat: {}, access: {}, share: {}, price: {} }
  for (const r of ROWS) {
    let cur = base27[r.id]
    proj[r.id][FY] = cur
    for (const y of LRF_YEARS) {
      const g = mode === 'constant' ? rates[r.id][2028]! : rates[r.id][y]!
      cur = r.id === 'prev' || r.id === 'price' ? cur * (1 + g / 100) : Math.min(100, Math.max(0, cur * (1 + g / 100)))
      proj[r.id][y] = cur
    }
  }

  const netOf = (y: number) =>
    proj.prev[y]! * (proj.diag[y]! / 100) * (proj.treat[y]! / 100) * (proj.access[y]! / 100) * (proj.share[y]! / 100) * RX_PER_PT * 12 * proj.price[y]! / 1e6
  const derivedG = ((netOf(2028) / netOf(FY) - 1) * 100)
  const visYears = expanded ? LRF_YEARS : [2028, 2029]

  const funnelSteps = (y: number) => {
    const prev = proj.prev[y]!
    const diag = prev * (proj.diag[y]! / 100)
    const treat = diag * (proj.treat[y]! / 100)
    const cov = treat * (proj.access[y]! / 100)
    const onBrand = cov * (proj.share[y]! / 100)
    const trx = onBrand * RX_PER_PT * 12
    const net = netOf(y)
    return { prev, diag, treat, cov, onBrand, trx, net }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight">LRF assumptions</h2>
        <p className="mt-0.5 max-w-3xl text-sm text-text-2">
          The long-range forecast (LRF) — the same patient funnel as Assumptions, but set annually. Each metric defaults to its year-over-year growth rate, held constant across all years. Override any rate, or layer an event.
        </p>
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <Seg label="LRF view" value={subView} onChange={setSubView} options={[{ id: 'assumptions', label: 'LRF assumptions' }, { id: 'funnel', label: 'Patient funnel by year' }]} />
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-text-2">
            Scenario
            <select aria-label="Scenario" value={sc.id} onChange={e => setSelId(e.target.value)} className={cx(field, 'w-44')}>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12px] font-medium text-text-2">Growth mode</span>
          <Seg label="Growth mode" value={mode} onChange={m => { setMode(m); setHoldConst(m === 'constant') }} options={[{ id: 'constant', label: 'Constant %G' }, { id: 'perYear', label: 'Per-year %G' }]} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={() => setRates(defRates())}>Reset rates to default</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? '− Collapse FY2030 – FY2036 (Years 4–10)' : '+ Expand to FY2030 – FY2036 (Years 4–10) ▸'}
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px]">
        <Toggle on={holdConst} onChange={v => { setHoldConst(v); setMode(v ? 'constant' : 'perYear') }} label="Hold YoY %G constant across all years" />
        <p><b className="font-semibold">Default: hold each metric’s YoY %G constant across all years.</b> <span className="text-text-2">Every metric is editable — override a rate or add an event.</span></p>
      </div>

      {subView === 'assumptions' ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-[11.5px] font-medium text-text-3">
                <th className="px-4 py-2.5 text-left">Metric</th>
                <th className="px-3 py-2.5 text-right">FY{FY} base</th>
                <th className="px-3 py-2.5 text-center">YoY %G (default)</th>
                {visYears.map(y => <th key={y} className="px-3 py-2.5 text-right">FY{y}</th>)}
                {!expanded && <th className="px-3 py-2.5 text-center">Y4–10</th>}
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => {
                const constG = rates[r.id][2028]!
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text">{r.label}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{r.fmt(base27[r.id])}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex items-center rounded-md border border-[#F0D98A] bg-[#FFF9E0] px-2 py-1">
                        <input
                          type="number"
                          step={0.1}
                          aria-label={`${r.label} default YoY %G`}
                          value={constG}
                          onChange={e => setConst(r.id, e.target.value === '' ? 0 : +e.target.value)}
                          className="w-14 bg-transparent text-right font-mono text-[12.5px] font-semibold text-brand outline-none"
                        />
                        <span className="ml-0.5 font-mono text-[12px] font-semibold text-brand">%</span>
                      </div>
                    </td>
                    {visYears.map(y => (
                      <td key={y} className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {mode === 'perYear' ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span>{r.id === 'price' ? `$${proj[r.id][y]!.toFixed(1)}` : r.fmt(proj[r.id][y]!)}</span>
                            <div className="inline-flex items-center rounded border border-[#F0D98A] bg-[#FFF9E0] px-1.5 py-0.5">
                              <input
                                type="number"
                                step={0.1}
                                aria-label={`${r.label} FY${y} YoY %G`}
                                value={rates[r.id][y]!}
                                onChange={e => setYearRate(r.id, y, e.target.value === '' ? 0 : +e.target.value)}
                                className="w-11 bg-transparent text-right font-mono text-[11px] font-semibold text-brand outline-none"
                              />
                              <span className="font-mono text-[10.5px] text-brand">%</span>
                            </div>
                          </div>
                        ) : (
                          r.id === 'price' ? `$${proj[r.id][y]!.toFixed(1)}` : r.fmt(proj[r.id][y]!)
                        )}
                      </td>
                    ))}
                    {!expanded && (
                      <td className="px-3 py-3 text-center">
                        <button type="button" onClick={() => setExpanded(true)} title="Expand FY2030–FY2036" className="font-mono text-text-3 hover:text-brand">···</button>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-[12.5px]">
                      <button type="button" onClick={() => { setMode('perYear'); setHoldConst(false) }} className="font-medium text-brand hover:underline">override</button>
                      <span className="mx-1 text-text-3">·</span>
                      <button type="button" onClick={onEvent} className="font-medium text-brand hover:underline">event</button>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-surface-2/40 font-semibold">
                <td className="px-4 py-3 text-ok">= Net revenue (outcome)</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtRev(netOf(FY), 0)}</td>
                <td className="px-3 py-3 text-center font-mono text-[12px] font-normal text-text-3">{derivedG >= 0 ? '+' : '−'}{Math.abs(derivedG).toFixed(1)}% derived</td>
                {visYears.map(y => <td key={y} className="px-3 py-3 text-right font-mono tabular-nums">{fmtRev(netOf(y), 0)}</td>)}
                {!expanded && <td className="px-3 py-3 text-center font-mono text-text-3">···</td>}
                <td className="px-4 py-3 text-right text-[12px] font-normal text-text-3">computed</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-[11.5px] font-medium text-text-3">
                <th className="px-4 py-2.5 text-left">Funnel step</th>
                {([FY, ...visYears]).map(y => <th key={y} className="px-3 py-2.5 text-right">FY{y}</th>)}
                {!expanded && <th className="px-3 py-2.5 text-center">Y4–10</th>}
              </tr>
            </thead>
            <tbody>
              {([
                ['Prevalent patients', (y: number) => `${(funnelSteps(y).prev / 1e6).toFixed(2)}M`, false],
                ['Diagnosed patients', (y: number) => `${(funnelSteps(y).diag / 1e6).toFixed(2)}M`, false],
                ['Treated patients', (y: number) => `${(funnelSteps(y).treat / 1e6).toFixed(2)}M`, false],
                ['Covered patients', (y: number) => `${(funnelSteps(y).cov / 1e6).toFixed(2)}M`, false],
                ['Patients on brand', (y: number) => `${(funnelSteps(y).onBrand / 1e3).toFixed(0)}K`, false],
                ['Annual TRx', (y: number) => `${(funnelSteps(y).trx / 1e3).toFixed(0)}K`, false],
                ['= Net revenue (outcome)', (y: number) => fmtRev(funnelSteps(y).net, 0), true],
              ] as const).map(([label, fn, strong]) => (
                <tr key={label} className={cx('border-b border-border last:border-0', strong && 'bg-surface-2/40 font-semibold')}>
                  <td className={cx('px-4 py-2.5', strong ? 'text-ok' : 'font-medium')}>{label}</td>
                  {([FY, ...visYears]).map(y => <td key={y} className="px-3 py-2.5 text-right font-mono tabular-nums">{fn(y)}</td>)}
                  {!expanded && <td className="px-3 py-2.5 text-center font-mono text-text-3">···</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

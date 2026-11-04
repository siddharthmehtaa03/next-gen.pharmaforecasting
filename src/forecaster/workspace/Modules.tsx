import { useEffect, useMemo, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { ArrowRight, Lock, RotateCcw } from 'lucide-react'
import { ACT, ACTUALS, BASELINE, FY, GTN, MONTHS, N, START_YEAR, UNBIASED, defaultEdit, fmtRev, grossSales, mLong } from './engine'
import type { Edit, EventDef, Layer, Scenario } from './engine'
import { Btn, Card, ForecastChart, Legend, Seg, Tag, cx, field } from './ui'
import type { ChartSeries } from './ui'

export { GTN }

/* Default modules every model carries (Default Modules + Gross Price Workflow docs).
   shortcut: the engine forecasts weighted gross price × volume; gross sales, Δ inventory and TUD are derived here with illustrative ratios
   (Δ inventory +0.46% of gross at 2.26 weeks on hand, LES Nurtec v3.12.21). Move into the engine when the gross build lands. */
const INV_PCT = 0.0046, UE_TRIGGER = 5
export const WOH_DEFAULT = 2.26
const CUR = START_YEAR + Math.floor((ACT - 1) / 12), YTD = ((ACT - 1) % 12) + 1
// FY2025 Unexplained % of gross was −5.1%; current-year actual months as booked.
export const UE_PRIOR = -5.1
const UE_ACT = [-2.1, -6.8, -4.2, -7.1, -5.5, -1.9, -6.2].slice(0, YTD)
/** Default: hold YTD actuals, backfill the rest so the full year lands on the prior-year FY %. */
export const ueDefault = () => { const fill = (UE_PRIOR * 12 - UE_ACT.reduce((a, b) => a + b, 0)) / (12 - YTD); return [...UE_ACT, ...Array.from({ length: 12 - YTD }, () => +fill.toFixed(1))] }
export const ueFy = (m: number[]) => m.reduce((a, b) => a + b, 0) / 12
if (import.meta.env.DEV) console.assert(Math.abs(ueFy(ueDefault()) - UE_PRIOR) < 0.05, 'ueDefault must land on the prior-year FY %')

/** Gross = TUD + ΔInv + UE, worked back from net revenue ($M). Δ inventory scales with the target weeks on hand. */
export const bridgeOf = (net: number, uePct: number, woh = WOH_DEFAULT) => { const gross = net / (1 - GTN), ueD = gross * uePct / 100, inv = gross * INV_PCT * (woh / WOH_DEFAULT); return { gross, ueD, inv, tud: gross - inv - ueD } }
/** Monthly series for the standard metrics every model carries, so each one can be charted like any assumption. Δ inventory scales with target weeks on hand; Unexplained is a % of gross by calendar month. */
export function stdSeries(l: Layer, ue: number[] = ueDefault(), woh = WOH_DEFAULT) {
  const gross = grossSales(l)
  const inv = gross.map(g => g * INV_PCT * (woh / WOH_DEFAULT))
  const uePct = gross.map((_, i) => ue[i % 12] ?? UE_PRIOR)
  const tud = gross.map((g, i) => g - inv[i]! - g * uePct[i]! / 100)
  return { gross, inv, uePct, tud, fx: gross.map(() => 1), netPrice: l.price.map(p => p * (1 - GTN)) }
}
export const fmtB = (v: number) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(2)}B` : fmtRev(v, 0)

/** The five default modules, in funnel order. Weighted gross price sits in the Sales stage; the other four form the revenue bridge. */
export type ModId = 'gp' | 'netp' | 'tud' | 'inv' | 'ue' | 'fx'
export const MODS: { id: ModId; label: string; kind: string; edit: boolean }[] = [
  { id: 'gp', label: 'Weighted gross price', kind: 'Editable', edit: true },
  { id: 'tud', label: 'Total underlying demand', kind: 'Calculated', edit: false },
  { id: 'inv', label: 'Change in inventory', kind: 'Target WOH', edit: true },
  { id: 'ue', label: 'Unexplained difference', kind: '% by month', edit: true },
  { id: 'fx', label: 'Exchange rates', kind: 'USD · 1.0', edit: false },
]
export const BRIDGE_MODS = MODS.filter(m => m.id !== 'gp' && m.id !== 'netp')

/** Revenue funnel with the required lines. The FY ahead holds the current year's Unexplained % (same default every year). */
export function RequiredFunnel({ net, ue, woh = WOH_DEFAULT }: { net: number; ue: number[]; woh?: number }) {
  const uePct = ueFy(ue), { gross, ueD, inv, tud } = bridgeOf(net, uePct, woh)
  const box = (k: string, v: string, tag: string, tone: 'neutral' | 'warn' | 'brand', sub: string, lock?: boolean) => (
    <div className="min-w-[132px] flex-1 rounded-md border border-border bg-surface px-3 py-2.5 text-center">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-3">{k}</p>
      <p className="mt-0.5 font-mono text-[17px] font-semibold">{v}</p>
      <span className={cx('mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold', tone === 'warn' ? 'bg-[#FFF9E0] text-warn' : tone === 'brand' ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-text-2')}>{lock && <Lock size={9} />}{tag}</span>
      <p className="mt-0.5 text-[11px] text-text-3">{sub}</p>
    </div>
  )
  const arrow = <ArrowRight size={14} className="hidden shrink-0 self-center text-text-3 md:block" aria-hidden />
  return (
    <Card title={`Revenue funnel · FY${FY}`} sub="Required lines in every model. Total underlying demand is calculated: change it upstream." right={<Tag tone="neutral">USD · FX 1.0 (US-only)</Tag>}>
      <div className="flex flex-wrap items-stretch gap-2">
        {box('Total underlying demand', fmtB(tud), 'calculated', 'neutral', 'upstream only', true)}{arrow}
        {box('+ Δ Inventory', `${inv >= 0 ? '+' : '−'}${fmtB(Math.abs(inv))}`, 'target WOH', 'warn', `≈${woh.toFixed(2)} weeks on hand`)}{arrow}
        {box('Gross sales', fmtB(gross), 'gross price', 'warn', 'editable in Weighted gross price')}{arrow}
        {box('− Unexplained', `${ueD >= 0 ? '+' : '−'}${fmtB(Math.abs(ueD))}`, `${uePct.toFixed(1)}% · by month`, 'warn', 'forecast %')}{arrow}
        {box('Net revenue', fmtB(net), 'computed', 'brand', `gross × (1 − ${Math.round(GTN * 100)}% GtN)`)}
      </div>
    </Card>
  )
}

/** Forecast the % of Unexplained by month: YTD locked, remaining months prepopulated and editable. */
export function UnexplainedPct({ ue, setUe, readOnly }: { ue: number[]; setUe: (v: number[]) => void; readOnly?: boolean }) {
  const fy = ueFy(ue), breach = Math.abs(fy) > UE_TRIGGER
  return (
    <Card title={`Unexplained difference · % of gross by month, ${CUR}`} sub={`Prior-year FY ${UE_PRIOR}% is the target. ${MONTHS[0]}–${MONTHS[YTD - 1]} actuals are held; the rest backfill so the full year lands on it. Any forecast month is editable.`}
      right={readOnly ? <Tag tone="neutral"><Lock size={10} />View only</Tag> : <Btn size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => setUe(ueDefault())}>Reset to default</Btn>}>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {ue.map((v, m) => (
          <label key={m} className="block text-center">
            <span className="block text-[11px] text-text-3">{MONTHS[m]}</span>
            {m < YTD || readOnly
              ? <span title="Actual · locked" className="mt-0.5 block rounded border border-border bg-surface-2 py-1.5 font-mono text-[12px] text-text-3">{v.toFixed(1)}</span>
              : <input aria-label={`${MONTHS[m]} ${CUR} unexplained %`} inputMode="decimal" type="number" step={0.1} value={v} onChange={e => setUe(ue.map((x, k) => (k === m ? (e.target.value === '' ? 0 : +e.target.value) : x)))}
                  className="mt-0.5 block w-full rounded border border-[#F0D98A] bg-[#FFF9E0] py-1.5 text-center font-mono text-[12px] outline-none focus:border-brand" />}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-border bg-surface-2" />Actual (locked)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-[#F0D98A] bg-[#FFF9E0]" />Forecast (editable)</span>
        <span className={cx('ml-auto rounded px-2 py-0.5 font-semibold', breach ? 'bg-err-soft text-err' : 'bg-ok-soft text-ok')}>FY {fy.toFixed(1)}% · {breach ? `outside ±${UE_TRIGGER}% trigger` : `within ±${UE_TRIGGER}% trigger`}</span>
      </div>
      <p className="mt-2 text-[11.5px] text-text-3">FY{CUR + 1} onward holds this full-year % in every month. Unexplained $ = % × gross.</p>
    </Card>
  )
}

/* ───────── Weighted gross price (Gross Price Workflow, screens 1–4) ───────── */
export type Sku = { id: string; name: string; price: number; packs: number; rev: boolean; note?: string }
export type GpState = { skus: Sku[]; level: 'sku' | 'brand'; brandPrice: number | null; from: number }
const PILLS = 8
// Nurtec ODT pack list (illustrative, Blaze/Snowflake FINANCE extract shape). Free packs carry no revenue.
// List prices are scaled once so the weighted price equals the last actual month's gross price in the model: the SKU view and the funnel agree.
const RAW: Sku[] = [
  { id: 'r8', name: 'ODT 75 mg · 8 ct · retail', price: 1089.6, packs: 98200, rev: true },
  { id: 'i8', name: 'ODT 75 mg · 8 ct · institutional', price: 1021.4, packs: 14600, rev: true },
  { id: 's2', name: 'ODT 75 mg · 2 ct · starter', price: 272.4, packs: 6300, rev: false, note: 'starter' },
  { id: 'sm', name: 'Sample pack · 2 ct', price: 0, packs: 12768, rev: false, note: 'sample' },
  { id: 'cv', name: 'Copay voucher fill · 8 ct', price: 1089.6, packs: 4100, rev: false, note: 'voucher' },
]
export const skuWgp = (skus: Sku[]) => { const p = skus.filter(s => s.rev).reduce((a, s) => a + s.packs, 0); return p ? skus.filter(s => s.rev).reduce((a, s) => a + s.price * s.packs, 0) / p : 0 }
export const GP_ANCHOR = ACTUALS.price[ACT - 1]!
const SCALE = GP_ANCHOR / skuWgp(RAW)
export const gpDefault = (): GpState => ({ skus: RAW.map(s => ({ ...s, price: +(s.price * SCALE).toFixed(2) })), level: 'sku', brandPrice: null, from: ACT })
export const gpWgp = (g: GpState) => (g.level === 'brand' && g.brandPrice !== null ? g.brandPrice : skuWgp(g.skus))
/** The edit a price change makes to the forecast: the reference path scaled by the new weighted price over the system price, from the chosen month. */
export function gpEdit(g: GpState): Edit | undefined {
  const r = gpWgp(g) / skuWgp(gpDefault().skus)
  if (!Number.isFinite(r) || Math.abs(r - 1) < 1e-6) return undefined
  const values: Record<number, number> = {}
  for (let i = Math.max(ACT, g.from); i < N; i++) values[i] = UNBIASED.price[i]! * r
  return { ...defaultEdit('price'), method: 'direct', values, pinned: [], notes: g.level === 'brand' ? `Weighted brand price set to ${usd(gpWgp(g))} from ${mLong(g.from)}.` : `SKU list prices and mix give ${usd(gpWgp(g))} per pack from ${mLong(g.from)}.` }
}
const usd = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** One SKU's price over the last twelve actual months and the forecast: its list price carried along the brand price path. Solid = actual, dashed = forecast. */
function SkuSpark({ price }: { price: number }) {
  const W = 120, H = 28, from = ACT - 12
  const vals = Array.from({ length: N - from }, (_, k) => { const i = from + k; return price * (i < ACT ? ACTUALS.price[i]! : UNBIASED.price[i]!) / GP_ANCHOR })
  const lo = Math.min(...vals), hi = Math.max(...vals), y = (v: number) => 3 + (H - 6) * (1 - (v - lo) / ((hi - lo) || 1)), x = (k: number) => (k / (vals.length - 1)) * W
  const pts = (a: number, b: number) => vals.slice(a, b + 1).map((v, k) => `${x(a + k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return <svg width={W} height={H} className="ml-auto block" role="img" aria-label="SKU price trend"><polyline fill="none" stroke="#15172e" strokeWidth="1.8" points={pts(0, 12)} /><polyline fill="none" stroke="#0000c9" strokeWidth="1.8" strokeDasharray="3 2" points={pts(11, vals.length - 1)} /></svg>
}

type PriceActions = { apply: () => void; discard: () => void }
/** Weighted gross price: Σ(price × mix) over revenue SKUs. Net sales price is calculated, never forecast. */
export function GrossPriceModule({ gp, applied, onApply, onReset, readOnly, working, scenario, scenarioName, events, scenarios, onEvents, onDirty, actions }: {
  gp: GpState; applied: boolean; onApply: (g: GpState) => void; onReset: () => void; readOnly?: boolean; working: Layer; scenario?: Layer; scenarioName?: string
  events: EventDef[]; scenarios: Scenario[]; onEvents: () => void; onDirty: (v: boolean) => void; actions: MutableRefObject<PriceActions | null>
}) {
  const [d, setD] = useState(gp)
  useEffect(() => setD(gp), [gp])
  const dirty = JSON.stringify(d) !== JSON.stringify(gp)
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  actions.current = { apply: () => onApply(d), discard: () => setD(gp) }
  const set = (id: string, p: Partial<Sku>) => setD(x => ({ ...x, skus: x.skus.map(s => (s.id === id ? { ...s, ...p } : s)) }))
  const revPacks = d.skus.filter(s => s.rev).reduce((a, s) => a + s.packs, 0), freePacks = d.skus.filter(s => !s.rev).reduce((a, s) => a + s.packs, 0)
  const sys = skuWgp(gpDefault().skus), wgp = gpWgp(d), chg = sys ? (wgp / sys - 1) * 100 : 0
  const series: ChartSeries = useMemo(() => ({ actual: ACTUALS.price, unbiased: UNBIASED.price, lo: BASELINE.price.lo, hi: BASELINE.price.hi, working: working.price, scenario: scenario && scenario.price.some((v, i) => Math.abs(v - working.price[i]!) > 1e-9) ? scenario.price : undefined, scenarioName }), [working, scenario, scenarioName])
  const priceEvents = events.filter(e => e.impacts.some(i => i.metric === 'price'))
  const months = Array.from({ length: N - ACT }, (_, k) => ACT + k)
  // Illustrative monthly packs, 24 months around the actuals-to-forecast boundary: seasonal revenue packs, a flat sample stream.
  const packsByMonth = useMemo(() => Array.from({ length: 24 }, (_, k) => { const i = ACT - 12 + k; return { i, rev: Math.round(revPacks * (1 + 0.07 * Math.sin(i * 1.3))), free: freePacks } }), [revPacks, freePacks])
  const packMax = Math.max(...packsByMonth.map(p => p.rev + p.free))
  return (
    <div className="space-y-5">
      <Card title="Weighted gross price per pack" sub="System value, computed from the revenue SKUs. Actuals through the last booked month, then the Data Science trend and your changes." right={<Legend s={series} />}>
        <ForecastChart title="Weighted gross price" s={series} fmt={v => usd(v)} dp={0} unit="$ / pack" height={250} />
      </Card>

      <Card title="Monthly packs · revenue (counted) vs sample (excluded)" sub="Only revenue packs count toward the weighted price. Free packs would drag the average down, so they are flagged non-revenue and left out.">
        <div className="flex h-[170px] items-end gap-1.5" role="img" aria-label="Monthly packs, revenue versus sample">
          {packsByMonth.map(p => (
            <div key={p.i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={`${mLong(p.i)}: ${p.rev.toLocaleString('en-US')} revenue packs, ${p.free.toLocaleString('en-US')} sample packs`}>
              <span className="w-full rounded-t bg-border-strong" style={{ height: `${(p.free / packMax) * 150}px` }} />
              <span className={cx('w-full rounded-t', p.i < ACT ? 'bg-ok' : 'bg-ok/60')} style={{ height: `${(p.rev / packMax) * 150}px` }} />
            </div>))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-text-3"><span>{mLong(packsByMonth[0]!.i)}</span><span>solid = actual · lighter = forecast</span><span>{mLong(packsByMonth[packsByMonth.length - 1]!.i)}</span></div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 text-[12px] text-text-2"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-ok" />Revenue packs (counted)</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-border-strong" />Sample packs, {freePacks.toLocaleString('en-US')} a month (excluded)</span></p>
      </Card>

      <Card title="Weighted gross price · by SKU"
        sub="Brand price is the pack-weighted average of each revenue SKU’s list price. Free packs are excluded from the weighting."
        right={readOnly ? <Tag tone="neutral"><Lock size={10} />View only</Tag> : <Seg label="Edit level" value={d.level} onChange={level => setD(x => ({ ...x, level }))} options={[{ id: 'sku', label: 'By SKU' }, { id: 'brand', label: 'Weighted brand' }]} />}>
        {d.level === 'sku' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3">
                <th className="py-2 text-left font-semibold">SKU</th><th className="py-2 text-center font-semibold">Revenue</th><th className="py-2 text-right font-semibold">Packs / mo</th><th className="py-2 text-right font-semibold">Mix</th><th className="py-2 pl-3 text-right font-semibold">List price</th><th className="py-2 pl-3 text-right font-semibold" title="Last 12 actual months and the forecast">Trend</th>
              </tr></thead>
              <tbody>{d.skus.map(s => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-2">{s.name}{s.note && <span className="ml-1.5 text-[11px] text-text-3">· {s.note}</span>}</td>
                  <td className="py-2 text-center"><input type="checkbox" disabled={readOnly} checked={s.rev} onChange={e => set(s.id, { rev: e.target.checked })} aria-label={`${s.name} earns revenue`} className="h-4 w-4 accent-[#0000c9]" /></td>
                  <td className="py-2 text-right font-mono">{s.packs.toLocaleString('en-US')}</td>
                  <td className="py-2 text-right font-mono text-text-2">{s.rev && revPacks ? `${((s.packs / revPacks) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="py-1.5 pl-3 text-right"><input type="number" disabled={readOnly} step={0.1} value={s.price} onChange={e => set(s.id, { price: e.target.value === '' ? 0 : +e.target.value })} aria-label={`${s.name} list price`}
                    className="ml-auto block w-28 rounded border border-[#F0D98A] bg-[#FFF9E0] px-2 py-1 text-right font-mono text-[12.5px] outline-none focus:border-brand disabled:border-border disabled:bg-surface-2 disabled:text-text-2" /></td>
                  <td className="py-1.5 pl-3 text-right">{s.rev ? <SkuSpark price={s.price} /> : <span className="text-text-3">excluded</span>}</td>
                </tr>))}</tbody>
            </table>
            <div className="mt-3 flex items-center gap-3 text-[11.5px] text-text-3">
              <span className="shrink-0">Packs / month</span>
              <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden><span className="bg-brand" style={{ width: `${(revPacks / (revPacks + freePacks || 1)) * 100}%` }} /><span className="bg-border-strong" style={{ width: `${(freePacks / (revPacks + freePacks || 1)) * 100}%` }} /></span>
              <span className="shrink-0"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-brand" />revenue {revPacks.toLocaleString('en-US')} <i className="ml-2 mr-1 inline-block h-2 w-2 rounded-full bg-border-strong" />free {freePacks.toLocaleString('en-US')}</span>
            </div>
          </div>
        ) : (
          <label className="block max-w-xs"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Weighted brand price override</span>
            <input type="number" disabled={readOnly} step={0.1} value={d.brandPrice ?? +skuWgp(d.skus).toFixed(2)} onChange={e => setD(x => ({ ...x, brandPrice: e.target.value === '' ? null : +e.target.value }))} className={cx(field, 'border-[#F0D98A] bg-[#FFF9E0] font-mono')} />
            <span className="mt-1 block text-[11.5px] text-text-3">System value from SKUs: {usd(skuWgp(d.skus))}. Clear to return to it.</span></label>
        )}
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Weighted gross price / pack</p><p className="font-mono text-[19px] font-semibold text-brand">{usd(wgp)}</p><p className={cx('text-[11.5px]', Math.abs(chg) < 0.005 ? 'text-text-3' : chg > 0 ? 'text-ok' : 'text-err')}>{Math.abs(chg) < 0.005 ? 'System value' : `${chg > 0 ? '+' : '−'}${Math.abs(chg).toFixed(2)}% vs system ${usd(sys)}`}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Price per tablet</p><p className="font-mono text-[19px] font-medium">{usd(wgp / PILLS)}</p><p className="text-[11.5px] text-text-3">÷ {PILLS} tablets per pack</p></div>
          <div><p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-3"><Lock size={10} />Net sales price</p><p className="font-mono text-[19px] font-medium">{usd(wgp * (1 - GTN))}</p><p className="text-[11.5px] text-text-3">Calculated: gross × (1 − {Math.round(GTN * 100)}% GtN)</p></div>
          <label className="block"><span className="block text-[11px] font-semibold uppercase tracking-wide text-text-3">Effective from</span>
            <select disabled={readOnly} aria-label="Price change effective from" value={d.from} onChange={e => setD(x => ({ ...x, from: +e.target.value }))} className={cx(field, 'mt-1')}>{months.map(i => <option key={i} value={i}>{mLong(i)}</option>)}</select>
            <span className="mt-1 block text-[11.5px] text-text-3">The change carries to every later month.</span></label>
        </div>
        {!readOnly && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Btn disabled={!dirty} onClick={() => onApply(d)}>Apply to forecast</Btn>
          <Btn variant="secondary" disabled={!dirty} onClick={() => setD(gp)}>Discard</Btn>
          <Btn variant="ghost" icon={<RotateCcw size={14} />} disabled={!applied && !dirty} onClick={onReset}>Reset to system value</Btn>
          {applied && !dirty && <Tag tone="brand">Applied · moves gross, then net</Tag>}
          {dirty && <Tag tone="warn">Unapplied changes</Tag>}
        </div>}
      </Card>

      <Card title="Price events" sub="Price changes enter as dated, sourced events, then flow through the same weighting. They are added in Events."
        right={<Btn variant="secondary" size="sm" onClick={onEvents} icon={<ArrowRight size={14} />}>Open Events</Btn>}>
        {priceEvents.length ? (
          <ul className="divide-y divide-border">{priceEvents.map(e => {
            const im = e.impacts.find(i => i.metric === 'price')!, on = scenarios.filter(s => s.active.includes(e.id))
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-[200px] flex-1"><p className="text-[13px] font-medium">{e.name}</p><p className="text-[12px] text-text-2">{e.sub ?? e.type} · {mLong(e.date)} · {e.prob}% likely · target ALL SKUs</p></div>
                <span className={cx('font-mono text-[13px] font-semibold', im.dir === 'up' ? 'text-ok' : 'text-err')}>{im.dir === 'up' ? '+' : '−'}{im.mag}% gross</span>
                <span className="text-[12px] text-text-3">{on.length ? `In ${on.map(s => s.name).join(', ')}` : 'In no scenario'}</span>
              </li>)
          })}</ul>
        ) : <p className="text-[13px] text-text-2">No price events yet. Add a List / WAC event in Events.</p>}
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[11.5px] text-text-3">
          <li>Only List / WAC events move gross price. GTN events (Ascent, 340B, IRA) land on net downstream and never touch gross.</li>
          <li>A single-SKU action moves the brand price by that pack’s dollar share (price × packs), not its pack share.</li>
          <li>A new increase adds only the gap over what the trend already carries, or it double-counts.</li>
        </ul>
      </Card>

    </div>
  )
}

/** Right-pane view for a default module selected in the forecast map. Edits only in the Forecast workspace. */
/** Screen 4 of the Gross Price Workflow: net sales price is a read-only calculation, never forecast and never overridden. */
export function NetSalesPriceView({ gross, trend, scenarioName }: { gross: number; trend?: ModTrend; scenarioName?: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[26px] font-semibold tracking-tight">Net sales price</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-text-2">Calculated from weighted gross price and gross-to-net. Not forecast.{scenarioName ? ` Showing ${scenarioName}.` : ''}</p>
      </div>
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="rounded-lg border border-border bg-surface px-4 py-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Weighted gross price</p><p className="mt-0.5 font-mono text-[24px] font-semibold">{usd(gross)}</p><p className="text-[12px] text-text-3">/ pack · forecast (set in Weighted gross price)</p></div>
        <span aria-hidden className="text-center text-xl text-text-3">×</span>
        <div className="rounded-lg border border-border bg-surface-2/60 px-4 py-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">(1 − GtN)</p><p className="mt-0.5 font-mono text-[24px] font-semibold">{((1 - GTN) * 100).toFixed(1)}%</p><p className="text-[12px] text-text-3">GtN {(GTN * 100).toFixed(1)}% · from the discount / rebate module</p></div>
        <span aria-hidden className="text-center text-xl text-text-3">=</span>
        <div className="rounded-lg border border-brand/30 bg-brand-soft/40 px-4 py-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Net sales price (calc)</p><p className="mt-0.5 font-mono text-[24px] font-semibold text-brand">{usd(gross * (1 - GTN))}</p><p className="text-[12px] text-text-3">/ pack · read-only derived view</p></div>
      </div>
      <p className="border-l-2 border-err bg-err-soft px-4 py-3 text-[13px] text-text"><b>Boundary:</b> this screen computes, it does not forecast. The forecast stops at gross price; GtN is owned by a separate module. Change a price here and nothing happens: edit gross (per SKU or weighted) or GtN, and this view recalculates.</p>
      {trend && <Card title="Net sales price · monthly" sub="Calculated from the weighted gross price. There is no override on this line." right={<Legend s={trend.s} />}>
        {trend.header && <div className="mb-3 space-y-3">{trend.header}</div>}
        <ForecastChart title="Net sales price" s={trend.s} fmt={trend.fmt} dp={trend.dp} unit={trend.unit} height={260} />
      </Card>}
    </div>
  )
}

export type ModTrend ={ s: ChartSeries; fmt: (v: number) => string; dp: number; unit: string; header?: ReactNode }
export function ModuleView({ id, net, ue, setUe, woh, setWoh, editable, onEdit, trend }: { id: Exclude<ModId, 'gp' | 'netp'>; net: number; ue: number[]; setUe: (v: number[]) => void; woh: number; setWoh: (v: number) => void; editable: boolean; onEdit: () => void; trend?: ModTrend }) {
  const m = MODS.find(x => x.id === id)!, b = bridgeOf(net, ueFy(ue), woh)
  const DESC: Record<Exclude<ModId, 'gp' | 'netp'>, string> = {
    tud: 'Demand dollars on the model’s declared basis. Calculated and read-only: change it upstream through the funnel rates, share or gross price.',
    inv: 'Month-over-month change in wholesaler on-hand inventory (WAC $). Forecast months hold a target weeks on hand that scales with demand.',
    ue: 'Gross − total underlying demand − Δ inventory. Forecast as a % of gross by month; the full-year wash-out is checked against a ±5% trigger.',
    fx: 'Translates local-currency forecasts to the reporting currency. This model is US-only, so every rate is 1.0 and reported equals constant currency.',
  }
  const stat = (k: string, v: string, sub: string) => <div className="rounded-md border border-border px-3.5 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{k}</p><p className="mt-0.5 font-mono text-[19px] font-medium">{v}</p><p className="mt-0.5 text-[12px] text-text-2">{sub}</p></div>
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[26px] font-semibold tracking-tight">{m.label}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-text-2">{DESC[id]}</p>
        </div>
        {m.edit && !editable && <Btn onClick={onEdit}>Edit in Forecast workspace</Btn>}
      </div>
      {trend && (
        <Card title={`${m.label} · monthly trend`} sub={`${trend.unit}. Actuals, the Data Science trend and the active forecast${id === 'inv' || id === 'ue' ? ', with the override below' : ''}.`} right={<Legend s={trend.s} />}>
          {trend.header && <div className="mb-3 space-y-3">{trend.header}</div>}
          <ForecastChart title={`${m.label} trend`} s={trend.s} fmt={trend.fmt} dp={trend.dp} unit={trend.unit} height={280} />
        </Card>)}
      {id === 'ue' && <UnexplainedPct ue={ue} setUe={setUe} readOnly={!editable} />}
      {id === 'tud' && <><RequiredFunnel net={net} ue={ue} woh={woh} /><div className="grid gap-3 sm:grid-cols-3">
        {stat(`TUD · FY${FY}`, fmtB(b.tud), 'Gross − Δ inventory − unexplained')}
        {stat('Construction', 'Patient flow', 'On-brand patients × fills × price')}
        {stat('Triangulation', 'Flow = cohort', 'Same demand basis across methods')}</div></>}
      {id === 'inv' && <>
        <div className="grid gap-3 sm:grid-cols-3">
          {stat(`Δ Inventory · FY${FY}`, `${b.inv >= 0 ? '+' : '−'}${fmtB(Math.abs(b.inv))}`, 'Bridge from demand to gross')}
          <div className="rounded-md border border-border px-3.5 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Target weeks on hand</p>
            {editable
              ? <input type="number" step={0.05} min={0} aria-label="Target weeks on hand" value={woh} onChange={e => setWoh(e.target.value === '' ? WOH_DEFAULT : Math.max(0, +e.target.value))} className="mt-0.5 block w-28 rounded border border-[#F0D98A] bg-[#FFF9E0] px-2 py-1 font-mono text-[17px] outline-none focus:border-brand" />
              : <p className="mt-0.5 font-mono text-[19px] font-medium">{woh.toFixed(2)} wks</p>}
            <p className="mt-0.5 text-[12px] text-text-2">{Math.abs(woh - WOH_DEFAULT) < 0.005 ? 'Default · scales with demand' : <button type="button" onClick={() => setWoh(WOH_DEFAULT)} className="font-semibold text-brand hover:underline">Reset to {WOH_DEFAULT} wks</button>}</p></div>
          {stat('Source', '852 / 867 feed', 'Wholesaler on-hand · Trade & Distribution')}
        </div>
        <p className="text-[12px] text-text-3">ΔInv(m) = On-hand(m) − On-hand(m−1). A higher target stocks the channel, so gross runs above demand; a lower one destocks it. Gross and net revenue do not move: the split between demand and inventory does.</p>
      </>}
      {id === 'fx' && <Card title="Rates · reporting currency USD" pad={false}><table className="w-full text-[13px]">
        <thead><tr className="border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-text-3"><th className="px-4 py-2 text-left font-semibold">Market</th><th className="px-4 py-2 text-right font-semibold">Currency</th><th className="px-4 py-2 text-right font-semibold">Planning rate</th><th className="px-4 py-2 text-right font-semibold">FX impact</th></tr></thead>
        <tbody><tr><td className="px-4 py-2.5">United States</td><td className="px-4 py-2.5 text-right font-mono">USD</td><td className="px-4 py-2.5 text-right font-mono">1.0000</td><td className="px-4 py-2.5 text-right font-mono text-text-3">$0</td></tr></tbody></table></Card>}
    </div>
  )
}

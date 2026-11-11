import { useState } from 'react'
import { ArrowRight, Lock, RotateCcw } from 'lucide-react'
import { ACT, FY, GTN, MONTHS, START_YEAR, fmtRev } from './engine'
import { Btn, Card, Seg, Tag, cx, field, PageTitle } from './ui'

/* Default modules every model carries (Default Modules + Gross Price Workflow docs).
   shortcut: gross sales, Δ inventory and TUD are worked back from net revenue here with illustrative ratios
   (engine GTN, Δ inventory +0.46% of gross, LES Nurtec v3.12.21). Move into the engine when the gross build lands. */
const INV_PCT = 0.0046, UE_TRIGGER = 5
const CUR = START_YEAR + Math.floor((ACT - 1) / 12), YTD = ((ACT - 1) % 12) + 1
// FY2025 Unexplained % of gross was −5.1%; current-year actual months as booked.
export const UE_PRIOR = -5.1
const UE_ACT = [-2.1, -6.8, -4.2, -7.1, -5.5, -1.9, -6.2].slice(0, YTD)
/** Default: hold YTD actuals, backfill the rest so the full year lands on the prior-year FY %. */
export const ueDefault = () => { const fill = (UE_PRIOR * 12 - UE_ACT.reduce((a, b) => a + b, 0)) / (12 - YTD); return [...UE_ACT, ...Array.from({ length: 12 - YTD }, () => +fill.toFixed(1))] }
export const ueFy = (m: number[]) => m.reduce((a, b) => a + b, 0) / 12
if (import.meta.env.DEV) console.assert(Math.abs(ueFy(ueDefault()) - UE_PRIOR) < 0.05, 'ueDefault must land on the prior-year FY %')

/** Gross = TUD + ΔInv + UE, worked back from net revenue ($M). */
export const bridgeOf = (net: number, uePct: number) => { const gross = net / (1 - GTN), ueD = gross * uePct / 100, inv = gross * INV_PCT; return { gross, ueD, inv, tud: gross - inv - ueD } }
export const fmtB = (v: number) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(2)}B` : fmtRev(v, 0)

/** The five default modules, in funnel order, as they appear in the forecast map. */
export type ModId = 'gp' | 'tud' | 'inv' | 'ue' | 'fx'
export const MODS: { id: ModId; label: string; kind: string; edit: boolean }[] = [
  { id: 'gp', label: 'Weighted gross price', kind: 'Editable', edit: true },
  { id: 'tud', label: 'Total underlying demand', kind: 'Calculated', edit: false },
  { id: 'inv', label: 'Change in inventory', kind: 'Target WOH', edit: false },
  { id: 'ue', label: 'Unexplained difference', kind: '% by month', edit: true },
  { id: 'fx', label: 'Exchange rates', kind: 'USD · 1.0', edit: false },
]

/** Revenue funnel with the required lines. The FY ahead holds the current year's Unexplained % (same default every year). */
export function RequiredFunnel({ net, ue }: { net: number; ue: number[] }) {
  const uePct = ueFy(ue), { gross, ueD, inv, tud } = bridgeOf(net, uePct)
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
    <Card title={`Revenue funnel · FY${FY}`} info="Required lines in every model. Total underlying demand is calculated: change it upstream." right={<Tag tone="neutral">USD · FX 1.0 (US-only)</Tag>}>
      <div className="flex flex-wrap items-stretch gap-2">
        {box('Total underlying demand', fmtB(tud), 'calculated', 'neutral', 'upstream only', true)}{arrow}
        {box('+ Δ Inventory', `${inv >= 0 ? '+' : '−'}${fmtB(Math.abs(inv))}`, 'target WOH', 'warn', '≈2.26 weeks on hand')}{arrow}
        {box('Gross sales', fmtB(gross), 'gross price', 'warn', 'editable in Price')}{arrow}
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
    <Card title={`Unexplained difference · % of gross by month, ${CUR}`} info={`Prior-year FY ${UE_PRIOR}% is the target. ${MONTHS[0]}–${MONTHS[YTD - 1]} actuals are held; the rest backfill so the full year lands on it. Any forecast month is editable. FY${CUR + 1} onward holds this full-year % in every month. Unexplained $ = % × gross.`}
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
    </Card>
  )
}

type Sku = { id: string; name: string; price: number; packs: number; rev: boolean; note?: string }
// Nurtec ODT pack list (illustrative, Blaze/Snowflake FINANCE extract shape). Free packs carry no revenue.
const SKUS: Sku[] = [
  { id: 'r8', name: 'ODT 75 mg · 8 ct · retail', price: 1089.6, packs: 98200, rev: true },
  { id: 'i8', name: 'ODT 75 mg · 8 ct · institutional', price: 1021.4, packs: 14600, rev: true },
  { id: 's2', name: 'ODT 75 mg · 2 ct · starter', price: 272.4, packs: 6300, rev: false, note: 'starter' },
  { id: 'sm', name: 'Sample pack · 2 ct', price: 0, packs: 12768, rev: false, note: 'sample' },
  { id: 'cv', name: 'Copay voucher fill · 8 ct', price: 1089.6, packs: 4100, rev: false, note: 'voucher' },
]
const PILLS = 8
const weighted = (xs: Sku[]) => { const p = xs.filter(s => s.rev).reduce((a, s) => a + s.packs, 0); return p ? xs.filter(s => s.rev).reduce((a, s) => a + s.price * s.packs, 0) / p : 0 }
const usd = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Weighted gross price: Σ(price × mix) over revenue SKUs. Net sales price is calculated, never forecast. */
export function GrossPriceSkus({ readOnly, base }: { readOnly?: boolean; base: number }) {
  // SKU list prices start scaled so their pack-weighted average equals the forecast's weighted gross price driver.
  const [skus, setSkus] = useState(() => { const k = base / weighted(SKUS); return SKUS.map(s => ({ ...s, price: +(s.price * k).toFixed(2) })) })
  const [level, setLevel] = useState<'sku' | 'brand'>('sku')
  const [brandPrice, setBrandPrice] = useState<number | null>(null)
  const revPacks = skus.filter(s => s.rev).reduce((a, s) => a + s.packs, 0)
  const wgpSku = weighted(skus)
  const wgp = level === 'brand' && brandPrice !== null ? brandPrice : wgpSku
  const set = (id: string, p: Partial<Sku>) => setSkus(xs => xs.map(s => (s.id === id ? { ...s, ...p } : s)))
  return (
    <Card title="Weighted gross price · by SKU" info="Brand price is the pack-weighted average of each revenue SKU’s list price. Free packs are excluded from the weighting. Only List / WAC events move gross price; GTN events land on net. Add price changes as dated events in Events."
      right={readOnly ? <Tag tone="neutral"><Lock size={10} />View only</Tag> : <Seg label="Edit level" value={level} onChange={setLevel} options={[{ id: 'sku', label: 'By SKU' }, { id: 'brand', label: 'Weighted brand' }]} />}>
      {level === 'sku' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3">
              <th className="py-2 text-left font-semibold">SKU</th><th className="py-2 text-center font-semibold">Revenue</th><th className="py-2 text-right font-semibold">Packs / mo</th><th className="py-2 text-right font-semibold">Mix</th><th className="py-2 pl-3 text-right font-semibold">List price</th>
            </tr></thead>
            <tbody>{skus.map(s => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="py-2">{s.name}{s.note && <span className="ml-1.5 text-[11px] text-text-3">· {s.note}</span>}</td>
                <td className="py-2 text-center"><input type="checkbox" disabled={readOnly} checked={s.rev} onChange={e => set(s.id, { rev: e.target.checked })} aria-label={`${s.name} earns revenue`} className="h-4 w-4 accent-[#0000c9]" /></td>
                <td className="py-2 text-right font-mono">{s.packs.toLocaleString('en-US')}</td>
                <td className="py-2 text-right font-mono text-text-2">{s.rev && revPacks ? `${((s.packs / revPacks) * 100).toFixed(1)}%` : '—'}</td>
                <td className="py-1.5 pl-3 text-right"><input type="number" disabled={readOnly} step={0.1} value={s.price} onChange={e => set(s.id, { price: e.target.value === '' ? 0 : +e.target.value })} aria-label={`${s.name} list price`}
                  className="ml-auto block w-28 rounded border border-[#F0D98A] bg-[#FFF9E0] px-2 py-1 text-right font-mono text-[12.5px] outline-none focus:border-brand disabled:border-border disabled:bg-surface-2 disabled:text-text-2" /></td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : (
        <label className="block max-w-xs"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Weighted brand price override</span>
          <input type="number" step={0.1} value={brandPrice ?? +wgpSku.toFixed(2)} onChange={e => setBrandPrice(e.target.value === '' ? null : +e.target.value)} className={cx(field, 'border-[#F0D98A] bg-[#FFF9E0] font-mono')} />
          <span className="mt-1 block text-[11.5px] text-text-3">System value from SKUs: {usd(wgpSku)}. Clear to return to it.</span></label>
      )}
      <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Weighted gross price / pack</p><p className="font-mono text-[19px] font-semibold text-brand">{usd(wgp)}</p></div>
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Price per tablet</p><p className="font-mono text-[19px] font-medium">{usd(wgp / PILLS)}</p><p className="text-[11.5px] text-text-3">÷ {PILLS} tablets per pack</p></div>
        <div><p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-3"><Lock size={10} />Net sales price</p><p className="font-mono text-[19px] font-medium">{usd(wgp * (1 - GTN))}</p><p className="text-[11.5px] text-text-3">Calculated: gross × (1 − {Math.round(GTN * 100)}% GtN)</p></div>
      </div>
    </Card>
  )
}

/** Right-pane view for a default module selected in the forecast map. Edits only in the Forecast workspace. */
export function ModuleView({ id, net, gp, ue, setUe, editable, onEdit }: { id: ModId; net: number; gp: number; ue: number[]; setUe: (v: number[]) => void; editable: boolean; onEdit: () => void }) {
  const m = MODS.find(x => x.id === id)!, b = bridgeOf(net, ueFy(ue))
  const DESC: Record<ModId, string> = {
    gp: 'Pack-volume-weighted average of each revenue SKU’s list price. Free packs (samples, vouchers, starter) are excluded. Drives gross; net sales price is calculated.',
    tud: 'Demand dollars on the model’s declared basis. Calculated and read-only: change it upstream through the funnel rates, share or price.',
    inv: 'Month-over-month change in wholesaler on-hand inventory (WAC $). Forecast months hold a target weeks on hand that scales with demand.',
    ue: 'Gross − total underlying demand − Δ inventory. Forecast as a % of gross by month; the full-year wash-out is checked against a ±5% trigger.',
    fx: 'Translates local-currency forecasts to the reporting currency. This model is US-only, so every rate is 1.0 and reported equals constant currency.',
  }
  const stat = (k: string, v: string, sub: string) => <div className="rounded-md border border-border px-3.5 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{k}</p><p className="mt-0.5 font-mono text-[19px] font-medium">{v}</p><p className="mt-0.5 text-[12px] text-text-2">{sub}</p></div>
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><PageTitle title={m.label} info={DESC[id]} /></div>
        {m.edit && !editable && <Btn onClick={onEdit}>Edit in Forecast workspace</Btn>}
      </div>
      {id === 'gp' && <GrossPriceSkus readOnly={!editable} base={gp} />}
      {id === 'ue' && <UnexplainedPct ue={ue} setUe={setUe} readOnly={!editable} />}
      {id === 'tud' && <><RequiredFunnel net={net} ue={ue} /><div className="grid gap-3 sm:grid-cols-3">
        {stat(`TUD · FY${FY}`, fmtB(b.tud), 'Gross − Δ inventory − unexplained')}
        {stat('Construction', 'Patient flow', 'On-brand patients × fills × price')}
        {stat('Triangulation', 'Flow = cohort', 'Same demand basis across methods')}</div></>}
      {id === 'inv' && <div className="grid gap-3 sm:grid-cols-3">
        {stat(`Δ Inventory · FY${FY}`, `${b.inv >= 0 ? '+' : '−'}${fmtB(Math.abs(b.inv))}`, 'Bridge from demand to gross')}
        {stat('Target weeks on hand', '2.26 wks', 'Scales with demand')}
        {stat('Source', '852 / 867 feed', 'Wholesaler on-hand · Trade & Distribution')}</div>}
      {id === 'fx' && <Card title="Rates · reporting currency USD" pad={false}><table className="w-full text-[13px]">
        <thead><tr className="border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-text-3"><th className="px-4 py-2 text-left font-semibold">Market</th><th className="px-4 py-2 text-right font-semibold">Currency</th><th className="px-4 py-2 text-right font-semibold">Planning rate</th><th className="px-4 py-2 text-right font-semibold">FX impact</th></tr></thead>
        <tbody><tr><td className="px-4 py-2.5">United States</td><td className="px-4 py-2.5 text-right font-mono">USD</td><td className="px-4 py-2.5 text-right font-mono">1.0000</td><td className="px-4 py-2.5 text-right font-mono text-text-3">$0</td></tr></tbody></table></Card>}
    </div>
  )
}

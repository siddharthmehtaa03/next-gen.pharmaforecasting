/* BD vaccine asset workspace — unified flow.
 * Entry from the third landing card. Lists BD/BD&L vaccine assets, opens one
 * into a tabbed workspace: Assumptions · Market share · Engine · Output · Sandbox.
 *
 * Uses the same Tailwind token classes as the rest of the app (bg-surface,
 * border-border, text-brand, bg-brand-soft, text-text-2, text-text-3, etc.).
 * Icons from lucide-react, matching the app's convention.
 *
 * Mock data lives next to this file in ./data.ts. Replace with real engines later.
 */

import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Beaker, ChevronDown, ChevronRight, Download,
  Globe, Info, Layers, LineChart, Plus, RefreshCw, Rows3, Sliders, Sparkles, Table2, Target, X,
} from 'lucide-react'
import { ASSETS, SCENARIOS, YEARS, findAsset } from './data'
import type { Asset, ChainStep, GridDriver, ScenarioId, SliderInput } from './data'

/* ───────────────────────── Primitives ───────────────────────── */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'danger' | 'brand' | 'neutral'; children: ReactNode }) {
  const toneMap: Record<string, string> = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-err-soft text-err',
    brand: 'bg-brand-soft text-brand',
    neutral: 'bg-surface-2 text-text-2',
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', toneMap[tone])}>
      <span className={cx('h-1.5 w-1.5 rounded-full', {
        ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-err', brand: 'bg-brand', neutral: 'bg-text-3',
      }[tone])} />
      {children}
    </span>
  )
}

function Btn({ children, variant = 'primary', size = 'md', onClick, icon, disabled, title }: {
  children?: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md'
  onClick?: () => void; icon?: ReactNode; disabled?: boolean; title?: string
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40'
  const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-[13.5px]' }
  const variants = {
    primary: 'bg-[#15161d] text-white shadow-[inset_0_1px_0_rgb(255_255_255/.14),0_1px_2px_rgb(0_0_0/.25)] hover:bg-black',
    secondary: 'border border-border bg-surface text-text shadow-sm hover:bg-surface-2',
    ghost: 'text-text-2 hover:bg-surface-2 hover:text-text',
  }
  return (
    <button type="button" disabled={disabled} title={title} onClick={onClick}
      className={cx(base, sizes[size], variants[variant])}>
      {icon}{children}
    </button>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-border bg-surface shadow-[0_1px_1px_rgb(20_20_30/.03),0_10px_28px_-16px_rgb(20_20_30/.16)]', className)}>
      {children}
    </div>
  )
}

function SectionHeader({ title, right, sub }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {sub && <p className="mt-0.5 text-[12.5px] text-text-3">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function fmtMoney(nM: number) {
  if (nM >= 1000) return `$${(nM / 1000).toFixed(2)}B`
  return `$${Math.round(nM)}M`
}

/* ───────────────────────── Asset list (entry screen) ───────────────────────── */

function AssetTile({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const b = asset.kpis.peakRevenueB
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col rounded-2xl border border-border bg-surface p-6 text-left shadow-[0_1px_1px_rgb(20_20_30/.03),0_10px_28px_-16px_rgb(20_20_30/.16)] transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_2px_4px_rgb(20_20_30/.04),0_10px_24px_-12px_rgb(20_20_30/.18)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-3">BD · Pipeline asset</span>
        <Pill tone="ok">Illustrative</Pill>
      </div>
      <h3 className="mt-3 text-[20px] font-semibold tracking-tight">{asset.name}</h3>
      <p className="mt-1 text-[13px] text-text-2">{asset.therapy}</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Pessimistic</p>
          <p className="mt-1 font-mono text-[15px] font-semibold text-text">${b.pess.toFixed(2)}B</p>
        </div>
        <div className="rounded-lg bg-brand-soft/60 px-2 py-1 -mx-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand/80">Base</p>
          <p className="mt-1 font-mono text-[17px] font-semibold text-brand">${b.base.toFixed(2)}B</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Optimistic</p>
          <p className="mt-1 font-mono text-[15px] font-semibold text-text">${b.opt.toFixed(2)}B</p>
        </div>
      </div>

      <p className="mt-5 text-[12px] text-text-3">{asset.countries.length} market{asset.countries.length > 1 ? 's' : ''} · peak {asset.kpis.peakYear.base} · {asset.kpis.cagrPct.base.toFixed(1)}% CAGR</p>

      <div className="mt-6 flex items-center gap-1.5 border-t border-border pt-4 text-[13px] font-semibold text-brand">
        Open workspace
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

function BdAssetList({ onOpenAsset, onBack }: { onOpenAsset: (id: string) => void; onBack: () => void }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center gap-4 border-b border-border bg-surface px-6 py-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
          <ArrowLeft size={14} /> Home
        </button>
        <span className="text-text-3">/</span>
        <span className="text-[13px] font-semibold text-brand">BD asset sizing</span>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-3">Business development</p>
            <h2 className="mt-1 text-[28px] font-semibold tracking-tight">Size a new asset</h2>
            <p className="mt-1.5 max-w-2xl text-[14px] text-text-2">
              Shape the opportunity for a pipeline or BD&amp;L vaccine asset before a model is built. Set assumptions,
              see the engine chain, run a sandbox. Hand off to the CoE when it is ready to become a certified model.
            </p>
          </div>
          <Btn variant="secondary" icon={<Plus size={14} />}>New asset</Btn>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ASSETS.map(a => <AssetTile key={a.id} asset={a} onOpen={() => onOpenAsset(a.id)} />)}

          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-background/50 p-6 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface">
              <Plus size={18} className="text-text-3" />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold tracking-tight">Add another asset</h3>
            <p className="mt-1 max-w-xs text-[12.5px] text-text-3">Start from a blank canvas, an analog, or a target product profile.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ───────────────────────── Workspace shell ───────────────────────── */

type TabId = 'assumptions' | 'share' | 'engine' | 'output' | 'sandbox'

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'assumptions', label: 'Assumptions', icon: <Sliders size={14} /> },
  { id: 'share',       label: 'Market share', icon: <Target size={14} /> },
  { id: 'engine',      label: 'Engine',       icon: <Rows3 size={14} /> },
  { id: 'output',      label: 'Output',       icon: <LineChart size={14} /> },
  { id: 'sandbox',     label: 'Sandbox',      icon: <Beaker size={14} /> },
]

function ScenarioSegment({ value, onChange }: { value: ScenarioId; onChange: (v: ScenarioId) => void }) {
  return (
    <div role="radiogroup" aria-label="Scenario" className="inline-flex rounded-xl bg-surface-2 p-0.5">
      {SCENARIOS.map(s => (
        <button key={s.id} type="button" role="radio" aria-checked={value === s.id}
          onClick={() => onChange(s.id)}
          className={cx(
            'rounded-lg px-3 py-1 text-[12.5px] font-semibold transition-colors',
            value === s.id ? 'bg-surface text-text shadow-[0_2px_4px_rgb(20_20_30/.04),0_10px_24px_-12px_rgb(20_20_30/.18)]' : 'text-text-2 hover:text-text',
          )}>
          {s.label}
        </button>
      ))}
    </div>
  )
}

function CountryDropdown({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  if (options.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2">
        <Globe size={14} /> {options[0]}
      </span>
    )
  }
  return (
    <label className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-text-3">
      <Globe size={14} />
      Geography
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-[13px] font-semibold normal-case tracking-normal text-text shadow-sm">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function KpiBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-3">{label}</p>
      <p className="mt-1 font-mono text-[18px] font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[11.5px] text-text-3">{sub}</p>}
    </div>
  )
}

function Sparkline({ values, color = 'var(--color-brand)' }: { values: number[]; color?: string }) {
  const min = Math.min(...values), max = Math.max(...values)
  const span = Math.max(1, max - min)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / span) * 90 - 5}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ───────────────────────── Tabs: Assumptions ───────────────────────── */

function SliderRow({ input, scenario, override, onChange }: {
  input: SliderInput; scenario: ScenarioId
  override: number | undefined; onChange: (v: number) => void
}) {
  const current = override ?? input.base[scenario]
  const pct = (v: number) => ((v - input.min) / (input.max - input.min)) * 100
  const pessPct = pct(input.base.pess), optPct = pct(input.base.opt)
  return (
    <div className="grid grid-cols-[1fr_minmax(260px,420px)_112px] items-center gap-5 border-b border-border px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-text">{input.label}</p>
        <p className="mt-0.5 text-[12px] text-text-3">{input.source}</p>
      </div>
      <div className="min-w-0">
        <div className="relative">
          <div className="h-1.5 w-full rounded-full bg-surface-2" />
          <div className="absolute top-0 h-1.5 rounded-full bg-brand-soft"
               style={{ left: `${Math.min(pessPct, optPct)}%`, width: `${Math.abs(optPct - pessPct)}%` }} />
          <input type="range" aria-label={input.label}
            min={input.min} max={input.max} step={input.step ?? 1}
            value={current} onChange={e => onChange(Number(e.target.value))}
            className="absolute top-0 -mt-[7px] h-5 w-full cursor-pointer appearance-none bg-transparent"
            style={{ accentColor: 'var(--color-brand)' }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11.5px] text-text-3">
          <span>Pess {input.base.pess}{input.unit}</span>
          <span>Opt {input.base.opt}{input.unit}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <input type="number" value={current}
          onChange={e => onChange(Number(e.target.value))}
          min={input.min} max={input.max} step={input.step ?? 1}
          aria-label={`${input.label} value`}
          className="h-9 w-20 rounded-lg border border-border bg-surface px-2 text-right font-mono text-[14px] font-semibold shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
        />
        <span className="text-[12px] text-text-3">{input.unit}</span>
      </div>
    </div>
  )
}

function AssumptionsSliders({ asset, scenario, overrides, setOverride }: {
  asset: Asset; scenario: ScenarioId
  overrides: Record<string, number>; setOverride: (id: string, v: number | undefined) => void
}) {
  const groups = useMemo(() => {
    const order: string[] = []
    const map: Record<string, SliderInput[]> = {}
    for (const s of asset.sliders ?? []) {
      if (!map[s.group]) { map[s.group] = []; order.push(s.group) }
      map[s.group].push(s)
    }
    return order.map(k => ({ name: k, rows: map[k] }))
  }, [asset])

  return (
    <div className="space-y-5">
      {groups.map(g => (
        <Card key={g.name}>
          <SectionHeader title={g.name} sub={`${g.rows.length} input${g.rows.length === 1 ? '' : 's'}`} />
          <div>
            {g.rows.map(r => (
              <SliderRow key={r.id} input={r} scenario={scenario}
                override={overrides[r.id]}
                onChange={v => setOverride(r.id, v === r.base[scenario] ? undefined : v)} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function AssumptionsGrid({ asset, country }: { asset: Asset; country: string }) {
  const groups = useMemo(() => {
    const order: string[] = []
    const map: Record<string, GridDriver[]> = {}
    for (const g of asset.grid ?? []) {
      if (!map[g.group]) { map[g.group] = []; order.push(g.group) }
      map[g.group].push(g)
    }
    return order.map(k => ({ name: k, rows: map[k] }))
  }, [asset])

  return (
    <Card>
      <SectionHeader title={`Assumptions · ${country}`} sub="Side-by-side scenario columns. Switch country in the top bar to see other markets." />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-text-3">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Driver</th>
              <th className="px-3 py-3 text-left font-medium">Unit</th>
              <th className="px-3 py-3 text-right font-medium">Pessimistic</th>
              <th className="bg-brand-soft/60 px-3 py-3 text-right font-semibold text-brand">Base</th>
              <th className="px-3 py-3 text-right font-medium">Optimistic</th>
              <th className="px-5 py-3 text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap(g => [
              <tr key={`g-${g.name}`} className="bg-brand-soft/30">
                <td colSpan={6} className="px-5 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-brand">{g.name}</td>
              </tr>,
              ...g.rows.map(r => {
                const v = r.values[country]
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-surface-2/50">
                    <td className="px-5 py-2.5 font-medium">{r.label}</td>
                    <td className="px-3 py-2.5 text-text-3">{r.unit}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{v.pess}</td>
                    <td className="bg-brand-soft/30 px-3 py-2.5 text-right font-mono font-semibold text-brand">{v.base}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{v.opt}</td>
                    <td className="px-5 py-2.5 text-text-3">{r.source}</td>
                  </tr>
                )
              }),
            ])}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ───────────────────────── Tabs: Market share ───────────────────────── */

function MarketShareTab({ asset, scenario }: { asset: Asset; scenario: ScenarioId }) {
  // Illustrative share curves per scenario.
  const curves: Record<ScenarioId, number[]> = asset.id === 'pcv-peds'
    ? { pess: [78, 78, 79, 80, 80, 80, 80, 80, 80, 80],
        base: [80, 80, 82, 84, 86, 86, 86, 86, 86, 86],
        opt:  [82, 82, 85, 88, 90, 90, 90, 90, 90, 90] }
    : { pess: [4, 10, 15, 16, 16, 16, 16, 16, 16, 16],
        base: [4, 13, 22, 26, 26, 26, 26, 26, 26, 26],
        opt:  [4, 18, 28, 33, 34, 34, 34, 34, 34, 34] }

  const w = 820, h = 320, pad = { l: 40, r: 20, t: 20, b: 30 }
  const yMin = 0, yMax = 100
  const x = (i: number) => pad.l + (i / (YEARS.length - 1)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + ((yMax - v) / (yMax - yMin)) * (h - pad.t - pad.b)
  const line = (vs: number[]) => vs.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')

  return (
    <Card>
      <SectionHeader title={asset.id === 'pcv-peds' ? 'Franchise share of market' : 'mRNA class share × Pfizer share within mRNA'}
        sub="Illustrative. The engine tab shows the exact calculation."
        right={<ScenarioLegend />} />
      <div className="p-5">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Share over time by scenario">
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="#e9eaf0" strokeWidth="1" />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b6e7d">{v}%</text>
            </g>
          ))}
          <path d={line(curves.pess)} fill="none" stroke="#d23b3b" strokeWidth="1.5" strokeDasharray="3 3" opacity={scenario === 'pess' ? 1 : 0.35} />
          <path d={line(curves.base)} fill="none" stroke="#4a52e8" strokeWidth={scenario === 'base' ? 2.5 : 1.5} />
          <path d={line(curves.opt)}  fill="none" stroke="#12804f" strokeWidth="1.5" strokeDasharray="3 3" opacity={scenario === 'opt' ? 1 : 0.35} />
          {YEARS.map((yr, i) => (
            <text key={yr} x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill="#6b6e7d">{yr}</text>
          ))}
        </svg>
      </div>
    </Card>
  )
}

function ScenarioLegend() {
  return (
    <div className="flex items-center gap-4 text-[12px] text-text-2">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-err" />Pess</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-brand" />Base</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-ok" />Opt</span>
    </div>
  )
}

/* ───────────────────────── Tabs: Engine (calculation chain) ───────────────────────── */

function EngineChainTable({ asset }: { asset: Asset }) {
  const sections: { title?: string; rows: ChainStep[] }[] = []
  for (const r of asset.chain) {
    if (r.section) sections.push({ title: r.section, rows: [r] })
    else (sections[sections.length - 1] ?? sections[sections.push({ rows: [] }) - 1]).rows.push(r)
  }
  return (
    <Card>
      <SectionHeader title="Calculation chain"
        sub={asset.summary}
        right={<Pill tone="brand">{asset.chain.filter(r => r.bold).length} totals</Pill>} />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-text-3">
            <tr>
              <th className="w-10 px-3 py-3 text-right font-medium">#</th>
              <th className="px-3 py-3 text-left font-medium">Step</th>
              <th className="px-3 py-3 text-left font-medium">Math</th>
              {YEARS.map(y => <th key={y} className="px-2.5 py-3 text-right font-medium">{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {sections.flatMap(s => [
              s.title && (
                <tr key={`s-${s.title}`} className="bg-brand-soft/30">
                  <td colSpan={YEARS.length + 3} className="px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-brand">{s.title}</td>
                </tr>
              ),
              ...s.rows.map(r => (
                <tr key={r.n} className={cx('border-t border-border hover:bg-surface-2/50', r.bold && 'bg-brand-soft/10')}>
                  <td className="px-3 py-2.5 text-right text-text-3">{r.n}</td>
                  <td className={cx('px-3 py-2.5', r.bold && 'font-semibold text-brand')}>{r.label}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-text-3">{r.math}</td>
                  {YEARS.map(y => (
                    <td key={y} className={cx('px-2.5 py-2.5 text-right font-mono', r.bold ? 'font-semibold text-brand' : 'text-text')}>
                      {r.values[y]}
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-surface-2/50 px-5 py-3 text-[12.5px] text-text-2">
        <Info size={14} className="text-text-3" />
        The engine runs the selected scenario. Click any number for the arithmetic behind it.
      </div>
    </Card>
  )
}

/* ───────────────────────── Tabs: Output ───────────────────────── */

function OutputChart({ asset, scenario }: { asset: Asset; scenario: ScenarioId }) {
  const values = asset.outputByYear[scenario]
  const w = 820, h = 320, pad = { l: 50, r: 20, t: 20, b: 30 }
  const max = Math.max(...Object.values(asset.outputByYear).flat()) * 1.1
  const bw = (w - pad.l - pad.r) / YEARS.length * 0.65
  const x = (i: number) => pad.l + (i / YEARS.length) * (w - pad.l - pad.r) + ((w - pad.l - pad.r) / YEARS.length - bw) / 2
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b)

  // Stacked by product if available (PCV)
  const stack = asset.outputByProduct && scenario in asset.outputByProduct.values ? asset.outputByProduct : null

  return (
    <Card>
      <SectionHeader title="Annual output by year" sub="Pfizer net revenue, illustrative" right={<Pill tone="brand">{SCENARIOS.find(s => s.id === scenario)!.label}</Pill>} />
      <div className="p-5">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Annual output">
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const vv = max * f
            return (
              <g key={f}>
                <line x1={pad.l} x2={w - pad.r} y1={y(vv)} y2={y(vv)} stroke="#e9eaf0" />
                <text x={pad.l - 8} y={y(vv) + 4} textAnchor="end" fontSize="11" fill="#6b6e7d">{fmtMoney(vv)}</text>
              </g>
            )
          })}
          {YEARS.map((yr, i) => {
            if (stack) {
              let acc = 0
              return (
                <g key={yr}>
                  {stack.products.map(p => {
                    const v = stack.values[scenario]?.[p.id]?.[i] ?? 0
                    const yTop = y(acc + v), yBot = y(acc)
                    acc += v
                    return v > 0 ? <rect key={p.id} x={x(i)} y={yTop} width={bw} height={yBot - yTop} fill={p.color} opacity="0.9" /> : null
                  })}
                  <text x={x(i) + bw / 2} y={h - 8} textAnchor="middle" fontSize="11" fill="#6b6e7d">{yr}</text>
                </g>
              )
            }
            const v = values[i]
            return (
              <g key={yr}>
                <rect x={x(i)} y={y(v)} width={bw} height={y(0) - y(v)} fill="var(--color-brand)" opacity="0.88" />
                <text x={x(i) + bw / 2} y={h - 8} textAnchor="middle" fontSize="11" fill="#6b6e7d">{yr}</text>
              </g>
            )
          })}
        </svg>
        {stack && (
          <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-text-2">
            {stack.products.map(p => (
              <span key={p.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
                {p.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border p-5">
        <table className="w-full text-[13px]">
          <thead className="text-text-3">
            <tr>
              <th className="px-2 py-2 text-left font-medium">$M</th>
              {YEARS.map(y => <th key={y} className="px-2 py-2 text-right font-medium">{y}</th>)}
              <th className="px-2 py-2 text-right font-medium">10-yr</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map(s => {
              const vs = asset.outputByYear[s.id]
              const sum = vs.reduce((a, b) => a + b, 0)
              return (
                <tr key={s.id} className={cx('border-t border-border', s.id === scenario && 'bg-brand-soft/20')}>
                  <td className={cx('px-2 py-2 font-semibold', s.id === scenario ? 'text-brand' : 'text-text-2')}>{s.label}</td>
                  {vs.map((v, i) => <td key={i} className="px-2 py-2 text-right font-mono">${v.toLocaleString()}M</td>)}
                  <td className="px-2 py-2 text-right font-mono font-semibold">{fmtMoney(sum)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ───────────────────────── Tabs: Sandbox ───────────────────────── */

function SandboxTab({ asset, scenario }: { asset: Asset; scenario: ScenarioId }) {
  const [tweaks, setTweaks] = useState({
    sharePenalty: 0,
    rateTweak: 0,
    pricePenalty: 0,
    schedule: 'as',
  })

  const base = asset.outputByYear.base
  const factor = (1 + tweaks.rateTweak / 100) * (1 - tweaks.sharePenalty / 100) * (1 - tweaks.pricePenalty / 100)
  const sandbox = base.map(v => v * factor)

  const w = 820, h = 320, pad = { l: 50, r: 20, t: 20, b: 30 }
  const max = Math.max(...base, ...sandbox) * 1.1
  const bw = (w - pad.l - pad.r) / YEARS.length * 0.45
  const xBase = (i: number) => pad.l + (i / YEARS.length) * (w - pad.l - pad.r) + ((w - pad.l - pad.r) / YEARS.length - bw * 2) / 2
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b)

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <SectionHeader title="Sandbox controls" sub="Start from the base case; dial in the shock." />
        <div className="space-y-4 p-5">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Vaccination / uptake rate</p>
            <input type="range" min={-20} max={20} value={tweaks.rateTweak}
              onChange={e => setTweaks(t => ({ ...t, rateTweak: Number(e.target.value) }))}
              className="mt-2 w-full" style={{ accentColor: 'var(--color-brand)' }} />
            <p className="mt-1 text-[12px] text-text-2 font-mono">{tweaks.rateTweak >= 0 ? '+' : ''}{tweaks.rateTweak}%</p>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Franchise share headwind</p>
            <input type="range" min={0} max={30} value={tweaks.sharePenalty}
              onChange={e => setTweaks(t => ({ ...t, sharePenalty: Number(e.target.value) }))}
              className="mt-2 w-full" style={{ accentColor: 'var(--color-brand)' }} />
            <p className="mt-1 text-[12px] text-text-2 font-mono">−{tweaks.sharePenalty}% of base</p>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Net price drop</p>
            <input type="range" min={0} max={30} value={tweaks.pricePenalty}
              onChange={e => setTweaks(t => ({ ...t, pricePenalty: Number(e.target.value) }))}
              className="mt-2 w-full" style={{ accentColor: 'var(--color-brand)' }} />
            <p className="mt-1 text-[12px] text-text-2 font-mono">−{tweaks.pricePenalty}%</p>
          </div>
          <button type="button" onClick={() => setTweaks({ sharePenalty: 0, rateTweak: 0, pricePenalty: 0, schedule: 'as' })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-2 hover:bg-surface-2">
            <RefreshCw size={13} /> Reset sandbox
          </button>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Base vs sandbox"
          sub="Grey = base; purple = sandbox. The delta table below runs the numbers."
          right={<Pill tone="brand">Live</Pill>} />
        <div className="p-5">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Base vs sandbox">
            {[0, 0.25, 0.5, 0.75, 1].map(f => (
              <g key={f}>
                <line x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#e9eaf0" />
                <text x={pad.l - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="#6b6e7d">{fmtMoney(max * f)}</text>
              </g>
            ))}
            {YEARS.map((yr, i) => (
              <g key={yr}>
                <rect x={xBase(i)}      y={y(base[i])}    width={bw} height={y(0) - y(base[i])}    fill="#c7c9d6" />
                <rect x={xBase(i) + bw} y={y(sandbox[i])} width={bw} height={y(0) - y(sandbox[i])} fill="var(--color-brand)" opacity="0.9" />
                <text x={xBase(i) + bw} y={h - 8} textAnchor="middle" fontSize="11" fill="#6b6e7d">{yr}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="border-t border-border p-5">
          <table className="w-full text-[13px]">
            <thead className="text-text-3">
              <tr>
                <th className="px-2 py-2 text-left font-medium">$M</th>
                {YEARS.map(y => <th key={y} className="px-2 py-2 text-right font-medium">{y}</th>)}
                <th className="px-2 py-2 text-right font-medium">10-yr</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-2 py-2 font-semibold text-text-2">Base</td>
                {base.map((v, i) => <td key={i} className="px-2 py-2 text-right font-mono">${Math.round(v).toLocaleString()}</td>)}
                <td className="px-2 py-2 text-right font-mono font-semibold">{fmtMoney(base.reduce((a, b) => a + b, 0))}</td>
              </tr>
              <tr className="border-t border-border bg-brand-soft/20">
                <td className="px-2 py-2 font-semibold text-brand">Sandbox</td>
                {sandbox.map((v, i) => <td key={i} className="px-2 py-2 text-right font-mono font-semibold text-brand">${Math.round(v).toLocaleString()}</td>)}
                <td className="px-2 py-2 text-right font-mono font-semibold text-brand">{fmtMoney(sandbox.reduce((a, b) => a + b, 0))}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-2 py-2 font-semibold text-text-2">Δ</td>
                {sandbox.map((v, i) => {
                  const d = v - base[i]
                  return <td key={i} className={cx('px-2 py-2 text-right font-mono', d < 0 ? 'text-err' : d > 0 ? 'text-ok' : 'text-text-3')}>
                    {d === 0 ? '0' : `${d > 0 ? '+' : ''}${Math.round(d)}`}
                  </td>
                })}
                <td className="px-2 py-2 text-right font-mono font-semibold">
                  {(() => { const d = sandbox.reduce((a, b) => a + b, 0) - base.reduce((a, b) => a + b, 0); return d === 0 ? '0' : `${d > 0 ? '+' : ''}${fmtMoney(d)}` })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────── Workspace shell ───────────────────────── */

function BdWorkspace({ asset, onBack, onHome }: { asset: Asset; onBack: () => void; onHome: () => void }) {
  const [tab, setTab] = useState<TabId>('assumptions')
  const [scenario, setScenario] = useState<ScenarioId>('base')
  const [country, setCountry] = useState<string>(asset.countries[0])
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const setOverride = (id: string, v: number | undefined) =>
    setOverrides(p => {
      const n = { ...p }
      if (v === undefined) delete n[id]
      else n[id] = v
      return n
    })

  const kpis = asset.kpis
  const spark = asset.outputByYear[scenario]

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <button type="button" onClick={onHome} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
          Home
        </button>
        <span className="text-text-3">/</span>
        <button type="button" onClick={onBack} className="rounded-md px-1.5 py-1 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
          BD asset sizing
        </button>
        <span className="text-text-3">/</span>
        <span className="text-[13px] font-semibold text-brand">{asset.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <Pill tone="neutral">Illustrative</Pill>
          <Btn variant="secondary" size="sm" icon={<Download size={14} />}>Export</Btn>
          <Btn variant="primary" size="sm" icon={<ArrowUpRight size={14} />}>Hand off to CoE</Btn>
        </div>
      </header>

      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1680px] items-center gap-6 px-6">
          <div role="tablist" aria-label="Workspace tabs" className="flex min-w-max items-end gap-1">
            {TABS.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-[13.5px] font-semibold transition-colors',
                  tab === t.id ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text',
                )}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 py-2">
            <ScenarioSegment value={scenario} onChange={setScenario} />
            <CountryDropdown options={asset.countries} value={country} onChange={setCountry} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-[280px_minmax(0,1fr)] gap-5 px-6 py-5">
        <aside className="sticky top-5 self-start">
          <Card>
            <div className="px-5 py-4">
              <h3 className="text-[15px] font-semibold tracking-tight">{asset.name}</h3>
              <p className="mt-1 text-[12px] text-text-3">{asset.summary}</p>
            </div>
            <div className="space-y-3 border-t border-border p-4">
              <KpiBlock
                label={`${kpis.peakYear[scenario]} peak net revenue`}
                value={`$${kpis.peakRevenueB[scenario].toFixed(2)}B`}
                sub={`${kpis.cagrPct[scenario].toFixed(1)}% CAGR`}
              />
              <KpiBlock
                label="10-year net revenue"
                value={`$${kpis.tenYearRevenueB[scenario].toFixed(2)}B`}
                sub={SCENARIOS.find(s => s.id === scenario)!.label + ' scenario'}
              />
              <div className="rounded-xl bg-surface-2 px-3.5 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-3">Net revenue by year</p>
                <div className="mt-1.5"><Sparkline values={spark} /></div>
              </div>
              {Object.keys(overrides).length > 0 && (
                <div className="rounded-xl border border-brand/30 bg-brand-soft/40 px-3.5 py-3 text-[12px] text-brand">
                  <p className="font-semibold">{Object.keys(overrides).length} overrides from base</p>
                  <button type="button" onClick={() => setOverrides({})} className="mt-1 inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline">
                    <X size={12} /> Clear overrides
                  </button>
                </div>
              )}
            </div>
          </Card>
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-3">{asset.therapy}</p>
              <h2 className="mt-0.5 text-[22px] font-semibold tracking-tight">
                {TABS.find(t => t.id === tab)!.label}
              </h2>
            </div>
            <Pill tone="brand">
              <Layers size={11} /> {asset.shape === 'sliders' ? 'Console shape' : 'Grid shape'}
            </Pill>
          </div>

          {tab === 'assumptions' && (
            asset.shape === 'sliders'
              ? <AssumptionsSliders asset={asset} scenario={scenario} overrides={overrides} setOverride={setOverride} />
              : <AssumptionsGrid asset={asset} country={country} />
          )}
          {tab === 'share' && <MarketShareTab asset={asset} scenario={scenario} />}
          {tab === 'engine' && <EngineChainTable asset={asset} />}
          {tab === 'output' && <OutputChart asset={asset} scenario={scenario} />}
          {tab === 'sandbox' && <SandboxTab asset={asset} scenario={scenario} />}
        </main>
      </div>
    </div>
  )
}

export default function BdFlow({ onBack }: { onBack: () => void }) {
  const [assetId, setAssetId] = useState<string | null>(null)
  const asset = assetId ? findAsset(assetId) : null

  if (asset) {
    return <BdWorkspace asset={asset} onBack={() => setAssetId(null)} onHome={onBack} />
  }
  return <BdAssetList onOpenAsset={id => setAssetId(id)} onBack={onBack} />
}

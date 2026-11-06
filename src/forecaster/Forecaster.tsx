import { Fragment, useContext, useEffect, useMemo, useState } from 'react'
import { scrollFrameTop } from '../frame'
import type { ComponentType, ReactNode } from 'react'
import type { CopilotProps } from './workspace/agent'
import {
  ArrowDown, Trash2, BookOpen, FolderTree, PanelLeftClose, PanelLeftOpen, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, CalendarClock, Check, ChevronDown, LayoutList, LogOut, Copy, Plus, Search, CheckCircle2, ChevronRight, Database, Download, Info, Lock, RotateCcw, Sparkles, TrendingDown, TrendingUp,
  AlertTriangle, Bot, Gauge, Lightbulb, Pin, Send, ShieldCheck, Target, X, XCircle,
} from 'lucide-react'
import Workbook from './Workbook'
import FunnelFlow from './funnel/FunnelFlow'
import ForecastWorkspace from './workspace/ForecastWorkspace'
import ForecasterHome, { BRANDS } from './workspace/Home'
import ForecasterChat from './ForecasterChat'
import type { Insight as BoardInsight } from './workspace/insights'
import type { BrandRow as HomeBrand } from './workspace/Home'
import { SubmitGateCtx } from './submitGate'
import { CycleSummary, DriverInputs, editorsFor, Kpi, ScenarioWorkspace, Tabs } from './ScenarioWorkspace'
import { assumptionFactor, defaultsOf, fmtAssumption, modelFor } from './models'
import type { AssumptionValues, ModelConfig } from './models'
import type { Overrides, PinFn, Snap, WsTab } from './ScenarioWorkspace'

/*
 * Forecaster flow — a guided, simplified version of the LES Model 2 (v3.12.14) workbook.
 * The workbook's 20+ tabs are folded into five steps a forecaster walks once per cycle.
 * Figures come from the LES Model 2 Nurtec ODT FY2026 view.
 */

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }

/* ───────── Data (from LES Model 2 · Nurtec ODT · FY2026) ───────── */

const PRODUCT = { brand: 'Nurtec ODT', desc: 'Acute + preventive migraine', market: 'Oral CGRP (Migraine)', competitors: 'Ubrelvy · Qulipta', wac: '$105.10 / unit', unitsPerRx: 16, model: 'v3.12.14', cycle: '6+6 LE · FY 2026', actualsThrough: 'Jul' }

const SUBMISSIONS = [
  { id: 'LE1', due: 'Closed', split: '0+12', done: true },
  { id: 'LE2', due: 'Closed', split: '3+9', done: true },
  { id: 'LE3', due: 'Closed', split: '5+7', done: true },
  { id: 'LE4', due: 'due 11/3', split: '6+6', done: false },
  { id: 'Op Plan', due: 'due 11/3', split: '~8+4', done: false },
]

type ScenarioId = string
const BASE_SCN = 'Scenario 1'
const ANCHOR = 'Trended Statistical'

/* Published model the forecaster receives from the CoE. Structure is sealed; only open slots are editable. */
const MODEL = { version: 'v1.0', engine: 'Trend + events', publishedBy: 'CoE · A. Configurator', published: 'Sep 30, 2026' }

type SlotKind = 'open' | 'locked' | 'derived'
const SLOTS: { name: string; kind: SlotKind; value: string; band?: string; source: string; owner: string; conf: 'High' | 'Medium' | 'Low'; where?: string }[] = [
  { name: 'Historical TRx / NBRx (Jan–Jul)', kind: 'locked', value: 'Actuals', source: 'Blaze extract', owner: 'Commercial data', conf: 'High' },
  { name: 'Statistical trend method', kind: 'locked', value: 'Seasonal trend', source: 'CoE model config', owner: 'CoE', conf: 'High' },
  { name: 'Market events', kind: 'open', value: 'Date · impact · probability', band: 'Probability 0–100%', source: 'CI calendar + judgment', owner: 'You', conf: 'Medium', where: 'Inputs' },
  { name: 'AlphaSense proposals', kind: 'open', value: 'Accept or reject', source: 'AlphaSense', owner: 'You', conf: 'Medium', where: 'Inputs' },
  { name: 'Gross-to-net allowance rates', kind: 'open', value: '78.40% total', band: '±5 pt per line', source: 'Finance accruals', owner: 'You', conf: 'High', where: 'Inputs' },
  { name: 'Monthly overrides (forecast months)', kind: 'open', value: 'Aug–Dec', band: '±25% vs baseline', source: 'Your judgment', owner: 'You', conf: 'Medium', where: 'Scenario' },
  { name: 'Gross-to-net waterfall structure', kind: 'locked', value: 'One GTN truth', source: 'Finance-approved', owner: 'Finance / CoE', conf: 'High' },
  { name: 'Gross sales', kind: 'derived', value: 'TRx × units × WAC', source: 'Engine', owner: 'Engine', conf: 'High' },
  { name: 'Net sales', kind: 'derived', value: 'Gross × (1 − GTN) + events', source: 'Engine', owner: 'Engine', conf: 'High' },
]
const KIND_LABEL: Record<SlotKind, string> = { open: 'Your input', locked: 'CoE-locked', derived: 'Derived' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ACT_MONTHS = 7
const MKT_TRX = [692, 659, 743, 730, 745, 759, 766, 787, 771, 805, 782, 828]
const NUR_TRX = [300, 287, 326, 322, 331, 328, 332, 342, 334, 353, 344, 369]
const NUR_NBRX = [39, 41, 45, 45, 43, 43, 43, 43, 43, 43, 44, 44]
const GROSS_FY = 7092.1
const BASE_GTN = 78.4
const NET_FY = 1635.5
const BUDGET_NET = 1507.4 // Net FY runs +8.5% vs budget on the trend
const PLAN_TRX = 4230
const LY_TRX = 3483

type Cat = 'Market' | 'Product' | 'Pricing'
type Ev = { id: string; name: string; cat: Cat; type: string; date: string; mkt: number; share: number; price: number; phase: number; prob: number; conf: string; source: string; proposed?: boolean }

// Register — standardized taxonomy (impacts are Market % / Share pt / Price %).
const EVENTS: Ev[] = [
  { id: 'e1', name: 'Share trend-break achieved (new-data POA)', cat: 'Market', type: 'Competitive Entrant', date: '2026-01', mkt: 0, share: 4.1, price: 0, phase: 6, prob: 30, conf: 'Medium', source: 'US Migraine OP26 R&O — upside option' },
  { id: 'e2', name: 'Qulipta H2H incremental erosion', cat: 'Market', type: 'Competitive Entrant', date: '2026-01', mkt: 0, share: -1.5, price: 0, phase: 6, prob: 50, conf: 'Medium', source: 'US Migraine OP26 funnel commentary' },
  { id: 'e3', name: 'oCGRP class acceleration (PCP barriers)', cat: 'Market', type: 'Other Market Event', date: '2026-01', mkt: 5.1, share: 0, price: 0, phase: 9, prob: 30, conf: 'Medium', source: 'US Migraine OP26 R&O' },
  { id: 'e4', name: 'Class growth decelerates below trend', cat: 'Market', type: 'Epidemiology Shift', date: '2026-01', mkt: -2, share: 0, price: 0, phase: 9, prob: 30, conf: 'Medium', source: 'US Migraine OP26 R&O' },
  { id: 'e5', name: 'Symbravo incremental acute competition', cat: 'Market', type: 'Competitive Entrant', date: '2026-07', mkt: 0, share: -0.5, price: 0, phase: 6, prob: 50, conf: 'Low', source: 'Competitive intelligence' },
  { id: 'e6', name: 'Telehealth channel partnership', cat: 'Market', type: 'Access/HTA Decision', date: '2026-11', mkt: 2.5, share: 0, price: 0, phase: 6, prob: 40, conf: 'Unsourced', source: 'Unsourced — add a source before lock' },
  { id: 'e7', name: 'PBM net-price OOP — adherence upside', cat: 'Market', type: 'Access/HTA Decision', date: '2027-01', mkt: 0, share: 1, price: 0, phase: 9, prob: 40, conf: 'Low', source: 'PBM Reforms LT' },
  { id: 'e8', name: 'Pediatric prevention approval', cat: 'Market', type: 'New Indication Approval', date: '2027-05', mkt: 3, share: 0, price: 0, phase: 9, prob: 50, conf: 'Medium', source: 'Regulatory calendar' },
  { id: 'e9', name: 'PACAP-class readouts → novel-mechanism entry', cat: 'Market', type: 'Competitive Entrant', date: '2028-03', mkt: -2, share: 0, price: 0, phase: 12, prob: 40, conf: 'Medium', source: 'Pipeline tracker' },
  { id: 'e10', name: 'Generic CGRP mAb entry (biosimilar step-through)', cat: 'Market', type: 'Competitive Entrant', date: '2029-08', mkt: 0, share: -2, price: 0, phase: 9, prob: 50, conf: 'Medium', source: 'Pipeline tracker' },
  { id: 'e11', name: 'Nurtec LOE — patent expiry (placeholder)', cat: 'Market', type: 'Competitive Entrant', date: '2030-10', mkt: 0, share: -80, price: 0, phase: 12, prob: 90, conf: 'Low', source: 'IP placeholder' },
  { id: 'e12', name: 'Supply constraint — ODT line', cat: 'Product', type: 'Supply Disruption', date: '2026-09', mkt: 0, share: -1.8, price: 0, phase: 2, prob: 25, conf: 'Unsourced', source: 'Unsourced — add a source before lock' },
  { id: 'e13', name: 'Menstrual-migraine indication', cat: 'Product', type: 'New Indication Approval', date: '2028-03', mkt: 1.3, share: 0, price: 0, phase: 9, prob: 50, conf: 'Medium', source: 'Clinical development plan' },
  { id: 'e14', name: '340B/PHS growth continues at trend', cat: 'Pricing', type: 'Price Change', date: '2026-01', mkt: 0, share: 0, price: -4, phase: 9, prob: 30, conf: 'High', source: 'US Migraine OP26 R&O' },
  { id: 'e15', name: 'Ascent renegotiation fails', cat: 'Pricing', type: 'Price Change', date: '2026-07', mkt: 0, share: 0, price: -2.8, phase: 2, prob: 30, conf: 'High', source: 'US Migraine OP26 R&O' },
  { id: 'e16', name: 'Ascent upside capture (excluded value)', cat: 'Pricing', type: 'Price Change', date: '2026-07', mkt: 0, share: 0, price: 2.8, phase: 2, prob: 25, conf: 'Medium', source: 'US Migraine OP26 R&O opportunity' },
  { id: 'e17', name: 'ODT 1x8 — October WAC action', cat: 'Pricing', type: 'Price Change', date: '2026-10', mkt: 0, share: 0, price: 2, phase: 1, prob: 20, conf: 'Unsourced', source: 'Pricing committee — option under review' },
  { id: 'e18', name: 'Part D delinking — rebate-position risk', cat: 'Pricing', type: 'MFN Policy Implementation', date: '2028-01', mkt: 0, share: 0, price: -1.5, phase: 12, prob: 30, conf: 'Low', source: 'PBM Reforms LT' },
  { id: 'e19', name: 'IRA Cycle 3 MFP — Nurtec selection', cat: 'Pricing', type: 'MFN Policy Implementation', date: '2028-02', mkt: 0, share: 0, price: -2.5, phase: 3, prob: 60, conf: 'Medium', source: 'AlphaSense repo F-2028-001 · Broker Research' },
]

// AlphaSense proposals. They stay out of the forecast until a person accepts them in Inputs.
const PROPOSED: Ev[] = [
  { id: 'p1', name: 'Ubrelvy ED-setting label expansion', cat: 'Market', type: 'Competitive Entrant', date: '2026-09', mkt: 0, share: -0.8, price: 0, phase: 3, prob: 40, conf: 'Medium', source: 'AlphaSense · expert call transcript, Sep 2026', proposed: true },
  { id: 'p2', name: 'Regional plan formulary win (preferred tier)', cat: 'Market', type: 'Access/HTA Decision', date: '2026-10', mkt: 0, share: 0.6, price: 0, phase: 2, prob: 55, conf: 'Medium', source: 'AlphaSense · broker research note', proposed: true },
  { id: 'p3', name: 'Part D redesign — OOP cap pulls through demand', cat: 'Pricing', type: 'MFN Policy Implementation', date: '2026-08', mkt: 0, share: 0, price: -0.6, phase: 4, prob: 50, conf: 'Low', source: 'AlphaSense · policy tracker', proposed: true },
]
const ALL_EVENTS = [...EVENTS, ...PROPOSED]
type Review = Record<string, 'pending' | 'accepted' | 'rejected'>
type EvState = Record<string, { on: boolean; prob: number }>

const GTN_LINES = [
  { id: 'Returns', v: 0.95 }, { id: 'Cash Discounts', v: 1.69 }, { id: 'Medicaid Rebates', v: 9.72 }, { id: 'Medicare Part D', v: 14.16 },
  { id: 'Commercial Rebates', v: 25.47 }, { id: 'Copay Assistance', v: 19.98 }, { id: 'Distribution Fees', v: 3.28 }, { id: 'All Other', v: 3.15 },
]

/* ───────── Math ───────── */

const favorable = (e: Ev) => e.mkt + e.share + e.price > 0
/** FY2026 net contribution if the event lands with certainty. Events dated beyond the model year flow to the LRP. */
function fyImpact(e: Ev) {
  const [y = 0, m = 1] = e.date.split('-').map(Number)
  if (y !== 2026) return 0
  const start = Math.max(m, ACT_MONTHS + 1) // actuals are locked
  let months = 0
  for (let k = start; k <= 12; k++) months += Math.min(1, (k - m + 1) / e.phase)
  const pct = e.mkt / 100 + e.share / 44.5 + e.price / 100
  return NET_FY * pct * (months / 12)
}
function scenarioState(s: ScenarioId): Record<string, { on: boolean; prob: number }> {
  return Object.fromEntries(ALL_EVENTS.map(e => {
    if (s === ANCHOR) return [e.id, { on: false, prob: e.prob }]
    const shift = s === 'Scenario 2' ? (favorable(e) ? 30 : -30) : s === 'Scenario 3' ? (favorable(e) ? -30 : 30) : 0
    return [e.id, { on: true, prob: Math.max(0, Math.min(100, e.prob + shift)) }]
  }))
}
const fmtM = (v: number, sign = false) => `${sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`

/** Deterministic Monte Carlo: each included event lands or not at its probability, plus trend noise on forecast months. */
function simulate(events: Ev[], ev: EvState, base: number, runs = 2000) {
  let seed = 7
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const sigma = NET_FY * ((12 - ACT_MONTHS) / 12) * 0.025
  const on = events.filter(e => ev[e.id]?.on && fyImpact(e) !== 0)
  const out: number[] = []
  for (let r = 0; r < runs; r++) {
    let v = base
    for (const e of on) if (rnd() < ev[e.id]!.prob / 100) v += fyImpact(e)
    v += sigma * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())
    out.push(v)
  }
  return out.sort((a, b) => a - b)
}
const pctAbove = (sims: number[], x: number) => sims.filter(v => v >= x).length / sims.length * 100
const quantile = (sims: number[], q: number) => sims[Math.min(sims.length - 1, Math.floor(q * sims.length))]!

type GateTone = 'ok' | 'warn' | 'block'
type GateCheck = { id: string; label: string; detail: string; tone: GateTone; fix?: { label: string; run: () => void } }
const ROLES = [
  { id: 'submitter', label: 'Brand forecaster · submitter', can: true },
  { id: 'contributor', label: 'Brand analyst · contributor', can: false },
] as const
type RoleId = typeof ROLES[number]['id']
type Comment = { id: string; author: string; text: string; at: string }
type Insight = { id: string; title: string; body: string; at: string; updated?: string; author?: string; brand?: string; cycle?: string; scenario?: string; where?: string; chart?: Snap; comments?: Comment[] }
const ME_NAME = 'Michelle Ortiz'
const stamp = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
type SetKb = (f: (x: Insight[]) => Insight[]) => void

/* ───────── Primitives (match the configurator) ───────── */

function Btn({ children, variant = 'primary', onClick, icon, disabled }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; onClick?: () => void; icon?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cx('inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark', variant === 'secondary' && 'border border-border-strong bg-surface hover:border-text', variant === 'ghost' && 'text-text-2 hover:bg-surface-2')}>
      {icon}{children}
    </button>
  )
}
function Card({ title, sub, right, children, className }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-border bg-surface', className)}>
      {title && <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4"><div><h3 className="text-[15px] font-semibold">{title}</h3>{sub && <p className="mt-0.5 text-[13px] text-text-2">{sub}</p>}</div>{right}</header>}
      <div className="p-5">{children}</div>
    </section>
  )
}
function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'err'; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tone === 'neutral' && 'bg-surface-2 text-text-2', tone === 'brand' && 'bg-brand-soft text-brand', tone === 'ok' && 'bg-ok-soft text-ok', tone === 'warn' && 'bg-warn-soft text-warn', tone === 'err' && 'bg-err-soft text-err')}>{children}</span>
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-border-strong')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}
function Chips<T extends string>({ value, options, onChange, render }: { value: T; options: readonly T[]; onChange: (v: T) => void; render?: (o: T) => ReactNode }) {
  return (
    <div className="inline-flex flex-wrap items-center justify-end rounded-md border border-border-strong bg-surface p-0.5" role="radiogroup">
      {options.map(o => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cx('rounded px-3 py-1.5 text-[13px] font-medium transition-colors', value === o ? 'bg-brand-soft text-brand' : 'text-text-2 hover:text-text')}>{render ? render(o) : o}</button>)}
    </div>
  )
}

/* ───────── Flow ───────── */

type StepId = 'setup' | 'assumptions' | 'inputs' | 'generate'
/** 'initial' = first forecast in a cycle, 'new' = new scenario, 'cycle' = edit cycle context only */
type BuildMode = 'initial' | 'new' | 'cycle'
const STEPS_FOR: Record<BuildMode, StepId[]> = { initial: ['setup', 'assumptions', 'inputs', 'generate'], new: ['assumptions', 'inputs', 'generate'], cycle: ['setup'] }
const DRAFT = '__draft'
type View = 'config' | 'cycle' | 'scenario'
type CycleTab = 'Cycle Summary' | 'Scenarios'
type SavedRow = { base: string; net: number; vsBudget: number; submitted?: boolean }
type Notify = (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void

function ForecastFlow({ onHome, notify, brand, model, cycle, cycleName, cycleRows, initSub, view0, scn0, newFrom, onNewScenario, onSaved, kb, setKb }: {
  onHome: (focusBrand?: boolean) => void; notify: Notify; brand: string; model: string; cycle: CycleRow; cycleName: string; cycleRows: ScenarioRow[]; initSub: string; view0: View; scn0?: string
  /** set when the flow opens straight into the new-scenario builder: '' = from the generated forecast, otherwise the scenario to copy */
  newFrom?: string
  onNewScenario: (from?: string) => string; onSaved: (r: SavedRow[]) => void; kb: Insight[]; setKb: SetKb
}) {
  const cfg: ModelConfig = modelFor(model)
  const [view, setView] = useState<View>(view0)
  const [step, setStep] = useState(1)
  const [generated, setGenerated] = useState(cycleRows.some(r => r.base !== ANCHOR))
  const [mode, setMode] = useState<BuildMode>(newFrom !== undefined ? 'new' : 'initial')
  const [buildFrom, setBuildFrom] = useState<string | undefined>(newFrom || undefined)
  const stepIds = STEPS_FOR[mode], N = stepIds.length, curStep = stepIds[step - 1] ?? stepIds[0]!
  const STEP_META: Record<StepId, { title: string; sub: string }> = {
    setup: { title: 'Forecast setup', sub: 'Cycle context' },
    assumptions: { title: 'Assumptions', sub: `${cfg.archetype} model` },
    inputs: { title: 'Inputs', sub: 'From the configured modules' },
    generate: { title: 'Generate forecast', sub: mode === 'new' ? 'Create the scenario' : 'Create Scenario 1' },
  }
  // Assumption values per scenario, generated from the assigned model. Seeded scenarios differ a little so comparisons are meaningful.
  const [assum, setAssum] = useState<Record<string, AssumptionValues>>(() => {
    const d = defaultsOf(cfg), first = cfg.assumptions.find(a => a.kind === 'number')
    const tweak = (k: number): AssumptionValues => first ? { ...d, [first.id]: +(Number(first.value) * k).toFixed(1) } : d
    const init: Record<string, AssumptionValues> = { [DRAFT]: newFrom ? { ...d } : d }
    for (const r of cycleRows) init[r.base] = r.base === 'Scenario 2' ? tweak(1.1) : r.base === 'Scenario 3' ? tweak(0.92) : { ...d }
    if (newFrom && init[newFrom]) init[DRAFT] = { ...init[newFrom]! }
    return init
  })
  const [scn, setScn] = useState<string>(scn0 ?? (cycleRows.find(r => r.base !== ANCHOR) ?? cycleRows[0])?.base ?? BASE_SCN)
  const [cTab, setCTab] = useState<CycleTab>(view0 === 'cycle' ? 'Cycle Summary' : 'Scenarios')
  const [wsTab, setWsTab] = useState<WsTab>('Result')
  const [sub, setSub] = useState(initSub)
  const [ev, setEv] = useState(() => scenarioState(BASE_SCN))
  const [review, setReview] = useState<Review>(() => Object.fromEntries(PROPOSED.map(e => [e.id, 'pending'])))
  const [gtn, setGtn] = useState<Record<string, number>>(Object.fromEntries(GTN_LINES.map(l => [l.id, l.v])))
  const [subAt, setSubAt] = useState<Record<string, string>>(() => Object.fromEntries(cycleRows.filter(r => r.status === 'Submitted').map(r => [r.base, r.updated])))
  const [pressureSeen, setPressureSeen] = useState(false)
  const [ov, setOv] = useState<Overrides>({})
  const [confirm, setConfirm] = useState<{ after?: () => void } | null>(null)
  const [role, setRole] = useState<RoleId>('submitter')
  const [dock, setDock] = useState(false)
  // Pins land in the shared knowledge bank; this cycle only sees its own entries.
  const insights = kb.filter(i => i.brand === brand && i.cycle === cycleName)
  const setInsights = setKb
  const [parent, setParent] = useState<Record<string, string>>({})
  const [cr, setCr] = useState<string | null>(null)
  const [actuals, setActuals] = useState({ through: 'Jul 2026', at: '2026-08-06', how: 'Snowflake · auto' })

  const top = () => scrollFrameTop()
  const openConfig = (n: number) => { setView('config'); setStep(Math.max(1, Math.min(n, N))); top() }
  const openCycleSetup = () => { setMode('cycle'); setView('config'); setStep(1); top() }
  const openCycle = (t?: CycleTab) => { if (t) setCTab(t); setView('cycle'); top() }
  const openScenario = (id: string, tab: WsTab = 'Result') => { setScn(id); setWsTab(tab); setView('scenario'); top() }
  const openEvents = () => view === 'scenario' ? setWsTab('Inputs') : openConfig(stepIds.indexOf('inputs') + 1)
  const submitted = subAt[scn] ?? null

  const live = useMemo(() => ALL_EVENTS.filter(e => !e.proposed || review[e.id] === 'accepted'), [review])
  const pending = PROPOSED.filter(e => review[e.id] === 'pending')
  const stateNet = (id: string) => live.reduce((a, e) => { const st = scenarioState(id)[e.id]!; return a + (st.on ? fyImpact(e) * st.prob / 100 : 0) }, 0)
  const eventsNet = useMemo(() => live.reduce((a, e) => a + (ev[e.id]!.on ? fyImpact(e) * ev[e.id]!.prob / 100 : 0), 0), [ev, live])
  const gtnTotal = Object.values(gtn).reduce((a, b) => a + b, 0)
  const forecastShare = (12 - ACT_MONTHS) / 12
  const gtnNet = -GROSS_FY * forecastShare * (gtnTotal - BASE_GTN) / 100
  const net = NET_FY + eventsNet + gtnNet
  const vsBudget = (net / BUDGET_NET - 1) * 100
  const unsourced = live.filter(e => ev[e.id]!.on && e.conf === 'Unsourced' && fyImpact(e) !== 0)
  const sims = useMemo(() => simulate(live, ev, NET_FY + gtnNet), [live, ev, gtnNet])
  const pHit = pctAbove(sims, net), pBudget = pctAbove(sims, BUDGET_NET)
  const ranked = live.filter(e => ev[e.id]!.on && fyImpact(e) !== 0).map(e => ({ e, adj: fyImpact(e) * ev[e.id]!.prob / 100, full: fyImpact(e) })).sort((a, b) => Math.abs(b.full) - Math.abs(a.full))
  const canSubmit = ROLES.find(r => r.id === role)!.can
  const base0 = stateNet(BASE_SCN)
  const aF = (id: string) => assumptionFactor(cfg, assum[id])
  const scnNet = (id: string) => id === ANCHOR ? NET_FY : (net + stateNet(id) - base0) * aF(id)
  const editKey = view === 'config' ? DRAFT : scn
  const draftNet = net * aF(DRAFT), draftVs = (draftNet / BUDGET_NET - 1) * 100
  const rowsNow = cycleRows.filter(r => r.base !== ANCHOR).map(r => ({ r, net: scnNet(r.base), vs: (scnNet(r.base) / BUDGET_NET - 1) * 100 }))
  const sNet = scnNet(scn), sVs = (sNet / BUDGET_NET - 1) * 100
  const ctx = useMemo(() => ({ trend: NET_FY, scns: [{ id: ANCHOR, net: NET_FY }, ...cycleRows.filter(r => r.base !== ANCHOR).map(r => ({ id: r.base, net: scnNet(r.base) })), ...(view === 'config' ? [{ id: DRAFT, net: draftNet }] : [])], ov }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycleRows, ov, net, live, assum, view]) // scnNet derives from net/live/assumptions

  const checks: GateCheck[] = [
    { id: 'pressure', label: pressureSeen ? 'Probability & risk reviewed' : 'Probability & risk not reviewed', detail: 'Probability, sensitivity and Needs-to-Meet must be looked at before an official submission.', tone: pressureSeen ? 'ok' : 'block', fix: pressureSeen ? undefined : { label: 'Open analysis', run: () => { setConfirm(null); setPressureSeen(true); openScenario(scn, 'Analysis') } } },
    { id: 'prob', label: `${pHit.toFixed(0)}% chance of hitting ${fmtM(net)}`, detail: `${pBudget.toFixed(0)}% chance of beating budget · P10–P90 ${fmtM(quantile(sims, 0.1))}–${fmtM(quantile(sims, 0.9))}`, tone: pHit < 35 ? 'warn' : 'ok' },
    { id: 'review', label: pending.length ? `${pending.length} AlphaSense event${pending.length > 1 ? 's' : ''} not reviewed` : 'All proposed events reviewed', detail: pending.length ? 'Unreviewed proposals are excluded from this forecast.' : 'Accepted proposals are in the register; rejected ones are logged.', tone: pending.length ? 'warn' : 'ok', fix: pending.length ? { label: 'Review events', run: () => { setConfirm(null); openEvents() } } : undefined },
    { id: 'source', label: unsourced.length ? `${unsourced.length} included event${unsourced.length > 1 ? 's have' : ' has'} no source` : 'Every included event has a source', detail: unsourced.length ? unsourced.map(e => e.name).join(' · ') : 'Sources are written to the audit record.', tone: unsourced.length ? 'warn' : 'ok', fix: unsourced.length ? { label: 'Review events', run: () => { setConfirm(null); openEvents() } } : undefined },
    { id: 'recon', label: 'Reconciliation within tolerance', detail: 'Unexplained −$6.8M · −0.1% of gross · trigger at ±5%', tone: 'ok' },
    { id: 'role', label: canSubmit ? 'You have submit permission' : 'Your role can’t submit', detail: canSubmit ? `${ROLES.find(r => r.id === role)!.label} · ${PRODUCT.brand}` : 'Contributors can prepare a forecast; a brand forecaster with submit rights files it.', tone: canSubmit ? 'ok' : 'block' },
  ]

  const doSubmit = (after?: () => void) => {
    after?.()
    onSaved([{ base: scn, net: sNet, vsBudget: sVs, submitted: true }])
    setSubAt(m => ({ ...m, [scn]: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }))
    setConfirm(null)
    notify({ tone: 'ok', text: `${scn} submitted to ${sub}. Version ${MODEL.version} locked and filed under the cycle.` })
  }
  const gate = { request: (after?: () => void) => setConfirm({ after }), submitted, sub }
  const addInsight: PinFn = (title, body, chart) => { const now = stamp(); setKb(xs => [{ id: `i${Date.now()}`, title, body, chart, comments: [], author: ME_NAME, at: now, updated: now, brand, cycle: cycleName, scenario: view === 'scenario' ? scn : undefined, where: view === 'scenario' ? 'Scenario workspace' : view === 'cycle' ? `Cycle · ${cTab}` : 'Forecast setup' }, ...xs]); notify({ tone: 'ok', text: 'Added to the knowledge bank.' }) }
  const leave = (focusBrand?: boolean) => { onSaved(rowsNow.map(x => ({ base: x.r.base, net: x.net, vsBudget: x.vs }))); onHome(focusBrand) }
  const newScenario = (from?: string) => {
    // Every new scenario gets its own Assumptions → Inputs → Generate pass before it exists.
    setBuildFrom(from)
    setAssum(a => ({ ...a, [DRAFT]: { ...(from && a[from] ? a[from]! : defaultsOf(cfg)) } }))
    setOv(o => ({ ...o, [DRAFT]: from && o[from] ? structuredClone(o[from]!) : {} }))
    setMode('new'); setView('config'); setStep(1); top()
  }
  const commitDraft = (id: string) => {
    setAssum(a => ({ ...a, [id]: { ...a[DRAFT]! } }))
    setOv(o => ({ ...o, [id]: structuredClone(o[DRAFT] ?? {}) }))
  }
  const generate = () => {
    if (mode === 'new') {
      const id = onNewScenario(buildFrom); commitDraft(id)
      if (buildFrom) setParent(p => ({ ...p, [id]: buildFrom }))
      notify({ tone: 'ok', text: `${id} created from its assumptions and inputs.` })
      setMode('initial'); openScenario(id, 'Result'); return
    }
    const id = onNewScenario(); commitDraft(id); setGenerated(true)
    notify({ tone: 'ok', text: `Forecast generated. ${id} created.` })
    setMode('initial'); openScenario(id, 'Result')
  }
  const diff = (a: string, b: string) => cfg.assumptions.filter(x => (assum[a]?.[x.id] ?? x.value) !== (assum[b]?.[x.id] ?? x.value)).map(x => ({ label: x.label, a: fmtAssumption(x, assum[a]?.[x.id] ?? x.value), b: fmtAssumption(x, assum[b]?.[x.id] ?? x.value) }))
  const showValues = view !== 'config' || curStep === 'inputs' || curStep === 'generate'
  const moduleInputs = (k: string) => <>
    {cfg.inputModules.includes('events') && <section><h2 className="text-lg font-semibold">Market events <span className="text-sm font-normal text-text-3">· event layer module</span></h2>
      <StepEvents ev={ev} setEv={setEv} scenario={k} onReset={() => setEv(scenarioState(BASE_SCN))} eventsNet={eventsNet} live={live} review={review}
        onReview={(id, r) => { setReview(x => ({ ...x, [id]: r })); notify({ tone: r === 'accepted' ? 'ok' : 'info', text: r === 'accepted' ? 'Event accepted into the register. It now affects the forecast.' : 'Proposal rejected and logged.' }) }} /></section>}
    {cfg.inputModules.includes('gtn') && <section className="mt-10"><h2 className="text-lg font-semibold">Gross-to-net <span className="text-sm font-normal text-text-3">· gross-to-net module</span></h2>
      <StepGtn gtn={gtn} setGtn={setGtn} total={gtnTotal} gtnNet={gtnNet} /></section>}
  </>
  const assumptionsFor = (k: string, readOnly = false) => <AssumptionsEditor cfg={cfg} values={assum[k] ?? defaultsOf(cfg)} readOnly={readOnly}
    onChange={(id, v) => setAssum(a => ({ ...a, [k]: { ...(a[k] ?? defaultsOf(cfg)), [id]: v } }))} onReset={() => setAssum(a => ({ ...a, [k]: defaultsOf(cfg) }))} />

  const crumb = (label: string, on?: () => void) => on ? <button type="button" onClick={on} className="rounded text-text-2 underline-offset-2 hover:text-brand hover:underline">{label}</button> : <strong aria-current="page" className="truncate font-semibold">{label}</strong>
  const Sep = () => <ChevronRight size={13} className="text-text-3" />
  const shownNet = view === 'scenario' ? sNet : view === 'config' ? draftNet : net, shownVs = view === 'scenario' ? sVs : view === 'config' ? draftVs : vsBudget

  return (
    <SubmitGateCtx.Provider value={gate}>
    <div className="flex min-h-full flex-col bg-background pb-[76px]">
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
          {crumb('My forecasts', () => leave())}<Sep />
          {crumb(brand, () => leave(true))}<Sep />
          {view === 'cycle' ? crumb(cycleName) : crumb(cycleName, generated ? () => openCycle('Cycle Summary') : undefined)}
          {view === 'config' && <><Sep />{crumb(mode === 'new' ? 'New scenario' : mode === 'cycle' ? 'Forecast setup' : 'New forecast')}</>}
          {view === 'scenario' && <><Sep />{crumb('Scenarios', () => openCycle('Scenarios'))}<Sep />{crumb(scn)}</>}
        </nav>
        {view === 'config' && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">Forecast setup · step {step} of {N}</span>}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {showValues && <><span className="hidden text-text-3 md:inline">{view === 'scenario' ? `${scn} · Net FY` : 'Net FY'}</span>
          <strong className="font-mono">{fmtM(shownNet)}</strong>
          <Tag tone={shownVs >= 0 ? 'ok' : 'err'}>{shownVs >= 0 ? '▲' : '▼'} {Math.abs(shownVs).toFixed(1)}% vs budget</Tag></>}
          <button type="button" onClick={() => setDock(d => !d)} aria-expanded={dock}
            className={cx('inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors', dock ? 'border-brand bg-brand text-white' : 'border-border-strong bg-surface text-text hover:border-brand hover:text-brand')}>
            <Bot size={14} />Ask Agent{insights.length > 0 && <span className={cx('rounded-full px-1.5 font-mono text-[10px]', dock ? 'bg-white/20' : 'bg-brand-soft text-brand')}>{insights.length}</span>}
          </button>
        </div>
      </div>

      <ModelBanner actualsThrough={actuals.through} scenario={view === 'scenario' ? scn : undefined} onRequest={() => setCr('')} />

      {view === 'cycle' && <CycleWorkspace brand={brand} cycleName={cycleName} sub={sub} tab={cTab} setTab={setCTab} ctx={ctx} selected={scn} rows={rowsNow} net={net} eventsNet={eventsNet} gtnNet={gtnNet} vsBudget={vsBudget} pHit={pHit} pBudget={pBudget} ranked={ranked}
        subAt={subAt} parent={parent} onOpen={openScenario} onNew={newScenario} onSetup={openCycleSetup} onBack={() => leave()} pin={addInsight} cycle={cycle} cfg={cfg} actualsThrough={actuals.through} />}

      {view === 'scenario' && <div className="flex-1">
        <ScenarioWorkspace key={scn} ctx={ctx} scenarioId={scn} brand={brand} seasonal={NUR_TRX} eventsOn={live.length} submitted={!!submitted} setOv={setOv} version={MODEL.version}
          cycleName={cycleName} onBack={() => openCycle('Scenarios')} tab={wsTab} onTab={t => { setWsTab(t); top() }} onSwitch={id => openScenario(id, wsTab)} onNew={from => newScenario(from === ANCHOR ? undefined : from)}
          onEvents={openEvents} onSetup={openCycleSetup} pin={addInsight} notify={notify}
          groups={cfg.driverGroups} moduleInputs="" inputsExtra={moduleInputs(scn)} assumptionsNode={assumptionsFor(scn, scn === ANCHOR || !!submitted)} diff={diff}
          extra={{ label: 'Probability & risk', onOpen: () => setPressureSeen(true), node: <StepPressure net={net} eventsNet={eventsNet} gtnNet={gtnNet} gtn={gtn} setGtn={setGtn} sims={sims} pHit={pHit} pBudget={pBudget} ranked={ranked} pending={pending} live={live} ev={ev} onReviewEvents={openEvents} addInsight={addInsight} /> }}
          reviewExtra={<StepReview sub={sub} scenario={scn} eventsNet={eventsNet} gtnNet={gtnNet} net={sNet} vsBudget={sVs} checks={checks} insights={insights} submitted={submitted} onSubmit={() => submitted ? doSubmit() : gate.request()} />} />
      </div>}

      {view === 'config' && (
      <div className={cx('grid flex-1 lg:grid-cols-[232px_minmax(0,1fr)]', showValues && 'wide:grid-cols-[232px_minmax(0,1fr)_300px]')}>
        <aside className="bg-brand-dark text-white lg:sticky lg:top-[57px] lg:h-[calc(100dvh-129px)] lg:overflow-y-auto">
          <div className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/50">{mode === 'new' ? `New scenario · ${buildFrom ? `copy of ${buildFrom}` : 'from the generated forecast'}` : mode === 'cycle' ? `Cycle context · ${cycleName}` : `New forecast · ${cycleName}`}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${((generated ? N : step - 1) / N) * 100}%` }} /></div>
          </div>
          <ol className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col">
            {stepIds.map(sid => STEP_META[sid]).map((s, i) => {
              const id = i + 1, done = (id < step) || generated
              return (
                <li key={s.title} className="shrink-0">
                  <button type="button" onClick={() => { setStep(id); top() }} aria-current={id === step ? 'step' : undefined}
                    className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors', id === step ? 'bg-white text-brand-dark' : 'hover:bg-white/10')}>
                    <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold', id === step ? 'bg-brand text-white' : done ? 'bg-[#34d399] text-brand-dark' : 'border border-white/40 text-white/80')}>{done && id !== step ? <Check size={13} strokeWidth={3} /> : id}</span>
                    <span><span className="block whitespace-nowrap text-[13px] font-semibold">{s.title}</span><span className={cx('block whitespace-nowrap text-[11px]', id === step ? 'text-text-2' : 'text-white/55')}>{s.sub}</span></span>
                    {stepIds[i] === 'inputs' && pending.length > 0 && id !== step && <span className="ml-auto rounded-full bg-warn px-1.5 font-mono text-[10px] font-semibold text-white">{pending.length}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
          {(generated || mode === 'new') && <div className="px-3 pb-4"><button type="button" onClick={() => { setMode('initial'); openCycle('Scenarios') }} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/30 px-3 py-2 text-xs font-semibold hover:bg-white/10"><ArrowLeft size={13} />Back to cycle</button></div>}
        </aside>

        <main className="min-w-0">
          <div key={step} className="rise mx-auto w-full max-w-[1040px] px-5 py-7 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-widest text-brand">Step {step} of {N}</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{STEP_META[curStep].title}</h1>

            {curStep === 'setup' && <CycleContext cycle={cycle} cfg={cfg} sub={sub} setSub={setSub} actuals={actuals}
              onIngest={how => { setActuals({ through: 'Jul 2026', at: new Date().toISOString().slice(0, 10), how }); notify({ tone: 'ok', text: how.startsWith('Manual') ? 'Actuals uploaded. History re-locked; forecast re-anchored off Jul 2026.' : 'Snowflake refresh complete. No new months yet.' }) }} />}
            {curStep === 'assumptions' && <>
              <p className="mt-1 max-w-3xl text-sm text-text-2">{mode === 'new' ? `Set the assumptions for this scenario${buildFrom ? `, starting from ${buildFrom}` : ''}.` : 'Set the assumptions for the first forecast.'} These fields come from the {cfg.archetype} model assigned to {brand}, so they change with the model.</p>
              <div className="mt-6">{assumptionsFor(DRAFT)}</div>
            </>}
            {curStep === 'inputs' && <>
              <p className="mt-1 max-w-3xl text-sm text-text-2">Inputs for the modules configured in this model: {cfg.modules.join(', ')}. Bordered cells are yours to change.</p>
              <div className="mt-6"><DriverInputs ctx={ctx} id={DRAFT} groups={cfg.driverGroups} {...editorsFor(setOv, DRAFT)} /></div>
              {cfg.inputModules.length > 0 && <div className="mt-10">{moduleInputs(DRAFT)}</div>}
            </>}
            {curStep === 'generate' && <StepGenerate net={draftNet} eventsNet={eventsNet} gtnNet={gtnNet} vsBudget={draftVs} pHit={pHit} pBudget={pBudget} pending={pending.length} generated={false} onGenerate={generate} label={mode === 'new' ? 'Generate and create scenario' : 'Generate forecast'} intro={mode === 'new' ? 'Generate the forecast for this scenario from its assumptions and inputs. The scenario is created when you generate.' : 'Generate the first forecast from your assumptions and inputs. It becomes Scenario 1, which you can then adjust, analyse and compare.'} />}

          </div>
        </main>

        <aside className={cx('hidden border-l border-border bg-surface', showValues && 'wide:block')}>
          <div className="sticky top-[57px] space-y-5 p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Live forecast · FY2026</p>
            <div><p className="text-xs text-text-2">Net sales</p><p className="font-mono text-3xl font-semibold">{fmtM(draftNet)}</p>
              <p className={cx('mt-1 text-xs font-semibold', vsBudget >= 0 ? 'text-ok' : 'text-err')}>{vsBudget >= 0 ? '+' : ''}{vsBudget.toFixed(1)}% vs budget ({fmtM(BUDGET_NET)})</p></div>
            <Bridge rows={[['Trended statistical', NET_FY], ['Events', eventsNet], ['GTN changes', gtnNet]]} total={net} />
            <div className="rounded-md border border-border p-3 text-xs text-text-2"><p className="flex items-center gap-1.5 font-semibold text-text"><Gauge size={14} className="text-brand" />{pHit.toFixed(0)}% chance of hitting</p>{pBudget.toFixed(0)}% chance of beating budget</div>
            {pending.length > 0 && <button type="button" onClick={openEvents} className="flex w-full items-start gap-2 rounded-md border border-warn/30 bg-warn-soft p-3 text-left text-xs text-text-2"><AlertTriangle size={14} className="mt-px shrink-0 text-warn" /><span><b className="text-text">{pending.length} AlphaSense proposal{pending.length > 1 ? 's' : ''} pending review</b><span className="block">Not in the forecast until you accept.</span></span></button>}
            <dl className="space-y-1.5 text-xs">
              {[['Model', PRODUCT.model], ['Cycle', cycleName], ['Actuals through', PRODUCT.actualsThrough], ['Feed', 'Blaze extract · 2026-08-06']].map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-text-3">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
          </div>
        </aside>
      </div>
      )}

      <ActionBar>
        {view === 'config' ? <>
          <BarStat k={`${mode === 'new' ? 'New scenario' : mode === 'cycle' ? 'Cycle context' : 'New forecast'} · step ${step} of ${N}`} v={STEP_META[curStep].title} />
          {showValues && <BarStat k="Live net FY2026" v={fmtM(draftNet)} d={draftVs} />}
          <div className="ml-auto flex items-center gap-2">
            <Btn variant="secondary" icon={<ArrowLeft size={15} />} disabled={step === 1} onClick={() => openConfig(step - 1)}>Back</Btn>
            {mode === 'cycle' ? <Btn onClick={() => { setMode('initial'); generated ? openCycle('Cycle Summary') : openConfig(2) }}>{generated ? 'Save and back to cycle' : 'Continue to Assumptions'} <ArrowRight size={15} /></Btn>
              : step < N ? <Btn onClick={() => openConfig(step + 1)}>Continue to {STEP_META[stepIds[step]!].title} <ArrowRight size={15} /></Btn>
              : <Btn onClick={generate}><Sparkles size={15} />{mode === 'new' ? 'Generate and create scenario' : 'Generate forecast'}</Btn>}
          </div>
        </> : <>
          <BarStat k={view === 'scenario' ? 'Scenario' : 'Selected scenario'} v={scn} />
          <BarStat k="Net FY2026" v={fmtM(sNet)} d={sVs} />
          <BarStat k="Checks" v={(() => { const b = checks.filter(c => c.tone === 'block').length, w = checks.filter(c => c.tone === 'warn').length; return b ? `${b} to pass · ${w} to note` : w ? `${w} to note` : 'All clear' })()} />
          <div className="ml-auto flex items-center gap-2">
            {submitted ? <Tag tone="ok"><CheckCircle2 size={11} />Submitted {submitted}</Tag> : null}
            {view === 'scenario' && wsTab === 'Review'
              ? <><Btn variant="secondary" icon={<ArrowLeft size={15} />} onClick={() => setWsTab('Inputs')}>Back to inputs</Btn><Btn icon={<Lock size={15} />} disabled={scn === ANCHOR} onClick={() => gate.request()}>Submit {scn} to {sub}</Btn></>
              : <>{view === 'cycle' && <Btn variant="secondary" onClick={() => openScenario(scn)}>Open {scn}</Btn>}<Btn disabled={scn === ANCHOR} onClick={() => openScenario(scn, 'Review')}>Review and submit <ArrowRight size={15} /></Btn></>}
          </div>
        </>}
      </ActionBar>

      {dock && <AgentDock onClose={() => setDock(false)} insights={insights} setInsights={setInsights} addInsight={addInsight} notify={notify}
        ctx={{ net, eventsNet, gtnNet, vsBudget, pHit, pBudget, sims, ranked, pending, ev, setEv, scenario: scn, goEvents: openEvents }} />}
      {confirm && <SubmitDialog sub={sub} scenario={scn} net={sNet} checks={checks} role={role} setRole={setRole} insights={insights.length} onClose={() => setConfirm(null)} onConfirm={() => doSubmit(confirm.after)} />}
      {cr !== null && <ChangeRequestDialog preset={cr} onClose={() => setCr(null)} onSend={() => { setCr(null); notify({ tone: 'ok', text: `Change request sent to the CoE. It will ship as ${MODEL.version.replace('1.0', '1.1')}; your scenarios stay pinned to ${MODEL.version}.` }) }} />}
    </div>
    </SubmitGateCtx.Provider>
  )
}

/* ───────── Sticky action bar — one edge-to-edge place for the primary action on every forecaster screen ───────── */

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-strong bg-surface/95 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
      <div className="mx-auto flex min-h-[68px] w-full max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3 sm:px-6">{children}</div>
    </div>
  )
}
function BarStat({ k, v, d }: { k: string; v: string; d?: number }) {
  return <div className="min-w-0"><p className="truncate text-[11px] text-text-3">{k}</p><p className="flex items-baseline gap-2 truncate text-sm font-semibold">{v}{d !== undefined && <span className={cx('font-mono text-xs', d >= 0 ? 'text-ok' : 'text-err')}>{d >= 0 ? '+' : ''}{d.toFixed(1)}% vs budget</span>}</p></div>
}

/* ───────── Assumptions — editable, model-specific, no history or forecast values ───────── */

function AssumptionsEditor({ cfg, values, onChange, onReset, readOnly }: { cfg: ModelConfig; values: AssumptionValues; onChange: (id: string, v: number | string) => void; onReset: () => void; readOnly?: boolean }) {
  const sections = Array.from(new Set(cfg.assumptions.map(a => a.section)))
  const changed = cfg.assumptions.filter(a => values[a.id] !== undefined && values[a.id] !== a.value).length
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="min-w-0 text-sm"><p className="font-semibold">{cfg.archetype} model <span className="font-normal text-text-3">· {MODEL.version} from CoE</span></p><p className="text-xs text-text-2">{cfg.summary}</p></div>
        <div className="flex items-center gap-3 text-xs text-text-2">{changed > 0 && <Tag tone="warn">{changed} changed</Tag>}{!readOnly && <button type="button" disabled={!changed} onClick={onReset} className="inline-flex items-center gap-1 font-semibold text-text-2 hover:text-brand disabled:opacity-40"><RotateCcw size={12} />Reset to model defaults</button>}</div>
      </div>
      {readOnly && <p className="flex items-center gap-1.5 text-sm text-text-2"><Lock size={13} />Read-only. Create a new scenario to change assumptions.</p>}
      {sections.map(sec => (
        <section key={sec} className="rounded-lg border border-border bg-surface">
          <h3 className="border-b border-border px-5 py-3 text-[13px] font-semibold uppercase tracking-wide text-text-3">{sec}</h3>
          <ul className="divide-y divide-border">
            {cfg.assumptions.filter(a => a.section === sec).map(a => {
              const v = values[a.id] ?? a.value, isChanged = v !== a.value
              const out = a.kind === 'number' && a.band && (Number(v) < a.band[0] || Number(v) > a.band[1])
              return (
                <li key={a.id} className="grid items-center gap-x-6 gap-y-2 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,200px)]">
                  <div className="min-w-0"><p className="text-sm font-medium">{a.label}{isChanged && <span className="ml-2"><Tag tone="warn">Changed</Tag></span>}</p><p className="text-xs text-text-2">{a.help}</p></div>
                  <div>
                    {a.kind === 'select'
                      ? <select disabled={readOnly} aria-label={a.label} value={String(v)} onChange={e => onChange(a.id, e.target.value)} className={cx('h-9 w-full rounded-md border px-2 text-sm outline-none focus:border-brand disabled:opacity-60', isChanged ? 'border-warn bg-warn-soft' : 'border-brand/50 bg-surface')}>{a.options!.map(o => <option key={o.label}>{o.label}</option>)}</select>
                      : <div className="flex items-center gap-2"><input type="number" disabled={readOnly} aria-label={a.label} step={a.step} value={Number(v)} onChange={e => e.target.value !== '' && onChange(a.id, Number(e.target.value))}
                        className={cx('h-9 w-28 rounded-md border px-2 text-right font-mono text-sm outline-none focus:border-brand disabled:opacity-60', out ? 'border-err bg-err-soft' : isChanged ? 'border-warn bg-warn-soft' : 'border-brand/50 bg-surface')} /><span className="whitespace-nowrap text-xs text-text-2">{a.unit}</span></div>}
                    {out && <p className="mt-1 text-[11px] text-err">Outside the CoE range. Request a model change.</p>}
                  </div>
                  <div className="text-xs text-text-3">{a.band && <p>Allowed {a.band[0]}–{a.band[1]} {a.unit}</p>}<p className="truncate">{a.source} · {a.owner}</p></div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* ───────── Forecast setup — cycle context (definitions to validate) ───────── */

function CycleContext({ cycle, cfg, sub, setSub, actuals, onIngest }: { cycle: CycleRow; cfg: ModelConfig; sub: string; setSub: (s: string) => void; actuals: { through: string; at: string; how: string }; onIngest: (how: string) => void }) {
  const year = (cycle.focus.match(/\d{4}/) ?? ['2026'])[0]
  const [f, setF] = useState({ name: cycle.name, period: cycle.focus, cutoff: actuals.through, start: 'Aug 2026', year })
  const field = (k: keyof typeof f, label: string) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-text-2">{label}
      <input value={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} className="h-9 rounded-md border border-brand/50 bg-surface px-2.5 text-sm font-normal text-text outline-none focus:border-brand" /></label>
  )
  return (
    <>
      <p className="mt-1 max-w-3xl text-sm text-text-2">Context for this forecast cycle. These definitions vary by client and still need validation, so they are editable here rather than fixed.</p>
      <Card className="mt-6" title="Cycle context" right={<Tag tone="warn">To validate</Tag>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('name', 'Forecast cycle')}
          <label className="flex flex-col gap-1 text-xs font-medium text-text-2">Submission
            <select value={sub} onChange={e => setSub(e.target.value)} className="h-9 rounded-md border border-brand/50 bg-surface px-2 text-sm font-normal text-text">{SUBMISSIONS.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</select></label>
          {field('year', 'Planning year')}
          {field('period', 'Forecast period')}
          {field('cutoff', 'Actuals cut-off')}
          {field('start', 'Forecast start')}
        </div>
      </Card>
      <Card className="mt-5" title="Assigned model" sub="Configured and published by the CoE. Assumptions and inputs in the next steps come from it.">
        <div className="flex flex-wrap items-center gap-2 text-sm"><b>{cfg.archetype}</b><span className="text-text-3">· {MODEL.version}</span></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{cfg.modules.map(m => <Tag key={m}>{m}</Tag>)}</div>
      </Card>
      <ActualsBoundary actuals={actuals} onIngest={onIngest} />
    </>
  )
}

/* ───────── CoE handoff — what the forecaster receives ───────── */

function ModelBanner({ actualsThrough, scenario, onRequest }: { actualsThrough: string; scenario?: string; onRequest: () => void }) {
  return (
    <div className="border-b border-border bg-brand-soft/50 px-5 py-2">
      <div className="flex items-center gap-x-4 whitespace-nowrap text-xs text-text-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-text"><ShieldCheck size={14} className="text-brand" />Model {MODEL.version} from CoE</span>
        <span className="hidden min-w-0 truncate lg:inline">{MODEL.engine} · published {MODEL.published} by {MODEL.publishedBy}</span>
        <span className="hidden items-center gap-1 2xl:inline-flex"><Lock size={11} />Engine, modules and GTN structure locked</span>
        <span className="inline-flex items-center gap-1"><CalendarClock size={12} />Actuals through <b className="font-semibold text-text">{actualsThrough}</b></span>
        {scenario && <span className="hidden xl:inline">Scenario <b className="font-semibold text-text">{scenario}</b> · pinned to {MODEL.version}</span>}
        <button type="button" onClick={onRequest} className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold text-brand hover:underline">Request a model change<ChevronRight size={12} /></button>
      </div>
    </div>
  )
}

function AssumptionRegister({ onRequest, onGo }: { onRequest: (preset: string) => void; onGo: () => void }) {
  const tone: Record<SlotKind, 'brand' | 'neutral' | 'warn'> = { open: 'brand', locked: 'neutral', derived: 'neutral' }
  const open = SLOTS.filter(s => s.kind === 'open').length
  return (
    <Card className="mt-6" title="What you can change" sub={`${open} of ${SLOTS.length} slots are yours. Each one carries a source, owner and confidence.`}
      right={<div className="flex gap-3 text-[11px] text-text-2">{(['open', 'locked', 'derived'] as SlotKind[]).map(k => <span key={k} className="inline-flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-sm', k === 'open' ? 'border-2 border-brand bg-surface' : k === 'locked' ? 'bg-border-strong' : 'bg-surface-2 ring-1 ring-border-strong')} />{KIND_LABEL[k]}</span>)}</div>}>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="text-left text-xs text-text-3"><th className="px-5 pb-2 font-medium">Slot</th><th className="px-3 pb-2 font-medium">Type</th><th className="px-3 pb-2 font-medium">Value / allowed range</th><th className="px-3 pb-2 font-medium">Source</th><th className="px-3 pb-2 font-medium">Owner</th><th className="px-3 pb-2 font-medium">Confidence</th><th className="px-5 pb-2" /></tr></thead>
          <tbody>
            {SLOTS.map(s => (
              <tr key={s.name} className={cx('border-t border-border', s.kind !== 'open' && 'text-text-2')}>
                <td className="px-5 py-2.5 font-medium text-text">{s.kind !== 'open' && <Lock size={11} className="mr-1.5 inline text-text-3" />}{s.name}</td>
                <td className="px-3 py-2.5"><Tag tone={tone[s.kind]}>{KIND_LABEL[s.kind]}</Tag></td>
                <td className="px-3 py-2.5 text-xs">{s.value}{s.band && <span className="block text-text-3">Allowed: {s.band}</span>}</td>
                <td className="px-3 py-2.5 text-xs">{s.source}</td>
                <td className="px-3 py-2.5 text-xs">{s.owner}</td>
                <td className="px-3 py-2.5 text-xs">{s.conf}</td>
                <td className="px-5 py-2.5 text-right text-xs">
                  {s.kind === 'open'
                    ? s.where === 'Inputs' ? <button type="button" onClick={onGo} className="font-semibold text-brand hover:underline">Edit in Inputs</button> : <span className="text-text-3">In each scenario</span>
                    : s.kind === 'locked' ? <button type="button" onClick={() => onRequest(`Change “${s.name}”`)} className="font-semibold text-text-2 hover:text-brand">Request change</button>
                    : <span className="text-text-3">Computed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-3">Need a value outside an allowed range, or a different structure? That becomes a change request to the CoE and ships as a new model version. It is never typed in here.</p>
    </Card>
  )
}

function ActualsBoundary({ actuals, onIngest }: { actuals: { through: string; at: string; how: string }; onIngest: (how: string) => void }) {
  return (
    <Card className="mt-4" title="Actuals boundary" sub={`Last refresh ${actuals.at} · ${actuals.how}`}
      right={<div className="flex gap-2"><Btn variant="secondary" icon={<RotateCcw size={14} />} onClick={() => onIngest('Snowflake · auto')}>Refresh from Snowflake</Btn><Btn variant="ghost" icon={<Download size={14} />} onClick={() => onIngest('Manual upload')}>Upload actuals</Btn></div>}>
      <div className="flex gap-1">
        {MONTHS.map((m, i) => (
          <div key={m} className="flex-1 text-center">
            <div className={cx('flex h-8 items-center justify-center rounded text-[11px] font-medium', i < ACT_MONTHS ? 'bg-border-strong/60 text-text-2' : 'border border-dashed border-brand bg-brand-soft/40 text-brand')}>{i < ACT_MONTHS ? <Lock size={11} /> : m}</div>
            <span className="mt-1 block text-[10px] text-text-3">{m}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-2">Jan–Jul are facts and read-only in every scenario. From Aug the forecast re-anchors off the last actual month and converges back to plan. Events and overrides only touch forecast months.</p>
    </Card>
  )
}

function ChangeRequestDialog({ preset, onClose, onSend }: { preset: string; onClose: () => void; onSend: () => void }) {
  const [what, setWhat] = useState(preset)
  const [why, setWhy] = useState('')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cr-title" onKeyDown={e => e.key === 'Escape' && onClose()} onClick={onClose}>
      <div className="rise w-full max-w-md rounded-lg bg-surface shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div><h2 id="cr-title" className="text-lg font-semibold">Request a model change</h2><p className="text-sm text-text-2">Goes to the CoE. Approved changes ship as a new version; existing scenarios keep {MODEL.version}.</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>
        <div className="space-y-3 p-5">
          <label className="flex flex-col gap-1 text-xs font-medium text-text-2">What should change<input value={what} onChange={e => setWhat(e.target.value)} placeholder="e.g. Widen the GTN band for Commercial Rebates" className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-text" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-text-2">Why<textarea value={why} onChange={e => setWhy(e.target.value)} rows={3} placeholder="Evidence, source, and the impact you expect" className="rounded-md border border-border-strong bg-surface p-2 text-sm text-text" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn disabled={!what.trim()} icon={<Send size={14} />} onClick={onSend}>Send to CoE</Btn></div>
      </div>
    </div>
  )
}

function StepGenerate({ net, eventsNet, gtnNet, vsBudget, pHit, pBudget, pending, generated, onGenerate, label, intro }: { net: number; eventsNet: number; gtnNet: number; vsBudget: number; pHit: number; pBudget: number; pending: number; generated: boolean; onGenerate: () => void; label: string; intro: string }) {
  return (
    <>
      <p className="mt-1 text-sm text-text-2">{intro}</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="What goes in" sub="Read from the previous steps">
          <ul className="space-y-2.5 text-sm">
            {[['Baseline', 'Actuals through Jul 2026 + model trend', 'locked'], ['Assumptions', 'Set in step Assumptions', 'edited'], ['Inputs', 'Driver inputs and configured modules', 'edited'], ['Events', `${fmtM(eventsNet, true)} probability-weighted`, 'edited'], ['Gross-to-net', `${fmtM(gtnNet, true)} vs 78.4% base`, 'edited']].map(([k, v, t]) => (
              <li key={k} className="flex items-center justify-between gap-3"><span><b className="font-semibold">{k}</b><span className="block text-xs text-text-2">{v}</span></span><Tag tone={t === 'locked' ? 'neutral' : 'brand'}>{t === 'locked' && <Lock size={10} />}{t}</Tag></li>
            ))}
          </ul>
          {pending > 0 && <p className="mt-4 flex items-start gap-2 rounded-md bg-warn-soft p-3 text-xs text-text-2"><AlertTriangle size={14} className="mt-px shrink-0 text-warn" />{pending} AlphaSense proposal{pending > 1 ? 's are' : ' is'} unreviewed and excluded from this forecast.</p>}
        </Card>
        <Card title="Generated forecast" sub="FY2026 net sales">
          <p className="font-mono text-3xl font-semibold">{fmtM(net)}</p>
          <p className={cx('mt-1 text-sm font-semibold', vsBudget >= 0 ? 'text-ok' : 'text-err')}>{vsBudget >= 0 ? '+' : ''}{vsBudget.toFixed(1)}% vs budget ({fmtM(BUDGET_NET)})</p>
          <p className="mt-3 text-xs text-text-2">{pHit.toFixed(0)}% chance of hitting · {pBudget.toFixed(0)}% chance of beating budget</p>
          <div className="mt-5"><Btn onClick={onGenerate}><Sparkles size={15} />{generated ? 'Regenerate forecast' : label}</Btn></div>
        </Card>
      </div>
    </>
  )
}

/* ───────── Submit — one confirmation for guided steps and the workbook ───────── */

function CheckRow({ c }: { c: GateCheck }) {
  return (
    <li className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
      {c.tone === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" /> : c.tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-err" />}
      <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{c.label}</span><span className="block text-xs text-text-3">{c.detail}</span></span>
      {c.fix && <button type="button" onClick={c.fix.run} className="inline-flex shrink-0 items-center gap-0.5 self-start text-xs font-semibold text-brand hover:underline">{c.fix.label}<ChevronRight size={12} /></button>}
    </li>
  )
}

function SubmitDialog({ sub, scenario, net, checks, role, setRole, insights, onClose, onConfirm }: { sub: string; scenario: ScenarioId; net: number; checks: GateCheck[]; role: RoleId; setRole: (r: RoleId) => void; insights: number; onClose: () => void; onConfirm: () => void }) {
  const [ack, setAck] = useState(false)
  const blocks = checks.filter(c => c.tone === 'block'), warns = checks.filter(c => c.tone === 'warn')
  const ok = !blocks.length && (!warns.length || ack)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="sub-title" onKeyDown={e => e.key === 'Escape' && onClose()} onClick={onClose}>
      <div className="rise max-h-[calc(100dvh-32px)] w-full max-w-lg overflow-y-auto rounded-lg bg-surface shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-border p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><ShieldCheck size={18} /></span>
          <div className="min-w-0 flex-1"><h2 id="sub-title" className="text-lg font-semibold">Submit FY2026 {sub} officially?</h2><p className="text-sm text-text-2">{PRODUCT.brand} · {scenario} · <span className="font-mono">{fmtM(net)}</span> net</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </div>
        <div className="space-y-4 p-5">
          <ul className="divide-y divide-border rounded-md border border-border p-3">{checks.map(c => <CheckRow key={c.id} c={c} />)}</ul>
          {insights > 0 && <p className="flex items-center gap-1.5 text-xs text-text-2"><Lightbulb size={13} className="text-brand" />{insights} knowledge bank entr{insights > 1 ? 'ies' : 'y'} for this cycle will be attached to this submission.</p>}
          {!blocks.length && warns.length > 0 && (
            <label className="flex items-start gap-2 rounded-md bg-warn-soft/60 p-3 text-[13px]"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5 accent-[var(--color-brand)]" />I’ve seen the {warns.length} warning{warns.length > 1 ? 's' : ''} above and want to submit anyway. They’ll be noted in the audit record.</label>
          )}
          <p className="text-xs text-text-3">Submitting locks this version and writes the Snowflake export. Trended Statistical stays preserved as the anchor.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          {blocks.length > 0 && <span className="mr-auto text-xs text-err">{blocks.length} check{blocks.length > 1 ? 's' : ''} must pass first</span>}
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!ok} icon={<Lock size={15} />} onClick={onConfirm}>Submit {sub} officially</Btn>
        </div>
      </div>
    </div>
  )
}

/* ───────── Agent dock — Ask Agent, Scenario agent, insight board ───────── */

type AgentCtx = { net: number; eventsNet: number; gtnNet: number; vsBudget: number; pHit: number; pBudget: number; sims: number[]; ranked: { e: Ev; adj: number; full: number }[]; pending: Ev[]; ev: EvState; setEv: (v: EvState) => void; scenario: ScenarioId; goEvents: () => void }
type Answer = { title: string; body: string; action?: { label: string; run: () => void } }

function AgentDock({ onClose, insights, setInsights, addInsight, notify, ctx }: { onClose: () => void; insights: Insight[]; setInsights: (f: (x: Insight[]) => Insight[]) => void; addInsight: PinFn; notify: (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void; ctx: AgentCtx }) {
  const [tab, setTab] = useState<'Ask Agent' | 'Scenario agent' | 'Insights'>('Ask Agent')
  const [thread, setThread] = useState<(Answer & { q: string; id: number })[]>([])
  const [q, setQ] = useState('')
  const risk = ctx.ranked.filter(r => r.full < 0)[0], up = ctx.ranked.filter(r => r.full > 0)

  const answer = (s: string): Answer => {
    const t = s.toLowerCase()
    if (/alphasense|accept|proposal|pending/.test(t)) return { title: 'AlphaSense proposals need a person', body: ctx.pending.length ? `${ctx.pending.length} proposal${ctx.pending.length > 1 ? 's are' : ' is'} pending: ${ctx.pending.map(e => e.name).join('; ')}. I can’t accept them for you — each must be reviewed by a forecaster before it touches the forecast.` : 'Every AlphaSense proposal has been reviewed.', action: ctx.pending.length ? { label: 'Review in Inputs', run: ctx.goEvents } : undefined }
    if (/stress|downside|risk/.test(t) && risk) {
      const target = 80, d = risk.full * (target - ctx.ev[risk.e.id]!.prob) / 100
      return { title: `Downside: ${risk.e.name} at ${target}%`, body: `The largest in-year threat is ${risk.e.name} (${fmtM(risk.full, true)} if it fully lands). Raising it from ${ctx.ev[risk.e.id]!.prob}% to ${target}% moves net by ${fmtM(d, true)} to ${fmtM(ctx.net + d)}.`, action: { label: 'Apply to working scenario', run: () => { ctx.setEv({ ...ctx.ev, [risk.e.id]: { ...ctx.ev[risk.e.id]!, prob: target } }); notify({ tone: 'ok', text: `${risk.e.name} set to ${target}%.` }) } } }
    }
    if (/upside|optimis|favorable/.test(t)) {
      const next = Object.fromEntries(Object.entries(ctx.ev).map(([id, v]) => [id, up.some(u => u.e.id === id) ? { ...v, prob: Math.min(100, v.prob + 20) } : v]))
      const d = up.reduce((a, u) => a + u.full * (Math.min(100, ctx.ev[u.e.id]!.prob + 20) - ctx.ev[u.e.id]!.prob) / 100, 0)
      return { title: 'Upside: favorable events +20 pts', body: `${up.length} favorable in-year event${up.length === 1 ? '' : 's'} raised by 20 points adds ${fmtM(d, true)}, taking net to ${fmtM(ctx.net + d)}.`, action: { label: 'Apply to working scenario', run: () => { ctx.setEv(next); notify({ tone: 'ok', text: 'Favorable events raised by 20 points.' }) } } }
    }
    if (/chance|probab|hit|confiden/.test(t)) return { title: `${ctx.pHit.toFixed(0)}% chance of hitting ${fmtM(ctx.net)}`, body: `Across 2,000 simulated outcomes, ${ctx.pBudget.toFixed(0)}% beat budget (${fmtM(BUDGET_NET)}). P10 ${fmtM(quantile(ctx.sims, 0.1))}, P50 ${fmtM(quantile(ctx.sims, 0.5))}, P90 ${fmtM(quantile(ctx.sims, 0.9))}.` }
    if (/budget|why|above|below/.test(t)) return { title: `Why net is ${ctx.vsBudget >= 0 ? 'above' : 'below'} budget`, body: `The trend alone is ${fmtM(NET_FY)}, already ${((NET_FY / BUDGET_NET - 1) * 100).toFixed(1)}% over budget. Events add ${fmtM(ctx.eventsNet, true)} and GTN changes ${fmtM(ctx.gtnNet, true)}, landing at ${fmtM(ctx.net)} (${ctx.vsBudget >= 0 ? '+' : ''}${ctx.vsBudget.toFixed(1)}%).` }
    if (/top|driver|event|impact|changed/.test(t)) return { title: 'Top events by FY2026 impact', body: ctx.ranked.slice(0, 3).map(r => `${r.e.name}: ${fmtM(r.adj, true)} risk-adjusted (${fmtM(r.full, true)} if certain)`).join('\n') || 'No in-year events are included.' }
    return { title: 'I can help with this forecast', body: 'Ask why net is above budget, the chance of hitting it, or the top events. The scenario agent can stress-test a risk or build an upside case. I never submit or accept AlphaSense events for you.' }
  }
  const ask = (s: string) => { if (!s.trim()) return; setThread(x => [...x, { ...answer(s), q: s, id: Date.now() }]); setQ('') }
  const chips = tab === 'Scenario agent' ? ['Stress-test the top risk', 'Build an upside case', 'Accept the AlphaSense proposals'] : ['Why is net above budget?', 'What’s the chance of hitting this?', 'Top events by impact']

  return (
    <aside aria-label="Agent dock" className="fixed bottom-[76px] right-2 top-[121px] z-40 flex w-full max-w-[400px] flex-col border-l border-border bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white"><Bot size={15} /></span>
        <p className="flex-1 text-sm font-semibold">Forecast agents</p>
        <button type="button" aria-label="Close agents" onClick={onClose} className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-border px-3 py-2">
        {(['Ask Agent', 'Scenario agent', 'Insights'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('rounded px-2.5 py-1.5 text-xs font-semibold transition-colors', tab === t ? 'bg-brand-soft text-brand' : 'text-text-2 hover:text-text')}>
            {t === 'Insights' ? `Knowledge bank (${insights.length})` : t}
          </button>
        ))}
      </div>
      {tab === 'Insights' ? (
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!insights.length && <div className="rounded-md border border-dashed border-border-strong p-6 text-center text-sm text-text-2"><Lightbulb size={18} className="mx-auto mb-2 text-text-3" />Nothing in the knowledge bank for this cycle yet. Use “Add to knowledge bank” or the pin icon on any chart or answer.</div>}
          {insights.map(i => (
            <div key={i.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2"><Pin size={13} className="mt-0.5 shrink-0 text-brand" /><p className="flex-1 text-sm font-semibold">{i.title}</p><button type="button" aria-label="Remove insight" onClick={() => setInsights(xs => xs.filter(x => x.id !== i.id))} className="text-text-3 hover:text-err"><X size={13} /></button></div>
              <p className="mt-1 whitespace-pre-line text-xs text-text-2">{i.body}</p><p className="mt-1.5 text-[11px] text-text-3">Pinned {i.at} · attaches to the submission</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <p className="rounded-md bg-brand-soft/60 p-3 text-xs text-text-2">{tab === 'Ask Agent' ? 'Ask about this forecast. Answers use the live numbers on screen.' : `Builds what-ifs on ${ctx.scenario}. Nothing changes until you apply it.`}</p>
            {thread.map(m => (
              <div key={m.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-text px-3 py-2 text-[13px] text-white">{m.q}</p>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="mt-1 whitespace-pre-line text-[13px] text-text-2">{m.body}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {m.action && <button type="button" onClick={m.action.run} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">{m.action.label}</button>}
                    <button type="button" onClick={() => addInsight(m.title, m.body)} className="inline-flex items-center gap-1 rounded-md border border-border-strong px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand"><Lightbulb size={12} />Add to knowledge bank</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">{chips.map(c => <button key={c} type="button" onClick={() => ask(c)} className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-text-2 hover:border-brand hover:text-brand">{c}</button>)}</div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); ask(q) }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'Ask Agent' ? 'Ask about this forecast…' : 'Describe a what-if…'} className="h-9 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand" />
              <button type="submit" aria-label="Send" className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white hover:bg-brand-dark"><Send size={14} /></button>
            </form>
          </div>
        </>
      )}
    </aside>
  )
}

function Bridge({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <div className="space-y-1.5 text-sm">
      {rows.map(([k, v], i) => <div key={k} className="flex justify-between"><span className="text-text-2">{k}</span><span className={cx('font-mono', i > 0 && (v > 0 ? 'text-ok' : v < 0 ? 'text-err' : 'text-text-3'))}>{i === 0 ? fmtM(v) : fmtM(v, true)}</span></div>)}
      <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><span>Forecast</span><span className="font-mono">{fmtM(total)}</span></div>
    </div>
  )
}

/* ───────── Cycle workspace — overview, scenarios, analytics ───────── */

const CYCLE_TABS: { id: CycleTab; hint: string }[] = [
  { id: 'Cycle Summary', hint: 'Where this cycle lands' },
  { id: 'Scenarios', hint: 'Create, open and compare' },
]
const FEEDS = [
  { name: 'Blaze extract — TRx / NBRx', owner: 'Commercial data', through: 'Jul 2026', refreshed: '2026-08-06', tone: 'ok' as const, note: 'Current' },
  { name: 'Finance — gross-to-net accruals', owner: 'Finance', through: 'Jul 2026', refreshed: '2026-08-04', tone: 'ok' as const, note: 'Current' },
  { name: 'NPA — market trend', owner: 'NPA', through: 'Jun 2026', refreshed: '2026-07-29', tone: 'warn' as const, note: '1 month behind' },
  { name: 'Pricing — WAC schedule', owner: 'Pricing', through: 'Aug 2026', refreshed: '2026-08-01', tone: 'ok' as const, note: 'Current' },
  { name: 'AlphaSense — event proposals', owner: 'CoE', through: 'Sep 2026', refreshed: '2026-09-30', tone: 'ok' as const, note: '3 proposals pending' },
]

function CycleWorkspace({ brand, cycleName, sub, tab, setTab, ctx, selected, rows, net, eventsNet, gtnNet, vsBudget, pHit, pBudget, subAt, parent, onOpen, onNew, onSetup, onBack, pin }: {
  cycle: CycleRow; cfg: ModelConfig; actualsThrough: string
  brand: string; cycleName: string; sub: string; tab: CycleTab; setTab: (t: CycleTab) => void; ctx: React.ComponentProps<typeof CycleSummary>['ctx']; selected: string
  rows: { r: ScenarioRow; net: number; vs: number }[]; net: number; eventsNet: number; gtnNet: number; vsBudget: number; pHit: number; pBudget: number
  ranked: { e: Ev; adj: number; full: number }[]; subAt: Record<string, string>; parent: Record<string, string>; onOpen: (id: string, tab?: WsTab) => void; onNew: (from?: string) => void; onSetup: () => void; onBack: () => void; pin: PinFn
}) {
  const [from, setFrom] = useState('')
  const statusOf = (r: ScenarioRow) => subAt[r.base] ? 'Submitted' : r.status
  return (
    <div className="rise mx-auto w-full max-w-[1240px] px-6 py-8">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-2 hover:text-brand"><ArrowLeft size={15} />My forecasts</button>
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Cycle workspace · {brand}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold tracking-tight">{cycleName}</h1><p className="mt-1 text-sm text-text-2">{rows.length} scenario{rows.length === 1 ? '' : 's'} · generated from {sub} assumptions and inputs</p></div>
        <div className="flex gap-2"><Btn variant="secondary" onClick={onSetup}>Forecast setup</Btn><Btn onClick={() => onNew()}><Plus size={15} />New scenario</Btn></div>
      </div>

      <Tabs className="mt-6" label="Cycle sections" value={tab} onChange={setTab} options={CYCLE_TABS.map(t => ({ id: t.id, label: t.id }))} />

      {tab === 'Cycle Summary' && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[['Generated forecast', fmtM(net), `${vsBudget >= 0 ? '+' : ''}${vsBudget.toFixed(1)}% vs budget`], ['Events', fmtM(eventsNet, true), 'probability-weighted'], ['GTN changes', fmtM(gtnNet, true), 'vs 78.4% base'], ['Chance of hitting', `${pHit.toFixed(0)}%`, `${pBudget.toFixed(0)}% beat budget`]].map(([k, v, d]) => <Kpi key={k} label={k} value={v} note={d} />)}
          </div>
          <CycleSummary ctx={ctx} scenario={selected} brand={brand} seasonal={NUR_TRX} pin={pin} />
        </>
      )}

      {tab === 'Scenarios' && (
        <div className="mt-6">
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="bg-surface-2 text-left text-xs text-text-2"><th className="px-4 py-3 font-medium">Scenario</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Model</th><th className="px-3 py-3 text-right font-medium">Net FY</th><th className="px-3 py-3 text-right font-medium">vs budget</th><th className="px-3 py-3 font-medium">Updated</th><th className="px-4 py-3" /></tr></thead>
              <tbody>
                {rows.map(({ r, net: n, vs }) => (
                  <tr key={r.id} className={cx('border-t border-border', r.base === selected && 'bg-brand-soft/40')}>
                    <td className="px-4 py-3.5"><button type="button" onClick={() => onOpen(r.base)} className="font-semibold hover:text-brand">{r.name}</button>{r.base === selected && <span className="ml-2"><Tag tone="brand">Selected</Tag></span>}<span className="block text-xs text-text-3">{parent[r.base] ? `Copied from ${parent[r.base]}` : 'From the generated forecast'}</span></td>
                    <td className="px-3 py-3.5"><Tag tone={STATUS_TONE[statusOf(r)]}>{statusOf(r)}</Tag></td><td className="px-3 py-3.5 text-xs text-text-2"><span className="inline-flex items-center gap-1"><Lock size={10} />{MODEL.version}</span></td>
                    <td className="px-3 py-3.5 text-right font-mono">{fmtM(n)}</td>
                    <td className={cx('px-3 py-3.5 text-right font-mono text-xs font-semibold', vs >= 0 ? 'text-ok' : 'text-err')}>{vs >= 0 ? '+' : ''}{vs.toFixed(1)}%</td>
                    <td className="px-3 py-3.5 text-xs text-text-2">{r.updated} · {r.by}</td>
                    <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => onOpen(r.base)} className="h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-dark">{statusOf(r) === 'Draft' ? 'Adjust' : 'Open'}</button></td>
                  </tr>
                ))}
                <tr className="border-t border-dashed border-border-strong"><td colSpan={7} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">New scenario, starting from</span>
                    <select value={from} onChange={e => setFrom(e.target.value)} aria-label="Start new scenario from" className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm">
                      <option value="">the generated forecast</option>
                      {rows.map(({ r }) => <option key={r.id} value={r.base}>a copy of {r.name}</option>)}
                    </select>
                    <button type="button" onClick={() => onNew(from || undefined)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-dark"><Plus size={13} />Create</button>
                  </div>
                </td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-text-3">A new scenario starts from the generated forecast, or copies another scenario’s overrides. Every scenario is pinned to model {MODEL.version} and sits on the same actuals, so comparisons stay like-for-like.</p>
        </div>
      )}

    </div>
  )
}

/* ───────── Step 1 ───────── */

function StepSetup({ sub, setSub }: { sub: string; setSub: (s: string) => void }) {
  return (
    <>
      <p className="mt-1 text-sm text-text-2">Confirm the brand, cycle and submission you’re forecasting. Baseline values stay read-only; you provide inputs in the next step.</p>
      <div className="mt-6 space-y-5">
        <Card title={PRODUCT.brand} sub={`${PRODUCT.desc} · Pfizer internal`} right={<Tag tone="ok">Model {PRODUCT.model} · published</Tag>}>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            {[['Primary market', PRODUCT.market], ['Competitors', PRODUCT.competitors], ['WAC', PRODUCT.wac], ['Units / Rx', String(PRODUCT.unitsPerRx)]].map(([k, v]) => <div key={k}><dt className="text-xs text-text-3">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
          </dl>
        </Card>
        <Card title="Submission" sub="Each submission remembers its own selected scenario.">
          <div className="grid gap-2 sm:grid-cols-5">
            {SUBMISSIONS.map(s => (
              <button key={s.id} type="button" disabled={s.done} onClick={() => setSub(s.id)}
                className={cx('rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55', sub === s.id ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-border hover:border-brand/50')}>
                <p className="font-semibold">{s.id}</p><p className="font-mono text-[11px] text-text-3">{s.split}</p>
                <p className={cx('mt-1 text-xs', s.done ? 'text-text-3' : 'font-semibold text-brand')}>{s.done ? <><Lock size={10} className="mr-1 inline" />Submitted</> : s.due}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

/* ───────── Step 2 ───────── */

function StepBaseline() {
  const fy = NUR_TRX.reduce((a, b) => a + b, 0)
  const share = NUR_TRX.map((v, i) => v / MKT_TRX[i]! * 100)
  const max = Math.max(...NUR_TRX)
  return (
    <>
      <p className="mt-1 text-sm text-text-2">Jan–Jul are locked actuals from the Blaze feed. Aug–Dec are the statistical trend you’ll adjust in the next steps. Nothing to edit here — just check it looks right.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ['Product TRx (000s)', fy.toLocaleString(), '+13.9% vs LY'],
          ['TRx share', '43.8%', '−0.0 pt vs LY'],
          ['Gross sales', fmtM(GROSS_FY), 'GTN 78.40%'],
          ['Net sales (trend)', fmtM(NET_FY), '+8.5% vs budget'],
        ].map(([k, v, s]) => <div key={k} className="rounded-lg border border-border bg-surface p-4"><p className="text-xs text-text-3">{k}</p><p className="mt-1 font-mono text-xl font-semibold">{v}</p><p className="mt-0.5 text-xs text-text-2">{s}</p></div>)}
      </div>

      <Card className="mt-5" title="Product TRx — monthly" sub="Nurtec ODT · Franchise (000s)">
        <div className="flex h-44 items-end gap-2">
          {NUR_TRX.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] text-text-3">{v}</span>
              <div className={cx('w-full rounded-t', i < ACT_MONTHS ? 'bg-border-strong' : 'bg-brand')} style={{ height: `${(v / max) * 120}px` }} />
              <span className="text-[11px] text-text-2">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-text-2"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-border-strong" />Actual (locked)</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />6+6 LE trend</span></div>
      </Card>

      <Card className="mt-5" title="Key drivers" sub="Gray columns are locked actuals · blue columns are the trend">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] text-right text-[13px]">
            <thead><tr className="text-[11px] text-text-3"><th className="py-2 text-left font-medium">Metric</th>{MONTHS.map((m, i) => <th key={m} className={cx('px-1.5 py-2 font-medium', i >= ACT_MONTHS && 'bg-brand-soft/60 text-brand')}>{m}<span className="block text-[9px]">{i < ACT_MONTHS ? 'ACT' : 'LE'}</span></th>)}<th className="py-2 pl-3 font-semibold text-text">FY</th></tr></thead>
            <tbody className="font-mono">
              {[
                ['Market TRx (000s)', MKT_TRX.map(String), MKT_TRX.reduce((a, b) => a + b, 0).toLocaleString()],
                ['Nurtec TRx (000s)', NUR_TRX.map(String), fy.toLocaleString()],
                ['Nurtec NBRx (000s)', NUR_NBRX.map(String), '517'],
                ['TRx share', share.map(v => `${v.toFixed(1)}%`), '43.8%'],
              ].map(([k, vals, t]) => (
                <tr key={k as string} className="border-t border-border"><td className="py-2 text-left font-sans font-medium">{k}</td>{(vals as string[]).map((v, i) => <td key={i} className={cx('px-1.5 py-2', i >= ACT_MONTHS && 'bg-brand-soft/40')}>{v}</td>)}<td className="py-2 pl-3 font-semibold">{t}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 flex gap-3 rounded-lg border border-brand/20 bg-brand-soft/60 p-4 text-sm">
        <Sparkles size={18} className="mt-px shrink-0 text-brand" />
        <p className="text-text-2"><strong className="text-text">Bottom line:</strong> Nurtec is on its own trend but {((1 - fy / PLAN_TRX) * 100).toFixed(1)}% behind plan for the year ({fy.toLocaleString()} vs {PLAN_TRX.toLocaleString()} TRx; LY {LY_TRX.toLocaleString()}). The gap is structural to the plan assumption, not a trajectory break — use events to close it, not the trend.</p>
      </div>
    </>
  )
}

/* ───────── Step 3 ───────── */

function StepEvents({ ev, setEv, scenario, onReset, eventsNet, live, review, onReview }: { ev: EvState; setEv: (v: EvState) => void; scenario: ScenarioId; onReset: () => void; eventsNet: number; live: Ev[]; review: Review; onReview: (id: string, r: 'accepted' | 'rejected') => void }) {
  const [cat, setCat] = useState<'All' | Cat>('All')
  const [horizon, setHorizon] = useState<'This year' | 'Later (LRP)'>('This year')
  const inYear = (e: Ev) => e.date.startsWith('2026')
  const list = live.filter(e => (cat === 'All' || e.cat === cat) && (horizon === 'This year' ? inYear(e) : !inYear(e)))
  const byCat = (c: Cat) => live.filter(e => e.cat === c && ev[e.id]!.on).reduce((a, e) => a + fyImpact(e) * ev[e.id]!.prob / 100, 0)
  const set = (id: string, p: Partial<{ on: boolean; prob: number }>) => setEv({ ...ev, [id]: { ...ev[id]!, ...p } })
  return (
    <>
      <p className="mt-1 text-sm text-text-2">Each event moves the trend by its impact × probability. Switch an event on to include it in <strong className="text-text">{scenario}</strong>, then set how likely it is.</p>
      {PROPOSED.some(e => review[e.id] === 'pending') && (
        <section className="mt-6 rounded-lg border border-warn/30 bg-warn-soft/40">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-warn/20 px-4 py-3">
            <div><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-brand" />Proposed by AlphaSense · pending review</p>
              <p className="mt-0.5 text-xs text-text-2">Machine-proposed from research sources. They don’t touch the forecast until you accept them.</p></div>
            <Tag tone="warn">{PROPOSED.filter(e => review[e.id] === 'pending').length} pending</Tag>
          </header>
          <ul className="divide-y divide-warn/15">
            {PROPOSED.filter(e => review[e.id] === 'pending').map(e => {
              const full = fyImpact(e)
              const imp = [e.mkt && `Market ${e.mkt > 0 ? '+' : ''}${e.mkt}%`, e.share && `Share ${e.share > 0 ? '+' : ''}${e.share}pt`, e.price && `Price ${e.price > 0 ? '+' : ''}${e.price}%`].filter(Boolean).join(' · ')
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{e.name}<Tag>Proposed</Tag></p>
                    <p className="mt-0.5 text-xs text-text-2">{e.cat} · {e.type} · {e.date} · {imp} · suggested {e.prob}%</p>
                    <p className="text-xs text-text-3">Source: {e.source}</p>
                  </div>
                  <span className="w-28 text-right"><span className="block font-mono text-sm text-text-3">{fmtM(full * e.prob / 100, true)}</span><span className="text-[11px] text-text-3">if accepted</span></span>
                  <div className="flex gap-2"><Btn variant="secondary" icon={<X size={14} />} onClick={() => onReview(e.id, 'rejected')}>Reject</Btn><Btn icon={<Check size={14} />} onClick={() => onReview(e.id, 'accepted')}>Accept</Btn></div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(['Market', 'Product', 'Pricing'] as Cat[]).map(c => {
          const v = byCat(c), n = live.filter(e => e.cat === c && ev[e.id]!.on).length
          return <button key={c} type="button" onClick={() => setCat(cat === c ? 'All' : c)} className={cx('rounded-lg border bg-surface p-4 text-left transition-colors', cat === c ? 'border-brand ring-1 ring-brand' : 'border-border hover:border-brand/50')}>
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">{c} events</p><Tag tone="brand">{n} of {live.filter(e => e.cat === c).length} on</Tag></div>
            <p className={cx('mt-2 font-mono text-xl font-semibold', v > 0 ? 'text-ok' : v < 0 ? 'text-err' : '')}>{fmtM(v, true)}</p>
            <p className="text-xs text-text-3">Risk-adjusted FY2026 net impact</p>
          </button>
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chips value={horizon} options={['This year', 'Later (LRP)'] as const} onChange={setHorizon} />
          <Chips value={cat} options={['All', 'Market', 'Product', 'Pricing'] as const} onChange={setCat} />
        </div>
        <Btn variant="ghost" icon={<RotateCcw size={14} />} onClick={onReset}>Reset to {scenario}</Btn>
      </div>
      {horizon === 'Later (LRP)' && <p className="mt-3 flex items-center gap-1.5 text-xs text-text-2"><Info size={13} />Events dated beyond FY2026 don’t change this forecast — they flow to the LRP.</p>}

      <div className="mt-4 space-y-2.5">
        {list.map(e => {
          const s = ev[e.id]!, full = fyImpact(e), adj = s.on ? full * s.prob / 100 : 0
          const imp = [e.mkt && `Market ${e.mkt > 0 ? '+' : ''}${e.mkt}%`, e.share && `Share ${e.share > 0 ? '+' : ''}${e.share}pt`, e.price && `Price ${e.price > 0 ? '+' : ''}${e.price}%`].filter(Boolean).join(' · ')
          return (
            <div key={e.id} className={cx('rounded-lg border bg-surface p-4 transition-colors', s.on ? 'border-brand/30' : 'border-border')}>
              <div className="flex flex-wrap items-start gap-4">
                <Toggle on={s.on} onChange={v => set(e.id, { on: v })} label={`Include ${e.name}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{e.name}</p>
                    {favorable(e) ? <TrendingUp size={15} className="text-ok" /> : <TrendingDown size={15} className="text-err" />}
                    {e.conf === 'Unsourced' && <Tag tone="warn">Unsourced</Tag>}
                    {e.proposed && <Tag tone="ok">AlphaSense · reviewed</Tag>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-text-2">{e.cat} · {e.type} · {e.date} · {e.phase} mo phase-in · {imp}</p>
                  <p className="mt-0.5 text-xs text-text-3">Source: {e.source} · Confidence {e.conf}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className={cx('flex items-center gap-2 text-xs text-text-2', !s.on && 'opacity-40')}>
                    <span>Probability</span>
                    <input type="range" min={0} max={100} step={5} value={s.prob} disabled={!s.on} onChange={x => set(e.id, { prob: +x.target.value })} className="w-28 accent-[var(--color-brand)]" />
                    <span className="w-9 font-mono text-text">{s.prob}%</span>
                  </label>
                  <div className="w-24 text-right">
                    <p className={cx('font-mono text-sm font-semibold', adj > 0 ? 'text-ok' : adj < 0 ? 'text-err' : 'text-text-3')}>{full === 0 ? 'LRP' : fmtM(adj, true)}</p>
                    <p className="text-[11px] text-text-3">{full === 0 ? 'after FY26' : s.on ? 'risk-adj.' : `${fmtM(full, true)} if 100%`}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-right text-sm">Events add <strong className={cx('font-mono', eventsNet >= 0 ? 'text-ok' : 'text-err')}>{fmtM(eventsNet, true)}</strong> to FY2026 net</p>
    </>
  )
}

/* ───────── Step 4 ───────── */

function StepGtn({ gtn, setGtn, total, gtnNet }: { gtn: Record<string, number>; setGtn: (g: Record<string, number>) => void; total: number; gtnNet: number }) {
  const max = Math.max(...GTN_LINES.map(l => gtn[l.id]!))
  return (
    <>
      <p className="mt-1 text-sm text-text-2">Gross-to-net applies to forecast months only — booked actuals stay as booked. Every gross dollar keeps <strong className="text-text">{(100 - total).toFixed(1)}¢</strong> after allowances. Price changes themselves are made as Pricing events in the events table above, so each carries a date and probability.</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card title="Allowances (% of gross)" sub={`Total GTN ${total.toFixed(2)}% · trend basis ${BASE_GTN.toFixed(2)}% · LY booked 76.08%`} right={<Btn variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setGtn(Object.fromEntries(GTN_LINES.map(l => [l.id, l.v])))}>Reset to trend</Btn>}>
          <div className="space-y-4">
            {GTN_LINES.map(l => {
              const v = gtn[l.id]!, d = v - l.v
              return (
                <div key={l.id} className="grid grid-cols-[150px_minmax(0,1fr)_120px] items-center gap-4">
                  <span className="text-sm font-medium">{l.id}</span>
                  <input type="range" min={Math.max(0, l.v - 5)} max={l.v + 5} step={0.05} value={v} onChange={e => setGtn({ ...gtn, [l.id]: +e.target.value })} className="accent-[var(--color-brand)]" />
                  <span className="text-right"><span className="font-mono text-sm font-semibold">{v.toFixed(2)}%</span>
                    <span className={cx('block text-[11px]', Math.abs(d) < 0.001 ? 'text-text-3' : d > 0 ? 'text-err' : 'text-ok')}>{Math.abs(d) < 0.001 ? 'on trend' : `${d > 0 ? '+' : ''}${d.toFixed(2)} pt`}</span></span>
                </div>
              )
            })}
          </div>
        </Card>
        <Card title="Where gross goes">
          <div className="space-y-2">
            {GTN_LINES.map(l => <div key={l.id}><div className="flex justify-between text-xs"><span className="text-text-2">{l.id}</span><span className="font-mono">−{fmtM(GROSS_FY * gtn[l.id]! / 100)}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand/70" style={{ width: `${gtn[l.id]! / max * 100}%` }} /></div></div>)}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>GTN change vs trend</span><span className={cx('font-mono', gtnNet > 0 ? 'text-ok' : gtnNet < 0 ? 'text-err' : '')}>{fmtM(gtnNet, true)}</span></div>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ───────── Step 5 · Pressure test ───────── */

function PinBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 text-[11px] font-semibold text-text-2 hover:border-brand hover:text-brand"><Lightbulb size={12} />Add to knowledge bank</button>
}

function StepPressure({ net, eventsNet, gtnNet, gtn, setGtn, sims, pHit, pBudget, ranked, pending, live, ev, onReviewEvents, addInsight }: {
  net: number; eventsNet: number; gtnNet: number; gtn: Record<string, number>; setGtn: (g: Record<string, number>) => void; sims: number[]; pHit: number; pBudget: number
  ranked: { e: Ev; adj: number; full: number }[]; pending: Ev[]; live: Ev[]; ev: EvState; onReviewEvents: () => void; addInsight: PinFn
}) {
  const [target, setTarget] = useState(Math.round(net + 25))
  const fs = (12 - ACT_MONTHS) / 12
  const actualsNet = NET_FY * (ACT_MONTHS / 12)
  const needMonthly = (BUDGET_NET - actualsNet) / (12 - ACT_MONTHS), fcMonthly = (net - actualsNet) / (12 - ACT_MONTHS)
  const p10 = quantile(sims, 0.1), p50 = quantile(sims, 0.5), p90 = quantile(sims, 0.9)
  const lo = quantile(sims, 0.01), hi = quantile(sims, 0.99)
  const bins = 28, width = (hi - lo) / bins || 1
  const hist = Array.from({ length: bins }, (_, i) => sims.filter(v => v >= lo + i * width && v < lo + (i + 1) * width).length)
  const hMax = Math.max(...hist, 1)
  const byCat = (c: Cat) => live.filter(e => e.cat === c && ev[e.id]!.on).reduce((a, e) => a + fyImpact(e) * ev[e.id]!.prob / 100, 0)
  const river: [string, number][] = [['Market events', byCat('Market')], ['Product events', byCat('Product')], ['Pricing events', byCat('Pricing')], ['GTN judgment', gtnNet]]
  const riverMax = Math.max(NET_FY, net) * 1.02, riverMin = Math.min(NET_FY, net, ...river.map((_, i) => NET_FY + river.slice(0, i + 1).reduce((a, [, v]) => a + v, 0))) * 0.98
  const x = (v: number) => `${((v - riverMin) / (riverMax - riverMin)) * 100}%`
  const sens = ranked.slice(0, 6)
  const sensMax = Math.max(...sens.map(r => Math.max(Math.abs(r.adj), Math.abs(r.full - r.adj))), 1)
  const dPts = -(target - net) * 100 / (GROSS_FY * fs)
  const rebate = gtn['Commercial Rebates']!, base = GTN_LINES.find(l => l.id === 'Commercial Rebates')!.v
  const reachable = Math.abs(rebate + dPts - base) <= 5

  return (
    <>
      <p className="mt-1 text-sm text-text-2">The review gate before submission. See how likely this number is, what it rests on and what it would take to move it.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ['Chance of hitting forecast', `${pHit.toFixed(0)}%`, `P(net ≥ ${fmtM(net)})`, pHit < 35 ? 'text-warn' : 'text-text'],
          ['Chance of beating budget', `${pBudget.toFixed(0)}%`, `Budget ${fmtM(BUDGET_NET)}`, pBudget < 50 ? 'text-warn' : 'text-ok'],
          ['P10 – P90 range', `${fmtM(p10)} – ${fmtM(p90)}`, `P50 ${fmtM(p50)}`, 'text-text'],
          ['Unreviewed events', String(pending.length), pending.length ? 'AlphaSense · not in forecast' : 'All reviewed', pending.length ? 'text-warn' : 'text-ok'],
        ].map(([k, v, s2, tone]) => <div key={k} className="rounded-lg border border-border bg-surface p-4"><p className="text-xs text-text-3">{k}</p><p className={cx('mt-1 font-mono text-xl font-semibold', tone)}>{v}</p><p className="mt-0.5 text-xs text-text-2">{s2}</p></div>)}
      </div>

      <Card className="mt-5" title="Probability of hitting forecast" sub="2,000 simulated outcomes: each included event lands or not at its probability, plus trend noise on Aug–Dec."
        right={<PinBtn onClick={() => addInsight(`${pHit.toFixed(0)}% chance of hitting ${fmtM(net)}`, `${pBudget.toFixed(0)}% chance of beating budget. P10 ${fmtM(p10)} · P50 ${fmtM(p50)} · P90 ${fmtM(p90)}.`)} />}>
        <div className="relative flex h-32 items-end gap-px">
          {hist.map((n, i) => { const mid = lo + (i + 0.5) * width; return <div key={i} title={`${fmtM(mid)} · ${n} runs`} className={cx('flex-1 rounded-t-sm', mid >= net ? 'bg-brand' : 'bg-border-strong')} style={{ height: `${(n / hMax) * 100}%` }} /> })}
          {[[net, 'Forecast'], [BUDGET_NET, 'Budget']].map(([v, l]) => (v as number) >= lo && (v as number) <= hi && (
            <div key={l as string} className="pointer-events-none absolute inset-y-0" style={{ left: `${(((v as number) - lo) / (hi - lo)) * 100}%` }}>
              <div className="h-full border-l-2 border-dashed border-text" /><span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded bg-text px-1.5 py-0.5 text-[10px] font-semibold text-white">{l as string}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-text-3"><span>{fmtM(lo)}</span><span>{fmtM(hi)}</span></div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Needs-to-Meet" sub="What Aug–Dec must deliver to land budget." right={<PinBtn onClick={() => addInsight('Needs-to-Meet budget', `Aug–Dec needs ${fmtM(needMonthly)}/month to hit budget; forecast runs ${fmtM(fcMonthly)}/month (${fmtM(fcMonthly - needMonthly, true)} cushion).`)} />}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-text-2">Booked Jan–Jul (actuals)</dt><dd className="font-mono">{fmtM(actualsNet)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-2">Needed per month to meet budget</dt><dd className="font-mono font-semibold">{fmtM(needMonthly)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-2">Forecast per month</dt><dd className="font-mono">{fmtM(fcMonthly)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Monthly cushion</dt><dd className={cx('font-mono', fcMonthly >= needMonthly ? 'text-ok' : 'text-err')}>{fmtM(fcMonthly - needMonthly, true)}</dd></div>
          </dl>
        </Card>

        <Card title="Goal Seek" sub="Solve for the Commercial Rebates rate that lands a target net." right={<Target size={16} className="text-brand" />}>
          <label className="flex items-center gap-3 text-sm"><span className="text-text-2">Target net</span>
            <span className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3">$</span><input type="number" value={target} onChange={e => setTarget(+e.target.value)} className="h-9 w-32 rounded-md border border-border-strong bg-surface pl-6 pr-2 font-mono text-sm outline-none focus:border-brand" /></span><span className="text-text-3">M</span></label>
          <p className="mt-4 text-sm">Commercial Rebates would need to move from <b className="font-mono">{rebate.toFixed(2)}%</b> to <b className="font-mono">{(rebate + dPts).toFixed(2)}%</b> <span className={cx('font-mono text-xs', dPts > 0 ? 'text-err' : 'text-ok')}>({dPts > 0 ? '+' : ''}{dPts.toFixed(2)} pt)</span>.</p>
          {!reachable && <p className="mt-2 flex items-center gap-1.5 text-xs text-warn"><AlertTriangle size={13} />Outside the ±5 pt band allowed for GTN overrides. Use events instead.</p>}
          <div className="mt-4"><Btn variant="secondary" disabled={!reachable || Math.abs(dPts) < 0.005} onClick={() => setGtn({ ...gtn, 'Commercial Rebates': +(rebate + dPts).toFixed(2) })}>Apply to GTN</Btn></div>
        </Card>
      </div>

      <Card className="mt-5" title="Judgment river" sub="How the statistical trend becomes your forecast, layer by layer." right={<PinBtn onClick={() => addInsight('Judgment river', `Trend ${fmtM(NET_FY)} → ${river.map(([k, v]) => `${k} ${fmtM(v, true)}`).join(' → ')} → forecast ${fmtM(net)}.`)} />}>
        <div className="space-y-2">
          {(() => { let run = NET_FY; return [<RiverRow key="t" label="Trended statistical" from={riverMin} to={NET_FY} x={x} tone="base" v={NET_FY} />, ...river.map(([k, v]) => { const a = run; run += v; return <RiverRow key={k} label={k} from={Math.min(a, run)} to={Math.max(a, run)} x={x} tone={v >= 0 ? 'up' : 'down'} v={v} delta /> }), <RiverRow key="f" label="Your forecast" from={riverMin} to={net} x={x} tone="total" v={net} />] })()}
        </div>
        <p className="mt-3 text-xs text-text-3">Judgment = everything above the trend: {fmtM(eventsNet + gtnNet, true)} ({((eventsNet + gtnNet) / NET_FY * 100).toFixed(1)}% of the trend).</p>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Sensitivity" sub="Swing in net if each event lands (100%) or doesn’t (0%)." right={<PinBtn onClick={() => addInsight('Biggest swing events', sens.slice(0, 3).map(r => `${r.e.name}: ${fmtM(-r.adj, true)} to ${fmtM(r.full - r.adj, true)}`).join('\n'), { kind: 'bar', labels: sens.slice(0, 5).map(r => r.e.name), series: [{ name: 'Swing', pts: sens.slice(0, 5).map(r => Math.abs(r.full)), tone: 'brand' }] })} />}>
          {!sens.length ? <p className="text-sm text-text-2">No in-year events are included.</p> : (
            <ul className="space-y-2.5">
              {sens.map(r => { const dn = -r.adj, upv = r.full - r.adj, l = Math.min(dn, upv), h = Math.max(dn, upv); return (
                <li key={r.e.id} className="text-xs">
                  <p className="truncate font-medium text-text">{r.e.name}</p>
                  <div className="relative mt-1 h-3 rounded-sm bg-surface-2">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-text-3" />
                    <span className="absolute inset-y-0 rounded-sm bg-err/70" style={{ left: `${50 + Math.min(0, l) / sensMax * 50}%`, width: `${Math.abs(Math.min(0, l)) / sensMax * 50}%` }} />
                    <span className="absolute inset-y-0 left-1/2 rounded-sm bg-ok/70" style={{ width: `${Math.max(0, h) / sensMax * 50}%` }} />
                  </div>
                  <p className="mt-0.5 flex justify-between font-mono text-[10px] text-text-3"><span>{fmtM(l, true)}</span><span>{fmtM(h, true)}</span></p>
                </li>
              ) })}
            </ul>
          )}
        </Card>

        <Card title="Top events by impact" sub="Risk-adjusted FY2026 contribution.">
          <ul className="divide-y divide-border">
            {ranked.slice(0, 5).map(r => (
              <li key={r.e.id} className="flex items-center gap-3 py-2 text-sm first:pt-0">
                {r.adj >= 0 ? <TrendingUp size={15} className="shrink-0 text-ok" /> : <TrendingDown size={15} className="shrink-0 text-err" />}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.e.name}</span><span className="text-xs text-text-3">{ev[r.e.id]!.prob}% · {r.e.conf}{r.e.proposed && ' · AlphaSense'}</span></span>
                <span className={cx('font-mono text-sm font-semibold', r.adj >= 0 ? 'text-ok' : 'text-err')}>{fmtM(r.adj, true)}</span>
              </li>
            ))}
          </ul>
          {pending.length > 0 && (
            <div className="mt-4 rounded-md border border-warn/30 bg-warn-soft/60 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-warn"><AlertTriangle size={13} />Unreviewed · not in this forecast</p>
              <ul className="mt-1 space-y-0.5 text-text-2">{pending.map(e => <li key={e.id}>{e.name} <span className="font-mono">({fmtM(fyImpact(e), true)} if certain)</span></li>)}</ul>
              <button type="button" onClick={onReviewEvents} className="mt-2 inline-flex items-center gap-0.5 font-semibold text-brand">Review in Inputs<ChevronRight size={12} /></button>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function RiverRow({ label, from, to, x, tone, v, delta }: { label: string; from: number; to: number; x: (v: number) => string; tone: 'base' | 'up' | 'down' | 'total'; v: number; delta?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)_80px] items-center gap-3 text-xs">
      <span className={cx('font-medium', (tone === 'base' || tone === 'total') && 'font-semibold')}>{label}</span>
      <div className="relative h-5 rounded-sm bg-surface-2">
        <span className={cx('absolute inset-y-0 rounded-sm', tone === 'base' && 'bg-border-strong', tone === 'total' && 'bg-brand', tone === 'up' && 'bg-ok/70', tone === 'down' && 'bg-err/70')} style={{ left: x(from), width: `max(2px, calc(${x(to)} - ${x(from)}))` }} />
      </div>
      <span className={cx('text-right font-mono', delta && (v > 0 ? 'text-ok' : v < 0 ? 'text-err' : 'text-text-3'))}>{delta ? fmtM(v, true) : fmtM(v)}</span>
    </div>
  )
}

/* ───────── Step 6 · Review & submit ───────── */

function StepReview({ sub, scenario, eventsNet, gtnNet, net, vsBudget, checks, insights, submitted, onSubmit }: { sub: string; scenario: ScenarioId; eventsNet: number; gtnNet: number; net: number; vsBudget: number; checks: GateCheck[]; insights: Insight[]; submitted: string | null; onSubmit: () => void }) {
  const blocks = checks.filter(c => c.tone === 'block').length, warns = checks.filter(c => c.tone === 'warn').length
  return (
    <>
      <p className="mt-1 text-sm text-text-2">Submitting pins this scenario to model {MODEL.version} and files it under the cycle. Use the submit bar at the bottom of the screen.</p>
      {submitted ? (
        <div className="mt-6 flex gap-3 rounded-lg border border-ok/25 bg-ok-soft p-4 text-sm"><CheckCircle2 size={18} className="mt-px shrink-0 text-ok" /><div><p className="font-semibold">FY2026 {sub} submitted officially · {submitted}</p><p className="text-text-2">Version locked. The export file was saved to your Downloads folder.</p></div></div>
      ) : (
        <div className="mt-6 flex gap-3 rounded-lg border border-brand/20 bg-brand-soft/60 p-4 text-sm"><Info size={18} className="mt-px shrink-0 text-brand" /><p><strong>No official FY2026 {sub} forecast on record.</strong> <span className="text-text-2">Clear the checks, then confirm.</span></p></div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="FY2026 net sales bridge" sub={`${scenario} · ${sub}`}>
          <Bridge rows={[['Trended statistical', NET_FY], ['Events (risk-adjusted)', eventsNet], ['GTN changes', gtnNet]]} total={net} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-surface-2 p-3"><p className="text-xs text-text-3">Budget</p><p className="font-mono font-semibold">{fmtM(BUDGET_NET)}</p></div>
            <div className="rounded-md bg-surface-2 p-3"><p className="text-xs text-text-3">vs budget</p><p className={cx('font-mono font-semibold', vsBudget >= 0 ? 'text-ok' : 'text-err')}>{vsBudget >= 0 ? '+' : ''}{vsBudget.toFixed(1)}%</p></div>
          </div>
        </Card>
        <Card title="Checks before you submit" sub={blocks ? `${blocks} must pass · ${warns} to acknowledge` : warns ? `${warns} to acknowledge` : 'All clear'}>
          <ul className="divide-y divide-border">{checks.map(c => <CheckRow key={c.id} c={c} />)}</ul>
        </Card>
      </div>
      {insights.length > 0 && (
        <Card className="mt-5" title="Knowledge bank entries attached" sub="Pinned while working on this cycle.">
          <ul className="space-y-2 text-sm">{insights.map(i => <li key={i.id} className="flex gap-2"><Pin size={13} className="mt-1 shrink-0 text-brand" /><span><b>{i.title}</b><span className="block whitespace-pre-line text-xs text-text-2">{i.body}</span></span></li>)}</ul>
        </Card>
      )}
      <Card className="mt-5" title="What travels with this submission" sub={`Pinned to model ${MODEL.version}`}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {['Every assumption with its source, owner and confidence', 'The override log: value, year, owner and time', 'Event rationale and probabilities', `Knowledge bank entries for this cycle (${insights.length})`].map(t => <li key={t} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-ok" />{t}</li>)}
        </ul>
      </Card>
    </>
  )
}


/* ───────── My forecasts — landing for forecasters ───────── */

type Status = 'Draft' | 'Submitted' | 'Locked'
type ScenarioRow = { id: string; cycle: string; name: string; base: ScenarioId; sub: string; status: Status; net: number; vsBudget: number; updated: string; by: string }
type CycleRow = { id: string; name: string; desc: string; modified: string; since: string; focus: string }
type BrandRow = { id: string; cycles: CycleRow[]; brand: string; ind: string; market: string; model: string; cycle: string; due: string; scenarios: ScenarioRow[] }

const SEED_BRANDS: BrandRow[] = [
  { id: 'nurtec', cycles: [{ id: 'nl4', name: 'LE4 2026', desc: '6+6 latest estimate', modified: 'You · Oct 10 ’26', since: 'Sep ’26', focus: '2026 – 2026' }, { id: 'nl3', name: 'LE3 2026', desc: '5+7 latest estimate', modified: 'K. Brandt · Aug 22 ’26', since: 'Jun ’26', focus: '2026 – 2026' }, { id: 'nop', name: 'OP 2027', desc: 'Operating plan', modified: 'Not started', since: 'Nov ’26', focus: '2027 – 2029' }], brand: 'Nurtec ODT', ind: 'Migraine — acute · preventive', market: 'US', model: 'LES Model 2.0 · v3.12.14', cycle: 'FY2026 · 6+6 LE', due: 'LE4 due Nov 3', scenarios: [
    { id: 'n1', cycle: 'nl4', name: 'Trended Statistical', base: 'Trended Statistical', sub: 'LE4', status: 'Locked', net: 1635.5, vsBudget: 8.5, updated: 'Aug 6', by: 'Feed' },
    { id: 'n2', cycle: 'nl4', name: 'Scenario 1', base: 'Scenario 1', sub: 'LE4', status: 'Draft', net: 1635.0, vsBudget: 8.5, updated: 'Today, 09:40', by: 'You' },
    { id: 'n3', cycle: 'nl4', name: 'Scenario 2', base: 'Scenario 2', sub: 'LE4', status: 'Draft', net: 1652.8, vsBudget: 9.6, updated: 'Oct 10', by: 'You' },
    { id: 'n4', cycle: 'nl4', name: 'Scenario 3', base: 'Scenario 3', sub: 'LE4', status: 'Draft', net: 1611.2, vsBudget: 6.9, updated: 'Oct 10', by: 'You' },
    { id: 'n5', cycle: 'nl3', name: 'Scenario 1', base: 'Scenario 1', sub: 'LE3', status: 'Submitted', net: 1618.4, vsBudget: 7.4, updated: 'Aug 22', by: 'K. Brandt' },
  ] },
  { id: 'cibinqo', cycles: [{ id: 'cop', name: 'OP 2027', desc: 'Operating plan', modified: 'You · Oct 9 ’26', since: 'Sep ’26', focus: '2027 – 2029' }, { id: 'cqbr', name: 'QBR 2026', desc: 'Quarterly business review', modified: 'Not started', since: 'Oct ’26', focus: '2026 – 2026' }], brand: 'Cibinqo', ind: 'Atopic dermatitis', market: 'US', model: 'Prevalent-Share · v2.3', cycle: 'OP 2027', due: 'Op Plan due Nov 14', scenarios: [
    { id: 'c1', cycle: 'cop', name: 'Scenario 1', base: 'Scenario 1', sub: 'Op Plan', status: 'Submitted', net: 412.6, vsBudget: 3.1, updated: 'Oct 9', by: 'You' },
    { id: 'c2', cycle: 'cop', name: 'JAK label risk', base: 'Scenario 2', sub: 'Op Plan', status: 'Draft', net: 371.9, vsBudget: -7.1, updated: 'Oct 8', by: 'You' },
    { id: 'c3', cycle: 'cop', name: 'Scenario 3', base: 'Scenario 3', sub: 'Op Plan', status: 'Draft', net: 405.0, vsBudget: 1.2, updated: 'Oct 2', by: 'A. Nguyen' },
  ] },
  { id: 'lorbrena', cycles: [{ id: 'llrp', name: 'LRP 2027–2036', desc: 'Long range plan', modified: 'You · Sep 30 ’26', since: 'Sep ’26', focus: '2027 – 2036' }], brand: 'Lorbrena', ind: 'ALK+ NSCLC 1L · 2L+', market: 'EU5', model: 'Patient-Flow · v3.0', cycle: 'LRP 2027–2036', due: 'LRP due Feb 6', scenarios: [
    { id: 'l1', cycle: 'llrp', name: 'Scenario 1', base: 'Scenario 1', sub: 'Op Plan', status: 'Draft', net: 286.3, vsBudget: 0.0, updated: 'Sep 30', by: 'You' },
    { id: 'l2', cycle: 'llrp', name: 'Earlier 1L uptake', base: 'Scenario 2', sub: 'Op Plan', status: 'Draft', net: 318.7, vsBudget: 11.3, updated: 'Sep 30', by: 'You' },
  ] },
  { id: 'eliquis', cycles: [{ id: 'eq4', name: 'Q4 2026 Re-forecast', desc: 'Quarterly re-forecast', modified: 'Not started', since: 'Oct ’26', focus: '2026 – 2026' }], brand: 'Eliquis', ind: 'Stroke prevention in AF · VTE', market: 'US', model: 'Rx-Share · v4.1', cycle: 'Q4 2026 Re-forecast', due: 'Re-forecast due Oct 31', scenarios: [] },
]

const STATUS_TONE: Record<Status, 'neutral' | 'ok' | 'warn'> = { Draft: 'neutral', Submitted: 'ok', Locked: 'neutral' }
// 'Locked' rows are the preserved statistical baseline. Who finalises or locks a submitted LE is pending client validation.
const STATUS_LABEL: Record<Status, string> = { Draft: 'Draft', Submitted: 'Submitted', Locked: 'Baseline' }

type SortKey = 'name' | 'status' | 'net' | 'vs'
type Section = 'forecasts' | 'knowledge' | 'sources'
const NAV: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'forecasts', label: 'My forecasts', icon: <FolderTree size={18} /> },
  { id: 'knowledge', label: 'Knowledge bank', icon: <BookOpen size={18} /> },
  { id: 'sources', label: 'Data sources', icon: <Database size={18} /> },
]
const STATUS_RANK: Record<Status, number> = { Draft: 0, Submitted: 1, Locked: 2 }

function ConfirmDelete({ kind, name, brand, detail, onCancel, onConfirm }: { kind: 'scenario' | 'cycle'; name: string; brand: string; detail: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc" onKeyDown={e => e.key === 'Escape' && onCancel()} onClick={onCancel}>
      <div className="rise w-full max-w-md rounded-lg bg-surface shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex gap-3 p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-err-soft text-err"><Trash2 size={17} /></span>
          <div className="min-w-0"><h2 id="del-title" className="text-lg font-semibold">Delete {kind} “{name}”?</h2>
            <p id="del-desc" className="mt-1 text-sm text-text-2">{brand} · {detail} This can’t be undone.</p></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <button type="button" autoFocus onClick={onConfirm} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-err px-4 text-sm font-semibold text-white hover:opacity-90"><Trash2 size={14} />Delete {kind}</button>
        </div>
      </div>
    </div>
  )
}

const SEED_KB: Insight[] = [
  { id: 'kb1', title: 'Biggest swing events', body: 'IRA Cycle 3 MFP — Nurtec selection: −$41.2M to +$27.5M\nQulipta H2H incremental erosion: −$18.0M to +$18.0M', at: 'Oct 2, 2026, 10:14 AM', updated: 'Oct 3, 2026, 09:02 AM', author: ME_NAME, brand: 'Nurtec ODT', cycle: 'LE4 2026', scenario: 'Scenario 1', where: 'Scenario workspace',
    chart: { kind: 'bar', labels: ['IRA Cycle 3 MFP', 'Qulipta H2H', 'Pediatric approval', 'ODT supply', 'Telehealth'], series: [{ name: 'Swing', pts: [68.7, 36, 21.4, 14.2, 9.8], tone: 'brand' }] },
    comments: [{ id: 'c1', author: 'K. Brandt', text: 'MFP probability at 60% feels high for Cycle 3 — Market Access has it closer to 45%. Worth a sensitivity at both.', at: 'Oct 2, 2026, 02:40 PM' }, { id: 'c2', author: 'R. Osei', text: 'Agree. The Qulipta erosion assumes no new H2H data; flagging for the Nov readout.', at: 'Oct 3, 2026, 09:02 AM' }] },
  { id: 'kb2', title: 'Needs-to-Meet budget', body: 'Aug–Dec needs $96.4M/month to hit budget; forecast runs $104.6M/month (+$8.2M cushion).', at: 'Sep 28, 2026, 04:02 PM', updated: 'Sep 28, 2026, 04:02 PM', author: ME_NAME, brand: 'Nurtec ODT', cycle: 'LE4 2026', where: 'Cycle · Analytics',
    chart: { kind: 'line', labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec'], series: [{ name: 'Needed', pts: [96.4, 96.4, 96.4, 96.4, 96.4], tone: 'muted' }, { name: 'Forecast', pts: [101.2, 103.0, 104.9, 105.6, 108.3], tone: 'brand' }] }, comments: [] },
]

const SNAP_FILL = { brand: 'fill-brand', muted: 'fill-text-3', ok: 'fill-ok', err: 'fill-err', dark: 'fill-text' }
const SNAP_STROKE = { brand: 'stroke-brand', muted: 'stroke-text-3', ok: 'stroke-ok', err: 'stroke-err', dark: 'stroke-text' }
const SNAP_DOT = { brand: 'bg-brand', muted: 'bg-text-3', ok: 'bg-ok', err: 'bg-err', dark: 'bg-text' }

/** Static render of a pinned chart. Scales to its card; strokes stay crisp. */
function SnapChart({ snap }: { snap: Snap }) {
  const W = 400, H = 120, n = snap.labels.length
  const vals = snap.series.flatMap(s => s.pts)
  const max = Math.max(1e-9, ...vals) * 1.08, min = snap.kind === 'line' ? Math.min(...vals) * 0.92 : 0
  const y = (v: number) => H - ((v - min) / (max - min)) * H
  const x = (i: number) => n <= 1 ? W / 2 : (i / (n - 1)) * W
  const slot = W / Math.max(1, n), bw = slot * 0.7 / snap.series.length
  const every = Math.max(1, Math.ceil(n / 6))
  return (
    <figure className="rounded-md border border-border bg-surface-2/30 px-3 pb-2.5 pt-3">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-28 w-full" role="img" aria-label="Pinned chart">
        {[0.25, 0.5, 0.75].map(t => <line key={t} x1={0} x2={W} y1={H * t} y2={H * t} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {snap.kind === 'line'
          ? snap.series.map(s => <path key={s.name} d={s.pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')} fill="none" className={SNAP_STROKE[s.tone ?? 'brand']} strokeWidth={2} strokeDasharray={s.tone === 'muted' ? '5 4' : undefined} vectorEffect="non-scaling-stroke" />)
          : snap.series.map((s, k) => s.pts.map((v, i) => <rect key={`${s.name}${i}`} x={i * slot + slot * 0.15 + k * bw} y={y(v)} width={bw} height={Math.max(0, H - y(v))} className={cx(SNAP_FILL[s.tone ?? 'brand'], 'opacity-80')} />))}
      </svg>
      <div className="mt-1 flex justify-between gap-1 text-[10px] text-text-3">{snap.labels.map((l, i) => <span key={i} className={cx('min-w-0 flex-1 truncate text-center', i % every !== 0 && 'invisible')}>{l}</span>)}</div>
      <figcaption className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-2">{snap.series.map(s => <span key={s.name} className="inline-flex items-center gap-1"><i className={cx('h-2 w-2 rounded-sm', SNAP_DOT[s.tone ?? 'brand'])} />{s.name}</span>)}</figcaption>
    </figure>
  )
}

function KbCard({ i, setKb, onOpen }: { i: Insight; setKb: SetKb; onOpen: (brand: string, cycle: string) => void }) {
  const [draft, setDraft] = useState('')
  const [more, setMore] = useState(false)
  const [all, setAll] = useState(false)
  const comments = i.comments ?? []
  const visible = all ? comments : comments.slice(-1)
  const post = () => {
    const text = draft.trim(); if (!text) return
    const now = stamp()
    setKb(xs => xs.map(x => x.id === i.id ? { ...x, updated: now, comments: [...(x.comments ?? []), { id: `c${Date.now()}`, author: ME_NAME, text, at: now }] } : x))
    setDraft(''); setAll(true)
  }
  const meta = [i.brand, i.cycle, i.scenario].filter(Boolean).join(' · ')
  const long = i.body.length > 160 || i.body.includes('\n')
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <header className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><Pin size={14} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold leading-tight">{i.title}</h2>
            <p className="mt-0.5 truncate text-xs text-text-3">{meta}{i.where && <> · {i.where}</>}</p>
          </div>
          <button type="button" aria-label="Remove from knowledge bank" title="Remove" onClick={() => setKb(xs => xs.filter(x => x.id !== i.id))} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-3 hover:bg-surface-2 hover:text-err"><Trash2 size={14} /></button>
        </header>
        <div>
          <p className={cx('whitespace-pre-line text-sm leading-relaxed text-text-2', !more && 'line-clamp-3')}>{i.body}</p>
          {long && <button type="button" onClick={() => setMore(m => !m)} className="mt-1 text-xs font-semibold text-brand hover:underline">{more ? 'Show less' : 'Show more'}</button>}
        </div>
        {i.chart && <SnapChart snap={i.chart} />}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1 text-[11px] text-text-3">
          <span>Pinned {i.at}{i.author && ` by ${i.author}`}{i.updated && i.updated !== i.at && <> · Updated {i.updated}</>}</span>
          {i.brand && i.cycle && <button type="button" onClick={() => onOpen(i.brand!, i.cycle!)} className="inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">Open cycle<ChevronRight size={12} /></button>}
        </div>
      </div>
      <div className="border-t border-border bg-surface-2/40 px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Comments <span className="font-normal text-text-3">{comments.length}</span></p>
          {comments.length > 1 && <button type="button" onClick={() => setAll(a => !a)} className="text-xs font-medium text-brand hover:underline">{all ? 'Show latest' : `View all ${comments.length}`}</button>}
        </div>
        {visible.length > 0 && <ul className="mt-3 space-y-3">{visible.map(c => (
          <li key={c.id} className="flex gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand">{c.author.split(/[ .]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2)}</span>
            <div className="min-w-0 flex-1"><p className="flex flex-wrap items-baseline gap-x-2 text-xs"><b className="font-semibold">{c.author}</b><span className="text-[11px] text-text-3">{c.at}</span></p><p className="mt-0.5 break-words text-[13px] leading-snug text-text-2">{c.text}</p></div>
          </li>))}</ul>}
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border-strong bg-surface pl-2.5 pr-1 focus-within:border-brand">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && post()} placeholder="Add a comment" aria-label={`Comment on ${i.title}`} className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          <button type="button" disabled={!draft.trim()} onClick={post} aria-label="Post comment" className="grid h-7 w-7 place-items-center rounded text-brand hover:bg-brand-soft disabled:text-text-3 disabled:hover:bg-transparent"><Send size={14} /></button>
        </div>
      </div>
    </li>
  )
}

function KnowledgeBank({ kb, setKb, onOpen }: { kb: Insight[]; setKb: SetKb; onOpen: (brand: string, cycle: string) => void }) {
  const [q, setQ] = useState('')
  const shown = kb.filter(i => !q || `${i.title} ${i.body} ${(i.comments ?? []).map(c => c.text).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><h1 className="text-[28px] font-semibold tracking-tight">Knowledge bank</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-2">Charts and findings pinned from your forecasts, with the graph captured as it looked. Anyone on the brand team can comment on the assumptions behind them.</p></div>
        <label className="relative w-full max-w-[280px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label="Search the knowledge bank" className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-3 text-sm" /></label>
      </div>
      {!shown.length ? (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-10 text-center text-sm text-text-2"><BookOpen size={20} className="mx-auto mb-2 text-text-3" />{kb.length ? 'No entries match.' : 'Nothing pinned yet. Use the pin on any chart, analysis card or agent answer.'}</div>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">{shown.map(i => <KbCard key={i.id} i={i} setKb={setKb} onOpen={onOpen} />)}</ul>
      )}
    </div>
  )
}

export function LegacyForecaster({ onHome, notify }: { onHome: () => void; notify: (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void }) {
  const [brands, setBrands] = useState(SEED_BRANDS)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [navMin, setNavMin] = useState(false)
  const [del, setDel] = useState<{ kind: 'scenario' | 'cycle'; b: BrandRow; id: string; name: string; detail: string } | null>(null)
  const confirmDelete = () => {
    if (!del) return
    if (del.kind === 'scenario') upd(del.b.id, rs => rs.filter(r => r.id !== del.id))
    else setBrands(bs => bs.map(x => x.id === del.b.id ? { ...x, cycles: x.cycles.filter(c => c.id !== del.id), scenarios: x.scenarios.filter(r => r.cycle !== del.id) } : x))
    notify({ tone: 'ok', text: `${del.kind === 'scenario' ? 'Scenario' : 'Cycle'} “${del.name}” deleted.` })
    setDel(null)
  }
  const [section, setSection] = useState<Section>('forecasts')
  const [kb, setKb] = useState<Insight[]>(SEED_KB)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  const [editing, setEditing] = useState<{ brand: string; cycle: string; view: View; scn?: string; newFrom?: string } | null>(null)

  const upd = (bid: string, f: (rows: ScenarioRow[]) => ScenarioRow[]) => setBrands(bs => bs.map(b => b.id === bid ? { ...b, scenarios: f(b.scenarios) } : b))
  const toggle = (id: string) => setOpen(o => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n })
  const hasScenarios = (b: BrandRow, cycle: string) => b.scenarios.some(r => r.cycle === cycle && r.base !== ANCHOR)
  const createRow = (b: BrandRow, cycleId: string, from?: ScenarioRow): ScenarioRow => {
    const used = b.scenarios.filter(r => r.cycle === cycleId).map(r => Number(/^Scenario (\d+)$/.exec(r.base)?.[1] ?? 0))
    const k = Math.max(0, ...used) + 1
    const row: ScenarioRow = { id: `s${Date.now()}`, cycle: cycleId, name: from ? `${from.name} (copy)` : `Scenario ${k}`, base: `Scenario ${k}`, sub: from?.sub ?? b.scenarios.find(r => r.cycle === cycleId)?.sub ?? 'LE4', status: 'Draft', net: from?.net ?? NET_FY, vsBudget: from?.vsBudget ?? 8.5, updated: 'Just now', by: 'You' }
    upd(b.id, rs => [...rs, row]); setOpen(o => new Set(o).add(b.id).add(cycleId))
    return row
  }
  const openCycle = (b: BrandRow, cycle: string) => setEditing({ brand: b.brand, cycle, view: hasScenarios(b, cycle) ? 'cycle' : 'config' })
  const openScenario = (b: BrandRow, s: ScenarioRow) => setEditing({ brand: b.brand, cycle: s.cycle, view: 'scenario', scn: s.base })
  const addScenario = (b: BrandRow, from?: ScenarioRow, cycleId?: string) => {
    const cy = cycleId ?? from?.cycle ?? b.cycles[0]!.id
    // New scenarios always go through Assumptions → Inputs → Generate before they exist.
    setEditing(hasScenarios(b, cy) ? { brand: b.brand, cycle: cy, view: 'config', newFrom: from && from.base !== ANCHOR ? from.base : '' } : { brand: b.brand, cycle: cy, view: 'config' })
  }
  const clickSort = (key: SortKey) => setSort(s => !s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null)

  if (editing) {
    const b = brands.find(x => x.brand === editing.brand)!
    const cy = b.cycles.find(c => c.id === editing.cycle)!
    const rows = b.scenarios.filter(r => r.cycle === cy.id)
    const sub0 = rows[0]?.sub ?? 'LE4'
    return <ForecastFlow key={`${b.id}-${cy.id}-${editing.view}-${editing.scn ?? ''}-${editing.newFrom ?? '-'}`} brand={b.brand} model={b.model} cycle={cy} newFrom={editing.newFrom} cycleName={cy.name} cycleRows={rows} initSub={['LE1', 'LE2', 'LE3'].includes(sub0) ? 'LE4' : sub0} view0={editing.view} scn0={editing.scn}
      notify={notify} onHome={focus => { setEditing(null); setSection('forecasts'); if (focus) setOpen(o => new Set(o).add(b.id)) }} onNewScenario={f => createRow(b, cy.id, f ? rows.find(x => x.base === f) : undefined).base}
      kb={kb} setKb={setKb} onSaved={list => upd(b.id, rs => rs.map(x => { const m = x.cycle === cy.id ? list.find(l => l.base === x.base) : undefined; return m ? { ...x, net: m.net, vsBudget: m.vsBudget, status: m.submitted ? 'Submitted' : x.status, updated: 'Just now', by: 'You' } : x }))} />
  }

  const all = brands.flatMap(b => b.scenarios.map(s => ({ ...s, b })))
  const drafts = all.filter(s => s.status === 'Draft')
  const submittedN = all.filter(s => s.status === 'Submitted').length

  const cmp = (a: ScenarioRow, c: ScenarioRow) => {
    if (!sort) return 0
    const v = sort.key === 'name' ? a.name.localeCompare(c.name) : sort.key === 'status' ? STATUS_RANK[a.status] - STATUS_RANK[c.status] : sort.key === 'net' ? a.net - c.net : a.vsBudget - c.vsBudget
    return v * sort.dir
  }
  const sum = (rs: ScenarioRow[], k: 'net' | 'vsBudget') => rs.reduce((x, r) => x + r[k], 0) / (k === 'vsBudget' && rs.length ? rs.length : 1)
  const grpCmp = (an: string, ar: ScenarioRow[], bn: string, br: ScenarioRow[]) => {
    if (!sort || sort.key === 'status') return 0
    const v = sort.key === 'name' ? an.localeCompare(bn) : sort.key === 'net' ? sum(ar, 'net') - sum(br, 'net') : sum(ar, 'vsBudget') - sum(br, 'vsBudget')
    return v * sort.dir
  }
  const shown = [...brands].sort((a, c) => grpCmp(a.brand, a.scenarios, c.brand, c.scenarios))

  const Th = ({ k, children, right }: { k?: SortKey; children?: ReactNode; right?: boolean }) => {
    const on = !!k && sort?.key === k
    return (
      <th className={cx('whitespace-nowrap px-3 py-3 font-semibold', right && 'text-right')} aria-sort={on ? (sort!.dir === 1 ? 'ascending' : 'descending') : undefined}>
        {k ? <button type="button" onClick={() => clickSort(k)} className={cx('inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-text', on ? 'text-brand' : 'text-text-3')}>
          {children}{on ? (sort!.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-60" />}
        </button> : <span className="uppercase tracking-wide text-text-3">{children}</span>}
      </th>
    )
  }

  return (
    <div className="min-h-full bg-background">
      <div className={cx('grid min-h-full transition-[grid-template-columns] duration-200', navMin ? 'md:grid-cols-[68px_minmax(0,1fr)]' : 'md:grid-cols-[240px_minmax(0,1fr)]')}>
        <nav aria-label="Workspace" className="flex flex-col bg-brand-dark p-3 text-white md:sticky md:top-0 md:h-[calc(100dvh-72px)]">
          <div className={cx('mb-3 hidden items-center md:flex', navMin ? 'justify-center' : 'justify-between pl-3')}>
            {!navMin && <p className="whitespace-nowrap font-mono text-[11px] uppercase tracking-widest text-white/55">Forecaster</p>}
            <button type="button" onClick={() => setNavMin(m => !m)} aria-label={navMin ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!navMin} title={navMin ? 'Expand' : 'Collapse'}
              className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">{navMin ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
          </div>
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map(n => {
              const count = n.id === 'knowledge' ? kb.length : n.id === 'forecasts' ? all.length : 0
              const on = section === n.id
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => setSection(n.id)} aria-current={on ? 'page' : undefined} title={navMin ? n.label : undefined}
                    className={cx('relative flex w-full items-center gap-3 whitespace-nowrap rounded-md py-2.5 text-left text-[14px] font-semibold transition-colors', navMin ? 'md:justify-center md:px-0 px-3' : 'px-3', on ? 'bg-white text-brand-dark shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white')}>
                    <span className="shrink-0">{n.icon}</span>
                    <span className={cx('truncate', navMin && 'md:sr-only')}>{n.label}</span>
                    {count > 0 && (navMin
                      ? <span className="absolute right-1.5 top-1.5 hidden h-2 w-2 rounded-full bg-[#34d399] md:block" />
                      : <span className={cx('ml-auto rounded-full px-1.5 font-mono text-[10px]', on ? 'bg-brand-soft text-brand' : 'bg-white/15 text-white')}>{count}</span>)}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <main className="mx-auto w-full min-w-0 max-w-[1240px] px-6 py-8">
          {section === 'knowledge' && <KnowledgeBank kb={kb} setKb={setKb} onOpen={(brand, cycle) => { const b = brands.find(x => x.brand === brand); const cy = b?.cycles.find(c => c.name === cycle); if (b && cy) openCycle(b, cy.id) }} />}

          {section === 'forecasts' && (
            <div className="rise">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><h1 className="text-[28px] font-semibold tracking-tight">My forecasts</h1><p className="mt-1 text-sm text-text-2">Brand, then forecast cycle, then scenarios. Open a cycle to summarise and compare, or a scenario to adjust it.</p></div>
                <button type="button" onClick={() => setOpen(open.size ? new Set() : new Set([...brands.map(b => b.id), ...brands.flatMap(b => b.cycles.map(c => c.id))]))} className="text-sm font-medium text-brand">{open.size ? 'Collapse all' : 'Expand all'}</button>
              </div>

              <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[900px] text-sm">
                  <thead><tr className="border-b border-border bg-surface-2/60 text-left text-[11px]">
                    <Th k="name">Brand · cycle · scenario</Th><Th k="status">Status</Th><Th k="net" right>Net FY</Th><Th k="vs" right>vs budget</Th><Th>Updated</Th><th className="py-3 pl-2 pr-3" />
                  </tr></thead>
                  <tbody>
                    {shown.map(b => {
                      const isOpen = open.has(b.id)
                      return (
                        <Fragment key={b.id}>
                          <tr className="cursor-pointer border-b border-border bg-surface-2 hover:bg-surface-2/70" onClick={() => toggle(b.id)}>
                            <td className="py-3.5 pl-4 pr-2">
                              <div className="flex items-center gap-3">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-surface text-text-2 ring-1 ring-border"><ChevronDown size={14} className={cx('transition-transform', !isOpen && '-rotate-90')} /></span>
                                <div><p className="text-[15px] font-semibold">{b.brand} <span className="ml-1 text-xs font-normal text-text-3">{b.market}</span></p><p className="text-xs text-text-2">{b.ind}</p></div>
                              </div>
                            </td>
                            <td className="px-3 py-3.5 text-xs text-text-2">{b.cycles.length} cycle{b.cycles.length === 1 ? '' : 's'} · {b.scenarios.length} scenario{b.scenarios.length === 1 ? '' : 's'}</td>
                            <td className="px-3 py-3.5" colSpan={2} />
                            <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-warn">{b.due}</td>
                            <td className="py-3.5 pl-2 pr-3" />
                          </tr>
                          {isOpen && [...b.cycles].sort((a, c) => grpCmp(a.name, b.scenarios.filter(r => r.cycle === a.id), c.name, b.scenarios.filter(r => r.cycle === c.id))).map(cy => {
                            const rows = b.scenarios.filter(r => r.cycle === cy.id).sort(cmp)
                            const cOpen = open.has(cy.id)
                            const nSub = rows.filter(r => r.status === 'Submitted').length
                            return (
                              <Fragment key={cy.id}>
                                <tr className="group cursor-pointer border-b border-border bg-surface hover:bg-brand-soft/30" onClick={() => toggle(cy.id)}>
                                  <td className="relative py-3 pl-12 pr-4">
                                    <span aria-hidden className="absolute bottom-0 left-[26px] top-0 w-px bg-border-strong" />
                                    <span aria-hidden className="absolute left-[26px] top-1/2 h-px w-3 bg-border-strong" />
                                    <div className="flex items-center gap-2.5"><ChevronDown size={14} className={cx('shrink-0 text-text-3 transition-transform', !cOpen && '-rotate-90')} /><div><p className="font-semibold">{cy.name}</p><p className="text-xs text-text-2">Focus {cy.focus} · {cy.desc}</p></div></div>
                                  </td>
                                  <td className="px-3 py-3 text-xs text-text-2">{nSub} of {rows.length} submitted</td>
                                  <td className="px-3 py-3" colSpan={2} />
                                  <td className="px-3 py-3 text-xs text-text-3">{cy.modified}</td>
                                  <td className="py-3 pl-2 pr-3 text-right"><div className="inline-flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                    <button type="button" onClick={e => { e.stopPropagation(); addScenario(b, undefined, cy.id) }} className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-xs font-medium text-text-2 hover:bg-surface-2 hover:text-brand" title="New scenario" aria-label={`New scenario in ${cy.name}`}><Plus size={13} />New</button>
                                    <button type="button" onClick={e => { e.stopPropagation(); openCycle(b, cy.id) }} className="h-8 whitespace-nowrap rounded-md border border-brand px-3 text-xs font-semibold text-brand hover:bg-brand-soft">{rows.length ? 'Open cycle' : 'Set up forecast'}</button>
                                    <button type="button" title="Delete cycle" aria-label={`Delete cycle ${cy.name}`} onClick={e => { e.stopPropagation(); setDel({ kind: 'cycle', b, id: cy.id, name: cy.name, detail: rows.length ? `This also deletes its ${rows.length} scenario${rows.length === 1 ? '' : 's'}${nSub ? `, including ${nSub} submitted` : ''}.` : 'The cycle has no scenarios yet.' }) }} className="grid h-8 w-8 place-items-center rounded-md text-text-3 hover:bg-err-soft hover:text-err"><Trash2 size={14} /></button></div></td>
                                </tr>
                                {cOpen && rows.map(s => (
                                  <tr key={s.id} onClick={() => openScenario(b, s)} title={s.status === 'Draft' ? `Continue ${s.name}` : `View ${s.name}`} className="group cursor-pointer border-b border-border bg-surface hover:bg-brand-soft/30">
                                    <td className="relative py-2.5 pl-[84px] pr-4">
                                      <span aria-hidden className="absolute bottom-0 left-[26px] top-0 w-px bg-border-strong" />
                                      <span aria-hidden className="absolute bottom-0 left-[58px] top-0 w-px bg-border" />
                                      <span aria-hidden className="absolute left-[58px] top-1/2 h-px w-3 bg-border" />
                                      <button type="button" onClick={e => { e.stopPropagation(); openScenario(b, s) }} className="whitespace-nowrap text-left font-medium group-hover:text-brand">{s.name}</button>
                                      <span className="ml-2 font-mono text-[11px] text-text-3">{s.sub}{s.name !== s.base && ` · from ${s.base}`}</span>
                                    </td>
                                    <td className="px-3 py-2.5"><Tag tone={STATUS_TONE[s.status]}>{s.status === 'Locked' && <Lock size={10} />}{STATUS_LABEL[s.status]}</Tag></td>
                                    <td className="px-3 py-2.5 text-right font-mono">{fmtM(s.net)}</td>
                                    <td className={cx('px-3 py-2.5 text-right font-mono text-xs font-semibold', s.vsBudget >= 0 ? 'text-ok' : 'text-err')}>{s.vsBudget >= 0 ? '+' : ''}{s.vsBudget.toFixed(1)}%</td>
                                    <td className="px-3 py-2.5 text-xs text-text-2">{s.updated} · {s.by}</td>
                                    <td className="py-2.5 pl-2 pr-3 text-right">
                                      <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        <span className="inline-flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                        <button type="button" title="Duplicate" aria-label={`Duplicate ${s.name}`} onClick={() => addScenario(b, s)} className="grid h-8 w-8 place-items-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text"><Copy size={14} /></button>
                                        {s.status === 'Locked'
                                          ? <span title="The locked baseline can’t be deleted" className="grid h-8 w-8 place-items-center text-text-3/50"><Lock size={13} /></span>
                                          : <button type="button" title="Delete scenario" aria-label={`Delete ${s.name}`} onClick={() => setDel({ kind: 'scenario', b, id: s.id, name: s.name, detail: s.status === 'Submitted' ? `It was submitted to ${s.sub}. The submission record stays in the audit log.` : 'Its overrides and notes will be removed.' })} className="grid h-8 w-8 place-items-center rounded-md text-text-3 hover:bg-err-soft hover:text-err"><Trash2 size={14} /></button>}
                                        </span>
                                        <ChevronRight size={15} aria-hidden className="text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {cOpen && rows.length === 0 && (
                                  <tr className="border-b border-border"><td colSpan={6} className="py-3 pl-[84px] text-sm text-text-2">No forecast generated yet. <button type="button" onClick={() => addScenario(b, undefined, cy.id)} className="font-semibold text-brand">Set up the forecast</button></td></tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-text-3">Scenarios are pinned to the model version they were planned on. Baseline rows are the preserved feed and can’t be edited or deleted.</p>
            </div>
          )}

          {section === 'sources' && (
            <div className="rise">
              <h1 className="text-[28px] font-semibold tracking-tight">Data sources</h1>
              <p className="mt-1 text-sm text-text-2">Feeds behind your forecasts and how fresh they are.</p>
              <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
                {FEEDS.map(f => (
                  <li key={f.name} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
                    <div className="min-w-[220px] flex-1"><p className="font-medium">{f.name}</p><p className="text-xs text-text-2">{f.owner}</p></div>
                    <span className="text-xs text-text-2">Through <b className="font-mono font-medium text-text">{f.through}</b></span>
                    <Tag tone={f.tone}>{f.note}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {del && <ConfirmDelete kind={del.kind} name={del.name} brand={del.b.brand} detail={del.detail} onCancel={() => setDel(null)} onConfirm={confirmDelete} />}
        </main>
      </div>
    </div>
  )
}

export type FcSection = 'forecasts' | 'chat'
export type ForecasterProps = {
  section: FcSection; setSection: (s: FcSection) => void; notify: (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void
  insights: BoardInsight[]; setInsights: (f: (x: BoardInsight[]) => BoardInsight[]) => void
  chat: Omit<Parameters<typeof ForecasterChat>[0], 'insights' | 'setInsights' | 'notify' | 'openInsights'>
  setChatBrand: (id: string) => void
  /** Reports whether a brand workspace is open, so the app can reset its panel. */
  onWorkspace?: (open: boolean) => void
  /** App-level Charles panel the workspace drives. */
  Copilot?: ComponentType<CopilotProps>
  /** A finalised scenario is filed as the brand's submitted version (Forecast AI grounding). */
  onPublished?: (brandId: string, scenario: string) => void
}

/** Forecaster: brand home → workspace, plus Chat; insights live inside each brand. */
export default function Forecaster({ section, setSection, notify, insights, setInsights, chat, setChatBrand, onWorkspace, Copilot, onPublished }: ForecasterProps) {
  const [brand, setBrand] = useState<HomeBrand | null>(null)
  const inWs = section === 'forecasts' && !!brand
  useEffect(() => { onWorkspace?.(inWs) }, [inWs, onWorkspace])
  const ask = (id?: string) => { if (id) setChatBrand(id); setSection('chat') }
  if (section === 'chat') return <ForecasterChat {...chat} insights={insights} setInsights={setInsights} notify={notify} />
  if (!brand) return <ForecasterHome onOpen={setBrand} notify={notify} />
  return <ForecastWorkspace key={brand.id} model={brand.model} brand={brand.brand} brandId={brand.id} cycle={brand.cycle} stream={brand.stream} notify={notify}
    insights={insights} setInsights={setInsights} onAsk={ask} onHome={() => setBrand(null)} Copilot={Copilot} assistant={chat.assistant.name} onPublished={onPublished} />
}

import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import ChatShell from './chat/ChatShell'
import { forecastAnswer } from './forecaster/ForecasterChat'
import type { Mode, Persona, PromptCard, Source } from './chat/ChatShell'
import { BRANDS as FC_BRANDS } from './forecaster/workspace/Home'
import Forecaster from './forecaster/Forecaster'
import type { FcSection } from './forecaster/Forecaster'
import type { FThread } from './forecaster/ForecasterChat'
import { SEED_PUBLISHED, nextPublished } from './forecaster/published'
import type { PublishedReg } from './forecaster/published'
import { SEED_INSIGHTS } from './forecaster/workspace/insights'
import type { Insight as BoardInsight } from './forecaster/workspace/insights'
import AdminPortal from './admin/AdminPortal'
import { AgentBanner, AgentButton, AgentDemoCard } from './chat/Agent'
import type { CopilotProps } from './forecaster/workspace/agent'
import { FRAME_ID, scrollFrameTop } from './frame'
import { ChartActions } from './chart/ChartActions'
import pfizerMark from './assets/pfizer-mark-color.png'
import pfizerLogo from './assets/pfizer-logo-color.png'
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, BarChart3, Bell, Boxes, Check, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Copy, Database, FileText, GitBranch, History, Info, Layers, Loader2, Lock, LockOpen, Plus, PanelRightClose, PanelRightOpen, Maximize2, Minimize2,
  RefreshCw, RotateCcw, Search, Send, Settings2, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp, Upload, Download, Users, Workflow, X, Eye, Zap, ArrowUpRight, LogOut, Mail, GripVertical, ChevronUp, FileUp, Keyboard, Link2,
  House, MessagesSquare, LineChart, SquarePen, MessageSquare, ArrowUpRight as SendArrow, Wand2,
  Bookmark, Trash2, Pencil, HelpCircle, ListChecks, Sigma, MoreVertical, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

/* ───────────────────────── Domain data (model taxonomy, working draft v2) ───────────────────────── */

type ArchId = 'D-01' | 'D-02' | 'D-03' | 'D-04' | 'D-05' | 'D-06' | 'D-07'
type Kind = 'input' | 'assumption' | 'derived'

// Engines differ in how they account for patients as state.
const ARCHETYPES: { id: ArchId; name: string; state: string; desc: string; note: string; unit: string; ev: string[]; review?: string }[] = [
  { id: 'D-01', name: 'Prevalent-Share', state: 'A standing pool', unit: 'Patients',
    desc: 'A pool of treated patients is re-stated each month and the brand captures a share of it. No memory of how patients arrived.',
    note: 'Share is rarely one number — nested cascades up to three levels, paths from parameterized curves.',
    ev: ['A-25 Cibinqo US', 'A-26 Hemophilia', 'A-31 Velsipity spec'] },
  { id: 'D-02', name: 'Rx-Share', state: 'No patients — prescriptions', unit: 'Scripts',
    desc: 'A basket of prescriptions defines the market, market volume is trended forward, and the brand takes a share of the basket.',
    note: 'Cousin of Prevalent-Share: the unit of account changes what downstream conversion math must do.',
    ev: ['A-22 Nurtec 1912', 'A-23 LES model'] },
  { id: 'D-03', name: 'Patient-Flow', state: 'Flowing cohorts', unit: 'Cohorts over time',
    desc: 'Patients start in month zero and stay on therapy along a decay curve. Volume is start cohorts convolved with persistency.',
    note: 'Boundary cases are configurations: incidence capture (Paxlovid) and days-of-therapy share (anti-infectives).',
    ev: ['A-18 Orgovyx', 'A-17 Elranatamab US', 'A-15 Lorlatinib ex-US', 'A-27 Paxlovid', 'A-29 Anti-infectives', 'A-32 Lorbrena US'] },
  { id: 'D-04', name: 'Brand Inflow-Outflow', state: 'A standing brand stock', unit: 'Stock of patients',
    desc: 'The brand’s own patient stock, fed by a monthly start rate and drained by a monthly discontinuation probability.',
    note: 'Mathematically Patient-Flow with a memoryless discontinuation hazard — the stock version of the same physics.',
    review: 'Not in the six-family catalogue. Open question: legacy “inflow/outflow” term — may fold into Patient-Flow as its memoryless configuration.',
    ev: ['A-17 Elranatamab US', 'A-16 Ibrance family'] },
  { id: 'D-05', name: 'Market Stock-Flow', state: 'A depletable population', unit: 'Addressable stock',
    desc: 'A stock of available patients is captured each period, captured patients leave the stock, and new patients flow in.',
    note: 'The vaccine engine. Three conservation conventions share one skeleton.',
    ev: ['A-1 OneAndDone', 'A-2 PrimaryBooster', 'A-3 C. difficile', 'A-4 RSV US', 'A-5 Mening ex-US', 'A-33 Comirnaty US', 'A-34 RSV internationals', 'A-35 Prevenar Adult'] },
  { id: 'D-06', name: 'Trend / Extrapolation', state: 'An observed series', unit: 'Historical series',
    desc: 'Projects an observed history forward — as the forecast for a sub-segment, or blended into another archetype’s near term.',
    note: 'Usually a component, not the whole brand. Method, data window and granularity are always shown with the line.',
    ev: ['A-14 Braftovi+Mektovi', 'A-31 Adcetris spec'] },
  { id: 'D-07', name: 'Peak-Year Sizing', state: 'A peak-year estimate', unit: 'Peak patients & sales',
    desc: 'Sizes the peak opportunity from analogs, trial endpoints or research, across target product profile variants.',
    note: 'Screening grade by construction. Forecaster edits never re-grade it — that needs CoE reconfiguration and a new version.',
    ev: ['BD&L screening template', 'Business Assessment TPP deck'] },
]
const TREND = {
  id: 'D-06', name: 'Trend / Extrapolation',
  desc: 'Not a peer engine. Moving average, exponential smoothing or regression applied wherever a series needs extending.',
  ev: ['A-14 Braftovi+Mektovi', 'A-31 Adcetris spec'],
  uses: ['Project actuals forward', 'Blend near-term actuals into the model', 'Cover sub-segments not modeled structurally'],
  methods: ['Moving average', 'Exp. smoothing', 'Regression'],
}
type Step = { id: string; label: string; kind: Kind }
const CHAINS: Record<ArchId, Step[]> = {
  'D-01': [
    { id: 'pool', label: 'Treated pool', kind: 'input' },
    { id: 'treated', label: 'Treated rate', kind: 'assumption' },
    { id: 'share', label: 'Share cascade', kind: 'assumption' },
    { id: 'pts', label: 'Brand patients', kind: 'derived' },
    { id: 'vol', label: 'Volume (units)', kind: 'derived' },
    { id: 'net', label: 'Net sales', kind: 'derived' },
  ],
  'D-02': [
    { id: 'basket', label: 'Rx basket', kind: 'input' },
    { id: 'trend', label: 'Market trend', kind: 'assumption' },
    { id: 'share', label: 'Brand share path', kind: 'assumption' },
    { id: 'trx', label: 'Brand scripts', kind: 'derived' },
    { id: 'vol', label: 'Volume (units)', kind: 'derived' },
    { id: 'net', label: 'Net sales', kind: 'derived' },
  ],
  'D-03': [
    { id: 'elig', label: 'Eligible population', kind: 'input' },
    { id: 'starts', label: 'New starts (month 0)', kind: 'assumption' },
    { id: 'persist', label: 'Persistency decay', kind: 'assumption' },
    { id: 'onrx', label: 'Patients on therapy', kind: 'derived' },
    { id: 'vol', label: 'Volume (units)', kind: 'derived' },
    { id: 'net', label: 'Net sales', kind: 'derived' },
  ],
  'D-04': [
    { id: 'stock', label: 'Opening brand stock', kind: 'input' },
    { id: 'inflow', label: 'Monthly start rate', kind: 'assumption' },
    { id: 'outflow', label: 'Discontinuation probability', kind: 'assumption' },
    { id: 'close', label: 'Closing stock', kind: 'derived' },
    { id: 'vol', label: 'Volume (units)', kind: 'derived' },
    { id: 'net', label: 'Net sales', kind: 'derived' },
  ],
  'D-05': [
    { id: 'elig', label: 'Eligible stock', kind: 'input' },
    { id: 'cover', label: 'Coverage ceiling', kind: 'assumption' },
    { id: 'capture', label: 'Capture rate', kind: 'assumption' },
    { id: 'doses', label: 'Doses administered', kind: 'derived' },
    { id: 'net', label: 'Net sales', kind: 'derived' },
  ],
  'D-06': [
    { id: 'hist', label: 'Historical series', kind: 'input' },
    { id: 'method', label: 'Method & window', kind: 'assumption' },
    { id: 'events', label: 'Event adjustments', kind: 'assumption' },
    { id: 'proj', label: 'Projected series', kind: 'derived' },
    { id: 'net', label: 'Net sales', kind: 'derived' },
  ],
  'D-07': [
    { id: 'addr', label: 'Addressable population', kind: 'input' },
    { id: 'pshare', label: 'Peak share (analog)', kind: 'assumption' },
    { id: 'price', label: 'Peak price', kind: 'assumption' },
    { id: 'ppts', label: 'Peak patients', kind: 'derived' },
    { id: 'psales', label: 'Peak-year sales', kind: 'derived' },
  ],
}

type ModeDef = { id: string; label: string; help: string; options: string[]; def?: string; dropdown?: boolean; optional?: boolean; showIf?: (m: Record<string, string>) => boolean }
const MODES: Record<ArchId, ModeDef[]> = {
  'D-01': [
    { id: 'share', label: 'Share specification', help: 'Whether forecasters edit a curve’s drivers or the shares themselves.', options: ['Curve-generated', 'Typed', 'Calibrated', 'Theft-derived'] },
    { id: 'cascade', label: 'Nesting depth', help: 'Conditional shares: class → brand, or three levels. Totals are checked at every level.', options: ['Flat', 'Class to brand', 'Three-level'] },
  ],
  'D-02': [
    { id: 'path', label: 'Share path', help: 'How the brand’s share of the basket moves.', options: ['Curve-family menu', 'Event-anchored', 'Calibrated'] },
    { id: 'unit', label: 'Rx basis', help: 'The denominator shown on every share chart. NRx / NBRx carry mix and refill.', options: ['TRx', 'NRx', 'NBRx'] },
    { id: 'trend', label: 'Market trend', help: 'Kept separate from brand share — two controls, never one.', options: ['Method-driven', 'Event-driven'] },
  ],
  'D-03': [
    { id: 'actuals', label: 'Actuals regime', help: 'Sets the actuals boundary and the calibration source for history.', options: ['Aggregate actuals ingestion', 'Claims-level actuals', 'Pre-launch (no actuals)'] },
    { id: 'retreat', label: 'Retreatment', help: 'Whether patients who stop can re-enter therapy, and how re-entry is tracked.', options: ['Excluded', 'Allowed', 'Typed re-entry'], optional: true },
    { id: 'lot', label: 'Line-of-therapy sourcing', help: 'Where each line’s patients come from.', options: ['Independent', 'Named Feeders', 'Progression-Derived'] },
    { id: 'persist', label: 'Persistence specification', help: 'How time on therapy is described.', options: ['Forward DoT', 'Aggregate Churn', 'Cohort KM'] },
  ],
  'D-04': [
    { id: 'inflow', label: 'Start rate', help: 'How the monthly inflow is set.', options: ['Fixed monthly rate', 'Share-curve driven'] },
    { id: 'hazard', label: 'Discontinuation', help: 'Memoryless by definition of this engine.', options: ['Constant probability', 'Standard-decay persistency'] },
  ],
  'D-05': [
    { id: 'convention', label: 'Conservation', help: 'US backlog depletion and international throughput are different templates — pick per market.', options: ['Depletion (US backlog)', 'Cohort-throughput (intl.)', 'Seasonal dose-basket'] },
    { id: 'inflow', label: 'Inflow rule', help: 'How new eligible patients enter the stock.', options: ['Target-seeking', 'Rate-based'] },
    { id: 'reentry', label: 'Re-entry', help: 'Waning and boosters are time-linked chains, not a one-off percentage.', options: ['None', 'Waning', 'Booster chain'], optional: true },
    { id: 'catchup', label: 'Catch-up', help: 'Separate coverage for cohorts that missed the routine schedule.', options: ['On', 'Off'], optional: true },
  ],
  'D-06': [
    { id: 'method', label: 'Method', help: 'Locked at finalisation — forecasters can’t switch methods afterwards.', options: ['Exp. smoothing', 'Moving average', 'Regression', 'Event-anchored'] },
    { id: 'role', label: 'Role', help: 'Whether the output is the forecast, or feeds another archetype.', options: ['Actuals projection', 'Blend', 'Standalone sub-segment'] },
    { id: 'grain', label: 'Granularity', help: 'Grain of the input series and the projection.', options: ['Monthly', 'Weekly', 'Annual'] },
  ],
  'D-07': [
    { id: 'source', label: 'Parameter sourcing', help: 'Every critical assumption carries evidence and a confidence grade.', options: ['Analog-anchored', 'Trial-endpoint', 'Research'] },
    { id: 'region', label: 'Regional method', help: 'Ex-US as a multiple of US, or built country by country.', options: ['US × analog factor', 'Bottom-up'] },
    { id: 'tpp', label: 'Scenario', help: 'Target product profile variants are compared side by side.', options: ['Base TPP', 'Base + upside / downside TPP'] },
  ],
}

// Output units and time basis apply to every engine; the rest are engine-specific (taxonomy working draft).
const OUTPUT_UNITS: Record<ArchId, string[]> = {
  'D-01': ['Patients', 'Days of therapy'], 'D-02': ['Scripts (TRx)', 'Units (packs)'], 'D-03': ['Patients', 'Patient-months', 'Units (packs)'],
  'D-04': ['Patients', 'Patient-months'], 'D-05': ['Doses', 'Vaccinated patients'], 'D-06': ['Units (packs)', 'Net sales'], 'D-07': ['Peak patients', 'Peak-year sales'],
}
const modesFor = (a: ArchId): ModeDef[] => [
  { id: 'units', label: 'Output units', help: 'The unit every engine output is labelled in, so patients, doses and days of therapy never mix.', options: OUTPUT_UNITS[a] },
  ...(a === 'D-06' ? [] : [{ id: 'time', label: 'Time basis', help: 'Calculation grain of the engine. Planning outputs are splined to the submission grain.', options: a === 'D-07' ? ['Annual', 'Peak year only', 'Custom'] : ['Monthly', 'Quarterly', 'Annual', 'Custom'] }]),
  ...MODES[a],
]
const customTimeErr = (m: Record<string, string>) => {
  const n = Number(m.time_n)
  if (!m.time_n || !Number.isInteger(n) || n < 1) return 'Enter a whole number of 1 or more.'
  if (m.time_from && m.time_to && Number(m.time_to) < Number(m.time_from)) return 'End year must not be before start year.'
  return ''
}
const modeDefault = (a: ArchId, m: ModeDef) => (a === 'D-03' && m.id === 'persist') ? 'Aggregate Churn' : m.def ?? m.options[0]
const ALL: ArchId[] = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07']
type Mod = { id: string; code: string; name: string; cat: string; desc: string; ev: string[]; required?: ArchId[]; rec?: ArchId[]; data?: string; patients?: boolean; needs?: string }
const RAW: [string, string, string, string[], Partial<Mod>?][] = [
  ['Population & top-of-funnel', 'Epi funnel builder', 'Population → incidence/prevalence → staged filters → eligible; arbitrary filter steps.', ['A-15', 'A-26'], { rec: ['D-01', 'D-03'], data: 'epi', patients: true }],
  ['Population & top-of-funnel', 'Age-structured cohorts', 'Single-year-of-age stocks with aging in/out and mortality survival.', ['A-1', 'A-4'], { rec: ['D-05'], data: 'age', patients: true }],
  ['Population & top-of-funnel', 'Risk stratification', 'Risk-percentage splits of a population with per-group parameters.', ['A-3', 'A-4'], { rec: ['D-05'], patients: true }],
  ['Population & top-of-funnel', 'Testing / biomarker gates', 'Percent tested × percent positive; optionally time-dynamic testing rates.', ['A-15', 'A-16'], { patients: true }],
  ['Population & top-of-funnel', 'Analog / reference-market scaling', 'A market sized as a multiplier of another; analog curve libraries.', ['A-9', 'A-29']],
  ['Population & top-of-funnel', 'Named-feeder inflows', 'New patients arriving off a specified other brand at a realized share.', ['A-15'], { patients: true }],
  ['Population & top-of-funnel', 'External data ingestion', 'UN population, published epi, claims-derived counts, market-research surveys pulled into the funnel.', ['A-13', 'A-21', 'A-35']],
  ['Population & top-of-funnel', 'Clinical-trial absorption', 'Eligible patients netted out to competitor or own trials.', ['A-13', 'A-15'], { patients: true }],
  ['Population & top-of-funnel', 'Access & funding gates', 'Reimbursement percentages; public/private funding as a cohort dimension.', ['A-5', 'A-26']],
  ['Population & top-of-funnel', 'Catch-up flows', 'Separate coverage machinery for cohorts that missed the routine schedule.', ['A-5', 'A-4'], { rec: ['D-05'], patients: true }],
  ['Population & top-of-funnel', 'Anti-vaccination carve-out', 'Vaccine-hesitant population as an explicit stock removed from the eligible pool.', ['A-34'], { patients: true }],
  ['Segmentation & structure', 'Segment schema + replication', 'Declare segments (payer, age, country, indication); run the engine per segment.', ['A-24', 'A-1'], { required: ALL }],
  ['Segmentation & structure', 'Roll-up & reaggregation', 'Recombine forecast lines into brand totals with selection controls.', ['A-24'], { required: ALL }],
  ['Segmentation & structure', 'Channel / payer dimension', 'Per-channel capture rates inside the engine, not just reporting splits.', ['A-3', 'A-7'], { data: 'payer' }],
  ['Segmentation & structure', 'Indication grids', 'Indication × regimen instances for multi-indication assets.', ['A-21', 'A-14']],
  ['Segmentation & structure', 'Market-model wrapper', 'One epi pool, multi-asset share matrix, per-asset revenue, franchise view.', ['A-7', 'A-8']],
  ['Lines of therapy & disease states', 'Line as attribute', 'Line modulates compliance, dosing, price; pools sized independently.', ['A-17'], { patients: true }],
  ['Lines of therapy & disease states', 'Progression-derived pools', 'Next-line eligibility built from upstream drop-offs, month by month.', ['A-11', 'A-12', 'A-32'], { patients: true }],
  ['Lines of therapy & disease states', 'Relapse-lag transitions', 'Movement between disease states through a timing distribution.', ['A-13'], { patients: true }],
  ['Lines of therapy & disease states', 'Attribute-carrying cohorts', 'Upstream exposure constrains downstream eligibility (typed patient flows).', ['A-13', 'A-32'], { patients: true }],
  ['Lines of therapy & disease states', 'Retreatment policy', 'Allowed, excluded, or typed re-entry to therapy as a configuration.', ['A-12', 'A-15'], { rec: ['D-03'], patients: true }],
  ['Lines of therapy & disease states', 'Disease-state branch trees', 'Surgical or chemo eligibility branches run as parallel instances.', ['A-12'], { patients: true }],
  ['Share machinery', 'Nested share cascades', 'Conditional shares to arbitrary depth: class → subclass → brand.', ['A-22', 'A-26'], { rec: ['D-01'] }],
  ['Share machinery', 'Share-curve generators', 'Start, peak, launch date, shape, time-to-peak, erosion — parameterized paths.', ['A-15', 'A-11'], { required: ['D-01', 'D-02'], rec: ['D-03', 'D-04'] }],
  ['Share machinery', 'Curve family libraries', 'Named selectable forms shared across a model.', ['A-22', 'A-14'], { required: ['D-02'] }],
  ['Share machinery', 'Cross-product interaction (3 tiers)', 'Cannibalization scalar → event-driven re-pathing → full share-theft matrix from named incumbents.', ['A-27', 'A-7', 'A-11', 'A-20', 'A-35']],
  ['Share machinery', 'Order-of-entry logic', 'Competitor sequencing drives share allocation.', ['A-4', 'A-21']],
  ['Share machinery', 'Custom uptake backends', 'User-supplied curves overriding the libraries.', ['A-20', 'A-21']],
  ['Persistence, dosing & regimen', 'Persistency grids', 'Cohort-by-month survival on therapy, with drop-off configuration.', ['A-18', 'A-17'], { required: ['D-03'], data: 'persist', patients: true }],
  ['Persistence, dosing & regimen', 'Days-of-therapy calculators', 'Manual, automatic, data-derived, label-adjusted DOT.', ['A-19', 'A-25'], { rec: ['D-03'] }],
  ['Persistence, dosing & regimen', 'Compliance matrices', 'By line of therapy and by SKU, as separate axes.', ['A-17'], { rec: ['D-01', 'D-04'] }],
  ['Persistence, dosing & regimen', 'Dosing regimen math', 'Cycles, cycle length, dosage days, titration schedules.', ['A-17', 'A-12'], { rec: ['D-03'] }],
  ['Persistence, dosing & regimen', 'Dose-sequence chains', 'First through Nth dose with inter-dose lag and per-dose compliance.', ['A-4', 'A-6'], { required: ['D-05'], patients: true }],
  ['Persistence, dosing & regimen', 'Booster due-pool queues', 'Newly-due plus backlog, drawn down by capture and compliance, remainder carried.', ['A-2'], { rec: ['D-05'], patients: true, needs: 'Dose-sequence chains' }],
  ['Persistence, dosing & regimen', 'Waning-immunity re-entry', 'Vaccinated patients re-enter the eligible pool when protection lapses.', ['A-4'], { patients: true }],
  ['Persistence, dosing & regimen', 'Free-drug / paid phasing', 'Patient-assistance volume as an explicit accounting flow.', ['A-17', 'A-16']],
  ['Cross-product & franchise', 'Franchise succession flows', 'Predecessor-to-successor patient migration: feeder brands, withdrawal with recapture, platform shifts.', ['A-20', 'A-15', 'A-10'], { patients: true }],
  ['Cross-product & franchise', 'Franchise incrementality', 'A launch’s revenue net of cannibalizing the firm’s own portfolio.', ['A-8']],
  ['Cross-product & franchise', 'Franchise rollups', 'Multi-asset net-revenue consolidation.', ['A-27', 'A-8']],
  ['Cross-product & franchise', 'Warehousing / bolus release', 'Patients parked on holding therapy, released at an approval event.', ['A-13'], { patients: true }],
  ['Cross-product & franchise', 'Combination-asset logic', 'Assets-in-combination counts, combo pricing and dosing, mono/combo instances.', ['A-12', 'A-17']],
  ['Events, LOE & scenarios', 'Dated event layers', 'Event registry with parameterized share or volume consequences — the most divergently implemented module.', ['A-9', 'A-14', 'A-22', 'A-32', 'A-35'], { rec: ['D-01', 'D-02'] }],
  ['Events, LOE & scenarios', 'LOE erosion', 'Erosion type, target share, time-to-target, generic entry.', ['A-15', 'A-12'], { rec: ['D-01', 'D-02', 'D-03', 'D-04'] }],
  ['Events, LOE & scenarios', 'Scenario management', 'Parallel scenario sheets, saved state loaded on demand, or stored multiplier vectors.', ['A-13', 'A-18', 'A-16'], { required: ALL }],
  ['Events, LOE & scenarios', 'Scenario comparison reporting', 'Side-by-side monthly, annual, and graphical deltas.', ['A-24', 'A-27']],
  ['Actuals, calibration & reconciliation', 'Actuals boundary management', 'The actuals / override / final / splined row pattern; last-actual-month per metric.', ['A-27', 'A-25'], { required: ALL, data: 'actuals' }],
  ['Actuals, calibration & reconciliation', 'Claims ingestion & NPS derivation', 'Claims → new-patient starts → diagnostics, with projection.', ['A-13', 'A-14'], { rec: ['D-03'], data: 'claims', patients: true }],
  ['Actuals, calibration & reconciliation', 'Data-source normalization', 'Factored-to-unfactored scalars; source-variance tracking.', ['A-25'], { rec: ['D-02'] }],
  ['Actuals, calibration & reconciliation', 'Calibration backends', 'Fitting shares or parameters to actuals; budget-calibrated conventions.', ['A-18', 'A-19', 'A-27'], { rec: ['D-01', 'D-02', 'D-03', 'D-04'] }],
  ['Actuals, calibration & reconciliation', 'Below-the-line set', 'Unexplained demand, HQ adjustments, inventory change, prior-period adjustments.', ['A-27', 'A-25']],
  ['Actuals, calibration & reconciliation', 'Selling-day adjustments', 'Trading-day calendar correction.', ['A-27']],
  ['Actuals, calibration & reconciliation', 'Shock overlays', 'Pandemic-style disruption layers on rates and starts.', ['A-3', 'A-13']],
  ['Actuals, calibration & reconciliation', 'Stock-reconciliation bridges', 'A conservation ledger proving patients balance year over year.', ['A-4'], { required: ['D-05'], patients: true }],
  ['Actuals, calibration & reconciliation', 'Seasonality decomposition', 'Seasonal split and reapplication around trend.', ['A-31']],
  ['Actuals, calibration & reconciliation', 'Annual↔monthly splining', 'Spline-based translation between planning and operating granularity.', ['A-30', 'A-18']],
  ['Conversion, financial & integration', 'Volume conversion chains', 'Patients → scripts or doses → units, per SKU and pack.', ['A-11', 'A-25'], { rec: ALL }],
  ['Conversion, financial & integration', 'Gross-to-net engines', 'Multiplicative factors, stacked discounts, one gross-to-net truth.', ['A-4', 'A-22', 'A-33'], { required: ALL, data: 'g2n' }],
  ['Conversion, financial & integration', 'Price & FX', 'Local-currency pricing, erosion, multi-country exchange.', ['A-5', 'A-28'], { required: ALL, data: 'price' }],
  ['Conversion, financial & integration', 'Submission & sync machinery', 'MOSAIC sync, LRF output formats, guidance comparison, validation gates, finance handoffs.', ['A-28', 'A-12'], { required: ALL }],
  ['Conversion, financial & integration', 'Presentation export', 'Deck generation from model state.', ['A-5', 'A-26']],
  ['Conversion, financial & integration', 'Porting & migration suites', 'Tooling to move a model between template versions.', ['A-16']],
  ['Conversion, financial & integration', 'Versioning & documentation', 'State persistence, data dictionaries, in-model FAQs and question logs.', ['A-4', 'A-30', 'A-37'], { required: ALL }],
  ['Conversion, financial & integration', 'Parallel trade', 'EU parallel-import volume and revenue adjustment.', ['A-37']],
  ['Conversion, financial & integration', 'Automated report generation', 'In-model report builder producing formatted outputs from model state.', ['A-32']],
  ['Share machinery', 'Competitor & market-share tracking', 'Tracks named competitor products and market share from script data, feeding share-based forecasts.', ['A-21', 'A-31']],
]
const MODULES: Mod[] = RAW.map(([cat, name, desc, ev, extra], i) => ({ id: `m${i + 1}`, code: String(i + 1).padStart(2, '0'), cat, name, desc, ev, ...extra }))
const CATS = ['All', ...Array.from(new Set(MODULES.map(m => m.cat)))]
// Vaccine-only machinery, and patient-carrying modules can't attach to Rx-Share (no patient state).
const VACCINE_ONLY = new Set(['Dose-sequence chains', 'Booster due-pool queues', 'Waning-immunity re-entry', 'Anti-vaccination carve-out', 'Stock-reconciliation bridges'])
const validFor = (m: Mod, a: ArchId) => !(a === 'D-02' && m.patients) && (!VACCINE_ONLY.has(m.name) || a === 'D-05')
const byName = (n: string) => MODULES.find(m => m.name === n)!

type DataInput = { id: string; name: string; feeds: string; suggested: string }
const BASE_INPUTS: Record<ArchId, DataInput[]> = {
  'D-01': [{ id: 'pool', name: 'Treated patient pool', feeds: 'Treated pool', suggested: 'IQVIA LAAD claims' }],
  'D-02': [{ id: 'basket', name: 'Prescription basket (TRx / NRx)', feeds: 'Rx basket', suggested: 'IQVIA NPA weekly' }],
  'D-03': [{ id: 'elig', name: 'Eligible population', feeds: 'Eligible population', suggested: 'Internal Epi Library' }],
  'D-04': [{ id: 'stock', name: 'Opening brand patient stock', feeds: 'Opening brand stock', suggested: 'Symphony PatientSource' }],
  'D-05': [{ id: 'eligstock', name: 'Unvaccinated eligible stock', feeds: 'Eligible stock', suggested: 'CDC NIS-Teen / Adult' }],
  'D-06': [{ id: 'hist', name: 'Historical series (units, by grain)', feeds: 'Historical series', suggested: 'SAP actuals (net sales)' }],
  'D-07': [{ id: 'addr', name: 'Addressable population (epi estimate)', feeds: 'Addressable population', suggested: 'Internal Epi Library' }],
}
const MODULE_INPUTS: Record<string, DataInput> = {
  epi: { id: 'epi', name: 'Incidence / prevalence & filter rates', feeds: 'Epi funnel builder', suggested: 'Internal Epi Library' },
  age: { id: 'age', name: 'Single-year-of-age population', feeds: 'Age-structured cohorts', suggested: 'UN population (WPP)' },
  payer: { id: 'payer', name: 'Per-channel capture rates', feeds: 'Channel / payer dimension', suggested: 'IQVIA LAAD claims' },
  persist: { id: 'persist', name: 'Cohort-by-month persistency', feeds: 'Persistency grids', suggested: 'Komodo Health' },
  claims: { id: 'claims', name: 'Patient-level claims', feeds: 'Claims ingestion & NPS derivation', suggested: 'IQVIA LAAD claims' },
  price: { id: 'price', name: 'Local-currency price & FX', feeds: 'Price & FX', suggested: 'Internal Pricing (Model N)' },
  g2n: { id: 'g2n', name: 'Discount & rebate factors', feeds: 'Gross-to-net engines', suggested: 'SAP actuals (net sales)' },
  actuals: { id: 'actuals', name: 'Actuals by metric (last-actual-month)', feeds: 'Actuals boundary management', suggested: 'SAP actuals (net sales)' },
}
const OWNERS = ['M. Okafor (Epi)', 'R. Lindqvist (Data)', 'S. Patel (Pricing)', 'J. Romero (Finance)']
const FORECASTERS = ['Michelle Tran', 'David Osei', 'Priya Raman', 'Tom Becker']

type Assumption = { id: string; name: string; unit: string; base: number; min: number; max: number; open?: boolean }
const COMMON_ASSUMPTIONS: Assumption[] = [
  { id: 'price', name: 'Annual price change', unit: '%', base: 4.5, min: 0, max: 7 },
  { id: 'g2n', name: 'Gross-to-net discount', unit: '%', base: 38, min: 32, max: 44 },
  { id: 'loe', name: 'LOE target share', unit: '% of pre-LOE', base: 20, min: 10, max: 35 },
]
const ENGINE_ASSUMPTIONS: Record<ArchId, Assumption[]> = {
  'D-01': [
    { id: 'treated', name: 'Treated rate', unit: '%', base: 46, min: 40, max: 52 },
    { id: 'peak', name: 'Peak brand share', unit: '%', base: 18, min: 12, max: 24, open: true },
    { id: 'ttp', name: 'Time to peak', unit: 'months', base: 36, min: 24, max: 48, open: true },
  ],
  'D-02': [
    { id: 'mtrend', name: 'Market Rx trend', unit: '% / yr', base: 3.2, min: 0, max: 6, open: true },
    { id: 'peak', name: 'Peak share of basket', unit: '%', base: 14, min: 9, max: 20, open: true },
    { id: 'ttp', name: 'Time to peak', unit: 'months', base: 30, min: 18, max: 42, open: true },
  ],
  'D-03': [
    { id: 'starts', name: 'New starts / month', unit: 'patients', base: 420, min: 300, max: 600, open: true },
    { id: 'persist12', name: '12-month persistency', unit: '%', base: 62, min: 55, max: 70, open: true },
    { id: 'compliance', name: 'Compliance', unit: '%', base: 84, min: 75, max: 92 },
  ],
  'D-04': [
    { id: 'inflow', name: 'Monthly start rate', unit: 'patients', base: 380, min: 280, max: 500, open: true },
    { id: 'disc', name: 'Discontinuation probability', unit: '% / month', base: 4.2, min: 3, max: 6, open: true },
    { id: 'compliance', name: 'Compliance', unit: '%', base: 84, min: 75, max: 92 },
  ],
  'D-05': [
    { id: 'ceiling', name: 'Coverage ceiling', unit: '%', base: 72, min: 60, max: 80 },
    { id: 'capture', name: 'Capture rate', unit: '% / month', base: 9, min: 5, max: 11, open: true },
    { id: 'boost', name: 'Per-dose compliance', unit: '%', base: 58, min: 45, max: 70, open: true },
  ],
  'D-06': [
    { id: 'window', name: 'Data window', unit: 'months', base: 24, min: 12, max: 36 },
    { id: 'evadj', name: 'Event adjustment', unit: '%', base: 0, min: -15, max: 15, open: true },
  ],
  'D-07': [
    { id: 'pshare', name: 'Peak share', unit: '%', base: 12, min: 6, max: 20, open: true },
    { id: 'ppeak', name: 'Years to peak', unit: 'years', base: 5, min: 3, max: 8, open: true },
    { id: 'analog', name: 'Ex-US analog factor', unit: '× US', base: 0.6, min: 0.4, max: 0.9 },
  ],
}
const assumptionsFor = (a: ArchId | null) => a ? [...ENGINE_ASSUMPTIONS[a], ...COMMON_ASSUMPTIONS] : []
const COMMON_FEEDS: Record<string, string> = { price: 'Price & FX', g2n: 'Gross-to-net engines', loe: 'LOE erosion' }
const assumptionMeta = (a: Assumption, arch: ArchId) => COMMON_FEEDS[a.id]
  ? { cat: 'Commercial & financial', feeds: COMMON_FEEDS[a.id] }
  : { cat: 'Engine', feeds: `${archName(arch)} engine` }

/* ───────────────────────── Configurator structure (alignment feedback) ───────────────────────── */

const STAGES = [
  { id: 1, title: 'Model setup', short: 'Setup', sub: 'Subject + streams', icon: Settings2, desc: 'Name the model and define its revenue streams.' },
  { id: 2, title: 'Archetype', short: 'Archetype', sub: 'Model foundation', icon: Layers, desc: 'Choose the forecasting engine for each stream.' },
  { id: 3, title: 'Modes', short: 'Modes', sub: 'Archetype-specific options', icon: SlidersHorizontal, desc: 'Set the options for each stream’s archetype.' },
  { id: 4, title: 'Module map', short: 'Module map', sub: 'Build the model structure', icon: Workflow, desc: 'Attach modules to build each stream’s calculation.' },
  { id: 5, title: 'Data configuration', short: 'Data', sub: 'Sources · pathways · exposure', icon: Database, desc: 'Choose where each input comes from and who can edit it.' },
  { id: 6, title: 'Review configuration', short: 'Review', sub: 'Structure · inputs · issues', icon: CheckCircle2, desc: 'Check the whole configuration before you finalise.' },
  { id: 7, title: 'Finalise setup', short: 'Finalise', sub: 'Validate · hand off', icon: Send, desc: 'Validate, save a version and release it to forecasters.' },
] as const
const LAST = STAGES.length
const REVIEW = LAST - 1

const ARCH_DETAIL: Record<ArchId, { question: string; uses: string[]; status: 'Certified' | 'Under review'; limit: string; audience: string; ceiling?: string }> = {
  'D-01': { audience: 'Brand forecasters · patient-share', question: 'What share of an existing treated pool will the brand capture?', uses: ['Chronic, established markets', 'Entry into a known treated pool'], status: 'Certified', limit: 'No memory of how patients arrived — stock and flow are implied through persistency.' },
  'D-02': { audience: 'Finance · Rx / alliance conventions', question: 'How many scripts will the brand win in a trended Rx basket?', uses: ['Retail and primary-care brands', 'Episodic or acute therapies'], status: 'Certified', limit: 'Carries no patients — patient-based modules are unavailable.' },
  'D-03': { audience: 'Brand forecasters · oncology & specialty', question: 'How many patients start, and how long do they stay?', uses: ['Oncology and specialty', 'Single-course antivirals (incidence capture)'], status: 'Certified', limit: 'Needs persistency by cohort and month to be credible.' },
  'D-04': { audience: 'Legacy specialty models', question: 'How does the brand’s own patient stock grow and drain?', uses: ['Brands with stable monthly start and drop-off rates'], status: 'Under review', limit: 'Under review — may fold into Patient-Flow. Not allowed at Valuation tier.' },
  'D-05': { audience: 'Vaccine forecasters', question: 'How fast can we deplete the eligible, unprotected population?', uses: ['Vaccines — routine, catch-up, seasonal', 'Booster and multi-dose schedules'], status: 'Certified', limit: 'Conservation convention must match the vaccine’s immunity duration.' },
  'D-06': { audience: 'Data science · component use', question: 'Where does the observed series go if nothing structural changes?', uses: ['Actuals projection', 'Sub-segments not modeled structurally'], status: 'Certified', limit: 'A component — don’t let it stand in for the whole brand forecast.' },
  'D-07': { audience: 'Business Assessment · BD&L', question: 'How big could this asset be in its peak year?', uses: ['Early assessment', 'TPP variant comparison'], status: 'Certified', ceiling: 'Screening', limit: 'Screening grade only. Outputs are ranges, never valuation-grade.' },
}
const ENGINES: Record<ArchId, string[]> = {
  'D-01': ['v3.2 · certified', 'v3.3 · beta'], 'D-02': ['v2.6 · certified', 'v2.7 · beta'], 'D-03': ['v4.1 · certified', 'v4.2 · beta'],
  'D-04': ['v1.4 · under review'], 'D-05': ['v2.0 · certified', 'v2.1 · beta'], 'D-06': ['v1.8 · certified'], 'D-07': ['v1.2 · certified'],
}
const GOVERNED = new Set(['Custom uptake backends', 'Calibration backends', 'Below-the-line set', 'Porting & migration suites', 'Parallel trade'])
const BUCKETS = CATS.slice(1)
const FALLBACKS = ['Block forecast run', 'Carry last good value', 'Manual upload with reason']
const ASSUMPTION_SOURCES = ['Market research (ATU 2026)', 'Analog benchmark', 'KOL advisory panel', 'Clinical trial readout', 'Brand team judgement']
const ASSUMPTION_OWNERS = ['Brand forecaster', 'Brand lead', 'CoE analyst', 'Market Access', 'Pricing', 'API supply', 'Compliance', 'Gross-to-Net']
/** Named contacts per business function; assignees are notified when rows are assigned to them. */
const OWNER_CONTACT: Record<string, string> = { 'Brand forecaster': 'Michelle Tran', 'Brand lead': 'A. Nguyen', 'CoE analyst': 'K. Brandt', 'Market Access': 'E. Walsh', 'Pricing': 'S. Patel', 'API supply': 'H. Ito', 'Compliance': 'C. Duarte', 'Gross-to-Net': 'J. Romero' }
const PEOPLE = ['K. Brandt (CoE)', 'A. Nguyen (Brand lead)', 'S. Patel (Pricing)', 'E. Walsh (Market Access)', 'J. Romero (Finance)', 'M. Okafor (Epi)', 'Michelle Tran (Forecaster)']
const ROLES: { r: Role; d: string }[] = [
  { r: 'Creator', d: 'Created the model, invites people, finalises setup.' },
  { r: 'Editor', d: 'Edits every step of this model only.' },
  { r: 'Viewer', d: 'Read-only access to this model.' },
]
const FIELD_LABEL: Record<string, string> = { brand: 'brand', asset: 'asset', therapyArea: 'therapy area', lifecycle: 'lifecycle', inds: 'revenue streams', market: 'geography', cycle: 'planning cycle', forecasters: 'forecasters', visibility: 'visibility', viewers: 'viewers', release: 'release type', geoRestrict: 'geography restrictions', team: 'collaborators', bindings: 'data configuration', baseline: 'baseline', slices: 'slices', notes: 'notes', modules: 'modules', perms: 'Forecaster inputs', modes: 'modes', arch: 'archetype', name: 'stream name', dim: 'dimension' }
const ME = 'J. Andersen'

/* ───────────────────────── Model library data ───────────────────────── */

type MStatus = 'Draft' | 'Finalised' | 'Published'
type Fresh = 'Current' | 'Delayed' | 'Partial' | 'Missing'
type Version = { v: string; date: string; by: string; note: string; scenarios: number }
type ModelRow = {
  id: string; brand: string; inds: { name: string; arch: string }[]; market: string; cycle: string; version: string
  status: MStatus; fresh: Fresh; issues: number; updated: string; by: string; step?: number; restricted?: boolean; versions: Version[]
  fx?: FixtureId; tag?: string; name?: string; diff?: { kind: '+' | '−' | '~'; text: string }[]
}
const SEED_MODELS: ModelRow[] = [
  { id: 'a', brand: 'Velsipity', inds: [{ name: 'Ulcerative colitis', arch: '' }], market: 'US', cycle: 'OP 2027', version: 'v1.0 draft', status: 'Draft', fresh: 'Current', issues: 3, updated: 'Today, 09:12', by: 'You', step: 2, versions: [] },
  { id: 'd', brand: 'Abrysvo', inds: [{ name: 'RSV — older adults', arch: 'Market Stock-Flow' }], market: 'US', cycle: 'OP 2027', version: 'v1.3 draft', status: 'Draft', fresh: 'Partial', issues: 2, updated: 'Sep 24', by: 'You', step: 5,
    versions: [{ v: 'v1.2', date: 'Jun 12', by: 'You', note: 'Seasonal dose-basket for 2026/27.', scenarios: 9 }] },
  { id: 'f', brand: 'Elrexfio', inds: [{ name: 'Multiple myeloma 4L+', arch: 'Patient-Flow' }, { name: 'Multiple myeloma 2L', arch: 'Brand Inflow-Outflow' }], market: 'US', cycle: 'OP 2027', version: 'v2.0', status: 'Published', fresh: 'Current', issues: 0, updated: 'Oct 5', by: 'K. Brandt',
    versions: [{ v: 'v1.1', date: 'Mar 3', by: 'K. Brandt', note: 'Free-drug phasing added.', scenarios: 6 }] },
  { id: 'b', brand: 'Cibinqo', inds: [{ name: 'Atopic dermatitis', arch: 'Prevalent-Share' }], market: 'US', cycle: 'OP 2027', version: 'v2.3', status: 'Published', fresh: 'Current', issues: 0, updated: 'Oct 2', by: 'A. Nguyen',
    versions: [{ v: 'v2.3', date: 'Oct 2', by: 'A. Nguyen', note: 'Share cascade re-based on Q3 claims.', scenarios: 14 }, { v: 'v2.2', date: 'Jun 18', by: 'A. Nguyen', note: 'LOE erosion added.', scenarios: 22 }, { v: 'v2.1', date: 'Jan 9', by: 'You', note: 'Initial OP 2026 build.', scenarios: 31 }] },
  { id: 'c', brand: 'Nurtec ODT', inds: [{ name: 'Migraine — acute', arch: 'Rx-Share' }, { name: 'Migraine — preventive', arch: 'Rx-Share' }], market: 'US', cycle: 'Q4 2026 Re-forecast', version: 'v4.1', status: 'Published', fresh: 'Delayed', issues: 0, updated: 'Sep 28', by: 'K. Brandt',
    versions: [{ v: 'v4.1', date: 'Sep 28', by: 'K. Brandt', note: 'S-shaped curve family for preventive.', scenarios: 11 }, { v: 'v4.0', date: 'May 2', by: 'K. Brandt', note: 'Split into two indications.', scenarios: 18 }] },
  { id: 'e', brand: 'Lorbrena', inds: [{ name: 'ALK+ NSCLC 1L', arch: 'Patient-Flow' }, { name: 'ALK+ NSCLC 2L+', arch: 'Patient-Flow' }], market: 'EU5', cycle: 'LRP 2027–2036', version: 'v3.0', status: 'Published', fresh: 'Current', issues: 0, updated: 'Sep 19', by: 'L. Moreau',
    versions: [{ v: 'v3.0', date: 'Sep 19', by: 'L. Moreau', note: 'Progression-derived 2L pool.', scenarios: 8 }] },
  { id: 'x', brand: 'Project Halo', inds: [{ name: 'Restricted', arch: '' }], market: 'Global', cycle: 'BD screening', version: '—', status: 'Draft', fresh: 'Current', issues: 0, updated: '—', by: 'BD team', restricted: true, versions: [] },
]
const ACTIVITY = [
  { who: 'K. Brandt', what: 'published Elrexfio v2.0 · 6 scenarios re-pinned', when: 'Oct 5, 16:40', icon: CheckCircle2 },
  { who: 'You', what: 'resumed Abrysvo v1.3 draft (Step 5)', when: 'Oct 4, 11:02', icon: Clock },
  { who: 'System', what: 'IQVIA NPA weekly feed is 9 days late (Nurtec ODT)', when: 'Oct 3, 06:00', icon: Clock },
  { who: 'A. Nguyen', what: 'published Cibinqo v2.3 · 14 scenarios re-pinned', when: 'Oct 2, 09:30', icon: CheckCircle2 },
  { who: 'You', what: 'created Velsipity draft from blank', when: 'Oct 1, 14:18', icon: Plus },
]
const CYCLES = [{ name: 'OP 2027', due: 'Nov 14' }, { name: 'Q4 2026 Re-forecast', due: 'Oct 31' }, { name: 'LRP 2027–2036', due: 'Feb 6' }]

/* ───────────────────────── Edge-case fixtures (Help → Edge-case fixtures) ───────────────────────── */

type FixtureId = 'prelaunch' | 'loe' | 'retired' | 'locked' | 'frozen' | 'overlap' | 'diff' | 'integrity' | 'belowHistory' | 'vaccineCeiling' | 'bigSlices' | 'emptySlice' | 'fxMix'
const fxRow = (id: string, fx: FixtureId, tag: string, brand: string, inds: [string, string][], extra: Partial<ModelRow> = {}): ModelRow => ({
  id, fx, tag, brand, inds: inds.map(([name, arch]) => ({ name, arch })), market: 'US', cycle: 'OP 2027', version: 'v1.0 draft', status: 'Draft',
  fresh: 'Current', issues: 1, updated: 'Today', by: 'You', versions: [], ...extra,
})
const FIXTURE_MODELS: ModelRow[] = [
  fxRow('f1', 'prelaunch', 'Pre-launch', 'Hympavzi', [['Hemophilia A/B', 'Prevalent-Share']], { fresh: 'Missing' }),
  fxRow('f2', 'loe', 'LOE in 2 months', 'Xeljanz', [['Rheumatoid arthritis', 'Prevalent-Share']], { version: 'v5.2', status: 'Published', issues: 0, versions: [{ v: 'v5.2', date: 'Aug 1', by: 'A. Nguyen', note: 'Pre-LOE baseline.', scenarios: 12 }] }),
  fxRow('f3', 'retired', 'Engine retiring', 'Ibrance', [['HR+ breast cancer', 'Brand Inflow-Outflow']], { version: 'v6.0', status: 'Published', issues: 0, by: 'L. Moreau', versions: [{ v: 'v6.0', date: 'Apr 4', by: 'L. Moreau', note: 'Runs on D-04 v1.4.', scenarios: 19 }] }),
  fxRow('f4', 'locked', 'K. Brandt editing', 'Abrysvo', [['RSV — maternal', 'Market Stock-Flow']], { version: 'v1.4 draft', by: 'K. Brandt' }),
  fxRow('f5', 'frozen', 'Cycle frozen', 'Comirnaty', [['COVID-19 — 2026/27 season', 'Market Stock-Flow']], { cycle: 'Q4 2026 Re-forecast' }),
  fxRow('f6', 'overlap', 'Shared patients', 'Eliquis', [['Atrial fibrillation', 'Prevalent-Share'], ['Venous thromboembolism', 'Patient-Flow']], { market: 'EU5' }),
  fxRow('f8', 'diff', 'Diff vs v2.3', 'Cibinqo', [['Atopic dermatitis', 'Prevalent-Share']], { version: 'v2.4 draft', issues: 0,
    versions: [{ v: 'v2.3', date: 'Oct 2', by: 'A. Nguyen', note: 'Share cascade re-based on Q3 claims.', scenarios: 14 }],
    diff: [{ kind: '+', text: 'Module: Adherence & compliance' }, { kind: '~', text: 'Peak brand share band 12–24% → 10–26%' }, { kind: '~', text: 'Treated patient pool: IQVIA LAAD → Symphony PatientSource' }] }),
  fxRow('f9', 'integrity', 'Share > 100%', 'Vyndaqel', [['ATTR-CM', 'Prevalent-Share']]),
  fxRow('f10', 'belowHistory', 'Band vs actuals', 'Lorbrena', [['ALK+ NSCLC 1L', 'Patient-Flow']]),
  fxRow('f11', 'vaccineCeiling', 'Ceiling reached', 'Prevnar 20', [['Adult pneumococcal', 'Market Stock-Flow']]),
  fxRow('f12', 'bigSlices', '32k combinations', 'Zavzpret', [['Migraine — acute', 'Rx-Share']]),
  fxRow('f14', 'emptySlice', 'Zero-patient value', 'Litfulo', [['Alopecia areata', 'Prevalent-Share']]),
  fxRow('f15', 'fxMix', 'FX not set', 'Bavencio', [['Urothelial carcinoma 1L maint.', 'Patient-Flow']], { market: 'EU5' }),
]
const FIXTURE_ACTIVITY = [
  { who: 'System', what: 'IQVIA restated Jan–Mar 2026 history for Nurtec ODT (−4%) · 3 inputs affected', when: 'Today, 06:00', icon: RefreshCw },
  { who: 'Platform', what: 'engine D-04 v1.4 retires Nov 30 · 2 models affected', when: 'Today, 08:15', icon: AlertTriangle },
  { who: 'K. Brandt', what: 'requested control of the Abrysvo maternal draft', when: 'Today, 09:40', icon: Users },
]
const RESTRICTED_RE = /halo|restricted|bd pipeline/i

/* ───────────────────────── Small UI primitives ───────────────────────── */

/** AI action shown next to errors. Applies Charles's safe fixes for the affected steps. */
function FixForMe({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-brand/30 bg-brand-soft px-3 text-[13px] font-semibold text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', className)}>
      <Sparkles size={14} />Fix for me
    </button>
  )
}

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }

function Btn({ children, variant = 'primary', size = 'md', disabled, onClick, icon, title, className }: {
  children?: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; disabled?: boolean
  onClick?: () => void; icon?: ReactNode; title?: string; className?: string
}) {
  return (
    <button
      type="button" title={title} disabled={disabled} onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark disabled:bg-border-strong',
        variant === 'secondary' && 'border border-border bg-surface text-text shadow-[0_1px_1px_rgba(16,24,40,0.04)] hover:bg-surface-2 disabled:text-text-3',
        variant === 'ghost' && 'text-text-2 hover:bg-surface-2 hover:text-text disabled:text-text-3',
        variant === 'danger' && 'text-err hover:bg-err-soft',
        className,
      )}
    >
      {icon}{children}
    </button>
  )
}

function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'err'; children: ReactNode }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-medium',
      tone === 'neutral' && 'bg-surface-2 text-text-2',
      tone === 'brand' && 'bg-brand-soft text-brand',
      tone === 'ok' && 'bg-ok-soft text-ok',
      tone === 'warn' && 'bg-warn-soft text-warn',
      tone === 'err' && 'bg-err-soft text-err',
    )}>{children}</span>
  )
}

/** Which section and field Charles is filling right now (drives the gradient highlight). */
type AgentState = { section: string | null; field: string | null }
const AgentCtx = createContext<AgentState>({ section: null, field: null })

/** Wraps a card in an animated gradient ring while Charles works inside it. */
function AgentSection({ id, children, pad }: { id: string; children: ReactNode; pad?: boolean }) {
  const on = useContext(AgentCtx).section === id
  // Same element tree whether or not Charles is working here, so the step keeps its local state.
  return (
    <div className={cx(on && 'agent-section')} data-agent-section={id}>
      {on && <span className="agent-bg absolute -top-3 right-4 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"><Loader2 size={11} className="animate-spin" />{ASSISTANT} is filling this section</span>}
      {pad ? <div className={cx('space-y-6', on && 'rounded-[10px] bg-background p-4')}>{children}</div> : children}
    </div>
  )
}

function Field({ label, hint, error, children, required, ai, className, agent }: { label: string; hint?: string; error?: string; children: ReactNode; required?: boolean; ai?: boolean; className?: string; agent?: string }) {
  const now = useContext(AgentCtx).field
  const live = !!agent && now === agent
  return (
    <label className={cx('block min-w-0', live && 'agent-field', className)} data-agent={agent}>
      <span className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-text">
        <span>{label}{required && <span className="text-err"> *</span>}</span>
        {live ? <span className="inline-flex items-center gap-1 rounded bg-[#2f9e73]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0f5a43]"><Loader2 size={10} className="animate-spin" />{ASSISTANT} is typing</span>
          : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs text-err"><AlertCircle size={12} />{error}</span>
      ) : hint ? <span className="mt-1.5 block text-xs text-text-3">{hint}</span> : null}
    </label>
  )
}

const inputCls = (err?: boolean) => cx(
  'h-9 w-full rounded-lg border bg-surface px-3 text-[13px] text-text shadow-[0_1px_1px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-text-3 focus:border-brand focus:ring-2 focus:ring-brand/15',
  err ? 'border-err' : 'border-border',
)

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-border-strong bg-surface p-0.5" role="radiogroup">
      {options.map(o => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cx('rounded px-3 py-1.5 text-[13px] font-medium transition-colors', value === o ? 'bg-text text-white' : 'text-text-2 hover:text-text')}>
          {o}
        </button>
      ))}
    </div>
  )
}

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-brand' : 'bg-border-strong')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

function Banner({ tone, title, children, action }: { tone: 'info' | 'ok' | 'warn' | 'err'; title: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'err' ? AlertCircle : tone === 'warn' ? AlertTriangle : Info
  return (
    <div role={tone === 'err' ? 'alert' : 'status'} className={cx('rise flex gap-3 rounded-lg border p-3.5',
      tone === 'info' && 'border-brand/20 bg-brand-soft/60', tone === 'ok' && 'border-ok/25 bg-ok-soft',
      tone === 'warn' && 'border-warn/25 bg-warn-soft', tone === 'err' && 'border-err/25 bg-err-soft')}>
      <Icon size={18} className={cx('mt-px shrink-0', tone === 'info' && 'text-brand', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'err' && 'text-err')} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-text">{title}</p>
        {children && <div className="mt-0.5 text-text-2">{children}</div>}
      </div>
      {action}
    </div>
  )
}

function Card({ title, sub, right, children, className }: { title?: ReactNode; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-1 pt-4">
          <div className="min-w-0 flex-1"><h3 className="text-[14px] font-semibold text-text">{title}</h3>{sub && <p className="mt-0.5 text-[12.5px] text-text-3">{sub}</p>}</div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className="min-w-0 p-5">{children}</div>
    </section>
  )
}

function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-text-2">{icon}</div>
      <p className="font-semibold text-text">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-text-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}


function Logo({ name = 'NextGen Forecasting' }: { name?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={pfizerLogo} alt="Pfizer" className="h-8 w-auto select-none" draggable={false} />
      <span aria-hidden className="h-6 w-px bg-border-strong" />
      <span className="text-[17px] font-semibold tracking-tight text-text">{name}</span>
    </div>
  )
}

const FRESH_TONE: Record<Fresh, 'ok' | 'warn' | 'err'> = { Current: 'ok', Delayed: 'warn', Partial: 'warn', Missing: 'err' }
function FreshBadge({ f }: { f: Fresh }) {
  return <Badge tone={FRESH_TONE[f]}>{f === 'Current' ? <Check size={10} /> : f === 'Missing' ? <AlertCircle size={10} /> : <Clock size={10} />}{f}</Badge>
}

/* ───────────────────────── State shape ───────────────────────── */

type Slice = { id: string; name: string; values: string[] }
type Pathway = 'Connected' | 'File' | 'Manual'
type Exposure = 'Editable' | 'Visible' | 'Hidden'
type Binding = {
  path?: Pathway; expose?: Exposure; mapField?: string
  source: string; owner: string; confidence: 'High' | 'Medium' | 'Low'; status: 'idle' | 'testing' | 'ok' | 'error'; msg?: string
  fresh?: { state: Fresh; refreshed: string; boundary: string; coverage: number }; fallback?: string; reason?: string; uploaded?: boolean
}
type Perm = { open: boolean; min: number; max: number; owner: string; source: string; confidence: '' | 'High' | 'Medium' | 'Low'; grain: string; value: number; notes: string; fval?: number }
type BaseRow = { id: string; name: string; eng: string; v: number[] }
type Baseline = { n: number; at: string; sig: string; rows: BaseRow[] }
type Level = { id: string; kind: string; items: string[] }
type Ind = { stype?: string; levels?: Level[]; auto?: boolean; sep?: string; snap?: string[][]; id: string; name: string; desc?: string; dim?: string; dimOther?: string; parent?: string; arch: ArchId | null; engine: string; sliceArch: Record<string, string>; modes: Record<string, string>; modules: string[]; perms: Record<string, Perm> }
type Config = {
  brand: string; asset: string; subjectType: string; therapyArea: string; lifecycle: string; subnational: boolean; context: string; competing: boolean; market: string; cycle: string; start: string; end: string; granularity: string; grade: string; slices: Slice[]
  shared: { price: boolean; g2n: boolean }; inds: Ind[]; active: string; bindings: Record<string, Binding>
  depth: string; notes: string; forecasters: string[]; version: string
  selfForecast: boolean; visibility: string; baseline: Baseline | null; aiFields: string[]
  // lifecycle & governance edge cases
  prelaunch: boolean; launch: string; loe: string; loeTo: string; overlap: string; fx: string
  lockedBy: string; frozen: boolean; override: string; signReason: string
  cascade: number[]; lastActual: Record<string, number>; zeroValues: string[]; retired: boolean
  // collaboration, release & change tracking
  team: Member[]; release: string; viewers: string[]; geoRestrict: boolean; log: LogEntry[]; notified: string[]
}
type Role = 'Creator' | 'Editor' | 'Viewer'
type Member = { name: string; role: Role }
type LogEntry = { what: string; who: string; when: string }
type Seed = { from?: ModelRow; copy?: boolean; blank?: boolean; importFile?: string; importStreams?: string[] }

/** Product of nested shares, e.g. class × subclass × brand. Above 100% means the cascade is mis-specified. */
const cascadeTotal = (c: Config) => c.cascade.length ? Math.round(c.cascade.reduce((p, x) => p * x / 100, 100)) : 0
const comboCount = (c: Config) => c.slices.reduce((n, s) => n * Math.max(s.values.length, 1), 1)

const emptyInd = (id: string, name: string): Ind => ({ id, name, arch: null, engine: '', sliceArch: {}, modes: {}, modules: [], perms: {} })
function initInd(ind: Ind, arch: ArchId): Ind {
  return {
    ...ind, arch, engine: ENGINES[arch][0], sliceArch: {},
    modules: Array.from(new Set([...requiredFor(arch), ...MODULES.filter(m => m.rec?.includes(arch) && validFor(m, arch)).map(m => m.id)])),
    modes: { ...Object.fromEntries(modesFor(arch).map(m => [m.id, modeDefault(arch, m)])), trend: TREND.methods[0] },
    // CoE-locked rows carry the CoE's structural provenance; forecaster-editable rows must be documented by the configurator.
    perms: Object.fromEntries(assumptionsFor(arch).map(a => [a.id, a.open
      ? { open: true, min: a.min, max: a.max, owner: '', source: '', confidence: '' as const, grain: 'Monthly', value: a.base, notes: '' }
      : { open: false, min: a.min, max: a.max, owner: 'CoE analyst', source: 'Analog benchmark', confidence: 'High' as const, grain: 'Monthly', value: a.base, notes: '' }])),
  }
}
const archByName = (n: string) => ARCHETYPES.find(a => a.name === n)?.id ?? null
const nextVersion = (v: string) => { const [maj, min] = v.replace('v', '').split('.').map(Number); return `v${maj}.${(min || 0) + 1}` }

function freshConfig(seed: Seed): Config {
  const base: Config = {
    brand: 'Brand X', asset: 'Brand X', subjectType: 'Brand / Asset', therapyArea: 'Oncology', lifecycle: 'Pipeline (Pre-Launch)', subnational: false, context: '', competing: false, market: 'United States', cycle: 'OP 2027', start: '2026-01', end: '2030-12', granularity: 'Monthly', grade: 'Operational planning',
    slices: [{ id: 's1', name: 'Payer', values: ['Commercial', 'Medicare', 'Medicaid'] }, { id: 's2', name: 'Risk group', values: ['High risk', 'Standard risk'] }],
    shared: { price: true, g2n: true }, inds: [emptyInd('i1', 'Indication A'), emptyInd('i2', 'Revenue Stream 2')], active: 'i1', bindings: {},
    depth: 'Simple + advanced', notes: '', forecasters: [], version: 'v1.0',
    selfForecast: false, visibility: 'Assigned forecasters only', baseline: null, aiFields: [],
    prelaunch: false, launch: '', loe: '', loeTo: '', overlap: '', fx: '', lockedBy: '', frozen: false, override: '', signReason: '',
    cascade: [], lastActual: {}, zeroValues: [], retired: false,
    team: [{ name: ME, role: 'Creator' }, { name: 'K. Brandt (CoE)', role: 'Editor' }, { name: 'E. Walsh (Market Access)', role: 'Viewer' }], release: 'Working version', viewers: [], geoRestrict: true, log: [], notified: [],
  }
  if (seed.importFile) {
    const brand = seed.importFile.replace(/\.[^.]+$/, '').split(/[_\s-]+/)[0] || 'Imported'
    return { ...base, brand, asset: brand, inds: (seed.importStreams ?? ['Stream 1 (from sheet “Forecast_1”)', 'Stream 2 (from sheet “Forecast_2”)']).map((n, k) => ({ ...emptyInd(`i${k + 1}`, n), dim: 'Indication' })), aiFields: ['brand', 'inds'], notes: `Imported from ${seed.importFile}. Structure parsed by ${'Charles'}; archetypes still need your choice.`,
      log: [{ what: `Model imported from ${seed.importFile}`, who: ME, when: 'Just now' }] }
  }
  if (seed.blank) return { ...base, brand: '', asset: '', inds: [emptyInd('i1', '')] }
  if (seed.from) {
    const m = seed.from
    const inds = m.inds.map((x, k) => {
      const a = archByName(x.arch); const i = emptyInd(`i${k + 1}`, x.name); const ind = a ? initInd(i, a) : i
      return seed.copy ? { ...ind, perms: Object.fromEntries(Object.entries(ind.perms).map(([id, p]) => [id, p.open ? { ...p, owner: OWNERS[0], source: 'Internal Epi Library', confidence: 'Medium' as const } : p])) } : ind
    })
    const c: Config = { ...base, brand: m.brand, asset: m.brand, market: m.market === 'US' ? 'United States' : m.market, cycle: m.cycle, inds, active: inds[0].id, version: seed.copy ? 'v1.0' : m.version.endsWith('draft') ? m.version.replace(' draft', '') : nextVersion(m.version) }
    if (seed.copy) {
      const pre = { ...c, notes: `Copied from ${m.brand} ${m.version}.`, forecasters: FORECASTERS.slice(0, 2) }
      const bindings = Object.fromEntries(inputsFor(pre).map(b => [b.key, { source: b.input.suggested, owner: OWNERS[0], confidence: 'Medium' as const, status: 'ok' as const, msg: 'Connected.', fresh: { state: 'Current' as Fresh, refreshed: 'today 06:00', boundary: 'Aug 2026', coverage: 100 } }]))
      return { ...pre, bindings }
    }
    return applyFixture(c, m.fx)
  }
  return base
}

function applyFixture(c: Config, fx?: FixtureId): Config {
  const i0 = c.inds[0]
  const setPerm = (id: string, p: Partial<Perm>) => ({ ...c, inds: [{ ...i0, perms: { ...i0.perms, [id]: { ...i0.perms[id], ...p } } }, ...c.inds.slice(1)] })
  switch (fx) {
    case 'prelaunch': return { ...c, prelaunch: true, launch: '2027-03', start: '2027-01', notes: 'Analog-based: Hemlibra uptake curve.' }
    case 'loe': return { ...c, loe: '2026-12', loeTo: '2027-06' }
    case 'retired': return { ...c, retired: true }
    case 'locked': return { ...c, lockedBy: 'K. Brandt' }
    case 'frozen': return { ...c, frozen: true }
    case 'overlap': return { ...c, overlap: '' }
    case 'integrity': return { ...c, cascade: [62, 58, 290], inds: [{ ...i0, modes: { ...i0.modes, cascade: 'Three-level' } }] }
    case 'belowHistory': return { ...c, lastActual: { persist12: 48 } }
    case 'vaccineCeiling': return setPerm('capture', { open: true, min: 9, max: 14 })
    case 'bigSlices': return { ...c, slices: ['Payer', 'Region', 'Channel', 'Age band', 'Line of therapy'].map((n, k) => ({ id: `s${k}`, name: n, values: Array.from({ length: 8 }, (_, j) => `${n} ${j + 1}`) })) }
    case 'emptySlice': return { ...c, zeroValues: ['Payer · Medicaid'] }
    case 'fxMix': return { ...c, fx: '' }
    default: return c
  }
}

type Issue = { msg: string; field?: string; ind?: string }
type Bound = { key: string; scope: string; scopeLabel: string; input: DataInput }

function requiredFor(arch: ArchId | null) { return arch ? MODULES.filter(m => m.required?.includes(arch)).map(m => m.id) : [] }
const indLabel = (c: Config, i: Ind) => c.inds.length > 1 ? `${i.name || 'Untitled indication'} — ` : ''

function inputsFor(c: Config, only?: string): Bound[] {
  const out: Bound[] = []
  const seen = new Set<string>()
  c.inds.filter(i => !only || i.id === only).forEach(ind => {
    if (!ind.arch) return
    const keys = new Set(MODULES.filter(m => ind.modules.includes(m.id) && m.data).map(m => m.data!))
    ;[...BASE_INPUTS[ind.arch], ...[...keys].map(k => MODULE_INPUTS[k])].forEach(input => {
      const shared = (input.id === 'price' && c.shared.price) || (input.id === 'g2n' && c.shared.g2n)
      const scope = shared ? 'brand' : ind.id
      const key = `${scope}:${input.id}`
      if (seen.has(key)) return
      seen.add(key)
      out.push({ key, scope, scopeLabel: shared ? 'Brand-level · shared across indications' : ind.name || 'Untitled indication', input })
    })
  })
  return out
}
const resolved = (b?: Binding) => !!b && (b.status === 'ok' || (b.status === 'error' && !!b.fallback && b.fallback !== FALLBACKS[0] && (b.reason?.trim().length ?? 0) >= 10 && (b.fallback !== FALLBACKS[2] || !!b.uploaded)))
/** Connected inputs use their chosen (or suggested) source; file inputs need a mapped field; manual inputs need nothing. */
const dataReady = (b?: Binding) => pathOf(b) !== 'File' || !!b?.mapField?.trim()
const missingMeta = (p: Perm) => !p.owner || !p.source || !p.confidence
const outOfBand = (p: Perm) => p.open && (p.min >= p.max || p.value < p.min || p.value > p.max)
/** Everything the baseline depends on. If it changes after a run, the baseline is out of date. */
const baselineSig = (c: Config) => JSON.stringify([c.inds.map(i => [i.id, i.arch, i.engine, i.modes, [...i.modules].sort(), Object.entries(i.perms).map(([k, p]) => [k, p.value, p.open, p.min, p.max])]), Object.entries(c.bindings).map(([k, b]) => [k, b.source, b.status]).sort()])

function validate(stage: number, c: Config): Issue[] {
  const out: Issue[] = []
  if (stage === 1) {
    if (!c.brand.trim()) out.push({ field: 'brand', msg: 'Enter the model name.' })
    if (!c.asset.trim()) out.push({ field: 'asset', msg: 'Enter the brand or asset name.' })
    if (c.inds.length === 0) out.push({ field: 'inds', msg: 'Add at least one revenue stream.' })
    const names = c.inds.map(i => i.name.trim().toLowerCase())
    c.inds.forEach((i, k) => {
      if (!i.name.trim()) out.push({ field: `ind-${i.id}`, msg: `Stream ${k + 1} needs a name.` })
      else if (names.indexOf(i.name.trim().toLowerCase()) !== k) out.push({ field: `ind-${i.id}`, msg: `“${i.name}” is listed twice.` })
    })
  }
  if (stage === 2) c.inds.forEach(i => {
    if (!i.arch) { out.push({ ind: i.id, msg: `${indLabel(c, i)}choose an archetype.` }); return }
    if (c.retired && i.arch === 'D-04') out.push({ ind: i.id, field: 'retired', msg: `${indLabel(c, i)}engine D-04 v1.4 retires Nov 30. Migrate to Patient-Flow (D-03) before finalising.` })
    if (c.grade === 'Valuation' && (i.engine.includes('beta') || ARCH_DETAIL[i.arch].status !== 'Certified'))
      out.push({ ind: i.id, field: 'combo', msg: `${indLabel(c, i)}${i.engine.includes('beta') ? 'beta engines' : 'archetypes under review'} can’t be used at Valuation tier. Pick a certified engine or lower the tier.` })
  })
  if (stage === 3) c.inds.forEach(i => {
    if (!i.arch) { out.push({ ind: i.id, msg: `${indLabel(c, i)}choose an archetype first.` }); return }
    modesFor(i.arch).filter(m => !m.optional && !m.options.includes(i.modes[m.id])).forEach(m => out.push({ ind: i.id, field: m.id, msg: `${indLabel(c, i)}set ${m.label.toLowerCase()}.` }))
    if (i.modes.time === 'Custom' && customTimeErr(i.modes)) out.push({ ind: i.id, field: 'time', msg: `${indLabel(c, i)}complete the custom time basis.` })
  })
  if (stage === 4) c.inds.forEach(i => {
    if (!i.arch) { out.push({ ind: i.id, msg: `${indLabel(c, i)}choose an archetype first.` }); return }
    if (i.arch === 'D-02') {
      const bad = MODULES.filter(m => i.modules.includes(m.id) && m.patients)
      if (bad.length) out.push({ ind: i.id, field: 'patients', msg: `${indLabel(c, i)}Rx-Share carries no patients — remove ${bad.map(m => m.name).join(', ')}.` })
    }
    MODULES.filter(m => i.modules.includes(m.id) && m.needs && !i.modules.includes(byName(m.needs).id))
      .forEach(m => out.push({ ind: i.id, field: 'needs', msg: `${indLabel(c, i)}${m.name} needs ${m.needs} attached.` }))
  })
  if (stage === 5) {
    const ins = inputsFor(c)
    if (!ins.length) out.push({ msg: 'No inputs yet — choose archetypes first.' })
    const unmapped = ins.filter(i => c.bindings[i.key]?.path === 'File' && !c.bindings[i.key]?.mapField?.trim())
    if (unmapped.length) out.push({ msg: `${unmapped.length} file-based input${unmapped.length > 1 ? 's need' : ' needs'} a mapped field.` })
  }
  if (stage === LAST) {
    if (c.forecasters.length === 0 && !c.selfForecast) out.push({ field: 'forecasters', msg: 'Assign at least one forecaster, or act as the forecaster yourself.' })
    if (!c.visibility) out.push({ field: 'visibility', msg: 'Choose who can see this model.' })
  }
  return out
}

/** Non-blocking: things a CoE should know before publishing, but may accept. */
function warningsFor(c: Config): { msg: string; stage: number }[] {
  const out: { msg: string; stage: number }[] = []
  const open = inputsFor(c).filter(b => !dataReady(c.bindings[b.key]))
  if (open.length) out.push({ stage: 5, msg: `${open.length} input${open.length > 1 ? 's are' : ' is'} not configured yet. They will reach the Forecaster without a data source.` })
  if (c.inds.length && c.inds.every(i => i.arch === 'D-06')) out.push({ stage: 2, msg: 'Every indication uses Trend / Extrapolation — a component method is standing in for the whole brand forecast.' })
  if (c.inds.some(i => i.arch === 'D-06' && i.modes.role === 'Blend') && c.inds.every(i => i.arch === 'D-06')) out.push({ stage: 3, msg: 'Trend role is “Blend” but there is no structural archetype to blend into.' })
  c.inds.forEach(i => {
    MODULES.filter(m => i.modules.includes(m.id) && GOVERNED.has(m.name)).forEach(m => out.push({ stage: 4, msg: `${indLabel(c, i)}${m.name} is a governed module. Check its configuration before finalising.` }))
    if (i.engine.includes('beta')) out.push({ stage: 2, msg: `${indLabel(c, i)}runs on beta engine ${i.engine.split(' ')[0]}.` })
  })
  if (comboCount(c) > 5000) out.push({ stage: 1, msg: `${comboCount(c).toLocaleString()} slice combinations. Runs will be slow; collapse a slice or move it to reporting only.` })
  c.zeroValues.forEach(v => out.push({ stage: 1, msg: `${v} has no patients in the source data — it will forecast zero.` }))
  if (c.loe) out.push({ stage: 1, msg: `LOE is uncertain (${c.loe} → ${c.loeTo || c.loe}). Forecasters should carry an early and late LOE scenario.` })
  return out
}

/** "Fix for me": resolves what it safely can for one step and lists each change. Never picks an archetype from scratch or edits locked values. */
function autoFix(stage: number, c: Config): { c: Config; changes: string[] } {
  const ch: string[] = []
  let n = c
  const nm = (i: Ind, k: number) => i.name || `Stream ${k + 1}`
  if (stage === 1) {
    if (!n.brand.trim()) { const v = n.asset.trim() || 'Velsipity'; n = { ...n, brand: v }; ch.push(`Model name set to “${v}”`) }
    if (!n.asset.trim()) { n = { ...n, asset: n.brand }; ch.push(`Brand or asset set to “${n.brand}”`) }
    if (!n.inds.length) { const i = emptyInd('i1', 'Ulcerative colitis'); n = { ...n, inds: [i], active: i.id }; ch.push('Added revenue stream “Ulcerative colitis”') }
    const seen = new Set<string>()
    n = { ...n, inds: n.inds.map((i, k) => {
      let name = i.name.trim()
      if (!name) { name = `Revenue stream ${k + 1}`; ch.push(`Stream ${k + 1} named “${name}”`) }
      const base = name; let j = 2
      while (seen.has(name.toLowerCase())) name = `${base} (${j++})`
      if (name !== base && i.name.trim()) ch.push(`Duplicate “${base}” renamed to “${name}”`)
      seen.add(name.toLowerCase())
      return name === i.name ? i : { ...i, name }
    }) }
  }
  if (stage === 2) {
    const donor = n.inds.find(i => i.arch)
    const drop: string[] = []
    n = { ...n, inds: n.inds.map((i, k) => {
      if (!i.arch && donor) { drop.push(i.id); ch.push(`${nm(i, k)}: archetype copied from ${donor.name} (${archName(donor.arch)})`); return initInd(i, donor.arch!) }
      if (n.retired && i.arch === 'D-04') { drop.push(i.id); ch.push(`${nm(i, k)}: migrated from retiring D-04 to Patient-Flow (D-03)`); return initInd(i, 'D-03') }
      return i
    }) }
    n = { ...n, bindings: Object.fromEntries(Object.entries(n.bindings).filter(([key]) => !drop.some(id => key.startsWith(`${id}:`)))) }
    const ceil = n.inds.map(i => i.arch && ARCH_DETAIL[i.arch].ceiling).find(Boolean)
    if (ceil && n.grade !== ceil) { n = { ...n, grade: ceil }; ch.push(`Tier set to ${ceil} to match the screening-grade archetype`) }
    if (n.grade === 'Valuation') {
      n = { ...n, inds: n.inds.map((i, k) => {
        if (!i.arch || !i.engine.includes('beta')) return i
        const cert = ENGINES[i.arch].find(e => e.includes('certified'))
        if (cert) { ch.push(`${nm(i, k)}: engine switched to certified ${cert.split(' ')[0]}`); return { ...i, engine: cert } }
        return i
      }) }
      if (n.inds.some(i => i.arch && (i.engine.includes('beta') || ARCH_DETAIL[i.arch].status !== 'Certified'))) { n = { ...n, grade: 'Operational planning' }; ch.push('Tier lowered to Operational planning (archetype under review)') }
    }
  }
  if (stage === 3) {
    n = { ...n, inds: n.inds.map((i, k) => {
      if (!i.arch) return i
      const modes = { ...i.modes }
      modesFor(i.arch).filter(m => !m.optional && !m.options.includes(modes[m.id])).forEach(m => { modes[m.id] = modeDefault(i.arch!, m); ch.push(`${nm(i, k)}: ${m.label.toLowerCase()} set to ${modes[m.id]}`) })
      if (modes.time === 'Custom' && customTimeErr(modes)) {
        if (customTimeErr(modes).startsWith('Enter')) modes.time_n = '1'
        if (modes.time_from && modes.time_to && Number(modes.time_to) < Number(modes.time_from)) modes.time_to = modes.time_from
        ch.push(`${nm(i, k)}: custom time basis completed`)
      }
      return { ...i, modes }
    }) }
    if (cascadeTotal(n) > 100) { n = { ...n, cascade: n.cascade.map(v => Math.min(v, 100)) }; ch.push('Share cascade levels capped at 100%') }
  }
  if (stage === 4) {
    n = { ...n, inds: n.inds.map((i, k) => {
      if (!i.arch) return i
      let mods = i.modules
      const bad = MODULES.filter(m => mods.includes(m.id) && !validFor(m, i.arch!))
      if (bad.length) { mods = mods.filter(id => !bad.some(m => m.id === id)); ch.push(`${nm(i, k)}: removed ${bad.map(m => m.name).join(', ')} (not valid for ${archName(i.arch)})`) }
      MODULES.filter(m => mods.includes(m.id) && m.needs && !mods.includes(byName(m.needs).id)).forEach(m => { mods = [...mods, byName(m.needs!).id]; ch.push(`${nm(i, k)}: attached ${m.needs}, needed by ${m.name}`) })
      return mods === i.modules ? i : { ...i, modules: mods }
    }) }
  }
  return { c: n, changes: ch }
}
/** Runs autoFix across steps in order, so later fixes (e.g. the baseline) see earlier ones. */
function autoFixAll(stages: number[], c: Config) {
  let n = c; const changes: string[] = []
  ;[...stages].sort((a, b) => a - b).forEach(s => { const r = autoFix(s, n); n = r.c; changes.push(...r.changes) })
  const left = stages.flatMap(s => validate(s, n).map(i => i.msg))
  return { c: n, changes, left }
}

/* ───────────────────────── App ───────────────────────── */

type Toast = { tone: 'ok' | 'err' | 'info'; text: string }

const toTop = () => scrollFrameTop()

export default function App() {
  const [view, setView] = useState<'landing' | 'models' | 'config' | 'admin' | 'forecast' | 'chat'>('landing')
  const [models, setModels] = useState<ModelRow[]>(SEED_MODELS)
  const [seed, setSeed] = useState<Seed>({})
  const [run, setRun] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  const [ai, setAi] = useState(false)
  const [collab, setCollab] = useState(false)
  const [fixtures, setFixtures] = useState(false)
  const [fcKey, setFcKey] = useState(0)
  const [threads, setThreads] = useState<Thread[]>([])
  const [curThread, setCurThread] = useState<number | null>(null)
  const [fcSection, setFcSection] = useState<FcSection>('forecasts')
  const [fcWs, setFcWs] = useState(false)
  // The collaboration panel starts collapsed in every flow; only the top-bar control opens it.
  useEffect(() => { setCollab(false) }, [view, fcSection, fcWs])
  const [fcInsights, setFcInsights] = useState<BoardInsight[]>(SEED_INSIGHTS)
  const [fcThreads, setFcThreads] = useState<FThread[]>([])
  const [fcCur, setFcCur] = useState<number | null>(null)
  const [fcChatBrand, setFcChatBrand] = useState('nurtec')
  // Forecast AI grounding: latest submitted/approved version per brand. Finalising a scenario files a new one; drafts never do.
  const [fcPublished, setFcPublished] = useState<PublishedReg>(SEED_PUBLISHED)
  const onPublished = (brandId: string, scenario: string) => {
    const br = FC_BRANDS.find(b => b.id === brandId)
    if (br) setFcPublished(r => ({ ...r, [brandId]: nextPublished(r[brandId] ?? null, br.cycle, ME, scenario) }))
  }
  // Forecast AI may only read forecasts assigned to this user; catalog models outside that list stay invisible to it.
  const fcBlocked = useMemo(() => models.filter(m => m.restricted || !m.fx && !FC_BRANDS.some(b => m.brand.toLowerCase().includes(b.brand.toLowerCase()))).map(m => m.brand), [models])
  const toggleFixtures = () => {
    const on = !fixtures
    setFixtures(on)
    setModels(ms => on ? [...FIXTURE_MODELS, ...ms] : ms.filter(m => !m.fx))
    setView('models')
    setToast({ tone: 'info', text: on ? `${FIXTURE_MODELS.length} edge-case fixtures added to the library` : 'Edge-case fixtures removed' })
  }

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t) } }, [toast])
  // Assistant hidden for now: no top-bar button or Ctrl/⌘ + / shortcut, so `ai` stays false

  const open = (s: Seed) => { setSeed(s); setRun(r => r + 1); setView('config'); toTop() }
  // Full view: browser full screen where allowed, and the top bar hidden either way (the preview iframe may block full screen).
  const [full, setFull] = useState(false)
  const enterFull = () => { setFull(true); document.documentElement.requestFullscreen?.().catch(() => {}) }
  const exitFull = () => { setFull(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  useEffect(() => { const h = () => { if (!document.fullscreenElement) setFull(false) }; document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const resume = (m: ModelRow) => open(m.id === 'a' ? {} : { from: m })

  /** A finalised model gets a workspace row straight away; making it available only flips its status. */
  const upsertRow = (ms: ModelRow[], c: Config, status: MStatus): ModelRow[] => {
    const id = seed.from && !seed.copy ? seed.from.id : Object.keys(seed).length === 0 ? 'a' : `n${run}`
    const prev = ms.find(m => m.id === id)
    const note = c.notes || (status === 'Published' ? 'Made available to the Forecaster.' : 'Finalised. Not yet available to the Forecaster.')
    const older = prev ? prev.versions.filter(v => v.v !== c.version) : []
    const row: ModelRow = { tag: undefined, fx: undefined, id, brand: c.brand, inds: c.inds.map(i => ({ name: i.name, arch: ARCHETYPES.find(a => a.id === i.arch)?.name ?? '' })), market: c.market === 'United States' ? 'US' : c.market, cycle: c.cycle, version: c.version, status, fresh: 'Current', issues: 0, updated: 'Just now', by: 'You', versions: [{ v: c.version, date: 'Today', by: ME, note, scenarios: 0 }, ...older] }
    return prev ? ms.map(m => m.id === id ? row : m) : [row, ...ms]
  }

  return (
    view === 'landing' ? <><Landing onCoE={() => setView('models')} onForecast={() => { setView('forecast'); setFcSection('forecasts'); toTop() }} /></> :
    <AppFrame dock="split" collab={collab && (view === 'config' || (view === 'forecast' && fcSection === 'forecasts' && fcWs))} onCollab={setCollab}
      footer={<ProfileMenu placement="rail" onAdmin={() => { setView('admin'); toTop() }} onLogout={() => { setView('landing'); setToast({ tone: 'info', text: 'You’ve been logged out.' }) }} />} onHome={() => setView('landing')}
      items={view === 'forecast'
        ? [{ id: 'forecasts', label: 'My forecasts', icon: LineChart, go: () => { setFcSection('forecasts'); setFcKey(k => k + 1); toTop() } },
           { id: 'fchat', label: 'Ask & Understand', icon: MessagesSquare, go: () => { setFcSection('chat'); toTop() },
             sub: { onNew: () => { setFcCur(null); setFcSection('chat') }, items: fcThreads.map(t => ({ id: t.id, label: t.title, active: fcSection === 'chat' && fcCur === t.id, go: () => { setFcCur(t.id); setFcSection('chat'); toTop() },
               dup: () => { const id = Date.now(); setFcThreads(ts => { const i = ts.findIndex(x => x.id === t.id); const c = { ...t, id, title: t.title + ' (copy)' }; return [...ts.slice(0, i + 1), c, ...ts.slice(i + 1)] }); setFcCur(id); setFcSection('chat') },
               del: () => { setFcThreads(ts => ts.filter(x => x.id !== t.id)); if (fcCur === t.id) setFcCur(null) } })) } }]
        : [{ id: 'models', label: 'Model workspace', icon: Boxes, go: () => { setView('models'); toTop() } },
           { id: 'chat', label: 'Build & Configure', icon: Workflow, go: () => { setView('chat'); toTop() },
             sub: { onNew: () => { setCurThread(null); setView('chat') }, items: threads.map(t => ({ id: t.id, label: t.title, active: view === 'chat' && curThread === t.id, go: () => { setCurThread(t.id); setView('chat'); toTop() },
               dup: () => { const id = Date.now(); setThreads(ts => { const i = ts.findIndex(x => x.id === t.id); const c = { ...t, id, title: t.title + ' (copy)' }; return [...ts.slice(0, i + 1), c, ...ts.slice(i + 1)] }); setCurThread(id); setView('chat') },
               del: () => { setThreads(ts => ts.filter(x => x.id !== t.id)); if (curThread === t.id) setCurThread(null) } })) } }]}
      active={view === 'config' ? 'models' : view === 'forecast' ? ({ forecasts: 'forecasts', chat: 'fchat' } as const)[fcSection] : view}
      flow={view === 'forecast' ? 'Forecaster' : 'Forecasting CoE'}
      header={full ? <button type="button" onClick={exitFull} aria-label="Exit full view" title="Exit full view" className="fixed right-4 top-4 z-[55] inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2.5 text-[12.5px] font-medium text-text-2 shadow-sm backdrop-blur hover:text-text"><Minimize2 size={14} />Exit full view</button> : <TopBar onFull={enterFull} collab={view === 'config' || (view === 'forecast' && fcSection === 'forecasts' && fcWs) ? { on: collab, toggle: () => setCollab(v => !v), label: view === 'forecast' ? 'Forecast AI' : 'COE AI' } : undefined} crumbs={[view === 'forecast' ? 'Forecaster' : 'Forecasting CoE', ({ models: 'Model workspace', config: 'Configure model', admin: 'Admin portal', forecast: ({ forecasts: 'My forecasts', chat: AI_EXP.ask.label } as const)[fcSection], chat: AI_EXP.build.label, landing: '' } as const)[view]]} onHome={() => setView('landing')} onAdmin={() => { setView('admin'); toTop() }} onLogout={() => { setView('landing'); setToast({ tone: 'info', text: 'You’ve been logged out.' }) }} models={models} onResume={resume} ai={ai} onAI={() => setAi(v => !v)} notify={setToast} fixtures={fixtures} onFixtures={toggleFixtures} />}>
      {view === 'forecast' && fcSection === 'forecasts' && !fcWs && <Charles persona="ask" busy={false} greeting={`Hi ${ME.split(' ')[0]}, ask about any submitted forecast. I show sources and don’t change anything.`} context={['Forecaster', 'My forecasts']}
        chips={['What are the key risks?', 'Explain what moved Nurtec', 'Compare Optimistic and Pessimistic']}
        respond={q => { const named = FC_BRANDS.find(x => q.toLowerCase().includes(x.brand.toLowerCase())); const r = forecastAnswer(q, named?.id ?? fcChatBrand, fcInsights, { blocked: fcBlocked, published: fcPublished }); const o = r.out.map(x => x.text ?? '').filter(Boolean).join('\n\n').replace(/^## (.*)$/gm, '**$1**'); return { kind: 'text', title: r.title ?? 'Forecast AI', cites: r.out.flatMap(x => x.sources ?? []).map(s => s.name), body: <div className="space-y-2 whitespace-pre-line">{o.split('\n\n').map((p, i) => <p key={i}><Md text={p} /></p>)}</div> } }} />}
      {view === 'forecast' ? <Forecaster key={fcKey} section={fcSection} setSection={setFcSection} onWorkspace={setFcWs} Copilot={ForecastCopilot} notify={setToast} insights={fcInsights} setInsights={setFcInsights} setChatBrand={setFcChatBrand}
          chat={{ threads: fcThreads, setThreads: setFcThreads, cur: fcCur, setCur: setFcCur, brandId: fcChatBrand, setBrandId: setFcChatBrand, assistant: { name: ASSISTANT, Mark: AssistantMark, Md }, userName: ME.split(' ')[0]!, blocked: fcBlocked, published: fcPublished }} onPublished={onPublished} />
        : view === 'chat' ? <CoeChat threads={threads} setThreads={setThreads} cur={curThread} setCur={setCurThread} models={models} setModels={setModels} />
        : view === 'admin' ? <AdminPortal notify={setToast} onBack={() => setView('models')} /> : view === 'models'
        ? <ModelsHome fixtures={fixtures} models={models} setModels={setModels} onOpen={open} onResume={resume} notify={setToast} ai={ai} closeAI={() => setAi(false)} />
        : <Configurator key={run} seed={seed} onExit={() => setView('models')} notify={setToast} ai={ai} closeAI={() => setAi(false)}
            onFinalised={c => setModels(ms => upsertRow(ms, c, 'Finalised'))}
            onPublished={c => setModels(ms => upsertRow(ms, c, 'Published'))} />}
      {toast && (
        <div role="status" className="rise fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-md bg-text px-4 py-2.5 text-sm text-white shadow-lg">
          {toast.tone === 'ok' ? <CheckCircle2 size={16} className="text-[#6ee7b7]" /> : toast.tone === 'err' ? <AlertCircle size={16} className="text-[#fda4af]" /> : <Info size={16} />}
          {toast.text}
        </div>
      )}
    </AppFrame>
  )
}

type ChatSize = 'min' | 'md' | 'lg'
type CollabState = { open: boolean; slot: HTMLElement | null; close: () => void; size: ChatSize; setSize: (s: ChatSize) => void; dock: 'float' | 'split' }
const CollabCtx = createContext<CollabState>({ open: false, slot: null, close: () => {}, size: 'md', setSize: () => {}, dock: 'float' })

/* ───────────────────────── App frame: side rail + rounded content panel ───────────────────────── */

type NavItem = { id: string; label: string; icon: typeof House; go: () => void; sub?: { onNew: () => void; items: { id: number; label: string; active: boolean; go: () => void; dup: () => void; del: () => void }[] } }
/** Shared shell for every flow: a light gray rail that keeps the page breathable. Collapsed shows the Pfizer motif and icons; expanded shows the full logo and labels. */
function AppFrame({ onHome, items, active, flow, header, collab, onCollab, footer, children, dock = 'float' }: { header: ReactNode; collab: boolean; onCollab: (v: boolean) => void; footer: ReactNode; onHome: () => void; items: NavItem[]; active: string; flow: string; children: ReactNode; dock?: 'float' | 'split' }) {
  // Collapsed by default; opens only from the expand control.
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<ChatSize>('md')
  // Split-screen panel width, adjustable by dragging the divider or with arrow keys.
  const [panelW, setPanelW] = useState(440)
  const clampW = (v: number) => Math.round(Math.min(Math.max(v, 340), Math.min(820, window.innerWidth * 0.6)))
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = panelW
    const move = (ev: PointerEvent) => setPanelW(clampW(w0 + (x0 - ev.clientX)))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  useEffect(() => { if (collab) setSize('md') }, [collab])
  const w = open ? 236 : 72
  return (
    <div className="h-dvh overflow-hidden bg-background">
      {/* The rail sits on the canvas; the workspace is a separate rounded, raised panel beside it. */}
      <nav aria-label={`${flow} navigation`}
        className="fixed inset-y-0 left-0 z-50 flex flex-col py-4 transition-[width] duration-200" style={{ width: w }}>
        <button type="button" onClick={onHome} aria-label="Pfizer · Go to home" className={cx('mb-6 flex shrink-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand', open ? 'mx-4 px-1.5' : 'mx-auto h-10 justify-center')}>
          <img src={pfizerMark} alt="" className="h-8 w-8 shrink-0 select-none" draggable={false} />
          {open && <span className="min-w-0 text-left leading-tight"><span className="block truncate text-[13px] font-semibold tracking-tight text-text">NextGen Forecasting</span><span className="block truncate text-[11px] text-text-3">{flow}</span></span>}
        </button>
        <ul className={cx('flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto', open ? 'px-3' : 'items-center px-0')}>
          {items.map((it, k) => {
            const on = active === it.id
            return (
              <Fragment key={it.id}>
                <li className={open ? '' : 'w-full flex justify-center'}>
                  <button type="button" onClick={it.go} aria-current={on ? 'page' : undefined} title={open ? undefined : it.label}
                    className={cx('flex items-center gap-3 rounded-xl text-[13.5px] font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand', open ? 'h-10 w-full px-3' : 'h-11 w-11 justify-center', on ? 'bg-surface text-brand shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.05]' : 'text-text-2 hover:bg-black/[0.05] hover:text-text')}>
                    <it.icon size={18} className="shrink-0" />{open && <span className="truncate">{it.label}</span>}
                  </button>
                  {open && it.sub && (
                    <div className="ml-[22px] mt-1 border-l border-border-strong/70 pl-2.5">
                      <button type="button" onClick={it.sub.onNew} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[12.5px] font-medium text-text hover:bg-black/[0.05]"><SquarePen size={13} />New chat</button>
                      {it.sub.items.length > 0 && <ul className="max-h-[40dvh] space-y-0.5 overflow-y-auto">{it.sub.items.map(t => (
                        <li key={t.id} className={cx('group/t relative flex h-8 items-center rounded-lg', t.active ? 'bg-surface' : 'hover:bg-[#e2e5ec]')}>
                          <button type="button" onClick={t.go} aria-current={t.active ? 'page' : undefined} title={t.label} className={cx('flex h-8 min-w-0 flex-1 items-center rounded-lg px-2 text-left text-[12.5px]', t.active ? 'font-medium text-brand' : 'text-text-2 hover:text-text')}><span className="truncate">{t.label}</span></button>
                          <span className={cx('absolute inset-y-0 right-0 hidden items-center gap-0.5 rounded-r-lg bg-gradient-to-l to-transparent pl-4 pr-1 group-focus-within/t:flex group-hover/t:flex', t.active ? 'from-surface via-surface' : 'from-[#e2e5ec] via-[#e2e5ec]')}>
                            <button type="button" onClick={t.dup} aria-label={`Duplicate ${t.label}`} title="Duplicate" className="grid h-6 w-6 place-items-center rounded-md text-text-3 hover:bg-black/[0.06] hover:text-text"><Copy size={12} /></button>
                            <button type="button" onClick={t.del} aria-label={`Delete ${t.label}`} title="Delete" className="grid h-6 w-6 place-items-center rounded-md text-text-3 hover:bg-err-soft hover:text-err"><Trash2 size={12} /></button>
                          </span></li>))}</ul>}
                    </div>
                  )}
                </li>
              </Fragment>
            )
          })}
        </ul>
        <div className={cx('mt-2 flex shrink-0', open ? 'px-3' : 'justify-center')}>
          <button data-tour="rail-toggle" type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={open ? 'Collapse navigation' : 'Expand navigation'} title={open ? 'Collapse' : 'Expand'}
            className="grid h-10 w-10 place-items-center rounded-xl text-text-2 outline-none hover:bg-black/[0.05] hover:text-text focus-visible:ring-2 focus-visible:ring-brand">{open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button>
        </div>
        <div className={cx('mt-3 flex shrink-0 items-center gap-3', open ? 'px-5' : 'justify-center')}>{footer}{open && <span className="min-w-0 leading-tight"><span className="block truncate text-[12.5px] font-medium text-text">{ME}</span><span className="block text-[11px] text-text-3">Super Admin</span></span>}</div>
      </nav>
      <div className="flex h-full gap-2 py-2 pr-2 transition-[padding] duration-200" style={{ paddingLeft: w }}>
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/[0.05] bg-surface shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.10)]">
          {header}
          <div id={FRAME_ID} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <CollabCtx.Provider value={{ open: collab, slot, close: () => onCollab(false), size, setSize, dock }}>{children}</CollabCtx.Provider>
          </div>
        </div>
        {/* Both COE AI and Forecast AI open as an adjustable split-screen panel beside the page. */}
        {collab && dock === 'split' && <>
          <div role="separator" aria-orientation="vertical" aria-label="Resize assistant panel" aria-valuenow={panelW} aria-valuemin={340} aria-valuemax={820} tabIndex={0}
            onPointerDown={startDrag} onDoubleClick={() => setPanelW(440)}
            onKeyDown={e => { if (e.key === 'ArrowLeft') setPanelW(w => clampW(w + 24)); if (e.key === 'ArrowRight') setPanelW(w => clampW(w - 24)) }}
            title="Drag to resize · double-click to reset"
            className="group relative -mx-1 hidden w-2 shrink-0 cursor-col-resize outline-none sm:block">
            <span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong transition-colors group-hover:bg-brand group-focus-visible:bg-brand" />
          </div>
          <aside ref={setSlot} aria-label={ASSISTANT} style={{ width: panelW }}
            className="rise flex h-full shrink-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05),0_16px_40px_-20px_rgba(16,24,40,0.22)] max-sm:fixed max-sm:inset-2 max-sm:z-[56] max-sm:!w-auto" />
        </>}
        {collab && dock === 'float' && (
          <aside ref={setSlot} aria-label={ASSISTANT}
            className={cx('rise fixed z-[56] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-12px_rgba(16,24,40,0.32)] transition-[width,height] duration-200 max-sm:inset-2',
              size === 'min' ? 'sm:bottom-5 sm:right-5 sm:h-auto sm:w-[320px]' : size === 'lg' ? 'sm:bottom-5 sm:right-5 sm:h-[calc(100dvh-40px)] sm:w-[min(640px,calc(100vw-120px))]' : 'sm:bottom-5 sm:right-5 sm:h-[min(700px,calc(100dvh-96px))] sm:w-[420px]')} />
        )}
      </div>
    </div>
  )
}

/* ───────────────────────── CoE chat (full page, every use case worked in-thread) ───────────────────────── */

type CreateFlow = { kind: 'create'; brand?: string; market?: string; cycle?: string; inds: { name: string; arch?: ArchId; rec: ArchId; why: string }[]; stage: 'collect' | 'arch' | 'modes' | 'modules' | 'review' | 'done'; modes: Record<string, string>[]; mods: string[]; asked?: 'brand' | 'inds' | 'market' | 'cycle'; savedId?: string }
type FixFlow = { kind: 'fix'; modelId: string; stage: 'arch' | 'confirm' | 'done'; picks: Record<number, ArchId> }
type Flow = CreateFlow | FixFlow
type ChatIssue = { text: string; fix: string; decide?: number }
type Card =
  | { t: 'draft' } | { t: 'arch'; ind: string; rec: ArchId; why: string } | { t: 'modes' } | { t: 'modules' } | { t: 'review' }
  | { t: 'saved'; id: string } | { t: 'drafts'; ids: string[] } | { t: 'issues'; id: string; items: ChatIssue[] } | { t: 'diff'; lines: { kind: '+' | '~'; text: string }[] }
  | { t: 'build' } | { t: 'model'; id: string } | { t: 'compare'; ids: string[] } | { t: 'archs'; ids: ArchId[] } | { t: 'catalog'; ids: string[] }
type ChatMsg = { id: number; role: 'user' | 'ai'; text?: string; card?: Card; chips?: string[]; trace?: string[]; mode?: Mode; sources?: Source[]; via?: string }
type Build = { brand: string; market: string; cycle: string; inds: { name: string; rec: ArchId; why: string; arch: ArchId }[]; mods: string[]; step: number; phase: 'choose' | 'running' | 'await' | 'done'; pace?: 'step' | 'auto'; dataOk: boolean; savedId?: string; saved?: 'draft' | 'final'; draftId?: string }
type Intake = { kind: 'new' | 'reuse' | 'modify' | 'part' | 'draft'; step: 'ind' | 'arch' | 'basis' | 'model' | 'area' | 'change' | 'confirm'; ind?: string; arch?: ArchId; raw?: string; model?: string; area?: string; change?: string }
type Thread = { id: number; title: string; msgs: ChatMsg[]; flow?: Flow; ctx?: string; build?: Build; intake?: Intake }
type Out = { text?: string; card?: Card; chips?: string[]; trace?: string[]; sources?: Source[]; via?: string }
type Res = { out: Out[]; build?: Build; flow?: Flow; ctx?: string; title?: string; add?: ModelRow; patch?: { id: string; p: Partial<ModelRow> } }

const ARCH = (id: ArchId) => ARCHETYPES.find(a => a.id === id)!
const ALTS: Record<ArchId, ArchId[]> = { 'D-01': ['D-02', 'D-04'], 'D-02': ['D-01', 'D-06'], 'D-03': ['D-04', 'D-01'], 'D-04': ['D-03', 'D-01'], 'D-05': ['D-03', 'D-06'], 'D-06': ['D-01', 'D-02'], 'D-07': ['D-03', 'D-01'] }
const IND_KB: [RegExp, string, ArchId, string][] = [
  [/ulcerative colitis|\buc\b/, 'Ulcerative colitis', 'D-01', 'A chronic treated pool that’s re-stated monthly; the Velsipity spec (A-31) runs this way.'],
  [/crohn/, 'Crohn’s disease', 'D-01', 'Chronic IBD pool with switching between advanced therapies, the same shape as UC.'],
  [/atopic|eczema/, 'Atopic dermatitis', 'D-01', 'Cibinqo US (A-25) is the closest precedent: a prevalent pool with a nested share cascade.'],
  [/psoria/, 'Psoriasis', 'D-01', 'Large standing biologic pool; share moves along a class-to-brand cascade.'],
  [/hemophilia/, 'Hemophilia A/B', 'D-01', 'Small, stable treated pool. The hemophilia model (A-26) is the precedent.'],
  [/migraine/, 'Migraine', 'D-02', 'The market is defined by scripts, not patients; Nurtec (A-22) is built this way.'],
  [/obesity|weight/, 'Obesity', 'D-02', 'Script-volume market with fast-moving share; there’s no stable patient state to track.'],
  [/rsv/, 'RSV — older adults', 'D-05', 'A depletable vaccine-eligible population: Abrysvo and RSV US (A-4).'],
  [/covid|comirnaty/, 'COVID-19 vaccination', 'D-05', 'Seasonal re-vaccination of a depletable stock, like Comirnaty US (A-33).'],
  [/pneumo|mening|vaccin/, 'Vaccination', 'D-05', 'Vaccines capture an available stock that depletes. Market Stock-Flow is the vaccine engine.'],
  [/nsclc|lung/, 'NSCLC', 'D-03', 'Lines of therapy with persistency decay; Lorbrena US (A-32) uses Patient-Flow.'],
  [/myeloma/, 'Multiple myeloma', 'D-03', 'Start cohorts and duration of therapy matter by line, as in Elranatamab (A-17).'],
  [/prostate/, 'Prostate cancer', 'D-03', 'Orgovyx (A-18) models flowing start cohorts with persistency.'],
  [/breast/, 'HR+ breast cancer', 'D-04', 'A standing brand stock with monthly discontinuation, as in the Ibrance family (A-16).'],
  [/paxlovid|antiviral|anti-?infect/, 'Acute infection', 'D-03', 'Incidence-capture configuration of Patient-Flow (A-27, A-29).'],
  [/screening|peak|pre-?clinical|asset|bd\b/, 'Pipeline asset', 'D-07', 'Screening-grade sizing from analogs and the target product profile.'],
]
const MARKETS: [RegExp, string][] = [[/\bus\b|united states|\busa\b/, 'US'], [/eu5|europe/, 'EU5'], [/japan/, 'Japan'], [/china/, 'China'], [/global|worldwide/, 'Global'], [/ex-?us/, 'ex-US']]
const CYC: [RegExp, string][] = [[/\bop\b|operating plan|op ?2027/, 'OP 2027'], [/re-?forecast|q4/, 'Q4 2026 Re-forecast'], [/lrp|long.?range/, 'LRP 2027–2036'], [/screening cycle|bd screening/, 'BD screening']]
const archIn = (s: string): ArchId | undefined => {
  const m: [RegExp, ArchId][] = [[/prevalent/, 'D-01'], [/rx.?share/, 'D-02'], [/patient.?flow/, 'D-03'], [/inflow|outflow/, 'D-04'], [/stock.?flow/, 'D-05'], [/trend|extrapol/, 'D-06'], [/peak/, 'D-07'], [/d-0([1-7])/, 'D-01']]
  for (const [r, id] of m) { const x = s.match(r); if (x) return (id === 'D-01' && x[1] ? `D-0${x[1]}` : id) as ArchId }
}
const kbFor = (s: string) => IND_KB.filter(k => k[0].test(s))
const recFor = (name: string) => kbFor(name.toLowerCase())[0] ?? [/./, name, 'D-01' as ArchId, 'No close precedent on file, so I’ve started from the most common pattern for a chronic, treated population.']
const yes = (s: string) => /^(y|yes|yep|ok|okay|sure|sounds good|looks good|good|great|perfect|confirm|continue|next|go|do it|go ahead|let'?s go|that works|use (your|the) (suggestion|recommendation)|agree)/.test(s.trim())
const modsFor = (archs: ArchId[]) => {
  const req = MODULES.filter(m => archs.some(a => m.required?.includes(a)))
  const rec = MODULES.filter(m => !req.includes(m) && archs.some(a => m.rec?.includes(a)) && !(m.patients && archs.every(a => a === 'D-02')))
  return { req, rec }
}
function issuesFor(r: ModelRow): ChatIssue[] {
  const out: ChatIssue[] = r.inds.flatMap((i, k) => i.arch ? [] : [{ text: `No engine selected for ${i.name}`, fix: 'Needs your call; I’ll show you the options', decide: k }])
  if (r.fresh !== 'Current') out.push({ text: `Source feed is ${r.fresh.toLowerCase()}`, fix: 'Pin to the last complete snapshot (Sep 30) and notify the feed owner' })
  const gen: ChatIssue[] = [
    { text: 'Gross-to-net has no rebate table mapped', fix: 'Map to the 2026 contract rebate table (CT-2026-04)' },
    { text: 'No 2027 list price in Price & FX', fix: 'Carry forward 2026 WAC with a 3% erosion assumption, flagged as an assumption' },
    { text: 'Volume conversion is missing a pack size', fix: 'Use the 30-count pack from the product master' },
  ]
  let g = 0; while (out.length < Math.max(r.issues, out.length) && g < gen.length) out.push(gen[g++])
  return out
}
function createChecks(f: CreateFlow) {
  const archs = f.inds.map(i => i.arch!).filter(Boolean)
  const dataMods = modsFor(archs).req.filter(m => m.data && f.mods.includes(m.id))
  return [
    { ok: true, text: `Setup complete: ${f.brand} · ${f.market} · ${f.cycle}` },
    { ok: f.inds.every(i => i.arch), text: `${f.inds.length} stream${f.inds.length > 1 ? 's' : ''}, each on a governed engine` },
    { ok: true, text: 'All modes set and compatible with their engines' },
    { ok: true, text: `${f.mods.length} modules wired, required ones included` },
    ...dataMods.map(m => ({ ok: false, text: `${m.name} needs a data source before it can be finalised` })),
  ]
}

function think(th: Thread, raw: string, models: ModelRow[]): Res {
  const s = raw.toLowerCase().trim()
  const f = th.flow
  const vis = models.filter(m => !m.restricted)
  const brandsIn = vis.filter(m => s.includes(m.brand.toLowerCase()) || s.includes(m.brand.toLowerCase().split(' ')[0]))
  const ctxRow = vis.find(m => m.id === th.ctx)
  const keep = (r: Omit<Res, 'flow'>): Res => ({ flow: f, ctx: th.ctx, ...r })

  if (/^(hi|hello|hey|morning|good (morning|afternoon))\b/.test(s) && !f) return keep({ out: [{ text: `Hi ${ME.split(' ')[0]}. You have **${vis.filter(m => m.status === 'Draft').length} drafts** open and the OP 2027 cycle closes **Nov 14**. Where do you want to start?`, chips: ['Show my drafts', 'Set up a new model', 'What’s live for forecasters?'] }] })
  if (/^(thanks|thank you|cheers|great,? thanks)/.test(s)) return keep({ out: [{ text: 'Anytime. Ask whenever you want to pick this back up; I’ll remember where we left off in this chat.', chips: ['Show my drafts', 'Set up a new model'] }] })
  if (f && f.stage !== 'done' && /\b(cancel|never ?mind|start over|discard|stop)\b/.test(s)) return { out: [{ text: 'Done, I’ve discarded that and nothing was saved. What next?', chips: ['Set up a new model', 'Show my drafts'] }], flow: undefined, ctx: th.ctx }

  // Side questions mid-flow get answered, then we return to the open step.
  const side = /^(what|how|why|explain|tell me|difference|which is)/.test(s) && !!archIn(s)
  if (f && f.stage !== 'done' && side) {
    const a = archIn(s)!
    return keep({ out: [{ card: { t: 'archs', ids: [a, ...ALTS[a].slice(0, 1)] }, text: `**${ARCH(a).name}** models *${ARCH(a).state.toLowerCase()}*. ${ARCH(a).desc}`, chips: ['Back to where we were'] }] })
  }
  if (f && f.stage !== 'done' && /back to where|where were we|continue setup/.test(s)) return f.kind === 'create' ? createStep(f, '', models, true) : fixStep(f, '', models, true)
  if (f?.kind === 'create' && f.stage !== 'done') return createStep(f, raw, models)
  if (f?.kind === 'fix' && f.stage !== 'done') return fixStep(f, raw, models)

  if (/new model|create|build|set ?up|start a|configure a|forecast for/.test(s)) {
    const f0: CreateFlow = { kind: 'create', inds: [], stage: 'collect', modes: [], mods: [] }
    return createStep(f0, raw, models, false, true)
  }
  if (/finali[sz]e|mark .*final/.test(s)) {
    const r = brandsIn[0] ?? ctxRow
    if (!r) return keep({ out: [{ text: 'Which model should I finalise?', chips: vis.filter(m => m.status === 'Draft').map(m => `Finalise ${m.brand}`) }] })
    const iss = issuesFor(r)
    if (r.status !== 'Draft') return keep({ ctx: r.id, out: [{ text: `**${modelName(r)}** is already ${STATUS_LABEL[r.status].toLowerCase()}.`, card: { t: 'model', id: r.id } }] })
    if (iss.length) return { flow: { kind: 'fix', modelId: r.id, stage: 'confirm', picks: {} }, ctx: r.id, out: [{ text: `I can’t finalise **${r.brand}** yet. ${iss.length} item${iss.length > 1 ? 's' : ''} would block the validation gate. We can clear them together right here:`, card: { t: 'issues', id: r.id, items: iss }, trace: ['Ran the validation gate', `${iss.length} blocking items`] }, ...fixStep({ kind: 'fix', modelId: r.id, stage: 'confirm', picks: {} }, '', models, true).out] }
    // COE AI never finalises: the validation gate passes, but the decision stays with the user in the configurator.
    return keep({ ctx: r.id, out: [{ text: `**${r.brand}** passes the validation gate, so it’s ready to finalise. **Finalising stays with you.** Open it and use **Step 7 · Finalise setup** in the configurator; I don’t finalise or publish models.`, card: { t: 'model', id: r.id }, trace: ['Validation gate: 0 blocking'] }] })
  }
  if (/fix|resolve|issue|what'?s wrong|blocking|clear/.test(s)) {
    const r = brandsIn[0] ?? ctxRow ?? vis.find(m => m.status === 'Draft' && m.issues)
    if (!r) return keep({ out: [{ text: 'Nothing is blocking right now. All your drafts are clean.' }] })
    return fixStep({ kind: 'fix', modelId: r.id, stage: 'arch', picks: {} }, '', models, true, true)
  }
  if (/compare|\bvs\.?\b|versus|difference between/.test(s) && brandsIn.length >= 2) return keep({ ctx: brandsIn[0].id, out: [{ text: `Here are **${brandsIn.map(b => b.brand).join('** and **')}** side by side. The differences are highlighted.`, card: { t: 'compare', ids: brandsIn.slice(0, 3).map(b => b.id) }, trace: ['Loaded both model specs', 'Aligned streams and versions'], chips: brandsIn.map(b => `Show ${b.brand} history`) }] })
  if (/draft|in progress|unfinished|my work|pending|open/.test(s)) {
    const d = vis.filter(m => m.status === 'Draft')
    const worst = [...d].sort((a, b) => b.issues - a.issues)[0]
    return keep({ out: [{ text: d.length ? `You have **${d.length} drafts**. ${worst?.issues ? `**${worst.brand}** has the most open items (${worst.issues}). I’d start there given the Nov 14 cut-off.` : 'They’re all clean.'}` : 'No drafts open.', card: { t: 'drafts', ids: d.map(x => x.id) }, trace: ['Scanned your workspace', 'Ran validation on each draft'], chips: worst?.issues ? [`Fix ${worst.brand}`, 'Set up a new model'] : ['Set up a new model'] }] })
  }
  if (brandsIn[0]) {
    const r = brandsIn[0]
    return keep({ ctx: r.id, out: [{ text: `**${modelName(r)}** · ${r.version}, ${STATUS_LABEL[r.status].toLowerCase()}${r.issues ? `, ${r.issues} open items` : ''}.${r.fresh !== 'Current' ? ` Heads up: its feed is **${r.fresh.toLowerCase()}**.` : ''}`, card: { t: 'model', id: r.id }, chips: r.status === 'Draft' ? [r.issues ? `Fix ${r.brand}` : `Finalise ${r.brand}`, 'Compare with another model'] : [`Compare ${r.brand} with ${vis.find(m => m.id !== r.id && m.status !== 'Draft')?.brand}`, 'Show my drafts'] }] })
  }
  if (/finalis|available|published|live|forecaster/.test(s)) {
    const p = vis.filter(m => m.status !== 'Draft')
    return keep({ out: [{ text: `**${p.filter(m => m.status === 'Published').length} models** are live for forecasters.${p.some(m => m.fresh === 'Delayed') ? ' One has a delayed feed, so its forecasters see a freshness warning.' : ''}`, card: { t: 'catalog', ids: p.map(m => m.id) }, chips: ['Show my drafts'] }] })
  }
  const kb = kbFor(s)
  if (/which (engine|archetype)|what (engine|archetype)|suit|fit|best for/.test(s) && kb[0]) return keep({ out: [{ text: `For **${kb[0][1]}**, the closest precedent is **${ARCH(kb[0][2]).name}**. ${kb[0][3]} It’s your call; here are the closest alternatives:`, card: { t: 'archs', ids: [kb[0][2], ...ALTS[kb[0][2]]] }, chips: [`Set up a ${kb[0][1]} model`] }] })
  if (archIn(s) && !/archetypes/.test(s)) { const a = archIn(s)!; return keep({ out: [{ text: `**${ARCH(a).name}** (${a}) models *${ARCH(a).state.toLowerCase()}*, counted in ${ARCH(a).unit.toLowerCase()}.`, card: { t: 'archs', ids: [a] }, chips: [`How is it different from ${ARCH(ALTS[a][0]).name}?`] }] }) }
  if (/archetype|engine/.test(s)) return keep({ out: [{ text: 'There are seven governed engines. Each one fixes *what is being counted*; modes and modules configure it. Ask about any one, or tell me the indication and I’ll show the closest fit.', card: { t: 'archs', ids: ARCHETYPES.map(a => a.id) }, chips: ['Which engine suits RSV?', 'Rx-Share vs Prevalent-Share?'] }] })
  if (/module/.test(s)) return keep({ out: [{ text: `The library has **${MODULES.length} modules** across ${CATS.length - 1} families. Each engine requires some of them and recommends others. When we set up a model, I wire the required ones and pre-select the recommended ones for you to review.`, chips: ['Set up a new model'] }] })
  if (/help|what can you/.test(s)) return keep({ out: [{ text: 'I can work through anything in the CoE with you, right here in the chat: **set up a model end to end**, **clear blocking issues**, **finalise** drafts, **compare** models and versions, and explain engines, modes and modules. I propose and you decide; nothing is saved without your OK.', chips: ['Set up a new model', 'Show my drafts', 'Compare Cibinqo and Nurtec'] }] })
  return keep({ out: [{ text: `I didn’t quite catch that. I can set up a model, fix or finalise drafts, compare models, or explain how an engine works. Could you say a bit more?`, chips: ['Set up a new model', 'Show my drafts', 'Explain the archetypes'] }] })
}

function createStep(f: CreateFlow, raw: string, models: ModelRow[], resume = false, first = false): Res {
  const s = raw.toLowerCase()
  let g: CreateFlow = { ...f, inds: [...f.inds] }
  const ack: string[] = []
  const known = models.find(m => !m.restricted && s.includes(m.brand.toLowerCase()))
  if (!resume && (g.stage === 'collect' || g.stage === 'review')) {
    const named = raw.match(/(?:for|called|brand|named)\s+([A-Z][\w-]+(?:\s[A-Z][\w-]+)?)/)?.[1]
    const b = known?.brand ?? (named && !/^(US|EU5|OP|LRP|Japan|China|Global)$/.test(named) ? named : undefined) ?? (g.asked === 'brand' && raw.trim().split(/\s+/).length <= 3 ? raw.trim().replace(/^./, c => c.toUpperCase()) : undefined)
    if (b && b !== g.brand) { g.brand = b; ack.push(`brand **${b}**`) }
    for (const [r, v] of MARKETS) if (r.test(s) && v !== g.market) { g.market = v; ack.push(`market **${v}**`); break }
    for (const [r, v] of CYC) if (r.test(s) && v !== g.cycle) { g.cycle = v; ack.push(`cycle **${v}**`); break }
    const found = kbFor(s).map(k => ({ name: k[1], rec: k[2], why: k[3] }))
    if (!found.length && g.asked === 'inds' && raw.trim() && !b) raw.split(/,| and /).map(x => x.trim()).filter(Boolean).forEach(n => { const k = recFor(n); found.push({ name: n.replace(/^./, c => c.toUpperCase()), rec: k[2], why: k[3] }) })
    found.forEach(x => { if (!g.inds.some(i => i.name === x.name)) { g.inds.push(x); ack.push(`stream **${x.name}**`) } })
    if (known && known.inds[0] && !g.inds.length && first) known.inds.forEach(i => { const k = recFor(i.name); g.inds.push({ name: i.name, rec: k[2], why: k[3] }) })
  }
  const lead = ack.length ? `Got it: ${ack.join(', ')}. ` : ''

  if (g.stage === 'collect') {
    const miss = !g.brand ? 'brand' : !g.inds.length ? 'inds' : !g.market ? 'market' : !g.cycle ? 'cycle' : undefined
    const title = g.brand ? `New model · ${g.brand}` : undefined
    if (miss) {
      g.asked = miss
      const q = { brand: ['Which brand is this model for?', ['Velsipity', 'Hympavzi', 'Litfulo']], inds: [`Which indications${g.brand ? ` does ${g.brand} need` : ''}? Each one becomes a stream with its own engine.`, ['Ulcerative colitis', 'Crohn’s disease', 'Atopic dermatitis']], market: ['Which market?', ['US', 'EU5', 'Japan', 'Global']], cycle: ['And which planning cycle does it feed?', CYCLES.map(c => `${c.name} (due ${c.due})`)] }[miss] as [string, string[]]
      return { flow: g, title, out: [{ text: `${first && !ack.length ? 'Happy to build this with you. I’ll ask a few questions, fill in the setup as we go, and you approve each step. ' : lead}${q[0]}`, card: first && !ack.length ? undefined : { t: 'draft' }, chips: q[1] }] }
    }
    g.stage = 'arch'; g.asked = undefined
    const nx = g.inds.find(i => !i.arch)!
    return { flow: g, title, out: [{ text: `${lead}That’s the setup complete.`, card: { t: 'draft' }, trace: ['Matched indications to 37 precedent models'] }, { text: `Now the engine for **${nx.name}**. Based on precedent, **${ARCH(nx.rec).name}** is the closest fit, but it’s your call.`, card: { t: 'arch', ind: nx.name, rec: nx.rec, why: nx.why } }] }
  }
  if (g.stage === 'arch') {
    const k = g.inds.findIndex(i => !i.arch); const cur = g.inds[k]
    if (resume) return { flow: g, out: [{ text: `Where we left off: which engine for **${cur.name}**?`, card: { t: 'arch', ind: cur.name, rec: cur.rec, why: cur.why } }] }
    if (/compare|difference|options|alternatives/.test(s)) return { flow: g, out: [{ text: 'Side by side. The key question is *what is being counted*:', card: { t: 'archs', ids: [cur.rec, ...ALTS[cur.rec]] } }, { text: `Which should **${cur.name}** use?`, card: { t: 'arch', ind: cur.name, rec: cur.rec, why: cur.why } }] }
    const pick = archIn(s) ?? (yes(s) || /recommend|suggest|closest|your pick/.test(s) ? cur.rec : undefined)
    if (!pick) return { flow: g, out: [{ text: `Sorry, which engine should **${cur.name}** run on? Pick one below, or ask me to compare them.`, card: { t: 'arch', ind: cur.name, rec: cur.rec, why: cur.why } }] }
    g.inds[k] = { ...cur, arch: pick }
    const note = pick !== cur.rec ? ` Good call. Bear in mind ${ARCH(pick).name} counts ${ARCH(pick).unit.toLowerCase()}, so I’ll adjust the conversion modules to match.` : ''
    const nx = g.inds.find(i => !i.arch)
    if (nx) return { flow: g, out: [{ text: `**${cur.name} → ${ARCH(pick).name}**.${note} Next up, **${nx.name}**:`, card: { t: 'arch', ind: nx.name, rec: nx.rec, why: nx.why } }] }
    g.stage = 'modes'; g.modes = g.inds.map(i => Object.fromEntries(MODES[i.arch!].map(m => [m.id, m.def ?? m.options[0]])))
    return { flow: g, out: [{ text: `**${cur.name} → ${ARCH(pick).name}**.${note} I’ve pre-set each engine’s modes from the closest precedent. Change anything below, or just tell me (e.g. “make share typed”).`, card: { t: 'modes' }, trace: ['Applied precedent defaults', 'Checked mode compatibility'] }] }
  }
  if (g.stage === 'modes') {
    if (resume) return { flow: g, out: [{ text: 'We were reviewing modes:', card: { t: 'modes' } }] }
    const hits: string[] = []
    g.modes = g.modes.map((rec, k) => { const r = { ...rec }; MODES[g.inds[k].arch!].forEach(m => m.options.forEach(o => { if (s.includes(o.toLowerCase()) && r[m.id] !== o) { r[m.id] = o; hits.push(`${m.label} → **${o}**`) } })); return r })
    if (hits.length) return { flow: g, out: [{ text: `Updated ${hits.join(', ')}. Anything else, or shall we move to modules?`, card: { t: 'modes' }, chips: ['Modes look good'] }] }
    if (!yes(s) && !/modes look good|move on|modules/.test(s)) return { flow: g, out: [{ text: 'Which mode should I change? Name the option (for example “three-level”), or say **looks good** to continue.', card: { t: 'modes' } }] }
    const { req, rec } = modsFor(g.inds.map(i => i.arch!)); g.mods = [...req, ...rec].map(m => m.id); g.stage = 'modules'
    return { flow: g, out: [{ text: `Modes locked in. I’ve wired **${req.length} required** modules and pre-selected **${rec.length} recommended** ones. Untick anything you don’t need. I’ve left out modules that won’t work with these engines.`, card: { t: 'modules' }, trace: ['Resolved module dependencies', 'Excluded incompatible modules'] }] }
  }
  if (g.stage === 'modules') {
    if (resume) return { flow: g, out: [{ text: 'We were picking modules:', card: { t: 'modules' } }] }
    const m = MODULES.find(x => s.includes(x.name.toLowerCase().split(/[ &]/)[0]) && s.length > 4 && /add|remove|drop|include|without/.test(s))
    if (m) { const { req } = modsFor(g.inds.map(i => i.arch!)); if (req.includes(m)) return { flow: g, out: [{ text: `**${m.name}** is required by the engine, so it has to stay.`, card: { t: 'modules' } }] }; const on = /add|include/.test(s); g.mods = on ? [...new Set([...g.mods, m.id])] : g.mods.filter(x => x !== m.id); return { flow: g, out: [{ text: `${on ? 'Added' : 'Removed'} **${m.name}**.`, card: { t: 'modules' }, chips: ['Modules look good'] }] } }
    if (!yes(s) && !/modules look good|review|move on/.test(s)) return { flow: g, out: [{ text: 'Tell me what to add or remove, or say **looks good** and I’ll run the checks.', card: { t: 'modules' } }] }
    g.stage = 'review'
    const warn = createChecks(g).filter(c => !c.ok).length
    return { flow: g, out: [{ text: `Here’s the full model. I ran the same validation the gate uses. ${warn ? `**${warn}** data sources still need attaching; that’s normal at this point and you can save as a draft now.` : 'Everything passes.'}`, card: { t: 'review' }, trace: ['Built the module map', 'Ran validation gate'] }] }
  }
  if (g.stage === 'review') {
    if (resume || ack.length) return { flow: g, out: [{ text: `${lead}Here’s the updated summary:`, card: { t: 'review' } }] }
    const fin = /finali/.test(s), save = fin || /save|draft|yes|ok|do it/.test(s)
    if (!save) return { flow: g, out: [{ text: 'Should I save it? You can also tell me what to change, e.g. “change market to EU5”.', card: { t: 'review' } }] }
    const warn = createChecks(g).filter(c => !c.ok).length
    const id = `c${Date.now()}`
    const row: ModelRow = { id, brand: g.brand!, inds: g.inds.map(i => ({ name: i.name, arch: ARCH(i.arch!).name })), market: g.market!, cycle: g.cycle!, version: 'v1.0 draft', status: 'Draft', fresh: 'Current', issues: warn, updated: 'Just now', by: 'You', step: 5, versions: [] }
    g.stage = 'done'; g.savedId = id
    return { flow: g, ctx: id, add: row, out: [{ text: `${fin ? `Finalising stays with you in the configurator, so I’ve **saved it as a draft**. ` : `**Saved.** `}${modelName(row)} is in your workspace as v1.0 draft.${warn ? ' Want to clear the open items now?' : ''}`, card: { t: 'saved', id }, trace: ['Created v1.0 draft', 'Logged to audit trail'], chips: warn ? [`Fix ${row.brand}`, 'Show my drafts'] : [`Finalise ${row.brand}`, 'Show my drafts'] }] }
  }
  return { flow: g, out: [] }
}

function fixStep(f: FixFlow, raw: string, models: ModelRow[], resume = false, first = false): Res {
  const s = raw.toLowerCase()
  const r = models.find(m => m.id === f.modelId)!
  const items = issuesFor(r)
  const g: FixFlow = { ...f, picks: { ...f.picks } }
  const decs = items.filter(i => i.decide !== undefined).map(i => i.decide!)
  const open = () => decs.find(k => !g.picks[k])
  const head: Out[] = first ? [{ text: items.length ? `**${r.brand}** has **${items.length} open items**. I’ve worked out a fix for each one. Nothing is changed until you approve.` : `**${r.brand}** is clean, nothing to fix.`, card: items.length ? { t: 'issues', id: r.id, items } : undefined, trace: ['Ran validation gate', 'Looked up rebate tables, price master and product master'] }] : []
  if (!items.length) return { flow: undefined, ctx: r.id, out: head }
  if (g.stage === 'arch' && !resume) {
    const k = open()
    if (k !== undefined) { const cur = recFor(r.inds[k].name); const pick = archIn(s) ?? (yes(s) || /recommend|suggest/.test(s) ? cur[2] : undefined); if (pick) g.picks[k] = pick }
  }
  const k = open()
  if (k !== undefined) { g.stage = 'arch'; const cur = recFor(r.inds[k].name); return { flow: g, ctx: r.id, out: [...head, { text: `${first ? 'One needs your decision first. ' : ''}Which engine should **${r.inds[k].name}** run on?`, card: { t: 'arch', ind: r.inds[k].name, rec: cur[2], why: cur[3] } }] } }
  if (g.stage !== 'confirm' || resume) { g.stage = 'confirm'; return { flow: g, ctx: r.id, out: [...head, { text: `${Object.keys(g.picks).length ? 'Thanks, noted. ' : ''}Shall I apply ${items.length > 1 ? `all ${items.length} fixes` : 'the fix'}? You can undo it from the version history.`, chips: ['Apply the fixes', 'Not yet'] }] } }
  if (/not yet|no|later|hold/.test(s)) return { flow: undefined, ctx: r.id, out: [{ text: `No problem, **${r.brand}** is unchanged. Just say “fix ${r.brand}” when you’re ready.` }] }
  if (!yes(s) && !/apply/.test(s)) return { flow: g, ctx: r.id, out: [{ text: 'Should I apply them?', chips: ['Apply the fixes', 'Not yet'] }] }
  const inds = r.inds.map((i, j) => g.picks[j] ? { ...i, arch: ARCH(g.picks[j]).name } : i)
  return { flow: { ...g, stage: 'done' }, ctx: r.id, patch: { id: r.id, p: { issues: 0, inds, fresh: 'Current', updated: 'Just now', by: 'You' } },
    out: [{ text: `Done. **${r.brand}** is clean and ready for the validation gate.`, card: { t: 'diff', lines: items.map(i => ({ kind: i.decide !== undefined ? '+' as const : '~' as const, text: i.decide !== undefined ? `${r.inds[i.decide].name} → ${ARCH(g.picks[i.decide]).name}` : i.fix })) }, trace: [`Applied ${items.length} changes`, 'Re-ran validation: 0 blocking', 'Saved to version history'], chips: [`Finalise ${r.brand}`, 'Show my drafts'] }] }
}

function Md({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((p, k) => p.startsWith('**') ? <strong key={k} className="font-semibold text-text">{p.slice(2, -2)}</strong> : p.startsWith('*') && p.length > 2 ? <em key={k}>{p.slice(1, -1)}</em> : p)}</>
}
const cardCls = 'mt-3 overflow-hidden rounded-xl border border-border bg-surface'
const CardHead = ({ icon: I, title, meta }: { icon: typeof House; title: string; meta?: ReactNode }) => (
  <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-2.5"><I size={14} className="text-brand" /><p className="flex-1 text-[13px] font-semibold">{title}</p>{meta && <span className="text-[11px] text-text-3">{meta}</span>}</div>
)
const pill = (st: MStatus) => <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', st === 'Draft' ? 'bg-surface-2 text-text-2' : st === 'Published' ? 'bg-ok/10 text-ok' : 'bg-brand-soft text-brand')}>{STATUS_LABEL[st]}</span>

function ChatCard({ c, th, live, models, send, setFlow }: { c: Card; th: Thread; live: boolean; models: ModelRow[]; send: (t: string) => void; setFlow: (f: Flow) => void }) {
  const cf = th.flow?.kind === 'create' ? th.flow : undefined
  const row = (id: string) => models.find(m => m.id === id)
  const ModelLine = ({ m, action }: { m: ModelRow; action?: ReactNode }) => (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{modelName(m)} <span className="font-normal text-text-3">· {m.version}</span></p><p className="truncate text-xs text-text-3">{m.inds.map(i => i.name).join(', ')} · {m.cycle}</p></div>
      {m.issues > 0 ? <span className="flex items-center gap-1 text-xs text-warn"><AlertTriangle size={12} />{m.issues}</span> : pill(m.status)}{action}
    </li>
  )
  switch (c.t) {
    case 'draft': if (!cf) return null; return (
      <div className={cardCls}><CardHead icon={FileText} title={cf.brand ? `${cf.brand} · new model` : 'New model'} meta="Filling in as we talk" />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-[13px] sm:grid-cols-4">
          {([['Brand', cf.brand], ['Market', cf.market], ['Cycle', cf.cycle], ['Streams', cf.inds.map(i => i.name).join(', ')]] as const).map(([k, v]) => <div key={k}><dt className="text-[11px] text-text-3">{k}</dt><dd className={cx('font-medium', !v && 'text-text-3')}>{v || '—'}</dd></div>)}
        </dl>
      </div>)
    case 'arch': {
      const fx = th.flow?.kind === 'fix' ? th.flow : undefined
      const fixRow = fx && row(fx.modelId)
      const chosen = cf?.inds.find(i => i.name === c.ind)?.arch ?? (fx && fixRow ? fx.picks[fixRow.inds.findIndex(i => i.name === c.ind)] : undefined)
      return (
        <div className={cardCls}><CardHead icon={Workflow} title={`Engine for ${c.ind}`} meta={chosen ? 'Decided' : 'Your call'} />
          <div className="grid gap-2 p-3 sm:grid-cols-3">
            {[c.rec, ...ALTS[c.rec]].map(id => { const a = ARCH(id); const on = chosen === id; return (
              <button key={id} type="button" disabled={!live} onClick={() => send(`Use ${a.name} for ${c.ind}`)}
                className={cx('rounded-lg border p-3 text-left transition-colors', on ? 'border-brand bg-brand-soft' : 'border-border', live && 'hover:border-brand', !live && !on && 'opacity-50')}>
                <span className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold">{a.name}</span>{id === c.rec && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">Closest fit</span>}{on && id !== c.rec && <Check size={14} className="text-brand" />}</span>
                <span className="mt-0.5 block text-[11px] text-text-3">{a.state} · {a.unit}</span>
                <span className="mt-1.5 block text-xs text-text-2">{id === c.rec ? c.why : a.desc}</span>
              </button>) })}
          </div>
        </div>) }
    case 'modes': if (!cf) return null; return (
      <div className={cardCls}><CardHead icon={SlidersHorizontal} title="Modes" meta={live ? 'Editable' : 'Locked in'} />
        <div className="divide-y divide-border">{cf.inds.map((ind, k) => (
          <div key={ind.name} className="px-4 py-3"><p className="mb-2 text-xs font-semibold text-text-2">{ind.name} · {ARCH(ind.arch!).name}</p>
            <div className="grid gap-3 sm:grid-cols-2">{MODES[ind.arch!].map(m => (
              <label key={m.id} className="block text-[12px]"><span className="text-text-3">{m.label}</span>
                <select disabled={!live} value={cf.modes[k]?.[m.id]} onChange={e => setFlow({ ...cf, modes: cf.modes.map((r, j) => j === k ? { ...r, [m.id]: e.target.value } : r) })} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px] disabled:bg-background">
                  {m.options.map(o => <option key={o}>{o}</option>)}
                </select></label>))}</div></div>))}</div>
        {live && <div className="border-t border-border px-4 py-2.5"><Btn size="sm" onClick={() => send('Modes look good')}>Modes look good</Btn></div>}
      </div>)
    case 'modules': { if (!cf) return null; const { req, rec } = modsFor(cf.inds.map(i => i.arch!)); return (
      <div className={cardCls}><CardHead icon={Boxes} title="Module map" meta={`${cf.mods.length} selected`} />
        <ul className="grid gap-x-4 px-4 py-2 sm:grid-cols-2">{[...req, ...rec].map(m => { const isReq = req.includes(m); const on = cf.mods.includes(m.id); return (
          <li key={m.id}><label className={cx('flex items-start gap-2.5 py-1.5 text-[13px]', (isReq || !live) ? 'cursor-default' : 'cursor-pointer')}>
            <input type="checkbox" className="mt-0.5 accent-[var(--color-brand,#0000C9)]" checked={on} disabled={isReq || !live} onChange={() => setFlow({ ...cf, mods: on ? cf.mods.filter(x => x !== m.id) : [...cf.mods, m.id] })} />
            <span className="min-w-0"><span className="font-medium">{m.name}</span>{isReq && <Lock size={10} className="ml-1 inline text-text-3" />}<span className="block truncate text-[11px] text-text-3">{m.cat}</span></span></label></li>) })}</ul>
        {live && <div className="border-t border-border px-4 py-2.5"><Btn size="sm" onClick={() => send('Modules look good')}>Looks good, run checks</Btn></div>}
      </div>) }
    case 'review': { if (!cf) return null; const checks = createChecks(cf); return (
      <div className={cardCls}><CardHead icon={ShieldCheck} title={`${cf.brand} · ${cf.market} · ${cf.cycle}`} meta="Validation" />
        <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
          <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Streams</p>{cf.inds.map(i => <p key={i.name} className="flex items-center gap-2 py-0.5 text-[13px]"><Workflow size={12} className="text-brand" />{i.name} <span className="text-text-3">→ {ARCH(i.arch!).name}</span></p>)}</div>
          <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Checks</p>{checks.map(k => <p key={k.text} className="flex gap-2 py-0.5 text-[13px]">{k.ok ? <CheckCircle2 size={14} className="mt-px shrink-0 text-ok" /> : <AlertTriangle size={14} className="mt-px shrink-0 text-warn" />}<span className={k.ok ? '' : 'text-text-2'}>{k.text}</span></p>)}</div>
        </div>
        {live && <div className="flex gap-2 border-t border-border px-4 py-2.5"><Btn size="sm" onClick={() => send('Save it as a draft')}>Save as draft</Btn><span className="self-center text-[12px] text-text-3">You finalise it in the configurator.</span></div>}
      </div>) }
    case 'saved': case 'model': { const m = row(c.id); if (!m) return null; return (
      <div className={cardCls}><CardHead icon={c.t === 'saved' ? CheckCircle2 : Layers} title={modelName(m)} meta={pill(m.status)} />
        <div className="grid gap-4 px-4 py-3 text-[13px] sm:grid-cols-3">
          <div><p className="text-[11px] text-text-3">Version</p><p className="font-medium">{m.version}</p></div>
          <div><p className="text-[11px] text-text-3">Cycle</p><p className="font-medium">{m.cycle}</p></div>
          <div><p className="text-[11px] text-text-3">Updated</p><p className="font-medium">{m.updated} · {m.by}</p></div>
        </div>
        <div className="border-t border-border px-4 py-2.5">{m.inds.map(i => <p key={i.name} className="flex items-center gap-2 py-0.5 text-[13px]"><Workflow size={12} className="text-brand" />{i.name}<span className="text-text-3">→ {i.arch || <span className="text-warn">no engine yet</span>}</span></p>)}</div>
        {m.versions.length > 0 && <ol className="border-t border-border px-4 py-2.5">{m.versions.map(v => <li key={v.v} className="flex gap-3 py-1 text-xs"><span className="w-10 font-mono font-semibold">{v.v}</span><span className="w-14 text-text-3">{v.date}</span><span className="flex-1 text-text-2">{v.note}</span><span className="text-text-3">{v.scenarios} scen.</span></li>)}</ol>}
      </div>) }
    case 'drafts': case 'catalog': { const rs = c.ids.map(row).filter(Boolean) as ModelRow[]; return (
      <div className={cardCls}><CardHead icon={c.t === 'drafts' ? FileText : CheckCircle2} title={c.t === 'drafts' ? 'Your drafts' : 'Finalised & live'} meta={`${rs.length} models`} />
        <ul className="divide-y divide-border">{rs.map(m => <ModelLine key={m.id} m={m} action={live && <button type="button" onClick={() => send(m.status === 'Draft' ? (m.issues ? `Fix ${m.brand}` : `Finalise ${m.brand}`) : `Tell me about ${m.brand}`)} className="text-xs font-semibold text-brand hover:underline">{m.status === 'Draft' ? (m.issues ? 'Fix' : 'Finalise') : 'Open'}</button>} />)}</ul>
      </div>) }
    case 'issues': return (
      <div className={cardCls}><CardHead icon={AlertTriangle} title={`Open items · ${row(c.id)?.brand}`} meta={`${c.items.length} items`} />
        <ul className="divide-y divide-border">{c.items.map(i => <li key={i.text} className="grid gap-1 px-4 py-2.5 text-[13px] sm:grid-cols-2 sm:gap-4"><span className="flex gap-2"><AlertCircle size={14} className="mt-px shrink-0 text-warn" />{i.text}</span><span className="flex gap-2 text-text-2"><ArrowRight size={13} className="mt-0.5 shrink-0 text-brand" />{i.fix}</span></li>)}</ul>
      </div>)
    case 'diff': return (
      <div className={cardCls}><CardHead icon={GitBranch} title="Changes applied" meta="Undo from version history" />
        <ul className="px-4 py-2 font-mono text-xs">{c.lines.map(l => <li key={l.text} className="flex gap-2 py-1"><span className={l.kind === '+' ? 'text-ok' : 'text-brand'}>{l.kind}</span><span className="text-text-2">{l.text}</span></li>)}</ul>
      </div>)
    case 'compare': { const rs = c.ids.map(row).filter(Boolean) as ModelRow[]; const rows: [string, (m: ModelRow) => string][] = [['Status', m => STATUS_LABEL[m.status]], ['Version', m => m.version], ['Market', m => m.market], ['Cycle', m => m.cycle], ['Streams', m => String(m.inds.length)], ['Engines', m => [...new Set(m.inds.map(i => i.arch || '—'))].join(', ')], ['Feed', m => m.fresh], ['Scenarios (latest)', m => String(m.versions[0]?.scenarios ?? '—')], ['Updated', m => `${m.updated} · ${m.by}`]]; return (
      <div className={cardCls}><CardHead icon={ArrowUpDown} title="Comparison" />
        <table className="w-full text-[13px]"><thead><tr className="border-b border-border text-left"><th className="px-4 py-2 font-normal text-text-3" />{rs.map(m => <th key={m.id} className="px-4 py-2 font-semibold">{m.brand}</th>)}</tr></thead>
          <tbody>{rows.map(([k, fn]) => { const vals = rs.map(fn); const diff = new Set(vals).size > 1; return <tr key={k} className="border-b border-border last:border-0"><td className="px-4 py-2 text-text-3">{k}</td>{vals.map((v, j) => <td key={j} className={cx('px-4 py-2', diff && 'bg-brand-soft/50 font-medium')}>{v}</td>)}</tr> })}</tbody></table>
      </div>) }
    case 'archs': return (
      <div className={cx('mt-3 grid gap-2', c.ids.length > 1 && 'sm:grid-cols-2')}>{c.ids.map(id => { const a = ARCH(id); return (
        <div key={id} className="rounded-xl border border-border bg-surface p-3.5"><p className="flex items-baseline gap-2 text-[13px] font-semibold">{a.name}<span className="font-mono text-[10px] font-normal text-text-3">{id}</span></p>
          <p className="text-[11px] text-text-3">{a.state} · counts {a.unit.toLowerCase()}</p><p className="mt-1.5 text-xs text-text-2">{a.desc}</p>
          <p className="mt-2 truncate text-[11px] text-text-3">Precedent: {a.ev.slice(0, 3).join(', ')}</p></div>) })}</div>)
  }
}

const CARD_TITLE: Record<Card['t'], string> = { draft: 'New model draft', arch: 'Engine recommendation', modes: 'Setup mode', modules: 'Modules', review: 'Review and publish', saved: 'Saved draft', drafts: 'Your drafts', issues: 'Blocking issues', diff: 'Proposed changes', model: 'Model summary', compare: 'Model comparison', archs: 'Engine options', catalog: 'Model catalog', build: 'Model build' }
const askSrc = {
  taxonomy: { name: 'Model taxonomy v2 (working draft)', kind: 'Model library', detail: 'Seven engine archetypes, when to use each and precedents', meta: 'Updated Oct 2' },
  catalog: { name: 'Model catalog', kind: 'Model library', detail: 'Status, version, freshness and open issues for every model', meta: 'Live' },
  validation: { name: 'Validation rules', kind: 'Policy', detail: 'Checks a draft must pass before it can be published', meta: 'v3.1' },
  publish: { name: 'Publishing policy', kind: 'Policy', detail: 'Who can publish, approvals and version rules', meta: 'Sep 2026' },
  claims: { name: 'Q3 claims extract', kind: 'Data feed', detail: 'Patient and script counts used by share cascades', meta: 'Refreshed Oct 1' },
  fixtures: { name: 'Engine precedent log', kind: 'File', detail: 'Worked examples A-25, A-26, A-31 and notes from reviews', meta: 'PDF · 14 pp' },
  access: { name: 'Data access policy', kind: 'Policy', detail: 'Role-based visibility, the restricted BD partition and which AI handles which questions', meta: 'IAM' },
} satisfies Record<string, Source>
const pickSrc = (...k: (keyof typeof askSrc)[]): Source[] => k.map(x => askSrc[x])

function askCoe(text: string, models: ModelRow[], via: string): Res {
  const s = text.toLowerCase()
  const drafts = models.filter(m => m.status === 'Draft'), pub = models.filter(m => m.status === 'Published')
  const ans = (t: string[], src: Source[], chips?: string[]): Res => ({ out: [{ text: t.join('\n\n'), sources: src, via, chips, trace: ['Understood your question', 'Searched approved sources', 'Cross-checked the figures against the catalog', 'Wrote the answer and listed sources'] }] })
  const mk = models.find(m => s.includes(m.brand.toLowerCase().split(' ')[0]!))
  const ids = ARCHETYPES.filter(a => s.includes(a.name.toLowerCase()) || s.includes(a.id.toLowerCase()))
  const overview = () => ans([`There are **seven governed engines**, and each one fixes *what is being counted*: ${ARCHETYPES.map(a => `**${a.name}** (${a.state.toLowerCase()})`).join(', ')}.`, 'Modes and modules then tune the engine, but the engine choice itself is the decision that is hardest to undo later. If you tell me the indication, I can suggest the closest precedent and explain why it fits.', '**A good next step:** name a disease area and I will recommend an engine, or ask me to compare two of them.'], pickSrc('taxonomy', 'fixtures'), ['Which engine suits RSV?', 'Which engine fits atopic dermatitis?'])
  if (/approv|who can|permission|sign.?off/.test(s)) return ans(['A draft goes live in two steps. First it must pass every **validation check**, and then a **second CoE member approves it**. Only after that does it become available to forecasters.', 'The reason for the second pair of eyes is that forecasters build on the model without being able to change its structure, so a mistake in the engine or inputs flows into every forecast made on it.', `**In practice:** you can finish and submit your own drafts, but you can't approve them. If you want a faster turnaround, clear the open issues first so the reviewer only has to check the decisions, not the errors.`], pickSrc('publish', 'validation'), ['What is blocking my drafts?', 'Which drafts are blocked?'])
  if (/how many (models|drafts)|are published|catalog|all models/.test(s) && !mk) {
    const stale = models.filter(m => m.fresh !== 'Current')
    return ans([`The catalog holds **${models.length} models**: **${pub.length} published** and **${drafts.length} drafts**. ${stale.length} of them have data that is not fully current.`, `Published models are what forecasters can build on, so the drafts are where your attention has the most effect. ${drafts.length ? `${drafts.map(m => m.brand).join(' and ')} ${drafts.length === 1 ? 'is' : 'are'} still in draft.` : ''}`, stale.length ? `**Worth a look:** ${stale.map(m => `${m.brand} (${m.fresh.toLowerCase()})`).join(', ')}. Stale data doesn't block anything, but forecasts built on it can be restated later.` : '**Nothing to chase:** all data is current.'], pickSrc('catalog', 'claims'), ['Which drafts are blocked?', 'Which model data is delayed?'])
  }
  if (/block|stuck|fix|issue|ready|drafts/.test(s) && !mk) {
    const n = drafts.reduce((a, m) => a + m.issues, 0), easy = [...drafts].sort((a, c) => a.issues - c.issues)[0]
    return ans([`You have **${drafts.length} drafts** with **${n} open issues** between them. Here is where each one stands and what it needs before it can go live.`, '## Where your drafts stand', drafts.map(m => `- **${m.brand}** (${m.version}) has **${m.issues} open ${m.issues === 1 ? 'issue' : 'issues'}**, last stopped at step ${m.step ?? 1} of 7, with data that is ${m.fresh.toLowerCase()}.`).join('\n'), '## How publishing works', ['- A draft goes live only when **every validation check passes**.', '- A **second CoE member** must then approve it.', '- One unresolved blocker holds the whole draft back, however complete the rest is.'].join('\n'), easy ? `> **Suggested next step:** start with **${easy.brand}**. It has the fewest open issues, so it is the quickest win and gets one more model in front of forecasters.` : '', '**Want me to pick one up with you?** Tell me which draft matters most before the cycle closes.'].filter(Boolean), pickSrc('catalog', 'validation', 'publish'), ['Continue a model I left in draft'])
  }
  if (mk) {
    const iss = mk.issues, fr = mk.fresh.toLowerCase()
    return ans([`**${mk.brand}** is on **${mk.version}** and is **${mk.status.toLowerCase()}**. Here is a quick read on where it stands.`, '## At a glance', [`- **Scope:** ${mk.inds.map(i => i.name).join(' and ')} in ${mk.market}, for the ${mk.cycle} cycle.`, `- **Engine:** ${mk.inds.map(i => i.arch || 'not chosen yet').filter((x, k, arr) => arr.indexOf(x) === k).join(' and ')}.`, `- **Last updated:** ${mk.updated} by ${mk.by}.`, `- **Data freshness:** ${fr}.`, `- **Open issues:** ${iss}.`].join('\n'), '## What it means', iss > 0 ? `- The ${iss === 1 ? 'issue is' : 'issues are'} the first thing a reviewer will check, so clearing ${iss === 1 ? 'it' : 'them'} first saves a round of back and forth.\n- ${mk.status === 'Draft' ? 'It cannot go live until every validation check passes and a second CoE member approves it.' : 'Forecasters can already build on the published version.'}` : mk.fresh !== 'Current' ? `- The model itself is clean, but its data is ${fr}.\n- Forecasts built on it may be restated when the next refresh lands, so it is worth flagging that to forecasters.` : '- Nothing is blocking it and the data is current.\n- It is in good shape to build on or hand over.', `> **Suggested next step:** ${mk.status === 'Draft' ? `finish ${mk.brand} by clearing its open items, then finalise it.` : iss === 0 && mk.fresh === 'Current' ? 'nothing urgent. If you want to change it, I will save the change as a new draft so the published version stays live.' : 'keep an eye on the data refresh before the next submission.'}`, '**Is this for a review, or are you planning to change it?** Tell me which and I’ll take it from there.'], pickSrc('catalog', 'claims'), [`What changed in ${mk.brand} recently?`, 'Modify an existing model'])
  }
  if (ids.length >= 2) return ans([ids.map(a => `**${a.name}** models ${a.state.toLowerCase()}, counted in ${a.unit.toLowerCase()}.`).join(' '), `The practical difference is what each one remembers. ${ids.map(a => a.desc).join(' ')}`, `**How to choose:** pick ${ids[0]!.name} when ${ids[0]!.state.toLowerCase()} is how the market is really tracked, and ${ids[1]!.name} when ${ids[1]!.state.toLowerCase()} is. If the available data only supports one of them, that usually settles it.`], pickSrc('taxonomy', 'fixtures'), ['Which engine suits RSV?', 'How many engines are there?'])
  if (/how many engines|all engines|which engine does|list.*engines/.test(s)) return overview()
  if (ids.length || /engine|archetype|stock-flow|patient-flow|share|which.*(fit|suit|use)/.test(s)) {
    const kb = kbFor(s)[0]
    if (kb) {
      const alt = ALTS[kb[2]].map(a => ARCH(a).name)
      return ans([`For **${kb[1]}** I would start with the **${ARCH(kb[2]).name}** engine (${kb[2]}). ${kb[3]}`, '## Why this engine', [`- ${ARCH(kb[2]).note}`, `- It counts **${ARCH(kb[2]).unit.toLowerCase()}**, which is how this kind of market is normally tracked.`, `- Precedent in the library points the same way, so the modes and modules come pre-tuned.`].join('\n'), '## Alternatives worth knowing', alt.map(a => `- **${a}**, if your data is organised differently from what I assumed.`).join('\n'), `> **Suggested next step:** treat this as a starting point, not a verdict. If you set it up as a draft, I will confirm the engine against your data in step two before anything is locked in.`, '**What data do you have for this indication?** Patient counts, scripts or market share will tell us whether this engine holds.'], pickSrc('taxonomy', 'fixtures'), ['Create a new model from scratch', 'Create a model using an existing model or template'])
    }
    if (ids[0]) { const a = ids[0]; return ans([`**${a.name}** (${a.id}) models ${a.state.toLowerCase()}, counted in ${a.unit.toLowerCase()}. ${a.desc}`, a.note, a.ev.length ? `**Where it has been used:** ${a.ev.join(', ')}. Those are the best examples to look at if you want to see it in practice.` : '**Where it fits:** it is newer, so there are few worked examples yet. I would pair it with a CoE review.'], pickSrc('taxonomy', 'fixtures'), ['How many engines are there?', 'Which engine suits RSV?']) }
    return overview()
  }
  if (/fresh|delay|stale|data/.test(s)) { const d = models.filter(m => m.fresh !== 'Current'); return ans([`**${d.length} models** have data that is not fully current: ${d.map(m => `${m.brand} (${m.fresh.toLowerCase()})`).join(', ') || 'none'}. The latest claims extract landed on Oct 1.`, 'Delayed data does not stop a model from working, but it means the numbers sit on older history. The risk is a restatement later, which would move forecasts that were already submitted.', `**My suggestion:** ${d[0] ? `check ${d[0].brand} first, since it is the most behind,` : 'no action needed,'} and let forecasters know which brands to treat as provisional.`], pickSrc('claims', 'catalog'), ['Which drafts are blocked?']) }
  return ans([`I can help you understand the engines, check on your drafts, or summarise any model in the catalog. I answer from approved sources and show you which ones, so you can verify anything I say.`, `For example, I can tell you which engine suits a disease area, what is holding a draft back, or where **${models[0]?.brand ?? 'a model'}** stands.`, '**Try one of these to start**, or ask in your own words.'], pickSrc('taxonomy', 'catalog'), ['Which engine suits RSV?', 'What is blocking my drafts?', 'Summarise Cibinqo'])
}

const COE_SRC: Record<Card['t'], (keyof typeof askSrc)[]> = { draft: ['taxonomy', 'validation'], arch: ['taxonomy', 'fixtures'], modes: ['taxonomy'], modules: ['taxonomy'], review: ['validation', 'publish', 'catalog'], saved: ['catalog', 'validation'], drafts: ['catalog', 'validation'], issues: ['catalog', 'validation', 'publish'], diff: ['catalog', 'claims'], model: ['catalog', 'claims'], compare: ['catalog', 'taxonomy'], archs: ['taxonomy', 'fixtures'], catalog: ['catalog', 'claims'], build: ['taxonomy', 'validation', 'claims'] }
const COE_TAKE: Partial<Record<Card['t'], string>> = {
  draft: '**Why this order:** I set up the basics first because the engine, modules and data all depend on them. You can change anything here and nothing is saved until you approve it.',
  arch: '**My view:** the recommendation is based on the closest precedent in the library, but you know your data best. If the alternatives look closer to how you track the market, pick one and I will adjust the plan.',
  issues: '**Where I would start:** the first item, since the others often resolve once it is fixed. I will apply each fix only after you confirm it.',
  drafts: '**A suggestion:** pick the draft with the fewest issues to finish first. It is the quickest win and one more model reaches forecasters.',
  compare: '**What to look for:** the differences in engine and data freshness matter most, since those are what change how far you can trust each forecast.',
  model: '**My take:** use this summary to decide whether to continue, finalise or hand over. I can take either next step for you.',
}

/* ───────── Agent model build: the same seven steps as the configurator, with approvals at the key checkpoints ───────── */
const BUILD_GATE = [true, true, false, true, true, false, true]
const BUILD_WORK: string[][] = [
  ['Reading your request', 'Matching it to 37 precedent models', 'Filling in market and cycle'],
  ['Comparing the indication with precedent', 'Checking engine fit', 'Preparing a recommendation'],
  ['Applying precedent defaults', 'Checking mode compatibility'],
  ['Resolving module dependencies', 'Excluding incompatible modules', 'Building the module map'],
  ['Looking up connected sources', 'Mapping inputs to sources', 'Checking history coverage'],
  ['Running the validation gate', 'Checking totals and dependencies'],
  ['Preparing version v1.0', 'Packaging the hand-off'],
]
const DATA_SRC: Record<string, string> = { epi: 'Epidemiology registry extract', age: 'Census age-structure tables', g2n: 'Rebate and discount tables', price: 'Price master' }
const BUILD_ASK: Record<number, string> = {
  1: '**Step 1 of 7 · Model setup.** I’ve filled in the basics from your request. Please check the brand, market and cycle, then approve.',
  2: '**Step 2 of 7 · Archetype.** I’ve picked the closest engine from precedent for each indication. Change it if you know better, then approve.',
  4: '**Step 4 of 7 · Module map.** The required modules are locked in and I’ve pre-selected the recommended ones. Untick anything you don’t need, then approve.',
  5: '**Step 5 of 7 · Data configuration.** I’ve mapped each input to a connected source. Approve to attach them.',
  7: '**Step 7 of 7 · Hand-off.** Everything is built and checked. I’ll save it as a draft; finalising it for forecasters stays with you in the configurator.',
}
const buildFlow = (b: Build): CreateFlow => ({ kind: 'create', brand: b.brand, market: b.market, cycle: b.cycle, inds: b.inds, stage: 'review', modes: [], mods: b.mods })
const buildOpen = (b: Build) => (b.dataOk ? 0 : createChecks(buildFlow(b)).filter(c => !c.ok).length)

function startBuild(raw: string, models: ModelRow[]): Build {
  const s = raw.toLowerCase(), kb = kbFor(s)
  const known = models.find(m => !m.restricted && s.includes(m.brand.toLowerCase()))
  const named = raw.match(/(?:called|brand|named)\s+([A-Z][\w-]+)/)?.[1] ?? known?.brand
  const mk = (n: string) => { const k = recFor(n); return { name: n, rec: k[2], why: k[3], arch: k[2] } }
  const tail = raw.match(/\bfor\s+(.+?)[.?!]*$/i)?.[1]?.trim()
  const inds = kb.length ? kb.map(k => ({ name: k[1], rec: k[2], why: k[3], arch: k[2] })) : known ? known.inds.map(i => mk(i.name)) : [mk(tail ? tail[0]!.toUpperCase() + tail.slice(1) : 'Indication to confirm')]
  const { req, rec } = modsFor(inds.map(i => i.arch))
  return { brand: named ?? 'New brand', market: MARKETS.find(([r]) => r.test(s))?.[1] ?? 'US', cycle: CYC.find(([r]) => r.test(s))?.[1] ?? 'OP 2027', inds, mods: [...req, ...rec].map(m => m.id), step: 1, phase: 'choose', dataOk: false }
}

function BuildCard({ b, setB, onAwait, onSave, onChoose }: { onChoose: (p: 'step' | 'auto') => void; b: Build; setB: (f: (x: Build) => Build) => void; onAwait: (step: number, b: Build) => void; onSave: (row: ModelRow, kind: 'draft' | 'final') => void }) {
  const [view, setView] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const work = BUILD_WORK[b.step - 1]!
  const bRef = useRef(b); bRef.current = b
  useEffect(() => { setTick(0); setView(null) }, [b.step])
  useEffect(() => {
    if (b.phase !== 'running') return
    const t = window.setInterval(() => setTick(n => n + 1), 420)
    return () => window.clearInterval(t)
  }, [b.phase, b.step])
  useEffect(() => {
    if (b.phase !== 'running' || tick <= work.length) return
    const step = b.step
    const auto = b.pace === 'auto', gated = BUILD_GATE[step - 1] && (!auto || step === 7 || (step === 1 && b.brand === 'New brand'))
    if (gated) { setB(x => x.step === step ? { ...x, phase: 'await' } : x); onAwait(step, bRef.current) }
    else setB(x => x.step === step ? { ...x, step: step + 1, phase: 'running', dataOk: x.dataOk || step === 5 } : x)
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = view ?? b.step
  const awaiting = b.phase === 'await' && shown === b.step
  const running = b.phase === 'running' && shown === b.step
  const archs = b.inds.map(i => i.arch)
  const { req, rec } = modsFor(archs)
  const approve = () => setB(x => {
    const mods = x.step === 2 ? (() => { const m = modsFor(x.inds.map(i => i.arch)); return [...m.req, ...m.rec].map(y => y.id) })() : x.mods
    return { ...x, mods, step: x.step + 1, phase: 'running', dataOk: x.dataOk || x.step === 5 }
  })
  const finish = (kind: 'draft' | 'final') => {
    const open = buildOpen(b), id = b.draftId ?? `c${Date.now()}`
    const row: ModelRow = { id, brand: b.brand, inds: b.inds.map(i => ({ name: i.name, arch: ARCH(i.arch).name })), market: b.market, cycle: b.cycle, version: kind === 'final' ? 'v1.0' : 'v1.0 draft', status: kind === 'final' ? 'Finalised' : 'Draft', fresh: 'Current', issues: open, updated: 'Just now', by: 'You', step: open ? 5 : 7, versions: [] }
    onSave(row, kind); setB(x => ({ ...x, phase: 'done', savedId: id, saved: kind }))
  }
  const toggle = (id: string) => setB(x => ({ ...x, mods: x.mods.includes(id) ? x.mods.filter(m => m !== id) : [...x.mods, id] }))
  const F = ({ label, children }: { label: string; children: ReactNode }) => <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">{label}</p>{children}</div>

  const body = (n: number, edit: boolean) => {
    if (n === 1) return (
      <div className="space-y-3">
        <F label="Brand">{edit ? <input className={inputCls()} value={b.brand} onChange={e => setB(x => ({ ...x, brand: e.target.value }))} aria-label="Brand" /> : <p className="text-sm font-medium">{b.brand}</p>}</F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Market">{edit ? <select className={inputCls()} value={b.market} onChange={e => setB(x => ({ ...x, market: e.target.value }))}>{['US', 'EU5', 'Japan', 'China', 'Global', 'ex-US'].map(m => <option key={m}>{m}</option>)}</select> : <p className="text-sm font-medium">{b.market}</p>}</F>
          <F label="Cycle">{edit ? <select className={inputCls()} value={b.cycle} onChange={e => setB(x => ({ ...x, cycle: e.target.value }))}>{CYCLES.map(c => <option key={c.name}>{c.name}</option>)}</select> : <p className="text-sm font-medium">{b.cycle}</p>}</F>
        </div>
        <F label="Streams">{b.inds.map(i => <p key={i.name} className="text-sm">{i.name}</p>)}</F>
        <p className="text-[12px] text-text-3">I assumed the market and cycle from your request. Each indication becomes a stream with its own engine.</p>
      </div>)
    if (n === 2) return (
      <div className="space-y-3">{b.inds.map((i, k) => (
        <div key={i.name} className="rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">{i.name}</p>
          {edit ? <select className={cx(inputCls(), 'mt-2')} value={i.arch} aria-label={`Engine for ${i.name}`} onChange={e => setB(x => ({ ...x, inds: x.inds.map((y, j) => j === k ? { ...y, arch: e.target.value as ArchId } : y) }))}>{ARCHETYPES.map(a => <option key={a.id} value={a.id}>{a.name}{a.id === i.rec ? ' · recommended' : ''}</option>)}</select> : <p className="mt-1 text-sm">{ARCH(i.arch).name} <span className="text-text-3">({i.arch})</span></p>}
          <p className="mt-2 text-[12px] text-text-2">{i.arch === i.rec ? i.why : `${ARCH(i.arch).name} counts ${ARCH(i.arch).unit.toLowerCase()}, so I’ll adjust the conversion modules to match. The closest precedent was ${ARCH(i.rec).name}.`}</p>
        </div>))}</div>)
    if (n === 3) return (
      <div className="space-y-3">{b.inds.map(i => (
        <div key={i.name} className="rounded-lg border border-border p-3"><p className="text-sm font-semibold">{i.name} <span className="font-normal text-text-3">· {ARCH(i.arch).name}</span></p>
          <dl className="mt-2 space-y-1">{MODES[i.arch].filter(m => !m.optional).map(m => <div key={m.id} className="flex justify-between gap-3 text-[13px]"><dt className="text-text-2">{m.label}</dt><dd className="font-medium">{m.def ?? m.options[0]}</dd></div>)}</dl></div>))}
        <p className="text-[12px] text-text-3">Set from the closest precedent. You can change any mode later in the configurator.</p></div>)
    if (n === 4) return (
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Required · {req.length}</p>
        <ul className="mb-3 space-y-1">{req.map(m => <li key={m.id} className="flex items-center gap-2 text-[13px] text-text-2"><Lock size={12} className="text-text-3" />{m.name}</li>)}</ul>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Recommended · {rec.length}</p>
        <ul className="space-y-1">{rec.map(m => <li key={m.id}><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-brand" disabled={!edit} checked={b.mods.includes(m.id)} onChange={() => toggle(m.id)} />{m.name}</label></li>)}</ul>
      </div>)
    if (n === 5) {
      const dm = [...req, ...rec].filter(m => m.data && b.mods.includes(m.id))
      return (
        <div>{dm.length ? <ul className="divide-y divide-border rounded-lg border border-border">{dm.map(m => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2.5"><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{m.name}</span><span className="block text-[12px] text-text-2">{DATA_SRC[m.data!] ?? 'Claims extract (IQVIA)'}</span></span><Badge tone={b.dataOk || b.step > 5 ? 'ok' : 'brand'}>{b.dataOk || b.step > 5 ? 'Attached' : 'Connected'}</Badge></li>))}</ul>
          : <p className="text-sm text-text-2">None of the selected modules need an external source.</p>}
          <p className="mt-2 text-[12px] text-text-3">Only sources you already have access to. Nothing is uploaded or changed.</p></div>)
    }
    if (n === 6) return <div className="space-y-4"><ModelFlow title={b.brand} meta={`${b.market} · ${b.cycle}`} output="Saved as a draft for you to finalise in the configurator."
      streams={b.inds.map(i => { const m = modsFor([i.arch]), on = [...m.req, ...m.rec].filter(x => b.mods.includes(x.id)); return { name: i.name, arch: ARCH(i.arch).name, modes: MODES[i.arch].filter(x => !x.optional).map(x => x.def ?? x.options[0]!), modules: on.map(x => x.name), data: `${on.filter(x => x.data).length} source${on.filter(x => x.data).length === 1 ? '' : 's'}`, dataSub: b.dataOk ? 'Attached' : 'To attach' } })} /><ul className="space-y-2">{createChecks(buildFlow(b)).map(c => ({ ...c, ok: c.ok || b.dataOk })).map(c => <li key={c.text} className="flex items-start gap-2 text-[13px]">{c.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ok" /> : <AlertCircle size={15} className="mt-0.5 shrink-0 text-warn" />}<span className="text-text-2">{c.text}</span></li>)}</ul></div>
    const open = buildOpen(b)
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-3 text-[13px]"><p className="font-semibold">{b.brand} · {b.market} · {b.cycle}</p>
          {b.inds.map(i => <p key={i.name} className="mt-1 text-text-2">{i.name} → {ARCH(i.arch).name}</p>)}<p className="mt-1 text-text-2">{b.mods.length} modules · {open} open item{open === 1 ? '' : 's'}</p></div>
        {b.phase === 'done' && <div className="flex items-start gap-2 rounded-lg bg-ok-soft p-3 text-[13px] text-ok"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /><span>{b.saved === 'final' ? 'Finalised and available to forecasters.' : 'Saved to your workspace as a draft.'} Find it in the Model workspace.</span></div>}
      </div>)
  }
  if (b.phase === 'choose') return (
    <div>
      <p className="text-[15px] font-semibold">How should I build this?</p>
      <p className="mt-1 text-[13px] text-text-2">The model for <b className="text-text">{b.brand}</b> takes seven steps. You can steer each checkpoint, or let me work from what you have built before.</p>
      <div className="mt-4 grid gap-3">
        {([['step', 'Go step by step', 'I stop for your approval at setup, engine, module map and data sources, then hand it to you at Review.', ListChecks], ['auto', 'Do it for me', 'I use your earlier models as the starting point and stop at Review for you (and to name the brand if it is missing).', Sparkles]] as const).map(([k, t, d, Icon]) => (
          <button key={k} type="button" onClick={() => { setB(x => ({ ...x, pace: k, phase: 'running' })); onChoose(k) }} className="flex items-start gap-3 rounded-xl border border-border p-3.5 text-left transition-colors hover:border-brand hover:bg-brand-soft">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={17} /></span>
            <span><span className="block text-sm font-semibold">{t}</span><span className="block text-[12.5px] text-text-2">{d}</span></span></button>))}
      </div>
    </div>)
  const label = ['Approve setup', 'Approve engines', '', 'Approve module map', 'Attach these sources', '', ''][b.step - 1]
  return (
    <div>
      <ol className="mb-4 flex items-center" aria-label="Model build progress">{STAGES.map((st, k) => {
        const done = b.phase === 'done' || st.id < b.step, cur = st.id === b.step && b.phase !== 'done'
        return <li key={st.id} className="flex flex-1 items-center last:flex-none">
          <button type="button" onClick={() => setView(st.id === b.step ? null : st.id)} disabled={st.id > b.step && b.phase !== 'done'} title={st.title} aria-current={cur ? 'step' : undefined}
            className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors', done ? 'bg-ok text-white' : cur ? 'bg-brand text-white ring-4 ring-brand/15' : 'bg-surface-2 text-text-3')}>{done ? <Check size={13} /> : st.id}</button>
          {k < STAGES.length - 1 && <span className={cx('mx-1 h-px flex-1', done ? 'bg-ok' : 'bg-border-strong')} />}</li> })}</ol>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="text-[15px] font-semibold">Step {shown} · {STAGES[shown - 1]!.title}</p><p className="text-[12px] text-text-3">{STAGES[shown - 1]!.sub}</p></div>
        {awaiting && <Badge tone="warn">Needs your approval</Badge>}{running && <Badge tone="brand">Working</Badge>}{shown < b.step || b.phase === 'done' ? <Badge tone="ok">Done</Badge> : null}
      </div>
      {running ? (
        <ul className="space-y-2 rounded-lg border border-border p-3">{BUILD_WORK[shown - 1]!.map((w, k) => <li key={w} className={cx('flex items-center gap-2 text-[13px]', k < tick ? 'text-text-2' : k === tick ? 'text-text' : 'text-text-3 opacity-50')}>{k < tick ? <Check size={13} className="text-ok" /> : k === tick ? <Loader2 size={13} className="animate-spin text-brand" /> : <span className="h-[13px] w-[13px] rounded-full border border-border-strong" />}{w}</li>)}</ul>
      ) : shown > b.step && b.phase !== 'done' ? <p className="text-sm text-text-3">Not reached yet.</p> : body(shown, awaiting)}
      {awaiting && (
        <div className="sticky bottom-0 -mx-1 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2.5">
          <p className="text-[12.5px] font-medium text-brand">{b.step === 7 ? 'I save it as a draft. You finalise it in the configurator.' : 'Review, change anything, then approve to continue.'}</p>
          <div className="flex gap-2">{b.step === 7 ? <Btn onClick={() => finish('draft')}>Save as draft for review</Btn> : <Btn onClick={approve}>{label}</Btn>}</div>
        </div>)}
    </div>
  )
}

/* ───────── Guided conversations: the six configurator jobs, each asking only for what is missing and confirming before it changes anything ───────── */
const AREAS = ['Revenue streams', 'Archetype and modes', 'Modules', 'Data sources']
const AREA_HELP: Record<string, string> = {
  'Revenue streams': 'A **revenue stream** is one indication of a brand, for example “Multiple myeloma 2L”. Each stream gets its own engine, modes and modules, and the streams roll up into the brand hierarchy. You define them in **Model setup (step 1)** and each one picks its engine in **Archetype (step 2)**.',
  'Archetype and modes': 'The **archetype** is the engine that does the maths for a stream: it decides what is counted (patients, scripts or share) and which modes and modules fit. **Modes** then set how it behaves, such as how share is cascaded. Both are set per stream, in **steps 2 and 3**.',
  Modules: '**Modules** are the building blocks added on top of the engine, such as pricing, access or seasonality. Some are required by the engine and some are recommended. You choose them in **Module map (step 4)**.',
  'Data sources': '**Data configuration (step 5)** says where each input comes from: a connected source, a file or manual entry, and which inputs forecasters can see or edit. Nothing is calculated there. I propose the mappings and you approve them.',
}
const STARTER_CHIPS = ['Create a new model from scratch', 'Continue a model I left in draft', 'Modify an existing model']
const archByNameOr = (n: string, fallback: string): ArchId => ARCHETYPES.find(a => a.name === n)?.id ?? recFor(fallback)[2]
const nextMinor = (v: string) => { const m = v.match(/v(\d+)\.(\d+)/); return m ? `v${m[1]}.${+m[2]! + 1} draft` : 'v1.0 draft' }
const withArch = (b: Build, arch: ArchId): Build => { const inds = b.inds.map(i => ({ ...i, arch })), m = modsFor(inds.map(i => i.arch)); return { ...b, inds, mods: [...m.req, ...m.rec].map(x => x.id) } }
const paceMsg = (pace: 'step' | 'auto', b: Build, models: ModelRow[]) => {
  if (pace === 'step') return 'Step by step it is. I’ll do the work in the sandbox and stop for your approval at each key checkpoint.'
  const names = b.inds.map(i => ARCH(i.arch).name), ref = models.find(m => !m.restricted && m.status === 'Published' && m.inds.some(i => names.includes(i.arch)))
  return `I’ll take it from here. ${ref ? `I’m using your earlier **${ref.brand}** model as the starting point, since it uses the same engine.` : 'I’m using the closest precedent in the library, since none of your earlier models match.'} I’ll only stop to **finalise**${b.brand === 'New brand' ? ', and to ask you for a brand name first' : ''}. You can follow along in the sandbox.`
}
const buildRes = (bl: Build, extra = ''): Res => ({ build: bl, title: `New model · ${bl.brand}`, out: [{ text: `Got it. I’ve started with **${bl.inds.map(i => i.name).join('** and **')}** for **${bl.market}**, cycle **${bl.cycle}**.${extra}\n\nI’ll follow the same seven steps as the configurator. **How would you like to do this?**\n\n- **Go step by step:** I stop for your approval at each key checkpoint.\n- **Do it for me:** I build it from your earlier models and stop at Review.\n\nEither way I never finalise; that stays with you.`, chips: ['Go step by step', 'Do it for me'], card: { t: 'build' }, trace: [] }] })
const say = (text: string, chips?: string[], trace?: string[]): Res => ({ out: [{ text, chips, trace: trace ?? [] }] })

function guided(t: string, intake: Intake | undefined, models: ModelRow[]): { res: Res; intake?: Intake } | null {
  const s = t.toLowerCase().trim(), vis = models.filter(m => !m.restricted), found = vis.find(m => s.includes(m.brand.toLowerCase()))
  const pickArch = (ind: string, text: string) => archIn(text.toLowerCase()) ?? recFor(ind)[2]
  const modelChips = (verb: string, list: ModelRow[]) => list.slice(0, 4).map(m => `${verb} ${m.brand}`)
  const resume = (m: ModelRow): { res: Res; intake?: Intake } => {
    const inds = m.inds.map(i => { const a = archByNameOr(i.arch, i.name), k = recFor(i.name); return { name: i.name, rec: k[2], why: k[3], arch: a } })
    const { req, rec } = modsFor(inds.map(i => i.arch)), step = Math.min(Math.max(m.step ?? 1, 1), 7)
    const bl: Build = { brand: m.brand, market: m.market, cycle: m.cycle, inds, mods: [...req, ...rec].map(x => x.id), step, phase: 'running', dataOk: false, draftId: m.id }
    return { res: { build: bl, title: `Resume · ${m.brand}`, out: [{ text: `Picking up **${m.brand}** (${m.version}) where you left off, at **step ${step} of 7, ${STAGES[step - 1]!.title}**. Steps before that are already done, so I’ll only ask you for what is still open, and I’ll confirm before saving anything.`, card: { t: 'build' }, trace: ['Found your draft', `Read where it stopped (step ${step})`, 'Worked out what is still open'] }] } }
  }

  if (intake && /\b(cancel|never ?mind|stop|discard)\b/.test(s)) return { res: say('No problem, I’ve dropped that and nothing was changed. What would you like to do instead?', STARTER_CHIPS) }

  if (/^create a new model from scratch/.test(s)) return { intake: { kind: 'new', step: 'ind' }, res: say('Happy to. **What do you want to build?** Tell me the indication, and the brand and market if you know them. I’ll ask for anything I still need.', ['Ulcerative colitis for Velsipity', 'RSV in older adults, US', 'Migraine, US']) }
  if (/^create a model using an existing/.test(s)) return { intake: { kind: 'reuse', step: 'ind' }, res: say('Good idea, there is usually a close precedent. **What should the new model achieve, and which engine does it relate to?** For example, a patient-flow oncology model.', ['A patient-flow oncology model', 'A share model for atopic dermatitis', 'A vaccine model for RSV']) }
  if (/^show me how similar patient-flow/.test(s)) {
    const pf = vis.filter(m => m.inds.some(i => i.arch === 'Patient-Flow')), { req } = modsFor(['D-03'])
    return { res: say(`${pf.length ? `**${pf.map(m => m.brand).join('** and **')}** in your workspace use the Patient-Flow engine.` : 'No published models use Patient-Flow yet.'} For this engine the **required** modules are ${req.map(m => `**${m.name}**`).join(', ')}. The recommended ones differ from model to model, so open any of them to compare, or use one as the basis for a new model.`, ['Create a model using an existing model or template', 'Create a new model from scratch'], ['Checking available models', 'Reviewing their configurations', 'Identifying common choices']) }
  }
  if (/^continue a model i left in draft|(continue|resume).{0,20}draft/.test(s)) {
    const ds = vis.filter(m => m.status === 'Draft')
    if (!ds.length) return { res: say('You have no drafts open right now. Want to start a new one?', ['Create a new model from scratch']) }
    if (found && found.status === 'Draft') return resume(found)
    return { intake: { kind: 'draft', step: 'model' }, res: say(`You have **${ds.length} draft${ds.length > 1 ? 's' : ''}**: ${ds.map(m => `**${m.brand}** (${m.version}, stopped at step ${m.step ?? 1})`).join(', ')}. **Which one do you want to continue?**`, modelChips('Continue', ds), ['Checking your drafts', 'Reading where each one stopped']) }
  }
  if (/^modify an existing model|^(modify|change|edit)\b.*\bmodel\b/.test(s)) {
    const pub = vis.filter(m => m.status !== 'Draft')
    if (found) return { intake: { kind: 'modify', step: 'area', model: found.id }, res: say(`Sure, **${found.brand}** (${found.version}). **Which part do you want to change?**`, AREAS) }
    return { intake: { kind: 'modify', step: 'model' }, res: say('Sure. **Which model do you want to modify?**', modelChips('Modify', pub), ['Checking available models']) }
  }
  if (/^help me with a specific part/.test(s)) return { intake: { kind: 'part', step: 'area' }, res: say('Which part of the model do you want help with?', AREAS) }
  const area = AREAS.find(a => s.includes(a.toLowerCase())) ?? (/revenue.?stream|hierarchy/.test(s) ? 'Revenue streams' : undefined)

  if (intake?.kind === 'part' || (!intake && area && /\b(what|how|explain|help|understand)\b/.test(s))) { if (area) return { res: say(AREA_HELP[area]!, ['Create a new model from scratch', 'Modify an existing model']) } }

  if (intake?.kind === 'new' || intake?.kind === 'reuse') {
    if (intake.step === 'ind') {
      const ind = kbFor(s)[0]?.[1] ?? t.replace(/^(a|an)\s+/i, '').replace(/[.?!]+$/, '')
      const rec = recFor(ind), arch = pickArch(ind, t)
      if (intake.kind === 'new') return { intake: { ...intake, step: 'arch', ind, raw: t }, res: say(`For **${ind}** the closest precedent is **${ARCH(rec[2]).name}**: ${rec[3]}\n\n**Which engine do you want to use?**`, [`Use ${ARCH(rec[2]).name} (recommended)`, ...ARCHETYPES.filter(a => a.id !== rec[2]).slice(0, 2).map(a => `Use ${a.name}`)], ['Checking available engines', 'Reviewing similar configurations', 'Identifying applicable choices']) }
      const pb = vis.filter(m => m.status === 'Published' && m.inds.some(i => i.arch === ARCH(arch).name)), list = pb.length ? pb : vis.filter(m => m.status === 'Published')
      return { intake: { ...intake, step: 'basis', ind, arch, raw: t }, res: say(`I reviewed your existing models. **${list.map(m => m.brand).join('**, **')}** ${pb.length ? `use the **${ARCH(arch).name}** engine` : 'are the closest published models'}, and each gives you a ready set of modes and modules to start from.\n\n**Which one should I use as the basis?** I’ll copy its setup and you can adjust it before anything is saved.`, modelChips('Use', list).map(c => `${c} as the basis`), ['Reviewing existing models', 'Comparing their configurations', 'Identifying reusable patterns']) }
    }
    if (intake.step === 'arch') {
      const arch = archIn(s) ?? (/recommend|yes|ok|go ahead|that one|sure/.test(s) ? recFor(intake.ind!)[2] : undefined)
      if (!arch) return { intake, res: say('Which engine should I use? Pick one below, or name it.', [`Use ${ARCH(recFor(intake.ind!)[2]).name} (recommended)`]) }
      return { res: buildRes(withArch(startBuild(`${intake.raw ?? ''} ${intake.ind}`, models), arch), ` I’ll use the **${ARCH(arch).name}** engine.`) }
    }
    if (intake.step === 'basis') {
      const basis = found ?? vis.find(m => m.status === 'Published')!
      const arch = archByNameOr(basis.inds[0]?.arch ?? '', basis.inds[0]?.name ?? ''), bl = withArch(startBuild(intake.raw ?? '', models), arch)
      return { res: buildRes({ ...bl, brand: bl.brand === basis.brand ? 'New brand' : bl.brand }, ` I’m basing it on **${basis.brand}**, so the engine and modules start from its setup.`) }
    }
  }
  if (intake?.kind === 'draft') { const d = found && found.status === 'Draft' ? found : undefined; return d ? resume(d) : { intake, res: say('Which draft should I continue?', modelChips('Continue', vis.filter(m => m.status === 'Draft'))) } }
  if (intake?.kind === 'modify') {
    const m = vis.find(x => x.id === intake.model) ?? found
    if (intake.step === 'model') return found ? { intake: { ...intake, step: 'area', model: found.id }, res: say(`**${found.brand}** (${found.version}). **Which part do you want to change?**`, AREAS) } : { intake, res: say('Which model do you want to modify?', modelChips('Modify', vis.filter(x => x.status !== 'Draft'))) }
    if (intake.step === 'area') return area && m ? { intake: { ...intake, step: 'change', area, model: m.id }, res: say(`What do you want to change in **${area}** for **${m.brand}**? Describe it in your own words.`, area === 'Modules' ? ['Add the access module', 'Remove the seasonality module'] : area === 'Data sources' ? ['Use the claims extract for volume'] : area === 'Revenue streams' ? ['Split into two indications'] : ['Switch the engine to Rx-Share']) } : { intake, res: say('Which part do you want to change?', AREAS) }
    if (intake.step === 'change' && m) return { intake: { ...intake, step: 'confirm', change: t }, res: say(`**Here is what I’ll do. Please confirm.**\n\n**Model:** ${m.brand} (${m.version})\n**Area:** ${intake.area}\n**Change:** ${t}\n\nIt will be saved as a new draft, **${nextMinor(m.version)}**. The published ${m.version} stays live until you finalise.`, ['Confirm change', 'Cancel'], ['Reading the current configuration', `Checking what ${intake.area} affects`, 'Preparing the change']) }
    if (intake.step === 'confirm' && m) {
      if (/confirm|yes|go ahead|apply|ok/.test(s)) return { res: { patch: { id: m.id, p: { status: 'Draft', version: nextMinor(m.version), updated: 'Just now', by: 'You', diff: [{ kind: '~', text: `${intake.area}: ${intake.change}` }] } }, out: [{ text: `Done. **${m.brand}** now has a new draft, **${nextMinor(m.version)}**, with your change to **${intake.area}** noted. The published version is untouched. Open it in the Model workspace to review the details before you finalise.`, chips: STARTER_CHIPS, trace: [] }] } }
      return { intake, res: say('Do you want me to apply this change?', ['Confirm change', 'Cancel']) }
    }
  }
  return null
}

const COE_CARDS: Record<Mode, PromptCard[]> = {
  ask: [],
  agent: [
    { icon: Plus, title: 'Create from scratch', prompts: ['Create a new model from scratch'] },
    { icon: Copy, title: 'Reuse an existing model', prompts: ['Create a model using an existing model or template'] },
    { icon: Clock, title: 'Continue a draft', prompts: ['Continue a model I left in draft'] },
    { icon: Pencil, title: 'Modify a model', prompts: ['Modify an existing model'] },
    { icon: Search, title: 'See similar models', prompts: ['Show me how similar patient-flow models have been configured'] },
    { icon: HelpCircle, title: 'Help with a part', prompts: ['Help me with a specific part of my model'] },
  ],
}
const ACT_COE = /\b(create|set ?up|build|start|configure|modify|change|edit|continue|resume|fix|finali[sz]e|compare|show me my|help me with|similar|use an existing)\b|new model/i
/** Forecast business questions belong to Forecast AI; COE AI stays on model configuration. */
const FORECAST_Q = /\b(net revenue|revenue|net sales|sales forecast|fy ?(?:20)?2\d|base case|optimistic|pessimistic|what moved|scenario range|forecast (?:number|value|figure|outlook)s?|goal seek|hit (?:the|a|my) target)\b/i
function coeScope(t: string): Res | null {
  if (RESTRICTED_RE.test(t) || /\bbd\b/i.test(t)) return { out: [{ text: '**That record is in a restricted partition**, so I can’t read, compare or summarise it.\n\nBD / Pipeline models aren’t visible from the CoE workspace. Request access from the BD lead if you need it.', sources: pickSrc('access'), trace: [] }] }
  if (FORECAST_Q.test(t)) return { out: [{ text: `**That’s a business question about a forecast.** ${AI_EXP.build.label} only works on model configuration: setup, archetypes, modes, modules and data.\n\nAsk it in **${AI_EXP.ask.label}**, in the Forecaster, which answers from submitted and approved forecasts.`, sources: pickSrc('access'), chips: ['Create a new model from scratch', 'Continue a model I left in draft'], trace: [] }] }
  return null
}
const coePartner = (t: string): { q: string; chips: string[] } => {
  const s = t.toLowerCase()
  if (/engine|archetype|suits|fits|differ|stock|share|flow/.test(s)) return { q: '**What are you trying to forecast: patients on therapy, scripts, or a share of a market?** That usually decides the engine. Is this for a model you are about to build?', chips: ['Create a new model from scratch', 'Show me how similar patient-flow models have been configured'] }
  if (/block|draft|rule|approve|publish|review|needs/.test(s)) return { q: '**Which of these matters most before the cycle closes?** I can walk through the blockers with you, one at a time.', chips: ['Continue a model I left in draft', 'Modify an existing model'] }
  if (/status|summar|doing|how is|delayed|published|model/.test(s)) return { q: '**Is this for a review, or are you thinking of changing it?** Tell me which and I’ll take it from there.', chips: ['Modify an existing model', 'Create a model using an existing model or template'] }
  return { q: '**What are you hoping to decide with this?** Knowing that, I can point you to the most useful next step.', chips: ['Create a new model from scratch', 'Continue a model I left in draft'] }
}
const COE_VOICE: Record<Mode, string[]> = {
  ask: ['Which engine suits RSV in older adults?', 'What is blocking my drafts right now?', 'Give me a quick summary of Cibinqo'],
  agent: ['Create a new model from scratch', 'Continue a model I left in draft', 'Modify an existing model'],
}

function CoeChat({ threads, setThreads, cur, setCur, models, setModels }: { threads: Thread[]; setThreads: (f: (t: Thread[]) => Thread[]) => void; cur: number | null; setCur: (id: number | null) => void; models: ModelRow[]; setModels: (f: (m: ModelRow[]) => ModelRow[]) => void }) {
  const [thinking, setThinking] = useState<string | null>(null)
  const th = threads.find(t => t.id === cur)
  const send = (text: string, _m: Mode = 'agent', via?: string) => {
    const t = text.trim(); if (!t || thinking) return
    const scoped = coeScope(t)
    const live = !!(th?.build && th.build.phase !== 'done') || !!th?.intake || !!(th?.flow && th.flow.stage !== 'done')
    const mode: Mode = !scoped && (live || ACT_COE.test(t)) ? 'agent' : 'ask'
    const base: Thread = th ?? { id: Date.now(), title: t.length > 38 ? t.slice(0, 36) + '…' : t, msgs: [] }
    const withQ: Thread = { ...base, msgs: [...base.msgs, { id: Date.now(), role: 'user', text: t, mode }] }
    if (!th) { setThreads(ts => [withQ, ...ts]); setCur(base.id) } else setThreads(ts => ts.map(x => x.id === base.id ? withQ : x))
    const active = th?.build && th.build.phase !== 'done' ? th.build : undefined
    const g = mode === 'agent' && !active ? guided(t, th?.intake, models) : null
    const wantsBuild = mode === 'agent' && /(set ?up|create|build|start|configure)\b.{0,24}\bmodel|new model/i.test(t)
    let res: Res
    if (scoped) res = scoped
    else if (mode === 'ask') res = askCoe(t, models, via ?? '')
    else if (active?.phase === 'choose' && !/\b(cancel|stop|never ?mind|discard)\b/i.test(t)) {
      const pace = /step|one by one|guide|myself|each|review/i.test(t) ? 'step' : /auto|do it|for me|you do|earlier|previous|based|go ahead|yourself/i.test(t) ? 'auto' : null
      res = pace ? { build: { ...active, pace, phase: 'running' }, out: [{ text: paceMsg(pace, active, models), trace: [] }] } : { out: [{ text: 'Which would you prefer? **Go step by step**, or **Do it for me** based on your earlier models.', chips: ['Go step by step', 'Do it for me'], trace: [] }] }
    }
    else if (active && !/\b(cancel|stop|never ?mind|discard)\b/i.test(t)) res = { out: [{ text: `Your model build is waiting at **step ${active.step} of 7**. ${active.phase === 'await' ? 'It needs your approval in the sandbox.' : 'It is still working.'} Say **cancel** to stop it.`, trace: [] }] }
    else if (active) res = { build: undefined, out: [{ text: 'Done, I’ve stopped the build and nothing was saved.', trace: [] }] }
    else if (g) res = g.res
    else if (wantsBuild) res = buildRes(startBuild(t, models))
    else res = think(withQ, t, models)
    if (mode === 'agent') res.out.forEach(o => { const k = o.card && COE_TAKE[o.card.t]; if (k && o.text) o.text += '\n\n' + k; if (o.text) { o.sources = o.card ? pickSrc(...COE_SRC[o.card.t]) : pickSrc('catalog', 'taxonomy'); o.trace ??= ['Read your request', 'Checked the catalog and your drafts', 'Prepared the next step'] } })
    if (!scoped && !live && !g && !wantsBuild) res.out.forEach(o => { if (o.text && !o.text.includes("?")) { const p = coePartner(t); o.text += '\n\n' + p.q; o.chips = [...(o.chips ?? []).slice(0, 1), ...p.chips] } })
    setThinking(res.out[0]?.trace?.[0] ?? `${ASSISTANT} is thinking…`)
    setTimeout(() => {
      if (res.add) setModels(ms => [res.add!, ...ms])
      if (res.patch) setModels(ms => ms.map(m => m.id === res.patch!.id ? { ...m, ...res.patch!.p } : m))
      setThreads(ts => ts.map(x => x.id === base.id ? { ...x, title: res.title ?? x.title, flow: mode === 'ask' ? x.flow : res.flow, ctx: mode === 'ask' ? x.ctx : res.ctx, intake: mode === 'ask' ? x.intake : g ? g.intake : wantsBuild ? undefined : x.intake, build: mode === 'ask' ? x.build : res.build !== undefined || wantsBuild ? res.build : active && 'build' in res ? undefined : x.build, msgs: [...x.msgs, ...res.out.map((o, k) => ({ id: Date.now() + k + 1, role: 'ai' as const, mode, via, ...o }))] } : x))
      setThinking(null)
    }, 500 + (res.out[0]?.trace?.length ?? 0) * 300)
  }
  const setFlow = (f: Flow) => setThreads(ts => ts.map(x => x.id === cur ? { ...x, flow: f } : x))
  const setBuild = (f: (b: Build) => Build) => setThreads(ts => ts.map(x => x.id === cur && x.build ? { ...x, build: f(x.build) } : x))
  const post = (tid: number, text: string) => setThreads(ts => ts.map(x => x.id === tid && x.msgs[x.msgs.length - 1]?.text !== text ? { ...x, msgs: [...x.msgs, { id: Date.now(), role: 'ai', text, mode: 'agent' }] } : x))
  const stepOf = (m: ChatMsg) => m.card?.t === 'build' && th?.build ? `Model build · step ${Math.min(th.build.step, 7)} of 7${th.build.phase === 'await' ? ' · needs approval' : th.build.phase === 'done' ? ' · done' : ''}` : ''
  return (
    <ChatShell<ChatMsg>
      assistant={{ name: ASSISTANT, Mark: AssistantMark, Md }} userName={ME.split(' ')[0]!}
      threads={threads} cur={cur} setCur={setCur} msgs={th?.msgs ?? null} thinking={thinking}
      onSend={(t, m, via) => send(t, m, via)}
      renderCard={(m, live) => th && m.card?.t === 'build' ? (th.build ? <BuildCard b={th.build} setB={setBuild} onChoose={p => post(th.id, paceMsg(p, th.build!, models))} onAwait={(n, bb) => BUILD_ASK[n] && post(th.id, BUILD_ASK[n]!)} onSave={(row, kind) => { setModels(ms => ms.some(x => x.id === row.id) ? ms.map(x => x.id === row.id ? row : x) : [row, ...ms]); post(th.id, kind === 'final' ? `**${row.brand}** is finalised and available to forecasters. It is in your Model workspace as ${row.version}.` : `**${row.brand}** is saved as a draft in your Model workspace${row.issues ? `, with ${row.issues} open item${row.issues > 1 ? 's' : ''} still to clear` : ''}. Nothing else was changed.`) }} /> : null) : th && m.card ? <ChatCard c={m.card} th={th} live={live} models={models} send={t => send(t, 'agent')} setFlow={setFlow} /> : null}
      cardTitle={m => stepOf(m) || (m.card ? CARD_TITLE[m.card.t] : '')}
      cards={COE_CARDS.agent} voice={COE_VOICE.agent} persona={COE_AI} variant="workbench"
      status={th?.build ? `Model build · step ${Math.min(th.build.step, 7)} of 7${th.build.phase === 'await' ? ' · needs approval' : th.build.phase === 'done' ? ' · done' : ''}` : undefined}
      placeholder={th?.flow && th.flow.stage !== 'done' ? 'Reply or ask about this step…' : 'Describe the model you need'}
      note="Builds each step for your approval. Never edits engine math or locked inputs."
    />
  )
}

/* ───────────────────────── Landing ───────────────────────── */

function ForecastBackdrop() {
  // Faint dot grid, fading toward the edges
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)] opacity-60" />
    </div>
  )
}

const ROLE_ENTRIES: { id: string; title: string; who: string; desc: string; live: boolean }[] = [
  { id: 'config', title: 'Configure models', who: 'Forecasting CoE · BD & Pipeline · ICO', live: true, desc: 'Set up, validate and hand off forecast models.' },
  { id: 'forecast', title: 'Create or manage forecasts', who: 'Brand and commercial forecasters', live: true, desc: 'Build forecasts and scenarios from models the CoE has made available.' },
  { id: 'perf', title: 'View performance and decisions', who: 'Leadership and brand teams', live: false, desc: 'Track forecasts against actuals and record decisions.' },
]

function Landing({ onCoE, onForecast }: { onCoE: () => void; onForecast: () => void }) {
  const [note, setNote] = useState('')
  const downloadCode = () => {
    const link = document.createElement('a')
    link.href = '/figma-make-app-code.zip'
    link.download = 'figma-make-app-code.zip'
    link.click()
  }
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background selection:bg-brand selection:text-white">
      <ForecastBackdrop />
      <header className="relative z-10 flex h-16 items-center justify-between px-8">
        <Logo />
        <span className="hidden text-xs text-text-3 md:inline">Signed in as <strong className="font-semibold text-text">{ME}</strong></span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-text-3">Integrated Forecasting</p>
          <Badge tone="warn">MVP prototype</Badge>
        </div>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Build the model once. <span className="text-brand">Forecast inside it.</span>
        </h1>
        <p className="mt-3 max-w-xl text-center text-sm text-text-2">Pick where you want to start.</p>


        <div className="mt-10 grid w-full gap-5 md:grid-cols-3">
          {ROLE_ENTRIES.map(r => (
            <div key={r.id} className={cx('flex flex-col rounded-2xl border bg-surface/95 p-6 backdrop-blur', r.live ? 'border-brand/30 shadow-lg shadow-brand/5' : 'border-dashed border-border-strong')}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-3">{r.who}</p>
                <Badge tone={r.live ? 'ok' : 'neutral'}>{r.live ? 'Available' : 'Concept'}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight">{r.title}</h2>
              <p className="mt-2 flex-1 text-sm text-text-2">{r.desc}</p>
              {r.live
                ? <button type="button" onClick={r.id === 'forecast' ? onForecast : onCoE} className="mt-6 inline-flex items-center gap-2 border-t border-border pt-4 text-sm font-bold text-brand hover:underline">Get started <ArrowRight size={16} /></button>
                : <button type="button" onClick={() => setNote(`${r.title} is a concept in this prototype and is not built yet. Its scope is awaiting forecasting SME validation.`)} className="mt-6 inline-flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold text-text-2 hover:text-brand">Coming soon <ArrowRight size={16} /></button>}
            </div>
          ))}
        </div>
        {note && <p role="status" className="mt-4 max-w-2xl text-center text-sm text-text-2">{note}</p>}
      </main>
      <footer className="relative z-10 flex justify-center px-6 pb-6">
        <Btn
          variant="secondary"
          size="sm"
          icon={<Download size={14} aria-hidden />}
          onClick={downloadCode}
          className="bg-surface/80 text-xs text-text-2 shadow-sm backdrop-blur hover:border-brand/40 hover:text-brand"
        >
          Download updated code
        </Btn>
      </footer>
    </div>
  )
}

/* ───────────────────────── Shell ───────────────────────── */

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open, close])
  return ref
}




function AiButton({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button data-tour="ai-btn" type="button" onClick={onClick} aria-pressed={on}
      className="ai-btn mr-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
      {on ? <X size={14} /> : <Sparkles size={14} />}<span className="max-sm:sr-only">{on ? `Close ${label}` : label}</span>
    </button>
  )
}

function TopBar({ collab, crumbs, onHome, onAdmin, onLogout, models, onResume, fixtures, onFull }: { onFull?: () => void; collab?: { on: boolean; toggle: () => void; label: string }; crumbs: string[]; onHome: () => void; onAdmin: () => void; onLogout: () => void; models: ModelRow[]; onResume: (m: ModelRow) => void; ai: boolean; onAI: () => void; notify: (t: Toast) => void; fixtures: boolean; onFixtures: () => void }) {
  return (
    <header className="z-40 flex h-12 shrink-0 items-center gap-4 border-b border-border bg-surface px-5">
      <nav aria-label="Breadcrumb"><ol className="flex items-center gap-1.5 text-[13px]">{crumbs.filter(Boolean).map((c, k, a) => <li key={c} className="flex items-center gap-1.5">{k > 0 && <ChevronRight size={13} className="text-text-3" />}{k === a.length - 1 ? <span aria-current="page" className="font-semibold text-brand">{c}</span> : <button type="button" onClick={onHome} className="rounded text-text-2 hover:text-brand hover:underline">{c}</button>}</li>)}</ol></nav>
      <div id="topbar-ws" className="flex min-w-0 items-center gap-2.5" />
      <div className="ml-auto flex items-center gap-1.5">
        {collab && <AiButton on={collab.on} onClick={collab.toggle} label={collab.label} />}
        {onFull && <button type="button" onClick={onFull} aria-label="Enter full view" title="Full view" className="grid h-9 w-9 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><Maximize2 size={16} /></button>}
        <Notifications models={models} onResume={onResume} fixtures={fixtures} />
      </div>
    </header>
  )
}

type Note = { id: string; tone: 'brand' | 'warn' | 'ok' | 'err'; title: string; body: string; time: string; cta?: string; model?: ModelRow }

function notesFor(models: ModelRow[]): Note[] {
  const out: Note[] = []
  const byFx = (f: FixtureId) => models.find(m => m.fx === f)
  if (byFx('retired')) out.push({ id: 'n-ret', tone: 'warn', title: 'Engine D-04 v1.4 retires Nov 30', body: 'Ibrance and 1 other model run on it. Migrate to Patient-Flow (D-03).', time: 'Today, 08:15', cta: 'Review', model: byFx('retired') })
  if (byFx('locked')) out.push({ id: 'n-lock', tone: 'brand', title: 'K. Brandt requested control of Abrysvo (maternal)', body: 'You hold the draft lock. Hand over or keep editing.', time: 'Today, 09:40', cta: 'Open', model: byFx('locked') })
  if (byFx('frozen')) out.push({ id: 'n-frz', tone: 'err', title: 'Q4 2026 Re-forecast is frozen', body: 'Comirnaty draft is read-only. Overrides need a reason.', time: 'Yesterday', cta: 'Open', model: byFx('frozen') })
  if (byFx('diff')) out.push({ id: 'n-pin', tone: 'brand', title: 'Michelle Tran is pinned to Cibinqo v2.3', body: 'When v2.4 is made available she’ll be offered a rebase with a diff.', time: 'Today' })
  if (models.some(m => m.fx)) out.push({ id: 'n-rst', tone: 'err', title: 'IQVIA restated history for Nurtec ODT', body: 'Jan–Mar 2026 revised by −4%. 3 inputs affected.', time: 'Today, 06:00', cta: 'Review', model: models.find(m => m.id === 'c') })
  models.filter(m => !m.restricted && !m.fx).forEach(m => {
    if (m.status === 'Draft') out.push({ id: m.id, tone: 'brand', title: `Continue configuring ${m.brand} ${m.market}`, body: `Step ${m.step ?? 1} of ${LAST} · ${m.issues} item${m.issues === 1 ? '' : 's'} to fix`, time: m.updated, cta: 'Resume', model: m })
    if (m.fresh !== 'Current' && m.status === 'Published') out.push({ id: m.id + 'f', tone: 'err', title: `${m.brand}: data ${m.fresh.toLowerCase()}`, body: 'Forecasters see a stale-data warning on their scenarios', time: m.updated, cta: 'Check feeds', model: m })
    if (m.status === 'Published' && m.updated === 'Just now') out.push({ id: m.id + 'p', tone: 'ok', title: `${m.brand} ${m.version} available to Forecaster`, body: 'Forecasters notified', time: m.updated })
  })
  return out
}

function Notifications({ models, onResume, fixtures }: { models: ModelRow[]; onResume: (m: ModelRow) => void; fixtures?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'notes' | 'activity'>('notes')
  const [read, setRead] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const ref = useDismiss(open, () => setOpen(false))
  const notes = notesFor(models).filter(n => !dismissed.has(n.id)).sort((a, b) => Number(!!b.cta) - Number(!!a.cta))
  const unread = notes.filter(n => n.cta && !read.has(n.id)).length
  const activities = fixtures ? [...FIXTURE_ACTIVITY, ...ACTIVITY] : ACTIVITY
  const icon = (t: Note['tone']) => t === 'warn' ? <AlertTriangle size={15} /> : t === 'ok' ? <CheckCircle2 size={15} /> : t === 'err' ? <Clock size={15} /> : <FileText size={15} />
  const tint = { brand: 'bg-brand-soft text-brand', warn: 'bg-warn-soft text-warn', ok: 'bg-ok-soft text-ok', err: 'bg-err-soft text-err' }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-label={`Notifications and recent activity${unread ? `, ${unread} need action` : ''}`} aria-expanded={open}
        className={cx('relative grid h-9 w-9 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text', open && 'bg-surface-2 text-text')}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-err px-1 text-[10px] font-bold text-white ring-2 ring-surface">{unread}</span>}
      </button>
      {open && (
        <div className="rise absolute right-0 top-11 z-40 w-[400px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 pt-2">
            <div role="tablist" aria-label="Notifications and activity" className="flex gap-1">
              <button type="button" role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}
                className={cx('-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors', tab === 'notes' ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text')}>
                Notifications
                {unread > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-err px-1 text-[10px] font-bold text-white">{unread}</span>}
              </button>
              <button type="button" role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}
                className={cx('-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors', tab === 'activity' ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text')}>
                Recent activity
              </button>
            </div>
            {tab === 'notes' && notes.length > 0 && (
              <button type="button" onClick={() => setRead(new Set(notes.map(n => n.id)))} className="text-xs font-semibold text-brand hover:underline">Mark all read</button>
            )}
          </div>
          {tab === 'notes' ? (
            notes.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-ok-soft text-ok"><Check size={18} /></div>
              <p className="mt-3 text-sm font-semibold">You’re all caught up</p>
              <p className="mt-1 text-xs text-text-2">Drafts, finalised versions and availability events show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
              {notes.map(n => {
                const isUnread = !!n.cta && !read.has(n.id)
                return (
                  <li key={n.id} className={cx('group flex gap-3 px-4 py-3', isUnread && 'bg-brand-soft/40')}>
                    <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-md', tint[n.tone])}>{icon(n.tone)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug">{n.title}</p>
                      <p className="text-xs text-text-2">{n.body}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-[11px] text-text-3">{n.time}</span>
                        {n.cta && n.model && <button type="button" onClick={() => { setRead(r => new Set(r).add(n.id)); setOpen(false); onResume(n.model!) }} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">{n.cta}<ArrowRight size={12} /></button>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isUnread && <span className="mt-1 h-2 w-2 rounded-full bg-brand" aria-label="Unread" />}
                      <button type="button" onClick={() => setDismissed(d => new Set(d).add(n.id))} aria-label="Dismiss" className="text-text-3 opacity-0 transition-opacity hover:text-text group-hover:opacity-100 focus:opacity-100"><X size={14} /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
            )
          ) : (
            <div className="flex flex-col">
              <p className="border-b border-border bg-surface-2 px-4 py-2 text-xs text-text-3">Who changed, finalised or made models available.</p>
              <ol className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {activities.map((a, k) => (
                  <li key={`${a.when}-${k}`} className="flex gap-3 px-4 py-3 text-sm hover:bg-background">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2"><a.icon size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug"><b>{a.who}</b> <span className="text-text-2">{a.what}</span></p>
                      <span className="mt-0.5 block text-[11px] text-text-3">{a.when}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Assistant (bounded by the governed engine) ───────────────────────── */

type Reply =
  | { kind: 'text'; title: string; body: ReactNode; cites?: string[]; link?: { label: string; go: () => void } }
  | { kind: 'list'; title: string; empty: string; items: { text: string; tone: 'err' | 'warn' | 'ok'; link?: { label: string; go: () => void } }[] }
  | { kind: 'proposal'; title: string; changes: string[]; apply: () => void; undo: () => void; missing?: string[]; link?: { label: string; go: () => void } }
  | { kind: 'denied'; title: string; body: string }
type Msg = { id: number; q?: string; reply?: Reply; state?: 'proposed' | 'applied' | 'undone' | 'dismissed' }

function Assistant({ open, onClose, context, chips, respond }: { open: boolean; onClose: () => void; context: string[]; chips: string[]; respond: (q: string) => Reply }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [thinking, setThinking] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, thinking])
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [open, onClose])
  if (!open) return null
  const send = (text: string) => {
    const t = text.trim(); if (!t || thinking) return
    setQ(''); setMsgs(m => [...m, { id: Date.now(), q: t }]); setThinking(true)
    setTimeout(() => { const r = respond(t); setMsgs(m => [...m, { id: Date.now() + 1, reply: r, state: r.kind === 'proposal' ? 'proposed' : undefined }]); setThinking(false) }, 650)
  }
  const setState = (id: number, state: Msg['state']) => setMsgs(m => m.map(x => x.id === id ? { ...x, state } : x))

  return (
    <aside role="complementary" aria-label="Assistant" className="rise fixed bottom-2 right-2 top-[64px] z-40 flex w-full max-w-[400px] flex-col rounded-br-2xl border-l border-border bg-surface shadow-2xl">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-brand" />Assistant</p>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />}><span className="sr-only">Close assistant</span></Btn>
        </div>
        <p className="text-xs text-text-2">Explains, audits and proposes. Only the governed engine calculates — nothing changes until you confirm.</p>
        <div className="mt-2 flex flex-wrap gap-1">{context.map(x => <span key={x} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-2">{x}</span>)}</div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="rounded-lg bg-background p-4 text-sm text-text-2">
            <p className="font-semibold text-text">What can I help with?</p>
            <p className="mt-1 text-xs">Try one of these, or ask in your own words.</p>
          </div>
        )}
        {msgs.map(m => m.q ? (
          <div key={m.id} className="ml-8 rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-white">{m.q}</div>
        ) : m.reply && <ReplyCard key={m.id} r={m.reply} state={m.state} setState={s => setState(m.id, s)} />)}
        {thinking && <div className="flex items-center gap-2 text-xs text-text-3"><Loader2 size={13} className="animate-spin" />Checking the model…</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {chips.map(c => <button type="button" key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-text-2 hover:border-brand hover:text-brand">{c}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); send(q) }} className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about this model…" aria-label="Ask the assistant" className={inputCls()} />
          <Btn disabled={!q.trim() || thinking} onClick={() => send(q)} icon={<Send size={15} />}><span className="sr-only">Send</span></Btn>
        </form>
      </div>
    </aside>
  )
}

/* ───────────────────────── Charles (collapsible configuration assistant) ───────────────────────── */

const ASSISTANT = 'Charles' // Name pending confirmation against the internal naming convention.

/** The two AI experiences are deliberately separate: COE AI builds models, Forecast AI explains submitted forecasts. */
const AI_EXP = {
  build: { label: 'COE AI: Build & Configure', short: 'COE AI', purpose: 'Create and configure forecasting models.', mode: 'Model configuration', icon: Workflow,
    placeholder: 'Describe the model or ask about a step…', foot: 'Fills steps for your review. Never finalises or edits locked inputs.' },
  ask: { label: 'Forecast AI: Ask & Understand', short: 'Forecast AI', purpose: 'Understand forecasts and answer business questions.', mode: 'Submitted forecasts', icon: MessagesSquare,
    placeholder: 'Ask about a submitted forecast…', foot: 'Uses submitted forecasts you can access, with sources.' },
  // The in-workspace copilot works on the forecaster's own draft; kept apart from Forecast AI, which never sees drafts.
  work: { label: 'Workspace assistant', short: 'Assistant', purpose: 'Work on the draft open here.', mode: 'Your draft · you approve changes', icon: SlidersHorizontal,
    placeholder: 'Ask about this draft or try a change…', foot: 'Only changes this draft, and only when you approve.' },
} as const
type Exp = keyof typeof AI_EXP
const COE_AI: Persona = { label: AI_EXP.build.label, purpose: AI_EXP.build.purpose, greeting: 'what model are we building?', icon: Workflow, mode: AI_EXP.build.mode }

function AssistantMark({ size = 32, busy = false }: { size?: number; busy?: boolean }) {
  return (
    <span className={cx('ai-orb grid shrink-0 place-items-center rounded-full text-white shadow-sm', busy && 'ai-orb-busy')} style={{ width: size, height: size }}>
      <Sparkles size={Math.round(size * 0.5)} />
    </span>
  )
}

/** Collaboration chat in a floating panel over the page. Stays mounted (also when minimised) so the conversation is kept. */
function Charles({ context, chips, respond, greeting, extra, busy, busyLabel = 'Working in the configurator', persona = 'build', after }: { context: string[]; chips: string[]; respond: (q: string) => Reply; greeting: string; extra?: ReactNode; after?: ReactNode; busy?: boolean; busyLabel?: string; persona?: Exp }) {
  const { open, slot, close: toggle, size, setSize, dock } = useContext(CollabCtx)
  const min = dock === 'float' && size === 'min'
  const E = AI_EXP[persona]
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [thinking, setThinking] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }) }, [msgs, thinking, extra])
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && toggle(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [open])
  const send = (text: string) => {
    const t = text.trim(); if (!t || thinking) return
    setQ(''); setMsgs(m => [...m, { id: Date.now(), q: t }]); setThinking(true)
    // COE AI stays on configuration: forecast business questions are pointed to Forecast AI instead of answered here.
    const scoped: Reply | null = persona === 'build' && FORECAST_Q.test(t) ? { kind: 'text', title: 'That’s a forecast question', body: `${AI_EXP.build.label} only works on model configuration. Ask business questions about submitted forecasts in ${AI_EXP.ask.label}, in the Forecaster.`, cites: [askSrc.access.name] } : null
    setTimeout(() => { const r = scoped ?? respond(t); setMsgs(m => [...m, { id: Date.now() + 1, reply: r, state: r.kind === 'proposal' ? 'proposed' : undefined }]); setThinking(false) }, 600)
  }
  const setState = (id: number, state: Msg['state']) => setMsgs(m => m.map(x => x.id === id ? { ...x, state } : x))

  if (!open || !slot) return null
  return createPortal(
    <>
      <div className="flex min-h-0 flex-1 flex-col">
       <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
        <header className={cx('relative px-4 py-3', !min && 'border-b border-border')}>
          <div className="flex items-center gap-3">
            <span className={cx('ai-orb h-9 w-9 shrink-0 rounded-full', busy && 'ai-orb-busy')} aria-hidden />
            <div className="min-w-0 flex-1">
              <p title={E.label} className="flex items-center gap-1.5 text-sm font-semibold leading-tight"><E.icon size={14} className="shrink-0 text-brand" /><span className="truncate">{E.short}</span></p>
              <p className="flex items-center gap-1.5 text-xs text-text-3"><span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', busy ? 'animate-pulse bg-[#2f9e73]' : 'bg-ok')} /><span className="truncate">{busy ? busyLabel : E.mode}</span></p>
            </div>
            <div className="flex shrink-0 items-center">
              {dock === 'float' && !min && <button type="button" onClick={() => setSize(size === 'lg' ? 'md' : 'lg')} title={size === 'lg' ? 'Smaller' : 'Larger'} aria-label={size === 'lg' ? 'Make the chat smaller' : 'Make the chat larger'} className="hidden h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text sm:grid">{size === 'lg' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>}
              {dock === 'float' && <button type="button" onClick={() => setSize(min ? 'md' : 'min')} title={min ? 'Open' : 'Minimise'} aria-label={min ? `Open ${E.short}` : `Minimise ${E.short}`} className="hidden h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text sm:grid">{min ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>}
              <button type="button" onClick={toggle} title={`Close ${E.short}`} aria-label={`Close ${E.short}`} className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
            </div>
          </div>
        </header>
        <div ref={box} className={cx('min-h-0 flex-1 space-y-4 overflow-y-auto p-4', min && 'hidden')}>
          <div className="flex gap-2.5">
            <AssistantMark size={24} />
            <div className="min-w-0 rounded-lg rounded-tl-sm bg-background p-3 text-sm text-text-2">{greeting}</div>
          </div>
          {extra}
          {msgs.map(m => m.q ? (
            <div key={m.id} className="ml-8 break-words rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-white">{m.q}</div>
          ) : m.reply && <ReplyCard key={m.id} r={m.reply} state={m.state} setState={st => setState(m.id, st)} />)}
          {thinking && <div className="flex items-center gap-2 text-xs text-text-3"><Loader2 size={13} className="animate-spin" />Thinking…</div>}
          {after}
        </div>
        <div className={cx('border-t border-border p-3', min && 'hidden')}>
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {chips.map(c => <button type="button" key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-text-2 hover:border-brand hover:text-brand">{c}</button>)}
          </div>
          <form onSubmit={e => { e.preventDefault(); send(q) }} className="relative rounded-2xl border border-[#2f9e73]/30 bg-surface p-3 shadow-[0_0_0_4px_rgb(47_158_115/0.07)] transition-shadow focus-within:border-[#2f9e73]/60 focus-within:shadow-[0_0_0_4px_rgb(47_158_115/0.14)]">
            <textarea rows={1} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q) } }}
              placeholder={E.placeholder} aria-label={`Message ${E.label}`}
              className="block max-h-40 min-h-[32px] w-full resize-none bg-transparent px-1 py-1 text-[15px] outline-none placeholder:text-text-3" />
            <div className="mt-2 flex items-center gap-2">
              <button type="submit" disabled={!q.trim() || thinking} aria-label="Send" className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:bg-text-3/60"><ArrowUpRight size={17} /></button>
            </div>
          </form>
          <p className="mt-2 text-[10px] leading-snug text-text-3">{E.foot}</p>
        </div>
       </div>
      </div>
    </>,
    slot,
  )
}

/** Forecast workspace copilot: the same Charles panel, driven by the workspace agent. */
function ForecastCopilot(p: CopilotProps) {
  return <Charles persona="work" busy={p.busy} busyLabel="Working in the forecast" greeting={p.greeting} context={p.context} chips={p.chips}
    respond={q => { const r = p.respond(q); return { kind: 'text', title: r.title, body: <div className="space-y-2 whitespace-pre-line">{r.body.split('\n\n').map((x, i) => <p key={i}><Md text={x} /></p>)}</div> } }}
    extra={<AgentDemoCard assistant={ASSISTANT} {...p.demo} />} />
}

/** Generic replies for pages outside the configurator. */
const pageRespond = (where: string) => (q: string): Reply => /build|set ?up|create|new model|configure/i.test(q)
  ? { kind: 'text', title: 'Let’s build it in the configurator', body: `Start a new model from the library and open COE AI from the top bar. Describe the model in one sentence and I’ll configure every step up to Review while you watch, then show you the model flow to check before you finalise.` }
  : { kind: 'text', title: `On ${where}`, body: 'I can explain what you see here, find models and point you to the right step. Field changes happen inside the configurator, where every change waits for your review.' }

function ReplyCard({ r, state, setState }: { r: Reply; state?: Msg['state']; setState: (s: Msg['state']) => void }) {
  const tag = (label: string, cls: string) => <span className={cx('mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cls)}>{label}</span>
  return (
    <div className="mr-4 rounded-lg rounded-bl-sm border border-border p-3 text-sm">
      {r.kind === 'text' && <>
        {tag('Explanation', 'bg-surface-2 text-text-2')}
        <p className="font-semibold">{r.title}</p><div className="mt-1 text-text-2">{r.body}</div>
        {r.cites && r.cites.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="Citations">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-3">Cited</span>
            {[...new Set(r.cites)].map((s, k) => <span key={s} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-text-2"><span className="font-mono text-text-3">[{k + 1}]</span><span className="truncate">{s}</span></span>)}
          </div>
        )}
        {r.link && <button type="button" onClick={r.link.go} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">{r.link.label}<ArrowRight size={12} /></button>}
      </>}
      {r.kind === 'list' && <>
        {tag('Audit', 'bg-surface-2 text-text-2')}
        <p className="font-semibold">{r.title}</p>
        {r.items.length === 0 ? <p className="mt-1 flex items-center gap-1.5 text-ok"><CheckCircle2 size={14} />{r.empty}</p> : (
          <ul className="mt-2 space-y-2">{r.items.map((it, k) => (
            <li key={k} className="flex gap-2 text-xs">
              {it.tone === 'err' ? <AlertCircle size={13} className="mt-px shrink-0 text-err" /> : it.tone === 'warn' ? <AlertTriangle size={13} className="mt-px shrink-0 text-warn" /> : <CheckCircle2 size={13} className="mt-px shrink-0 text-ok" />}
              <span className="flex-1 text-text-2">{it.text}{it.link && <button type="button" onClick={it.link.go} className="ml-1 font-semibold text-brand hover:underline">{it.link.label}</button>}</span>
            </li>))}</ul>
        )}
      </>}
      {r.kind === 'proposal' && <>
        {state === 'applied' ? tag('Applied', 'bg-ok-soft text-ok') : state === 'undone' ? tag('Reverted', 'bg-surface-2 text-text-2') : state === 'dismissed' ? tag('Dismissed', 'bg-surface-2 text-text-3') : tag('Proposed — not applied', 'bg-warn-soft text-warn')}
        <p className="font-semibold">{r.title}</p>
        <ul className="mt-2 space-y-1 text-xs text-text-2">{r.changes.map(c => <li key={c} className="flex gap-1.5"><Plus size={12} className="mt-0.5 shrink-0 text-brand" />{c}</li>)}</ul>
        {r.missing && r.missing.length > 0 && (
          <div className="mt-2 rounded-md bg-warn-soft/60 p-2">
            <p className="text-[11px] font-semibold text-warn">Still needed before you can continue</p>
            <ul className="mt-1 space-y-0.5 text-xs text-text-2">{r.missing.map(m => <li key={m} className="flex gap-1.5"><AlertCircle size={12} className="mt-0.5 shrink-0 text-warn" />{m}</li>)}</ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {state === 'proposed' && <><Btn size="sm" onClick={() => { r.apply(); setState('applied') }}>Apply</Btn><Btn size="sm" variant="ghost" onClick={() => setState('dismissed')}>Dismiss</Btn></>}
          {state === 'applied' && <Btn size="sm" variant="secondary" icon={<History size={13} />} onClick={() => { r.undo(); setState('undone') }}>Undo</Btn>}
          {state === 'applied' && r.link && <button type="button" onClick={r.link.go} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">{r.link.label}<ArrowRight size={12} /></button>}
        </div>
      </>}
      {r.kind === 'denied' && <>
        {tag('Not permitted', 'bg-err-soft text-err')}
        <p className="flex items-center gap-1.5 font-semibold"><ShieldAlert size={14} className="text-err" />{r.title}</p><p className="mt-1 text-text-2">{r.body}</p>
      </>}
    </div>
  )
}

/* ───────────────────────── Model library (home) ───────────────────────── */

const STATUS_TONE: Record<MStatus, 'ok' | 'neutral' | 'brand'> = { Draft: 'neutral', Finalised: 'brand', Published: 'ok' }
/** Lifecycle as shown to the CoE: a draft becomes available to forecasters only after Finalise setup. */
const STATUS_LABEL: Record<MStatus, string> = { Draft: 'Draft', Finalised: 'Finalised', Published: 'Available to Forecaster' }
const GEO_NAMES: Record<string, string> = { US: 'United States', EU5: 'EU5', JP: 'Japan', CN: 'China', Global: 'Global' }
const GEO_NAME = (g: string) => GEO_NAMES[g] ?? g

const modelName = (m: ModelRow) => m.name ?? `${m.brand} ${m.market} forecast`
type SortKey = 'name' | 'brand' | 'arch' | 'version' | 'status' | 'updated'
const SORT_VAL: Record<SortKey, (m: ModelRow) => string> = {
  name: modelName, brand: m => m.brand, arch: m => m.inds.map(i => i.arch).join(' '),
  version: m => m.version, status: m => STATUS_LABEL[m.status], updated: m => m.updated,
}

function RowActionMenu({
  onRename,
  onDuplicate,
  onDelete,
  label = 'Model',
}: {
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative inline-block text-left" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`${label} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={cx(
          'grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2 hover:text-text',
          open && 'bg-surface-2 text-text'
        )}
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${label} actions`}
          className="rise absolute right-0 top-9 z-30 w-40 rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onRename() }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-surface-2"
          >
            <Pencil size={13} className="text-text-2" />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDuplicate() }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-surface-2"
          >
            <Copy size={13} className="text-text-2" />
            Duplicate
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-err hover:bg-err-soft"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function RenameDialog({
  title,
  initialValue,
  onSave,
  onClose,
}: {
  title: string
  initialValue: string
  onSave: (val: string) => void
  onClose: () => void
}) {
  const [val, setVal] = useState(initialValue)

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (val.trim()) {
      onSave(val.trim())
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dlg-title"
      onClick={onClose}
    >
      <div
        className="rise w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="rename-dlg-title" className="text-base font-semibold">{title}</h3>
        <form onSubmit={submit} className="mt-3 space-y-4">
          <input
            autoFocus
            aria-label="Name"
            value={val}
            onChange={e => setVal(e.target.value)}
            className="h-9 w-full rounded-md border border-border-strong px-2.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn size="sm" disabled={!val.trim() || val.trim() === initialValue}>Save</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteDialog({
  name,
  onConfirm,
  onClose,
}: {
  name: string
  onConfirm: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="rise w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-err">Delete {name}?</h3>
        <p className="mt-1.5 text-sm text-text-2">This will remove it from your workspace. This action cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" size="sm" onClick={() => { onConfirm(); onClose() }}>Delete</Btn>
        </div>
      </div>
    </div>
  )
}

function ModelsHome({ fixtures, models, setModels, onOpen, onResume, notify, ai, closeAI }: {
  fixtures: boolean; models: ModelRow[]; setModels: (m: ModelRow[]) => void; onOpen: (s: Seed) => void; onResume: (m: ModelRow) => void; notify: (t: Toast) => void; ai: boolean; closeAI: () => void
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'All' | MStatus>('All')
  const [creating, setCreating] = useState(false)
  const [versions, setVersions] = useState<ModelRow | null>(null)
  const [renamingModel, setRenamingModel] = useState<ModelRow | null>(null)
  const [deletingModel, setDeletingModel] = useState<ModelRow | null>(null)

  const duplicateModel = (m: ModelRow) => {
    const dup: ModelRow = {
      ...m,
      id: `m${Date.now()}`,
      brand: `${m.brand} (copy)`,
      version: 'v1.0 draft',
      status: 'Draft',
      updated: 'Just now',
      by: ME,
    }
    setModels([dup, ...models])
    notify({ tone: 'ok', text: `Duplicated "${m.brand}". New draft copy created.` })
  }

  const submitRenameModel = (newName: string) => {
    if (!renamingModel) return
    setModels(models.map(x => x.id === renamingModel.id ? { ...x, brand: newName } : x))
    notify({ tone: 'ok', text: `Model renamed to "${newName}".` })
  }

  const confirmDeleteModel = () => {
    if (!deletingModel) return
    setModels(models.filter(x => x.id !== deletingModel.id))
    notify({ tone: 'info', text: `"${deletingModel.brand}" deleted from your workspace.` })
  }
  const visible = models.filter(m => !m.restricted)
  const counts = { All: visible.length, Draft: visible.filter(m => m.status === 'Draft').length, Finalised: visible.filter(m => m.status === 'Finalised').length, Published: visible.filter(m => m.status === 'Published').length }
  const match = (m: ModelRow) => filter === 'All' || m.status === filter
  const [fBrand, setFBrand] = useState('All')
  const [fGeo, setFGeo] = useState('All')
  const brandsAll = Array.from(new Set(visible.map(m => m.brand))).sort()
  const geosAll = Array.from(new Set(visible.map(m => m.market))).sort()
  const dim = (m: ModelRow) => (fBrand === 'All' || m.brand === fBrand) && (fGeo === 'All' || m.market === fGeo)
  const anyFilter = filter !== 'All' || !!q || fBrand !== 'All' || fGeo !== 'All'
  const clearAll = () => { setQ(''); setFilter('All'); setFBrand('All'); setFGeo('All') }
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 } | null>(null)
  const filtered = models.filter(m => (m.restricted ? !anyFilter : match(m) && dim(m)) && `${modelName(m)} ${m.brand} ${m.inds.map(i => `${i.name} ${i.arch}`).join(' ')} ${m.market}`.toLowerCase().includes(q.toLowerCase()))
  const rows = sort ? [...filtered].sort((a, b) => a.restricted !== b.restricted ? (a.restricted ? 1 : -1) : SORT_VAL[sort.k](a).localeCompare(SORT_VAL[sort.k](b), undefined, { numeric: true }) * sort.dir) : filtered
  const toggleSort = (k: SortKey) => setSort(s => s?.k === k ? (s.dir === 1 ? { k, dir: -1 } : null) : { k, dir: 1 })

  const respond = (t: string): Reply => {
    const s = t.toLowerCase()
    if (/attention|today|todo|what should|priorit/.test(s)) return { kind: 'list', title: 'Needs you, most urgent first', empty: 'Nothing waiting on you.', items: visible.filter(m => m.status === 'Draft').sort((a, b) => b.issues - a.issues).map(m => ({ tone: m.issues > 0 ? 'warn' as const : 'ok' as const, text: `${m.brand} ${m.market} — draft, ${m.issues} item${m.issues === 1 ? '' : 's'} to fix.`, link: { label: 'Resume', go: () => onResume(m) } })) }
    if (RESTRICTED_RE.test(s) || /\bbd\b/.test(s)) return { kind: 'denied', title: 'That record is in a restricted partition', body: 'BD / Pipeline models are not visible from the CoE workspace, and I can’t read or summarise them. Request access from the BD lead.' }
    if (/patient-flow|archetype|which models|use/.test(s)) return { kind: 'text', title: 'Archetype usage across the library', body: <ul className="mt-1 space-y-0.5 text-xs">{ARCHETYPES.map(a => <li key={a.id}><b className="text-text">{a.name}</b> — {visible.filter(m => m.inds.some(i => i.arch === a.name)).map(m => m.brand).join(', ') || 'none yet'}</li>)}</ul> }
    return { kind: 'text', title: 'I can help with the model library', body: 'Ask what needs attention or where an archetype is used. I can’t see restricted BD records.' }
  }

  return (
    <main className={cx('mx-auto w-full max-w-[1320px] flex-1 px-10 py-8 transition-[padding]', ai && 'xl:pr-[420px]')}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Model workspace</h1>
          <p className="mt-1 text-text-2">Models you created or have been given access to. Open one to continue configuring it.</p>
        </div>
        <Btn icon={<Plus size={16} />} className="shrink-0" onClick={() => setCreating(true)}>New model</Btn>
      </header>

      {visible.length === 0 ? (
        <div>
          <EmptyState icon={<Boxes size={20} />} title="No brand models yet" action={<Btn icon={<Plus size={16} />} onClick={() => setCreating(true)}>Configure your first model</Btn>}>
            Set up a model, pick an archetype per stream and finalise it so forecasters can use it.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-text-2" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search models" className={cx(inputCls(), 'pl-9!')} />
              </div>
              <select aria-label="Filter by brand" value={fBrand} onChange={e => setFBrand(e.target.value)} className={cx(inputCls(), 'w-auto!')}><option value="All">All my brands</option>{brandsAll.map(b => <option key={b}>{b}</option>)}</select>
              <select aria-label="Filter by geography" value={fGeo} onChange={e => setFGeo(e.target.value)} className={cx(inputCls(), 'w-auto!')}><option value="All">All my geographies</option>{geosAll.map(g => <option key={g}>{g}</option>)}</select>
              <select aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className={cx(inputCls(), 'w-auto!')}><option value="All">Any status</option><option value="Draft">Draft</option><option value="Finalised">Finalised</option><option value="Published">Available to Forecaster</option></select>
              {anyFilter && <Btn variant="ghost" size="sm" onClick={clearAll}>Clear</Btn>}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-text-3"><Lock size={12} />Only models within your authorised brands and geographies are listed. Others can be requested.</p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface">
            {rows.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-semibold">No models match</p>
                <p className="mt-1 text-sm text-text-2">Try another search or clear the filter.</p>
                <Btn variant="secondary" size="sm" className="mt-4" onClick={clearAll}>Clear filters</Btn>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-[12px] font-medium text-text-3">
                    {([['name', 'Model name', 'w-[20%]'], ['brand', 'Brand & streams', 'w-[23%]'], ['arch', 'Archetype', 'w-[15%]'], ['version', 'Version', 'w-[8%]'], ['status', 'Status', 'w-[10%]'], ['updated', 'Updated', 'w-[12%]']] as const).map(([k, h, wCls]) => {
                      const on = sort?.k === k
                      const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
                      return (
                        <th key={k} className={cx('px-3 py-2 font-medium', wCls)} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" onClick={() => toggleSort(k)} className={cx('inline-flex items-center gap-1 outline-none hover:text-text focus-visible:text-brand', on && 'text-text')}>
                            {k === 'updated' && <Clock size={11} className="mr-0.5 text-text-3 shrink-0" />}
                            {h}<Icon size={12} className={on ? 'text-brand' : 'opacity-60'} />
                          </button>
                        </th>
                      )
                    })}
                    <th className="w-[104px] px-3 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(m => m.restricted ? (
                    <tr key={m.id} className="border-b border-border bg-background/60 text-text-3 last:border-0">
                      <td className="px-4 py-3.5" colSpan={6}><p className="flex items-center gap-2 font-semibold"><Lock size={14} />{m.brand}</p><p className="text-xs">Outside your authorised scope — details hidden. Request access from the model creator.</p></td>
                      <td className="px-4 py-3.5 text-right"><Btn variant="ghost" size="sm" onClick={() => notify({ tone: 'info', text: 'Access request sent to the model creator.' })}>Request access</Btn></td>
                    </tr>
                  ) : (
                    <tr key={m.id} onClick={() => onResume(m)} title={`${m.status === 'Draft' ? 'Resume' : 'Open'} ${modelName(m)}`} className="group cursor-pointer border-b border-border align-middle last:border-0 hover:bg-[#f8f8fa] transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-text group-hover:text-brand">{modelName(m)}</span>
                        <span className="ml-1 text-xs text-text-3">({GEO_NAME(m.market)})</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="font-medium text-text shrink-0">{m.brand}</span>
                          <span className="text-xs text-text-2 truncate max-w-[140px] xl:max-w-[200px]">· {m.inds.map(i => i.name).join(' · ')}</span>
                          {m.tag && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-1.5 py-0.2 text-[10px] font-semibold text-warn"><AlertTriangle size={10} />{m.tag}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] truncate max-w-[120px]">{Array.from(new Set(m.inds.map(i => i.arch).filter(Boolean))).join(' + ') || <span className="text-text-3">Not chosen</span>}</td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{m.version}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                          {m.issues > 0 && <span className="text-[11px] text-err font-medium">({m.issues})</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-text-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} className="text-text-3 shrink-0" />
                          <span>{m.updated}</span>
                          <span className="text-text-3">·</span>
                          <span className="truncate max-w-[70px]">{m.by}</span>
                        </span>
                      </td>
                      <td className="w-[104px] px-3 py-2.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {m.versions.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setVersions(m)}
                              title="Version history"
                              aria-label="Version history"
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                            >
                              <History size={14} />
                            </button>
                          ) : (
                            <span className="h-8 w-8 shrink-0 inline-block" aria-hidden="true" />
                          )}
                          <RowActionMenu
                            label={m.brand}
                            onRename={() => setRenamingModel(m)}
                            onDuplicate={() => duplicateModel(m)}
                            onDelete={() => setDeletingModel(m)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-3 text-xs text-text-3">You only see models you created, were invited to, or that sit in your brands and geographies. Need another one? <button type="button" className="font-semibold text-brand hover:underline" onClick={() => notify({ tone: 'info', text: 'Access request sent to the model owner.' })}>Request access</button></p>
        </>
      )}

      {creating && <NewModelDialog models={visible.filter(m => m.status === 'Published')} onClose={() => setCreating(false)} onStart={s => { setCreating(false); onOpen(s) }} />}
      {versions && <VersionsDrawer m={versions} onClose={() => setVersions(null)} onNew={() => { setVersions(null); onOpen({ from: versions }) }} />}
      {renamingModel && (
        <RenameDialog
          title="Rename model"
          initialValue={renamingModel.brand}
          onSave={submitRenameModel}
          onClose={() => setRenamingModel(null)}
        />
      )}
      {deletingModel && (
        <DeleteDialog
          name={deletingModel.brand}
          onConfirm={confirmDeleteModel}
          onClose={() => setDeletingModel(null)}
        />
      )}
      <Charles greeting={`Hi ${ME.split(' ')[0]}, ask about your models or start a new one.`} context={['CoE workspace', 'Model workspace', `${visible.length} models`]} chips={['What needs my attention?', 'Where is Patient-Flow used?']} respond={respond} />
    </main>
  )
}

const IMPORT_NAME = 'Braftovi US model'
const IMPORT_SHEETS = [{ sheet: 'Forecast_NSCLC', name: 'NSCLC (BRAF V600E)' }, { sheet: 'Forecast_CRC', name: 'CRC (BRAF V600E)' }, { sheet: 'Forecast_Melanoma', name: 'Melanoma (BRAF V600)' }]
const IMPORT_INPUTS = [
  { table: 'Inputs_Epi', match: 'Incidence / prevalence & filter rates' },
  { table: 'Inputs_Persistency', match: 'Cohort-by-month persistency' },
  { table: 'Inputs_Price_FX', match: 'Local-currency price & FX' },
  { table: 'Inputs_GTN', match: 'Discount & rebate factors' },
  { table: 'Inputs_KOL_notes', match: '' },
]

function NewModelDialog({ models, onClose, onStart }: { models: ModelRow[]; onClose: () => void; onStart: (s: Seed) => void }) {
  const [mode, setMode] = useState<'blank' | 'copy' | 'import'>('copy')
  const [file, setFile] = useState('')
  const [parsing, setParsing] = useState(false)
  const [from, setFrom] = useState(models[0]?.id ?? '')
  const [step, setStep] = useState(0)
  const [checks, setChecks] = useState(0)
  const [map, setMap] = useState(IMPORT_SHEETS.map(x => ({ ...x, include: true })))
  const [inMap, setInMap] = useState(IMPORT_INPUTS.map(x => x.match))
  const pickFile = (name: string) => { setFile(name); setParsing(true); setStep(1); setChecks(0); [1, 2, 3, 4].forEach(k => setTimeout(() => { setChecks(k); if (k === 4) setParsing(false) }, k * 450)) }
  const streams = map.filter(x => x.include)
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const src = models.find(m => m.id === from)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="new-title" onClick={onClose}>
      <div className="rise flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-lg bg-surface shadow-xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div><h2 id="new-title" className="text-lg font-semibold">New brand model</h2>
            <p className="mt-1 text-sm text-text-2">Choose a starting point. Every path uses the same configuration steps.</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {([['copy', 'Use a template', 'Start from a previously saved model', Copy], ['blank', 'Start from scratch', 'Blank configuration', Plus], ['import', 'Import a model · exploratory', 'Future scope — AI proposes a structure for review', Upload]] as const).map(([id, t, d, Icon]) => (
            <button type="button" key={id} aria-pressed={mode === id} disabled={id === 'copy' && !models.length} onClick={() => setMode(id)}
              className={cx('flex h-full items-start gap-3 rounded-md border p-3.5 text-left transition-colors disabled:opacity-40', mode === id ? 'border-brand bg-brand-soft/50 ring-1 ring-brand' : 'border-border-strong hover:border-text')}>
              <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-md', mode === id ? 'bg-brand text-white' : 'bg-surface-2 text-brand')}><Icon size={15} /></span>
              <span className="min-w-0"><span className="block whitespace-nowrap text-[13px] font-semibold">{t}</span><span className="mt-0.5 block text-xs text-text-2">{d}</span></span>
            </button>
          ))}
        </div>
        {mode === 'blank' && <p className="rounded-md bg-surface-2 px-3.5 py-3 text-[13px] text-text-2">You’ll choose the archetype, modes, modules and data configuration yourself in the steps that follow.</p>}
        {mode === 'copy' && <p className="rounded-md bg-surface-2 px-3.5 py-3 text-[13px] text-text-2">Templates are models previously saved in the library. Copying one keeps its archetypes, modes and modules as your starting point, and you can change anything in the steps that follow.</p>}
        {mode === 'copy' && models.length > 0 && (
          <div>
            <Field label="Template" hint={src ? `${src.inds.length} indication${src.inds.length > 1 ? 's' : ''} · ${Array.from(new Set(src.inds.map(i => i.arch))).join(' + ')} · ${src.version}` : undefined}>
              <select className={inputCls()} value={from} onChange={e => setFrom(e.target.value)}>
                {models.map(m => <option key={m.id} value={m.id}>{m.brand} {m.market} · {m.version}</option>)}
              </select>
            </Field>
          </div>
        )}
        {mode === 'import' && (
          <div>
            <ol className="mb-4 flex items-center gap-1 text-[11px] font-semibold">
              {['Upload', 'Validate format', 'Map to model', 'Review'].map((t, k) => (
                <li key={t} className="flex flex-1 items-center gap-1.5">
                  <button type="button" disabled={k > step || (k > 0 && !file)} onClick={() => setStep(k)} className={cx('flex items-center gap-1.5 disabled:cursor-default', k <= step ? 'text-brand' : 'text-text-3')}>
                    <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]', k < step ? 'bg-brand text-white' : k === step ? 'border-2 border-brand' : 'border border-border-strong')}>{k < step ? <Check size={11} /> : k + 1}</span>
                    <span className="hidden sm:inline">{t}</span>
                  </button>
                  {k < 3 && <span className={cx('h-px flex-1', k < step ? 'bg-brand' : 'bg-border')} />}
                </li>
              ))}
            </ol>

            {step === 0 && <>
              <label className="flex cursor-pointer flex-col items-center rounded-md border border-dashed border-border-strong px-4 py-6 text-center hover:border-brand">
                <Upload size={18} className="text-text-2" />
                <span className="mt-2 text-sm font-semibold">Choose an .xlsx file</span>
                <span className="text-xs text-text-3">Use a workbook exported from this platform or the standard import template.</span>
                <input type="file" accept=".xlsx" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f.name) }} />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <button type="button" onClick={() => pickFile('Braftovi_US_OP2027_export.xlsx')} className="font-semibold text-brand hover:underline">Try with a sample export</button>
                <button type="button" onClick={() => {}} className="inline-flex items-center gap-1 text-text-2 hover:text-text"><FileText size={12} />Download import template</button>
              </div>
            </>}

            {step === 1 && (
              <div className="rounded-md border border-border p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><FileText size={15} className="text-text-2" />{file}</p>
                <ul className="mt-3 space-y-2 text-[13px]">
                  {['File type is .xlsx and opens without errors', 'Platform export signature found (template v3.2)', `${IMPORT_SHEETS.length} forecast sheets and ${IMPORT_INPUTS.length} input tables detected`, 'No macros or external links. Formulas are not imported; the governed engine recalculates'].map((t, k) => (
                    <li key={t} className={cx('flex gap-2', checks > k ? 'text-text' : 'text-text-3')}>{checks > k ? <CheckCircle2 size={15} className="mt-px shrink-0 text-ok" /> : checks === k ? <Loader2 size={15} className="mt-px shrink-0 animate-spin text-brand" /> : <span className="mt-px h-[15px] w-[15px] shrink-0 rounded-full border border-border-strong" />}{t}</li>
                  ))}
                </ul>
                {!parsing && <div className="mt-3"><Banner tone="ok" title="Format recognised">The workbook matches the supported structure. Next, confirm how sheets map to revenue streams.</Banner></div>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-2">Sheets → revenue streams</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {map.map((x, k) => (
                      <li key={x.sheet} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <input type="checkbox" aria-label={`Include ${x.sheet}`} className="h-4 w-4 accent-brand" checked={x.include} onChange={e => setMap(m => m.map((y, j) => j === k ? { ...y, include: e.target.checked } : y))} />
                        <span className="w-32 shrink-0 truncate font-mono text-xs text-text-2">{x.sheet}</span>
                        <ArrowRight size={13} className="shrink-0 text-text-3" />
                        <input aria-label={`Stream name for ${x.sheet}`} disabled={!x.include} className={cx(inputCls(), 'h-8! min-w-[140px] flex-1 text-[13px] disabled:opacity-50')} value={x.name} onChange={e => setMap(m => m.map((y, j) => j === k ? { ...y, name: e.target.value } : y))} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-2">Input tables → data inputs</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {IMPORT_INPUTS.map((x, k) => (
                      <li key={x.table} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                        <span className="w-40 shrink-0 truncate font-mono text-xs text-text-2">{x.table}</span>
                        <ArrowRight size={13} className="shrink-0 text-text-3" />
                        <select aria-label={`Map ${x.table}`} className={cx(inputCls(!inMap[k]), 'h-8! min-w-[160px] flex-1 text-[13px]')} value={inMap[k]} onChange={e => setInMap(m => m.map((v, j) => j === k ? e.target.value : v))}>
                          <option value="">Not mapped — skip</option>{[...Object.values(MODULE_INPUTS).map(i => i.name), 'Treated patient pool'].map(o => <option key={o}>{o}</option>)}
                        </select>
                        {inMap[k] ? <CheckCircle2 size={14} className="shrink-0 text-ok" /> : <AlertTriangle size={14} className="shrink-0 text-warn" />}
                      </li>
                    ))}
                  </ul>
                  {inMap.some(v => !v) && <p className="mt-1.5 text-xs text-warn">{inMap.filter(v => !v).length} table{inMap.filter(v => !v).length > 1 ? 's' : ''} not mapped. They’ll be skipped; you can configure data in step 5.</p>}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-ok">Pre-filled from the file</p>
                  <ul className="mt-2 space-y-1 text-[13px]"><li>Model name: <b>{IMPORT_NAME}</b></li><li>{streams.length} revenue stream{streams.length === 1 ? '' : 's'}: {streams.map(x => x.name).join(', ')}</li><li>{inMap.filter(Boolean).length} data inputs mapped</li></ul></div>
                <div className="rounded-md border border-border p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-warn">You still decide</p>
                  <ul className="mt-2 space-y-1 text-[13px]"><li>Archetype per stream (step 2)</li><li>Modes and modules (steps 3–4)</li><li>Data configuration (step 5)</li><li>Forecaster access (Finalise setup)</li></ul></div>
              </div>
            )}
            <div className="mt-3 rounded-md border border-dashed border-warn/50 bg-warn/5 px-3 py-2 text-xs text-text-2"><b className="text-text">Exploratory capability, not committed scope.</b> Model import depends on technical confirmation. Imported structure is only a proposal: you review and confirm every selection.</div>
          </div>
        )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <p className="min-w-0 flex-1 text-xs text-text-3">Lineage recorded: {mode === 'copy' && src ? `template ${src.brand} ${src.version}` : mode === 'import' ? (file ? `imported from ${file}` : 'imported file') : 'created from scratch'}.</p>
        <div className="flex shrink-0 gap-2">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          {mode === 'import' && step > 0 && <Btn variant="ghost" onClick={() => setStep(s => s - 1)}>Back</Btn>}
          {mode === 'import' && step < 3
            ? <Btn disabled={!file || parsing || (step === 2 && !streams.length)} onClick={() => setStep(s => s + 1)} icon={<ArrowRight size={16} />}>{step === 0 ? 'Upload' : step === 1 ? 'Map to model' : 'Review'}</Btn>
            : <Btn onClick={() => onStart(mode === 'copy' && src ? { from: src, copy: true } : mode === 'import' ? { importFile: file, importStreams: streams.map(x => x.name) } : { blank: true })} icon={<ArrowRight size={16} />}>Start configuring</Btn>}
        </div>
        </footer>
      </div>
    </div>
  )
}

function VersionsDrawer({ m, onClose, onNew }: { m: ModelRow; onClose: () => void; onNew: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const audit = [
    ...m.versions.map(v => ({ t: `${v.by} made ${v.v} available`, d: v.date })),
    { t: `${m.by} last changed configuration`, d: m.updated },
    { t: 'IQVIA LAAD claims refreshed · actuals through Aug 2026', d: 'Oct 3' },
  ]
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-brand-dark/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Versions and audit" onClick={e => e.stopPropagation()} className="rise flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div><p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Version history</p><p className="font-semibold">{m.brand} {m.market}</p><p className="text-xs text-text-2">{m.inds.map(i => `${i.name} · ${i.arch}`).join(' / ')}</p></div>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />}><span className="sr-only">Close</span></Btn>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {m.diff && m.diff.length > 0 && (
            <div className="mb-5 rounded-md border border-brand/30 bg-brand-soft/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Draft {m.version} vs live {m.versions[0]?.v}</p>
              <ul className="mt-2 space-y-1.5">
                {m.diff.map(d => (
                  <li key={d.text} className="flex items-start gap-2 text-[13px]">
                    <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded font-mono text-xs font-bold', d.kind === '+' ? 'bg-ok-soft text-ok' : d.kind === '−' ? 'bg-err-soft text-err' : 'bg-warn-soft text-warn')}>{d.kind}</span>{d.text}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-text-2">Forecasters pinned to {m.versions[0]?.v} are offered a rebase with this diff when it is made available.</p>
            </div>
          )}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-3">Available versions · read-only</p>
          <ol className="mt-3 space-y-2">
            {m.versions.map((v, k) => (
              <li key={v.v} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-sm font-semibold">{v.v}{k === 0 && <Badge tone="ok">Live</Badge>}</span><span className="text-xs text-text-3">{v.date} · {v.by}</span></div>
                <p className="mt-1 text-[13px] text-text-2">{v.note}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-3"><Lock size={11} />{v.scenarios} scenarios pinned to this version</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-text-3">Audit trail</p>
          <ol className="mt-3 space-y-2 border-l border-border pl-4">
            {audit.map(a => <li key={a.t} className="text-[13px]"><p>{a.t}</p><p className="text-xs text-text-3">{a.d}</p></li>)}
          </ol>
        </div>
        <footer className="border-t border-border p-4">
          <Btn className="w-full" icon={<GitBranch size={16} />} onClick={onNew}>Start {nextVersion(m.versions[0]?.v ?? m.version)} draft</Btn>
          <p className="mt-2 text-center text-xs text-text-3">Available versions never change. A new draft leaves existing scenarios untouched.</p>
        </footer>
      </aside>
    </div>
  )
}

/* ───────────────────────── Configurator shell ───────────────────────── */

type Ctx = {
  c: Config; ind: Ind; update: (p: Partial<Config>) => void; updInd: (id: string, p: Partial<Ind>) => void
  setArch: (id: string, a: ArchId) => void; notify: (t: Toast) => void; go: (n: number) => void
  /** "Fix for me": applies Charles's safe fixes for the given steps. */
  fix: (stages: number[]) => void
}

function Configurator({ seed, onExit, notify, onPublished, onFinalised, ai, closeAI }: {
  seed: Seed; onExit: () => void; notify: (t: Toast) => void; onPublished: (c: Config) => void; onFinalised: (c: Config) => void; ai: boolean; closeAI: () => void
}) {
  const [c, setC] = useState<Config>(() => freshConfig(seed))
  const [stage, setStage] = useState(1)
  const [visited, setVisited] = useState<Set<number>>(new Set([1]))
  const [attempted, setAttempted] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<'saved' | 'saving'>('saved')
  const [published, setPublished] = useState<string | null>(null)
  const [finalSig, setFinalSig] = useState<string | null>(null)
  const first = useRef(true)
  const [asked, setAsked] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [reason, setReason] = useState('')
  const collab = useContext(CollabCtx)
  // The live forecast flow shares the right side with COE AI, so it folds to a strip while the assistant is open.
  const [flowPref, setFlowPref] = useState(true)
  const flowOpen = flowPref && !collab.open
  const [flowW, setFlowW] = useState(340)
  const [flowDrag, setFlowDrag] = useState(false)
  const resizeFlow = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = flowW
    setFlowDrag(true)
    const move = (ev: PointerEvent) => setFlowW(Math.min(FLOW_MAX, Math.max(FLOW_MIN, w0 + x0 - ev.clientX)))
    const up = () => { setFlowDrag(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const [fixNote, setFixNote] = useState<{ before: Config; changes: string[]; left: string[] } | null>(null)
  const readOnly = !!c.lockedBy || (c.frozen && !c.override)

  // Every edit is recorded (what · who · when); repeated edits to the same thing collapse into one entry.
  const stamp = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const logged = (prev: Config, what: string) => prev.log[0]?.what === what ? prev.log : [{ what, who: ME, when: `Today, ${stamp()}` }, ...prev.log].slice(0, 80)
  const update = (p: Partial<Config>) => setC(prev => {
    const keys = Object.keys(p).filter(k => FIELD_LABEL[k])
    const n = { ...prev, ...p }
    return keys.length && !('log' in p) ? { ...n, log: logged(prev, `Changed ${keys.map(k => FIELD_LABEL[k]).join(', ')}`) } : n
  })
  const updInd = (id: string, p: Partial<Ind>) => setC(prev => {
    const i0 = prev.inds.find(i => i.id === id)
    const keys = Object.keys(p).filter(k => FIELD_LABEL[k])
    const n = { ...prev, inds: prev.inds.map(i => i.id === id ? { ...i, ...p } : i) }
    return keys.length ? { ...n, log: logged(prev, `${i0?.name || 'Stream'}: changed ${keys.map(k => FIELD_LABEL[k]).join(', ')}`) } : n
  })
  const setArch = (id: string, a: ArchId) => setC(prev => ({
    ...prev, inds: prev.inds.map(i => i.id === id ? initInd(i, a) : i),
    bindings: Object.fromEntries(Object.entries(prev.bindings).filter(([k]) => !k.startsWith(`${id}:`))),
  }))
  const ind = c.inds.find(i => i.id === c.active) ?? c.inds[0]
  const [sharing, setSharing] = useState(false)
  const [history, setHistory] = useState(false)
  const [agent, setAgent] = useState<AgentState>({ section: null, field: null })
  const [demo, setDemo] = useState<{ i: number; done: boolean } | null>(null)
  const demoId = useRef(0)
  useEffect(() => () => { demoId.current++ }, [])
  const DEMO_STEPS = ['Read the description', 'Model setup: subject and revenue streams', 'Archetype for each stream', 'Modes for each stream', 'Module map', 'Data configuration', 'Hand over for your review']
  const cRef = useRef(c); cRef.current = c
  const beforeDemo = useRef<Config | null>(null)
  const [bannerOff, setBannerOff] = useState(false)
  const idle = { section: null, field: null }
  /** Scripted agent run: Charles fills every step up to Review, where the human takes over. */
  const runDemo = async () => {
    const id = ++demoId.current
    const wait = (ms: number) => new Promise<void>((ok, no) => setTimeout(() => demoId.current === id ? ok() : no(new Error('cancelled')), ms))
    const focus = (f: string) => { setAgent(a => ({ ...a, field: f })); setTimeout(() => document.querySelector(`[data-agent="${f}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50) }
    const type = async (f: string, text: string, put: (v: string) => Partial<Config>) => { focus(f); for (let k = 1; k <= text.length; k++) { setC(p => ({ ...p, ...put(text.slice(0, k)) })); await wait(45) } await wait(250) }
    const pick = async (f: string, p: Partial<Config>) => { focus(f); await wait(500); setC(x => ({ ...x, ...p })); await wait(400) }
    const step = async (i: number, to: number | null, section: string | null) => { setDemo({ i, done: false }); setAgent(idle); if (to) { go(to); await wait(650) } setAgent({ section, field: null }) }
    const onInd = (iid: string, f: (i: Ind) => Ind) => setC(p => ({ ...p, inds: p.inds.map(i => i.id === iid ? f(i) : i) }))
    try {
      beforeDemo.current = cRef.current
      setBannerOff(false)
      if (window.innerWidth < 1024) collab.close()
      go(1)
      setDemo({ i: 0, done: false }); setAgent(idle)
      await wait(900)
      // 1 · Model setup
      await step(1, null, 'subject')
      await type('brand', 'Braftovi US model', v => ({ brand: v }))
      await type('asset', 'Braftovi', v => ({ asset: v }))
      await pick('subjectType', { subjectType: 'Brand / Asset' })
      await pick('therapyArea', { therapyArea: 'Oncology' })
      await pick('lifecycle', { lifecycle: 'Growth' })
      setAgent({ section: 'streams', field: null })
      const ids = ['d1', 'd2', 'd3'].map(x => `i${Date.now()}${x}`)
      setC(p => ({ ...p, inds: ids.map(i => ({ ...emptyInd(i, ''), dim: 'Indication' })), active: ids[0], bindings: {} }))
      await wait(400)
      const names = ['NSCLC (BRAF V600E)', 'CRC (BRAF V600E)', 'Melanoma (BRAF V600)']
      for (let k = 0; k < 3; k++) {
        focus(`stream-${k}`)
        for (let j = 1; j <= names[k].length; j++) { const v = names[k].slice(0, j); onInd(ids[k], i => ({ ...i, name: v })); await wait(40) }
        await wait(250)
      }
      // 2 · Archetype: Patient-Flow for each oncology stream
      await step(2, 2, 'arch')
      for (const iid of ids) { setC(p => ({ ...p, active: iid })); await wait(650); setArch(iid, 'D-03'); await wait(750) }
      // 3 · Modes
      await step(3, 3, 'modes')
      const MODE_PICKS = [{ actuals: 'Claims-level actuals', lot: 'Progression-Derived', retreat: 'Excluded' }, { actuals: 'Claims-level actuals', lot: 'Independent', retreat: 'Excluded' }, { actuals: 'Aggregate actuals ingestion', lot: 'Named Feeders', retreat: 'Allowed' }]
      for (let k = 0; k < 3; k++) { setC(p => ({ ...p, active: ids[k] })); await wait(600); onInd(ids[k], i => ({ ...i, modes: { ...i.modes, ...MODE_PICKS[k] } })); await wait(800) }
      // 4 · Module map: attach one compatible optional module per stream
      await step(4, 4, 'modules')
      for (const iid of ids) {
        setC(p => ({ ...p, active: iid })); await wait(600)
        const cur = cRef.current.inds.find(i => i.id === iid)
        const extra = cur && MODULES.find(m => validFor(m, 'D-03') && !cur.modules.includes(m.id) && !requiredFor('D-03').includes(m.id) && !GOVERNED.has(m.name) && (!m.needs || cur.modules.includes(byName(m.needs).id)))
        if (extra) onInd(iid, i => ({ ...i, modules: [...i.modules, extra.id] }))
        await wait(800)
      }
      // 5 · Data configuration: connect every input, keep a few as manual forecaster entry
      await step(5, 5, 'data')
      const ins = inputsFor(cRef.current)
      const pace = Math.max(140, Math.min(380, 6000 / Math.max(ins.length, 1)))
      for (let k = 0; k < ins.length; k++) {
        const b = ins[k], manual = k % 4 === 3
        focus(`bind-${b.key}`)
        setC(p => ({ ...p, bindings: { ...p.bindings, [b.key]: { path: manual ? 'Manual' : 'Connected', source: b.input.suggested, owner: OWNERS[k % OWNERS.length], confidence: 'High', status: 'ok', msg: 'Connected.', expose: manual || k % 3 === 0 ? 'Editable' : 'Visible' } } }))
        await wait(pace)
      }
      // 6 · Hand over at Review
      await step(6, null, null)
      await wait(600)
      setC(p => ({ ...p, active: ids[0], log: logged(p, `${ASSISTANT} built the configuration: Braftovi, 3 streams on Patient-Flow, modes, modules and data`) }))
      go(REVIEW)
      setDemo({ i: DEMO_STEPS.length, done: true })
    } catch { setAgent(idle) }
  }
  const stopDemo = () => { demoId.current++; setAgent(idle); setDemo(null) }
  const undoDemo = () => { stopDemo(); if (beforeDemo.current) setC(beforeDemo.current); beforeDemo.current = null; go(1); notify({ tone: 'info', text: `${ASSISTANT}’s build undone. The configuration is back to how it was.` }) }
  const demoBusy = !!demo && !demo.done

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setSaving('saving'); const t = setTimeout(() => setSaving('saved'), 700); return () => clearTimeout(t)
  }, [c])

  const issues = useMemo(() => STAGES.map(s => validate(s.id, c)), [c])
  const warns = useMemo(() => warningsFor(c), [c])
  const blocking = STAGES.slice(0, LAST - 1).filter(s => issues[s.id - 1].length)
  const status = (id: number): 'done' | 'error' | 'current' | 'todo' => {
    const bad = issues[id - 1].length > 0
    if (id === stage) return attempted.has(id) && bad ? 'error' : 'current'
    if (id === LAST) return visited.has(LAST) ? (blocking.length ? 'error' : 'done') : 'todo'
    if (visited.has(id) && !bad && id < LAST) return 'done'
    if ((attempted.has(id) || (visited.has(id) && id < stage)) && bad) return 'error'
    return 'todo'
  }
  const doneCount = STAGES.filter(s => s.id < LAST && status(s.id) === 'done').length
  const firstOpen = STAGES.find(s => s.id < LAST && issues[s.id - 1].length)?.id ?? LAST
  const canGo = (id: number) => id <= stage || visited.has(id) || id <= firstOpen

  const go = (id: number) => { setFixNote(null); setStage(id); setVisited(v => new Set(v).add(id)); toTop() }
  const next = () => {
    if (stage >= LAST) return
    setAttempted(a => new Set(a).add(stage))
    if (issues[stage - 1].length) { notify({ tone: 'err', text: 'Fix the highlighted items to continue.' }); return }
    go(stage + 1)
  }
  const nextRef = useRef(next); nextRef.current = next
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); nextRef.current() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const show = attempted.has(stage)
  const S = STAGES[stage - 1]
  const fix = (stages: number[]) => {
    const r = autoFixAll(stages, c)
    setFixNote({ before: c, changes: r.changes, left: r.left })
    if (r.changes.length) { setC(r.c); notify({ tone: 'ok', text: `${ASSISTANT} fixed ${r.changes.length} item${r.changes.length > 1 ? 's' : ''}. Review the summary at the top.` }) }
    else notify({ tone: 'info', text: 'Nothing here can be fixed automatically — it needs your decision.' })
    scrollFrameTop(true)
  }
  const ctx: Ctx = { c, ind, update, updInd, setArch, notify, go, fix }
  const ins = inputsFor(c)
  const okData = ins.filter(b => dataReady(c.bindings[b.key])).length
  const archName = (i: Ind) => ARCHETYPES.find(a => a.id === i.arch)?.name

  /* assistant: explains, audits, diagnoses and proposes — never calculates */
  const respond = (t: string): Reply => {
    const s = t.toLowerCase()
    if (/formula|math|equation|edit the engine|change the engine|hazard function/.test(s)) return { kind: 'denied', title: 'Engine math is locked', body: 'No one edits engine math inside a model — including me. Raise a version request with the platform team; it ships as a new certified engine version.' }
    if (/\b(publish (it|now|for me|the model)|auto.?publish)\b/.test(s)) return { kind: 'denied', title: 'Finalising is yours to do', body: 'I can check the configuration, but making it available to forecasters always needs your explicit action in Finalise setup.' }
    if (/unlock|change (a |the )?locked|edit (a |the )?locked|override (a |the )?locked/.test(s)) return { kind: 'denied', title: 'CoE-locked assumptions stay locked', body: 'I can fill missing owner, source or confidence, but I never change a CoE-locked value or its lock. Change it yourself in the Assumptions register.' }
    if (/this step|explain (the )?step|what do i do|where am i|what (is|are) (this|modes|modules|archetypes?|the baseline)/.test(s)) return { kind: 'text', title: `Step ${stage} · ${S.title}`, body: S.desc }
    if (RESTRICTED_RE.test(s)) return { kind: 'denied', title: 'That record is in a restricted partition', body: 'Insider-restricted BD models are invisible to the CoE workspace. I can’t read, compare or summarise them.' }
    if (/100|over.*share|share.*over|cascade/.test(s)) return c.cascade.length
      ? { kind: 'text', title: `Cascade multiplies to ${cascadeTotal(c).toFixed(0)}%`, body: `The levels ${c.cascade.join('% × ')}% are nested, so the last one is a share of the previous — a value above 100% at any level pushes the total past 100%. Lower that level or switch it to a parent-relative share.`, link: { label: 'Go to Modes', go: () => go(3) } }
      : { kind: 'text', title: 'No nested cascade on this model', body: 'Share can only exceed 100% when cascade levels are nested. This model uses a single share band.' }
    if (/migrat|certified|retired/.test(s) && c.retired) {
      const before = c.inds
      return { kind: 'proposal', title: 'Migrate D-04 v1.4 → Patient-Flow D-03 v4.1', changes: ['Archetype: Brand Inflow-Outflow → Patient-Flow', 'Modules reset to D-03 recommendations', 'Data configuration for D-04 inputs cleared'], apply: () => { before.forEach(i => i.arch === 'D-04' && setArch(i.id, 'D-03')); update({ retired: false }) }, undo: () => update({ inds: before, retired: true }) }
    }
    if (/publish|finalis|audit|ready|check|missing/.test(s)) {
      const items = [
        ...STAGES.slice(0, LAST - 1).flatMap(st => issues[st.id - 1].map(i => ({ tone: 'err' as const, text: i.msg, link: { label: `Go to ${st.short}`, go: () => go(st.id) } }))),
        ...issues[LAST - 1].map(i => ({ tone: 'err' as const, text: i.msg, link: { label: 'Go to Finalise', go: () => go(LAST) } })),
        ...warns.map(w => ({ tone: 'warn' as const, text: w.msg, link: { label: 'Review', go: () => go(w.stage) } })),
      ]
      return { kind: 'list', title: `Configuration check · ${items.filter(i => i.tone === 'err').length} blocking, ${warns.length} to review`, empty: 'Nothing blocking. Ready to finalise.', items }
    }
    if (/data|source|input|map|configured/.test(s)) {
      const items = ins.filter(b => !dataReady(c.bindings[b.key])).map(b => ({ tone: 'warn' as const, text: `${b.input.name} (${b.scopeLabel}) is not configured. Choose a pathway and map a field.`, link: { label: 'Configure', go: () => go(5) } }))
      return { kind: 'list', title: 'Data configuration check', empty: ins.length ? 'Every input has a pathway and mapping.' : 'No inputs yet — choose archetypes first.', items }
    }
    if (/recommend|attach|module|set up/.test(s)) {
      if (!ind.arch) return { kind: 'text', title: 'Choose an archetype first', body: `Modules depend on the archetype for ${ind.name || 'this indication'}.`, link: { label: 'Go to Archetypes', go: () => go(2) } }
      const miss = MODULES.filter(m => m.rec?.includes(ind.arch!) && !ind.modules.includes(m.id) && validFor(m, ind.arch!))
      if (!miss.length) return { kind: 'text', title: 'All default modules are attached', body: `${ind.name} already has every taxonomy default for ${archName(ind)}.` }
      const before = ind.modules, id = ind.id
      return { kind: 'proposal', title: `Attach ${miss.length} taxonomy default module${miss.length > 1 ? 's' : ''} to ${ind.name}`, changes: miss.map(m => `${m.name} (${m.cat})`), apply: () => updInd(id, { modules: [...before, ...miss.map(m => m.id)] }), undo: () => updInd(id, { modules: before }) }
    }
    if (/archetype|which|fit|compare|engine/.test(s)) {
      // Explains the catalogue only: no archetype recommendation until validated logic and history exist.
      return { kind: 'text', title: 'How the archetypes differ', body: <><ul className="space-y-1">{ARCH_GRID.map(a => <li key={a.id}><b className="text-text">{a.name}</b> — {ARCH_DETAIL[a.id].question}</li>)}</ul><span className="mt-2 block text-xs">Pick the one whose question matches the stream. I don’t recommend an archetype yet — that needs validated history and explainable rules.</span></>, link: { label: 'Open Archetype', go: () => go(2) } }
    }
    return { kind: 'text', title: 'Here’s what I can do on this model', body: 'Describe the model, like “Velsipity, immunology, launch stage, streams for UC and Crohn’s”, and I’ll fill the fields for you to review. I can also explain this step, list inputs that still need data configuration, or check the model before you finalise. Changes always wait for your Apply.' }
  }

  /* Charles: reads plain-language requests and proposes governed field changes — nothing applies until confirmed */
  const casperGreeting = stage === 1
    ? `Hi ${ME.split(' ')[0]}, describe your model, for example “Velsipity, immunology, launch, UC and Crohn’s streams”. I’ll fill every step up to Review.`
    : `You’re on ${S.title}. Ask about this step or tell me what to set up. Nothing changes until you apply.`

  const fillFrom = (raw: string): Reply | null => {
    const s = raw.toLowerCase().replace(/[‘’]/g, "'")
    const sn = s.replace(/-/g, ' ')
    let n: Config = c
    const ch: string[] = []
    const put = (p: Partial<Config>, msg: string) => { n = { ...n, ...p }; ch.push(msg) }
    const cap = (x: string) => x.trim().replace(/^./, m => m.toUpperCase())
    const newStreams: string[] = []

    const nm = /(?:name(?: the model| it)?(?: to| as)?|call(?: it| the model)?|called|named|model for|brand is|model is|set up|build|create|configure)\s+(?:a |an |the )?(?:new )?(?:model |brand )?(?:for |called |named )?["“]?([\w-]+(?: [\w-]+){0,2})/i.exec(raw)
    if (nm) {
      const words: string[] = []
      for (const w of nm[1].split(' ')) { if (/^[A-Z0-9]/.test(w)) words.push(w); else break }
      const name = words.join(' ')
      if (name && !/^(Model|Pipeline|Brand|Franchise|Portfolio|Patient|Prevalent|Rx|Set|Add|Use|All|The|A)$/i.test(words[0]) && name !== n.brand) {
        put({ brand: name }, `Model name: ${name}`)
        if (!n.asset.trim() || n.asset === c.brand) put({ asset: name }, `Brand / asset: ${name}`)
      }
    }
    const as = /\b(?:brand|asset)(?: name)? (?:is|=|:)\s*["“]?([A-Z][\w-]*(?: [A-Z][\w-]*)?)/.exec(raw)
    if (as && as[1] !== n.asset) put({ asset: as[1] }, `Brand / asset: ${as[1]}`)

    const type = ([['pipeline asset', 'Pipeline asset'], ['franchise', 'Franchise'], ['portfolio component', 'Portfolio component'], ['portfolio', 'Portfolio'], ['market level', 'Market-level asset'], ['brand', 'Brand / Asset']] as const).find(([k]) => sn.includes(k))
    if (type && /\b(type|is a|as a|asset|franchise|portfolio)\b/.test(s) && type[1] !== n.subjectType) put({ subjectType: type[1] }, `Model type: ${type[1]}`)
    const ta = ['Oncology', 'Immunology', 'Neurology', 'Rare disease', 'Cardiometabolic', 'Infectious disease', 'Vaccines'].find(o => s.includes(o.toLowerCase()))
    if (ta && ta !== n.therapyArea) put({ therapyArea: ta }, `Therapy area: ${ta}`)
    const life = /pre.?launch|pipeline \(|in the pipeline/.test(s) ? 'Pipeline (Pre-Launch)' : /loss of exclusivity|\bloe\b/.test(s) ? 'Loss of exclusivity' : /\bmature\b/.test(s) ? 'Mature' : /\bgrowth\b|\bgrowing\b/.test(s) ? 'Growth' : /\blaunch(ed|ing)?\b/.test(s) ? 'Launch' : ''
    if (life && life !== n.lifecycle) put({ lifecycle: life }, `Lifecycle stage: ${life}`)

    const adding = /\badd (?:a |another |one )?(?:revenue )?stream (?:for|called|named)?\s*([^.;\n]+)/i.exec(raw)
    const listed = /\b(?:streams?|indications?|lines?)\b(?: are| is| for| include| including)?\s*[:\-–]?\s*([^.;\n]+)/i.exec(raw)
    const split = (x: string) => x.replace(/ (?:with|using|on|in|as|at|by|on archetype)\b.*/i, '').split(/,| and |&|\//i).map(cap).filter(w => w.length > 1 && !/^(Stream|Streams|Indication|Indications)$/i.test(w))
    if (adding) {
      const names = split(adding[1]).slice(0, 4)
      if (names.length) {
        const blank = n.inds.filter(i => !i.name.trim() && !i.arch)
        const fresh = names.map((x, k) => ({ ...emptyInd(`i${Date.now()}${k}`, x) }))
        const inds = blank.length ? [...n.inds.filter(i => !blank.includes(i)), ...fresh] : [...n.inds, ...fresh]
        newStreams.push(...fresh.map(f => f.id))
        put({ inds, active: fresh[0].id }, `Add stream${names.length > 1 ? 's' : ''}: ${names.join(', ')}`)
      }
    } else if (!listed && nm && /\bwith\b/i.test(raw)) {
      const w = /\bwith\s+([^.;\n]+?)(?= on | using | as |\.|;|$)/i.exec(raw)
      const names = w ? split(w[1]).filter(x => !ARCHETYPES.some(a => x.toLowerCase().replace(/-/g, ' ').includes(a.name.toLowerCase().replace(/-/g, ' ')))).slice(0, 6) : []
      if (names.length) {
        const inds = names.map((x, k) => n.inds[k] ? { ...n.inds[k], name: x } : emptyInd(`i${Date.now()}${k}`, x))
        newStreams.push(...inds.map(i => i.id))
        put({ inds, active: inds[0].id }, `Revenue stream${names.length > 1 ? 's' : ''}: ${names.join(', ')}`)
      }
    } else if (listed && /,| and |&/.test(listed[1])) {
      const names = split(listed[1]).slice(0, 6)
      if (names.length > 1) {
        const inds = names.map((x, k) => n.inds[k] ? { ...n.inds[k], name: x } : emptyInd(`i${Date.now()}${k}`, x))
        newStreams.push(...inds.map(i => i.id))
        put({ inds, active: inds[0].id }, `Revenue streams: ${names.join(', ')}`)
      }
    }

    const arch = ARCHETYPES.find(a => sn.includes(a.name.toLowerCase().replace(/-/g, ' ')) || new RegExp(`\\b${a.id.toLowerCase().replace('-', '.?')}\\b`).test(s))
    if (arch) {
      const all = /\b(all|every|each|both)\b/.test(s) || newStreams.length > 1
      const targets = n.inds.filter(i => all ? true : newStreams.length === 1 ? newStreams.includes(i.id) : i.id === n.active)
      const todo = targets.filter(i => i.arch !== arch.id)
      if (todo.length) {
        const ids = new Set(todo.map(i => i.id))
        n = { ...n, inds: n.inds.map(i => ids.has(i.id) ? initInd(i, arch.id) : i), bindings: Object.fromEntries(Object.entries(n.bindings).filter(([k]) => !Array.from(ids).some(id => k.startsWith(`${id}:`)))) }
        ch.push(`Archetype ${arch.name} (${arch.id}) for ${todo.map(i => i.name || 'Untitled stream').join(', ')}, with its recommended engine, modes and modules`)
      }
    }

    const tier = /screening/.test(s) ? 'Screening' : /valuation/.test(s) ? 'Valuation' : /operational/.test(s) ? 'Operational planning' : ''
    if (tier && /tier|grade/.test(s) && tier !== n.grade) put({ grade: tier }, `Tier: ${tier}`)

    if (!ch.length) return null
    const tracked = (['brand', 'asset', 'subjectType', 'therapyArea', 'lifecycle', 'inds'] as (keyof Config)[]).filter(k => n[k] !== c[k])
    n = { ...n, aiFields: Array.from(new Set([...c.aiFields, ...tracked])) }
    const keys = (Object.keys(n) as (keyof Config)[]).filter(k => n[k] !== c[k])
    const before = c
    const pick = (src: Config) => Object.fromEntries(keys.map(k => [k, src[k]])) as Partial<Config>
    const target = n
    const missing = [...validate(stage, target).map(i => i.msg), ...(stage === 1 && target.inds.some(i => !i.arch) ? ['Archetype for each stream — you choose it in the next step.'] : [])]
    return {
      kind: 'proposal', title: `I can fill ${ch.length} thing${ch.length > 1 ? 's' : ''} for you`, changes: ch, missing,
      link: stage < LAST && validate(stage, target).length === 0 ? { label: `Continue to ${STAGES[stage].title}`, go: () => nextRef.current() } : undefined,
      apply: () => setC(prev => ({ ...prev, ...pick(target) })),
      undo: () => setC(prev => ({ ...prev, ...pick(before) })),
    }
  }

  const casperRespond = (t: string): Reply => {
    const s = t.toLowerCase().trim()
    if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(s)) return { kind: 'text', title: `Hi ${ME.split(' ')[0]}`, body: `You’re on ${S.title}${c.brand ? ` for ${c.brand}` : ''}. ${issues[stage - 1].length ? `${issues[stage - 1].length} item${issues[stage - 1].length > 1 ? 's' : ''} left on this step.` : 'This step looks complete.'} What should we set up?` }
    if (/^(thanks|thank you|thx|cheers)\b/.test(s)) return { kind: 'text', title: 'Anytime', body: 'I’ll be here. Ask me to check the configuration before you finalise.' }
    if (/who are you|what are you|what can you do|^help\b|what do you do/.test(s)) return { kind: 'text', title: `I’m ${ASSISTANT}, your configuration assistant`, body: `I fill fields from plain-language descriptions (model name, brand, therapy area, lifecycle, streams, sources and forecasters), explain each step, and audit the model before you finalise. I follow the ${LAST}-step lifecycle and the CoE rules: I don’t recommend archetypes, never edit engine math or locked assumptions, and every change waits for your Apply.` }
    const f = fillFrom(t)
    if (f) return f
    if (stage === 1 && !/audit|missing|ready|check/.test(s)) {
      const miss = issues[0]
      return { kind: 'list', title: miss.length ? 'I couldn’t map that to a field yet. Here’s what’s still needed' : 'Model setup is complete', empty: 'Everything required is filled. Continue to Archetype when you’re ready.', items: miss.map(i => ({ tone: 'err' as const, text: i.msg })) }
    }
    return respond(t)
  }

  if (published) return <PublishedScreen c={c} when={published} onExit={onExit} />

  return (
    <div className="flex flex-1 flex-col">
      {/* persistent context bar */}
      <div className="sticky top-0 z-20 flex h-[50px] shrink-0 items-center gap-3 border-b border-border bg-surface px-5 text-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
          <button type="button" onClick={onExit} className="flex shrink-0 items-center gap-1 text-text-2 hover:text-text"><ArrowLeft size={14} />Workspace</button>
          <span className="text-text-3">/</span>
          <span className="truncate font-semibold">{c.brand || 'Untitled model'}</span>
          {ind.name && <span className="hidden min-w-0 truncate text-text-2 md:inline">/ {ind.name}</span>}
          <span className="hidden shrink-0 lg:inline-flex">{ind.arch && <Badge tone="brand">{archName(ind)}</Badge>}</span>
          {ins.length > 0 && <span className="hidden shrink-0 items-center gap-1 text-xs text-text-3 xl:flex"><Database size={12} />{okData}/{ins.length} inputs configured</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden md:inline-flex"><Badge tone="neutral">{c.version} · Draft</Badge></span>
          <span className="hidden items-center gap-1.5 text-xs text-text-3 sm:flex">{saving === 'saving' ? <><Loader2 size={12} className="animate-spin" />Saving…</> : <><Check size={12} />Saved</>}</span>
          <button type="button" onClick={() => setSharing(true)} title="Collaborators" className="hidden items-center -space-x-1.5 sm:flex">
            {c.team.slice(0, 4).map(m => <span key={m.name} className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-brand-soft text-[10px] font-semibold text-brand">{m.name.split(/[\s.]+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('')}</span>)}
          </button>
          <Btn variant="secondary" size="sm" icon={<Users size={14} />} onClick={() => setSharing(true)}>Share</Btn>
          <Btn variant="ghost" size="sm" icon={<History size={14} />} onClick={() => setHistory(true)} title="Change history"><span className="hidden 2xl:inline">History</span></Btn>
          <Btn variant="primary" size="sm" onClick={() => { notify({ tone: 'ok', text: 'Configuration saved. Resume it from your workspace.' }); onExit() }}>Save & exit</Btn>
        </div>
      </div>

      <div className="grid flex-1 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_auto]">
        <aside className="border-b border-border bg-background lg:border-b-0 lg:border-r lg:sticky lg:top-[50px] lg:h-[calc(100dvh-122px)] lg:overflow-y-auto">
          <div className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Configuration</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneCount / (LAST - 1)) * 100}%` }} /></div>
              <span className="font-mono text-xs text-text-2">{doneCount}/{LAST - 1}</span>
            </div>
          </div>
          <ol data-tour="coe-steps" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
            {STAGES.map(s => {
              const st = status(s.id)
              const n = issues[s.id - 1].length
              const locked = !canGo(s.id)
              return (
                <li key={s.id} data-tour={s.id === LAST ? 'coe-review' : undefined} className="shrink-0">
                  <button type="button" onClick={() => go(s.id)} disabled={locked} aria-current={s.id === stage ? 'step' : undefined}
                    title={locked ? `Complete ${STAGES[firstOpen - 1].title} first` : undefined}
                    className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed', s.id === stage ? 'bg-surface text-brand shadow-sm ring-1 ring-border' : locked ? 'opacity-55' : 'text-text hover:bg-surface-2')}>
                    <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                      st === 'done' && 'bg-ok text-white', st === 'error' && 'bg-err text-white',
                      st === 'current' && 'bg-brand text-white', st === 'todo' && 'border border-border-strong text-text-2')}>
                      {st === 'done' ? <Check size={13} strokeWidth={3} /> : st === 'error' ? '!' : locked ? <Lock size={11} /> : s.id}
                    </span>
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">{s.title}</span>
                      <span className="block whitespace-nowrap text-[11px] text-text-3">
                        {st === 'done' ? 'Complete' : st === 'error' ? (s.id === LAST ? `${blocking.length} step${blocking.length > 1 ? 's' : ''} to fix` : `${n} to fix`) : locked ? 'Locked' : s.sub}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <AgentCtx.Provider value={agent}>
        <main className="flex min-w-0 flex-col">
          {demo && !(demo.done && bannerOff) && (
            <div className="pointer-events-none sticky top-[50px] z-[19] flex justify-end px-3 pt-2 sm:px-5">
              <div className="pointer-events-auto w-full max-w-[760px]">
                <AgentBanner assistant={ASSISTANT} running={!demo.done} step={DEMO_STEPS[demo.i]} progress={[demo.i, DEMO_STEPS.length]} onStop={stopDemo} onDismiss={() => setBannerOff(true)}
                  title={demo.done ? `${ASSISTANT} built ${c.brand || 'this model'} up to review` : `${ASSISTANT} is building this model`}
                  actions={<>{stage !== REVIEW && <AgentButton onClick={() => go(REVIEW)}>Review configuration</AgentButton>}{beforeDemo.current && <AgentButton variant="outline" icon={<RotateCcw size={13} />} onClick={undoDemo}>Undo build</AgentButton>}</>}>
                  {demo.done ? 'Setup, archetypes, modes, module map and data configuration are filled in. Check the whole configuration, change anything you need, then finalise. Nothing reaches forecasters until you do.' : `Step ${Math.min(demo.i + 1, DEMO_STEPS.length)} of ${DEMO_STEPS.length}. Stop at any point and keep what has been filled so far.`}
                </AgentBanner>
              </div>
            </div>
          )}
          <div key={stage} className={cx("rise @container relative mx-auto w-full flex-1 px-5 py-7 sm:px-10", stage === 4 ? "max-w-none" : "max-w-[1080px]")}>
            <p className="font-mono text-xs uppercase tracking-widest text-brand">Step {stage} of {LAST}</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-[28px] font-semibold tracking-tight">{S.title}</h1>
            </div>
            <p className="mt-1 text-sm text-text-2">{S.desc}</p>

            {fixNote && (
              <div className="mt-6">
                <Banner tone={fixNote.left.length ? 'warn' : 'ok'}
                  title={fixNote.changes.length ? `${ASSISTANT} fixed ${fixNote.changes.length} item${fixNote.changes.length > 1 ? 's' : ''}${fixNote.left.length ? ` · ${fixNote.left.length} still need${fixNote.left.length > 1 ? '' : 's'} you` : ''}` : 'These need your decision'}
                  action={<div className="flex shrink-0 gap-1">{fixNote.changes.length > 0 && <Btn size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => { setC(fixNote.before); setFixNote(null); notify({ tone: 'info', text: 'Fixes undone.' }) }}>Undo</Btn>}<Btn size="sm" variant="ghost" onClick={() => setFixNote(null)}>Dismiss</Btn></div>}>
                  {fixNote.changes.length > 0 && <ul className="mt-1 space-y-0.5">{fixNote.changes.map((t, k) => <li key={k} className="flex items-start gap-1.5"><Check size={13} className="mt-0.5 shrink-0 text-ok" />{t}</li>)}</ul>}
                  {fixNote.left.length > 0 && <><p className="mt-2 text-xs font-semibold text-text">Still needs you</p><ul className="mt-0.5 list-disc pl-4">{fixNote.left.map((t, k) => <li key={k}>{t}</li>)}</ul></>}
                  <p className="mt-2 text-xs text-text-3">{ASSISTANT} never chooses an archetype from scratch or changes CoE-locked values. Check each change before you continue.</p>
                </Banner>
              </div>
            )}

            {show && issues[stage - 1].length > 0 && (
              <div className="mt-6">
                <Banner tone="err" title={`${issues[stage - 1].length} thing${issues[stage - 1].length > 1 ? 's' : ''} to fix before you continue`} action={<FixForMe onClick={() => fix([stage])} />}>
                  <ul className="mt-1 list-disc pl-4">{issues[stage - 1].map((i, k) => <li key={k}>{i.msg}</li>)}</ul>
                </Banner>
              </div>
            )}

            {stage === 1 && seed.from && !seed.copy && seed.from.status === 'Published' && (
              <div className="mt-6"><Banner tone="info" title={`Editing creates working version ${c.version}`}>
                {seed.from.version} stays available to Forecasters unchanged. When you finalise {c.version} and make it available, they can move over when ready; scenarios on {seed.from.version} stay pinned.
              </Banner></div>
            )}
            {c.lockedBy && (
              <div className="mt-6"><Banner tone="warn" title={`${c.lockedBy} is editing this draft · active 3 min ago`}>
                You’re viewing read-only so changes don’t collide.
                <div className="mt-2 flex gap-2">
                  {asked ? <span className="flex items-center gap-1.5 text-xs font-semibold"><Clock size={12} />Request sent — waiting for {c.lockedBy}</span>
                    : <Btn size="sm" variant="secondary" onClick={() => { setAsked(true); setTimeout(() => { update({ lockedBy: '' }); notify({ tone: 'ok', text: `${c.lockedBy} handed over control. You hold the lock.` }) }, 2200) }}>Request control</Btn>}
                </div>
              </Banner></div>
            )}
            {c.frozen && !c.override && (
              <div className="mt-6"><Banner tone="err" title="This model is frozen">
                Fields are read-only. An override is recorded in the change history with your reason.
                <div className="mt-2"><Btn size="sm" variant="secondary" onClick={() => setOverriding(true)}>Override with reason</Btn></div>
              </Banner></div>
            )}
            {c.frozen && c.override && <div className="mt-6"><Banner tone="info" title="Freeze override active">Logged: “{c.override}” — {ME}, today.</Banner></div>}
            {c.retired && (
              <div className="mt-6"><Banner tone="warn" title="Engine D-04 v1.4 retires Nov 30">
                This model can’t be finalised on a retired engine. Migrating keeps the indication and resets modules and bindings for the new archetype.
                <div className="mt-2"><Btn size="sm" icon={<GitBranch size={13} />} onClick={() => { c.inds.forEach(i => i.arch === 'D-04' && setArch(i.id, 'D-03')); update({ retired: false }); notify({ tone: 'ok', text: 'Migrated to Patient-Flow (D-03 v4.1). Review modules and data.' }) }}>Migrate to D-03 v4.1</Btn></div>
              </Banner></div>
            )}

            <fieldset disabled={readOnly} className={cx('mt-6 min-w-0 space-y-6', readOnly && 'pointer-events-none opacity-60')}>
              {stage === 1 && <StageBrand {...ctx} errs={show ? issues[0] : []} />}
              {stage === 2 && <AgentSection id="arch" pad><StageArchetype {...ctx} /></AgentSection>}
              {stage === 3 && <AgentSection id="modes" pad><StageModes {...ctx} /></AgentSection>}
              {stage === 4 && <AgentSection id="modules" pad><StageModules {...ctx} errs={issues[3]} /></AgentSection>}
              {stage === 5 && <AgentSection id="data" pad><StageData {...ctx} /></AgentSection>}
              {stage === REVIEW && <><IndTabs c={c} stage={stage} issues={[]} onPick={id => update({ active: id })} /><StagePreview {...ctx} issues={issues} warns={warns} /></>}
              {stage === LAST && <StagePublish {...ctx} issues={issues} warns={warns} errs={show ? issues[LAST - 1] : []} finalSig={finalSig}
                onFinalise={() => { setFinalSig(sigOf(c)); onFinalised(c); notify({ tone: 'ok', text: `${c.brand} ${c.version} finalised and saved` }) }}
                onPublish={() => { setPublished(new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })); onPublished(c); notify({ tone: 'ok', text: `${c.brand} ${c.version} is now available to forecasters` }) }}
                onAttempt={() => setAttempted(a => new Set(a).add(LAST))} />}
            </fieldset>
            {overriding && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ovr-title" onClick={() => setOverriding(false)}>
                <div className="rise w-full max-w-md rounded-lg bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                  <h2 id="ovr-title" className="text-lg font-semibold">Override the freeze</h2>
                  <p className="mt-1 text-sm text-text-2">Your reason is recorded in the change history.</p>
                  <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. Label update approved Oct 2 — finance agreed late submission" className={cx(inputCls(), 'mt-4 h-auto py-2')} />
                  <div className="mt-5 flex justify-end gap-2">
                    <Btn variant="secondary" onClick={() => setOverriding(false)}>Cancel</Btn>
                    <Btn disabled={reason.trim().length < 10} onClick={() => { update({ override: reason.trim() }); setOverriding(false); notify({ tone: 'ok', text: 'Override logged. Editing unlocked.' }) }}>Override and edit</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
          {stage < LAST && (
            <footer className="sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
              <div className={cx("mx-auto flex items-center gap-3 px-5 py-3 sm:px-10", stage === 4 ? "max-w-none" : "max-w-[1080px]")}>
                <Btn variant="ghost" icon={<ArrowLeft size={16} />} disabled={stage === 1} onClick={() => go(stage - 1)}>Back</Btn>
                <span className="ml-auto hidden truncate text-[13px] text-text-3 md:block">
                  {issues[stage - 1].length ? `${issues[stage - 1].length} item${issues[stage - 1].length > 1 ? 's' : ''} left on this step` : <span className="flex items-center gap-1 text-ok"><CheckCircle2 size={14} />Ready</span>}
                </span>
                <Btn onClick={next} className="shrink-0 max-md:ml-auto"><span className="hidden sm:inline">Next:</span> {STAGES[stage].title}<ArrowRight size={16} /></Btn>
              </div>
            </footer>
          )}
        </main>

        </AgentCtx.Provider>
        <aside data-tour="flow-panel" aria-label="Full flow preview" style={{ width: flowOpen ? flowW : 44 }} className={cx('relative hidden border-l border-border bg-background xl:sticky xl:top-[50px] xl:block xl:h-[calc(100dvh-122px)]', !flowDrag && 'transition-[width] duration-200')}>
          {flowOpen && <div role="separator" aria-orientation="vertical" aria-label="Resize the full flow preview" aria-valuenow={flowW} aria-valuemin={FLOW_MIN} aria-valuemax={FLOW_MAX} tabIndex={0}
            onPointerDown={resizeFlow} onDoubleClick={() => setFlowW(340)} onKeyDown={e => { if (e.key === 'ArrowLeft') setFlowW(w => Math.min(FLOW_MAX, w + 24)); if (e.key === 'ArrowRight') setFlowW(w => Math.max(FLOW_MIN, w - 24)) }}
            title="Drag to resize · double-click to reset" className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize outline-none">
            <span className={cx('absolute inset-y-0 left-1.5 w-px transition-colors group-hover:bg-brand/60 group-focus-visible:bg-brand', flowDrag && 'bg-brand')} />
            <span className="absolute left-0.5 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-border-strong opacity-0 transition-opacity group-hover:opacity-100" />
          </div>}
          <ForecastFlowPanel c={c} stage={stage} go={go} canGo={canGo} onPick={id => update({ active: id })} open={flowOpen} aiOpen={collab.open}
            onOpen={() => { if (collab.open) collab.close(); setFlowPref(true) }} onClose={() => setFlowPref(false)} />
        </aside>
        {sharing && <ShareDialog c={c} update={update} notify={notify} onClose={() => setSharing(false)} />}
        {history && <HistoryDrawer c={c} onClose={() => setHistory(false)} />}
        <Charles busy={demoBusy} respond={casperRespond} greeting={casperGreeting} context={[c.brand || 'New model', `Step ${stage} · ${S.short}`, ind.name || 'Stream 1']}
          extra={<AgentDemoCard assistant={ASSISTANT} title="Build the whole model from one sentence" prompt="Set up a Braftovi US model, oncology brand in growth, with streams for NSCLC, CRC and melanoma by indication." steps={DEMO_STEPS} demo={demo} onRun={runDemo} onStop={stopDemo}
            onReview={() => { go(REVIEW); if (window.innerWidth < 1024) collab.close() }} reviewLabel="Review configuration" note="Fills every step through Data configuration, then stops at Review. Finalising always stays with you." />}
          after={demo?.done ? (
            <div className="rise rounded-xl border border-border bg-surface p-3">
              <p className="text-[13px] font-semibold">Model flow · ready for your review</p>
              <p className="mb-2.5 text-[12px] text-text-3">What I configured, step by step. Select a step to check or change it. Nothing is finalised.</p>
              <ModelFlow {...cfgFlow(c)} go={go} />
            </div>
          ) : undefined}
          chips={stage === 1 ? ['Set up a model for Braftovi, a brand in oncology at growth, with streams for NSCLC, CRC and melanoma', 'Add a stream for Crohn’s', 'What’s still missing?'] : stage === 2 ? ['Compare the archetypes', 'Explain this step'] : stage === 3 ? ['What are modes?', 'Audit before finalising'] : stage === 4 ? ['Attach default modules', 'Explain this step'] : stage === 5 ? ['Use suggested sources', 'What data is still unconfigured?'] : ['What’s missing before I finalise?', 'Explain this step']} />
      </div>

    </div>
  )
}

function ShareDialog({ c, update, notify, onClose }: { c: Config; update: (p: Partial<Config>) => void; notify: (t: Toast) => void; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const avail = PEOPLE.filter(p => !c.team.some(m => m.name === p))
  const [who, setWho] = useState('')
  const [role, setRole] = useState<Role>('Editor')
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who.trim())
  const external = isEmail && !/@pfizer\.com$/i.test(who.trim())
  const known = PEOPLE.includes(who)
  const dup = c.team.some(m => m.name.toLowerCase() === who.trim().toLowerCase())
  const invite = () => { if (!(isEmail || known) || dup) return; update({ team: [...c.team, { name: who, role }] }); notify({ tone: 'ok', text: isEmail ? `Invite emailed to ${who.trim()} as ${role}${external ? ' · pending CoE approval' : ''}.` : `${who.split(' (')[0]} invited as ${role}. They can open this model only.` }); setWho('') }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={onClose}>
      <div className="rise w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="share-title" className="text-lg font-semibold">Share {c.brand || 'this model'}</h2><p className="mt-1 text-sm text-text-2">Access is per model. People you invite see this model only, not the rest of the library.</p></div>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />}><span className="sr-only">Close</span></Btn>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input list="share-people" aria-label="Name or email" value={who} onChange={e => setWho(e.target.value)} onKeyDown={e => e.key === 'Enter' && invite()} placeholder="Name or email address" className={cx(inputCls(), 'pl-9')} />
            <datalist id="share-people">{avail.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <select aria-label="Role" className={cx(inputCls(), 'w-fit!')} value={role} onChange={e => setRole(e.target.value as Role)}>{ROLES.filter(x => x.r !== 'Creator').map(x => <option key={x.r}>{x.r}</option>)}</select>
          <Btn onClick={invite} disabled={!(isEmail || known) || dup}>Invite</Btn>
        </div>
        <p className={cx('mt-1.5 text-xs', dup ? 'text-err' : external ? 'text-warn' : 'text-text-3')}>{dup ? 'Already has access.' : external ? 'External address. The invite is emailed after CoE approval and expires in 7 days.' : isEmail ? 'They get an email with a link to this model.' : 'Pick a colleague or type any email address.'}</p>
        <ul className="mt-5 divide-y divide-border rounded-md border border-border">
          {c.team.map(m => (
            <li key={m.name} className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">{m.name.split(/[\s.]+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('')}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.name}{m.name === ME && <span className="text-text-3"> (you)</span>}</span>{m.name.includes('@') ? <span className="text-[11px] text-warn">Invite sent · not yet accepted</span> : null}</span>
              {m.role === 'Creator' ? <Badge tone="brand">Creator</Badge> : (
                <>
                  <select aria-label={`Role for ${m.name}`} className={cx(inputCls(), 'h-8! w-fit! text-[13px]')} value={m.role} onChange={e => update({ team: c.team.map(x => x.name === m.name ? { ...x, role: e.target.value as Role } : x) })}>{ROLES.filter(x => x.r !== 'Creator').map(x => <option key={x.r}>{x.r}</option>)}</select>
                  <Btn variant="ghost" size="sm" icon={<X size={14} />} onClick={() => update({ team: c.team.filter(x => x.name !== m.name) })}><span className="sr-only">Remove {m.name}</span></Btn>
                </>
              )}
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">{ROLES.map(x => <div key={x.r}><dt className="inline font-semibold">{x.r}</dt><dd className="inline text-text-2"> · {x.d}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-text-3">Super User and Forecaster are platform roles from IAM. Forecasters are given access at Finalise setup. BD models sit in a separate restricted partition.</p>
      </div>
    </div>
  )
}

function HistoryDrawer({ c, onClose }: { c: Config; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-dark/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Change history" onClick={e => e.stopPropagation()} className="rise flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div><p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Change history</p><p className="font-semibold">{c.brand || 'Untitled model'} · {c.version} {c.release}</p><p className="text-xs text-text-2">What changed, who changed it, and when. Kept with every saved version.</p></div>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />}><span className="sr-only">Close</span></Btn>
        </div>
        <ol className="flex-1 space-y-3 overflow-y-auto p-5">
          {c.log.length === 0 && <li className="text-sm text-text-2">No changes yet in this working version.</li>}
          {c.log.map((e, k) => (
            <li key={k} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
              <div className="min-w-0"><p>{e.what}</p><p className="text-xs text-text-3">{e.who} · {e.when}</p></div>
            </li>
          ))}
          <li className="flex gap-3 text-[13px]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong" /><div><p>Working version {c.version} opened</p><p className="text-xs text-text-3">{ME} · Today</p></div></li>
        </ol>
      </aside>
    </div>
  )
}

function IndTabs({ c, issues, onPick }: { c: Config; stage: number; issues: Issue[]; onPick: (id: string) => void }) {
  const ind = c.inds.find(i => i.id === c.active) ?? c.inds[0]
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
      <StreamList c={c} ind={ind} update={p => p.active && onPick(p.active)} tabs
        sub={i => issues.some(x => x.ind === i.id) ? ['Needs attention', false] : [i.arch ? archName(i.arch) : 'Ready', true]} />
    </div>
  )
}


/* ───────────────────────── Summary panel ───────────────────────── */

function SummaryPanel({ c, issues, visited, go }: { c: Config; issues: Issue[][]; visited: Set<number>; go: (n: number) => void }) {
  const ins = inputsFor(c)
  const bound = ins.filter(b => resolved(c.bindings[b.key])).length
  const open = c.inds.reduce((n, i) => n + Object.values(i.perms).filter(p => p.open).length, 0)
  const rows: { label: string; value: ReactNode; stage: number }[] = [
    { label: 'Model', value: c.brand ? `${c.brand} · ${c.asset} · ${c.subjectType}` : <span className="text-text-3">Not set</span>, stage: 1 },
    { label: 'Streams & archetypes', value: <ul className="space-y-0.5">{c.inds.map(i => <li key={i.id}>{i.name || 'Untitled'} <span className="text-text-3">· {ARCHETYPES.find(a => a.id === i.arch)?.name ?? 'not chosen'}</span></li>)}</ul>, stage: 2 },
    { label: 'Modules', value: c.inds.some(i => i.arch) ? c.inds.map(i => `${i.modules.length}`).join(' + ') + ' attached' : '—', stage: 4 },
    { label: 'Data configuration', value: ins.length ? `${ins.length} inputs · ${ins.filter(b => exposeOf(c.bindings[b.key]) === 'Editable').length} forecaster-editable` : '—', stage: 5 },
  ]
  return (
    <aside className="hidden border-l border-border bg-surface wide:block">
      <div className="sticky top-[50px] max-h-[calc(100dvh-122px)] overflow-y-auto p-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Model summary</p>
        <dl className="mt-4 divide-y divide-border">
          {rows.map(r => {
            const bad = visited.has(r.stage) && issues[r.stage - 1].length > 0
            return (
              <div key={r.label} className="group py-3">
                <dt className="flex items-center justify-between text-xs text-text-3">
                  <span className="flex items-center gap-1">{r.label}{bad && <AlertCircle size={11} className="text-err" />}</span>
                  <button type="button" onClick={() => go(r.stage)} className="font-semibold text-brand hover:underline">Edit</button>
                </dt>
                <dd className="mt-0.5 text-[13px] font-medium text-text">{r.value}</dd>
              </div>
            )
          })}
        </dl>
        <div className="mt-4 rounded-md bg-background p-3 text-xs text-text-2">
          <p className="font-semibold text-text">Tier: {c.grade}</p>
          <p className="mt-1">Tiers only move down in use — a screening model can never be promoted into a valuation.</p>
        </div>
      </div>
    </aside>
  )
}

/* ───────────────────────── Step 1 · Brand setup ───────────────────────── */

function StageBrand({ c, update, errs }: Ctx & { errs: Issue[] }) {
  const err = (f: string) => errs.find(e => e.field === f)?.msg
  const ai = (k: keyof Config) => c.aiFields.includes(k)
  // Editing a field the assistant filled clears its marker: the value is now the user's.
  const setF = <K extends keyof Config>(k: K, v: Config[K]) => update({ [k]: v, aiFields: c.aiFields.filter(x => x !== k) } as Partial<Config>)
  const [pending, setPending] = useState<string | null>(null)
  const addInd = () => { const id = 'i' + Date.now(); update({ inds: [...c.inds, emptyInd(id, '')], active: id }) }
  const rmInd = (id: string) => {
    const inds = c.inds.filter(i => i.id !== id)
    update({ inds, active: c.active === id ? inds[0]?.id ?? '' : c.active, bindings: Object.fromEntries(Object.entries(c.bindings).filter(([k]) => !k.startsWith(`${id}:`))) })
  }

  return (
    <>

      <AgentSection id="subject"><Card title="Forecast subject" sub="Required fields are marked *.">
        <div className="grid gap-5 @xl:grid-cols-2">
          <Field label="Model name" required error={err('brand')} ai={ai('brand')} agent="brand"><input className={inputCls(!!err('brand'))} value={c.brand} onChange={e => setF('brand', e.target.value)} placeholder="e.g. Velsipity US model" /></Field>
          <Field label="Brand or asset name" required error={err('asset')} ai={ai('asset')} agent="asset"><input className={inputCls(!!err('asset'))} value={c.asset} onChange={e => setF('asset', e.target.value)} placeholder="e.g. Velsipity" /></Field>
          <Field label="Asset type" ai={ai('subjectType')} agent="subjectType">
            <select className={inputCls()} value={c.subjectType} onChange={e => setF('subjectType', e.target.value)}>
              {['Brand / Asset', 'Pipeline asset', 'Franchise', 'Portfolio', 'Portfolio component', 'Market-level asset', 'Other modeled unit'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Therapy area" hint="Reference only — does not restrict archetype" ai={ai('therapyArea')} agent="therapyArea">
            <select className={inputCls()} value={c.therapyArea} onChange={e => setF('therapyArea', e.target.value)}>
              {['Oncology', 'Immunology', 'Neurology', 'Rare disease', 'Cardiometabolic', 'Infectious disease', 'Vaccines', 'Other'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Lifecycle stage" hint="Affects which modules are typical, e.g. LOE erosion" ai={ai('lifecycle')} agent="lifecycle">
            <select className={inputCls()} value={c.lifecycle} onChange={e => setF('lifecycle', e.target.value)}>
              {['Pipeline (Pre-Launch)', 'Launch', 'Growth', 'Mature', 'Loss of exclusivity'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <div className="@xl:col-span-2"><Field label="Description or purpose" hint="Optional — helps others identify the model">
            <textarea rows={2} className={cx(inputCls(), 'h-auto py-2')} value={c.context} onChange={e => update({ context: e.target.value })} placeholder="e.g. US model for Velsipity across UC and Crohn’s, used for OP and LRP planning" />
          </Field></div>
        </div>
        <fieldset className="mt-5">
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-2">Multi-asset options</legend>
          <div className="space-y-2">
            <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={c.competing} onChange={e => update({ competing: e.target.checked })} />Model competing assets drawing from the same patient pool (e.g. Brand A 1L vs Brand B 1L)</label>
            <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={c.subnational} onChange={e => update({ subnational: e.target.checked })} />Enable subnational breakout (provinces, regions, channels)</label>
          </div>
        </fieldset>
      </Card></AgentSection>

      <AgentSection id="streams"><Card title="Revenue streams" sub={c.aiFields.includes('inds') ? `Streams were filled by ${ASSISTANT} — review the names below.` : 'Split by indication, line of therapy, segment or other dimension.'} right={<Btn variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addInd}>Add stream</Btn>}>
        {err('inds') && <p className="mb-3 flex items-center gap-1 text-xs text-err"><AlertCircle size={12} />{err('inds')}</p>}
        <ul className="space-y-4">
          {c.inds.map((i, k) => <StreamCard key={i.id} i={i} k={k} c={c} error={err(`ind-${i.id}`)} update={update} onRemove={() => i.arch ? setPending(i.id) : rmInd(i.id)} />)}
        </ul>
        <StreamTree c={c} />
        {pending && (() => {
          const i = c.inds.find(x => x.id === pending)
          const nb = Object.keys(c.bindings).filter(k => k.startsWith(`${pending}:`)).length
          return (
            <div className="mt-4"><Banner tone="warn" title={`Remove ${i?.name || 'this stream'}?`}
              action={<div className="flex shrink-0 gap-2"><Btn size="sm" variant="secondary" onClick={() => setPending(null)}>Keep</Btn><Btn size="sm" variant="danger" onClick={() => { rmInd(pending); setPending(null) }}>Remove</Btn></div>}>
              Clears {nb} data source setting{nb === 1 ? '' : 's'} and {i?.modules.length ?? 0} modules. Versions already available to Forecasters are untouched.
            </Banner></div>
          )
        })()}
      </Card></AgentSection>

    </>
  )
}

const LEVEL_KINDS: Record<string, string[]> = {
  'Indication': ['NSCLC', 'CRC', 'Melanoma', 'Ulcerative colitis', 'Crohn’s disease'],
  'Line of therapy': ['1L', '2L', '3L+'],
  'Patient segment (Biomarker)': ['Biomarker +', 'Biomarker −'],
  'Geography': ['US', 'EU5', 'Japan', 'China'],
  'Channel': ['Retail', 'Specialty', 'Hospital'],
  'Age group': ['Adult', 'Pediatric'],
  'Custom level': [],
}
const SEPARATORS: [string, string][] = [[' ', 'Space'], [' · ', 'Dot'], [' - ', 'Dash'], ['/', 'Slash']]
const shortKind = (k: string) => k.replace(/ \(.*\)/, '')
const comboList = (levels: Level[]): string[][] => levels.filter(l => l.items.length).reduce<string[][]>((acc, l) => acc.flatMap(a => l.items.map(it => [...a, it])), [[]]).filter(r => r.length)

type TNode = { key: string; label: string; depth: number; kids: TNode[]; leaf?: boolean }
function buildTree(levels: Level[], name: string, sep: string): TNode[] {
  const act = levels.filter(l => l.items.length)
  if (!act.length) return [{ key: 'solo', label: name || 'Stream', depth: 0, kids: [] }]
  const rec = (d: number, path: string[]): TNode[] => act[d]!.items.map(it => {
    const p = [...path, it]
    return { key: p.join('|'), label: it, depth: d, kids: d + 1 === act.length ? [{ key: `${p.join('|')}#`, label: p.join(sep), depth: d + 1, kids: [], leaf: true }] : rec(d + 1, p) }
  })
  return rec(0, [])
}
const hasKids = (n: TNode) => n.kids.length > 0 && !n.leaf
const allKeys = (ns: TNode[]): string[] => ns.flatMap(n => (hasKids(n) ? [n.key, ...allKeys(n.kids)] : []))

function TreeBranch({ n, closed, toggle }: { n: TNode; closed: Set<string>; toggle: (k: string) => void }) {
  const shut = closed.has(n.key)
  const tone = n.leaf ? 'border-brand/40 bg-surface text-text' : n.depth === 0 ? 'border-ok/30 bg-ok-soft text-ok' : 'border-brand/20 bg-brand-soft text-brand'
  const Icon = n.leaf ? BarChart3 : n.depth === 0 ? GitBranch : Users
  const box = <><Icon size={13} className="shrink-0" /><span className="whitespace-nowrap">{n.label}</span>{hasKids(n) && <ChevronRight size={12} className={cx('shrink-0 transition-transform', !shut && 'rotate-90')} />}</>
  return (
    <div className="flex items-center">
      {hasKids(n)
        ? <button type="button" aria-expanded={!shut} onClick={() => toggle(n.key)} className={cx('flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium', tone)}>{box}</button>
        : <span className={cx('flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium', tone)}>{box}</span>}
      {n.kids.length > 0 && !shut && (
        <div className="flex items-center"><span className="h-px w-4 shrink-0 bg-border-strong" />
          <ul>{n.kids.map(ch => (
            <li key={ch.key} className="relative py-1 pl-4 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-px before:bg-border-strong first:before:top-1/2 last:before:bottom-1/2">
              <span className="absolute left-0 top-1/2 h-px w-4 bg-border-strong" /><TreeBranch n={ch} closed={closed} toggle={toggle} /></li>))}</ul></div>
      )}
    </div>
  )
}

function ItemsEditor({ level, onChange }: { level: Level; onChange: (items: string[]) => void }) {
  const [v, setV] = useState('')
  const add = (t: string) => { const s = t.trim(); if (s && !level.items.includes(s)) onChange([...level.items, s]); setV('') }
  const sugg = (LEVEL_KINDS[level.kind] ?? []).filter(s => !level.items.includes(s))
  return (
    <div className="space-y-2.5 border-t border-border px-3 py-3">
      <div className="flex flex-wrap gap-1.5">
        {level.items.map(it => <span key={it} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[12px] font-medium text-brand">{it}<button type="button" aria-label={`Remove ${it}`} onClick={() => onChange(level.items.filter(x => x !== it))} className="rounded hover:bg-brand/10"><X size={12} /></button></span>)}
        {!level.items.length && <span className="text-[12px] text-text-3">No items yet. Add at least one to include this level.</span>}
      </div>
      <input aria-label={`Add ${level.kind} item`} className={inputCls()} value={v} placeholder="Type an item and press Enter" onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(v) } }} />
      {sugg.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-text-3">Suggestions</span>{sugg.map(s => <button key={s} type="button" onClick={() => add(s)} className="rounded-md border border-border px-2 py-0.5 text-[12px] text-text-2 hover:border-brand hover:text-brand">+ {s}</button>)}</div>}
    </div>
  )
}

function StreamCard({ i, k, c, error, update, onRemove }: { i: Ind; k: number; c: Config; error?: string; update: (p: Partial<Config>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(k === 0)
  const [menu, setMenu] = useState(false)
  const [lvlOpen, setLvlOpen] = useState<string | null>(null)
  const [kindMenu, setKindMenu] = useState(false)
  const [adv, setAdv] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const set = (p: Partial<Ind>) => update({ inds: c.inds.map(x => x.id === i.id ? { ...x, ...p } : x) })
  const levels = i.levels ?? []
  const auto = i.auto !== false, sep = i.sep ?? ' '
  const combos = comboList(levels)
  const rows = auto ? combos : (i.snap ?? combos)
  const stale = !auto && JSON.stringify(i.snap ?? combos) !== JSON.stringify(combos)
  const act = levels.filter(l => l.items.length)
  const tree = buildTree(levels, i.name, sep)
  const setLevels = (ls: Level[]) => set({ levels: ls })
  const addLevel = (kind: string) => { const id = `l${Date.now()}`; setLevels([...levels, { id, kind, items: [] }]); setLvlOpen(id); setKindMenu(false) }
  const nextKind = Object.keys(LEVEL_KINDS).find(kd => !levels.some(l => l.kind === kd)) ?? 'Custom level'
  const move = (to: string) => { if (!drag || drag === to) return; const a = levels.findIndex(l => l.id === drag), b = levels.findIndex(l => l.id === to); const ls = [...levels]; const [m] = ls.splice(a, 1); ls.splice(b, 0, m!); setLevels(ls) }
  const toggleNode = (key: string) => setClosed(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const idx = c.inds.findIndex(x => x.id === i.id)
  const swap = (d: number) => update({ inds: c.inds.map((x, j, a) => j === idx + d ? a[idx]! : j === idx ? a[idx + d]! : x) })
  const menuItem = 'block w-full rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-background disabled:opacity-40'
  return (
    <li className={cx('overflow-hidden rounded-md border', error ? 'border-err' : c.active === i.id ? 'border-brand/40' : 'border-border')}>
      <div className={cx('flex items-center gap-3 px-4 py-3', c.active === i.id ? 'bg-brand-soft/50' : 'bg-background')}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">{k + 1}</span>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{i.name || `Revenue Stream ${k + 1}`}</span>{!open && <span className="block text-xs text-text-3">{rows.length} generated stream{rows.length === 1 ? '' : 's'}{error ? ` · ${error}` : ''}</span>}</button>
        <div className="relative">
          <Btn variant="ghost" size="sm" onClick={() => setMenu(m => !m)} icon={<span aria-hidden className="text-base leading-none">⋮</span>}><span className="sr-only">Stream actions</span></Btn>
          {menu && <><div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div role="menu" className="absolute right-0 top-9 z-20 w-40 rounded-md border border-border bg-surface p-1 shadow-xl">
              <button role="menuitem" className={menuItem} onClick={() => { setMenu(false); const id = `i${Date.now()}`; update({ inds: [...c.inds.slice(0, idx + 1), { ...i, id, name: `${i.name || 'Stream'} (copy)` }, ...c.inds.slice(idx + 1)], active: id }) }}>Duplicate</button>
              <button role="menuitem" className={menuItem} disabled={idx === 0} onClick={() => { setMenu(false); swap(-1) }}>Move up</button>
              <button role="menuitem" className={menuItem} disabled={idx === c.inds.length - 1} onClick={() => { setMenu(false); swap(1) }}>Move down</button>
              <button role="menuitem" className={cx(menuItem, 'text-err')} disabled={c.inds.length === 1} onClick={() => { setMenu(false); onRemove() }}>Remove</button>
            </div></>}
        </div>
        <button type="button" aria-label={open ? 'Collapse stream' : 'Expand stream'} onClick={() => setOpen(o => !o)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface"><ChevronUp size={16} className={cx('transition-transform', !open && 'rotate-180')} /></button>
      </div>

      {open && (
        <div className="space-y-5 p-4">
          <div className="grid gap-3 @2xl:grid-cols-2">
            <Field label="Stream name" required error={error} agent={`stream-${k}`}><input className={inputCls(!!error)} value={i.name} onFocus={() => update({ active: i.id })} onChange={ev => set({ name: ev.target.value })} placeholder={`Revenue Stream ${k + 1}`} /></Field>
            <Field label="How it adds up" hint="Whether this stream counts on its own or sits inside another stream"><select className={inputCls()} value={i.parent || ''} onChange={ev => set({ parent: ev.target.value || undefined })}>
              <option value="">Adds to the model total</option>{c.inds.filter(x => x.id !== i.id && !x.parent).map(x => <option key={x.id} value={x.id}>Part of {x.name || 'untitled stream'}</option>)}
            </select></Field>
          </div>

          <div className="grid gap-4 @3xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <section className="rounded-md border border-border p-4">
              <h4 className="text-sm font-semibold">Stream structure</h4>
              <p className="mb-3 text-xs text-text-2">Add the levels this stream splits by.</p>
              {!levels.length && <p className="mb-3 rounded-md border border-dashed border-border-strong p-3 text-xs text-text-3">No levels yet. Add the levels this stream splits by, or leave it as a single revenue line.</p>}
              <ul className="space-y-2">
                {levels.map(l => (
                  <li key={l.id} draggable onDragStart={() => setDrag(l.id)} onDragOver={e => e.preventDefault()} onDrop={() => { move(l.id); setDrag(null) }} onDragEnd={() => setDrag(null)} className={cx('flex items-start gap-2', drag === l.id && 'opacity-50')}>
                    <span aria-label="Drag to reorder" className="mt-3 cursor-grab text-text-3"><GripVertical size={16} /></span>
                    <div className="min-w-0 flex-1 rounded-md border border-border bg-surface">
                      <button type="button" aria-expanded={lvlOpen === l.id} onClick={() => setLvlOpen(lvlOpen === l.id ? null : l.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
                        <span><span className="block text-[13px] font-semibold">{l.kind}</span><span className="block text-xs text-text-3">{l.items.length} item{l.items.length === 1 ? '' : 's'} selected</span></span>
                        <ChevronDown size={15} className={cx('shrink-0 text-text-2 transition-transform', lvlOpen === l.id && 'rotate-180')} /></button>
                      {lvlOpen === l.id && <ItemsEditor level={l} onChange={items => setLevels(levels.map(x => x.id === l.id ? { ...x, items } : x))} />}
                    </div>
                    <button type="button" aria-label={`Remove ${l.kind} level`} onClick={() => setLevels(levels.filter(x => x.id !== l.id))} className="mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-err hover:bg-err-soft"><X size={15} /></button>
                  </li>))}
              </ul>
              <div className="relative mt-3 inline-flex rounded-md border border-border-strong bg-surface">
                <button type="button" onClick={() => addLevel(nextKind)} className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium hover:bg-background"><Plus size={14} />Add level</button>
                <button type="button" aria-label="Choose level type" onClick={() => setKindMenu(m => !m)} className="border-l border-border px-2 hover:bg-background"><ChevronDown size={14} /></button>
                {kindMenu && <><div className="fixed inset-0 z-10" onClick={() => setKindMenu(false)} />
                  <div role="menu" className="absolute left-0 top-10 z-20 w-56 rounded-md border border-border bg-surface p-1 shadow-xl">{Object.keys(LEVEL_KINDS).map(kd => <button key={kd} role="menuitem" className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-background" onClick={() => addLevel(kd)}>{kd}</button>)}</div></>}
              </div>

              <div className="mt-4 rounded-md border border-border">
                <button type="button" aria-expanded={adv} onClick={() => setAdv(a => !a)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold">Advanced options<ChevronDown size={15} className={cx('transition-transform', adv && 'rotate-180')} /></button>
                {adv && <div className="border-t border-border p-3"><Field label="Name separator" hint="Joins the levels in generated stream names"><select className={inputCls()} value={sep} onChange={ev => set({ sep: ev.target.value })}>{SEPARATORS.map(([v, n]) => <option key={n} value={v}>{n}</option>)}</select></Field></div>}
              </div>
              <label className="mt-4 flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={auto} onChange={e => set(e.target.checked ? { auto: true, snap: undefined } : { auto: false, snap: combos })} />
                <span><span className="inline-flex items-center gap-1 font-semibold">Auto-generate revenue streams from structure<span title="When off, the table below keeps its current rows until you press Regenerate."><Info size={13} className="text-text-3" /></span></span>
                  <span className="block text-xs text-text-3">Streams will be generated for all unique combinations of the selected levels.</span></span>
              </label>
            </section>

            <div className="min-w-0 space-y-4">
              <section className="rounded-md border border-border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Structure preview</h4>
                  <div className="flex gap-2"><Btn variant="secondary" size="sm" onClick={() => setClosed(new Set())}>Expand all</Btn><Btn variant="secondary" size="sm" onClick={() => setClosed(new Set(allKeys(tree)))}>Collapse all</Btn></div></div>
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-center">
                    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand-dark px-3 py-2 text-[12px] font-semibold text-white"><Workflow size={13} />{c.brand || 'Model'} total</span>
                    <span className="h-px w-4 shrink-0 bg-border-strong" />
                    <ul>{tree.map(n => (
                      <li key={n.key} className="relative py-1 pl-4 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-px before:bg-border-strong first:before:top-1/2 last:before:bottom-1/2">
                        <span className="absolute left-0 top-1/2 h-px w-4 bg-border-strong" /><TreeBranch n={n} closed={closed} toggle={toggleNode} /></li>))}</ul>
                  </div>
                </div>
              </section>
              <section>
                <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold">Generated revenue streams ({rows.length || 1})</h4>
                  <button type="button" onClick={() => set({ snap: combos })} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><RefreshCw size={12} />Regenerate</button></div>
                {stale && <p className="mb-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">The structure changed since these rows were generated. Press Regenerate to update them.</p>}
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[420px] text-left text-[13px]">
                    <thead className="bg-background text-xs text-text-2"><tr><th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Revenue stream name</th>{act.map(l => <th key={l.id} className="px-3 py-2 font-semibold">{shortKind(l.kind)}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border">
                      {(rows.length ? rows : [[]]).map((r, n) => <tr key={n}><td className="px-3 py-2 text-text-3">{n + 1}</td><td className="px-3 py-2 font-medium">{r.length ? r.join(sep) : (i.name || `Revenue Stream ${k + 1}`)}</td>{act.map((l, j) => <td key={l.id} className="px-3 py-2 text-text-2">{r[j] ?? '—'}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function StreamTree({ c }: { c: Config }) {
  const roots = c.inds.filter(i => !i.parent || !c.inds.some(x => x.id === i.parent))
  return (
    <div className="mt-4 rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wider text-text-2">How the streams add up</p><span className="text-[11px] text-text-3">Dependency rules pending the agreed taxonomy and data model</span></div>
      <div className="mt-3 flex items-start gap-3 overflow-x-auto">
        <div className="shrink-0 rounded-md bg-brand-dark px-3 py-2 text-[12px] font-semibold text-white">{c.brand || 'Model'} total</div>
        <div className="mt-4 h-px w-4 shrink-0 bg-border-strong" />
        <ul className="min-w-0 space-y-1.5 border-l border-border-strong pl-3">
          {roots.map(r => (
            <li key={r.id}>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium">{r.name || 'Untitled stream'}{r.dim && <span className="text-text-3">· {r.dim}</span>}</span>
              {c.inds.some(x => x.parent === r.id) && <ul className="ml-4 mt-1.5 space-y-1.5 border-l border-dashed border-border-strong pl-3">{c.inds.filter(x => x.parent === r.id).map(x => <li key={x.id}><span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface px-2.5 py-1 text-[12px]">{x.name || 'Untitled stream'}{x.dim && <span className="text-text-3">· {x.dim}</span>}</span></li>)}</ul>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ───────────────────────── Step 2 · Archetypes ───────────────────────── */

const ARCH_GRID: { id: ArchId; name: string; blurb: string}[] = [
  { id: 'D-01', name: 'Prevalent Share', blurb: 'Re-stated pool of treated patients; brand captures a share each period. No memory of how patients arrived.' },
  { id: 'D-02', name: 'Rx Share', blurb: 'Prescription basket defines the market; volume trended forward; brand takes a share. No patient state.' },
  { id: 'D-03', name: 'Patient Flow', blurb: 'New patients start and persist by a decay surface; book = convolution of start cohorts × persistency.' },
  { id: 'D-05', name: 'Market Stock-Flow', blurb: 'Eligible stock depleted by capture, replenished by aging and re-entry. Dose chains, waning, boosters.' },
  { id: 'D-07', name: 'Peak-Year Sizing', blurb: 'Time-collapsed funnel at a single peak year. Ranges not points, confidence grades, reverse-solve tables.' },
]
const archName = (id: ArchId | null) => ARCH_GRID.find(a => a.id === id)?.name ?? (id === 'D-06' ? 'Trend / Extrapolation' : ARCHETYPES.find(a => a.id === id)?.name ?? '')

function StageArchetype({ c, ind, update, updInd, setArch, notify, fix }: Ctx) {
  const [pending, setPending] = useState<ArchId | null>(null)
  const [detail, setDetail] = useState<ArchId | null>(null)
  const sel = ind.arch
  const advance = () => { const nxt = c.inds.find(i => i.id !== ind.id && !i.arch); if (nxt) update({ active: nxt.id }) }
  const pick = (id: ArchId) => { if (ind.arch === id) return; if (ind.arch) setPending(id); else { setArch(ind.id, id); advance() } }
  const others = c.inds.filter(i => i.id !== ind.id)
  const differ = others.filter(i => i.arch !== sel)
  const applyAll = () => {
    if (!sel) return
    differ.forEach(i => setArch(i.id, sel))
    notify({ tone: 'ok', text: `${archName(sel)} applied to all ${c.inds.length} streams.` })
  }
  const coreCount = (a: ArchId) => MODULES.filter(m => m.required?.includes(a)).length
  const impact = (() => {
    const nb = Object.keys(c.bindings).filter(k => k.startsWith(`${ind.id}:`)).length
    return `${Object.keys(ind.modes).filter(k => k !== 'trend' && !k.startsWith('time_')).length} modes and ${ind.modules.length} attached modules reset to the new archetype’s defaults, ${nb} data configuration${nb === 1 ? '' : 's'} for this stream ${nb === 1 ? 'is' : 'are'} cleared, and its Forecaster inputs reset. Other streams aren’t touched.`
  })()
  const badCombo = sel && c.grade === 'Valuation' && (ind.engine.includes('beta') || ARCH_DETAIL[sel].status !== 'Certified')
  const legacy = sel === 'D-04'

  return (
    <>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <StreamList c={c} ind={ind} update={update} tabs
          sub={i => i.arch ? [i.arch, true] : ['No archetype', false]}
          footer={c.inds.length > 1 && (
            <Btn size="sm" variant="secondary" icon={sel && !differ.length ? <Check size={14} /> : <Zap size={14} />} disabled={!sel || !differ.length} onClick={applyAll}
              title={!sel ? 'Pick an archetype for the selected stream first' : sel && differ.some(i => i.arch) ? 'Streams with a different archetype reset to its defaults.' : undefined}>
              {sel && !differ.length ? 'Applied to all streams' : sel ? `Apply ${archName(sel)} to all` : 'Apply to all streams'}
            </Btn>
          )} />

        <div className="@container min-w-0 p-4">
          <p className="mb-3 text-[13px] text-text-2">Archetype for <b className="text-text">{ind.name || 'this stream'}</b></p>
          {pending && <div className="mb-3">
            <Banner tone="warn" title={`Switch ${ind.name || 'this stream'} to ${archName(pending)}? This affects later steps.`}
              action={<div className="flex shrink-0 flex-col gap-2 @md:flex-row"><Btn size="sm" variant="secondary" onClick={() => setPending(null)}>Keep current</Btn><Btn size="sm" onClick={() => { setArch(ind.id, pending); setPending(null); notify({ tone: 'info', text: `${ind.name || 'Stream'} switched to ${archName(pending)}. Review modes and modules.` }) }}>Switch</Btn></div>}>
              {impact}
            </Banner>
          </div>}
          {sel && !pending && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-ok/25 bg-ok-soft px-3 py-2.5 text-[13px]">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ok" />
              <div className="min-w-0">
                <p><b>{archName(sel)}</b> selected for {ind.name || 'this stream'}. {ARCH_DETAIL[sel].question}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Model flow preview · core modules by lane</p>
                <ol className="mt-1.5 flex flex-wrap items-center gap-1">
                  {BUCKETS.map(b => ({ b, ms: requiredFor(sel).map(id => MODULES.find(m => m.id === id)!).filter(m => m && m.cat === b) })).filter(x => x.ms.length).map((x, k, arr) => (
                    <li key={x.b} className="flex items-center gap-1">
                      <span className="rounded border border-border bg-surface px-2 py-1 text-xs"><span className="font-semibold">{x.b}</span><span className="text-text-3"> · {x.ms.map(m => m.name).join(', ')}</span></span>
                      {k < arr.length - 1 && <ChevronRight size={12} className="text-text-3" aria-hidden />}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label={`Archetype for ${ind.name || 'this stream'}`}>
            {ARCH_GRID.map(a => {
              const on = sel === a.id
              const d = ARCH_DETAIL[a.id]
              const open = detail === a.id
              return (
                <div key={a.id} className={cx('rounded-md border transition-all', on ? 'border-brand bg-brand-soft/30 ring-1 ring-brand' : 'border-border hover:border-text-2')}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => pick(a.id)}
                    className="flex w-full items-start gap-4 rounded-md p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{a.name}</span>
                        <span className="font-mono text-[10px] text-text-3">{a.id}</span>
                        <span className="sr-only">{d.status}</span>{d.status !== 'Certified' && <Badge tone="warn">{d.status}</Badge>}
                      </span>
                      <span className="mt-1 text-xs leading-snug text-text-2">{a.blurb}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-text-3">{modesFor(a.id).length} modes · {coreCount(a.id)} core modules (from metadata)</span>
                      </span>
                    </span>
                    <span aria-hidden className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors', on ? 'border-brand' : 'border-border-strong')}>{on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>
                  </button>
                  <div className="px-3 pb-2.5">
                    <button type="button" aria-expanded={open} onClick={() => setDetail(open ? null : a.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                      {open ? 'Hide details' : 'View details'}<ChevronDown size={13} className={cx('transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <dl className="mt-2 grid gap-3 rounded-md bg-background p-3 text-xs @xl:grid-cols-2">
                        <div><dt className="font-semibold text-text">Question it answers</dt><dd className="mt-0.5 text-text-2">{d.question}</dd></div>
                        <div><dt className="font-semibold text-text">What it controls</dt><dd className="mt-0.5 text-text-2">The core volume engine, the modes available, and which modules can attach.</dd></div>
                        <div><dt className="font-semibold text-text">Modes it loads</dt><dd className="mt-0.5 text-text-2">{modesFor(a.id).map(m => m.label).join(' · ')}</dd></div>
                        <div><dt className="font-semibold text-text">Limits</dt><dd className="mt-0.5 text-text-2">{d.limit}</dd></div>
                      </dl>
                    )}
                  </div>
                </div>
              )
            })}
            <div className={cx('flex items-start gap-4 rounded-md border border-dashed p-3', sel === 'D-06' ? 'border-brand ring-1 ring-brand' : 'border-border-strong bg-background')}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text-2">Trend / Extrapolation</span>
                  <Badge>Under discussion</Badge>
                </span>
                <span className="mt-1 text-xs leading-snug text-text-3">Evidence supports this as a cross-engine capability rather than a standalone archetype.</span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  {sel === 'D-06' ? <Badge tone="brand"><Check size={10} />Used standalone</Badge>
                    : <Btn size="sm" variant="secondary" onClick={() => pick('D-06')}>Use as standalone<ArrowUpRight size={13} /></Btn>}
                  <span className="text-[10px] text-text-3">Alignment pending</span>
                </span>
              </div>
              <span aria-hidden className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', sel === 'D-06' ? 'border-brand' : 'border-border-strong')}>{sel === 'D-06' && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>
            </div>
          </div>
        </div>
      </section>

      {legacy && <Banner tone="warn" title="This stream uses Brand Inflow-Outflow (D-04), which is under review">It may fold into Patient Flow. Pick Patient Flow above to migrate.</Banner>}

      {badCombo && <div><Banner tone="err" title="Not allowed at Valuation tier" action={<FixForMe onClick={() => fix([2])} />}>{ind.engine.includes('beta') ? 'Beta engines' : 'Archetypes under review'} can’t back a valuation. Pick a certified engine or another archetype.</Banner></div>}
    </>
  )
}


function StreamList({ c, ind, update, sub, footer, tabs }: Pick<Ctx, 'c' | 'ind' | 'update'> & { sub: (i: Ind) => [string, boolean]; footer?: ReactNode; tabs?: boolean }) {
  const done = c.inds.filter(i => sub(i)[1]).length
  // Horizontal tab strip across the top of the section
  if (tabs) return (
    <div className="flex items-end gap-3 border-b border-border bg-background/60 px-3 pt-2">
      <ul role="tablist" aria-label="Revenue streams" className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {c.inds.map((i, k) => {
          const on = i.id === ind.id
          const [label, ok] = sub(i)
          return (
            <li key={i.id} className="shrink-0">
              <button type="button" role="tab" aria-selected={on} onClick={() => update({ active: i.id })} title={label}
                className={cx('flex items-center gap-2 rounded-t-md border border-b-2 px-3.5 py-2.5 text-left transition-colors', on ? 'border-border border-b-brand bg-surface text-text' : 'border-transparent text-text-2 hover:bg-surface/70 hover:text-text')}>
                <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold', ok ? 'bg-ok text-white' : on ? 'bg-brand text-white' : 'border border-border-strong text-text-2')}>{ok ? <Check size={11} strokeWidth={3} /> : k + 1}</span>
                <span className="whitespace-nowrap text-[13px] font-semibold">{i.name || `Stream ${k + 1}`}</span>
                <span className={cx('whitespace-nowrap text-[11px]', on ? 'text-brand' : 'text-text-3')}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex shrink-0 items-center gap-3 pb-2">
        <span className="font-mono text-[11px] text-text-3">{done}/{c.inds.length}</span>
        {footer}
      </div>
    </div>
  )
  return (
    <div className="border-b border-border bg-background/60 @3xl:border-b-0 @3xl:border-r">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Revenue streams</p>
        <span className="font-mono text-[11px] text-text-3">{done}/{c.inds.length}</span>
      </div>
      <ul role="tablist" aria-label="Revenue streams" aria-orientation="vertical" className="space-y-1 px-2 pb-2">
        {c.inds.map((i, k) => {
          const on = i.id === ind.id
          const [label, ok] = sub(i)
          return (
            <li key={i.id}>
              <button type="button" role="tab" aria-selected={on} onClick={() => update({ active: i.id })}
                className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors', on ? 'bg-surface shadow-sm ring-1 ring-brand' : 'hover:bg-surface')}>
                <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold', ok ? 'bg-ok text-white' : on ? 'bg-brand text-white' : 'border border-border-strong text-text-2')}>{ok ? <Check size={12} strokeWidth={3} /> : k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{i.name || `Stream ${k + 1}`}</span>
                  <span className={cx('block truncate text-[11px]', ok ? 'text-brand' : 'text-text-3')}>{label}</span>
                </span>
                {on && <ChevronRight size={16} className="shrink-0 text-brand" />}
              </button>
            </li>
          )
        })}
      </ul>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </div>
  )
}

function getBridgeReason(label: string, from: string, to: string) {
  const r: Record<string, string> = {
    'Aggregate Churn>Cohort KM': 'requires initial-stock imputation',
    'Forward DoT>Cohort KM': 'requires initial-stock imputation and fitting a survival surface to stated durations',
    'Cohort KM>Aggregate Churn': 'requires collapsing the survival surface into one monthly rate, losing start-cohort detail',
    'Forward DoT>Aggregate Churn': 'requires deriving an implied monthly discontinuation rate from stated durations',
    'Cohort KM>Forward DoT': 'requires converting survival curves into explicit durations of therapy per cohort',
    'Aggregate Churn>Forward DoT': 'requires converting the churn rate into explicit durations of therapy per cohort',
    'Independent>Named Feeders': 'requires naming the upstream brand and realized share feeding each line',
    'Independent>Progression-Derived': 'requires restating later-line history as upstream drop-offs',
    'Named Feeders>Progression-Derived': 'requires replacing named feeder shares with drop-off-derived eligibility',
    'Progression-Derived>Named Feeders': 'requires specifying a feeder brand and share where eligibility was derived',
    'Named Feeders>Independent': 'requires re-sizing each line from epi, dropping feeder links',
    'Progression-Derived>Independent': 'requires re-sizing each line from epi, dropping upstream links',
  }
  if (label === 'Actuals regime') {
    if (to === 'Claims-level actuals') return 'requires re-mapping the actuals boundary to patient-level claims and re-running calibration'
    if (to === 'Pre-launch (no actuals)') return 'removes the actuals boundary, so calibration falls back to analog assumptions'
    return 'requires aggregating claims history up to the reported-sales boundary'
  }
  return r[`${from}>${to}`] ?? `changes the ${label.toLowerCase()} and requires a bridge to restate history under the new specification`
}

function StageModes({ c, ind, update, updInd, go, notify }: Ctx) {
  const [seen, setSeen] = useState<Set<string>>(() => new Set([ind.id]))
  const [bridge, setBridge] = useState<Record<string, { label: string; from: string; to: string }>>(() => {
    const initB: Record<string, { label: string; from: string; to: string }> = {}
    if (ind.arch === 'D-03' && ind.modes.persist === 'Cohort KM') {
      initB[`${ind.id}:persist`] = { label: 'Persistence specification', from: 'Aggregate Churn', to: 'Cohort KM' }
    }
    return initB
  })
  useEffect(() => { setSeen(x => x.has(ind.id) ? x : new Set(x).add(ind.id)) }, [ind.id])
  const [touched, setTouched] = useState(false)
  const arch = ind.arch
  const modes = arch ? { ...Object.fromEntries(modesFor(arch).map(x => [x.id, modeDefault(arch, x)])), ...ind.modes } : {}
  const groups = arch ? modesFor(arch).filter(m => !m.showIf || m.showIf(modes)) : []
  const reqN = groups.filter(m => !m.optional).length
  const set = (m: Pick<ModeDef, 'id' | 'label'>, v: string) => {
    if (modes[m.id] === v) return
    const currentVal = modes[m.id]
    updInd(ind.id, { modes: { ...ind.modes, [m.id]: v } })
    const k = `${ind.id}:${m.id}`
    setBridge(b => {
      const prevOrig = b[k]?.from ?? currentVal
      const n = { ...b }
      if (prevOrig === v) {
        delete n[k]
      } else {
        n[k] = { label: m.label, from: prevOrig, to: v }
      }
      return n
    })
  }
  const sameArch = c.inds.filter(i => i.id !== ind.id && i.arch === arch)
  const copyAll = () => { sameArch.forEach(i => updInd(i.id, { modes: { ...ind.modes } })); notify({ tone: 'ok', text: `Modes copied to ${sameArch.length} ${archName(arch)} stream${sameArch.length > 1 ? 's' : ''}.` }) }
  const bridgesOf = (id: string) => Object.entries(bridge).filter(([k]) => k.startsWith(`${id}:`)).map(([, v]) => v)
  const bridgeFor = (mid: string) => bridge[`${ind.id}:${mid}`]
  const pending = bridgesOf(ind.id).length

  const BridgeNote = ({ id }: { id: string }) => {
    const b = bridgeFor(id)
    if (!b) return null
    return (
      <div role="status" className="mt-2.5 flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft/50 px-3 py-2.5 text-[13px]">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
        <p className="min-w-0 flex-1"><b>Bridge required:</b> Switching from {b.from} to {b.to} {getBridgeReason(b.label, b.from, b.to)} — flagged for review.</p>
        <button type="button" onClick={() => set({ id, label: b.label }, b.from)} className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-brand hover:underline"><RotateCcw size={12} />Undo</button>
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <StreamList c={c} ind={ind} update={update} tabs
        sub={i => {
          if (!i.arch) return ['No archetype yet', false]
          const n = bridgesOf(i.id).length
          return [n ? `${n} to sign off` : seen.has(i.id) ? 'Reviewed' : 'Defaults', seen.has(i.id)]
        }}
        footer={c.inds.length > 1 && (
          <Btn size="sm" variant="secondary" icon={<Copy size={14} />} disabled={!arch || !sameArch.length} onClick={copyAll}
            title={arch && sameArch.length ? `Copies these modes to ${sameArch.length} other stream${sameArch.length > 1 ? 's' : ''} on ${archName(arch)}.` : 'Modes only copy between streams on the same engine.'}>Apply to all</Btn>
        )} />

      <div className="@container min-w-0 p-5">
        {!arch ? (
          <EmptyState icon={<Layers size={18} />} title={`No archetype for ${ind.name || 'this stream'}`} action={<Btn size="sm" onClick={() => go(2)}>Choose an archetype</Btn>}>Modes are specific to the engine, so pick one first.</EmptyState>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold tracking-tight">{ind.name || 'Stream'}</h3>
                <p className="text-sm text-text-2">{archName(arch)} · {groups.length} modes valid for this archetype</p>
              </div>
              <span className="text-xs text-text-3">{reqN} required · {groups.length - reqN} optional{pending ? ` · ${pending} bridge${pending > 1 ? 's' : ''} to review` : ''}</span>
            </div>
            
            <div className="divide-y divide-border">
              {groups.map(m => {
                return (
                  <div key={m.id} role="group" aria-label={m.label} className="grid min-w-0 gap-x-8 gap-y-2 py-4 first:pt-0 last:pb-0 @xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)] @xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text">{m.label}</span>
                        {m.optional ? <Badge>Optional</Badge> : <Badge tone="brand">Required</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-text-2">{m.help}</p>
                    </div>
                    <div className="min-w-0">
                    <select className={cx(inputCls(m.id === 'time' && modes.time === 'Custom' && !!customTimeErr(modes) && touched), 'w-full')} value={modes[m.id]} onChange={e => set(m, e.target.value)} aria-label={m.label}>
                      {m.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {m.id === 'time' && modes.time === 'Custom' && (() => {
                      const err = customTimeErr(modes)
                      return (
                        <div className="mt-3 rounded-md border border-border bg-background/60 p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Repeat every" required error={touched && err.startsWith('Enter') ? err : undefined}>
                              <input type="number" min={1} step={1} className={inputCls(touched && err.startsWith('Enter'))} value={modes.time_n ?? ''} onBlur={() => setTouched(true)} onChange={e => updInd(ind.id, { modes: { ...ind.modes, time_n: e.target.value } })} />
                            </Field>
                            <Field label="Unit">
                              <select className={inputCls()} value={modes.time_unit ?? 'months'} onChange={e => updInd(ind.id, { modes: { ...ind.modes, time_unit: e.target.value } })}>
                                {['weeks', 'months', 'years'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </Field>
                            <Field label="From year (optional)">
                              <input type="number" className={inputCls()} placeholder="2026" value={modes.time_from ?? ''} onChange={e => updInd(ind.id, { modes: { ...ind.modes, time_from: e.target.value } })} />
                            </Field>
                            <Field label="To year (optional)" error={touched && err.startsWith('End') ? err : undefined}>
                              <input type="number" className={inputCls(touched && err.startsWith('End'))} placeholder="2035" value={modes.time_to ?? ''} onBlur={() => setTouched(true)} onChange={e => updInd(ind.id, { modes: { ...ind.modes, time_to: e.target.value } })} />
                            </Field>
                          </div>
                          <p className="mt-2 text-[11px] text-text-3">Open question: custom granularity, date range, or both. Fields shown cover both until confirmed.</p>
                        </div>
                      )
                    })()}
                    </div>
                    <div className="@xl:col-span-2"><BridgeNote id={m.id} /></div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 rounded-md border border-border bg-background/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Selected configuration</p>
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                {groups.map(m => <div key={m.id} className="flex gap-1.5"><dt className="text-text-3">{m.label}</dt><dd className="font-semibold">{modes[m.id] === 'Custom' && m.id === 'time' ? `Every ${modes.time_n || '?'} ${modes.time_unit ?? 'months'}${modes.time_from || modes.time_to ? ` · ${modes.time_from || '…'}–${modes.time_to || '…'}` : ''}` : modes[m.id] || '—'}</dd></div>)}
              </dl>
            </div>
            <p className="mt-4 text-xs text-text-3">Mode list and labels follow the taxonomy working draft. Selections are kept when you move between steps.</p>
          </div>
        )}
      </div>
    </section>
  )
}


const needArch = (go: (n: number) => void, name: string) => (
  <EmptyState icon={<Layers size={18} />} title={`No archetype for ${name || 'this indication'}`} action={<Btn size="sm" onClick={() => go(2)}>Choose an archetype</Btn>}>Buckets, modules and assumptions all come from the archetype.</EmptyState>
)

/* ───────────────────────── Step 4 · Module Map ───────────────────────── */

const attachedIds = (ind: Ind) => [...ind.modules, ...requiredFor(ind.arch).filter(id => !ind.modules.includes(id))]
/** Calculation order: lanes follow the taxonomy order; inside a lane, the order the CoE arranged. */
const orderedModules = (ind: Ind): Mod[] => {
  const mods = attachedIds(ind).map(id => MODULES.find(m => m.id === id)).filter((m): m is Mod => !!m)
  return BUCKETS.flatMap(b => mods.filter(m => m.cat === b))
}


/* ───────────────────────── Module map (lanes) ───────────────────────── */

type ModState = 'ok' | 'missing' | 'conflict' | 'order'
/** Validation states only where a rule exists in the taxonomy metadata: archetype compatibility and declared predecessors. */
function modState(m: Mod, ind: Ind, seq: string[]): ModState {
  if (!ind.arch || !validFor(m, ind.arch)) return 'conflict'
  if (m.needs) {
    const dep = byName(m.needs).id
    if (!seq.includes(dep)) return 'missing'
    if (seq.indexOf(dep) > seq.indexOf(m.id)) return 'order'
  }
  return 'ok'
}
const STATE_UI: Record<ModState, { label: string; tone: 'ok' | 'warn' | 'err'; dot: string }> = {
  ok: { label: 'Compatible', tone: 'ok', dot: 'bg-ok' },
  missing: { label: 'Missing predecessor', tone: 'err', dot: 'bg-err' },
  order: { label: 'Runs before its input', tone: 'warn', dot: 'bg-warn' },
  conflict: { label: 'Not compatible', tone: 'err', dot: 'bg-err' },
}
/** Lane order = calculation order. The archetype engine sits between structure and adjustments. */
const LANE_ORDER = ['Population & top-of-funnel', 'Segmentation & structure', 'Lines of therapy & disease states', '__engine', 'Share machinery', 'Persistence, dosing & regimen', 'Cross-product & franchise', 'Events, LOE & scenarios', 'Actuals, calibration & reconciliation', 'Conversion, financial & integration']

const LINE = 'bg-border-strong'
const VLine = () => <span aria-hidden className={cx('block h-5 w-px shrink-0', LINE)} />
type NodeTone = 'trunk' | 'seg' | 'leaf'
const NODE_CLS: Record<NodeTone, string> = {
  trunk: 'border-border bg-surface',
  seg: 'border-brand/40 bg-brand-soft',
  leaf: 'border-[#9fd3d3] bg-[#eef8f8]',
}
function FlowNode({ title, sub, tone, m, st, on, onPick, wide, drag }: { title: string; sub?: string; tone: NodeTone; m?: Mod; st?: ModState; on?: boolean; onPick?: () => void; wide?: boolean; drag?: boolean }) {
  const body = <>
    <span className="flex items-center justify-center gap-1.5 text-[13px] font-semibold leading-tight text-text">{st && st !== 'ok' && <i className={cx('h-1.5 w-1.5 shrink-0 rounded-full', STATE_UI[st].dot)} />}<span className="truncate">{title}</span></span>
    {sub && <span className="mt-0.5 block truncate text-[11px] leading-snug text-text-2">{sub}</span>}
  </>
  const cls = cx('block w-full rounded-md border px-3 py-2 text-center transition-colors', NODE_CLS[tone], wide ? 'max-w-md' : '', on && 'ring-2 ring-brand', st === 'missing' || st === 'conflict' ? 'border-err/60' : st === 'order' ? 'border-warn/60' : '')
  return m && onPick ? <button type="button" onClick={onPick} title={m.desc} draggable={drag} onDragStart={drag ? e => { e.dataTransfer.setData(DRAG_ON, m.id); e.dataTransfer.effectAllowed = 'move' } : undefined} className={cx(cls, 'hover:border-brand', drag && 'cursor-grab active:cursor-grabbing')}>{body}</button> : <div className={cls}>{body}</div>
}
/** Children hang off a horizontal rail; `up` draws the rail above (split), `down` below (merge). */
function Rail({ items, up, down }: { items: ReactNode[]; up?: boolean; down?: boolean }) {
  const n = items.length
  return (
    <div className="flex w-full gap-3">
      {items.map((it, i) => (
        <div key={i} className={cx('relative flex min-w-0 flex-1 flex-col items-center', up && 'pt-5', down && 'pb-5')}>
          {up && <><span aria-hidden className={cx('absolute left-1/2 top-0 h-5 w-px', LINE)} />{i > 0 && <span aria-hidden className={cx('absolute -left-1.5 right-1/2 top-0 h-px', LINE)} />}{i < n - 1 && <span aria-hidden className={cx('absolute -right-1.5 left-1/2 top-0 h-px', LINE)} />}</>}
          {it}
          {down && <><span aria-hidden className={cx('absolute bottom-0 left-1/2 h-5 w-px', LINE)} />{i > 0 && <span aria-hidden className={cx('absolute -left-1.5 right-1/2 bottom-0 h-px', LINE)} />}{i < n - 1 && <span aria-hidden className={cx('absolute -right-1.5 left-1/2 bottom-0 h-px', LINE)} />}</>}
        </div>
      ))}
    </div>
  )
}
const DRAG_NEW = 'application/x-module-new'
const DRAG_ON = 'application/x-module-on'
const TRUNK_LANES = ['Population & top-of-funnel', 'Segmentation & structure']
const LOT_LANE = 'Lines of therapy & disease states'
const LEAF_LANES = ['Share machinery', 'Persistence, dosing & regimen', 'Cross-product & franchise', 'Events, LOE & scenarios']
const MERGE_LANE = 'Conversion, financial & integration'
const TAIL_LANE = 'Actuals, calibration & reconciliation'

function ModuleLanes({ c, ind, updInd, readOnly, go, dragging, inspect: inspectProp, onInspect }: { c: Config; ind: Ind; updInd?: (id: string, p: Partial<Ind>) => void; readOnly?: boolean; go?: (n: number) => void; dragging?: Mod | null; inspect?: string | null; onInspect?: (id: string | null) => void }) {
  const [own, setOwn] = useState<string | null>(null)
  const inspect = onInspect ? inspectProp ?? null : own
  const setInspect = onInspect ?? setOwn
  const [over, setOver] = useState(false)
  const arch = ind.arch
  if (!arch) return null
  const req = requiredFor(arch)
  const seq = Array.from(new Set([...ind.modules, ...req]))
  const insp = MODULES.find(m => m.id === inspect)
  const set = (modules: string[]) => updInd?.(ind.id, { modules })
  const moveIn = (cat: string, id: string, d: number) => {
    const inLane = seq.filter(x => MODULES.find(m => m.id === x)?.cat === cat)
    const k = inLane.indexOf(id), j = k + d
    if (j < 0 || j >= inLane.length) return
    const a = [...seq], ia = a.indexOf(inLane[k]!), ib = a.indexOf(inLane[j]!)
    ;[a[ia], a[ib]] = [a[ib]!, a[ia]!]
    set(a)
  }
  const counts = seq.reduce((n, id) => { const st = modState(MODULES.find(m => m.id === id)!, ind, seq); n[st]++; return n }, { ok: 0, missing: 0, order: 0, conflict: 0 } as Record<ModState, number>)
  const lane = (cat: string) => seq.map(id => MODULES.find(m => m.id === id)!).filter(m => m.cat === cat)
  const node = (m: Mod, tone: NodeTone, sub?: string, wide?: boolean) => <FlowNode key={m.id + (sub ?? '')} title={m.name} sub={sub ?? m.desc} tone={tone} m={m} st={modState(m, ind, seq)} on={inspect === m.id} onPick={() => setInspect(inspect === m.id ? null : m.id)} wide={wide} drag={!readOnly && !req.includes(m.id)} />
  const stack = (nodes: ReactNode[]) => nodes.flatMap((n, k) => k ? [<VLine key={`l${k}`} />, n] : [n])

  // Branching comes from the model setup: first slice = segment split; LoT split only when LoT modules are attached.
  const segSlice = c.slices.find(x => x.values.length > 1 && !/line of therapy/i.test(x.name))
  const segs = segSlice ? segSlice.values.slice(0, 3) : []
  const lotMods = lane(LOT_LANE)
  const lotSlice = c.slices.find(x => /line of therapy/i.test(x.name))
  const lots = lotMods.length ? (lotSlice?.values.slice(0, 3) ?? ['1L', '2L+']) : []
  const leafChain = (label: string) => stack([
    <FlowNode key="eng" title={archName(arch)} sub={`${ind.engine} · ${label}`} tone="leaf" />,
    ...LEAF_LANES.flatMap(l => lane(l)).map(m => node(m, 'leaf', label)),
  ])
  const branch = (seg: string | null) => {
    const pre = seg ?? ''
    const body = lots.length
      ? <Rail up down={!!lane(MERGE_LANE).length || !!seg} items={lots.map(l => <div key={l} className="flex w-full flex-col items-center">{stack([<FlowNode key="lot" title={`${pre ? pre + ' · ' : ''}${l}`} sub={lotMods.map(m => m.name).join(' · ')} tone="leaf" m={lotMods[0]} on={inspect === lotMods[0]!.id} onPick={() => setInspect(lotMods[0]!.id)} />, ...leafChain(l).map((n, k) => <Fragment key={`c${k}`}>{k === 0 && <VLine />}{n}</Fragment>)])}</div>)} />
      : <div className="flex w-full flex-col items-center">{leafChain(seg ?? 'all patients')}</div>
    const merge = lane(MERGE_LANE)
    return (
      <div className="flex w-full flex-col items-center">
        {seg && <><FlowNode title={seg} sub={segSlice!.name} tone="seg" />{lots.length ? null : <VLine />}</>}
        {body}
        {!lots.length && (merge.length || seg) ? <VLine /> : null}
        {seg
          ? <FlowNode title={`Net sales · ${seg}`} sub={merge.map(m => m.name).join(' · ') || 'Segment total'} tone="seg" m={merge[0]} on={!!merge[0] && inspect === merge[0].id} onPick={merge[0] ? () => setInspect(merge[0]!.id) : undefined} />
          : merge.length ? stack(merge.map(m => node(m, 'trunk', undefined, true))) : null}
      </div>
    )
  }
  const trunk = TRUNK_LANES.flatMap(l => lane(l))
  const tail = lane(TAIL_LANE)
  const ok = dragging ? validFor(dragging, arch) && !seq.includes(dragging.id) : false
  const drop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false)
    const id = e.dataTransfer.getData(DRAG_NEW), m = MODULES.find(x => x.id === id)
    if (m && validFor(m, arch) && !seq.includes(id)) { set([...seq, id]); setInspect(id) }
  }

  return (
    <div className={cx('grid gap-4', readOnly && '@3xl:grid-cols-[minmax(0,1fr)_280px]')}>
      <div className="relative min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-text-2">
          {(Object.keys(STATE_UI) as ModState[]).map(k => <span key={k} className="flex items-center gap-1.5"><i className={cx('h-2 w-2 rounded-full', STATE_UI[k].dot)} />{STATE_UI[k].label} <b className="font-mono">{counts[k]}</b></span>)}
        </div>
        <div onDragOver={readOnly ? undefined : e => { if (e.dataTransfer.types.includes(DRAG_NEW)) { e.preventDefault(); setOver(true) } }} onDragLeave={() => setOver(false)} onDrop={readOnly ? undefined : drop}
          className={cx('relative overflow-x-auto rounded-lg border p-5 transition-colors', readOnly ? 'border-border bg-background/60' : 'min-h-[420px] border-border bg-[radial-gradient(circle,var(--color-border-strong)_1px,transparent_1px)] bg-[length:18px_18px]', dragging && (ok ? 'border-2 border-dashed border-brand' : 'border-2 border-dashed border-err/60'), over && ok && 'bg-brand-soft/40')}>
          {dragging && <div className="pointer-events-none sticky left-0 top-0 z-10 mb-3 flex justify-center"><span className={cx('rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm', ok ? 'bg-brand text-white' : 'bg-err text-white')}>{ok ? `Drop to add ${dragging.name} · lands in ${dragging.cat}` : seq.includes(dragging.id) ? 'Already on the canvas' : `Not compatible with ${archName(arch)}`}</span></div>}
          <div className="mx-auto flex flex-col items-center" style={{ minWidth: Math.max(1, segs.length || 1) * Math.max(1, lots.length || 1) * 150 }}>
            {stack(trunk.map(m => node(m, 'trunk', undefined, true)))}
            {trunk.length > 0 && <VLine />}
            {segs.length
              ? <><Rail up down items={segs.map(sg => branch(sg))} /><FlowNode title="Total net sales" sub={`Sum of ${segSlice!.name.toLowerCase()} segments`} tone="trunk" wide /></>
              : branch(null)}
            {tail.length > 0 && <><VLine />{stack(tail.map(m => node(m, 'trunk', undefined, true)))}</>}
            <VLine />
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-dark text-white" title="Handed to the Forecaster after finalisation"><ArrowDown size={14} /></span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-3">{readOnly ? 'Branches follow the segments and lines of therapy set up for this model.' : 'Drag cards from the library onto the canvas — each module snaps into its stage. Drag a card back to the library to remove it.'}</p>
      </div>
      <aside className={readOnly ? 'min-w-0 @3xl:sticky @3xl:top-4 @3xl:self-start' : cx('absolute right-3 top-10 z-20 w-72 shadow-xl', !insp && 'hidden')}>
        {insp ? (() => {
          const st = modState(insp, ind, seq), isReq = req.includes(insp.id)
          const usedBy = MODULES.filter(m => m.needs === insp.name && seq.includes(m.id))
          return (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="text-[11px] text-text-3">{insp.cat}</p><p className="font-semibold">{insp.name}</p></div><button type="button" onClick={() => setInspect(null)} aria-label="Close details" className="text-text-3 hover:text-text"><X size={15} /></button></div>
              <div className="mt-2 flex flex-wrap gap-1"><Badge tone={STATE_UI[st].tone}>{STATE_UI[st].label}</Badge>{isReq ? <Badge>Core · required</Badge> : <Badge>Optional</Badge>}</div>
              <p className="mt-3 text-[12.5px] text-text-2">{insp.desc}</p>
              <dl className="mt-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between gap-2"><dt className="text-text-3">Runs at position</dt><dd className="font-mono">{seq.indexOf(insp.id) + 1} of {seq.length}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-text-3">Depends on</dt><dd className="text-right">{insp.needs ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-text-3">Feeds</dt><dd className="text-right">{usedBy.map(m => m.name).join(', ') || 'Next stage'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-text-3">Data input</dt><dd className="text-right">{insp.data ? MODULE_INPUTS[insp.data]?.name : 'None'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-text-3">Taxonomy evidence</dt><dd className="font-mono">{insp.ev.join(', ')}</dd></div>
              </dl>
              {st === 'missing' && insp.needs && !readOnly && <Btn size="sm" className="mt-3 w-full" icon={<Plus size={13} />} onClick={() => { const d = byName(insp.needs!).id; const a = seq.filter(x => x !== d); a.splice(a.indexOf(insp.id), 0, d); set(a) }}>Attach {insp.needs} before it</Btn>}
              {st === 'order' && !readOnly && <Btn size="sm" className="mt-3 w-full" variant="secondary" onClick={() => { const d = byName(insp.needs!).id; const a = seq.filter(x => x !== d); a.splice(a.indexOf(insp.id), 0, d); set(a) }}>Run {insp.needs} first</Btn>}
              {!readOnly && !isReq && <Btn size="sm" variant="ghost" className="mt-2 w-full" icon={<X size={13} />} onClick={() => { set(seq.filter(x => x !== insp.id)); setInspect(null) }}>Remove from map</Btn>}
              {!readOnly && (() => { const inLane = seq.filter(x => MODULES.find(m => m.id === x)?.cat === insp.cat); const k = inLane.indexOf(insp.id); return inLane.length > 1 && <div className="mt-2 flex gap-2"><Btn size="sm" variant="secondary" className="flex-1" disabled={k === 0} icon={<ChevronUp size={13} />} onClick={() => moveIn(insp.cat, insp.id, -1)}>Earlier</Btn><Btn size="sm" variant="secondary" className="flex-1" disabled={k === inLane.length - 1} icon={<ChevronDown size={13} />} onClick={() => moveIn(insp.cat, insp.id, 1)}>Later</Btn></div> })()}
              {readOnly && go && <Btn size="sm" variant="secondary" className="mt-3 w-full" onClick={() => go(4)}>Edit in Module map</Btn>}
            </div>
          )
        })() : (
          <div className="rounded-lg border border-dashed border-border-strong p-4 text-[12.5px] text-text-2">
            <p className="font-semibold text-text">Select a module to inspect it</p>
            <p className="mt-1">See its dependencies, what it feeds, the data it needs and its run position — without leaving the map.</p>
            <p className="mt-3 text-[11px] text-text-3">Compatibility uses the archetype rules and declared predecessors in the taxonomy. “Configuration incomplete” will appear once module-level rules are available.</p>
          </div>
        )}
      </aside>
    </div>
  )
}

type ModFilter = 'All' | 'Available' | 'On canvas'

function LibraryCard({ m, on, core, govd, shared, missing, onAdd, onDrag, onLock, onPick }: { m: Mod; on: boolean; core: boolean; govd: boolean; shared: boolean; missing: boolean; onAdd: () => void; onDrag: (m: Mod | null) => void; onLock: () => void; onPick: () => void }) {
  return (
    <li draggable={!on} onDragStart={e => { e.dataTransfer.setData(DRAG_NEW, m.id); e.dataTransfer.effectAllowed = 'copy'; onDrag(m) }} onDragEnd={() => onDrag(null)}
      className={cx('group flex items-start gap-2 rounded-md border bg-surface p-2.5 transition-all', on ? 'border-brand/40 bg-brand-soft/30' : 'cursor-grab border-border shadow-sm hover:-translate-y-px hover:border-brand hover:shadow active:cursor-grabbing')}>
      <GripVertical size={14} className={cx('mt-0.5 shrink-0', on ? 'text-transparent' : 'text-text-3 group-hover:text-brand')} aria-hidden />
      <button type="button" onClick={onPick} className="min-w-0 flex-1 text-left" disabled={!on}>
        <span className="block text-[13px] font-semibold leading-tight text-text">{m.name}</span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-text-2">{m.desc}</span>
        {(core || govd || shared || m.needs) && <span className="mt-1.5 flex flex-wrap gap-1">
          {core && <Badge>Core</Badge>}
          {govd && <Badge tone="warn"><ShieldAlert size={10} />Governed</Badge>}
          {shared && <Badge tone="neutral">Brand-level</Badge>}
          {m.needs && <Badge tone={missing ? 'err' : 'neutral'}>Needs {m.needs}</Badge>}
        </span>}
      </button>
      {core
        ? <button type="button" onClick={onLock} aria-label={`Why is ${m.name} required?`} className="grid h-7 w-7 shrink-0 place-items-center rounded text-text-3 hover:bg-surface-2 hover:text-brand"><Lock size={13} /></button>
        : on
        ? <span className="grid h-7 w-7 shrink-0 place-items-center text-brand" title="On the canvas"><Check size={15} /></span>
        : <button type="button" onClick={onAdd} aria-label={`Add ${m.name} to the canvas`} className="grid h-7 w-7 shrink-0 place-items-center rounded border border-border text-text-2 hover:border-brand hover:bg-brand hover:text-white"><Plus size={14} /></button>}
    </li>
  )
}

/** Streams and their archetypes at a glance before building the module map. Selecting an archetype jumps back to Step 2 to change it. */
function StreamArchSummary({ c, ind, update, go }: Pick<Ctx, 'c' | 'ind' | 'update' | 'go'>) {
  const roots = c.inds.filter(i => !i.parent || !c.inds.some(x => x.id === i.parent))
  const row = (i: Ind, part: boolean) => {
    const modes = i.arch ? modesFor(i.arch).map(m => i.modes[m.id]).filter(Boolean) : []
    return (
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={() => update({ active: i.id })} aria-pressed={i.id === ind.id} title="Show this stream on the canvas"
          className={cx('shrink-0 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors', part && 'border-dashed', i.id === ind.id ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-text hover:border-border-strong')}>{i.name || 'Untitled stream'}</button>
        <span aria-hidden className="h-px w-3 shrink-0 bg-border-strong" />
        <button type="button" onClick={() => { update({ active: i.id }); go(2) }} title={`Change the archetype for ${i.name || 'this stream'}`}
          className={cx('group inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold transition-colors', i.arch ? 'bg-brand-dark text-white hover:bg-brand' : 'border border-dashed border-warn text-warn hover:bg-warn-soft')}>
          <Layers size={12} />{i.arch ? archName(i.arch) : 'Choose an archetype'}<Pencil size={11} className="opacity-60 group-hover:opacity-100" />
        </button>
        {modes.length > 0 && <span className="hidden min-w-0 truncate text-[11.5px] text-text-3 @2xl:inline" title={modes.join(' · ')}>{modes.join(' · ')}</span>}
      </div>
    )
  }
  return (
    <section aria-label="Streams and archetypes" className="@container rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Streams and archetypes</h3>
        <span className="text-[11.5px] text-text-3">Select a stream to map it, or an archetype to change it.</span>
      </div>
      <div className="flex items-start gap-3 overflow-x-auto">
        <span className="shrink-0 rounded-md bg-brand-dark px-3 py-1.5 text-[12px] font-semibold text-white">{c.brand || 'Model'} total</span>
        <span aria-hidden className="mt-3.5 h-px w-3 shrink-0 bg-border-strong" />
        <ul className="min-w-0 space-y-2 border-l border-border-strong pl-3">
          {roots.map(r => (
            <li key={r.id}>
              {row(r, false)}
              {c.inds.some(x => x.parent === r.id) && <ul className="ml-4 mt-2 space-y-2 border-l border-dashed border-border-strong pl-3">{c.inds.filter(x => x.parent === r.id).map(x => <li key={x.id}>{row(x, true)}</li>)}</ul>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function StageModules({ c, ind, update, updInd, go, errs, fix }: Ctx & { errs?: Issue[] }) {
  const [openB, setOpenB] = useState<Set<string>>(() => new Set(BUCKETS))
  const [lockInfo, setLockInfo] = useState<Mod | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<ModFilter>('All')
  const [dragging, setDragging] = useState<Mod | null>(null)
  const [binOver, setBinOver] = useState(false)
  const [inspect, setInspect] = useState<string | null>(null)
  useEffect(() => { setInspect(null) }, [ind.id])
  const arch = ind.arch
  const conflicts = (errs || []).filter(e => e.ind === ind.id && e.field === 'needs')
  const req = requiredFor(arch)
  const valid = arch ? MODULES.filter(m => validFor(m, arch)) : []
  const hidden = MODULES.length - valid.length
  const term = q.trim().toLowerCase()
  const isOn = (m: Mod) => ind.modules.includes(m.id) || req.includes(m.id)
  const shown = (m: Mod) => (!term || `${m.name} ${m.desc} ${m.cat}`.toLowerCase().includes(term)) && (filter === 'All' || (filter === 'On canvas') === isOn(m))
  const add = (m: Mod) => { if (!isOn(m)) { updInd(ind.id, { modules: [...ind.modules, m.id] }); setInspect(m.id) } }
  const remove = (id: string) => { if (!req.includes(id)) { updInd(ind.id, { modules: ind.modules.filter(x => x !== id) }); if (inspect === id) setInspect(null) } }
  const shared = (m: Mod) => !!((m.data === 'price' && c.shared.price) || (m.data === 'g2n' && c.shared.g2n))
  const invalidOn = arch ? ind.modules.map(id => MODULES.find(m => m.id === id)!).filter(m => m && !validFor(m, arch)) : []
  const onCount = valid.filter(isOn).length

  if (!arch) return <div className="space-y-4"><StreamArchSummary c={c} ind={ind} update={update} go={go} /><EmptyState icon={<Layers size={18} />} title={`No archetype for ${ind.name || 'this stream'}`} action={<Btn size="sm" onClick={() => go(2)}>Choose an archetype</Btn>}>Stages and modules come from the archetype.</EmptyState></div>
  return (
    <div className="@container space-y-4">
      <StreamArchSummary c={c} ind={ind} update={update} go={go} />
      {conflicts.map(e => <Banner key={e.msg} tone="err" title="Module conflict" action={<FixForMe onClick={() => fix([4])} />}>{e.msg}</Banner>)}
      {invalidOn.length > 0 && (
        <Banner tone="err" title={`${invalidOn.length} module${invalidOn.length > 1 ? 's aren’t' : ' isn’t'} compatible with ${archName(arch)}`}
          action={<div className="flex shrink-0 gap-2"><FixForMe onClick={() => fix([4])} /><Btn size="sm" variant="secondary" onClick={() => updInd(ind.id, { modules: ind.modules.filter(id => !invalidOn.some(m => m.id === id)) })}>Remove</Btn></div>}>
          {invalidOn.map(m => m.name).join(', ')}
        </Banner>
      )}

      <div className="grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 rounded-lg border border-border bg-surface p-4" aria-label="Model canvas">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Workflow size={15} className="text-brand" />Canvas · {ind.name || 'Stream'}</h3><p className="text-xs text-text-2">{archName(arch)} <span className="text-text-3">({ind.engine})</span> · {onCount} modules</p></div>
            <span className="text-[11px] text-text-3">Click a card to inspect · drag to the library to remove</span>
          </div>
          <ModuleLanes c={c} ind={ind} updInd={updInd} dragging={dragging} inspect={inspect} onInspect={setInspect} />
        </section>

        <aside aria-label="Module library"
          onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_ON)) { e.preventDefault(); setBinOver(true) } }} onDragLeave={() => setBinOver(false)}
          onDrop={e => { e.preventDefault(); setBinOver(false); const id = e.dataTransfer.getData(DRAG_ON); if (id) remove(id) }}
          className={cx('relative flex max-h-[calc(100dvh-140px)] min-w-0 flex-col overflow-hidden rounded-lg border bg-surface @3xl:sticky @3xl:top-4', binOver ? 'border-2 border-dashed border-err' : 'border-border')}>
          {binOver && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-err-soft/85 text-sm font-semibold text-err"><span className="flex items-center gap-2"><X size={16} />Drop to remove from canvas</span></div>}
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Module library</h3><span className="font-mono text-[11px] text-text-3">{valid.length} compatible</span></div>
            <div className="relative mt-2">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search modules" aria-label="Search modules" className={cx(inputCls(), 'h-8! pl-8 text-[13px]')} />
            </div>
            <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Show">
              {(['All', 'Available', 'On canvas'] as ModFilter[]).map(f => <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={cx('flex-1 rounded px-2 py-1 text-[12px] font-medium', filter === f ? 'bg-text text-white' : 'bg-surface-2 text-text-2 hover:text-text')}>{f}</button>)}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {LANE_ORDER.filter(l => l !== '__engine').map(fam => {
              const list = valid.filter(m => m.cat === fam && shown(m))
              if (!list.length) return null
              const open = !!term || openB.has(fam)
              return (
                <section key={fam}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenB(p => { const n = new Set(p); n.has(fam) ? n.delete(fam) : n.add(fam); return n })}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-text-2 hover:bg-surface-2">
                    <ChevronDown size={13} className={cx('shrink-0 transition-transform', !open && '-rotate-90')} /><span className="min-w-0 flex-1 truncate">{fam}</span><span className="font-mono font-normal">{list.filter(isOn).length}/{list.length}</span>
                  </button>
                  {open && <ul className="space-y-1.5 px-1 pb-2 pt-1">
                    {list.map(m => <LibraryCard key={m.id} m={m} on={isOn(m)} core={req.includes(m.id)} govd={GOVERNED.has(m.name)} shared={shared(m)}
                      missing={!!m.needs && isOn(m) && !isOn(byName(m.needs))} onAdd={() => add(m)} onDrag={setDragging} onLock={() => setLockInfo(m)} onPick={() => setInspect(m.id)} />)}
                  </ul>}
                </section>
              )
            })}
            {!valid.some(shown) && <p className="p-4 text-center text-[13px] text-text-3">No modules match. <button type="button" className="font-semibold text-brand hover:underline" onClick={() => { setQ(''); setFilter('All') }}>Clear</button></p>}
          </div>
          <p className="border-t border-border px-3 py-2 text-[11px] text-text-3">{hidden} modules not compatible with {archName(arch)} are hidden. New modules are version requests to the platform team.</p>
        </aside>
      </div>

      {lockInfo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="lock-title" onClick={() => setLockInfo(null)}>
          <div className="rise w-full max-w-md rounded-lg bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 id="lock-title" className="text-lg font-semibold">{lockInfo.name} is required</h2>
            <p className="mt-2 text-sm text-text-2">The {archName(arch)} engine needs this module, so it is always on the canvas. To change it, pick a different archetype or raise a version request with the platform team.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => { setLockInfo(null); go(2) }}>Change archetype</Btn>
              <Btn onClick={() => setLockInfo(null)}>Got it</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Step 5 · Data configuration ───────────────────────── */

const SOURCE_OPTIONS = ['IQVIA NPA weekly', 'IQVIA LAAD claims', 'Symphony PatientSource', 'Komodo Health', 'Internal Epi Library', 'UN population (WPP)', 'Internal Pricing (Model N)', 'SAP actuals (net sales)', 'CDC NIS-Teen / Adult']
const PATHWAYS: { id: Pathway; label: string; hint: string; icon: typeof Link2 }[] = [
  { id: 'Connected', label: 'Connected source', hint: 'Available to the platform already', icon: Link2 },
  { id: 'File', label: 'File-based', hint: 'Uploaded each cycle, fields mapped once', icon: FileUp },
  { id: 'Manual', label: 'Manual input', hint: 'Entered by the forecaster', icon: Keyboard },
]
const EXPOSURE: { id: Exposure; label: string }[] = [{ id: 'Editable', label: 'Forecaster can edit' }, { id: 'Visible', label: 'Visible, read-only' }, { id: 'Hidden', label: 'Not shown' }]
const pathOf = (b?: Binding): Pathway => b?.path ?? 'Connected'
const exposeOf = (b?: Binding): Exposure => b?.expose ?? (pathOf(b) === 'Manual' ? 'Editable' : 'Visible')

function StageData({ c, ind, update, updInd, go }: Ctx) {
  const live = useContext(AgentCtx).field
  const ins = inputsFor(c)
  if (!ins.length) return <EmptyState icon={<Database size={18} />} title="No inputs to configure yet" action={<Btn size="sm" onClick={() => go(2)}>Choose archetypes</Btn>}>Inputs appear once each revenue stream has an archetype and modules.</EmptyState>
  const groups = Array.from(new Set(ins.map(b => b.scope))).map(scope => ({
    scope, label: scope === 'brand' ? 'Shared across all streams' : c.inds.find(i => i.id === scope)?.name || 'Untitled stream',
    rows: ins.filter(b => b.scope === scope),
  }))
  const setB = (key: string, p: Partial<Binding>) => update({ bindings: { ...c.bindings, [key]: { ...c.bindings[key]!, ...p } } })
  const n = (pw: Pathway) => ins.filter(b => pathOf(c.bindings[b.key]) === pw).length
  const perms = ind.arch ? assumptionsFor(ind.arch).filter(a => ind.perms[a.id]) : []
  const setP = (id: string, p: Partial<Perm>) => updInd(ind.id, { perms: { ...ind.perms, [id]: { ...ind.perms[id], ...p } } })
  const exposed = perms.filter(a => ind.perms[a.id].open).length
  return (
    <>
      <div className="grid gap-3 @xl:grid-cols-3">
        {PATHWAYS.map(pw => <div key={pw.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-2 text-text-2"><pw.icon size={15} /></span><span className="min-w-0"><span className="block text-[13px] font-semibold">{pw.label} <span className="font-mono text-text-3">{n(pw.id)}</span></span><span className="block text-[11px] text-text-3">{pw.hint}</span></span></div>)}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wide text-text-3">
              <th scope="col" className="px-4 py-3 font-semibold">Input · feeds</th>
              <th scope="col" className="px-3 py-3 font-semibold">Pathway</th>
              <th scope="col" className="px-3 py-3 font-semibold">Source · mapping</th>
              <th scope="col" className="px-3 py-3 font-semibold">In the Forecaster</th>
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g.scope}>
              {groups.length > 1 && (
                <tr className="border-b border-border bg-surface-2/60">
                  <th scope="rowgroup" colSpan={4} className="px-4 py-2 text-left text-xs font-semibold text-text">{g.label}<span className="ml-2 font-normal text-text-3">{g.scope === 'brand' ? 'Shared across every revenue stream' : `${g.rows.length} input${g.rows.length > 1 ? 's' : ''}`}</span></th>
                </tr>
              )}
              {g.rows.map(b => {
                const x = c.bindings[b.key], pw = pathOf(x)
                return (
                  <tr key={b.key} data-agent={`bind-${b.key}`} className={cx('border-b border-border align-top last:border-0', live === `bind-${b.key}` && 'agent-row')}>
                    <td className="px-4 py-3"><p className="font-medium text-text">{b.input.name}</p><p className="text-xs text-text-3">Feeds {b.input.feeds}</p></td>
                    <td className="px-3 py-3"><select aria-label={`Pathway for ${b.input.name}`} className={cx(inputCls(), 'h-8! text-[13px]')} value={pw} onChange={e => setB(b.key, { path: e.target.value as Pathway, expose: e.target.value === 'Manual' ? 'Editable' : x?.expose })}>{PATHWAYS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></td>
                    <td className="px-3 py-3 text-[13px]">
                      {pw === 'Connected' && <><select aria-label={`Source for ${b.input.name}`} className={cx(inputCls(), 'h-8! text-[13px]')} value={x?.source || b.input.suggested} onChange={e => setB(b.key, { source: e.target.value })}>{Array.from(new Set([b.input.suggested, ...SOURCE_OPTIONS])).map(o => <option key={o} value={o}>{o}{o === b.input.suggested ? ' (suggested)' : ''}</option>)}</select><p className="mt-1 text-[11px] text-text-3">Already available to the platform</p></>}
                      {pw === 'File' && <><input aria-label={`Mapped field for ${b.input.name}`} className={cx(inputCls(), 'h-8! text-[13px]')} value={x?.mapField ?? ''} onChange={e => setB(b.key, { mapField: e.target.value })} placeholder="Column in the file, e.g. Px_net" /><p className="mt-1 text-[11px] text-text-3">Maps to {b.input.name.toLowerCase()}</p></>}
                      {pw === 'Manual' && <p className="text-text-2">Entered in the Forecaster workspace</p>}
                    </td>
                    <td className="px-3 py-3"><select aria-label={`Forecaster exposure for ${b.input.name}`} className={cx(inputCls(), 'h-8! text-[13px]')} value={exposeOf(x)} disabled={pw === 'Manual'} onChange={e => setB(b.key, { expose: e.target.value as Exposure })}>{EXPOSURE.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-5 pb-3 pt-4">
          <h3 className="text-sm font-semibold">Inputs exposed to the Forecaster</h3>
          <p className="mt-0.5 text-xs text-text-2">What forecasters can change, and within which bounds.</p>
        </div>
        <StreamList c={c} ind={ind} update={update} tabs sub={i => i.arch ? [`${Object.values(i.perms).filter(p => p.open).length} editable`, true] : ['No archetype', false]} />
        <div className="p-5">
          {!ind.arch ? <EmptyState icon={<Layers size={18} />} title="No archetype yet" action={<Btn size="sm" onClick={() => go(2)}>Choose an archetype</Btn>}>Inputs come from the archetype.</EmptyState> : (
            <>
              <p className="mb-3 text-xs text-text-3">{exposed} of {perms.length} editable by the Forecaster · {perms.length - exposed} locked</p>
              <ul className="divide-y divide-border">
                {perms.map(a => {
                  const p = ind.perms[a.id]
                  const bad = outOfBand(p)
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-[180px] flex-1"><p className="text-[13px] font-semibold">{a.name}</p><p className="text-xs text-text-3">Base {p.value} {a.unit}</p></div>
                      {p.open ? (
                        <div className="flex items-center gap-2 text-xs text-text-2">
                          <label className="flex items-center gap-1.5">Min<input type="number" aria-label={`${a.name} minimum`} className={cx(inputCls(bad), 'h-8 w-20 px-2')} value={p.min} onChange={e => setP(a.id, { min: Number(e.target.value) })} /></label>
                          <label className="flex items-center gap-1.5">Max<input type="number" aria-label={`${a.name} maximum`} className={cx(inputCls(bad), 'h-8 w-20 px-2')} value={p.max} onChange={e => setP(a.id, { max: Number(e.target.value) })} /></label>
                          <span className="text-text-3">{a.unit}</span>
                        </div>
                      ) : <span className="flex items-center gap-1.5 text-xs text-text-3"><Lock size={12} />Locked</span>}
                      <label className="flex items-center gap-2 text-xs text-text-2"><Switch on={p.open} onChange={v => setP(a.id, { open: v })} label={`Forecaster can edit ${a.name}`} />{p.open ? 'Editable' : 'Locked'}</label>
                      {bad && <p className="w-full text-xs text-err">Bounds must be increasing and contain the base value ({p.value}).</p>}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  )
}

/* ───────────────────────── Step 6 · Review configuration ───────────────────────── */

/** Visual model flow: setup → archetype → modes → modules → data, per stream, ending at what forecasters will see. */
type FlowStream = { name: string; arch: string; modes: string[]; modules: string[]; data: string; dataSub?: string }
type FlowView = { title: string; meta: string; streams: FlowStream[]; output: string }
function ModelFlow({ title, meta, streams, output, go }: FlowView & { go?: (n: number) => void }) {
  const node = (stage: number, label: string, value: string, sub?: string) => (
    <button key={stage} type="button" disabled={!go} onClick={() => go?.(stage)} title={go ? `Edit ${STAGES[stage - 1].title}` : undefined}
      className="flex w-full min-w-0 flex-col rounded-lg border border-border bg-surface px-2.5 py-2 text-left transition-colors enabled:hover:border-brand enabled:hover:bg-brand-soft/40 disabled:cursor-default">
      <span className="font-mono text-[10px] uppercase tracking-wide text-text-3">{stage} · {label}</span>
      <span className="truncate text-[12.5px] font-medium" title={value}>{value || '—'}</span>
      {sub && <span className="truncate text-[11px] text-text-3" title={sub}>{sub}</span>}
    </button>
  )
  const arrow = (k: number) => <ChevronDown key={`a${k}`} size={13} aria-hidden className="-my-0.5 shrink-0 self-center text-text-3" />
  return (
    <div className="@container">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-brand/25 bg-brand-soft/50 px-3 py-2">
        <Boxes size={14} className="shrink-0 text-brand" /><span className="text-[13px] font-semibold">{title}</span><span className="text-[12px] text-text-2">{meta}</span>
      </div>
      <span aria-hidden className="mx-auto block h-3 w-px bg-border-strong" />
      <ol className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]" aria-label="Model flow by stream, top to bottom">
        {streams.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex min-w-0 flex-col rounded-lg border border-dashed border-border-strong p-1.5">
            {[node(1, 'Stream', s.name), node(2, 'Archetype', s.arch), node(3, 'Modes', s.modes.join(' · '), `${s.modes.length} set`),
              node(4, 'Modules', `${s.modules.length} attached`, s.modules.slice(0, 2).join(', ') + (s.modules.length > 2 ? ` +${s.modules.length - 2}` : '')), node(5, 'Data', s.data, s.dataSub)]
              .flatMap((n, k) => k ? [arrow(k), n] : [n])}
          </li>
        ))}
      </ol>
      <span aria-hidden className="mx-auto block h-3 w-px bg-border-strong" />
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2 text-[12px] text-text-2">
        <Send size={13} className="shrink-0 text-text-3" /><span><b className="font-semibold text-text">Forecaster workspace</b> · {output}</span>
      </div>
    </div>
  )
}
const cfgFlow = (c: Config): FlowView => {
  const all = inputsFor(c)
  return {
    title: c.brand || 'Untitled model', meta: [c.asset, c.therapyArea, c.market].filter(Boolean).join(' · '),
    streams: c.inds.map(i => {
      const ins = inputsFor(c, i.id), n = (pw: Pathway) => ins.filter(x => pathOf(c.bindings[x.key]) === pw).length
      return { name: i.name || 'Untitled stream', arch: archName(i.arch) || 'No archetype', modes: i.arch ? modesFor(i.arch).map(m => i.modes[m.id]).filter(Boolean) : [], modules: orderedModules(i).map(m => m.name),
        data: `${ins.length} input${ins.length === 1 ? '' : 's'}`, dataSub: `${n('Connected')} connected · ${n('File')} file · ${n('Manual')} manual` }
    }),
    output: `${all.filter(x => exposeOf(c.bindings[x.key]) === 'Editable').length} editable · ${all.filter(x => exposeOf(c.bindings[x.key]) === 'Visible').length} read-only inputs. Available only after you finalise.`,
  }
}

/* Forecaster flow: the calculation funnel a forecaster will work in, built from this stream's archetype,
   attached modules and input permissions. Values are illustrative starting points so reviewers can check the logic. */
type FunnelNode =
  | { kind: 'vol'; label: string; value: number; unit: 'patients' | 'scripts' | 'doses' | '$'; src: string; tag: 'data' | 'calc' | 'output'; stage: number; note?: string; masked?: boolean }
  | { kind: 'factor'; label: string; disp: string; mult: number; module: string; stage: number; perm?: string; note?: string }
const LIST_PRICE: Partial<Record<ArchId, number>> = { 'D-05': 180 }
function forecasterFunnel(ind: Ind): { nodes: FunnelNode[]; checks: { tone: 'ok' | 'warn' | 'info'; msg: string; stage: number }[] } {
  const a = ind.arch
  if (!a) return { nodes: [], checks: [] }
  const mods = orderedModules(ind).map(m => m.name), has = (n: string) => mods.includes(n)
  const defs = assumptionsFor(a)
  const pv = (id: string) => ind.perms[id]?.value ?? defs.find(d => d.id === id)?.base ?? 0
  const nodes: FunnelNode[] = []
  let v = 0
  // Upstream patient pools (prevalent → diagnosed → treated) aren't connected at configuration time; the forecaster fills them.
  let masking = false
  const start = (label: string, value: number, unit: 'patients' | 'scripts' | 'doses' | '$', src: string, note?: string) => { v = value; nodes.push({ kind: 'vol', label, value, unit, src, tag: 'data', stage: 5, note, masked: masking || undefined }) }
  const f = (label: string, disp: string, mult: number, module: string, yields: string, unit: 'patients' | 'scripts' | 'doses' | '$', opts: { perm?: string; stage?: number; note?: string } = {}) => {
    nodes.push({ kind: 'factor', label, disp, mult, module, stage: opts.stage ?? (opts.perm ? 5 : 4), perm: opts.perm, note: opts.note })
    v *= mult; nodes.push({ kind: 'vol', label: yields, value: v, unit, src: 'Calculated', tag: 'calc', stage: 4, masked: masking || undefined })
  }
  const pct = (id: string) => pv(id) / 100
  const patientFront = () => {
    masking = true
    if (has('Epi funnel builder')) {
      start('Prevalent population', 1_200_000, 'patients', 'Internal Epi Library')
      f('Diagnosed', '64%', 0.64, 'Epi funnel builder', 'Diagnosed patients', 'patients', { stage: 5 })
    } else start(BASE_INPUTS[a][0]!.name, a === 'D-07' ? 250_000 : 520_000, 'patients', BASE_INPUTS[a][0]!.suggested)
    if (has('Testing / biomarker gates')) f('Tested and biomarker-positive', '70% × 40%', 0.28, 'Testing / biomarker gates', 'Eligible patients', 'patients')
    if (has('Access & funding gates')) f('Reimbursed', '85%', 0.85, 'Access & funding gates', 'Covered patients', 'patients')
    masking = false
  }
  const tail = (unitsLabel = 'Scripts per year', perYear = 12, unit: 'scripts' | 'doses' = 'scripts') => {
    f(unit === 'doses' ? 'Doses per vaccinee' : 'Rx per patient-year', String(perYear), perYear, has('Volume conversion chains') ? 'Volume conversion chains' : 'Core engine', unitsLabel, unit)
    const price = LIST_PRICE[a] ?? 650
    f(`List price per ${unit === 'doses' ? 'dose' : 'Rx'}`, `$${price}`, price, has('Price & FX') ? 'Price & FX' : 'Core engine (flat price)', 'Gross sales', '$', { note: `Annual price change ${pv('price')}%`, perm: 'price' })
    const g = pct('g2n')
    f('Gross-to-net', `− ${pv('g2n')}%`, 1 - g, has('Gross-to-net engines') ? 'Gross-to-net engines' : 'Core engine (single discount)', 'Net revenue', '$', { perm: 'g2n' })
  }
  switch (a) {
    case 'D-01':
      patientFront()
      // Without the epi builder the data feed is already the treated pool, so the treated rate isn't applied twice.
      masking = true
      if (has('Epi funnel builder')) f('Treated rate', `${pv('treated')}%`, pct('treated'), 'Prevalent-Share engine', 'Treated patients', 'patients', { perm: 'treated' })
      masking = false
      if (has('Nested share cascades')) f('Class share', '55%', 0.55, 'Nested share cascades', 'Patients in class', 'patients')
      f('Peak brand share', `${pv('peak')}%`, pct('peak'), has('Share-curve generators') ? 'Share-curve generators' : 'Prevalent-Share engine', 'Patients on brand', 'patients', { perm: 'peak', note: `Reached in ${pv('ttp')} months` })
      // Compliance is set by the forecaster, so at configuration compliant patients equal patients on brand.
      if (has('Compliance matrices')) f('Compliance', '100%', 1, 'Compliance matrices', 'Compliant patients', 'patients', { note: 'Same as patients on brand until the forecaster sets compliance' })
      tail(); break
    case 'D-02':
      start('Market Rx basket', 4_800_000, 'scripts', BASE_INPUTS[a][0]!.suggested, `Trended ${pv('mtrend')}% a year`)
      f('Peak share of basket', `${pv('peak')}%`, pct('peak'), has('Share-curve generators') ? 'Share-curve generators' : 'Rx-Share engine', 'Brand TRx', 'scripts', { perm: 'peak', note: `Reached in ${pv('ttp')} months` })
      f(`List price per Rx`, `$${LIST_PRICE[a] ?? 650}`, LIST_PRICE[a] ?? 650, has('Price & FX') ? 'Price & FX' : 'Core engine (flat price)', 'Gross sales', '$', { perm: 'price', note: `Annual price change ${pv('price')}%` })
      f('Gross-to-net', `− ${pv('g2n')}%`, 1 - pct('g2n'), has('Gross-to-net engines') ? 'Gross-to-net engines' : 'Core engine (single discount)', 'Net revenue', '$', { perm: 'g2n' }); break
    case 'D-03': {
      const months = Math.round(-12 / Math.log(Math.max(0.01, Math.min(0.99, pct('persist12')))))
      start('New patient starts per month', pv('starts'), 'patients', 'Forecaster input · claims-derived starts')
      f('Average months on therapy', `${months} mo`, months, has('Persistency grids') ? 'Persistency grids' : 'Patient-Flow engine', 'Patients on therapy', 'patients', { perm: 'persist12', note: `From ${pv('persist12')}% still on therapy at 12 months` })
      f('Compliance', `${pv('compliance')}%`, pct('compliance'), 'Patient-Flow engine', 'Compliant patients', 'patients', { perm: 'compliance' })
      tail(); break
    }
    case 'D-04':
      start('Monthly start rate', pv('inflow'), 'patients', 'Forecaster input · start rate')
      f('Stock at steady state', `÷ ${pv('disc')}% / mo`, 100 / Math.max(0.1, pv('disc')), 'Brand Inflow-Outflow engine', 'Brand patient stock', 'patients', { perm: 'disc', note: 'Starts ÷ monthly discontinuation' })
      f('Compliance', `${pv('compliance')}%`, pct('compliance'), 'Brand Inflow-Outflow engine', 'Compliant patients', 'patients', { perm: 'compliance' })
      tail(); break
    case 'D-05': {
      const yr = 1 - (1 - pct('capture')) ** 12
      start('Unvaccinated eligible stock', 9_000_000, 'patients', BASE_INPUTS[a][0]!.suggested)
      f('Coverage ceiling', `${pv('ceiling')}%`, pct('ceiling'), 'Vaccine engine', 'Reachable population', 'patients', { perm: 'ceiling' })
      f('Captured in a year', `${Math.round(yr * 100)}%`, yr, 'Vaccine engine', 'Vaccinated this year', 'patients', { perm: 'capture', note: `${pv('capture')}% captured per month` })
      f('Series completion', `${pv('boost')}%`, pct('boost'), has('Dose-sequence chains') ? 'Dose-sequence chains' : 'Vaccine engine', 'Completed series', 'patients', { perm: 'boost' })
      tail('Doses per year', 2, 'doses'); break
    }
    case 'D-06':
      start('Historical net sales, last 12 months', 410_000_000, '$', BASE_INPUTS[a][0]!.suggested)
      f('Statistical trend', '+4.0% a year', 1.04, has('Seasonality decomposition') ? 'Seasonality decomposition' : 'Trend engine', 'Trended baseline', '$', { perm: 'window', note: `Fitted on ${pv('window')} months` })
      f('Event adjustment', `${pv('evadj') >= 0 ? '+' : ''}${pv('evadj')}%`, 1 + pv('evadj') / 100, has('Dated event layers') ? 'Dated event layers' : 'Trend engine', 'Net revenue', '$', { perm: 'evadj' }); break
    case 'D-07':
      patientFront()
      f('Peak share', `${pv('pshare')}%`, pct('pshare'), 'Analog engine', 'Patients on brand (US analog)', 'patients', { perm: 'pshare', note: `Reached in ${pv('ppeak')} years` })
      f('Ex-US analog factor', `× ${pv('analog')}`, pv('analog'), has('Analog / reference-market scaling') ? 'Analog / reference-market scaling' : 'Analog engine', 'Patients on brand', 'patients', { perm: 'analog' })
      tail(); break
  }
  const last = nodes[nodes.length - 1]
  if (last && last.kind === 'vol') last.tag = 'output'
  const factors = nodes.filter((n): n is Extract<FunnelNode, { kind: 'factor' }> => n.kind === 'factor')
  const editable = factors.filter(n => n.perm && ind.perms[n.perm]?.open)
  const checks: { tone: 'ok' | 'warn' | 'info'; msg: string; stage: number }[] = [
    { tone: 'ok', msg: `${nodes.filter(n => n.kind === 'vol').length} steps from ${nodes[0]?.label.toLowerCase()} to net revenue. Each step feeds the next.`, stage: 4 },
    { tone: editable.length ? 'info' : 'warn', msg: editable.length ? `Forecaster can edit: ${editable.map(n => n.label.toLowerCase()).join(', ')}.` : 'The forecaster cannot edit any step in this funnel.', stage: 5 },
  ]
  if (a !== 'D-06' && !has('Price & FX')) checks.push({ tone: 'warn', msg: 'No Price & FX module: revenue uses one flat list price.', stage: 4 })
  if (a !== 'D-06' && !has('Gross-to-net engines')) checks.push({ tone: 'warn', msg: 'No gross-to-net module: net revenue uses a single discount.', stage: 4 })
  if (a === 'D-01' && !has('Epi funnel builder')) checks.push({ tone: 'info', msg: `Starts from the treated pool feed. Attach the Epi funnel builder to show prevalence → diagnosed → treated (${pv('treated')}%).`, stage: 4 })
  if (has('LOE erosion')) checks.push({ tone: 'info', msg: `After LOE, volume falls to ${pv('loe')}% of pre-LOE.`, stage: 4 })
  if (has('Dated event layers')) checks.push({ tone: 'info', msg: 'Dated events can move share, volume and price on top of this funnel.', stage: 4 })
  return { nodes, checks }
}
const fmtFunnel = (v: number, unit: string) => unit === '$'
  ? (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`)
  : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : Math.round(v).toLocaleString('en-US')

/* ───────────────────────── Live forecast flow (right side of the configurator) ───────────────────────── */

/* A Sankey of every stream rolling up to total net revenue, rebuilt from the configuration on each edit:
   streams → archetype engines → modes → modules → data, top to bottom, ending in net revenue and gross-to-net.
   Modules change the funnel values, so band widths move as modules are attached. Values are illustrative, from forecasterFunnel. */
const FLOW_HUES = ['#0000c9', '#0a7d4f', '#c2410c', '#7c3aed', '#0e7490', '#be185d', '#4d7c0f']
type FlowRow = { id: string; name: string; hue: string; arch: ArchId | null; gross: number; net: number; steps: boolean[]; modes: [number, number]; mods: number; ins: [number, number] }
const flowRows = (c: Config): FlowRow[] => c.inds.map((i, k) => {
  const vols = forecasterFunnel(i).nodes.filter((n): n is Extract<FunnelNode, { kind: 'vol' }> => n.kind === 'vol')
  const net = vols[vols.length - 1]?.value ?? 0
  const gross = vols.find(n => n.label === 'Gross sales')?.value ?? net
  const modes = i.arch ? modesFor(i.arch).filter(m => !m.optional && (!m.showIf || m.showIf(i.modes))) : []
  const ins = inputsFor(c, i.id)
  return {
    id: i.id, name: i.name.trim() || `Stream ${k + 1}`, hue: FLOW_HUES[k % FLOW_HUES.length]!, arch: i.arch, gross, net,
    modes: [modes.filter(m => i.modes[m.id]).length, modes.length], mods: i.arch ? orderedModules(i).length : 0, ins: [ins.filter(b => dataReady(c.bindings[b.key])).length, ins.length],
    steps: [!!i.name.trim(), !!i.arch, !!i.arch && modes.every(m => i.modes[m.id]), !!i.arch && orderedModules(i).length > 0, ins.length > 0 && ins.every(b => dataReady(c.bindings[b.key]))],
  }
})

/* A simple top-to-bottom flow: streams → archetype engines → total net revenue. Streams on the same archetype merge.
   Band widths follow each stream's net revenue (square-root scaled so small streams stay visible). */
type VNode = { key: string; row: number; x: number; w: number; label: string; pending?: boolean; hue?: string; stream?: string; tone: 'stream' | 'engine' | 'total' }
type VLink = { key: string; d: string; hue: string; stream: string; pending?: boolean }
const SK = { BH: 10, PAD: 10, ROW: 84, TOP: 30 }
const FLOW_ROWS = ['Streams', 'Archetype', 'Net revenue']
const vband = (x0: number, y0: number, x1: number, y1: number, w: number) => {
  const m = (y0 + y1) / 2
  return `M${x0},${y0}C${x0},${m} ${x1},${m} ${x1},${y1}L${x1 + w},${y1}C${x1 + w},${m} ${x0 + w},${m} ${x0 + w},${y0}Z`
}
function layoutFlow(rows: FlowRow[], W: number) {
  const { BH, PAD, ROW, TOP } = SK
  const n = rows.length
  const live = (r: FlowRow) => !!r.arch && r.net > 0
  const roots = rows.map(r => (live(r) ? Math.sqrt(r.net) : 0))
  const known = roots.filter(Boolean)
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1
  const raw = roots.map(v => v || avg * 0.55)
  const avail = W - PAD * (n - 1), sum = raw.reduce((a, b) => a + b, 0) || 1
  let w = raw.map(v => Math.max(24, (v / sum) * avail))
  const ws = w.reduce((a, b) => a + b, 0)
  if (ws > avail) w = w.map(v => (v * avail) / ws)
  const by = (row: number) => TOP + row * ROW
  const center = (t: number) => Math.max(0, (W - t) / 2)
  const nodes: VNode[] = [], links: VLink[] = []

  const s0: number[] = []
  let x = 0
  rows.forEach((r, k) => { nodes.push({ key: `s-${r.id}`, row: 0, x, w: w[k]!, label: r.name, hue: r.hue, stream: r.id, tone: 'stream' }); s0[k] = x; x += w[k]! + PAD })

  const groups = Array.from(new Set(rows.map(r => r.arch ?? 'pending'))).map(g => ({ g, idx: rows.flatMap((r, k) => ((r.arch ?? 'pending') === g ? [k] : [])) }))
  const gw = groups.map(G => G.idx.reduce((a, k) => a + w[k]!, 0))
  const s1: number[] = []
  x = center(gw.reduce((a, b) => a + b, 0) + PAD * (groups.length - 1))
  groups.forEach((G, j) => {
    const pending = G.g === 'pending'
    nodes.push({ key: `e-${G.g}`, row: 1, x, w: gw[j]!, label: pending ? 'No archetype yet' : archName(G.g as ArchId), pending, tone: 'engine' })
    let off = x
    G.idx.forEach(k => { s1[k] = off; links.push({ key: `a-${rows[k]!.id}`, d: vband(s0[k]!, by(0) + BH, off, by(1), w[k]!), hue: rows[k]!.hue, stream: rows[k]!.id, pending: !rows[k]!.arch }); off += w[k]! })
    x += gw[j]! + PAD
  })

  const liveIdx = groups.flatMap(G => G.idx).filter(k => live(rows[k]!))
  let H = by(1) + BH + 4
  if (liveIdx.length) {
    const tw = liveIdx.reduce((a, k) => a + w[k]!, 0)
    let off = center(tw)
    nodes.push({ key: 'total', row: 2, x: off, w: tw, label: `Total ${fmtFunnel(liveIdx.reduce((a, k) => a + rows[k]!.net, 0), '$')}`, tone: 'total' })
    liveIdx.forEach(k => { links.push({ key: `t-${rows[k]!.id}`, d: vband(s1[k]!, by(1) + BH, off, by(2), w[k]!), hue: rows[k]!.hue, stream: rows[k]!.id }); off += w[k]! })
    H = by(2) + BH + 4
  }
  return { nodes, links, H, by, rowsShown: liveIdx.length ? 3 : 2 }
}
const FLOW_MIN = 280, FLOW_MAX = 680
const clipText = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const HALO = { paintOrder: 'stroke' as const, stroke: '#f6f7fb', strokeWidth: 3, strokeLinejoin: 'round' as const }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e!.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function FlowSankey({ rows, onPick, go, hov, setHov, id }: { rows: FlowRow[]; onPick: (id: string) => void; go: (n: number) => void; hov: string | null; setHov: (id: string | null) => void; id: string }) {
  const [ref, cw] = useWidth<HTMLDivElement>()
  const W = Math.max(200, cw || 280)
  const { nodes, links, H, by, rowsShown } = useMemo(() => layoutFlow(rows, W), [rows, W])
  const dim = (s?: string) => !!hov && !!s && s !== hov
  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-label={`Flow: ${rows.map(r => `${r.name}${r.arch ? ` on ${archName(r.arch)}` : ', no archetype yet'}`).join('; ')}`}>
        <defs><pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#eef0f7" /><line x1="0" y1="0" x2="0" y2="6" stroke="#b9bed0" strokeWidth="1.5" /></pattern></defs>
        {FLOW_ROWS.slice(0, rowsShown).map((t, r) => <text key={t} x={0} y={by(r) - 20} className="fill-text-3 font-mono" fontSize={9} fontWeight={600} letterSpacing={0.8} style={HALO}>{t.toUpperCase()}</text>)}
        {links.map(l => <path key={l.key} d={l.d} onMouseEnter={() => setHov(l.stream)} onMouseLeave={() => setHov(null)} fill={l.pending ? `url(#${id}-hatch)` : l.hue} fillOpacity={dim(l.stream) ? 0.08 : l.pending ? 0.9 : hov === l.stream ? 0.4 : 0.22} style={{ transition: 'd .45s ease, fill-opacity .2s ease' }} />)}
        {nodes.map(n => {
          const y = by(n.row), chars = Math.floor(n.w / 6)
          const fill = n.tone === 'total' ? '#000a5c' : n.pending ? '#ffffff' : n.tone === 'engine' ? '#4a5070' : n.hue!
          const click = n.tone === 'stream' ? () => onPick(n.stream!) : n.pending ? () => go(2) : undefined
          return (
            <g key={n.key} onClick={click} onMouseEnter={() => n.stream && setHov(n.stream)} onMouseLeave={() => setHov(null)} className={click ? 'cursor-pointer' : undefined} opacity={dim(n.stream) ? 0.35 : 1}>
              <title>{n.pending ? 'Choose an archetype in step 2' : n.label}</title>
              <rect x={n.x} y={y} width={Math.max(2, n.w)} height={SK.BH} rx={3} fill={fill} stroke={n.pending ? '#8a8fa8' : 'none'} strokeDasharray={n.pending ? '3 2' : undefined} style={{ transition: 'x .45s ease, width .45s ease' }} />
              {chars >= 4 && <text x={n.x + n.w / 2} y={y - 6} textAnchor="middle" fontSize={n.tone === 'total' ? 12 : 11} fontWeight={600} className={n.pending ? 'fill-warn' : 'fill-text'} style={HALO}>{clipText(n.label, chars)}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ForecastFlowPanel({ c, stage, go, onPick, open, aiOpen, onOpen, onClose }: {
  c: Config; stage: number; go: (n: number) => void; canGo: (n: number) => boolean; onPick: (id: string) => void
  open: boolean; aiOpen: boolean; onOpen: () => void; onClose: () => void
}) {
  const rows = useMemo(() => flowRows(c), [c])
  const [hov, setHov] = useState<string | null>(null)
  const [big, setBig] = useState(false)
  useEffect(() => { if (!big) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [big])
  const live = rows.filter(r => r.arch && r.net > 0)
  const net = live.reduce((a, r) => a + r.net, 0)
  const inBuild = stage < 6

  if (!open) return (
    <button type="button" onClick={onOpen} title={aiOpen ? 'Folded while COE AI is open. Select to show the flow.' : 'Show the full flow preview'}
      className="flex h-full w-full flex-col items-center gap-3 py-4 text-text-2 outline-none transition-colors hover:bg-surface-2 hover:text-brand focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
      <PanelRightOpen size={16} className="shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl]">Full flow preview</span>
      {net > 0 && !inBuild && <span className="font-mono text-[11px] font-semibold text-brand [writing-mode:vertical-rl]">{fmtFunnel(net, '$')}</span>}
    </button>
  )

  const kpi = (
    <div>
      <div className="mb-2.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-text-2">
        <span className="font-semibold text-text">{c.brand || 'Untitled model'}</span>
        <span className="text-text-3"> · </span>
        <span>{c.market || 'US'}</span>
        <span className="text-text-3"> · </span>
        <span>{c.inds.length} stream{c.inds.length > 1 ? 's' : ''}</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Total net revenue</p>
      {inBuild ? (
        <>
          <p className="mt-0.5 text-[15px] font-medium italic text-text-3">Not yet calculated</p>
          <p className="mt-0.5 text-[11.5px] text-text-3">Structure is prioritised in build mode. Revenue calculates in Step 6 (Review).</p>
        </>
      ) : (
        <>
          <p className="mt-0.5 font-mono text-[26px] font-semibold leading-tight tracking-tight text-brand-dark">{net > 0 ? fmtFunnel(net, '$') : '—'}</p>
          <p className="text-[11.5px] text-text-3">{net > 0 ? 'Annual at peak · calculated' : 'Appears once streams have archetypes'}</p>
        </>
      )}
    </div>
  )
  const list = (close?: () => void) => (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map(r => {
        const done = r.steps.filter(Boolean).length
        return (
          <li key={r.id} onMouseEnter={() => setHov(r.id)} onMouseLeave={() => setHov(null)}>
            <button type="button" onClick={() => { onPick(r.id); close?.() }} className={cx('flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2', c.active === r.id && 'bg-brand-soft/40')}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.hue }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold">{r.name}</span>
                <span className={cx('block truncate text-[11.5px]', r.arch ? 'text-text-3' : 'text-warn')}>{r.arch ? archName(r.arch) : 'No archetype yet'}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[12px] font-semibold">{r.arch && r.net > 0 ? fmtFunnel(r.net, '$') : '—'}</span>
                <span className="block text-[10.5px] text-text-3">{done}/5 steps</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0"><p className="text-[13px] font-semibold">Full flow preview</p><p className="text-[11.5px] text-text-3">Updates as you configure</p></div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ChartActions target="export-flow-side" title="Full flow preview" subtitle={c.brand || 'Untitled model'} />
          <button type="button" onClick={() => setBig(true)} aria-label="Expand the flow" title="Expand" className="grid h-7 w-7 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><Maximize2 size={14} /></button>
          <button type="button" onClick={onClose} aria-label="Fold the full flow preview" title="Fold" className="grid h-7 w-7 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><PanelRightClose size={15} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div id="export-flow-side" className="space-y-5 bg-background">{kpi}<FlowSankey rows={rows} onPick={onPick} go={go} hov={hov} setHov={setHov} id="flow-side" /></div>
        {list()}
      </div>

      {big && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="flow-big-title" onClick={() => setBig(false)}>
          <div className="rise flex h-[min(88dvh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <h2 id="flow-big-title" className="text-[15px] font-semibold">Full flow preview · {c.brand || 'Untitled model'}</h2>
              <div className="flex items-center gap-1"><ChartActions target="export-flow-big" title="Full flow preview" subtitle={c.brand || 'Untitled model'} /><button type="button" onClick={() => setBig(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><X size={16} /></button></div>
            </header>
            <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-h-0 overflow-y-auto bg-background px-10 py-8"><div id="export-flow-big" className="bg-background p-2"><FlowSankey rows={rows} onPick={id => { onPick(id); setBig(false) }} go={n => { go(n); setBig(false) }} hov={hov} setHov={setHov} id="flow-big" /></div></div>
              <aside className="min-h-0 space-y-5 overflow-y-auto border-l border-border px-5 py-5">{kpi}{list(() => setBig(false))}</aside>
            </div>
          </div>
        </div>, document.body)}
    </div>
  )
}

function ForecasterFlow({ ind, go }: { ind: Ind; go: (n: number) => void }) {
  const { nodes, checks } = forecasterFunnel(ind)
  if (!ind.arch) return <EmptyState icon={<Workflow size={18} />} title="No archetype yet" action={<Btn size="sm" onClick={() => go(2)}>Choose an archetype</Btn>}>The forecaster funnel comes from the archetype.</EmptyState>
  // Bars share one log scale per unit so a drop from millions to thousands stays readable.
  const vols = nodes.filter((n): n is Extract<FunnelNode, { kind: 'vol' }> => n.kind === 'vol' && !n.masked)
  const span = (u: string) => { const xs = vols.filter(n => (n.unit === '$') === (u === '$')).map(n => Math.max(1, n.value)); return [Math.min(...xs), Math.max(...xs)] as const }
  const width = (n: Extract<FunnelNode, { kind: 'vol' }>) => { const [lo, hi] = span(n.unit); return hi <= lo ? 100 : 18 + 82 * Math.log(Math.max(1, n.value) / lo) / Math.log(hi / lo) }
  return (
    <div className="@container">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-text-2">
        <span className="inline-flex items-center gap-1.5"><Database size={12} className="text-text-3" />Data feed</span>
        <span className="inline-flex items-center gap-1.5"><Pencil size={12} className="text-brand" />Forecaster can edit</span>
        <span className="inline-flex items-center gap-1.5"><Lock size={12} className="text-text-3" />Set by CoE</span>
        <span className="inline-flex items-center gap-1.5"><Sigma size={12} className="text-text-3" />Calculated</span>
      </div>
      <div className="grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_260px]">
        <ol className="space-y-0" aria-label={`Forecaster funnel for ${ind.name || 'this stream'}`}>
          {nodes.map((n, k) => n.kind === 'vol' ? (
            <li key={k}>
              <button type="button" onClick={() => go(n.stage)} title={`Edit ${STAGES[n.stage - 1].title}`} className="group grid w-full grid-cols-[minmax(130px,190px)_minmax(0,1fr)_84px] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-2">
                <span className="min-w-0"><span className="flex items-center gap-1.5 text-[13px] font-semibold">{n.tag === 'data' ? <Database size={12} className="shrink-0 text-text-3" /> : <Sigma size={12} className="shrink-0 text-text-3" />}<span className="truncate">{n.label}</span></span>
                  <span className="block truncate text-[11px] text-text-3">{n.note ?? n.src}</span></span>
                {n.masked
                  ? <span className="flex h-6 items-center rounded border border-dashed border-border-strong px-2 text-[11px] text-text-3">Filled by the forecaster</span>
                  : <span className="relative h-6 overflow-hidden rounded bg-surface-2"><span className={cx('absolute inset-y-0 left-0 rounded', n.tag === 'output' ? 'bg-brand' : n.unit === '$' ? 'bg-brand/45' : 'bg-brand/25')} style={{ width: `${width(n)}%` }} /></span>}
                <span className={cx('text-right font-mono text-[13px]', n.tag === 'output' && 'font-semibold text-brand', n.masked && 'text-text-3')}>{n.masked ? '—' : fmtFunnel(n.value, n.unit)}</span>
              </button>
            </li>
          ) : (() => {
            const p = n.perm ? ind.perms[n.perm] : undefined, open = !!p?.open
            return (
              <li key={k} className="ml-[18px] border-l-2 border-dashed border-border-strong py-0.5 pl-4">
                <button type="button" onClick={() => go(n.stage)} className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1 text-left text-[12px] hover:bg-surface-2">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono font-semibold text-text">{n.disp.startsWith('×') || n.disp.startsWith('÷') || n.disp.startsWith('−') || n.disp.startsWith('+') ? n.disp : `× ${n.disp}`}</span>
                  <span className="font-medium text-text">{n.label}</span>
                  {open ? <span className="inline-flex items-center gap-1 text-brand"><Pencil size={11} />Forecaster edits{p ? ` · ${p.min}–${p.max}` : ''}</span> : <span className="inline-flex items-center gap-1 text-text-3"><Lock size={11} />{p ? 'Locked' : 'Module default'}</span>}
                  <span className="text-text-3">· {n.module}{n.note ? ` · ${n.note}` : ''}</span>
                </button>
              </li>
            )
          })())}
        </ol>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Does the logic hold?</p>
          <ul className="space-y-2">{checks.map((c, k) => (
            <li key={k} className="flex gap-2 rounded-md border border-border px-3 py-2 text-[12.5px]">
              {c.tone === 'ok' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" /> : c.tone === 'warn' ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" /> : <Info size={14} className="mt-0.5 shrink-0 text-text-3" />}
              <span className="min-w-0 flex-1">{c.msg}</span>
              {c.tone !== 'ok' && <EditLink stage={c.stage} go={go} />}
            </li>
          ))}</ul>
          <p className="text-[11.5px] text-text-3">Starting values are illustrative, from input defaults and module benchmarks. Only limited data is connected at configuration, so upstream patient pools are left for the forecaster to fill after you finalise.</p>
        </div>
      </div>
    </div>
  )
}

function EditLink({ stage, go }: { stage: number; go: (n: number) => void }) {
  return <button type="button" onClick={() => go(stage)} className="shrink-0 text-xs font-semibold text-brand hover:underline">Edit<span className="sr-only"> {STAGES[stage - 1].title}</span></button>
}

function StagePreview({ c, ind, go, issues, warns, fix }: Ctx & { issues: Issue[][]; warns: { msg: string; stage: number }[] }) {
  const errs = STAGES.slice(0, REVIEW - 1).flatMap(s => issues[s.id - 1].map(i => ({ ...i, stage: s.id })))
  const ins = inputsFor(c)
  const done = ins.filter(b => dataReady(c.bindings[b.key])).length
  const all = [...errs.map(e => ({ ...e, tone: 'err' as const })), ...warns.map(w => ({ ...w, tone: 'warn' as const }))]
  const [code, setCode] = useState(false)
  return (
    <>
      <Card title={`Forecaster flow · ${ind.name || 'Stream'}`} sub="The funnel the forecaster will work in. Select a step to change it."
        right={<ChartActions target="export-forecaster-flow" title={`Forecaster flow · ${ind.name || 'Stream'}`} subtitle={c.brand} />}>
        <div id="export-forecaster-flow" className="bg-surface"><ForecasterFlow ind={ind} go={go} /></div>
      </Card>

      <Card title="Configuration flow" sub="Select any step to change it." right={<ChartActions target="export-config-flow" title="Configuration flow" subtitle={c.brand} />}>
        <div id="export-config-flow" className="bg-surface"><ModelFlow {...cfgFlow(c)} go={go} /></div>
      </Card>

      <Card title="Configuration check" sub={errs.length ? `${errs.length} blocking · ${warns.length} to review` : warns.length ? `Valid · ${warns.length} to review` : 'Valid. Nothing to review.'}
        right={errs.length ? <div className="flex items-center gap-2"><Badge tone="err">Not ready to finalise</Badge><FixForMe onClick={() => fix(STAGES.slice(0, REVIEW - 1).map(s => s.id))} /></div> : <Badge tone="ok"><Check size={10} />Ready to finalise</Badge>}>
        {errs.length + warns.length === 0 ? <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 size={16} />Every step checks out.</p> : (
          <ul className="divide-y divide-border">
            {all.map((x, k) => (
              <li key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px] first:pt-0 last:pb-0">
                {x.tone === 'err' ? <AlertCircle size={16} className="shrink-0 text-err" /> : <AlertTriangle size={16} className="shrink-0 text-warn" />}
                <span className="min-w-[180px] flex-1">{x.msg}</span>
                <span className="text-xs text-text-3">{STAGES[x.stage - 1].short}</span>
                <Btn size="sm" variant="secondary" onClick={() => go(x.stage)}>{x.tone === 'err' ? 'Fix' : 'Review'}</Btn>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Configuration summary" sub="Generated from your selections. Edit jumps back to the section.">
        <dl className="grid gap-x-6 gap-y-3 text-[13px] @xl:grid-cols-2">
          {[['Model', `${c.brand} · ${c.asset}`, 1], ['Asset type · therapy area', `${c.subjectType} · ${c.therapyArea}`, 1], ['Lifecycle stage', c.lifecycle, 1],
            ['Data configuration', PATHWAYS.map(pw => `${ins.filter(x => pathOf(c.bindings[x.key]) === pw.id).length} ${pw.label.toLowerCase()}`).join(' · '), 5],
            ['Required inputs', `${ins.filter(x => pathOf(c.bindings[x.key]) !== 'Manual').length} from sources`, 5],
            ['Forecaster-visible fields', `${ins.filter(x => exposeOf(c.bindings[x.key]) === 'Editable').length} editable · ${ins.filter(x => exposeOf(c.bindings[x.key]) === 'Visible').length} read-only`, 5]].map(([k, v, st]) => (
            <div key={k as string} className="flex items-start justify-between gap-3 border-b border-border pb-2"><div className="min-w-0"><dt className="text-xs text-text-3">{k}</dt><dd className="font-medium">{v}</dd></div><EditLink stage={st as number} go={go} /></div>
          ))}
        </dl>
        <div className="mt-4 space-y-3">
          {c.inds.map(i => (
            <div key={i.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold">{i.name || 'Untitled stream'} <span className="font-normal text-text-2">· {archName(i.arch) || 'No archetype'}</span></p>
              <div className="mt-2 grid gap-2 text-[12px] @xl:grid-cols-3">
                <div className="flex justify-between gap-2"><span className="min-w-0"><span className="block text-text-3">Modes</span>{i.arch ? modesFor(i.arch).map(m => i.modes[m.id]).filter(Boolean).join(' · ') : '—'}</span><EditLink stage={3} go={go} /></div>
                <div className="flex justify-between gap-2"><span><span className="block text-text-3">Modules</span>{orderedModules(i).length} attached · {requiredFor(i.arch).length} core</span><EditLink stage={4} go={go} /></div>
                <div className="flex justify-between gap-2"><span><span className="block text-text-3">Forecaster inputs</span>{Object.values(i.perms).filter(p => p.open).length} editable · {Object.values(i.perms).filter(p => !p.open).length} locked</span><EditLink stage={5} go={go} /></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Module map · ${ind.name || 'Stream'}`} sub="Structure and calculation order for this stream." right={<div className="flex items-center gap-3"><EditLink stage={4} go={go} /><ChartActions target="export-module-map" title={`Module map · ${ind.name || 'Stream'}`} subtitle={c.brand} /></div>}>
        <div id="export-module-map" className="@container bg-surface"><ModuleLanes c={c} ind={ind} readOnly go={go} /></div>
      </Card>

      <Card title="Configuration document" sub="What is saved as a version when you finalise.">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 ">
              <p className="min-w-[220px] flex-1 text-[13px] text-text-2">Finalising saves {c.version} as a configuration document.</p>
              <Btn variant="secondary" size="sm" onClick={() => setCode(v => !v)}>{code ? 'Hide configuration' : 'View configuration as code'}</Btn>
            </div>
            {code && <pre className="max-h-80 overflow-auto rounded-md bg-text p-4 text-[12px] text-white">{JSON.stringify({ model: c.brand, asset: c.asset, version: c.version, streams: c.inds.map(i => ({ name: i.name, parent: c.inds.find(x => x.id === i.parent)?.name, archetype: i.arch, engine: i.engine, modes: i.modes, modules: i.modules.map(id => MODULES.find(m => m.id === id)?.name) })), inputs: ins.map(b => ({ input: b.input.name, pathway: pathOf(c.bindings[b.key]), forecaster: exposeOf(c.bindings[b.key]) })) }, null, 2)}</pre>}
          </div>
      </Card>
    </>
  )
}

/* ───────────────────────── Step 7 · Finalise setup ───────────────────────── */

const sigOf = (c: Config) => JSON.stringify({ ...c, log: undefined })

function StagePublish({ c, go, update, notify, issues, warns, errs, finalSig, onFinalise, onPublish, onAttempt }: Ctx & {
  issues: Issue[][]; warns: { msg: string; stage: number }[]; errs: Issue[]; finalSig: string | null; onFinalise: () => void; onPublish: () => void; onAttempt: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState(false)
  const blocking = STAGES.slice(0, LAST - 1).filter(s => issues[s.id - 1].length)
  const ready = blocking.length === 0 && issues[LAST - 1].length === 0
  const ins = inputsFor(c)
  const assignees = [...(c.selfForecast ? [`${ME} (you)`] : []), ...c.forecasters]
  const editable = ins.filter(b => exposeOf(c.bindings[b.key]) === 'Editable')
  const visible = ins.filter(b => exposeOf(c.bindings[b.key]) === 'Visible')
  const done = ins.filter(b => dataReady(c.bindings[b.key])).length
  const finalised = finalSig === sigOf(c)
  const changed = !!finalSig && !finalised

  // Finalising validates and saves the version; only the separate "make available" action hands it to forecasters.
  const finalise = () => {
    setBusy(true); setFail(false)
    setTimeout(() => {
      setBusy(false)
      if (c.notes.toLowerCase().includes('fail')) { setFail(true); setConfirm(false); return }
      setConfirm(false)
      onFinalise()
    }, 1300)
  }

  return (
    <>
      {changed && <Banner tone="warn" title="The configuration changed after you finalised">Finalise again to save these changes as part of {c.version}.</Banner>}
      {finalised && <Banner tone="ok" title={`${c.version} is finalised`}>Saved as a version. Forecasters don’t see it until you make it available.</Banner>}
      {fail && <Banner tone="err" title="Finalisation didn’t complete — nothing was made available" action={<Btn size="sm" variant="secondary" onClick={() => setConfirm(true)}>Try again</Btn>}>Validation couldn’t be completed. Your configuration is saved as a draft.</Banner>}

      <Card title="Configuration check" sub={blocking.length ? `${blocking.length} section${blocking.length > 1 ? 's' : ''} need attention.` : 'Every required section is complete.'}>
        <ul className="grid gap-x-6 @2xl:grid-cols-2">
          {STAGES.slice(0, LAST - 1).map(s => {
            const iss = issues[s.id - 1]
            return (
              <li key={s.id} className="flex items-center gap-3 border-b border-border py-2.5">
                {iss.length ? <AlertCircle size={18} className="shrink-0 text-err" /> : <CheckCircle2 size={18} className="shrink-0 text-ok" />}
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{s.title}</p><p className={cx('text-xs', iss.length ? 'text-err' : 'text-text-2')}>{iss.length ? iss[0].msg : 'Complete'}</p></div>
                {iss.length > 0 && <Btn variant="secondary" size="sm" onClick={() => go(s.id)}>Fix</Btn>}
              </li>
            )
          })}
        </ul>
        {warns.length > 0 && <p className="mt-3 text-xs text-text-3">{warns.length} item{warns.length > 1 ? 's' : ''} to review on the Review configuration step. They don’t block finalising.</p>}
      </Card>

      <Card title="What becomes available to the Forecaster" sub="The structure forecasters work in.">
        <div className="grid gap-5 @2xl:grid-cols-3">
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-text-2">Model structure</p>
            <ul className="mt-2 space-y-1.5 text-[13px]">{c.inds.map(i => <li key={i.id}><span className="font-medium">{i.name || 'Untitled stream'}</span><span className="block text-xs text-text-3">{archName(i.arch)} · {Array.from(new Set([...i.modules, ...requiredFor(i.arch)])).length} modules</span></li>)}</ul></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-text-2">Editable inputs <span className="font-mono text-text-3">{editable.length}</span></p>
            <ul className="mt-2 space-y-1 text-[13px] text-text-2">{editable.length ? editable.map(b => <li key={b.key} className="flex gap-1.5"><LockOpen size={13} className="mt-0.5 shrink-0 text-brand" />{b.input.name}</li>) : <li className="text-text-3">None</li>}</ul></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-text-2">Read-only inputs <span className="font-mono text-text-3">{visible.length}</span></p>
            <ul className="mt-2 space-y-1 text-[13px] text-text-2">{visible.length ? visible.map(b => <li key={b.key} className="flex gap-1.5"><Lock size={13} className="mt-0.5 shrink-0 text-text-3" />{b.input.name}</li>) : <li className="text-text-3">None</li>}</ul></div>
        </div>
        {ins.length > done && <p className="mt-4 flex items-start gap-2 text-xs text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{ins.length - done} file-based input{ins.length - done > 1 ? 's have' : ' has'} no mapped field yet. <button type="button" className="font-semibold text-brand hover:underline" onClick={() => go(5)}>Configure</button></p>}
      </Card>

      <Card title="Who can use it" sub="Access is set per model.">
        <label className={cx('mb-4 flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors', c.selfForecast ? 'border-brand bg-brand-soft/40' : 'border-border hover:border-border-strong')}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={c.selfForecast} onChange={e => update({ selfForecast: e.target.checked })} />
          <span className="min-w-0"><span className="block text-sm font-semibold">I will also forecast in this model</span><span className="block text-xs text-text-2">It appears in your Forecaster workspace after finalisation.</span></span>
        </label>
        <Field label="Forecasters" required={!c.selfForecast} error={errs.find(e => e.field === 'forecasters')?.msg} hint="They see this model in their workspace only after finalisation.">
          <div className="flex flex-wrap gap-2">
            {FORECASTERS.map(f => {
              const on = c.forecasters.includes(f)
              return (
                <button type="button" key={f} aria-pressed={on} onClick={() => update({ forecasters: on ? c.forecasters.filter(x => x !== f) : [...c.forecasters, f] })}
                  className={cx('inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] transition-colors', on ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong hover:border-text')}>
                  <span className={cx('grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold', on ? 'bg-brand text-white' : 'bg-surface-2 text-text-2')}>{on ? <Check size={12} /> : f.split(' ').map(x => x[0]).join('')}</span>{f}
                </button>
              )
            })}
          </div>
        </Field>
      </Card>

      <Card title="Version">
        <dl className="mb-4 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt className="text-text-2">Version saved</dt><dd className="font-mono font-medium">{c.version}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-text-2">Configured by</dt><dd className="font-medium">{ME}</dd></div>
        </dl>
        <Field label="Version notes" hint={`Optional. Shown in the version history. (Type “fail” to preview the error state.)`}>
          <textarea rows={3} value={c.notes} onChange={e => update({ notes: e.target.value })} placeholder="e.g. Added persistency grids to the 2L stream." className={cx(inputCls(), 'h-auto py-2')} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Btn variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => go(LAST - 1)}>Back</Btn>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Btn variant="secondary" onClick={() => notify({ tone: 'ok', text: `${c.brand || 'Draft'} ${c.version} saved as draft` })}>Save draft</Btn>
          {!ready && <span className="text-xs text-text-3">{blocking.length ? 'Fix the sections above to finalise' : 'Add a forecaster to finalise'}</span>}
          {finalised
            ? <Btn onClick={onPublish} icon={<Send size={16} />}>Make available to Forecaster</Btn>
            : <Btn onClick={() => { onAttempt(); if (ready) setConfirm(true) }} icon={<Lock size={16} />}>Finalise setup</Btn>}
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pub-title" onKeyDown={e => e.key === 'Escape' && !busy && setConfirm(false)}>
          <div className="rise max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
            <h2 id="pub-title" className="text-lg font-semibold">Finalise {c.brand} {c.version}?</h2>
            <p className="mt-2 text-sm text-text-2">The configuration is validated and saved as {c.version}. Forecasters don’t see it until you then make it available. Later changes start a new version.</p>
            <dl className="mt-4 space-y-1.5 rounded-md bg-background p-3 text-[13px]">
              {c.inds.map(i => <div key={i.id} className="flex justify-between gap-3"><dt className="text-text-2">{i.name}</dt><dd className="text-right font-medium">{archName(i.arch)} · {i.engine}</dd></div>)}
              <div className="flex justify-between gap-3"><dt className="text-text-2">Inputs</dt><dd className="text-right font-medium">{editable.length} editable · {visible.length} read-only</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-2">Available to</dt><dd className="text-right font-medium">{assignees.join(', ')}</dd></div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Btn>
              <Btn disabled={busy} onClick={finalise} icon={busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}>{busy ? 'Validating…' : `Finalise and save ${c.version}`}</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PublishedScreen({ c, when, onExit }: { c: Config; when: string; onExit: () => void }) {
  const who = [...(c.selfForecast ? ['You'] : []), ...c.forecasters]
  return (
    <main className="rise mx-auto w-full max-w-[720px] px-6 py-16">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 size={26} /></span>
      <div className="mt-5 flex flex-wrap items-center gap-2"><Badge tone="ok"><Check size={10} />Finalised</Badge><Badge tone="brand"><Users size={10} />Available to Forecaster</Badge></div>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">{c.brand} {c.version} is available to forecasters</h1>
      <p className="mt-1 text-text-2">{who.join(', ')} can now open it in the Forecaster workspace.</p>
      <Card title="Version record" className="mt-8">
        <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
          {[['Version', c.version], ['Finalised', `${when} by ${ME}`], ...c.inds.map(i => [i.name, `${archName(i.arch)} · ${i.engine}`])].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border py-1.5"><dt className="text-text-2">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
      </Card>
      <Card title="Next" className="mt-6">
        <ul className="space-y-2 text-sm text-text-2">
          <li className="flex gap-2"><ArrowRight size={15} className="mt-0.5 shrink-0 text-brand" />Forecasters enter assumptions, build the baseline and scenarios in their own flow.</li>
          <li className="flex gap-2"><GitBranch size={15} className="mt-0.5 shrink-0 text-brand" />To change the structure, start a {nextVersion(c.version)} draft from Versions in your workspace.</li>
        </ul>
      </Card>
      <Btn className="mt-8" icon={<ArrowLeft size={16} />} onClick={onExit}>Back to workspace</Btn>
    </main>
  )
}


/* ───────────────────────── Profile menu & admin access control ───────────────────────── */

function ProfileMenu({ onAdmin, onLogout, placement }: { onAdmin: () => void; onLogout: () => void; placement?: 'rail' }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button data-tour="profile" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)} title={`${ME} · Super Admin`}
        className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white outline-none', placement === 'rail' ? 'bg-brand-dark ring-1 ring-black/5 focus-visible:ring-2 focus-visible:ring-brand' : 'bg-brand-dark ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand')}>JA</button>
      {open && (
        <div role="menu" className={cx('rise absolute z-[60] w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-xl', placement === 'rail' ? 'bottom-0 left-12' : 'right-0 top-11')}>
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{ME}</p>
            <p className="text-xs text-text-2">j.andersen@pfizer.com</p>
            <div className="mt-2 flex gap-1"><Badge tone="brand">Super Admin</Badge><Badge>CoE Configurator</Badge></div>
          </div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onAdmin() }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2"><ShieldCheck size={16} className="text-text-2" /><span><span className="block font-medium">Admin portal</span><span className="block text-xs text-text-3">Users, roles and access</span></span></button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout() }} className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-sm hover:bg-surface-2"><LogOut size={16} className="text-text-2" />Log out</button>
        </div>
      )}
    </div>
  )
}

/*
 * Patient-flow inputs of the configurator: the same inputs the Forecaster's patient flow uses (prevalence → diagnosis →
 * treatment → access → share → prescriptions per patient → gross price, then the revenue-bridge modules), and where each one
 * is read from in Snowflake. Sources are taken from vyndamax_forecasting_actuals.sql (the validated actuals query).
 * The 13 standard inputs make up the patient flow every model starts from; the rest are optional modules the CoE can add.
 * The Data sources step only displays this catalogue: nothing here is chosen by the user.
 */

export type SfSource = {
  db: string; schema: string; table: string
  /** Columns read from the table. */
  columns: string[]
  /** Row filter applied when the input is read. */
  filter?: string
  /** What the SQL does with it (offsets, derivations). */
  note?: string
}
export type InputGroup = 'Epi funnel' | 'Demand & share' | 'Price & revenue' | 'Revenue bridge'
export type FlowInput = {
  id: string; name: string; group: InputGroup
  /** Short description of the input as the forecaster sees it. */
  desc: string
  /** The group class (module-map lane) the input lands in unless the CoE drags it elsewhere. */
  lane: string
  /** The forecaster driver it feeds, when it is one of the model inputs. */
  driver?: string
  /** True when the platform derives it (no table of its own). */
  calc?: boolean
  /** Optional module: not part of the standard patient flow that "Add the patient flow" places. */
  optional?: boolean
  /** Shown in Data sources when the input has no table yet. */
  note?: string
  sources: SfSource[]
}

const BLAZE_DB = 'VAW_AMER_DESIGN', BLAZE_SCHEMA = 'FORECASTING_DATA_ECOSYSTEM'
const BLAZE = 'FORECASTING_DATA_ECOSYSTEM_FORECASTING_METRICS_ACTUALS_BLAZE_FORECAST'
const VYNDA_SCHEMA = 'VYNDA_DATA_ECOSYSTEM'
const blaze = (metric: string, note?: string, extra = ''): SfSource => ({
  db: BLAZE_DB, schema: BLAZE_SCHEMA, table: BLAZE,
  columns: ['METRIC', 'SOURCE', 'SKU', 'ADDITIONAL_SUB_METRIC', 'NOV-24 … DEC-25'], filter: `BRAND = 'VYNDAMAX' AND METRIC = '${metric}'${extra}`, note,
})
const BUDGET: Omit<SfSource, 'columns'> = { db: 'COMM_US_CAE_DEV_DB', schema: 'CAE_US_SNDBX', table: 'L1_VYNDAMAX_PFE_MGT_LE_BUDGET_DIM_MM', filter: 'YEAR = 2025' }
const CLASS_SHARE: SfSource = { db: BLAZE_DB, schema: BLAZE_SCHEMA, table: 'VYNDAMAX_FCT_1L_MARKETSHARE_CDS', columns: ['MONTH', 'BRAND', 'BENE_CNT'], filter: 'MONTH between 2025-01-01 and 2025-12-01', note: 'Class share = class beneficiaries ÷ all first-line beneficiaries' }
const UNMAPPED = 'Input field. The platform team maps its source table; until then the forecaster enters it in the workspace.'
const LANE = { pop: 'Population & top-of-funnel', seg: 'Segmentation & structure', share: 'Share machinery', pers: 'Persistence, dosing & regimen', act: 'Actuals, calibration & reconciliation', fin: 'Conversion, financial & integration' }
/** An optional module of the patient flow. Without a table or a calculation it is entered by the forecaster. */
const extra = (group: InputGroup, id: string, name: string, lane: string, desc: string, o: { calc?: boolean; sources?: SfSource[] } = {}): FlowInput =>
  ({ id, name, group, lane, desc, optional: true, calc: o.calc, sources: o.sources ?? [], note: o.calc || o.sources?.length ? undefined : UNMAPPED })

export const GROUP_ORDER: InputGroup[] = ['Epi funnel', 'Demand & share', 'Price & revenue', 'Revenue bridge']

export const FLOW_INPUTS: FlowInput[] = [
  { id: 'prev', name: 'Prevalent patients', group: 'Epi funnel', driver: 'prev', lane: 'Population & top-of-funnel', desc: 'Patients living with the condition (also called addressable patients): the top of the patient funnel.',
    sources: [{ ...BUDGET, columns: ['AP #', 'PATIENT_PREVALENCE_LE'], note: 'Budget / LE (LE4), by accounting period' }] },
  { id: 'diag', name: 'Diagnosis rate', group: 'Epi funnel', driver: 'diag', lane: 'Population & top-of-funnel', desc: 'New diagnoses each month (and the weekly average) that turn prevalent patients into diagnosed ones.',
    sources: [{ db: BLAZE_DB, schema: VYNDA_SCHEMA, table: 'VYNDA_DATA_ECOSYSTEM_PRP_SNC_DX_RATE_SOURCE', columns: ['MONTHLY - NEW DIAGNOSED ATTR-CM PATIENTS (#)', 'WEEKLY AVERAGE NEW DX', 'END OF ACCOUNTING MONTH'], filter: 'END OF ACCOUNTING MONTH between 2025-01-01 and 2025-12-01', note: '+1 period offset (DX Rate source)' },
      blaze('NEW_DIAGNOSED_PTS', 'New diagnosed (eLAAD), no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'")] },
  { id: 'treat', name: 'Treatment rate', group: 'Epi funnel', driver: 'treat', lane: 'Population & top-of-funnel', desc: 'Share of diagnosed patients on a disease-modifying treatment.',
    sources: [{ ...BUDGET, columns: ['AP #', 'DX_RATE_LE'], note: 'Read as the DMT treatment rate, as in the actuals query' }] },
  { id: 'access', name: 'Access', group: 'Epi funnel', driver: 'access', lane: 'Segmentation & structure', desc: 'Treated patients who can start the brand once affordability and coverage are applied.',
    sources: [{ ...BUDGET, columns: ['AP #', 'AFFORDABILITY_RATE_LE'], note: 'Access / affordability rate' }] },
  extra('Demand & share', 'classshare', 'Class share', LANE.share, 'Share of prevalent patients treated with the drug class.', { sources: [CLASS_SHARE] }),
  extra('Demand & share', 'classpts', 'Class patients', LANE.share, 'Prevalent patients × class share. Calculated, so read-only everywhere.', { calc: true }),
  { id: 'share', name: 'Brand share', group: 'Demand & share', driver: 'share', lane: 'Share machinery', desc: 'Brand share of first-line patients, plus the new starts that build it.',
    sources: [
      { db: BLAZE_DB, schema: BLAZE_SCHEMA, table: 'VYNDAMAX_FCT_1L_MARKETSHARE_CDS', columns: ['MONTH', 'BRAND', 'BENE_CNT'], filter: 'MONTH between 2025-01-01 and 2025-12-01', note: 'Share = brand beneficiaries ÷ all first-line beneficiaries' },
      { db: BLAZE_DB, schema: VYNDA_SCHEMA, table: 'VYNDA_DATA_ECOSYSTEM_PRP_SNC_AOI_LE_WEEKLY_DATA', columns: ['AP', 'NPS', 'WRITTEN'], filter: "AP LIKE '%2025%'", note: 'New patient starts and new written, +1 period offset' }] },
  extra('Demand & share', 'brandpts', 'Brand patients', LANE.share, 'Class patients × brand share within the class. Calculated.', { calc: true }),
  { id: 'rx', name: 'Prescriptions per patient', group: 'Demand & share', driver: 'rx', lane: 'Persistence, dosing & regimen', desc: 'TRx filled per active patient each month. Total prescriptions (TRx) = patients on brand × this.',
    sources: [blaze('WITHDRAWAL', 'TRx (EDI867), no offset', " AND SOURCE = 'EDI867'"), blaze('ACTIVE_PATIENTS', 'Active patients, the denominator', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"),
      { ...BUDGET, columns: ['AP #', 'COMPLIANCE_RATE_LE'], note: 'Compliance rate (28 days)' }] },
  extra('Demand & share', 'trxpre', 'Prescriptions before compliance', LANE.pers, 'Brand patients × prescriptions per patient. Calculated.', { calc: true }),
  extra('Demand & share', 'compliance', 'Compliance rate', LANE.pers, 'Share of the prescribed fills actually taken up (28 days).', { sources: [{ ...BUDGET, columns: ['AP #', 'COMPLIANCE_RATE_LE'], note: 'Compliance rate (28 days)' }] }),
  extra('Demand & share', 'trxtotal', 'Total prescriptions', LANE.fin, 'Prescriptions before compliance × compliance rate. Calculated.', { calc: true }),
  { id: 'erosion', name: 'Erosion & restarts', group: 'Demand & share', lane: 'Persistence, dosing & regimen', desc: 'Natural and competitive erosion of the active base and the patients who restart.',
    sources: [blaze('BASE_EROSION', 'Natural erosion, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"), blaze('COMPETITIVE_EROSION', 'Competitive erosion, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"),
      { db: BLAZE_DB, schema: VYNDA_SCHEMA, table: 'VYNDA_DATA_ECOSYSTEM_PRP_SCN_SPP_COMPETITIVE_EROSION', columns: ['THERAPY_MONTHS', '"SUM(RESTARTS)"'], filter: 'YEAR(THERAPY_MONTHS) = 2025', note: 'Restarts, summed by month' }] },
  extra('Price & revenue', 'packshare', 'Pack share, {sku}', LANE.seg, 'Share of prescriptions written on each pack (SKU).'),
  extra('Price & revenue', 'trxsku', 'Prescriptions, {sku}', LANE.fin, 'Total prescriptions × pack share, by SKU. Calculated.', { calc: true }),
  extra('Price & revenue', 'unitsperrx', 'Units per prescription', LANE.fin, 'Units dispensed on one prescription.'),
  extra('Price & revenue', 'unitssku', 'Units, {sku}', LANE.fin, 'Prescriptions × units per prescription, by SKU. Calculated.', { calc: true }),
  extra('Price & revenue', 'priceunit', 'Price per unit, {sku}', LANE.fin, 'List price of one unit, by SKU.', { sources: [blaze('GROSS_PRICE_SKU', 'Price proxy, no offset', " AND SKU LIKE '%61mg%'")] }),
  { id: 'price', name: 'Weighted gross price', group: 'Price & revenue', driver: 'price', lane: 'Conversion, financial & integration', desc: 'Pack-weighted list price per pack. Net price is calculated from it, never forecast.',
    sources: [blaze('GROSS_PRICE_SKU', 'Price proxy, no offset', " AND SKU LIKE '%61mg%'")] },
  extra('Price & revenue', 'audsku', 'Audited demand, {sku}', LANE.fin, 'Units × price per unit, by SKU. Calculated.', { calc: true }),
  extra('Price & revenue', 'audtotal', 'Total audited demand', LANE.fin, 'Audited demand summed across SKUs. Calculated.', { calc: true }),
  { id: 'sales', name: 'Gross and net sales', group: 'Price & revenue', lane: 'Actuals, calibration & reconciliation', desc: 'Booked gross and net sales: the actuals every forecast is anchored to, and the basis of gross-to-net.',
    sources: [blaze('GROSS_SALES', 'Gross sales, no offset', " AND SKU = 'TOTAL'"), blaze('NET_SALES', 'Net sales, no offset; GTN = net ÷ gross', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'")] },
  extra('Revenue bridge', 'unaudrate', 'Unaudited demand rate', LANE.act, 'Demand outside the audit, as a % of audited demand.'),
  extra('Revenue bridge', 'unaud', 'Unaudited demand', LANE.act, 'Total audited demand × unaudited demand rate. Calculated.', { calc: true }),
  { id: 'tud', name: 'Total underlying demand', group: 'Revenue bridge', lane: 'Conversion, financial & integration', calc: true, desc: 'Demand dollars from the patient funnel. Calculated, so read-only everywhere.',
    sources: [] },
  extra('Revenue bridge', 'caldays', 'Calendar days', LANE.act, 'Calendar days in the month.'),
  extra('Revenue bridge', 'dayskept', 'Days kept (4-4-5)', LANE.act, 'Days the 4-4-5 reporting calendar keeps in the month.'),
  extra('Revenue bridge', 'carry', 'Prior-month carry', LANE.act, 'Demand carried between months when the calendars differ. Calculated.', { calc: true }),
  extra('Revenue bridge', 'caladj', 'Calendar-adjusted demand', LANE.act, 'Underlying demand restated on the 4-4-5 calendar. Calculated.', { calc: true }),
  { id: 'inv', name: 'Change in inventory', group: 'Revenue bridge', lane: 'Conversion, financial & integration', desc: 'Month-over-month change in wholesaler inventory; target weeks on hand drives the forecast.',
    sources: [blaze('SHIPMENTS', 'Ex-factory shipments, +1 offset', " AND SKU = 'TOTAL'"), blaze('LAUNCH_TO_DATE_OH', 'LTD additional inventory, +1 offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"),
      blaze('ON_HAND_WAC_C', 'Weeks on hand numerator, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"), blaze('WITHDRAWAL_WAC_C', 'Weeks on hand denominator, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'")] },
  extra('Revenue bridge', 'grosspre', 'Gross revenue before unexplained difference', LANE.fin, 'Calendar-adjusted demand plus inventory change. Calculated.', { calc: true }),
  { id: 'ue', name: 'Unexplained difference', group: 'Revenue bridge', lane: 'Actuals, calibration & reconciliation', calc: true, desc: 'Gross less underlying demand less inventory change, as a % of gross by month.',
    sources: [] },
  extra('Price & revenue', 'pricekept', 'Price kept after gross-to-net', LANE.fin, 'Share of the list price the brand keeps after gross-to-net. Calculated from Gross and net sales.', { calc: true }),
  { id: 'fx', name: 'Exchange rates', group: 'Revenue bridge', lane: 'Conversion, financial & integration', calc: true, desc: 'Local currency to USD. 1.00 for a US-only model; the Finance rate feed is added for ex-US models.',
    sources: [] },
]
export const INPUT_BY_ID = Object.fromEntries(FLOW_INPUTS.map(i => [i.id, i])) as Record<string, FlowInput>

/* A stream's patient flow: which inputs sit on the canvas (input id → its group class; '' = in the library) and their order. */
export type InputMap = Record<string, string>
const ORDER = '__order'
export const STANDARD = FLOW_INPUTS.filter(i => !i.optional)
/** Every input with its class, '' for the ones still in the library, keeping the saved order. */
export const canvasMap = (saved?: InputMap): InputMap => ({
  ...Object.fromEntries(FLOW_INPUTS.map(i => [i.id, saved && i.id in saved ? saved[i.id]! : ''])),
  ...(saved?.[ORDER] ? { [ORDER]: saved[ORDER] } : {}),
})
const inOrder = (saved?: InputMap): FlowInput[] => {
  const o = (saved?.[ORDER] ?? '').split(',').filter(id => INPUT_BY_ID[id])
  return [...o, ...FLOW_INPUTS.map(i => i.id).filter(id => !o.includes(id))].map(id => INPUT_BY_ID[id]!)
}
/** The inputs on the canvas, first step to last. */
export const onCanvas = (saved?: InputMap) => { const m = canvasMap(saved); return inOrder(saved).filter(i => m[i.id]) }
/** Places the standard patient flow; inputs already on the canvas keep their class. */
export const withPatientFlow = (saved?: InputMap): InputMap => {
  const m = canvasMap(saved)
  return { ...m, ...Object.fromEntries(FLOW_INPUTS.map(i => [i.id, m[i.id] || (i.optional ? '' : i.lane)])) }
}
/** Moves one canvas input up (-1) or down (+1) among the inputs on the canvas. */
export const moveInput = (saved: InputMap | undefined, id: string, d: number): InputMap => {
  const m = canvasMap(saved), on = onCanvas(saved).map(i => i.id), k = on.indexOf(id), j = k + d
  if (k < 0 || j < 0 || j >= on.length) return m
  ;[on[k], on[j]] = [on[j]!, on[k]!]
  const all = inOrder(saved).map(i => i.id)
  all.flatMap((x, n) => (on.includes(x) ? [n] : [])).forEach((n, q) => { all[n] = on[q]! })
  return { ...m, [ORDER]: all.join(',') }
}
/** The patient flow as rows for the review: class and how many Snowflake tables feed each input. */
export const flowRows = (saved?: InputMap) => { const m = canvasMap(saved); return onCanvas(saved).map(i => ({ ...i, lane: m[i.id]!, tables: i.sources.length })) }
export const fqn = (s: SfSource) => `${s.db}.${s.schema}.${s.table}`

// Self-check: the standard flow is the 13 non-optional inputs, and moving keeps every input on the canvas.
if (import.meta.env.DEV) {
  const m = withPatientFlow()
  console.assert(FLOW_INPUTS.length === 34 && onCanvas(m).length === STANDARD.length && STANDARD.length === 13, 'catalogue: 34 inputs, 13 in the standard flow')
  const up = onCanvas(moveInput(m, 'diag', -1)).map(i => i.id)
  console.assert(up[0] === 'diag' && up[1] === 'prev' && up.length === 13, 'catalogue: move up swaps with the input above')
  console.assert(onCanvas(canvasMap({})).length === 0 && onCanvas(withPatientFlow(m)).length === 13, 'catalogue: empty map is empty, adding twice adds nothing')
}

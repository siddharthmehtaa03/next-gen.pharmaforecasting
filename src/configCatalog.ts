/*
 * Patient-flow inputs of the configurator: the same inputs the Forecaster's patient flow uses (prevalence → diagnosis →
 * treatment → access → share → prescriptions per patient → gross price, then the revenue-bridge modules), and where each one
 * is read from in Snowflake. Sources are taken from vyndamax_forecasting_actuals.sql (the validated actuals query).
 * The Data configuration step only displays this catalogue: nothing here is chosen by the user.
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

export const GROUP_ORDER: InputGroup[] = ['Epi funnel', 'Demand & share', 'Price & revenue', 'Revenue bridge']

export const FLOW_INPUTS: FlowInput[] = [
  { id: 'prev', name: 'Prevalent patients', group: 'Epi funnel', driver: 'prev', lane: 'Population & top-of-funnel', desc: 'Patients living with the condition: the top of the patient funnel.',
    sources: [{ ...BUDGET, columns: ['AP #', 'PATIENT_PREVALENCE_LE'], note: 'Budget / LE (LE4), by accounting period' }] },
  { id: 'diag', name: 'Diagnosis rate', group: 'Epi funnel', driver: 'diag', lane: 'Population & top-of-funnel', desc: 'New diagnoses each month (and the weekly average) that turn prevalent patients into diagnosed ones.',
    sources: [{ db: BLAZE_DB, schema: VYNDA_SCHEMA, table: 'VYNDA_DATA_ECOSYSTEM_PRP_SNC_DX_RATE_SOURCE', columns: ['MONTHLY - NEW DIAGNOSED ATTR-CM PATIENTS (#)', 'WEEKLY AVERAGE NEW DX', 'END OF ACCOUNTING MONTH'], filter: 'END OF ACCOUNTING MONTH between 2025-01-01 and 2025-12-01', note: '+1 period offset (DX Rate source)' },
      blaze('NEW_DIAGNOSED_PTS', 'New diagnosed (eLAAD), no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'")] },
  { id: 'treat', name: 'Treatment rate', group: 'Epi funnel', driver: 'treat', lane: 'Population & top-of-funnel', desc: 'Share of diagnosed patients on a disease-modifying treatment.',
    sources: [{ ...BUDGET, columns: ['AP #', 'DX_RATE_LE'], note: 'Read as the DMT treatment rate, as in the actuals query' }] },
  { id: 'access', name: 'Access', group: 'Epi funnel', driver: 'access', lane: 'Segmentation & structure', desc: 'Treated patients who can start the brand once affordability and coverage are applied.',
    sources: [{ ...BUDGET, columns: ['AP #', 'AFFORDABILITY_RATE_LE'], note: 'Access / affordability rate' }] },
  { id: 'share', name: 'Brand share', group: 'Demand & share', driver: 'share', lane: 'Share machinery', desc: 'Brand share of first-line patients, plus the new starts that build it.',
    sources: [
      { db: BLAZE_DB, schema: BLAZE_SCHEMA, table: 'VYNDAMAX_FCT_1L_MARKETSHARE_CDS', columns: ['MONTH', 'BRAND', 'BENE_CNT'], filter: 'MONTH between 2025-01-01 and 2025-12-01', note: 'Share = brand beneficiaries ÷ all first-line beneficiaries' },
      { db: BLAZE_DB, schema: VYNDA_SCHEMA, table: 'VYNDA_DATA_ECOSYSTEM_PRP_SNC_AOI_LE_WEEKLY_DATA', columns: ['AP', 'NPS', 'WRITTEN'], filter: "AP LIKE '%2025%'", note: 'New patient starts and new written, +1 period offset' }] },
  { id: 'rx', name: 'Prescriptions per patient', group: 'Demand & share', driver: 'rx', lane: 'Persistence, dosing & regimen', desc: 'TRx filled per active patient each month. Total prescriptions (TRx) = patients on brand × this.',
    sources: [blaze('WITHDRAWAL', 'TRx (EDI867), no offset', " AND SOURCE = 'EDI867'"), blaze('ACTIVE_PATIENTS', 'Active patients, the denominator', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"),
      { ...BUDGET, columns: ['AP #', 'COMPLIANCE_RATE_LE'], note: 'Compliance rate (28 days)' }] },
  { id: 'erosion', name: 'Erosion & restarts', group: 'Demand & share', lane: 'Persistence, dosing & regimen', desc: 'Natural and competitive erosion of the active base and the patients who restart.',
    sources: [blaze('BASE_EROSION', 'Natural erosion, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"), blaze('COMPETITIVE_EROSION', 'Competitive erosion, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"),
      { db: BLAZE_DB, schema: VYNDA_SCHEMA, table: 'VYNDA_DATA_ECOSYSTEM_PRP_SCN_SPP_COMPETITIVE_EROSION', columns: ['THERAPY_MONTHS', '"SUM(RESTARTS)"'], filter: 'YEAR(THERAPY_MONTHS) = 2025', note: 'Restarts, summed by month' }] },
  { id: 'price', name: 'Weighted gross price', group: 'Price & revenue', driver: 'price', lane: 'Conversion, financial & integration', desc: 'Pack-weighted list price per pack. Net price is calculated from it, never forecast.',
    sources: [blaze('GROSS_PRICE_SKU', 'Price proxy, no offset', " AND SKU LIKE '%61mg%'")] },
  { id: 'sales', name: 'Gross and net sales', group: 'Price & revenue', lane: 'Actuals, calibration & reconciliation', desc: 'Booked gross and net sales: the actuals every forecast is anchored to, and the basis of gross-to-net.',
    sources: [blaze('GROSS_SALES', 'Gross sales, no offset', " AND SKU = 'TOTAL'"), blaze('NET_SALES', 'Net sales, no offset; GTN = net ÷ gross', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'")] },
  { id: 'tud', name: 'Total underlying demand', group: 'Revenue bridge', lane: 'Conversion, financial & integration', calc: true, desc: 'Demand dollars from the patient funnel. Calculated, so read-only everywhere.',
    sources: [] },
  { id: 'inv', name: 'Change in inventory', group: 'Revenue bridge', lane: 'Conversion, financial & integration', desc: 'Month-over-month change in wholesaler inventory; target weeks on hand drives the forecast.',
    sources: [blaze('SHIPMENTS', 'Ex-factory shipments, +1 offset', " AND SKU = 'TOTAL'"), blaze('LAUNCH_TO_DATE_OH', 'LTD additional inventory, +1 offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"),
      blaze('ON_HAND_WAC_C', 'Weeks on hand numerator, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'"), blaze('WITHDRAWAL_WAC_C', 'Weeks on hand denominator, no offset', " AND ADDITIONAL_SUB_METRIC = 'TOTAL'")] },
  { id: 'ue', name: 'Unexplained difference', group: 'Revenue bridge', lane: 'Actuals, calibration & reconciliation', calc: true, desc: 'Gross less underlying demand less inventory change, as a % of gross by month.',
    sources: [] },
  { id: 'fx', name: 'Exchange rates', group: 'Revenue bridge', lane: 'Conversion, financial & integration', calc: true, desc: 'Local currency to USD. 1.00 for a US-only model; the Finance rate feed is added for ex-US models.',
    sources: [] },
]
export const INPUT_BY_ID = Object.fromEntries(FLOW_INPUTS.map(i => [i.id, i])) as Record<string, FlowInput>

/** The class each input is mapped to: the CoE's choice where they dragged it, the default otherwise. An empty string means "not mapped". */
export const mapOf = (saved?: Record<string, string>): Record<string, string> =>
  Object.fromEntries(FLOW_INPUTS.map(i => [i.id, saved && i.id in saved ? saved[i.id]! : i.lane]))
export const fqn = (s: SfSource) => `${s.db}.${s.schema}.${s.table}`

/*
 * Model configuration the CoE assigns to a brand. The forecaster's Assumptions and Inputs
 * are generated from this, so each archetype shows only the fields its modules need.
 * Values are illustrative defaults; exact definitions need client validation.
 */

export type DriverGroup = 'Epidemiology' | 'Share' | 'Conversion' | 'Price'
export type InputModule = 'events' | 'gtn'

export type AssumptionDef = {
  id: string; label: string; section: string; help: string
  kind: 'number' | 'select'
  value: number | string; unit?: string; step?: number; band?: [number, number]
  options?: { label: string; effect: number }[]
  /** elasticity of net revenue to a relative change in this assumption */
  w?: number
  source: string; owner: string
}

export type ModelConfig = {
  archetype: string; summary: string; modules: string[]
  assumptions: AssumptionDef[]
  driverGroups: DriverGroup[]; inputModules: InputModule[]
}

const own = 'Brand forecaster'

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'Trend + events': {
    archetype: 'Trend + events', summary: 'Statistical trend on actuals, adjusted by dated market events and gross-to-net.',
    modules: ['Statistical trend', 'Event layer', 'Gross-to-net waterfall', 'Price and conversion'],
    driverGroups: ['Share', 'Price'], inputModules: ['events', 'gtn'],
    assumptions: [
      { id: 'method', section: 'Trend', label: 'Trend method', kind: 'select', value: 'Seasonal trend', options: [{ label: 'Seasonal trend', effect: 0 }, { label: 'Linear regression', effect: -0.006 }, { label: 'Exponential smoothing', effect: 0.004 }], help: 'How the statistical baseline extends actuals.', source: 'CoE model config', owner: own },
      { id: 'lookback', section: 'Trend', label: 'Trend lookback', kind: 'number', value: 24, unit: 'months', step: 1, band: [12, 36], w: 0.01, help: 'History the trend is fitted on.', source: 'CoE model config', owner: own },
      { id: 'evweight', section: 'Events', label: 'Event weighting', kind: 'select', value: 'Probability-weighted', options: [{ label: 'Probability-weighted', effect: 0 }, { label: 'Full impact (100%)', effect: 0.012 }, { label: 'Exclude low-confidence', effect: -0.004 }], help: 'How event impacts enter the forecast.', source: 'Forecasting standard', owner: own },
      { id: 'pricegr', section: 'Price', label: 'Annual WAC increase', kind: 'number', value: 3.0, unit: '%', step: 0.1, band: [0, 8], w: 0.06, help: 'Applied each January to forecast months.', source: 'Pricing committee', owner: own },
      { id: 'upr', section: 'Conversion', label: 'Units per Rx', kind: 'number', value: 16, unit: 'units', step: 1, band: [8, 18], w: 0.2, help: 'Pack size used to convert Rx to units.', source: 'Product labelling', owner: own },
    ],
  },
  'Prevalent-Share': {
    archetype: 'Prevalent-Share', summary: 'Prevalent patient pool × treated rate × brand share, converted to revenue.',
    modules: ['Epidemiology funnel', 'Share curve', 'Compliance and conversion', 'Gross-to-net waterfall'],
    driverGroups: ['Epidemiology', 'Share', 'Conversion', 'Price'], inputModules: ['gtn'],
    assumptions: [
      { id: 'prev', section: 'Epidemiology', label: 'Prevalence growth', kind: 'number', value: 2.1, unit: '% p.a.', step: 0.1, band: [0, 6], w: 0.05, help: 'Annual change in the diagnosed prevalent pool.', source: 'Published epi + claims', owner: own },
      { id: 'treated', section: 'Epidemiology', label: 'Advanced-systemic treated rate', kind: 'number', value: 18, unit: '%', step: 0.5, band: [10, 30], w: 0.3, help: 'Share of prevalent patients on advanced systemic therapy.', source: 'Claims-derived', owner: own },
      { id: 'peak', section: 'Share', label: 'Peak brand share', kind: 'number', value: 15, unit: '%', step: 0.1, band: [8, 25], w: 0.4, help: 'Share of the treated pool at peak.', source: 'Analog library', owner: own },
      { id: 'ttp', section: 'Share', label: 'Time to peak', kind: 'number', value: 30, unit: 'months', step: 1, band: [12, 60], w: -0.05, help: 'Months from launch to peak share.', source: 'Analog library', owner: own },
      { id: 'shape', section: 'Share', label: 'Uptake shape', kind: 'select', value: 'S-curve', options: [{ label: 'S-curve', effect: 0 }, { label: 'Fast uptake', effect: 0.02 }, { label: 'Slow uptake', effect: -0.02 }, { label: 'Linear', effect: -0.006 }], help: 'Curve family used to reach peak.', source: 'Curve library', owner: own },
      { id: 'compl', section: 'Conversion', label: 'Compliance', kind: 'number', value: 78, unit: '%', step: 0.5, band: [60, 95], w: 0.2, help: 'Share of prescribed days actually filled.', source: 'Claims-derived', owner: own },
    ],
  },
  'Patient-Flow': {
    archetype: 'Patient-Flow', summary: 'New patient starts persist on therapy by a duration curve; the book is the sum of cohorts.',
    modules: ['Incidence and line of therapy', 'Share of new starts', 'Persistency curve', 'Event layer'],
    driverGroups: ['Epidemiology', 'Share', 'Conversion'], inputModules: ['events'],
    assumptions: [
      { id: 'inc', section: 'Epidemiology', label: 'Incidence growth', kind: 'number', value: 1.4, unit: '% p.a.', step: 0.1, band: [0, 5], w: 0.04, help: 'Annual change in newly diagnosed patients.', source: 'Registry data', owner: own },
      { id: 'lot', section: 'Epidemiology', label: 'Patients reaching 1L', kind: 'number', value: 82, unit: '%', step: 0.5, band: [60, 95], w: 0.3, help: 'Share of diagnosed patients treated first line.', source: 'Claims-derived', owner: own },
      { id: 'nss', section: 'Share', label: 'Share of new starts', kind: 'number', value: 34, unit: '%', step: 0.5, band: [15, 60], w: 0.45, help: 'Brand share of new patient starts.', source: 'IQVIA NPA', owner: own },
      { id: 'dot', section: 'Persistency', label: 'Median duration of therapy', kind: 'number', value: 24, unit: 'months', step: 1, band: [12, 40], w: 0.3, help: 'Median months a patient stays on therapy.', source: 'Trial mPFS → DoT bridge', owner: own },
      { id: 'curve', section: 'Persistency', label: 'Persistency curve', kind: 'select', value: 'Weibull', options: [{ label: 'Weibull', effect: 0 }, { label: 'Exponential', effect: -0.015 }, { label: 'Log-logistic', effect: 0.01 }], help: 'Shape of drop-off over time.', source: 'CoE curve library', owner: own },
    ],
  },
  'Rx-Share': {
    archetype: 'Rx-Share', summary: 'Market prescriptions × brand share × price, with events and gross-to-net.',
    modules: ['Market Rx trend', 'Share path', 'Price and conversion', 'Event layer', 'Gross-to-net waterfall'],
    driverGroups: ['Share', 'Conversion', 'Price'], inputModules: ['events', 'gtn'],
    assumptions: [
      { id: 'mkt', section: 'Market', label: 'Market Rx growth', kind: 'number', value: 3.5, unit: '% p.a.', step: 0.1, band: [-2, 8], w: 0.06, help: 'Annual growth in total market prescriptions.', source: 'IQVIA NPA', owner: own },
      { id: 'share', section: 'Share', label: 'Exit-year brand share', kind: 'number', value: 62, unit: '%', step: 0.5, band: [40, 80], w: 0.5, help: 'Brand TRx share at the end of the forecast.', source: 'IQVIA NPA', owner: own },
      { id: 'path', section: 'Share', label: 'Share path', kind: 'select', value: 'Linear to exit', options: [{ label: 'Linear to exit', effect: 0 }, { label: 'Front-loaded', effect: 0.01 }, { label: 'Back-loaded', effect: -0.01 }], help: 'How share moves to the exit-year value.', source: 'Curve library', owner: own },
      { id: 'price', section: 'Price', label: 'Annual WAC increase', kind: 'number', value: 2.5, unit: '%', step: 0.1, band: [0, 8], w: 0.06, help: 'Applied each January to forecast months.', source: 'Pricing committee', owner: own },
    ],
  },
}

export const modelFor = (model: string): ModelConfig =>
  model.startsWith('Prevalent') ? MODEL_CONFIGS['Prevalent-Share']!
    : model.startsWith('Patient') ? MODEL_CONFIGS['Patient-Flow']!
      : model.startsWith('Rx') ? MODEL_CONFIGS['Rx-Share']!
        : MODEL_CONFIGS['Trend + events']!

export type AssumptionValues = Record<string, number | string>
export const defaultsOf = (m: ModelConfig): AssumptionValues => Object.fromEntries(m.assumptions.map(a => [a.id, a.value]))

/** Multiplier on net revenue from moving assumptions off their defaults. */
export function assumptionFactor(m: ModelConfig, v: AssumptionValues | undefined) {
  if (!v) return 1
  let f = 1
  for (const a of m.assumptions) {
    const cur = v[a.id]
    if (cur === undefined || cur === a.value) continue
    if (a.kind === 'select') f *= 1 + (a.options?.find(o => o.label === cur)?.effect ?? 0)
    else f *= 1 + (a.w ?? 0) * ((Number(cur) - Number(a.value)) / Math.abs(Number(a.value) || 1))
  }
  return f
}

export const fmtAssumption = (a: AssumptionDef, v: number | string | undefined) =>
  v === undefined ? '–' : a.kind === 'select' ? String(v) : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}${a.unit ? ` ${a.unit}` : ''}`

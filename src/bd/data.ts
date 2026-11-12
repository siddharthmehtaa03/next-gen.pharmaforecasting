/* BD vaccine asset data — unified from the two uploaded prototypes.
 * PCV peds: console-shape with sliders and product succession.
 * Flu mRNA: grid-shape with multi-country age cohorts.
 * Numbers are illustrative, carried from the uploaded files unchanged where possible.
 */

export type ScenarioId = 'pess' | 'base' | 'opt'

export const SCENARIOS: { id: ScenarioId; label: string; tone: 'danger' | 'neutral' | 'ok' }[] = [
  { id: 'pess', label: 'Pessimistic', tone: 'danger' },
  { id: 'base', label: 'Base', tone: 'neutral' },
  { id: 'opt', label: 'Optimistic', tone: 'ok' },
]

export const YEARS = [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036] as const

/* ---------- Asset model ---------- */

export type InputShape = 'sliders' | 'grid'

export type AssetKpis = {
  peakRevenueB: Record<ScenarioId, number>  // $B
  peakYear: Record<ScenarioId, number>
  tenYearRevenueB: Record<ScenarioId, number>
  cagrPct: Record<ScenarioId, number>
}

export type SliderInput = {
  id: string
  group: string
  label: string
  source: string
  unit: string
  base: Record<ScenarioId, number>
  min: number
  max: number
  step?: number
}

export type GridDriver = {
  id: string
  group: string
  label: string
  unit: string
  source: string
  values: Record<string /* country */, Record<ScenarioId, number>>
}

export type ChainStep = {
  n: number
  label: string
  math: string
  values: Record<(typeof YEARS)[number], string>
  bold?: boolean
  section?: string
}

export type Asset = {
  id: string
  name: string
  short: string
  therapy: string
  summary: string
  shape: InputShape
  countries: string[]
  ageGroups?: string[]
  kpis: AssetKpis
  sliders?: SliderInput[]
  grid?: GridDriver[]
  chain: ChainStep[]
  outputByYear: Record<ScenarioId, number[]>
  outputByProduct?: {
    products: { id: string; label: string; color: string }[]
    values: Record<ScenarioId, Record<string, number[]>>
  }
}

/* ---------- PCV peds ---------- */

const pcv: Asset = {
  id: 'pcv-peds',
  name: 'Pediatric PCV franchise',
  short: 'PCV peds',
  therapy: 'Pneumococcal disease · US births cohort',
  summary: 'Prevnar 20 → PG4 → PG5 · US births × vaccination rate × doses per child',
  shape: 'sliders',
  countries: ['United States'],
  kpis: {
    peakRevenueB: { pess: 1.85, base: 2.82, opt: 4.05 },
    peakYear: { pess: 2036, base: 2036, opt: 2036 },
    tenYearRevenueB: { pess: 16.4, base: 23.76, opt: 32.1 },
    cagrPct: { pess: 2.1, base: 4.4, opt: 6.3 },
  },
  sliders: [
    { id: 'births', group: 'Birth cohort', label: 'US births', source: 'CDC NVSS 2025', unit: 'M', base: { pess: 3.6, base: 3.6, opt: 3.6 }, min: 3.0, max: 4.2, step: 0.1 },
    { id: 'birthsGrowth', group: 'Birth cohort', label: 'Births growth', source: 'Census projection', unit: '%/yr', base: { pess: -0.8, base: -0.4, opt: 0 }, min: -1.5, max: 0.5, step: 0.1 },
    { id: 'vaxRate', group: 'Birth cohort', label: 'PCV vaccination rate', source: 'NIS-Child 2025', unit: '%', base: { pess: 90, base: 92, opt: 94 }, min: 85, max: 96 },
    { id: 'doses', group: 'Birth cohort', label: 'Schedule doses per child', source: 'ACIP 3+1 schedule', unit: 'doses', base: { pess: 4, base: 4, opt: 4 }, min: 3, max: 5 },
    { id: 'completion', group: 'Birth cohort', label: 'Series completion', source: 'NIS-Child 4-dose completion', unit: '%', base: { pess: 85, base: 90, opt: 93 }, min: 80, max: 95 },
    { id: 'shareToday', group: 'Franchise share', label: 'Pfizer franchise share today', source: 'IQVIA peds PCV doses', unit: '%', base: { pess: 78, base: 80, opt: 82 }, min: 70, max: 88 },
    { id: 'sharePeak', group: 'Franchise share', label: 'Franchise share at PG4 peak', source: 'Competitive landscape (BA)', unit: '%', base: { pess: 80, base: 86, opt: 90 }, min: 72, max: 94 },
    { id: 'yearsPeak', group: 'Franchise share', label: 'Years to peak after PG4 launch', source: 'Prevnar 13 → 20 analog', unit: 'yrs', base: { pess: 4, base: 3, opt: 2 }, min: 2, max: 6 },
  ],
  chain: [
    { n: 1, section: 'Market demand', label: 'US births', math: '3.6M × (1−0.4%)^t', values: { 2027: '3.60M', 2028: '3.59M', 2029: '3.57M', 2030: '3.56M', 2031: '3.54M', 2032: '3.53M', 2033: '3.51M', 2034: '3.50M', 2035: '3.49M', 2036: '3.47M' } },
    { n: 2, label: 'PCV vaccination rate', math: '92% of the birth cohort', values: { 2027: '92%', 2028: '92%', 2029: '92%', 2030: '92%', 2031: '92%', 2032: '92%', 2033: '92%', 2034: '92%', 2035: '92%', 2036: '92%' } },
    { n: 3, label: 'Doses per child', math: '4 schedule doses × 90% series completion', values: { 2027: '3.60', 2028: '3.60', 2029: '3.60', 2030: '3.60', 2031: '3.60', 2032: '3.60', 2033: '3.60', 2034: '3.60', 2035: '3.60', 2036: '3.60' } },
    { n: 4, label: 'Market doses', math: 'births × vaccination rate × doses per child', bold: true, values: { 2027: '11.9M', 2028: '11.9M', 2029: '11.8M', 2030: '11.8M', 2031: '11.7M', 2032: '11.7M', 2033: '11.6M', 2034: '11.6M', 2035: '11.5M', 2036: '11.5M' } },
    { n: 5, section: 'Pfizer franchise', label: 'Franchise share of market', math: '80% today → 86% via S-curve ((t−PG4 launch+1) ÷ 3 yrs)', values: { 2027: '80.0%', 2028: '80.0%', 2029: '81.6%', 2030: '84.4%', 2031: '86.0%', 2032: '86.0%', 2033: '86.0%', 2034: '86.0%', 2035: '86.0%', 2036: '86.0%' } },
    { n: 6, label: 'Franchise doses', math: 'market doses × franchise share', bold: true, values: { 2027: '9.5M', 2028: '9.5M', 2029: '9.6M', 2030: '9.9M', 2031: '10.1M', 2032: '10.1M', 2033: '10.0M', 2034: '10.0M', 2035: '9.9M', 2036: '9.9M' } },
    { n: 7, section: 'Price and revenue', label: 'Blended net price per dose', math: 'franchise revenue ÷ franchise doses', values: { 2027: '$200', 2028: '$204', 2029: '$213', 2030: '$226', 2031: '$236', 2032: '$241', 2033: '$253', 2034: '$269', 2035: '$280', 2036: '$285' } },
    { n: 8, label: 'Franchise net revenue', math: 'franchise doses × blended net price', bold: true, values: { 2027: '$1.91B', 2028: '$1.94B', 2029: '$2.05B', 2030: '$2.25B', 2031: '$2.38B', 2032: '$2.42B', 2033: '$2.53B', 2034: '$2.68B', 2035: '$2.78B', 2036: '$2.82B' } },
  ],
  outputByYear: {
    pess: [1850, 1810, 1740, 1700, 1690, 1690, 1720, 1770, 1810, 1850],
    base: [1910, 1940, 2050, 2250, 2380, 2420, 2530, 2680, 2780, 2820],
    opt:  [1980, 2080, 2290, 2620, 2880, 3010, 3210, 3450, 3730, 4050],
  },
  outputByProduct: {
    products: [
      { id: 'prev20', label: 'Prevnar 20', color: '#1E2A6B' },
      { id: 'pg4', label: 'PG4', color: '#3B82F6' },
      { id: 'pg5', label: 'PG5', color: '#14B8A6' },
    ],
    values: {
      base: { prev20: [1530,1550,1280,750,200,200,0,0,0,0], pg4: [380,390,770,1500,2180,2220,1960,1030,390,360], pg5: [0,0,0,0,0,0,570,1650,2390,2460] },
      pess: { prev20: [1480,1450,1200,700,180,180,0,0,0,0], pg4: [370,360,540,1000,1510,1510,1340,710,270,250], pg5: [0,0,0,0,0,0,380,1060,1540,1600] },
      opt:  { prev20: [1580,1610,1340,790,210,210,0,0,0,0], pg4: [400,470,950,1830,2670,2800,2470,1300,490,460], pg5: [0,0,0,0,0,0,740,2150,3240,3590] },
    },
  },
}

/* ---------- Flu mRNA ---------- */

const flu: Asset = {
  id: 'flu-mrna',
  name: 'Seasonal flu — Pfizer mRNA',
  short: 'Flu mRNA',
  therapy: 'Seasonal influenza · 5 countries · 6 age groups · 2027–2036',
  summary: 'Population × flu vaccination × mRNA class share × Pfizer share within mRNA',
  shape: 'grid',
  countries: ['United States', 'France', 'Germany', 'Japan', 'China'],
  ageGroups: ['0–17', '18–49 LR', '18–49 HR', '50–64 LR', '50–64 HR', '65+'],
  kpis: {
    peakRevenueB: { pess: 0.42, base: 0.93, opt: 1.58 },
    peakYear: { pess: 2036, base: 2036, opt: 2036 },
    tenYearRevenueB: { pess: 2.1, base: 6.4, opt: 11.9 },
    cagrPct: { pess: 24, base: 43, opt: 58 },
  },
  grid: [
    { id: 'pop0_17', group: 'Population', label: 'Population 0–17', unit: 'M', source: 'Census', values: { 'United States': { pess: 73, base: 73, opt: 73 }, 'France': { pess: 14, base: 14, opt: 14 }, 'Germany': { pess: 13, base: 13, opt: 13 }, 'Japan': { pess: 17, base: 17, opt: 17 }, 'China': { pess: 260, base: 260, opt: 260 } } },
    { id: 'pop18_49', group: 'Population', label: 'Population 18–49', unit: 'M', source: 'Census', values: { 'United States': { pess: 138, base: 138, opt: 138 }, 'France': { pess: 27, base: 27, opt: 27 }, 'Germany': { pess: 32, base: 32, opt: 32 }, 'Japan': { pess: 45, base: 45, opt: 45 }, 'China': { pess: 640, base: 640, opt: 640 } } },
    { id: 'pop65', group: 'Population', label: 'Population 65+', unit: 'M', source: 'Census', values: { 'United States': { pess: 59, base: 59, opt: 59 }, 'France': { pess: 14, base: 14, opt: 14 }, 'Germany': { pess: 18, base: 18, opt: 18 }, 'Japan': { pess: 36, base: 36, opt: 36 }, 'China': { pess: 190, base: 190, opt: 190 } } },
    { id: 'vaxToday', group: 'Flu vaccination rate — today', label: '18–49', unit: '%', source: 'FluVaxView 2025–26', values: { 'United States': { pess: 27, base: 30, opt: 33 }, 'France': { pess: 18, base: 22, opt: 26 }, 'Germany': { pess: 20, base: 24, opt: 28 }, 'Japan': { pess: 35, base: 40, opt: 45 }, 'China': { pess: 10, base: 15, opt: 20 } } },
    { id: 'vaxToday65', group: 'Flu vaccination rate — today', label: '65+', unit: '%', source: 'FluVaxView 2025–26', values: { 'United States': { pess: 68, base: 71, opt: 74 }, 'France': { pess: 50, base: 55, opt: 60 }, 'Germany': { pess: 42, base: 48, opt: 54 }, 'Japan': { pess: 55, base: 60, opt: 65 }, 'China': { pess: 20, base: 25, opt: 30 } } },
    { id: 'mrnaShare', group: 'mRNA class', label: 'mRNA class share by 2036', unit: '%', source: 'BA class forecast', values: { 'United States': { pess: 20, base: 26, opt: 34 }, 'France': { pess: 15, base: 22, opt: 30 }, 'Germany': { pess: 15, base: 22, opt: 30 }, 'Japan': { pess: 18, base: 24, opt: 32 }, 'China': { pess: 5, base: 10, opt: 18 } } },
    { id: 'pfizerShare', group: 'Pfizer share', label: 'Pfizer share within mRNA', unit: '%', source: 'Competitive landscape (BA)', values: { 'United States': { pess: 35, base: 50, opt: 65 }, 'France': { pess: 25, base: 40, opt: 55 }, 'Germany': { pess: 25, base: 40, opt: 55 }, 'Japan': { pess: 30, base: 45, opt: 60 }, 'China': { pess: 15, base: 25, opt: 40 } } },
  ],
  chain: [
    { n: 1, section: 'Flu market', label: 'Population', math: 'Σ age groups × (1+0.3%)^t', values: { 2027: '333M', 2028: '334M', 2029: '335M', 2030: '336M', 2031: '337M', 2032: '338M', 2033: '339M', 2034: '340M', 2035: '341M', 2036: '342M' } },
    { n: 2, label: 'Flu vaccination rate', math: 'blended: vaccinated ÷ population', values: { 2027: '47.1%', 2028: '47.4%', 2029: '47.7%', 2030: '48.1%', 2031: '48.4%', 2032: '48.7%', 2033: '49.1%', 2034: '49.4%', 2035: '49.7%', 2036: '50.1%' } },
    { n: 3, label: 'Flu-vaccinated people', math: 'population × vaccination rate', values: { 2027: '156.8M', 2028: '158.3M', 2029: '159.9M', 2030: '161.5M', 2031: '163.1M', 2032: '164.8M', 2033: '166.4M', 2034: '168.0M', 2035: '169.7M', 2036: '171.3M' } },
    { n: 4, section: 'Class and share', label: 'mRNA class share of flu market', math: 'blended: mRNA doses ÷ vaccinated', values: { 2027: '4.1%', 2028: '13.1%', 2029: '22.1%', 2030: '26.1%', 2031: '26.0%', 2032: '26.0%', 2033: '26.1%', 2034: '26.1%', 2035: '26.1%', 2036: '26.1%' } },
    { n: 5, label: 'mRNA class doses', math: 'vaccinated × mRNA class share', bold: true, values: { 2027: '6.43M', 2028: '20.18M', 2029: '32.09M', 2030: '35.65M', 2031: '34.75M', 2032: '35.10M', 2033: '35.46M', 2034: '35.82M', 2035: '36.18M', 2036: '36.54M' } },
    { n: 6, label: 'Pfizer share within mRNA', math: 'blended: Pfizer doses ÷ mRNA doses', values: { 2027: '13.1%', 2028: '37.4%', 2029: '50.3%', 2030: '50.2%', 2031: '50.1%', 2032: '50.1%', 2033: '50.1%', 2034: '50.1%', 2035: '50.1%', 2036: '50.1%' } },
    { n: 7, label: 'Pfizer doses', math: 'mRNA class doses × Pfizer share', bold: true, values: { 2027: '0.84M', 2028: '7.54M', 2029: '16.15M', 2030: '17.89M', 2031: '17.41M', 2032: '17.59M', 2033: '17.77M', 2034: '17.95M', 2035: '18.13M', 2036: '18.31M' } },
    { n: 8, section: 'Price and revenue', label: 'Blended net price per dose', math: 'revenue ÷ Pfizer doses', values: { 2027: '$44', 2028: '$44', 2029: '$45', 2030: '$45', 2031: '$46', 2032: '$47', 2033: '$48', 2034: '$49', 2035: '$50', 2036: '$51' } },
    { n: 9, label: 'Pfizer net revenue', math: 'Pfizer doses × net price', bold: true, values: { 2027: '$37M', 2028: '$335M', 2029: '$725M', 2030: '$809M', 2031: '$799M', 2032: '$822M', 2033: '$847M', 2034: '$872M', 2035: '$898M', 2036: '$925M' } },
  ],
  outputByYear: {
    pess: [10, 85, 175, 215, 250, 290, 330, 370, 400, 420],
    base: [37, 335, 725, 809, 799, 822, 847, 872, 898, 925],
    opt:  [65, 540, 1060, 1210, 1240, 1300, 1370, 1440, 1510, 1580],
  },
}

export const ASSETS: Asset[] = [pcv, flu]

export const findAsset = (id: string) => ASSETS.find(a => a.id === id)

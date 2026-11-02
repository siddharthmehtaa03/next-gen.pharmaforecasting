/**
 * Published-forecast registry: the latest submitted or approved version per brand.
 * Forecast AI reads only from here. Drafts are never written to it; a confirmed submit in the
 * workspace adds a new version (see `nextPublished`).
 */
export type Published = { cycle: string; version: string; state: 'Approved' | 'Submitted'; date: string; by: string; scenario?: string }
export type PublishedReg = Record<string, Published | null>

/** Seed matches the homepage statuses: current-cycle drafts fall back to the last approved cycle. */
export const SEED_PUBLISHED: PublishedReg = {
  nurtec: { cycle: 'Q2 2026 reforecast', version: 'v3', state: 'Approved', date: 'Jun 18, 2026', by: 'US Brand Finance' },
  vyndaq: { cycle: 'AOP 2027', version: 'v2', state: 'Submitted', date: 'Oct 2, 2026', by: 'R. Okafor' },
  zavzpret: null,
  abrysvo: { cycle: 'Q2 2026 reforecast', version: 'v2', state: 'Approved', date: 'Jun 20, 2026', by: 'EU5 Finance' },
  cibinqo: { cycle: 'Q3 reforecast', version: 'v4', state: 'Submitted', date: 'Sep 26, 2026', by: 'M. Lindqvist' },
  elrexfio: { cycle: 'Q2 2026 reforecast', version: 'v1', state: 'Approved', date: 'Jun 24, 2026', by: 'Global Finance' },
}

export const publishedOf = (id: string, reg: PublishedReg = SEED_PUBLISHED): Published | null => reg[id] ?? null
export const publishedLabel = (a: Published) => `${a.cycle} ${a.version} · ${a.state === 'Submitted' ? 'Submitted, in review' : 'Approved'}`

/** Version that a confirmed submit files: bumps within the same cycle, restarts at v1 for a new cycle. */
export function nextPublished(prev: Published | null, cycle: string, by: string, scenario: string): Published {
  const n = prev && prev.cycle === cycle ? (parseInt(prev.version.slice(1), 10) || 0) + 1 : 1
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { cycle, version: `v${n}`, state: 'Submitted', date, by, scenario }
}

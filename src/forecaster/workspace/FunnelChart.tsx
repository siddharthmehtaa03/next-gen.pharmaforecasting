import { Lock } from 'lucide-react'
import { DRV, POP, fyAvg, fmtV } from './engine'
import type { DriverId, Layer, ModelCfg } from './engine'
import { cx, InfoTip } from './ui'

/*
 * Vertical patient funnel. Each band is a trapezoid whose width is proportional to the
 * population still in the funnel at that level, so the taper is the data rather than decoration.
 * Clicking a band selects that driver, which is how the rail navigated before.
 */

/** The percentage drivers, in model order. Non-percentage inputs (Rx, price) sit outside the funnel. */
const STAGES: DriverId[] = ['diag', 'treat', 'access', 'share']
/** Chart tokens only — the funnel is a chart, so the secondary palette is in scope. */
const HUE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const people = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e3).toFixed(0)}K`

export type FunnelLevel = { id: DriverId; label: string; step: string; pct: number; headcount: number; editable: boolean; changed: boolean }

/** Population remaining after each percentage stage, starting from the prevalent pool. */
export function funnelLevels(working: Layer, model: ModelCfg, changedIds: Partial<Record<string, unknown>>): FunnelLevel[] {
  let head = POP
  return STAGES.filter(id => model.modules.some(m => m.id === id)).map(id => {
    const pct = fyAvg(working[id])
    head = head * (pct / 100)
    return {
      id, label: DRV[id].label, step: DRV[id].step, pct, headcount: head,
      editable: model.modules.find(m => m.id === id)?.editable ?? false,
      changed: !!changedIds[id],
    }
  })
}

export function FunnelChart({ levels, sel, onSel, startLabel, startValue }: {
  levels: FunnelLevel[]; sel: DriverId | null; onSel: (id: DriverId) => void
  startLabel: string; startValue: string
}) {
  // Band widths track the surviving population, floored so the last band stays legible.
  const widths = [100, ...levels.map(l => Math.max(26, (l.headcount / POP) * 100))]

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Patient funnel</h3>
        <InfoTip text="Each band is the population still in the funnel after that stage, as an FY average. Widths are proportional to headcount. Click a stage to edit its assumption; formulas come from the CoE model and stay locked." />
      </div>

      {/* Starting pool: the only full-width level, and never editable. */}
      <div className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border-strong bg-surface-2 px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-3">Starting point</span>
          <span className="block truncate text-[12.5px] font-semibold">{startLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-data text-[12.5px] text-text-2"><Lock size={10} />{startValue}</span>
      </div>

      <ul className="flex flex-col">
        {levels.map((l, k) => {
          const on = sel === l.id
          const topW = widths[k]!, botW = widths[k + 1]!
          return (
            <li key={l.id}>
              <button
                type="button" onClick={() => onSel(l.id)} aria-current={on ? 'true' : undefined}
                aria-label={`${l.label}, ${fmtV(l.id, l.pct)}, ${people(l.headcount)} patients`}
                className={cx(
                  'group relative block w-full rounded-lg px-1 pb-1 pt-1.5 text-left outline-none transition-[box-shadow]',
                  on && 'shadow-[var(--ring-glow-strong)]',
                )}
              >
                {/* The band itself. preserveAspectRatio=none lets the trapezoid stretch to the row. */}
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden className="absolute inset-x-1 top-1.5 -z-10 h-[calc(100%-10px)] w-[calc(100%-8px)]">
                  <polygon
                    points={`${50 - topW / 2},0 ${50 + topW / 2},0 ${50 + botW / 2},40 ${50 - botW / 2},40`}
                    fill={HUE[k % HUE.length]}
                    opacity={on ? 0.9 : 0.62}
                    className="transition-opacity group-hover:opacity-80"
                  />
                </svg>

                <span className="flex min-h-[46px] items-center justify-between gap-2 px-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[10.5px] font-medium uppercase tracking-wider text-white/75">{l.step}</span>
                    <span className="block truncate text-[13px] font-semibold text-white">{l.label}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-data text-[13px] font-semibold text-white">{fmtV(l.id, l.pct)}</span>
                    <span className="font-data text-[10.5px] text-white/80">{people(l.headcount)}</span>
                  </span>
                </span>
              </button>

              {/* State line sits under the band so it never fights the fill for contrast. */}
              <span className="flex items-center justify-end gap-1 px-4 pb-0.5 text-[10.5px]">
                {!l.editable
                  ? <span className="inline-flex items-center gap-1 text-text-3"><Lock size={9} />System-fed</span>
                  : l.changed
                    ? <span className="inline-flex items-center gap-1 font-medium text-brand"><span className="h-1.5 w-1.5 rounded-full bg-warn" />Modified</span>
                    : <span className="text-text-3">FY average</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

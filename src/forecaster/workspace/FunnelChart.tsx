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
const ROW = 64

/**
 * One Pfizer-blue ramp rather than four hues: the bands read as a single funnel, and every
 * step stays dark enough to carry white labels. Mixed against the card so it never muddies.
 */
const fillFor = (k: number, n: number) => {
  const pct = 100 - Math.round((k / Math.max(1, n - 1)) * 38) // 100% -> 62%
  return `color-mix(in oklab, var(--chart-1) ${pct}%, white)`
}

const people = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${(v / 1e3).toFixed(0)}K`

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
  // Band widths track the surviving population, floored so the narrowest band stays readable.
  const w = [100, ...levels.map(l => Math.max(34, (l.headcount / POP) * 100))]
  const h = levels.length * ROW

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Patient funnel</h3>
        <InfoTip text="Each band is the population still in the funnel after that stage, as an FY average. Widths are proportional to headcount. Click a stage to edit its assumption; formulas come from the CoE model and stay locked." />
      </div>

      {/* Starting pool: the only full-width level, and never editable. */}
      <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border-strong bg-surface-2 px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-3">Starting point</span>
          <span className="block truncate text-[12.5px] font-semibold">{startLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-data text-[12.5px] text-text-2"><Lock size={10} />{startValue}</span>
      </div>

      {/* One SVG draws every band, so the trapezoids meet exactly. Labels are HTML on top of it. */}
      <div className="relative" style={{ height: h }}>
        <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
          {levels.map((l, k) => {
            const y = k * ROW, top = w[k]!, bot = w[k + 1]!
            return (
              <polygon
                key={l.id}
                points={`${50 - top / 2},${y} ${50 + top / 2},${y} ${50 + bot / 2},${y + ROW} ${50 - bot / 2},${y + ROW}`}
                fill={fillFor(k, levels.length)}
                stroke="white" strokeWidth={0.4}
              />
            )
          })}
        </svg>

        <ul className="absolute inset-0">
          {levels.map((l, k) => {
            const on = sel === l.id
            return (
              <li key={l.id} className="absolute inset-x-0" style={{ top: k * ROW, height: ROW }}>
                <button
                  type="button" onClick={() => onSel(l.id)} aria-current={on ? 'true' : undefined}
                  aria-label={`${l.label}, ${fmtV(l.id, l.pct)}, ${people(l.headcount)} patients`}
                  className="funnel-band flex h-full w-full items-center justify-between gap-2 rounded-md px-3 text-left outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-white/80">{l.step}</span>
                    <span className="block truncate text-[13px] font-semibold text-white">{l.label}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-white/80">
                      {!l.editable
                        ? <><Lock size={8} />System-fed</>
                        : l.changed ? <><span className="h-1.5 w-1.5 rounded-full bg-white" />Modified</> : 'FY average'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-data text-[14px] font-semibold text-white">{fmtV(l.id, l.pct)}</span>
                    <span className="font-data text-[10.5px] text-white/85">{people(l.headcount)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

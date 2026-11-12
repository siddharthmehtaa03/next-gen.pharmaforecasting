import { Lock } from 'lucide-react'
import { DRV, POP, fyAvg, fmtV } from './engine'
import type { DriverId, Layer, ModelCfg } from './engine'
import { cx, InfoTip } from './ui'

/*
 * Vertical patient funnel, drawn as cards. Each card's width tracks the population still in
 * the funnel at that stage, so the stack tapers, but the surfaces stay white with hairline
 * borders so the labels are always legible. Clicking a card selects that driver.
 */

/** The percentage drivers, in model order. Non-percentage inputs (Rx, price) sit outside the funnel. */
const STAGES: DriverId[] = ['diag', 'treat', 'access', 'share']

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
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Patient funnel</h3>
        <InfoTip text="Each card is the population still in the funnel after that stage, as an FY average. Cards narrow as the population falls, on a compressed scale so every label stays readable. Click a stage to edit its assumption; formulas come from the CoE model and stay locked." />
      </div>

      {/* Starting pool: the only full-width level, and never editable. */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border-strong bg-surface-2 px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-3">Starting point</span>
          <span className="block truncate text-[12.5px] font-semibold">{startLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-data text-[12.5px] text-text-2"><Lock size={10} />{startValue}</span>
      </div>

      <ul>
        {levels.map(l => {
          const on = sel === l.id
          // Headcount collapses by orders of magnitude (39M to 0.9M), so a linear width would clamp
          // every card at the readable floor. A cube root compresses it: still monotonic in
          // headcount, but the whole range lands between 72% and 100%.
          const width = `${72 + 28 * Math.cbrt(l.headcount / POP)}%`
          return (
            <li key={l.id} className="flex flex-col items-center">
              <span aria-hidden className="h-2.5 w-px bg-border-strong" />
              <button
                type="button" onClick={() => onSel(l.id)} aria-current={on ? 'true' : undefined} style={{ width }}
                aria-label={`${l.label}, ${fmtV(l.id, l.pct)}, ${people(l.headcount)} patients`}
                className={cx(
                  'flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-surface px-3 py-2 text-left transition-[border-color,box-shadow]',
                  on ? 'border-brand shadow-[var(--ring-glow-strong)]' : 'border-border hover:border-border-strong',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-text-3">{l.step}</span>
                  <span className="block truncate text-[12.5px] font-medium text-text">{l.label}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-data text-[13px] font-semibold text-text">{fmtV(l.id, l.pct)}</span>
                  <span className="font-data text-[10.5px] text-text-3">{people(l.headcount)}</span>
                </span>
              </button>
              <span className="mt-0.5 flex items-center gap-1 text-[10px]">
                {!l.editable
                  ? <span className="inline-flex items-center gap-1 text-text-3"><Lock size={8} />System-fed</span>
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

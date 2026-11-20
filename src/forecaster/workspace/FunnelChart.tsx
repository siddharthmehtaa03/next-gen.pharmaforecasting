import { DRV, POP, fyAvg, fmtV } from './engine'
import type { DriverId, Layer, ModelCfg } from './engine'
import { AssumptionCard, GroupHead, cx, InfoTip } from './ui'
import { ChartActions } from '../../chart/ChartActions'

/*
 * The patient funnel as a grouped list of assumption cards. Clicking a card selects that driver.
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

/** The funnel split into the two questions it answers; stages keep their model order inside each group. */
const FUNNEL_GROUPS: { title: string; sub: string; ids: DriverId[] }[] = [
  { title: 'Patient pool', sub: 'How many people can be treated?', ids: ['diag', 'treat'] },
  { title: 'New to brand', sub: 'Who starts on the brand?', ids: ['access', 'share'] },
]

export function FunnelChart({ levels, sel, onSel, startLabel, startValue, embedded }: {
  levels: FunnelLevel[]; sel: DriverId | null; onSel: (id: DriverId) => void
  startLabel: string; startValue: string
  /** Drops this component's own card border/background so it can sit inside a shared card with other sections. */
  embedded?: boolean
}) {
  const groups = FUNNEL_GROUPS.map(g => ({ ...g, rows: levels.filter(l => g.ids.includes(l.id)) })).filter(g => g.rows.length)
  // The starting pool comes from the model and is never editable.
  const start = <AssumptionCard step="Core archetype" label={startLabel} value={startValue} locked title="Set by the published model" />
  return (
    <div id="patient-funnel-chart" className={cx(!embedded && 'rounded-xl border border-border bg-surface p-3')}>
      {!embedded && (
        <div className="mb-2 flex items-center justify-between gap-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Patient funnel</h3>
            <InfoTip text="Each card is the population still in the funnel after that stage, as an FY average. Click a stage to edit its assumption; formulas come from the CoE model and stay locked." />
          </div>
          <ChartActions target="patient-funnel-chart" title="Patient funnel" subtitle="FY average" />
        </div>
      )}

      {!groups.length && <div className="flex flex-col gap-1.5">{start}</div>}
      {groups.map((g, gi) => (
        <div key={g.title}>
          <GroupHead title={g.title} sub={g.sub} className={gi === 0 ? 'pt-1' : undefined} />
          <div className="flex flex-col gap-1.5">
            {gi === 0 && start}
            {g.rows.map(l => (
              <AssumptionCard key={l.id} step={l.step} label={l.label} value={fmtV(l.id, l.pct)} sub={`${people(l.headcount)} patients`}
                locked={!l.editable} changed={l.changed} on={sel === l.id} onClick={() => onSel(l.id)}
                title={l.editable ? `${people(l.headcount)} patients after this stage · editable` : `${people(l.headcount)} patients after this stage · locked by the model`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

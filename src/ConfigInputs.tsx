import { Fragment, useState } from 'react'
import type { DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Check, ClipboardPaste, Copy, Database, Eye, GripVertical, Lock, Plus, RotateCcw, Users, Workflow, X } from 'lucide-react'
import { FLOW_INPUTS, GROUP_ORDER, INPUT_BY_ID, canvasMap, flowRows, fqn, moveInput, onCanvas, withPatientFlow } from './configCatalog'
import type { InputMap } from './configCatalog'
import { Btn, MoreMenu, cx } from './forecaster/workspace/ui'

const DRAG_INPUT = 'application/x-flow-input'
const LINE = 'bg-border-strong'

/** A revenue stream as the whole-model views draw it. */
export type StreamRef = { id: string; name: string; partOf?: string; arch: string; map?: InputMap }

// Copy flow → Paste flow works across streams, so the copied flow lives outside any one canvas.
let copied: InputMap | null = null

/* ───────────────────────── Module map: the patient-flow canvas and its library ───────────────────────── */

/** The stream's patient flow, built by placing inputs from the library in model order. Each input keeps the group class the module library fixes for it. */
export function InputCanvas({ map: saved, setMap, onApplyAll, preview, engine, streamName, values }: {
  map: InputMap | undefined; setMap: (m: InputMap) => void; onApplyAll?: (m: InputMap) => void
  preview: { model: string; streams: StreamRef[] }; engine: string; streamName: string
  /** Illustrative values shown on the cards (the Cibinqo workbook demo). */
  values?: Record<string, string>
}) {
  const map = canvasMap(saved)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [whole, setWhole] = useState(false)
  const [, rerender] = useState(0)
  const flow = onCanvas(saved)
  const left = FLOW_INPUTS.filter(i => !map[i.id])
  const add = (id: string) => { const i = INPUT_BY_ID[id]; if (i && !map[id]) setMap({ ...map, [id]: i.lane }) }
  const remove = (id: string) => { if (INPUT_BY_ID[id] && map[id]) setMap({ ...map, [id]: '' }) }
  const start = (id: string) => (e: DragEvent) => { e.dataTransfer.setData(DRAG_INPUT, id); e.dataTransfer.effectAllowed = 'move'; setDrag(id) }
  const end = () => { setDrag(null); setOver(null) }
  const allow = (key: string) => (e: DragEvent) => { if (e.dataTransfer.types.includes(DRAG_INPUT)) { e.preventDefault(); setOver(key) } }
  const leave = (key: string) => () => setOver(o => (o === key ? null : o))
  const drop = (fn: (id: string) => void) => (e: DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData(DRAG_INPUT); end(); if (id) fn(id) }
  return (
    <div className="grid items-start gap-4 @xl:grid-cols-[minmax(0,1fr)_300px]" data-tour="input-map">
      <section aria-label="Patient-flow canvas" onDragOver={allow('__canvas')} onDragLeave={leave('__canvas')} onDrop={drop(add)}
        className={cx('min-w-0 rounded-lg border bg-surface p-4 transition-colors', over === '__canvas' && drag ? 'border-2 border-dashed border-brand bg-brand-soft/30' : 'border-border')}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Patient flow · {streamName || 'Stream'}</h3>
            <p className="text-xs text-text-2">{engine}. The flow builds in model order as you drop inputs.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-text-3">{flow.length}/{FLOW_INPUTS.length} on canvas</span>
            <Btn size="sm" variant="secondary" icon={<Eye size={12} />} onClick={() => setWhole(true)}>Preview whole model</Btn>
            <Btn size="sm" icon={<Plus size={12} />} disabled={!left.some(i => !i.optional)} onClick={() => setMap(withPatientFlow(saved))}>Add the patient flow</Btn>
            <MoreMenu label="Flow actions" items={[
              { label: 'Copy flow', icon: <Copy size={14} />, disabled: !flow.length, onClick: () => { copied = { ...map }; rerender(n => n + 1) } },
              { label: 'Paste flow', icon: <ClipboardPaste size={14} />, disabled: !copied, onClick: () => { if (copied) setMap({ ...copied }) } },
              ...(onApplyAll ? [{ label: 'Apply to all streams', icon: <Users size={14} />, disabled: !flow.length, onClick: () => onApplyAll({ ...map }) }] : []),
              { label: 'Clear', icon: <RotateCcw size={14} />, danger: true, disabled: !flow.length, onClick: () => setMap(canvasMap({})) },
            ]} />
          </div>
        </div>
        {flow.length === 0 ? (
          <div className="grid min-h-[420px] place-items-center rounded-lg border-2 border-dashed border-border-strong px-6 py-16 text-center">
            <div className="flex flex-col items-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand"><GripVertical size={18} aria-hidden /></span>
              <p className="mt-3 text-sm font-semibold">Drag the first module here</p>
              <p className="mt-1 max-w-sm text-[12.5px] text-text-2">Drag a module from the library on the right, or add the standard patient flow. Start with <b className="text-text">Prevalent patients</b>; only the modules you drop appear here, each tied to its group class.</p>
            </div>
          </div>
        ) : (
          <ol className="flex flex-col items-stretch">
            {flow.map((i, k) => (
              <Fragment key={i.id}>
                {k > 0 && <li aria-hidden className="mx-auto flex h-6 flex-col items-center"><span className={cx('h-full w-px', LINE)} /><ArrowDown size={11} className="-mt-0.5 text-text-3" /></li>}
                <li className="mx-auto w-full max-w-[460px]">
                  <div draggable onDragStart={start(i.id)} onDragEnd={end}
                    className={cx('group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-sm transition-colors hover:border-brand/60', drag === i.id && 'opacity-40')}>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{k + 1}</span>
                    <div className="min-w-0 flex-1" title={i.desc}>
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold leading-tight">{i.name}{i.calc && <Lock size={10} className="text-text-3" aria-label="Calculated by the platform" />}</p>
                      <p className="mt-0.5 truncate text-[11px] text-text-3">{i.group}{values?.[i.id] && <span className="ml-1.5 font-mono text-text-2">· {values[i.id]}</span>}</p>
                    </div>
                    <span className="flex shrink-0 items-center">
                      <button type="button" onClick={() => setMap(moveInput(saved, i.id, -1))} disabled={k === 0} aria-label={`Move ${i.name} up`} title="Move up" className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-brand disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button type="button" onClick={() => setMap(moveInput(saved, i.id, 1))} disabled={k === flow.length - 1} aria-label={`Move ${i.name} down`} title="Move down" className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-brand disabled:opacity-30"><ArrowDown size={14} /></button>
                    </span>
                    <button type="button" onClick={() => remove(i.id)} aria-label={`Take ${i.name} off the canvas`} title="Take off the canvas" className="rounded p-1 text-text-3 hover:bg-surface-2 hover:text-err"><X size={14} /></button>
                    <p className="order-last flex w-full items-center gap-1.5 text-[11px]" title="The group class is fixed by the module library">
                      <span className="shrink-0 font-semibold uppercase tracking-wide text-text-3">Group class</span>
                      <span className="min-w-0 truncate rounded bg-brand-soft px-2 py-1 text-[12px] font-medium text-brand">{map[i.id]}</span>
                    </p>
                  </div>
                </li>
              </Fragment>
            ))}
          </ol>
        )}
      </section>

      <aside aria-label="Library" onDragOver={allow('__library')} onDragLeave={leave('__library')} onDrop={drop(remove)}
        className={cx('flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface @xl:sticky @xl:top-4 @xl:max-h-[calc(100dvh-140px)]', over === '__library' && drag ? 'border-2 border-dashed border-err' : 'border-border')}>
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Library</h3><span className="font-mono text-[11px] text-text-3">{left.length} to place</span></div>
          <p className="mt-1 text-[11.5px] text-text-3">Drag a module onto the canvas, or use +. Drag a card back here to remove it. A tick means it is already on the canvas.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {GROUP_ORDER.map(g => (
            <section key={g} aria-label={g} className="mb-3 last:mb-0">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-3">{g}</p>
              <ul className="space-y-1.5">
                {FLOW_INPUTS.filter(i => i.group === g).map(i => {
                  const on = !!map[i.id]
                  return (
                    <li key={i.id} draggable={!on} onDragStart={start(i.id)} onDragEnd={end}
                      className={cx('group rounded-md border p-2 transition-all', on ? 'border-border bg-surface-2/50 opacity-60' : 'cursor-grab border-border bg-surface shadow-sm hover:-translate-y-px hover:border-brand active:cursor-grabbing', drag === i.id && 'opacity-40')}>
                      <div className="flex items-start gap-1.5">
                        {on ? <Check size={13} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <GripVertical size={13} className="mt-0.5 shrink-0 text-text-3 group-hover:text-brand" aria-hidden />}
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 text-[12.5px] font-semibold leading-tight">{i.name}{i.calc && <Lock size={10} className="text-text-3" aria-label="Calculated" />}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-2">{i.desc}</p>
                        </div>
                        {!on && <button type="button" onClick={() => add(i.id)} aria-label={`Add ${i.name} to the canvas`} title="Add to the canvas" className="shrink-0 rounded p-0.5 text-text-3 hover:bg-brand-soft hover:text-brand"><Plus size={13} /></button>}
                      </div>
                    </li>)
                })}
              </ul>
            </section>))}
        </div>
      </aside>
      {whole && <WholeModel model={preview.model} streams={preview.streams} onClose={() => setWhole(false)} />}
    </div>
  )
}

/* ───────────────────────── Whole model: every stream and the flow it runs on ───────────────────────── */

/** Every revenue stream as a branch under the model, each with its patient flow down to net revenue. */
export function ModelFlowTree({ model, streams }: { model: string; streams: StreamRef[] }) {
  const branches = streams.map(s => ({ s, flow: flowRows(s.map) }))
  return (
    <div className="overflow-x-auto pb-2" aria-label="Whole model flow">
      <div className="mx-auto flex w-max min-w-full flex-col items-center">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-dark px-4 py-2 text-[13px] font-semibold text-white"><Workflow size={14} />{model || 'Model'}</span>
        <span className={cx('h-5 w-px', LINE)} />
        <ul className="flex items-start">
          {branches.map(({ s, flow }) => (
            <li key={s.id} className="relative flex min-w-[210px] max-w-[250px] flex-col items-center px-2 pt-5 before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-border-strong first:before:left-1/2 last:before:right-1/2 only:before:hidden after:absolute after:left-1/2 after:top-0 after:h-5 after:w-px after:bg-border-strong">
              <div className="w-full rounded-lg border border-ok/30 bg-ok-soft px-3 py-2 text-center">
                <p className="text-[12.5px] font-semibold leading-tight text-ok">{s.name}</p>
                {s.partOf && <p className="mt-0.5 text-[10.5px] text-ok/80">part of {s.partOf}</p>}
                <p className="mt-0.5 text-[11px] text-text-2">{s.arch || 'No archetype yet'}</p>
              </div>
              {flow.length === 0 ? <p className="mt-3 rounded-md border border-dashed border-border-strong px-3 py-2 text-center text-[11.5px] text-text-3">No modules on the canvas yet</p> : (
                <ol className="mt-1 flex w-full flex-col items-center">
                  {flow.map(i => (
                    <Fragment key={i.id}>
                      <li aria-hidden className="flex h-4 flex-col items-center"><span className={cx('h-full w-px', LINE)} /></li>
                      <li className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-center shadow-sm">
                        <p className="text-[12px] font-semibold leading-tight">{i.name}{i.calc && <Lock size={9} className="ml-1 inline text-text-3" aria-label="Calculated" />}</p>
                        <p className="text-[10px] text-text-3">{i.lane}</p>
                      </li>
                    </Fragment>))}
                  <li aria-hidden className="flex h-4 flex-col items-center"><span className={cx('h-full w-px', LINE)} /><ArrowDown size={10} className="-mt-0.5 text-text-3" /></li>
                  <li className="w-full rounded-md bg-ok-soft px-2.5 py-1.5 text-center text-[11.5px] font-semibold text-ok">Net revenue</li>
                </ol>
              )}
            </li>))}
        </ul>
        {branches.some(b => b.flow.length) && <p className="mt-3 text-[11.5px] text-text-3">Each branch rolls up into {model || 'the model'} total net revenue.</p>}
      </div>
    </div>
  )
}

function WholeModel({ model, streams, onClose }: { model: string; streams: StreamRef[]; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-brand-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="whole-model-title" onClick={onClose} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="rise flex max-h-[min(90dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div><h2 id="whole-model-title" className="text-[15px] font-semibold">Whole model · {model || 'Model'}</h2><p className="text-[12px] text-text-3">Every revenue stream and the flow it runs on. A quick check before you look at where the data comes from.</p></div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-background px-6 py-6"><ModelFlowTree model={model} streams={streams} /></div>
      </div>
    </div>, document.body)
}

/* ───────────────────────── Review: the stream's patient flow, first step to last ───────────────────────── */

export function PatientFlowList({ map, onEdit }: { map: InputMap | undefined; onEdit?: () => void }) {
  const rows = flowRows(map)
  if (!rows.length) return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border-strong px-6 py-8 text-center">
      <p className="text-sm font-semibold">No inputs on the patient flow yet</p>
      <p className="mt-1 text-[12.5px] text-text-2">Drag inputs onto the canvas in the Module map and the flow appears here.</p>
      {onEdit && <Btn size="sm" variant="secondary" className="mt-3" onClick={onEdit}>Open the Module map</Btn>}
    </div>
  )
  return (
    <ol className="flex flex-col items-stretch" aria-label="Patient flow, first step to last">
      {rows.map((r, k) => (
        <Fragment key={r.id}>
          {k > 0 && <li aria-hidden className="mx-auto flex h-5 flex-col items-center"><span className={cx('h-full w-px', LINE)} /><ArrowDown size={11} className="-mt-0.5 text-text-3" /></li>}
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{k + 1}</span>
            <span className="min-w-[150px] flex-1 text-[13px] font-semibold">{r.name}{r.calc && <Lock size={10} className="ml-1.5 inline text-text-3" aria-label="Calculated" />}</span>
            <span className="rounded bg-brand-soft px-2 py-0.5 text-[11.5px] font-medium text-brand">{r.lane}</span>
            <span className="inline-flex items-center gap-1 text-[11.5px] text-text-3"><Database size={11} />{r.tables ? `${r.tables} Snowflake source${r.tables === 1 ? '' : 's'}` : 'calculated'}</span>
          </li>
        </Fragment>))}
      <li aria-hidden className="mx-auto flex h-5 flex-col items-center"><span className={cx('h-full w-px', LINE)} /><ArrowDown size={11} className="-mt-0.5 text-text-3" /></li>
      <li><div className="rounded-md bg-brand-dark px-3 py-2 text-center text-[12.5px] font-semibold text-white">Archetype engine → net revenue</div></li>
    </ol>
  )
}

/* ───────────────────────── Data sources: where each input comes from (read-only) ───────────────────────── */

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-3'
/** The Snowflake table and schema behind every input on the stream's patient flow. Nothing is chosen here: the sources are fixed by the governed data ecosystem. */
export function SnowflakeSources({ map: saved }: { map: InputMap | undefined }) {
  const map = canvasMap(saved)
  const on = FLOW_INPUTS.filter(i => map[i.id])
  if (!on.length) return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand"><Database size={17} /></span>
      <p className="mt-3 text-sm font-semibold">No inputs on the flow yet</p>
      <p className="mt-1 max-w-sm text-[12.5px] text-text-2">Build the patient flow in the Module map. Each input you place there shows the Snowflake table and schema it is read from.</p>
    </div>
  )
  const mono = 'px-3 py-2.5 align-top font-mono text-[11.5px] [overflow-wrap:anywhere]'
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><Database size={15} /></span>
        <p className="text-[13px] text-text-2"><b className="font-semibold text-text">Where each input is read from.</b> Every input of the patient flow is connected to a governed Snowflake table. This view is read-only: the platform team owns the connections.</p>
      </div>
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[1100px] table-fixed text-[13px]">
        <colgroup><col className="w-[170px]" /><col className="w-[160px]" /><col className="w-[200px]" /><col className="w-[300px]" /><col className="w-[200px]" /><col className="w-[170px]" /></colgroup>
        <thead><tr className="border-b border-border bg-background/60">
          <th scope="col" className={TH}>Input</th><th scope="col" className={TH}>Database</th><th scope="col" className={TH}>Schema</th><th scope="col" className={TH}>Table</th><th scope="col" className={TH}>Columns</th><th scope="col" className={TH}>Filter</th>
        </tr></thead>
        {GROUP_ORDER.filter(g => on.some(i => i.group === g)).map(g => (
          <tbody key={g}>
            <tr className="border-b border-border bg-surface-2/60"><th scope="rowgroup" colSpan={6} className="px-4 py-2 text-left text-xs font-semibold text-text">{g}</th></tr>
            {on.filter(i => i.group === g).map(i => {
              const rows = i.sources.length ? i.sources : [null]
              return rows.map((s, k) => (
                <tr key={`${i.id}-${k}`} className={cx('border-b border-border last:border-0', k > 0 && 'border-t-0')}>
                  {k === 0 && <td rowSpan={rows.length} className="px-4 py-2.5 align-top"><p className="font-medium text-text">{i.name}</p><p className="text-[11.5px] text-text-3">Class: {map[i.id]}</p></td>}
                  {s ? <>
                    <td className={mono}>{s.db}</td><td className={mono}>{s.schema}</td>
                    <td className={mono} title={fqn(s)}>{s.table}{s.note && <span className="mt-0.5 block font-sans text-[11px] text-text-3">{s.note}</span>}</td>
                    <td className={mono}>{s.columns.join(', ')}</td><td className={cx(mono, 'text-text-2')}>{s.filter ?? '—'}</td>
                  </> : <td colSpan={5} className="px-3 py-2.5 align-top text-[12.5px] text-text-3">{i.id === 'fx' ? 'No table needed for a US-only model (1.00). The Finance exchange-rate source is added for ex-US models.' : i.note ?? 'Calculated by the platform from the inputs above. No table of its own.'}</td>}
                </tr>))
            })}
          </tbody>))}
      </table>
    </div>
    </div>
  )
}

/* ───────────────────────── Full flow preview: steps completed, as a simple flow ───────────────────────── */

export type StepView = { stage: number; title: string; state: 'done' | 'current' | 'todo'; lines: string[] }
export type StreamFlow = { id: string; name: string; hue: string; steps: StepView[] }
/** The configuration as a short flow: model setup, then each stream's archetype, modes, module map and data. A step is ticked once it is complete, with what was chosen under it. */
export function FlowSteps({ setup, streams, active, onPick, go, compact }: { setup: StepView; streams: StreamFlow[]; active: string; onPick: (id: string) => void; go: (n: number) => void; compact?: boolean }) {
  const shown = streams.find(s => s.id === active) ?? streams[0]
  const node = (s: StepView, key: string) => (
    <button key={key} type="button" onClick={() => go(s.stage)} title={`Open step ${s.stage}: ${s.title}`}
      className={cx('block w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-brand', s.state === 'done' ? 'border-ok/40 bg-surface' : s.state === 'current' ? 'border-brand bg-brand-soft/50 ring-1 ring-brand/30' : 'border-dashed border-border-strong bg-background/60')}>
      <span className="flex items-center gap-2">
        <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold', s.state === 'done' ? 'bg-ok text-white' : s.state === 'current' ? 'bg-brand text-white' : 'border border-border-strong text-text-3')}>{s.state === 'done' ? <Check size={11} /> : s.stage}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{s.title}</span>
        <span className={cx('shrink-0 text-[10.5px] font-semibold uppercase tracking-wide', s.state === 'done' ? 'text-ok' : s.state === 'current' ? 'text-brand' : 'text-text-3')}>{s.state === 'done' ? 'Done' : s.state === 'current' ? 'In progress' : 'To do'}</span>
      </span>
      {s.lines.length > 0 && <ul className={cx('mt-1.5 space-y-0.5 pl-7 text-[11.5px] leading-snug', s.state === 'todo' ? 'text-text-3' : 'text-text-2')}>{s.lines.map((l, k) => <li key={k} className={compact ? 'truncate' : undefined}>{l}</li>)}</ul>}
    </button>
  )
  const link = <span aria-hidden className="mx-auto block h-3.5 w-px bg-border-strong" />
  return (
    <div data-tour="flow-steps" className="space-y-0">
      {node(setup, 'setup')}
      {link}
      {streams.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Revenue streams">
          {streams.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === shown?.id} onClick={() => onPick(s.id)} className={cx('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium', s.id === shown?.id ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-text-2 hover:border-border-strong')}>
              <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.hue }} /><span className="truncate">{s.name}</span><span className="font-mono text-[10.5px] text-text-3">{s.steps.filter(x => x.state === 'done').length}/{s.steps.length}</span>
            </button>))}
        </div>)}
      {shown && <ol className="space-y-0" aria-label={`Steps for ${shown.name}`}>
        {shown.steps.map((s, k) => <Fragment key={s.stage}>{k > 0 && link}<li>{node(s, `${shown.id}-${s.stage}`)}</li></Fragment>)}
        {link}
        <li><div className={cx('rounded-lg border px-3 py-2.5 text-center text-[12.5px] font-semibold', shown.steps.every(x => x.state === 'done') ? 'border-brand-dark bg-brand-dark text-white' : 'border-dashed border-border-strong text-text-3')}>
          {shown.steps.every(x => x.state === 'done') ? `${shown.name} · ready for the Forecaster` : `${shown.name} · not ready yet`}</div></li>
      </ol>}
    </div>
  )
}

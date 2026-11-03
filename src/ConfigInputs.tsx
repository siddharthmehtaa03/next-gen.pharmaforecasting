import { Fragment, useState } from 'react'
import type { DragEvent } from 'react'
import { ArrowDown, Check, Database, GripVertical, Lock, Plus, RotateCcw, X } from 'lucide-react'
import { FLOW_INPUTS, GROUP_ORDER, INPUT_BY_ID, fqn, mapOf } from './configCatalog'
import type { FlowInput } from './configCatalog'
import { Btn, cx } from './forecaster/workspace/ui'

const DRAG_INPUT = 'application/x-flow-input'

/* ───────────────────────── Module map: inputs onto group classes ───────────────────────── */

export type LaneMod = { id: string; name: string; desc: string; required: boolean; dot?: string }
export type LaneView = { name: string; mods: LaneMod[]; addable: { id: string; name: string }[]; engine?: boolean }

/** The model's group classes in calculation order, as drop zones. The patient-flow inputs sit in a library beside them: drag one onto a class to map it there, or back to the library to unmap it. */
export function InputMapBoard({ lanes, map: saved, setMap, onAddModule, onRemoveModule, onInspect, engine, streamName }: {
  lanes: LaneView[]; map: Record<string, string> | undefined; setMap: (m: Record<string, string>) => void
  onAddModule: (id: string) => void; onRemoveModule: (id: string) => void; onInspect: (id: string) => void; engine: string; streamName: string
}) {
  const map = mapOf(saved)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const mapped = FLOW_INPUTS.filter(i => map[i.id]).length
  const put = (id: string, lane: string) => { if (INPUT_BY_ID[id] && map[id] !== lane) setMap({ ...map, [id]: lane }) }
  const dropOn = (lane: string) => (e: DragEvent) => { e.preventDefault(); setOver(null); setDrag(null); put(e.dataTransfer.getData(DRAG_INPUT), lane) }
  const allow = (key: string) => (e: DragEvent) => { if (e.dataTransfer.types.includes(DRAG_INPUT)) { e.preventDefault(); setOver(key) } }
  const chip = (i: FlowInput, inLane: boolean) => (
    <li key={i.id} draggable onDragStart={e => { e.dataTransfer.setData(DRAG_INPUT, i.id); e.dataTransfer.effectAllowed = 'move'; setDrag(i.id) }} onDragEnd={() => { setDrag(null); setOver(null) }}
      title={`${i.name}: ${i.desc} Drag to another group class to map it there.`}
      className={cx('group flex cursor-grab items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12.5px] font-medium active:cursor-grabbing', inLane ? 'border-brand/40 bg-brand-soft text-brand' : 'border-border bg-surface text-text hover:border-brand', drag === i.id && 'opacity-40')}>
      <GripVertical size={12} className="shrink-0 text-text-3 group-hover:text-brand" aria-hidden />
      <span className="min-w-0 truncate">{i.name}</span>
      {i.calc && <span title="Calculated by the platform" className="shrink-0 text-text-3"><Lock size={10} /></span>}
    </li>
  )
  return (
    <div className="grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_300px]" data-tour="input-map">
      <section aria-label="Group classes" className="min-w-0 rounded-2xl border border-border bg-surface shadow-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div><h3 className="text-sm font-semibold">Group classes · {streamName || 'Stream'}</h3><p className="text-xs text-text-2">{engine}. Classes run top to bottom, in calculation order.</p></div>
          <span className="text-[11px] text-text-3">Drop an input on a class to map it</span>
        </div>
        <ol className="flex flex-col items-stretch">
          {lanes.map((l, k) => {
            const ins = FLOW_INPUTS.filter(i => map[i.id] === l.name)
            const hot = over === l.name && !!drag
            return (
              <Fragment key={l.name}>
                {k > 0 && <li aria-hidden className="mx-auto h-4 w-px bg-border-strong" />}
                <li>
                  {l.engine
                    ? <div className="rounded-md border border-border bg-brand-dark px-3 py-2 text-center text-[12.5px] font-semibold text-white">{l.name}<span className="ml-2 font-normal text-white/70">{engine}</span></div>
                    : (
                      <div onDragOver={allow(l.name)} onDragLeave={() => setOver(o => (o === l.name ? null : o))} onDrop={dropOn(l.name)}
                        className={cx('rounded-lg border bg-background/60 p-3 transition-colors', hot ? 'border-2 border-dashed border-brand bg-brand-soft/50' : 'border-border')}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-text-2">{l.name}</p>
                          <span className="font-mono text-[11px] text-text-3">{ins.length} input{ins.length === 1 ? '' : 's'} · {l.mods.length} module{l.mods.length === 1 ? '' : 's'}</span>
                        </div>
                        {(ins.length > 0 || l.mods.length > 0) ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {ins.length > 0 && <ul className="contents">{ins.map(i => chip(i, true))}</ul>}
                            {l.mods.map(m => (
                              <span key={m.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-text-2" title={m.desc}>
                                {m.dot && <i className={cx('h-1.5 w-1.5 shrink-0 rounded-full', m.dot)} />}
                                <button type="button" onClick={() => onInspect(m.id)} className="truncate hover:text-brand">{m.name}</button>
                                {m.required ? <Lock size={10} className="shrink-0 text-text-3" aria-label="Required by the archetype" /> : <button type="button" onClick={() => onRemoveModule(m.id)} aria-label={`Remove ${m.name}`} className="text-text-3 hover:text-err"><X size={11} /></button>}
                              </span>))}
                          </div>
                        ) : <p className="mt-2 rounded-md border border-dashed border-border-strong px-3 py-2 text-center text-[12px] text-text-3">Nothing here yet. Drop an input on this class.</p>}
                        {l.addable.length > 0 && (
                          <label className="mt-2 flex items-center gap-1.5 text-[11.5px] text-text-3"><Plus size={11} />
                            <select aria-label={`Add a module to ${l.name}`} value="" onChange={e => { if (e.target.value) onAddModule(e.target.value) }} className="max-w-[220px] cursor-pointer rounded border border-transparent bg-transparent py-0.5 text-[11.5px] text-text-2 hover:border-border focus:border-brand">
                              <option value="">Add a module</option>{l.addable.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select></label>)}
                      </div>)}
                </li>
              </Fragment>
            )
          })}
          <li aria-hidden className="mx-auto h-4 w-px bg-border-strong" />
          <li className="mx-auto"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-dark text-white" title="Handed to the Forecaster after finalisation"><ArrowDown size={14} /></span></li>
        </ol>
      </section>

      <aside aria-label="Patient-flow inputs" onDragOver={allow('__library')} onDragLeave={() => setOver(o => (o === '__library' ? null : o))} onDrop={e => { e.preventDefault(); setOver(null); setDrag(null); const id = e.dataTransfer.getData(DRAG_INPUT); if (INPUT_BY_ID[id]) setMap({ ...map, [id]: '' }) }}
        className={cx('flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface @3xl:sticky @3xl:top-4 @3xl:max-h-[calc(100dvh-140px)]', over === '__library' && drag ? 'border-2 border-dashed border-err' : 'border-border')}>
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Patient-flow inputs</h3><span className="font-mono text-[11px] text-text-3">{mapped}/{FLOW_INPUTS.length} mapped</span></div>
          <p className="mt-1 text-[11.5px] text-text-3">The inputs of the Forecaster’s patient flow. Drag one onto a group class; drag it back here to unmap it.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {GROUP_ORDER.map(g => (
            <section key={g} aria-label={g}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-2">{g === 'Epi funnel' ? 'Epi funnel' : g}</p>
              <ul className="space-y-1.5">
                {FLOW_INPUTS.filter(i => i.group === g).map(i => (
                  <li key={i.id} draggable onDragStart={e => { e.dataTransfer.setData(DRAG_INPUT, i.id); e.dataTransfer.effectAllowed = 'move'; setDrag(i.id) }} onDragEnd={() => { setDrag(null); setOver(null) }}
                    className={cx('group cursor-grab rounded-md border bg-surface p-2 shadow-sm transition-all hover:-translate-y-px hover:border-brand active:cursor-grabbing', map[i.id] ? 'border-border' : 'border-warn/60', drag === i.id && 'opacity-40')}>
                    <div className="flex items-start gap-1.5">
                      <GripVertical size={13} className="mt-0.5 shrink-0 text-text-3 group-hover:text-brand" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-[13px] font-semibold leading-tight">{i.name}{i.calc && <Lock size={10} className="text-text-3" aria-label="Calculated" />}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-2">{i.desc}</p>
                        <p className={cx('mt-1 flex items-center gap-1 text-[11px] font-medium', map[i.id] ? 'text-ok' : 'text-warn')}>{map[i.id] ? <><Check size={11} />{map[i.id]}</> : 'Not mapped to a class'}</p>
                      </div>
                    </div>
                    <label className="sr-only focus-within:not-sr-only focus-within:mt-1.5 focus-within:block">
                      <span className="text-[11px] text-text-3">Map {i.name} to</span>
                      <select aria-label={`Map ${i.name} to a group class`} value={map[i.id]} onChange={e => setMap({ ...map, [i.id]: e.target.value })} className="mt-0.5 block w-full rounded border border-border-strong bg-surface px-1.5 py-1 text-[12px]">
                        <option value="">Not mapped</option>{lanes.filter(l => !l.engine).map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                      </select>
                    </label>
                  </li>))}
              </ul>
            </section>))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="text-[11px] text-text-3">Defaults follow the Forecaster’s flow.</p>
          <Btn size="sm" variant="ghost" icon={<RotateCcw size={12} />} onClick={() => setMap(mapOf())}>Reset</Btn>
        </div>
      </aside>
    </div>
  )
}

/* ───────────────────────── Data configuration: where each input comes from (read-only) ───────────────────────── */

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-3'
/** Each input and the Snowflake table and schema it is read from. Nothing is chosen here: the sources are fixed by the governed data ecosystem. */
export function SnowflakeSources({ map: saved }: { map: Record<string, string> | undefined }) {
  const map = mapOf(saved)
  const mono = 'px-3 py-2.5 align-top font-mono text-[12px]'
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><Database size={15} /></span>
        <p className="text-[13px] text-text-2"><b className="font-semibold text-text">Where each input is read from.</b> Every input of the patient flow is connected to a governed Snowflake table. This view is read-only: the platform team owns the connections.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead><tr className="border-b border-border bg-background/60">
            <th scope="col" className={TH}>Input</th><th scope="col" className={TH}>Database</th><th scope="col" className={TH}>Schema</th><th scope="col" className={TH}>Table</th><th scope="col" className={TH}>Columns</th><th scope="col" className={TH}>Filter</th>
          </tr></thead>
          {GROUP_ORDER.map(g => (
            <tbody key={g}>
              <tr className="border-b border-border bg-surface-2/60"><th scope="rowgroup" colSpan={6} className="px-4 py-2 text-left text-xs font-semibold text-text">{g}</th></tr>
              {FLOW_INPUTS.filter(i => i.group === g).map(i => {
                const rows = i.sources.length ? i.sources : [null]
                return rows.map((s, k) => (
                  <tr key={`${i.id}-${k}`} className={cx('border-b border-border last:border-0', k > 0 && 'border-t-0')}>
                    {k === 0 && <td rowSpan={rows.length} className="px-4 py-2.5 align-top"><p className="font-medium text-text">{i.name}</p><p className="text-[11.5px] text-text-3">{map[i.id] ? `Class: ${map[i.id]}` : 'Not mapped to a class'}</p></td>}
                    {s ? <>
                      <td className={mono}>{s.db}</td><td className={mono}>{s.schema}</td>
                      <td className={cx(mono, 'break-all')} title={fqn(s)}>{s.table}{s.note && <span className="mt-0.5 block font-sans text-[11px] text-text-3">{s.note}</span>}</td>
                      <td className={cx(mono, 'break-words')}>{s.columns.join(', ')}</td><td className={cx(mono, 'break-words text-text-2')}>{s.filter ?? '—'}</td>
                    </> : <td colSpan={5} className="px-3 py-2.5 align-top text-[12.5px] text-text-3">{i.id === 'fx' ? 'No table needed for a US-only model (1.00). The Finance exchange-rate source is added for ex-US models.' : 'Calculated by the platform from the inputs above. No table of its own.'}</td>}
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

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, AtSign, BarChart3, Bookmark, CornerDownRight, Download, MessageSquare, MoreHorizontal, Pin, Plus, Search, Send, Sparkles, StickyNote, Trash2, X } from 'lucide-react'
import { BRANDS } from './Home'
import { Btn, Card, ForecastChart, Legend, Seg, Tag, cx, field } from './ui'
import { Overlay } from '../../components/Overlay'
import { downloadImage, downloadPdf, downloadPptx } from '../../chart/ChartActions'
import { PEOPLE, person } from './insights'
import type { Insight, InsightKind, Msg } from './insights'

export function Avatar({ id, size = 26 }: { id: string; size?: number }) {
  const p = person(id), ini = p.name.split(/[\s.]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('')
  return <span title={`${p.name} · ${p.role}`} className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: p.color, fontSize: size * 0.4 }}>{ini}</span>
}
const KIND_ICON = { View: BarChart3, Scenario: Bookmark, Note: StickyNote } as const
const MENTION = new RegExp(`(@(?:${PEOPLE.map(p => p.name.replace(/\./g, '\\.')).join('|')}))`, 'g')
export function Mentions({ text }: { text: string }) {
  return <>{text.split(MENTION).map((part, i) => i % 2 === 1 ? <span key={i} className="rounded bg-brand-soft px-1 font-medium text-brand">{part}</span> : <Fragment key={i}>{part}</Fragment>)}</>
}
const REPLY: Record<string, string> = {
  daniel: 'Thanks. I will pull this into the Finance bridge and confirm before Thursday.',
  priya: 'Looks right to me. I will bring it to the brand team sync.',
  tom: 'I will check the payer timelines and come back with dates.',
  sara: 'I can re-cut this against the latest actuals if that helps.',
  aiko: 'Noted. I will check whether the model needs a change on the CoE side.',
}

type Notify = (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void
type Props = { insights: Insight[]; setInsights: (f: (x: Insight[]) => Insight[]) => void; brandId?: string; embedded?: boolean; onOpenBrand?: (id: string) => void; onAsk?: (id?: string) => void; notify: Notify }

export default function InsightsBoard({ insights, setInsights, brandId, embedded, onOpenBrand, onAsk, notify }: Props) {
  const [kind, setKind] = useState<'all' | InsightKind>('all')
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState('')
  const [brandF, setBrandF] = useState<string>('all')
  const [sel, setSel] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const scope = brandId ? insights.filter(i => i.brandId === brandId) : insights
  const brandName = brandId ? BRANDS.find(b => b.id === brandId)?.brand : undefined
  const shown = useMemo(() => scope
    .filter(i => (brandId || brandF === 'all' || i.brandId === brandF) && (kind === 'all' || i.kind === kind) && (!mine || i.tagged.includes('me')) &&
      (!q.trim() || `${i.title} ${i.note} ${i.brand}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)), [scope, brandId, brandF, kind, mine, q])
  const open = scope.find(i => i.id === sel)
  const patch = (id: string, f: (i: Insight) => Insight) => setInsights(xs => xs.map(x => x.id === id ? f(x) : x))
  const brandsWith = BRANDS.filter(b => insights.some(i => i.brandId === b.id))
  const taggedMe = scope.filter(i => i.tagged.includes('me')).length

  if (open) {
    // The opened card stays in the list even if a filter would hide it.
    const list = shown.some(i => i.id === open.id) ? shown : [open, ...shown]
    return <SplitView i={open} list={list} onPick={setSel} onClose={() => setSel(null)} patch={f => patch(open.id, f)} notify={notify}
      onDelete={() => { setInsights(xs => xs.filter(x => x.id !== open.id)); setSel(null) }} onOpenBrand={onOpenBrand} />
  }

  const body = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{brandName ? `${brandName} insights` : 'Insights board'}</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-2">{brandName ? `Saved views and scenarios for ${brandName}. Comment and tag colleagues to discuss them.` : 'Every graph and note saved from the Forecaster. Open one to discuss it with your team.'}</p>
        </div>
        <div className="flex gap-2">
          {onAsk && !embedded && <Btn variant="secondary" icon={<Sparkles size={15} />} onClick={() => onAsk(brandId)}>Ask Forecast AI</Btn>}
          <Btn icon={<Plus size={15} />} onClick={() => setAdding(v => !v)}>Add note</Btn>
        </div>
      </div>

      {adding && <NewNote brandId={brandId} onClose={() => setAdding(false)} onSave={n => { setInsights(xs => [n, ...xs]); setAdding(false); setSel(n.id); notify({ tone: 'ok', text: 'Note added to Insights.' }) }} />}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Seg label="Type" value={kind} onChange={setKind} options={[{ id: 'all', label: `All · ${scope.length}` }, { id: 'View', label: 'Views' }, { id: 'Scenario', label: 'Scenarios' }, { id: 'Note', label: 'Notes' }]} />
        <button type="button" aria-pressed={mine} onClick={() => setMine(v => !v)} className={cx('inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium', mine ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong text-text-2 hover:text-text')}><AtSign size={13} />Tagged me · {taggedMe}</button>
        <label className="relative ml-auto w-full max-w-[260px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search insights" aria-label="Search insights" className={cx(field, 'pl-8')} /></label>
      </div>
      {!brandId && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Brand">
          {[{ id: 'all', brand: 'All brands' }, ...brandsWith].map(b => <button key={b.id} type="button" role="radio" aria-checked={brandF === b.id} onClick={() => setBrandF(b.id)}
            className={cx('rounded-full border px-3 py-1 text-[12px] font-medium', brandF === b.id ? 'border-brand bg-brand-soft text-brand' : 'border-border-strong text-text-2 hover:text-text')}>{b.brand}{b.id !== 'all' && <span className="ml-1.5 text-text-3">{insights.filter(i => i.brandId === b.id).length}</span>}</button>)}
        </div>
      )}

      <div className="mt-5 grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map(i => <InsightCard key={i.id} i={i} showBrand={!brandId} onOpen={() => setSel(i.id)} notify={notify} />)}
        {!shown.length && (
          <div className="col-span-full rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
            <Bookmark size={20} className="mx-auto text-text-3" />
            <p className="mt-2 text-sm font-medium">{scope.length ? 'No insights match these filters.' : 'No insights saved yet.'}</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-text-2">{scope.length ? 'Clear a filter to see more.' : 'Use “Save to Insights” on any chart, or add a note, to start the board.'}</p>
          </div>
        )}
      </div>
    </>
  )
  return embedded ? <div>{body}</div> : <div className="min-h-full bg-surface-2"><main className="workspace-page">{body}</main></div>
}

/** PNG, PDF or PowerPoint of one chart. `target` returns the element to capture at click time. */
function DownloadMenu({ title, subtitle, target, notify, compact }: { title: string; subtitle: string; target: () => HTMLElement | null; notify: Notify; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const run = async (kind: 'png' | 'pdf' | 'pptx') => {
    setOpen(false)
    const el = target(); if (!el) return
    try {
      if (kind === 'png') await downloadImage(el, title)
      else if (kind === 'pdf') downloadPdf(el, title, subtitle)
      else await downloadPptx(el, title, subtitle)
      notify({ tone: 'ok', text: kind === 'pdf' ? 'Opened the print dialog. Choose “Save as PDF”.' : `Downloaded ${kind === 'png' ? 'PNG' : 'PowerPoint'}.` })
    } catch { notify({ tone: 'err', text: 'Download failed. Allow pop-ups for this site and try again.' }) }
  }
  return (
    <>
      <button ref={ref} type="button" onClick={e => { e.stopPropagation(); setOpen(v => !v) }} aria-label={`Download ${title}`} aria-haspopup="menu" aria-expanded={open} title="Download"
        className={cx('inline-flex items-center gap-1.5 rounded-md text-text-2 transition-colors hover:bg-surface-2 hover:text-text', compact ? 'h-7 w-7 justify-center' : 'h-8 border border-border-strong px-2.5 text-[13px] font-medium')}>
        <Download size={compact ? 14 : 13} />{!compact && 'Download'}</button>
      <Overlay anchor={ref} open={open} onClose={() => setOpen(false)} width={180}>
        {([['png', 'Image (PNG)'], ['pdf', 'PDF'], ['pptx', 'PowerPoint']] as const).map(([k, l]) => (
          <button key={k} type="button" role="menuitem" onClick={e => { e.stopPropagation(); void run(k) }} className="flex w-full px-3 py-1.5 text-left text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">{l}</button>))}
      </Overlay>
    </>
  )
}

// Every card is the same size; the preview area is fixed so graphs and notes line up in the grid.
function InsightCard({ i, showBrand, onOpen, notify }: { i: Insight; showBrand: boolean; onOpen: () => void; notify: Notify }) {
  const Icon = KIND_ICON[i.kind]
  const chart = useRef<HTMLDivElement>(null)
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }} aria-label={`Open ${i.title}`}
      className="flex h-[328px] cursor-pointer flex-col rounded-lg border border-border bg-surface p-4 text-left outline-none transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand">
      <div className="flex h-7 items-center gap-1.5">
        <Tag tone={i.kind === 'Scenario' ? 'ok' : i.kind === 'View' ? 'brand' : 'neutral'}><Icon size={11} />{i.kind}</Tag>
        {showBrand && <Tag>{i.brand}</Tag>}
        {i.pinned && <Pin size={12} className="text-brand" aria-label="Pinned" />}
        <span className="ml-auto text-[11px] text-text-3">{i.at}</span>
        {i.snap && <DownloadMenu compact title={i.title} subtitle={`${i.brand} · ${i.cycle}`} target={() => chart.current} notify={notify} />}
      </div>
      <h3 className="mt-2 line-clamp-2 min-h-[2.6em] text-[14px] font-semibold leading-snug">{i.title}</h3>
      <div className="mt-2 h-[150px] overflow-hidden">
        {i.snap
          ? <div ref={chart} className="pointer-events-none -mx-1 bg-surface"><ForecastChart s={i.snap.series} fmt={i.snap.fmt} dp={i.snap.dp} unit={i.snap.unit} height={150} toolbar={false} canSave={false} defaultGrain={i.snap.grain} title={i.title} /></div>
          : <p className="line-clamp-6 text-[13px] leading-relaxed text-text-2">{i.note}</p>}
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-2.5">
        <Avatar id={i.by} size={22} /><span className="truncate text-[12px] text-text-2">{person(i.by).name}</span>
        <span className="ml-auto flex items-center gap-2 text-[12px] text-text-3">
          {i.tagged.length > 0 && <span className="flex -space-x-1.5">{i.tagged.slice(0, 3).map(t => <span key={t} className="rounded-full ring-2 ring-surface"><Avatar id={t} size={20} /></span>)}</span>}
          <span className="inline-flex items-center gap-1"><MessageSquare size={13} />{i.thread.length}</span>
        </span>
      </div>
    </div>
  )
}

/** Three panels: the board as a list, the opened insight, and its discussion. */
function SplitView({ i, list, onPick, onClose, patch, onDelete, onOpenBrand, notify }: {
  i: Insight; list: Insight[]; onPick: (id: string) => void; onClose: () => void; patch: (f: (x: Insight) => Insight) => void; onDelete: () => void; onOpenBrand?: (id: string) => void; notify: Notify }) {
  const chart = useRef<HTMLDivElement>(null)
  const activeRow = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).closest?.('textarea,input')) onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  useEffect(() => { activeRow.current?.scrollIntoView({ block: 'nearest' }) }, [i.id])
  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col bg-surface-2">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-5 py-2.5">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-text-2 hover:bg-surface-2 hover:text-text"><ArrowLeft size={15} />Insights board</button>
        <span className="text-[12px] text-text-3">{list.findIndex(x => x.id === i.id) + 1} of {list.length}</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_380px]">
        <nav aria-label="Insights" className="min-h-0 overflow-y-auto border-r border-border bg-surface p-3">
          <ul className="space-y-2">
            {list.map(x => {
              const on = x.id === i.id
              return (
                <li key={x.id}>
                  <button ref={on ? activeRow : undefined} type="button" onClick={() => onPick(x.id)} aria-current={on ? 'true' : undefined}
                    className={cx('block w-full rounded-lg border p-2.5 text-left transition-colors', on ? 'border-brand bg-brand-soft/40 ring-1 ring-brand/20' : 'border-border hover:border-border-strong hover:bg-surface-2')}>
                    <span className="flex items-center gap-1.5 text-[11px] text-text-3"><span className="font-medium text-text-2">{x.brand}</span>·<span>{x.kind}</span><span className="ml-auto inline-flex items-center gap-1"><MessageSquare size={11} />{x.thread.length}</span></span>
                    <span className="mt-1 line-clamp-2 block text-[12.5px] font-medium leading-snug">{x.title}</span>
                    <span className="mt-1.5 block h-[64px] overflow-hidden rounded-md bg-surface">
                      {x.snap
                        ? <span className="pointer-events-none block"><ForecastChart s={x.snap.series} fmt={x.snap.fmt} dp={x.snap.dp} unit={x.snap.unit} height={64} toolbar={false} canSave={false} defaultGrain={x.snap.grain} title={x.title} /></span>
                        : <span className="line-clamp-3 block px-1 text-[11.5px] leading-snug text-text-3">{x.note}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section aria-label="Insight" className="min-h-0 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><Tag tone="brand">{i.kind}</Tag><Tag>{i.brand}</Tag><Tag>{i.cycle}</Tag>{i.scenario && <Tag tone="ok">{i.scenario}</Tag>}</div>
                <h2 className="mt-2 text-[18px] font-semibold leading-snug">{i.title}</h2>
                <p className="mt-1 text-[12px] text-text-3">{person(i.by).name} · {i.at}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {i.snap && <DownloadMenu title={i.title} subtitle={`${i.brand} · ${i.cycle}`} target={() => chart.current} notify={notify} />}
                <Btn variant="secondary" icon={<Pin size={13} />} onClick={() => patch(x => ({ ...x, pinned: !x.pinned }))}>{i.pinned ? 'Unpin' : 'Pin'}</Btn>
                <MoreMenu brand={i.brand} onOpenBrand={onOpenBrand && (() => onOpenBrand(i.brandId))} onDelete={onDelete} />
              </div>
            </div>
            {i.snap && (
              <div className="mt-5 rounded-lg border border-border bg-surface p-4">
                <div ref={chart} className="bg-surface"><div className="mb-2"><Legend s={i.snap.series} /></div>
                  <ForecastChart s={i.snap.series} fmt={i.snap.fmt} dp={i.snap.dp} unit={i.snap.unit} height={360} toolbar canSave={false} defaultGrain={i.snap.grain} title={i.title} context={`${i.brand} · ${i.cycle}`} /></div>
              </div>
            )}
            <p className="mt-5 text-[14px] leading-relaxed text-text-2">{i.note}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Tagged</span>
              {i.tagged.length ? i.tagged.map(t => <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-surface py-0.5 pl-0.5 pr-2.5 text-[12px] ring-1 ring-border"><Avatar id={t} size={20} />{person(t).name}</span>) : <span className="text-[12px] text-text-3">Nobody yet. Type @ in a comment to tag someone.</span>}
            </div>
          </div>
        </section>

        <Discussion key={i.id} i={i} patch={patch} />
      </div>
    </div>
  )
}

function MoreMenu({ brand, onOpenBrand, onDelete }: { brand: string; onOpenBrand?: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen(v => !v)} aria-label="More actions" aria-haspopup="menu" aria-expanded={open} title="More"
        className="grid h-8 w-8 place-items-center rounded-md border border-border-strong text-text-2 hover:bg-surface-2 hover:text-text"><MoreHorizontal size={15} /></button>
      <Overlay anchor={ref} open={open} onClose={() => setOpen(false)} width={210}>
        {onOpenBrand && <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenBrand() }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-2 hover:bg-surface-2 hover:text-text"><ArrowUpRight size={14} />Open {brand} forecast</button>}
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete() }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-err hover:bg-err-soft"><Trash2 size={14} />Delete</button>
      </Overlay>
    </>
  )
}

function Discussion({ i, patch }: { i: Insight; patch: (f: (x: Insight) => Insight) => void }) {
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Msg | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [i.thread.length])
  const m = /@([A-Za-z]*)$/.exec(text)
  const options = m ? PEOPLE.filter(p => p.id !== 'me' && p.name.toLowerCase().includes(m[1]!.toLowerCase())) : []
  const pick = (name: string) => { setText(t => t.replace(/@([A-Za-z]*)$/, `@${name} `)); ref.current?.focus() }
  const rootOf = (c: Msg) => c.parent ?? c.id
  const post = () => {
    const t = text.trim(); if (!t) return
    const mentions = PEOPLE.filter(p => p.id !== 'me' && t.includes('@' + p.name))
    const parent = replyTo ? rootOf(replyTo) : undefined
    const id = `m${Date.now()}`
    patch(x => ({ ...x, tagged: [...new Set([...x.tagged, ...mentions.map(p => p.id)])], thread: [...x.thread, { id, by: 'me', text: t, at: 'Just now', parent }] }))
    setText(''); setReplyTo(null)
    // Simulated teammate reply: whoever was tagged or replied to answers in the same thread.
    const who = mentions[0] ?? (replyTo && replyTo.by !== 'me' ? person(replyTo.by) : undefined)
    if (who) window.setTimeout(() => patch(x => ({ ...x, thread: [...x.thread, { id: `r${Date.now()}`, by: who.id, text: `@J. Andersen ${REPLY[who.id] ?? 'Thanks, noted.'}`, at: 'Just now', parent: parent ?? id }] })), 2200)
  }
  const roots = i.thread.filter(c => !c.parent || !i.thread.some(r => r.id === c.parent))
  const replies = (id: string) => i.thread.filter(c => c.parent === id)
  const Reply = ({ c }: { c: Msg }) => <button type="button" onClick={() => { setReplyTo(c); ref.current?.focus() }} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-text-3 hover:text-brand"><CornerDownRight size={12} />Reply</button>
  return (
    <aside aria-label="Discussion" className="flex min-h-0 flex-col border-l border-border bg-surface">
      <h3 className="shrink-0 border-b border-border px-5 py-3 text-[14px] font-semibold">Discussion · {i.thread.length}</h3>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ul className="space-y-5">
          {i.thread.length === 0 && <li className="text-[13px] text-text-3">No comments yet. Start the conversation and tag who should weigh in.</li>}
          {roots.map(c => {
            const rs = replies(c.id)
            return (
              <li key={c.id}>
                <div className="relative flex gap-2.5 pb-1">
                  {rs.length > 0 && <span aria-hidden className="absolute bottom-0 left-[12px] top-[30px] w-0.5 bg-border-strong/70" />}
                  <Avatar id={c.by} />
                  <div className="min-w-0 flex-1"><p className="text-[12px]"><b className="font-semibold">{person(c.by).name}</b><span className="ml-2 text-text-3">{c.at}</span></p>
                    <p className="mt-0.5 text-[13px] leading-snug text-text-2"><Mentions text={c.text} /></p><Reply c={c} /></div>
                </div>
                {rs.length > 0 && <ul className="ml-[12px]">{rs.map((r, k) => (
                  <li key={r.id} className="relative pl-8 pt-3">
                    <span aria-hidden className="absolute left-0 top-0 h-[24px] w-7 rounded-bl-xl border-b-2 border-l-2 border-border-strong/70" />
                    {k < rs.length - 1 && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-0.5 bg-border-strong/70" />}
                    <div className="flex gap-2.5"><Avatar id={r.by} size={24} />
                      <div className="min-w-0 flex-1"><p className="text-[12px]"><b className="font-semibold">{person(r.by).name}</b><span className="ml-2 text-text-3">{r.at}</span></p>
                        <p className="mt-0.5 text-[13px] leading-snug text-text-2"><Mentions text={r.text} /></p><Reply c={r} /></div></div>
                  </li>))}</ul>}
              </li>
            )
          })}
        </ul>
        <div ref={end} />
      </div>
      <div className="relative shrink-0 border-t border-border p-4">
        {options.length > 0 && (
          <ul role="listbox" aria-label="Tag someone" className="dropdown-container rise absolute bottom-full left-4 right-4 mb-1">
            {options.map(p => <li key={p.id}><button type="button" role="option" aria-selected={false} onMouseDown={e => { e.preventDefault(); pick(p.name) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-surface-2"><Avatar id={p.id} size={22} /><span className="font-medium">{p.name}</span><span className="text-text-3">{p.role}</span></button></li>)}
          </ul>
        )}
        {replyTo && <p className="mb-2 flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px] text-text-2"><CornerDownRight size={12} />Replying to <b className="font-semibold">{person(replyTo.by).name}</b><button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="ml-auto text-text-3 hover:text-text"><X size={13} /></button></p>}
        <textarea ref={ref} rows={2} value={text} onChange={e => setText(e.target.value)} aria-label="Add a comment" placeholder={replyTo ? 'Write a reply' : 'Add a comment. Type @ to tag someone'} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !options.length) { e.preventDefault(); post() } }} className={cx(field, 'h-auto resize-none py-2')} />
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => { setText(t => t + (t && !t.endsWith(' ') ? ' @' : '@')); ref.current?.focus() }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] font-medium text-text-2 hover:bg-surface-2"><AtSign size={13} />Tag people</button>
          <Btn disabled={!text.trim()} onClick={post} icon={<Send size={13} />}>{replyTo ? 'Reply' : 'Comment'}</Btn>
        </div>
      </div>
    </aside>
  )
}

function NewNote({ brandId, onClose, onSave }: { brandId?: string; onClose: () => void; onSave: (n: Insight) => void }) {
  const [b, setB] = useState(brandId ?? BRANDS[0]!.id)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const br = BRANDS.find(x => x.id === b)!
  return (
    <Card className="mt-5" title="New note" right={<button type="button" aria-label="Close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded text-text-2 hover:bg-surface-2"><X size={15} /></button>}>
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        {!brandId && <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Brand</span><select value={b} onChange={e => setB(e.target.value)} className={field}>{BRANDS.map(x => <option key={x.id} value={x.id}>{x.brand}</option>)}</select></label>}
        <label className={cx('block', brandId && 'sm:col-span-2')}><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Title</span><input value={title} onChange={e => setTitle(e.target.value)} className={field} placeholder="What should people know?" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-3">Details</span><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className={cx(field, 'h-auto resize-y py-2')} /></label>
      </div>
      <div className="mt-3 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!title.trim()} onClick={() => onSave({ id: `n${Date.now()}`, brandId: b, brand: br.brand, cycle: br.cycle, kind: 'Note', title: title.trim(), note: note.trim(), by: 'me', at: 'Just now', tagged: [], thread: [] })}>Save note</Btn></div>
    </Card>
  )
}

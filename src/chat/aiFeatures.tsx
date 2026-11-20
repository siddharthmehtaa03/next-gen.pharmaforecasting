import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle, ArrowUpRight, BadgeCheck, Boxes, Check, CheckCircle2, ChevronDown, CircleDashed, CircleMinus, Download, FileText,
  Image as ImageIcon, Loader2, Pencil, RotateCw, ShieldCheck, Sparkles, SquareArrowOutUpRight, Target, TriangleAlert, User, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { downloadImage, downloadPdf } from '../chart/ChartActions'
import type { Source } from './ChatShell'

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/** Lets a feature card open the shared provenance panel without threading the handler through every prop. */
const OpenSrc = createContext<((n: number) => void) | undefined>(undefined)
export const SourceProvider = OpenSrc.Provider
export const useOpenSource = () => useContext(OpenSrc)

/* ───────────────────────── CF-1 · AI thinking status ───────────────────────── */

export type StepState = 'pending' | 'running' | 'done' | 'failed' | 'stopped'
/** One line of the assistant's working. `cites` are 1-based indexes into the message's sources. */
export type Step = { label: string; state?: StepState; cites?: number[]; reason?: string }
export type StepInput = string | Step

const asStep = (s: StepInput): Step => typeof s === 'string' ? { label: s, state: 'done' } : { state: 'done', ...s }
const STEP_ICON: Record<StepState, { node: ReactNode; label: string }> = {
  done: { node: <Check size={11} />, label: 'done' },
  running: { node: <Loader2 size={11} className="animate-spin" />, label: 'running' },
  pending: { node: <CircleDashed size={11} />, label: 'pending' },
  failed: { node: <AlertCircle size={11} />, label: 'failed' },
  stopped: { node: <CircleMinus size={11} />, label: 'stopped' },
}
const STEP_TINT: Record<StepState, string> = {
  done: 'bg-ok-soft text-ok', running: 'bg-brand-soft text-brand', pending: 'bg-surface-2 text-text-3',
  failed: 'bg-err-soft text-err', stopped: 'bg-surface-2 text-text-3',
}

/** The assistant's working, as steps the user can read. Open while it runs, a summary pill once it lands. */
export function StepList({ steps, sources = [], live, onCite, onRetry, onRephrase }: {
  steps: StepInput[]; sources?: Source[]; live?: boolean
  onCite?: (i: number) => void; onRetry?: () => void; onRephrase?: () => void }) {
  const rows = steps.map(asStep)
  const [open, setOpen] = useState(false)
  const failed = rows.find(s => s.state === 'failed')
  const cited = new Set(rows.flatMap(s => s.cites ?? []))
  const shown = live || open || !!failed

  if (!rows.length) {
    return <p className="mb-2.5 inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[12px] text-text-3"><Sparkles size={12} />Answered from conversation</p>
  }
  return (
    <div className="mb-2.5">
      {!live && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
          className={cx('inline-flex h-7 items-center gap-1.5 rounded-full border bg-surface px-2.5 text-[12px] font-medium transition-colors',
            failed ? 'border-err/40 text-err hover:border-err' : 'border-border text-text-2 hover:border-brand hover:text-brand')}>
          {failed ? <AlertCircle size={12} /> : <Check size={12} className="text-ok" />}
          {rows.length} step{rows.length === 1 ? '' : 's'}{cited.size > 0 && ` · ${cited.size} source${cited.size === 1 ? '' : 's'}`}
          <ChevronDown size={12} className={cx('text-text-3 transition-transform', shown && 'rotate-180')} />
        </button>
      )}
      {shown && (
        <ol className={cx('ml-1.5', live ? '' : 'rise mt-2.5')} aria-label="How this answer was built" aria-live={live ? 'polite' : undefined}>
          {rows.map((s, k) => {
            const st = s.state ?? 'done'
            return (
              <li key={`${s.label}-${k}`} className="relative flex gap-3 pb-3.5 last:pb-0">
                {k < rows.length - 1 && <span aria-hidden className="absolute left-[9px] top-5 h-[calc(100%-12px)] w-px bg-border-strong" />}
                <span className={cx('relative z-10 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full', STEP_TINT[st])}>{STEP_ICON[st].node}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-[12.5px] leading-5', st === 'failed' ? 'text-err' : st === 'pending' ? 'text-text-3' : 'text-text-2')}>
                    {s.label}<span className="sr-only"> — {STEP_ICON[st].label}</span>
                  </span>
                  {s.reason && <span className="mt-0.5 block text-[11.5px] leading-4 text-text-3">{s.reason}</span>}
                  {!!s.cites?.length && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {s.cites.map(n => sources[n - 1] && (
                        <button key={n} type="button" onClick={() => onCite?.(n)} title={sources[n - 1]!.detail}
                          className="inline-flex max-w-[200px] items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10.5px] text-text-2 hover:border-brand hover:text-brand">
                          <span className="font-mono text-text-3">[{n}]</span><span className="truncate">{sources[n - 1]!.name}</span></button>))}
                    </span>
                  )}
                  {st === 'failed' && (onRetry || onRephrase) && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] font-medium hover:border-brand hover:text-brand"><RotateCw size={11} />Retry</button>}
                      {onRephrase && <button type="button" onClick={onRephrase} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] font-medium hover:border-brand hover:text-brand"><Pencil size={11} />Rephrase</button>}
                    </span>
                  )}
                </span>
                {st === 'done' && <span className="shrink-0 font-mono text-[11px] leading-5 text-text-3">{(0.3 + ((k * 37) % 9) / 10).toFixed(1)}s</span>}
              </li>)
          })}
        </ol>
      )}
    </div>
  )
}

/* ───────────────────────── CF-2 · Source tagging ───────────────────────── */

export type Origin = 'user' | 'platform' | 'ai'
export const ORIGIN: Record<Origin, { label: string; short: string; cls: string; icon: LucideIcon }> = {
  user: { label: 'You provided this', short: 'You', cls: 'bg-brand-soft text-brand', icon: User },
  platform: { label: 'Stored on the platform', short: 'Platform', cls: 'bg-surface-2 text-text-2', icon: Boxes },
  ai: { label: 'Inferred by the assistant', short: 'Inferred', cls: 'bg-warn-soft text-warn', icon: Sparkles },
}

export function OriginBadge({ origin }: { origin: Origin }) {
  const o = ORIGIN[origin]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold', o.cls)}><o.icon size={10} />{o.short}</span>
}

/** The inline marker that ties a number or claim to where it came from. */
export function SourceTag({ n, source, onOpen }: { n: number; source?: Source; onOpen?: (n: number) => void }) {
  const ctx = useOpenSource()
  const open = onOpen ?? ctx
  if (!source) return <span title="No source recorded" className="ml-1 inline-flex items-center rounded border border-warn/40 bg-warn-soft px-1 align-super text-[9.5px] font-semibold text-warn">unsourced</span>
  return (
    <button type="button" onClick={() => open?.(n)} disabled={!open} title={`${source.name} — ${source.detail}`} aria-label={`Source ${n}: ${source.name}`}
      className="ml-0.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded border border-border bg-surface px-1 align-super font-mono text-[9.5px] text-text-3 transition-colors enabled:hover:border-brand enabled:hover:text-brand">{n}</button>
  )
}

/** A value with its source marker. Every number the assistant states goes through this. */
export function Cited({ children, n, sources, onOpen }: { children: ReactNode; n?: number; sources?: Source[]; onOpen?: (n: number) => void }) {
  return <span className="whitespace-nowrap">{children}{n !== undefined && <SourceTag n={n} source={sources?.[n - 1]} onOpen={onOpen} />}</span>
}

/** Full provenance for one source: where it came from, who owns it, and the logic behind a calculated value. */
export function SourcePanel({ source, n, onClose }: { source: Source; n: number; onClose: () => void }) {
  const [formula, setFormula] = useState(false)
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const origin: Origin = source.origin ?? 'platform'
  const row = (k: string, v: ReactNode) => <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0"><span className="shrink-0 text-[12px] text-text-3">{k}</span><span className="min-w-0 text-right text-[13px]">{v}</span></div>
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-text/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={`Source ${n}: ${source.name}`} className="relative flex h-full w-full max-w-[420px] flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-text-3">Source [{n}]</p>
            <h3 className="mt-0.5 truncate text-[16px] font-semibold">{source.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text"><X size={16} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {row('Origin', <OriginBadge origin={origin} />)}
          {row('Type', source.kind)}
          {source.owner && row('Owner', source.owner)}
          {source.updated && row('Last updated', source.updated)}
          {row('Detail', <span className="text-text-2">{source.detail}</span>)}
          {source.meta && row('Note', <span className="text-text-2">{source.meta}</span>)}
          {source.restricted && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-[12.5px] text-warn">
              <ShieldCheck size={14} className="mt-px shrink-0" />Some values in this source are outside your access and are hidden.</p>
          )}
          {source.formula && (
            <div className="mt-4">
              <button type="button" aria-expanded={formula} onClick={() => setFormula(v => !v)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
                {formula ? 'Hide formula' : 'Show formula'}<ChevronDown size={13} className={cx('transition-transform', formula && 'rotate-180')} /></button>
              {formula && <pre className="rise mt-2 overflow-x-auto rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-text-2">{source.formula}</pre>}
            </div>
          )}
        </div>
        <p className="flex items-center gap-1.5 border-t border-border px-5 py-3 text-[11.5px] text-text-3"><ShieldCheck size={13} className="shrink-0 text-ok" />Sources are limited to your access. No web.</p>
      </aside>
    </div>
  )
}

/* ───────────────────────── CF-3 · Next best prompt ───────────────────────── */

/** Suggestions under the latest answer. Dismiss drops one for the session; the pencil opens it for editing. */
export function NextPrompts({ chips, onSend, onEdit }: { chips: string[]; onSend: (t: string) => void; onEdit?: (t: string) => void }) {
  const [gone, setGone] = useState<string[]>([])
  const live = chips.filter(c => !gone.includes(c))
  if (!live.length) return null
  return (
    <div className="mb-2.5 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
      {live.map(c => (
        <span key={c} className="group inline-flex items-stretch overflow-hidden rounded-full border border-border bg-surface transition-colors hover:border-brand">
          <button type="button" onClick={() => onSend(c)} className="px-3 py-1 text-[12.5px] text-text-2 group-hover:text-brand">{c}</button>
          {onEdit && <button type="button" onClick={() => onEdit(c)} aria-label={`Edit "${c}" before sending`} title="Edit before sending" className="grid w-6 place-items-center border-l border-border text-text-3 hover:bg-surface-2 hover:text-brand"><Pencil size={11} /></button>}
          <button type="button" onClick={() => setGone(g => [...g, c])} aria-label={`Dismiss "${c}"`} title="Dismiss" className="grid w-6 place-items-center border-l border-border text-text-3 hover:bg-surface-2 hover:text-text"><X size={11} /></button>
        </span>))}
    </div>
  )
}

/* ───────────────────────── CF-5 · Export ───────────────────────── */

export const EXPORT_TEMPLATES = [
  { id: 'brief', label: 'Brief', note: 'Title, answer and sources' },
  { id: 'slide', label: 'Slide', note: 'Wide, for decks' },
  { id: 'plain', label: 'Plain', note: 'No chrome' },
] as const
export type TemplateId = (typeof EXPORT_TEMPLATES)[number]['id']

/** Takes an answer out of the chat as a PNG or PDF, with its sources attached. */
export function ExportMenu({ targetId, title, module: mod, restricted }: { targetId: string; title: string; module?: string; restricted?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tpl, setTpl] = useState<TemplateId>('brief')
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h); return () => window.removeEventListener('mousedown', h)
  }, [open])
  const name = [mod, title, new Date().toISOString().slice(0, 10)].filter(Boolean).join('-').replace(/[^\w-]+/g, '-').toLowerCase()
  const run = async (kind: 'png' | 'pdf') => {
    const el = document.getElementById(targetId)
    if (!el) { setBusy('Nothing to export'); return }
    el.dataset.exportTemplate = tpl
    setBusy(kind === 'png' ? 'Rendering image…' : 'Building PDF…')
    try {
      if (kind === 'png') await downloadImage(el, name)
      else await downloadPdf(el, name, mod)
      setBusy('Downloaded.')
    } catch { setBusy('Export failed. Try again.') }
    finally { delete el.dataset.exportTemplate; window.setTimeout(() => { setBusy(null); setOpen(false) }, 1400) }
  }
  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Export this answer" title="Export"
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[12px] font-medium text-text-2 hover:border-brand hover:text-brand"><Download size={12} />Export</button>
      {open && (
        <div role="menu" aria-label="Export options" className="dropdown-container rise absolute right-0 top-9 z-40 w-[260px] p-2.5">
          <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Template</p>
          <div className="grid gap-1">
            {EXPORT_TEMPLATES.map(t => (
              <button key={t.id} type="button" role="menuitemradio" aria-checked={tpl === t.id} onClick={() => setTpl(t.id)}
                className={cx('flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px]', tpl === t.id ? 'bg-brand-soft text-brand' : 'hover:bg-surface-2')}>
                <span><span className="block font-medium">{t.label}</span><span className="block text-[11.5px] text-text-3">{t.note}</span></span>
                {tpl === t.id && <Check size={14} className="shrink-0" />}</button>))}
          </div>
          <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
            <button type="button" onClick={() => run('png')} disabled={!!busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[12.5px] font-medium hover:border-brand hover:text-brand disabled:opacity-50"><ImageIcon size={13} />PNG</button>
            <button type="button" onClick={() => run('pdf')} disabled={!!busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[12.5px] font-medium hover:border-brand hover:text-brand disabled:opacity-50"><FileText size={13} />PDF</button>
          </div>
          {busy && <p aria-live="polite" className="mt-1.5 text-[11.5px] text-text-3">{busy}</p>}
          {restricted && <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-warn"><ShieldCheck size={12} className="mt-px shrink-0" />Restricted values are masked in the export.</p>}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── CF-6 · Pre-output validation ───────────────────────── */

export type Checkpoint = {
  intent: string
  context: string[]
  sample?: { title: string; rows: { k: string; v: string }[] }
  sampleNote?: string
  decision?: 'approved' | 'cancelled'
  refinement?: string
}

/** The assistant stops before building something large and shows what it understood. */
export function CheckpointCard({ cp, live, onApprove, onRefine, onCancel, onSkipSession }: {
  cp: Checkpoint; live: boolean
  onApprove?: () => void; onRefine?: (t: string) => void; onCancel?: () => void; onSkipSession?: () => void }) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState('')
  if (cp.decision) {
    return (
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-text-2">
        {cp.decision === 'approved' ? <CheckCircle2 size={14} className="shrink-0 text-ok" /> : <CircleMinus size={14} className="shrink-0 text-text-3" />}
        <span className="min-w-0 flex-1">Checkpoint {cp.decision}{cp.refinement && <> · refined to “{cp.refinement}”</>}</span>
      </div>
    )
  }
  return (
    <div className="mt-2.5 overflow-hidden rounded-2xl border border-brand/35 bg-surface shadow-[var(--ring-glow)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-soft/50 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"><Target size={14} />Check before I build this</span>
        {live && <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-text-2"><Loader2 size={11} className="animate-spin text-brand" />Waiting for you</span>}
      </header>
      <div className="space-y-3 px-4 py-3.5">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">What I understood</p><p className="mt-1 text-[13.5px]">{cp.intent}</p></div>
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Context I am using</p>
          <ul className="mt-1 space-y-0.5">{cp.context.map(c => <li key={c} className="flex gap-2 text-[13px] text-text-2"><Check size={13} className="mt-0.5 shrink-0 text-ok" />{c}</li>)}</ul></div>
        {cp.sample
          ? <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Sample of the result</p>
              <div className="mt-1 overflow-hidden rounded-xl border border-border">
                <p className="border-b border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium">{cp.sample.title}</p>
                <dl className="divide-y divide-border">{cp.sample.rows.map(r => (
                  <div key={r.k} className="flex items-center justify-between gap-3 px-3 py-1.5"><dt className="text-[12.5px] text-text-2">{r.k}</dt><dd className="font-mono text-[12.5px] font-medium">{r.v}</dd></div>))}</dl>
              </div></div>
          : cp.sampleNote && <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn"><TriangleAlert size={13} className="mt-px shrink-0" />{cp.sampleNote}</p>}
        {edit && (
          <div className="rise">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-3" htmlFor="cp-refine">What should change?</label>
            <textarea id="cp-refine" autoFocus value={text} onChange={e => setText(e.target.value)} rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-border-strong bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand" placeholder="Use FY2028 instead, and only the US stream" />
          </div>
        )}
      </div>
      {live && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
          {edit
            ? <>
                <button type="button" disabled={!text.trim()} onClick={() => { onRefine?.(text.trim()); setEdit(false); setText('') }} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-medium text-white disabled:opacity-45">Send refinement</button>
                <button type="button" onClick={() => { setEdit(false); setText('') }} className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-text-2 hover:text-text">Back</button>
              </>
            : <>
                <button type="button" onClick={onApprove} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-hover"><Check size={14} />Approve</button>
                <button type="button" onClick={() => setEdit(true)} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-medium hover:border-brand hover:text-brand"><Pencil size={13} />Refine</button>
                <button type="button" onClick={onCancel} className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-text-2 hover:text-err">Cancel</button>
                {onSkipSession && <button type="button" onClick={onSkipSession} className="ml-auto text-[12px] text-text-3 hover:text-text hover:underline">Skip checks this session</button>}
              </>}
        </footer>
      )}
    </div>
  )
}

/* ───────────────────────── Shared card chrome ───────────────────────── */

function Panel({ icon: I, title, note, right, children }: { icon: LucideIcon; title: string; note?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2 text-[13.5px] font-semibold"><I size={15} className="shrink-0 text-brand" /><span className="truncate">{title}</span></span>
        {right}
      </header>
      <div className="px-4 py-3.5">{children}</div>
      {note && <p className="border-t border-border px-4 py-2.5 text-[11.5px] text-text-3">{note}</p>}
    </section>
  )
}

const STRENGTH: Record<'high' | 'medium' | 'low', string> = { high: 'bg-ok-soft text-ok', medium: 'bg-warn-soft text-warn', low: 'bg-err-soft text-err' }
export function MatchBadge({ level, why }: { level: 'high' | 'medium' | 'low'; why?: string }) {
  return <span title={why} className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide', STRENGTH[level])}>{level} match</span>
}

/* ───────────────────────── COE-1 · Archetype suggestion ───────────────────────── */

export type ArchPick = { id: string; name: string; why: string[]; level: 'high' | 'medium' | 'low'; cites?: number[]; gaps?: string[] }

export function ArchetypeCard({ primary, alternates, sources, onOpenSource, onChoose, onCompare, chosen }: {
  primary: ArchPick; alternates: ArchPick[]; sources?: Source[]
  onOpenSource?: (n: number) => void; onChoose?: (id: string) => void; onCompare?: (a: string, b: string) => void; chosen?: string }) {
  const row = (a: ArchPick, lead: boolean) => (
    <div key={a.id} className={cx('rounded-xl border p-3.5', lead ? 'border-brand/40 bg-brand-soft/25' : 'border-border')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-text-3">{a.id}</span>
        <span className="text-[14px] font-semibold">{a.name}</span>
        <MatchBadge level={a.level} />
        {chosen === a.id && <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[10.5px] font-semibold text-ok"><Check size={10} />Chosen</span>}
      </div>
      <ul className="mt-2 space-y-1">
        {a.why.map((w, i) => (
          <li key={w} className="flex gap-2 text-[12.5px] text-text-2">
            <Check size={12} className="mt-1 shrink-0 text-ok" />
            <span>{w}{a.cites?.[i] !== undefined && <SourceTag n={a.cites[i]!} source={sources?.[a.cites[i]! - 1]} onOpen={onOpenSource} />}</span>
          </li>))}
      </ul>
      {!!a.gaps?.length && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[12px] text-warn">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />Does not cover: {a.gaps.join(', ')}</p>)}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChoose?.(a.id)} disabled={chosen === a.id}
          className={cx('inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px] font-medium', lead ? 'bg-brand text-white hover:bg-brand-hover disabled:opacity-45' : 'border border-border hover:border-brand hover:text-brand disabled:opacity-45')}>
          {chosen === a.id ? 'Selected' : lead ? 'Use this archetype' : 'Use instead'}</button>
        {!lead && onCompare && <button type="button" onClick={() => onCompare(primary.id, a.id)} className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-text-2 hover:text-brand">Compare<ArrowUpRight size={12} /></button>}
      </div>
    </div>
  )
  return (
    <Panel icon={Sparkles} title="Closest archetype for this model" note="Based on the modules and structure read from your file. You can switch at any time before the model is finalised.">
      <div className="space-y-2.5">
        {row(primary, true)}
        {alternates.length > 0 && <p className="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Also considered</p>}
        {alternates.map(a => row(a, false))}
      </div>
    </Panel>
  )
}

/* ───────────────────────── COE-2 · Flag missing modules ───────────────────────── */

export type ModuleCheck = { id: string; label: string; status: 'present' | 'partial' | 'missing'; why: string; blocking?: boolean }
const CHECK: Record<ModuleCheck['status'], { icon: LucideIcon; cls: string; label: string }> = {
  present: { icon: CheckCircle2, cls: 'text-ok', label: 'Present' },
  partial: { icon: TriangleAlert, cls: 'text-warn', label: 'Partly covered' },
  missing: { icon: AlertCircle, cls: 'text-err', label: 'Missing' },
}

export function ModuleChecklist({ archetype, items, onAdd }: { archetype: string; items: ModuleCheck[]; onAdd?: (id: string) => void }) {
  const done = items.filter(i => i.status === 'present').length
  const sorted = [...items].sort((a, b) => Number(!!b.blocking) - Number(!!a.blocking) || a.status.localeCompare(b.status))
  const allIn = done === items.length
  return (
    <Panel icon={BadgeCheck} title={`What ${archetype} still needs`}
      right={<span className="ml-auto font-mono text-[12px] text-text-2">{done} of {items.length} modules</span>}
      note="Re-checked whenever you change the archetype or add a module.">
      {allIn
        ? <p className="flex items-center gap-2 rounded-lg bg-ok-soft px-3 py-2.5 text-[13px] text-ok"><CheckCircle2 size={15} className="shrink-0" />Every required module is present. You can continue to validation.</p>
        : <ul className="divide-y divide-border">
            {sorted.map(i => { const c = CHECK[i.status]; return (
              <li key={i.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <c.icon size={15} className={cx('mt-0.5 shrink-0', c.cls)} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-medium">{i.label}</span>
                    <span className={cx('text-[11px] font-semibold', c.cls)}>{c.label}</span>
                    {i.blocking && i.status !== 'present' && <span className="rounded-full bg-err-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-err">Blocking</span>}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-text-3">{i.why}</span>
                </span>
                {i.status !== 'present' && onAdd && (
                  <button type="button" onClick={() => onAdd(i.id)} className="inline-flex h-7 shrink-0 items-center rounded-lg border border-border px-2.5 text-[12px] font-medium hover:border-brand hover:text-brand">Add</button>)}
              </li>) })}
          </ul>}
    </Panel>
  )
}

/* ───────────────────────── COE-3 · Search similar models ───────────────────────── */

export type SimilarModel = { id: string; name: string; archetype: string; owner: string; updated: string; why: string; score: 'high' | 'medium' | 'low'; archived?: boolean; ownerInactive?: boolean }

export function SimilarModels({ items, onPreview, onStartFrom }: { items: SimilarModel[]; onPreview?: (id: string) => void; onStartFrom?: (id: string) => void }) {
  const [archived, setArchived] = useState(false)
  const live = items.filter(m => archived || !m.archived)
  return (
    <Panel icon={Boxes} title="Similar models you can build on"
      right={items.some(m => m.archived) ? <button type="button" onClick={() => setArchived(v => !v)} className="ml-auto text-[12px] font-medium text-brand hover:underline">{archived ? 'Hide archived' : 'Include archived'}</button> : undefined}
      note="Only models you have access to. Starting from one makes a copy and never changes the original.">
      {live.length === 0
        ? <p className="py-2 text-[13px] text-text-3">No similar models found. Broaden the search, or start from a blank model.</p>
        : <ul className="divide-y divide-border">
            {live.map(m => (
              <li key={m.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-medium">{m.name}</span>
                    <MatchBadge level={m.score} why={m.why} />
                    {m.archived && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-text-3">Archived</span>}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-text-3">{m.archetype} · {m.owner}{m.ownerInactive && ' (inactive)'} · updated {m.updated}</span>
                  <span className="mt-0.5 block text-[12px] text-text-2">{m.why}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {onPreview && <button type="button" onClick={() => onPreview(m.id)} aria-label={`Preview ${m.name}`} title="Preview" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-text-2 hover:border-brand hover:text-brand"><SquareArrowOutUpRight size={12} /></button>}
                  {onStartFrom && <button type="button" onClick={() => onStartFrom(m.id)} className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[12px] font-medium hover:border-brand hover:text-brand">Start from this</button>}
                </span>
              </li>))}
          </ul>}
    </Panel>
  )
}

/* ───────────────────────── COE-4 · Compare two archetypes ───────────────────────── */

export type ArchSide = { id: string; name: string; purpose: string; modules: string[]; strengths: string[]; limits: string[] }

export function ArchetypeCompare({ a, b, pick, why, generic, onChoose }: {
  a: ArchSide; b: ArchSide; pick?: string; why?: string; generic?: boolean; onChoose?: (id: string) => void }) {
  const diff = (xs: string[], ys: string[]) => xs.filter(x => !ys.includes(x))
  const col = (s: ArchSide, other: ArchSide) => {
    const only = diff(s.modules, other.modules)
    return (
      <div className={cx('rounded-xl border p-3.5', pick === s.id ? 'border-brand/40 bg-brand-soft/25' : 'border-border')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-text-3">{s.id}</span><span className="text-[14px] font-semibold">{s.name}</span>
          {pick === s.id && <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold text-white"><Check size={10} />Recommended</span>}
        </div>
        <p className="mt-1.5 text-[12.5px] text-text-2">{s.purpose}</p>
        <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Required modules</p>
        <ul className="mt-1 flex flex-wrap gap-1">{s.modules.map(m => (
          <li key={m} className={cx('rounded-full px-2 py-0.5 text-[11.5px]', only.includes(m) ? 'bg-brand-soft font-medium text-brand' : 'bg-surface-2 text-text-2')}>{m}</li>))}</ul>
        {only.length > 0 && <p className="mt-1 text-[11px] text-text-3">Highlighted modules are only in {s.name}.</p>}
        <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Strengths</p>
        <ul className="mt-1 space-y-0.5">{s.strengths.map(x => <li key={x} className="flex gap-1.5 text-[12.5px] text-text-2"><Check size={12} className="mt-0.5 shrink-0 text-ok" />{x}</li>)}</ul>
        <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Limits</p>
        <ul className="mt-1 space-y-0.5">{s.limits.map(x => <li key={x} className="flex gap-1.5 text-[12.5px] text-text-2"><CircleMinus size={12} className="mt-0.5 shrink-0 text-text-3" />{x}</li>)}</ul>
        {onChoose && <button type="button" onClick={() => onChoose(s.id)} className={cx('mt-3 inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px] font-medium', pick === s.id ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-border hover:border-brand hover:text-brand')}>Use {s.name}</button>}
      </div>
    )
  }
  return (
    <Panel icon={Boxes} title={`${a.name} against ${b.name}`} note={generic ? 'No model is open, so this compares the archetypes in general terms rather than against your data.' : undefined}>
      {why && <p className="mb-3 rounded-lg border-l-2 border-brand bg-brand-soft/40 px-3.5 py-2.5 text-[13px]"><b className="font-semibold">Recommendation:</b> {why}</p>}
      <div className="grid gap-2.5 sm:grid-cols-2">{col(a, b)}{col(b, a)}</div>
    </Panel>
  )
}

/* ───────────────────────── COE-5 · Platform navigation help ───────────────────────── */

export type NavAnswer = { answer: string; steps: string[]; target?: { label: string; go: () => void }; section: string; updated: string; related?: string[] }

export function NavHelpCard({ nav, onAsk }: { nav: NavAnswer; onAsk?: (t: string) => void }) {
  return (
    <Panel icon={ArrowUpRight} title="Where to do this" note={`From the user guide · ${nav.section} · updated ${nav.updated}`}>
      <p className="text-[13.5px]">{nav.answer}</p>
      <ol className="mt-2.5 space-y-1.5">
        {nav.steps.map((s, k) => (
          <li key={s} className="flex gap-2.5 text-[13px] text-text-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-[11px] text-text-2">{k + 1}</span>{s}</li>))}
      </ol>
      {nav.target && <button type="button" onClick={nav.target.go} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-hover">{nav.target.label}<ArrowUpRight size={14} /></button>}
      {!!nav.related?.length && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Related</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{nav.related.map(r => <button key={r} type="button" onClick={() => onAsk?.(r)} className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-text-2 hover:border-brand hover:text-brand">{r}</button>)}</div>
        </div>)}
    </Panel>
  )
}

/** When the guide has no answer, the assistant says so rather than inventing a path. */
export function NavNoAnswer({ topic }: { topic: string }) {
  return (
    <Panel icon={AlertCircle} title="Not in the user guide">
      <p className="text-[13.5px] text-text-2">The guide has nothing on “{topic}”, so I will not guess at a screen or a feature name. Ask the platform team, or request that the guide covers it.</p>
    </Panel>
  )
}

/* ───────────────────────── FC-1 · Workflow guidance ───────────────────────── */

export type NextStep = { step: string; why: string; consequence: string; go?: () => void; recommended?: boolean }

export function NextStepCard({ at, total, done, options, skipped, onAskWhere }: {
  at: string; total?: number; done?: number; options: NextStep[]; skipped?: string[]; onAskWhere?: () => void }) {
  if (!options.length) {
    return (
      <Panel icon={CheckCircle2} title="Workflow complete">
        <p className="text-[13.5px] text-text-2">Every step in this forecast is done. You can submit it for review, or revisit any step from the tabs above.</p>
      </Panel>
    )
  }
  return (
    <Panel icon={Target} title={`You are at: ${at}`}
      right={done !== undefined && total !== undefined ? <span className="ml-auto font-mono text-[12px] text-text-2">step {done} of {total}</span> : undefined}
      note={onAskWhere ? undefined : 'Guidance follows the workflow and does not include market-specific advice.'}>
      {!!skipped?.length && (
        <p className="mb-2.5 flex items-start gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
          <TriangleAlert size={13} className="mt-px shrink-0" />Skipped on the way here: {skipped.join(', ')}. You can go back without losing work.</p>)}
      <ul className="space-y-2">
        {options.map(o => (
          <li key={o.step} className={cx('rounded-xl border p-3', o.recommended ? 'border-brand/40 bg-brand-soft/25' : 'border-border')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-medium">{o.step}</span>
              {o.recommended && <span className="rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold text-white">Next best</span>}
            </div>
            <p className="mt-1 text-[12.5px] text-text-2">{o.why}</p>
            <p className="mt-0.5 text-[12px] text-text-3">If you do: {o.consequence}</p>
            {o.go && <button type="button" onClick={o.go} className={cx('mt-2 inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium', o.recommended ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-border hover:border-brand hover:text-brand')}>Go there<ArrowUpRight size={12} /></button>}
          </li>))}
      </ul>
    </Panel>
  )
}

/* ───────────────────────── FC-2 / FC-3 · Movement and drivers ───────────────────────── */

export type Contributor = { label: string; value: string; raw: number; share: string; cite?: number; note?: string }

/** Why a number moved: the contributors, biggest first, reconciled against the headline. */
export function MovementCard({ headline, from, to, period, contributors, residual, sources, onOpenSource, reconciles, insufficient }: {
  headline: string; from: string; to: string; period: string
  contributors: Contributor[]; residual?: Contributor; sources?: Source[]; onOpenSource?: (n: number) => void
  reconciles: boolean; insufficient?: string[] }) {
  if (insufficient?.length) {
    return (
      <Panel icon={AlertCircle} title="Not enough to attribute this change">
        <p className="text-[13.5px] text-text-2">I can see the movement but cannot break it down. Missing:</p>
        <ul className="mt-1.5 space-y-0.5">{insufficient.map(x => <li key={x} className="flex gap-1.5 text-[13px] text-text-2"><CircleMinus size={12} className="mt-1 shrink-0 text-text-3" />{x}</li>)}</ul>
      </Panel>
    )
  }
  const all = residual ? [...contributors, residual] : contributors
  const max = Math.max(...all.map(c => Math.abs(c.raw)), 1)
  return (
    <Panel icon={BadgeCheck} title={`${headline} · ${period}`}
      note="Contributors are measured one at a time against the same starting point, so they add up to the headline movement.">
      <p className="text-[13px] text-text-2">{from} → <b className="font-semibold text-text">{to}</b></p>
      <ul className="mt-2.5 space-y-1.5">
        {all.map(c => (
          <li key={c.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[13px]">{c.label}{c.cite !== undefined && <SourceTag n={c.cite} source={sources?.[c.cite - 1]} onOpen={onOpenSource} />}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className={cx('font-mono text-[13px] font-semibold', c.raw > 0 ? 'text-ok' : c.raw < 0 ? 'text-err' : 'text-text-2')}>{c.value}</span>
                <span className="w-10 text-right font-mono text-[11.5px] text-text-3">{c.share}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={cx('h-full rounded-full', c.raw >= 0 ? 'bg-ok' : 'bg-err')} style={{ width: `${(Math.abs(c.raw) / max) * 100}%` }} /></div>
            {c.note && <p className="mt-0.5 text-[11.5px] text-text-3">{c.note}</p>}
          </li>))}
      </ul>
      <p className={cx('mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px]', reconciles ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>
        {reconciles ? <Check size={13} className="shrink-0" /> : <TriangleAlert size={13} className="shrink-0" />}
        {reconciles ? 'Reconciles: the contributors sum to the headline movement.' : 'These do not fully reconcile — an unexplained remainder is shown above.'}</p>
    </Panel>
  )
}

export type Driver = { label: string; value: string; share: string; raw: number; basis: string; cite?: number }

/** What is carrying the forecast right now, rather than what changed. */
export function DriversCard({ metric, period, drivers, sources, onOpenSource, caveat }: {
  metric: string; period: string; drivers: Driver[]; sources?: Source[]; onOpenSource?: (n: number) => void; caveat?: string }) {
  const max = Math.max(...drivers.map(d => Math.abs(d.raw)), 1)
  return (
    <Panel icon={Sparkles} title={`What drives ${metric} · ${period}`} note="Each driver is measured by how much the forecast moves when it alone is held at its plausible low and high.">
      {caveat && <p className="mb-2.5 flex items-start gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn"><TriangleAlert size={13} className="mt-px shrink-0" />{caveat}</p>}
      <ul className="space-y-2">
        {drivers.map(d => (
          <li key={d.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[13px] font-medium">{d.label}{d.cite !== undefined && <SourceTag n={d.cite} source={sources?.[d.cite - 1]} onOpen={onOpenSource} />}</span>
              <span className="flex shrink-0 items-baseline gap-2"><span className="font-mono text-[13px] font-semibold">{d.value}</span><span className="w-10 text-right font-mono text-[11.5px] text-text-3">{d.share}</span></span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(Math.abs(d.raw) / max) * 100}%` }} /></div>
            <p className="mt-0.5 text-[11.5px] text-text-3">{d.basis}</p>
          </li>))}
      </ul>
    </Panel>
  )
}

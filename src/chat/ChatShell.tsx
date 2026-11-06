import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, BadgeCheck, BookOpen, Bookmark, Boxes, Check, ChevronDown, Database, FileText, LineChart, Copy, Loader2, MessageSquare, Mic, RotateCw, ShieldCheck, Square, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react'

export type Mode = 'ask' | 'agent'
export type SourceKind = 'Model library' | 'Engine docs' | 'Data feed' | 'File' | 'Policy' | 'Insight' | 'Scenario' | 'Forecast'
export type Source = { name: string; kind: SourceKind; detail: string; meta?: string }
export type ShellMsg = { id: number; role: 'user' | 'ai'; text?: string; trace?: string[]; chips?: string[]; mode?: Mode; sources?: Source[]; via?: string; card?: unknown }
export type PromptCard = { icon: LucideIcon; title: string; prompts: string[] }
/** Which AI experience this chat is: names the mode, its purpose and how it greets. */
export type Persona = { label: string; purpose: string; greeting: string; icon: LucideIcon; mode?: string }
type Assistant = { name: string; Mark: ComponentType<{ size?: number; busy?: boolean }>; Md: ComponentType<{ text: string }> }

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export const AI_MODELS = [
  { id: 'sonnet', name: 'Claude Sonnet 5', by: 'Anthropic', note: 'Balanced speed and depth', color: '#c96442' },
  { id: 'opus', name: 'Claude Opus 5.5', by: 'Anthropic', note: 'Deepest reasoning', color: '#c96442' },
  { id: 'gemini', name: 'Gemini 2.5 Pro', by: 'Google', note: 'Long documents and data', color: '#3b6fe0' },
  { id: 'gpt', name: 'GPT-5', by: 'OpenAI', note: 'Fast general reasoning', color: '#0f8f6f' },
  { id: 'chatgpt', name: 'ChatGPT Enterprise', by: 'OpenAI', note: 'Company workspace', color: '#0f8f6f' },
] as const
const pickedModel = 'sonnet'

const KIND_ICON: Record<SourceKind, LucideIcon> = { 'Model library': Boxes, 'Engine docs': BookOpen, 'Data feed': Database, File: FileText, Policy: ShieldCheck, Insight: Bookmark, Scenario: LineChart, Forecast: BadgeCheck }
const DEFAULT_STEPS = ['Reading your request', 'Preparing the workspace', 'Assembling the result']

function Process({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[12px] font-medium text-text-2 hover:border-brand hover:text-brand">
        <Check size={12} className="text-ok" />{steps.length} step{steps.length === 1 ? '' : 's'}<ChevronDown size={12} className={cx('text-text-3 transition-transform', open && 'rotate-180')} /></button>
      {open && (
        <ol className="rise mt-2.5 ml-1.5" aria-label="Process">
          {steps.map((x, k) => (
            <li key={x} className="relative flex gap-3 pb-3.5 last:pb-0">
              {k < steps.length - 1 && <span aria-hidden className="absolute left-[9px] top-5 h-[calc(100%-12px)] w-px bg-border-strong" />}
              <span className="relative z-10 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full bg-ok-soft text-ok"><Check size={11} /></span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-5 text-text-2">{x}</span>
              <span className="shrink-0 font-mono text-[11px] leading-5 text-text-3">{(0.3 + ((k * 37) % 9) / 10).toFixed(1)}s</span>
            </li>))}
        </ol>
      )}
    </div>
  )
}

const SENT = /(?<=[.!?])\s+(?=[A-Z*])/
function structure(text: string): string {
  const ps = text.split('\n\n')
  if (ps.length < 3 || ps.some(x => x.includes('\n') || /^(#{2}|[-> ]|\d+\.)/.test(x))) return text
  const [lead, ...rest] = ps
  const ask = /^\*\*[^*]+\?\*\*/.test(rest[rest.length - 1]!) ? rest.pop()! : null
  const call = rest.length > 1 && /^\*\*[^*]{2,40}:\*\*/.test(rest[rest.length - 1]!) ? rest.pop()! : null
  const bullets = rest.flatMap(x => x.split(SENT)).filter(Boolean).map(x => '- ' + x).join('\n')
  return [lead, bullets && '## What to know\n\n' + bullets, call && '> ' + call, ask].filter(Boolean).join('\n\n')
}
const plain = (t: string) => t.replace(/\*\*?/g, '').replace(/^(## |> )/gm, '')

function Paras({ text, Md }: { text: string; Md: Assistant['Md'] }) {
  return (
    <div className="space-y-3.5 text-[14px] leading-[1.65] text-text-2">{structure(text).split('\n\n').map((blk, i) => {
      const ls = blk.split('\n')
      if (blk.startsWith('## ')) return <h3 key={i} className="!mt-5 text-[13px] font-semibold uppercase tracking-wide text-text">{blk.slice(3)}</h3>
      if (ls.every(l => /^- /.test(l))) return <ul key={i} className="space-y-1.5">{ls.map((l, k) => <li key={k} className="flex gap-2.5"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" /><span className="min-w-0 flex-1"><Md text={l.slice(2)} /></span></li>)}</ul>
      if (ls.every(l => /^\d+\. /.test(l))) return <ol key={i} className="space-y-1.5">{ls.map((l, k) => <li key={k} className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">{k + 1}</span><span className="min-w-0 flex-1"><Md text={l.replace(/^\d+\. /, '')} /></span></li>)}</ol>
      if (blk.startsWith('> ')) return <div key={i} className="rounded-xl border-l-2 border-brand bg-brand-soft/60 px-3.5 py-2.5 text-text"><Md text={blk.slice(2)} /></div>
      return <p key={i} className={i === 0 ? 'text-text' : undefined}><Md text={blk} /></p>
    })}</div>
  )
}

function Actions({ m, last, onRegen }: { m: ShellMsg; last: boolean; onRegen: () => void }) {
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const btn = 'grid h-7 w-7 place-items-center rounded-md text-text-3 transition-colors hover:bg-surface-2 hover:text-text'
  return (
    <div className="mt-3">
      <div className="flex items-center gap-0.5" role="toolbar" aria-label="Response actions">
        <button type="button" className={btn} aria-label="Copy response" title={copied ? 'Copied' : 'Copy'} onClick={() => { void navigator.clipboard?.writeText(plain(m.text ?? '')); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }}>{copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}</button>
        <button type="button" className={cx(btn, vote === 'up' && 'bg-brand-soft text-brand')} aria-label="Good response" aria-pressed={vote === 'up'} title="Good response" onClick={() => { setVote(v => v === 'up' ? null : 'up'); setWhy(null) }}><ThumbsUp size={14} /></button>
        <button type="button" className={cx(btn, vote === 'down' && 'bg-err-soft text-err')} aria-label="Bad response" aria-pressed={vote === 'down'} title="Bad response" onClick={() => { setVote(v => v === 'down' ? null : 'down'); setWhy(null) }}><ThumbsDown size={14} /></button>
        {last && <button type="button" className={btn} aria-label="Regenerate response" title="Regenerate" onClick={onRegen}><RotateCw size={14} /></button>}
        {vote === 'up' && <span className="ml-2 text-[12px] text-text-3">Thanks, glad it helped.</span>}
      </div>
      {vote === 'down' && (why
        ? <p className="mt-1.5 text-[12px] text-text-3">Thanks, noted: {why.toLowerCase()}.</p>
        : <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="text-[12px] text-text-3">What went wrong?</span>{['Not accurate', 'Too long', 'Not what I asked'].map(w => <button key={w} type="button" onClick={() => setWhy(w)} className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-text-2 hover:border-brand hover:text-brand">{w}</button>)}</div>)}
    </div>
  )
}

function AskAnswer({ m, Md }: { m: ShellMsg; Md: Assistant['Md'] }) {
  const [tab, setTab] = useState<'answer' | 'sources'>('answer')
  const src = m.sources ?? []
  return (
    <div>
      <div role="tablist" aria-label="Answer or sources" className="mb-2.5 flex items-center gap-1 border-b border-border">
        {([['answer', 'Answer'], ['sources', `Citations · ${src.length}`]] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cx('-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors', tab === id ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text')}>{l}</button>))}
        {m.via && <span className="ml-auto pb-1 text-[11px] text-text-3">via {m.via}</span>}
      </div>
      {tab === 'answer'
        ? <>
          <Paras text={m.text ?? ''} Md={Md} />
          {src.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Citations">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Cited</span>
              {src.map((s, k) => <button key={s.name} type="button" onClick={() => setTab('sources')} title={s.detail}
                className="inline-flex max-w-[240px] items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-2 hover:border-brand hover:text-brand"><span className="font-mono text-text-3">[{k + 1}]</span><span className="truncate">{s.name}</span></button>)}
            </div>
          )}
        </>
        : (
          <div>
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {src.map((s, k) => { const I = KIND_ICON[s.kind]; return (
                <li key={s.name} className="flex items-start gap-3 px-3.5 py-3">
                  <span className="mt-0.5 w-5 shrink-0 font-mono text-[11px] text-text-3">[{k + 1}]</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-text-2"><I size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{s.name}</span><span className="block text-[12px] text-text-2">{s.detail}</span></span>
                  <span className="shrink-0 text-right"><span className="block text-[11px] font-semibold uppercase tracking-wide text-text-3">{s.kind}</span>{s.meta && <span className="block text-[11px] text-text-3">{s.meta}</span>}</span>
                </li>) })}
            </ol>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-text-3"><ShieldCheck size={13} className="shrink-0 text-ok" />Sources limited to your access. No web.</p>
          </div>
        )}
    </div>
  )
}

function PromptCards({ cards, onPick }: { cards: PromptCard[]; onPick: (t: string) => void }) {
  const [on, setOn] = useState<number | null>(null)
  const open = on === null ? null : cards[on]
  return (
    <div className="relative" onMouseLeave={() => setOn(null)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOn(null) }}>
      <div className="grid grid-cols-3 gap-2.5">
        {cards.map((c, k) => (
          <button key={c.title} type="button" aria-haspopup="true" aria-expanded={on === k} onMouseEnter={() => setOn(c.prompts.length > 1 ? k : null)} onFocus={() => setOn(c.prompts.length > 1 ? k : null)} onClick={() => c.prompts.length === 1 && onPick(c.prompts[0]!)}
            className={cx('inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-full border bg-surface px-3 text-[13px] font-medium transition-colors', on === k ? 'border-brand text-brand' : 'border-border hover:border-brand hover:text-brand')}>
            <c.icon size={15} className={cx('shrink-0', on === k ? 'text-brand' : 'text-text-3')} /><span className="truncate">{c.title}</span></button>))}
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 pt-2 text-left">
          <div role="menu" aria-label={`${open.title} prompts`} className="rise rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
            {open.prompts.map(t => <button key={t} type="button" role="menuitem" onClick={() => { setOn(null); onPick(t) }} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[14px] text-text-2 hover:bg-brand-soft hover:text-brand"><span className="flex-1">{t}</span><ArrowUpRight size={14} className="shrink-0 opacity-60" /></button>)}
          </div>
        </div>
      )}
    </div>
  )
}

/** Forecast AI's empty state: a short list of business questions, not a grid of build actions. */
function QuestionList({ cards, onPick }: { cards: PromptCard[]; onPick: (t: string) => void }) {
  const rows = cards.flatMap(c => c.prompts.map(t => ({ t, icon: c.icon })))
  return (
    <div className="text-left">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">Questions people ask</p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map(({ t, icon: I }) => (
          <li key={t}><button type="button" onClick={() => onPick(t)} className="group flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-text-2 transition-colors hover:bg-brand-soft/50 hover:text-text">
            <I size={15} className="shrink-0 text-text-3 group-hover:text-brand" /><span className="flex-1">{t}</span><ArrowUpRight size={14} className="shrink-0 text-text-3 opacity-0 transition-opacity group-hover:opacity-100" /></button></li>
        ))}
      </ul>
    </div>
  )
}

function Sandbox<M extends ShellMsg>({ items, activeId, setActive, renderCard, cardTitle, lastId, working }: { items: M[]; activeId: number | null; setActive: (id: number) => void; renderCard: (m: M, live: boolean) => ReactNode; cardTitle: (m: M) => string; lastId?: number; working: boolean }) {
  const active = items.find(m => m.id === activeId) ?? items[items.length - 1]
  const built = useRef(new Set<number>())
  const [st, setSt] = useState({ id: -1, n: 0 })
  const steps = active ? (active.trace ?? DEFAULT_STEPS) : []
  const n = !active ? 0 : built.current.has(active.id) ? steps.length : st.id === active.id ? st.n : 0
  const done = !!active && n >= steps.length
  useEffect(() => {
    if (!active || built.current.has(active.id)) return
    const id = active.id, total = steps.length
    let i = 0
    setSt({ id, n: 0 })
    const t = window.setInterval(() => { i++; setSt({ id, n: i }); if (i >= total) { built.current.add(id); window.clearInterval(t) } }, 480)
    return () => window.clearInterval(t)
  }, [active?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const status = working ? ['Working…', 'bg-warn-soft text-warn'] : !active ? ['Waiting', 'bg-surface-2 text-text-2'] : done ? ['Ready', 'bg-ok-soft text-ok'] : ['Building…', 'bg-warn-soft text-warn']
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-surface-2/70 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-border-strong" /><i className="h-2.5 w-2.5 rounded-full bg-border-strong" /><i className="h-2.5 w-2.5 rounded-full bg-border-strong" /></span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold"><Wand2 size={13} className="text-brand" /><span className="truncate">Sandbox{active ? ` · ${cardTitle(active)}` : ''}</span></span>
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', status[1])}>{(working || (active && !done)) && <Loader2 size={11} className="animate-spin" />}{status[0]}</span>
        </div>
        {items.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2" role="tablist" aria-label="Sandbox steps">
            {items.map((m, k) => <button key={m.id} type="button" role="tab" aria-selected={m.id === active?.id} onClick={() => setActive(m.id)}
              className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium', m.id === active?.id ? 'bg-brand-soft text-brand' : 'text-text-2 hover:bg-surface-2')}><span className="font-mono text-[10px] opacity-70">{k + 1}</span>{cardTitle(m)}</button>)}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!active ? (
            <div className="grid h-full place-items-center">
              <div className="max-w-xs text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Wand2 size={20} /></span>
                <p className="mt-3 text-[14px] font-semibold">Your workspace appears here</p>
                <p className="mt-1 text-[13px] text-text-2">Describe what you need. You approve each step before it’s saved.</p>
              </div>
            </div>
          ) : (
            <div key={active.id}>
              {steps.length > 0 && <><div className="mb-4 h-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.round((n / Math.max(1, steps.length)) * 100)}%` }} /></div>
              <ul className="mb-4 space-y-1.5">
                {steps.map((s, k) => <li key={s} className={cx('flex items-center gap-2 text-[12.5px] transition-opacity', k < n ? 'text-text-2' : k === n ? 'text-text' : 'text-text-3 opacity-50')}>
                  {k < n ? <Check size={13} className="text-ok" /> : k === n ? <Loader2 size={13} className="animate-spin text-brand" /> : <span className="h-[13px] w-[13px] rounded-full border border-border-strong" />}{s}</li>)}
              </ul></>}
              {done && <div className="rise">{renderCard(active, active.id === lastId && !working)}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type Props<M extends ShellMsg> = {
  assistant: Assistant; userName: string
  threads: { id: number; title: string }[]; cur: number | null; setCur: (id: number | null) => void
  msgs: M[] | null; thinking: string | null
  onSend: (text: string, mode: Mode, model: string) => void
  renderCard: (m: M, live: boolean) => ReactNode; cardTitle: (m: M) => string
  cards: PromptCard[]; voice: string[]
  placeholder: string; note: string
  context?: ReactNode; threadHeader?: ReactNode
  persona?: Persona
  /** workbench = COE AI (build, sandbox split, config header). briefing = Forecast AI (read-only answers, grounding bar, no sandbox). */
  variant?: 'workbench' | 'briefing'
  /** Briefing only: sticky bar naming what the answers are grounded in and the user's access scope. */
  grounding?: ReactNode
  /** Workbench only: live progress shown in the header band, e.g. "Model build · step 3 of 7". */
  status?: string
}

export default function ChatShell<M extends ShellMsg>(p: Props<M>) {
  const { name: AI, Mark, Md } = p.assistant
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [voice, setVoice] = useState<'idle' | 'listening' | 'transcribing'>('idle')
  const [heard, setHeard] = useState('')
  const [ratio, setRatio] = useState(0.5)
  const [drag, setDrag] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const vIdx = useRef(0)
  const sendRef = useRef(p.onSend); sendRef.current = p.onSend
  // One model for every chat; there is no model picker.
  const model = AI_MODELS.find(m => m.id === pickedModel) ?? AI_MODELS[0]
  const msgs = p.msgs
  const artifacts = (msgs ?? []).filter(m => m.role === 'ai' && m.card !== undefined)
  const lastAi = msgs ? [...msgs].reverse().find(m => m.role === 'ai')?.id : undefined
  const lastArt = artifacts[artifacts.length - 1]?.id
  const chips = !p.thinking && msgs ? [...msgs].reverse().find(m => m.role === 'ai')?.chips : undefined
  const brief = p.variant === 'briefing'
  const split = !brief && !!msgs && artifacts.length > 0
  const P = p.persona
  const pill = P && <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-[12px] font-semibold text-brand"><P.icon size={13} />{P.label}</span>
  const band = !brief && P && (
    <div className="shrink-0 border-b border-brand/15 bg-brand-soft/60 px-5 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand"><span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-white"><P.icon size={13} /></span>{P.label}</span>
        {P.mode && <span className="rounded-full border border-brand/30 bg-surface px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">{P.mode}</span>}
        {p.status && <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">{/done/.test(p.status) ? <Check size={12} className="text-ok" /> : <Loader2 size={12} className={cx('text-brand', !/needs approval/.test(p.status) && 'animate-spin')} />}{p.status}</span>}
        <span title="For example BD / Pipeline." className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-text-2"><ShieldCheck size={13} className="text-ok" />Restricted data hidden</span>
      </div>
    </div>
  )
  const groundBar = brief && p.grounding && <div className="shrink-0 border-b border-border bg-surface px-5 py-2"><div className="mx-auto max-w-3xl">{p.grounding}</div></div>

  useEffect(() => { setSelId(null) }, [p.cur]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelId(null) }, [artifacts.length])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs?.length, p.thinking])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const send = (text: string) => { const t = text.trim(); if (!t || p.thinking) return; setQ(''); sendRef.current(t, 'agent', model.name) }
  const stopVoice = () => { timers.current.forEach(window.clearTimeout); timers.current = []; setVoice('idle'); setHeard('') }
  const startVoice = () => {
    if (voice !== 'idle') { stopVoice(); return }
    if (p.thinking) return
    const list = p.voice, text = list[vIdx.current++ % list.length]!, words = text.split(' ')
    const at = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    setVoice('listening'); setHeard('')
    at(() => setVoice('transcribing'), 1500)
    words.forEach((_, i) => at(() => setHeard(words.slice(0, i + 1).join(' ')), 1500 + (i + 1) * 130))
    at(() => { setVoice('idle'); setHeard(''); sendRef.current(text, 'agent', model.name) }, 1500 + words.length * 130 + 800)
  }

  const composer = (big: boolean, up: boolean) => (
    <form onSubmit={e => { e.preventDefault(); send(q) }} className="relative rounded-2xl border border-[#2f9e73]/30 bg-surface p-3 shadow-[0_0_0_4px_rgb(47_158_115/0.07)] transition-shadow focus-within:border-[#2f9e73]/60 focus-within:shadow-[0_0_0_4px_rgb(47_158_115/0.14)]">
      {voice === 'idle' ? (
        <textarea rows={big ? 3 : 1} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q) } }}
          placeholder={p.placeholder} aria-label={`Message ${AI}`}
          className={cx('block max-h-48 w-full resize-none bg-transparent px-1 py-1 text-[15px] outline-none placeholder:text-text-3', big ? 'min-h-[84px]' : 'min-h-[32px]')} />
      ) : (
        <div className={cx('flex flex-col justify-center gap-2 px-1 py-1', big ? 'min-h-[84px]' : 'min-h-[48px]')} aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="flex h-8 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: 36 }, (_, i) => <span key={i} className="wave-bar block h-8 w-[3px] rounded-full bg-brand" style={{ animationDelay: `${(i * 73) % 700}ms`, animationDuration: `${(voice === 'listening' ? 600 : 1100) + (i * 37) % 500}ms`, opacity: voice === 'listening' ? 1 : 0.45 }} />)}
            </span>
            <span className="text-[12px] font-medium text-err">{voice === 'listening' ? 'Listening…' : 'Transcribing…'}</span>
          </div>
          <p className="min-h-[22px] text-[15px] text-text">{heard}{voice === 'transcribing' && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-text align-middle" />}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {p.context}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={startVoice} aria-label={voice === 'idle' ? 'Voice input' : 'Stop voice input'} aria-pressed={voice !== 'idle'} title={voice === 'idle' ? 'Voice input' : 'Stop'}
            className={cx('grid h-10 w-10 place-items-center rounded-full border transition-colors', voice === 'idle' ? 'border-border text-text-2 hover:border-brand hover:text-brand' : 'mic-live border-err bg-err text-white')}>{voice === 'idle' ? <Mic size={17} /> : <Square size={14} fill="currentColor" />}</button>
          <button type="submit" disabled={!q.trim() || !!p.thinking || voice !== 'idle'} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:bg-text-3/60"><ArrowUpRight size={17} /></button>
        </div>
      </div>
    </form>
  )

  const aiRow = (m: M) => {
    const showArt = m.card !== undefined
    const art = m.id === (selId ?? lastArt)
    if (brief) return (
      <div key={m.id} className="rise flex gap-3"><Mark size={28} /><div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border bg-surface px-5 py-4 shadow-sm">
        {m.trace && m.trace.length > 0 && <Process steps={m.trace} />}
        {m.sources ? <AskAnswer m={m} Md={Md} /> : m.text && <Paras text={m.text} Md={Md} />}
        {showArt && p.renderCard(m, m.id === lastArt && !p.thinking)}
        {m.text && <Actions m={m} last={m.id === lastAi && !p.thinking} onRegen={() => { const i = (msgs ?? []).findIndex(x => x.id === m.id), q = [...(msgs ?? []).slice(0, i)].reverse().find(x => x.role === 'user'); if (q?.text) send(q.text) }} />}
      </div></div>
    )
    return (
      <div key={m.id} className="rise flex gap-3"><Mark size={28} /><div className="min-w-0 flex-1 pt-0.5">
        {m.trace && m.trace.length > 0 && <Process steps={m.trace} />}
        {m.sources ? <AskAnswer m={m} Md={Md} /> : m.text && <Paras text={m.text} Md={Md} />}
        {showArt && (
          <button type="button" onClick={() => { setSelId(m.id) }} className={cx('mt-3 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', split && art ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-brand')}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Wand2 size={15} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{p.cardTitle(m)}</span><span className="block text-[11px] text-text-3">{split ? (art ? 'Showing in the sandbox' : 'Open in the sandbox') : 'Open in the sandbox'}</span></span>
            <ArrowUpRight size={14} className="shrink-0 text-text-3" /></button>
        )}
        {!m.sources && m.via && <p className="mt-2 text-[11px] text-text-3">via {m.via}</p>}
        {m.text && <Actions m={m} last={m.id === lastAi && !p.thinking && m.card === undefined} onRegen={() => { const i = (msgs ?? []).findIndex(x => x.id === m.id), q = [...(msgs ?? []).slice(0, i)].reverse().find(x => x.role === 'user'); if (q?.text) send(q.text) }} />}
      </div></div>
    )
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      {band}
      {groundBar}
      <div ref={wrap} className={cx('relative flex min-h-0 flex-1', drag && 'select-none')}>
      <div className={cx('relative flex min-h-0 min-w-0 flex-col', !split && 'flex-1', brief && 'bg-surface-2/50')} style={split ? { width: `${ratio * 100}%`, flex: 'none' } : undefined}>
        {!msgs ? (
          <div className="flex min-h-0 flex-1 overflow-y-auto px-5">
            <div className={cx('mx-auto w-full max-w-3xl pb-16 text-center', brief ? 'pt-[calc(5vh+12px)]' : 'pt-[calc(7vh+20px)]')}>
              {pill && brief && <div className="mb-4">{pill}</div>}
              <h1 className="text-[28px] font-semibold tracking-tight">Hi {p.userName}, {P ? P.greeting : 'how can I help you today?'}</h1>
              {P && <p className="mt-2 text-[14px] text-text-2">{P.purpose}</p>}
              <div className="mt-7 text-left">{composer(true, false)}</div>
              <div className="mt-6">{brief ? <QuestionList cards={p.cards} onPick={send} /> : <PromptCards cards={p.cards} onPick={send} />}</div>
              <p className="mx-auto mt-5 max-w-xl text-[12.5px] text-text-3">{p.note}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-6">
              <div className="mx-auto max-w-3xl space-y-6">
                {pill && brief && <div className="flex justify-center">{pill}</div>}
                {p.threadHeader}
                {msgs.map(m => m.role === 'user'
                  ? <div key={m.id} className="ml-auto w-fit max-w-[80%] break-words rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">{m.text}</div>
                  : aiRow(m))}
                {p.thinking && <div className="flex items-center gap-3"><Mark size={28} busy /><span className="flex items-center gap-2 text-xs text-text-3"><Loader2 size={13} className="animate-spin" />{p.thinking}…</span></div>}
                <div ref={end} />
              </div>
            </div>
            <div className={cx('shrink-0 px-5 pb-4 pt-2', brief ? 'border-t border-border bg-surface pt-3' : 'border-t border-transparent bg-surface')}>
              <div className="mx-auto max-w-3xl">{chips && <div className="mb-2.5 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">{chips.map(c => <button type="button" key={c} onClick={() => send(c)} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2 hover:border-brand hover:text-brand">{c}</button>)}</div>}
                {composer(false, true)}</div>
              <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-text-3">{p.note}</p>
            </div>
          </>
        )}
      </div>
      {split && (
        <div role="separator" aria-orientation="vertical" aria-label="Resize chat and sandbox" aria-valuemin={30} aria-valuemax={75} aria-valuenow={Math.round(ratio * 100)} tabIndex={0} title="Drag to resize, double-click to reset"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true) }}
          onPointerMove={e => { if (!drag || !wrap.current) return; const r = wrap.current.getBoundingClientRect(); setRatio(Math.min(0.75, Math.max(0.3, (e.clientX - r.left) / r.width))) }}
          onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)} onDoubleClick={() => setRatio(0.5)}
          onKeyDown={e => { if (e.key === 'ArrowLeft') setRatio(v => Math.max(0.3, v - 0.03)); if (e.key === 'ArrowRight') setRatio(v => Math.min(0.75, v + 0.03)) }}
          className="group relative z-10 w-2 shrink-0 cursor-col-resize bg-border outline-none">
          <span className={cx('absolute inset-y-0 -left-1 -right-1 transition-colors', drag ? 'bg-brand/20' : 'group-hover:bg-brand/10 group-focus-visible:bg-brand/10')} />
          <span className={cx('absolute left-1/2 top-1/2 flex h-10 w-3 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[3px] rounded-full border bg-surface shadow-sm', drag ? 'border-brand' : 'border-border-strong group-hover:border-brand')}>
            <i className="h-[3px] w-[3px] rounded-full bg-text-3" /><i className="h-[3px] w-[3px] rounded-full bg-text-3" /><i className="h-[3px] w-[3px] rounded-full bg-text-3" /></span>
        </div>
      )}
      {split && (
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col bg-surface-2/60">
          <Sandbox items={artifacts as M[]} activeId={selId} setActive={setSelId} renderCard={p.renderCard} cardTitle={p.cardTitle} lastId={lastArt} working={!!p.thinking} />
        </div>
      )}
      </div>
    </section>
  )
}

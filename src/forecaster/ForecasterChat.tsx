import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Activity, Bookmark, Check, GitCompare, Lock, MessagesSquare, Search, ShieldCheck, Users } from 'lucide-react'
import { DRIVERS, SEED_EVENTS, applyEvents, fmtDelta, fmtRev, fySum, revenue } from './workspace/engine'
import { ForecastChart, Legend, Tag, cx } from './workspace/ui'
import ChatShell from '../chat/ChatShell'
import type { Mode, Persona, PromptCard, Source } from '../chat/ChatShell'
import { BRANDS } from './workspace/Home'
import { BRAND_SCALE, fy27, person, scenarioLayer, scenarioName, scenarioSeries } from './workspace/insights'
import type { Insight } from './workspace/insights'
import { revSnap } from './workspace/insights'
import { SEED_PUBLISHED, publishedLabel, publishedOf } from './published'
import type { PublishedReg } from './published'

/** Forecast AI is read-only: every card explains the submitted forecast. None of them edit drafts or scenarios. */
export type FCard =
  | { t: 'bridge'; brandId: string; rows: [string, number][]; total: number }
  | { t: 'compare'; brandId: string; ids: string[] }
  | { t: 'health'; items: { ok: boolean; text: string }[] }
  | { t: 'brief'; brandId: string; points: string[] }
export type FMsg = { id: number; role: 'user' | 'ai'; text?: string; card?: FCard; chips?: string[]; trace?: string[]; mode?: Mode; sources?: Source[]; via?: string }
export type FThread = { id: number; title: string; brandId: string; msgs: FMsg[] }
type Out = Omit<FMsg, 'id' | 'role'>
type Assistant = { name: string; Mark: ComponentType<{ size?: number; busy?: boolean }>; Md: ComponentType<{ text: string }> }
type Save = (b: { brandId: string; kind: Insight['kind']; title: string; note: string; snap?: Insight['snap']; scenario?: string }) => void

const brandOf = (id: string) => BRANDS.find(b => b.id === id) ?? BRANDS[0]!
const M = (n: number) => fmtRev(n, 0)

export const FORECAST_AI: Persona = { label: 'Forecast AI: Ask & Understand', purpose: 'Understand forecasts and answer business questions.', greeting: 'what do you want to know?', icon: MessagesSquare }
/** Requests that belong to model building (COE AI), not to Forecast AI. */
const CONFIG_Q = /\b(archetypes?|modules?|module map|configure|configuration|set ?up (?:a|the|my) model|build (?:a|the|my) model|create (?:a|the|my) model|new model|engine (?:math|maths|logic)|finali[sz]e|publish)\b/i
/** Requests that would change draft forecast content. Forecast AI is read-only. */
const EDIT_Q = /\b(add|create|draft|save|apply|change|set|adjust|increase|decrease|raise|lower|switch on|turn on|activate|remove)\b.{0,30}\b(events?|scenarios?|drivers?|assumptions?|share|access|price|launch)\b|what.?if|goal ?seek|what gets me|get me to|what would it take|\bhit (?:a |the |my )?target|\bsubmit\b/i
const RESTRICTED_Q = /halo|restricted|bd pipeline|\bbd\b/i

/* ───────── Scripted use cases: each one reads the same engine the workspace uses ───────── */
export function reply(text: string, brandId: string, insights: Insight[]): { title?: string; out: Out[] } {
  const s = text.toLowerCase(), b = brandOf(brandId), m = BRAND_SCALE[brandId] ?? 1
  const base = fy27(brandId, 'sc2'), ref = fy27(brandId, 'sc1')

  if (/risk/.test(s) && !/insight/.test(s)) return { title: `${b.brand} risks`, out: [{ trace: ['Read the submitted forecast', 'Checked its events', 'Compared the range'], text: `**Biggest risk: the pediatric label decision.** Only Optimistic assumes it.\n\nRange: **${M(fy27(brandId, 'sc4'))} to ${M(fy27(brandId, 'sc3'))}** around a Base Case of **${M(base)}**.`, chips: ['Compare Optimistic and Pessimistic', 'What is driving this forecast?'] }] }
  if (/why|explain|moved|bridge|what changed|driving/.test(s) && !/insight/.test(s)) {
    const work = scenarioLayer('sc1'), f = (l: typeof work) => fySum(revenue(l)) * m
    const evs = SEED_EVENTS.filter(e => ['ev1', 'ev2'].includes(e.id))
    const rows: [string, number][] = evs.map(e => [e.name, f(applyEvents(work, [e])) - ref])
    const other = base - ref - rows.reduce((a, [, v]) => a + v, 0)
    if (Math.abs(other) > 0.05) rows.push(['Interaction between events', other])
    const top = [...rows].sort((a, c) => Math.abs(c[1]) - Math.abs(a[1]))[0]!
    return { title: `What moved ${b.brand}`, out: [{ trace: [`Read the ${b.brand} forecast`, 'Compared with the baseline', 'Sized each event'],
      text: `**FY27 Base Case: ${M(base)}, ${fmtDelta(base - ref, 0)} vs the baseline.** Most of it comes from **${top[0]}** (${fmtDelta(top[1], 0)}).`,
      card: { t: 'bridge', brandId, rows, total: base }, chips: ['Compare Optimistic and Pessimistic', 'Prep me for the review'] }] }
  }
  if (/compare|optimistic|pessimistic|upside|downside|range/.test(s)) {
    const ids = ['sc3', 'sc2', 'sc4']
    return { title: `${b.brand} range`, out: [{ trace: ['Loaded 3 scenarios', 'Read FY27 net revenue'],
      text: `**FY27 range: ${M(fy27(brandId, 'sc4'))} to ${M(fy27(brandId, 'sc3'))}, centred on ${M(base)}.** Optimistic adds the pediatric label. Pessimistic drops the formulary win.`,
      card: { t: 'compare', brandId, ids }, chips: ['What are the key risks?', 'Explain what moved ' + b.brand] }] }
  }
  if (/data|actuals|health|fresh|quality|outlier/.test(s)) {
    const items = [
      { ok: true, text: 'Actuals loaded through **Jul 2026**.' },
      { ok: false, text: '**Aug 2026** actuals arrive in 3 days.' },
      { ok: false, text: 'Jun 2026 access is **2.1 pts above trend**. Possible outlier.' },
      { ok: true, text: 'Confidence band is stable.' },
      ...(brandId === 'abrysvo' ? [{ ok: false, text: 'Model has **no access module**. Access is held at trend.' }] : []),
    ]
    return { title: 'Data health', out: [{ trace: ['Checked freshness', 'Scanned for outliers'], text: `**${b.brand} data is healthy. ${items.filter(i => !i.ok).length} thing${items.filter(i => !i.ok).length > 1 ? 's' : ''} to watch.**`, card: { t: 'health', items }, chips: ['Explain what moved ' + b.brand, 'Prep me for the review'] }] }
  }
  if (/prep|review|meeting|summar|brief/.test(s)) {
    const mine = insights.filter(i => i.brandId === brandId)
    const open = mine.filter(i => i.thread.length).length
    const points = [
      `Base Case: **${M(base)}**, **${fmtDelta(base - ref, 0)}** vs baseline.`,
      `Range: **${M(fy27(brandId, 'sc4'))} to ${M(fy27(brandId, 'sc3'))}**.`,
      'Events in Base Case: **Part D formulary win** (70%), **January WAC increase** (85%).',
      'Biggest risk: the **pediatric label decision**.',
      `${mine.length} insight${mine.length === 1 ? '' : 's'}, ${open} with open discussion.`,
    ]
    return { title: `${b.brand} review prep`, out: [{ trace: ['Read Base Case', 'Listed events', `Read ${mine.length} insights`], text: `**Five points for the ${b.brand} review.**`, card: { t: 'brief', brandId, points }, chips: ['Compare Optimistic and Pessimistic', 'What did the team say?'] }] }
  }
  if (/insight|team|said|discuss|tagged/.test(s)) {
    const mine = insights.filter(i => i.brandId === brandId)
    return { title: `${b.brand} insights`, out: [{ trace: [`Read ${b.brand} insights`], text: mine.length ? `**${mine.length} insight${mine.length === 1 ? '' : 's'} on ${b.brand}.**\n\n${mine.slice(0, 4).map(i => `- **${i.title}** · ${i.thread.length} comment${i.thread.length === 1 ? '' : 's'}, ${i.at}`).join('\n')}` : `No insights on ${b.brand} yet.`, chips: ['What is driving this forecast?', 'Prep me for the review'] }] }
  }
  if (/^(hi|hello|hey|thanks|thank you)/.test(s)) return { out: [{ text: 'Happy to help. Pick a question or ask your own.', chips: ['Explain what moved ' + b.brand, 'Compare Optimistic and Pessimistic', 'Check my data health'] }] }
  return { out: [{ text: 'I explain submitted forecasts: what moved the number, the range, the data and what the team said. I don’t change anything.', chips: ['Explain what moved ' + b.brand, 'What are the key risks?', 'Check my data health'] }] }
}

/* ───────── Cards ───────── */
function CardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('mt-3 overflow-hidden rounded-xl border border-border bg-surface', className)}>{children}</div>
}
function SaveBtn({ onClick }: { onClick: () => void }) {
  const [done, setDone] = useState(false)
  return <button type="button" disabled={done} onClick={() => { onClick(); setDone(true) }} className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-text-2 hover:border-brand hover:text-brand disabled:border-ok/40 disabled:text-ok">{done ? <Check size={12} /> : <Bookmark size={12} />}{done ? 'Saved to Insights' : 'Save to Insights'}</button>
}

function ChatCard({ c, save }: { c: FCard; save: Save }) {
  if (c.t === 'bridge') {
    const ref = c.total - c.rows.reduce((a, [, v]) => a + v, 0), max = Math.max(...c.rows.map(([, v]) => Math.abs(v)), 1)
    return (
      <CardShell>
        <div className="px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">FY27 net revenue bridge · {brandOf(c.brandId).brand}</p>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span>Reference baseline (Data Science)</span><span className="font-mono">{M(ref)}</span></div>
            {c.rows.map(([n, v]) => (
              <div key={n}><div className="flex justify-between"><span className="text-text-2">{n}</span><span className={cx('font-mono', v >= 0 ? 'text-ok' : 'text-err')}>{fmtDelta(v, 0)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cx('h-full rounded-full', v >= 0 ? 'bg-ok' : 'bg-err')} style={{ width: `${Math.max(4, Math.abs(v) / max * 100)}%` }} /></div></div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Base Case</span><span className="font-mono">{M(c.total)}</span></div>
          </div>
        </div>
        <div className="flex justify-end border-t border-border bg-surface-2 px-4 py-2"><SaveBtn onClick={() => save({ brandId: c.brandId, kind: 'Note', title: `What moved ${brandOf(c.brandId).brand} FY27`, note: c.rows.map(([n, v]) => `${n} ${fmtDelta(v, 0)}`).join(', ') + `. Base Case ${M(c.total)} vs reference ${M(ref)}.` })} /></div>
      </CardShell>
    )
  }
  if (c.t === 'compare') {
    const series = scenarioSeries(c.brandId, c.ids), b0 = fy27(c.brandId, 'sc2')
    return (
      <CardShell>
        <div className="px-4 pt-3"><div className="mb-1"><Legend s={series} /></div>
          <ForecastChart s={series} fmt={v => fmtRev(v, 1)} dp={0} unit="$M" height={190} toolbar={false} canSave={false} title="Scenario comparison" /></div>
        <table className="w-full text-[13px]"><thead><tr className="border-y border-border bg-surface-2 text-left text-[11px] uppercase tracking-wide text-text-3"><th className="px-4 py-2 font-semibold">Scenario</th><th className="px-2 py-2 text-right font-semibold">FY27</th><th className="px-4 py-2 text-right font-semibold">vs Base Case</th></tr></thead>
          <tbody>{c.ids.map(id => { const v = fy27(c.brandId, id); return <tr key={id} className="border-b border-border last:border-0"><td className="px-4 py-2 font-medium">{scenarioName(id)}</td><td className="px-2 py-2 text-right font-mono">{M(v)}</td><td className={cx('px-4 py-2 text-right font-mono', v - b0 > 0.5 ? 'text-ok' : v - b0 < -0.5 ? 'text-err' : 'text-text-3')}>{id === 'sc2' ? 'Reference' : fmtDelta(v - b0, 0)}</td></tr> })}</tbody></table>
        <div className="flex justify-end border-t border-border bg-surface-2 px-4 py-2"><SaveBtn onClick={() => save({ brandId: c.brandId, kind: 'Scenario', title: `${brandOf(c.brandId).brand}: Optimistic and Pessimistic vs Base Case`, note: `FY27 range ${M(fy27(c.brandId, 'sc4'))} to ${M(fy27(c.brandId, 'sc3'))} around ${M(b0)}.`, snap: revSnap(series), scenario: 'Scenario range' })} /></div>
      </CardShell>
    )
  }
  if (c.t === 'health') return (
    <CardShell><ul className="divide-y divide-border">{c.items.map((i, k) => <li key={k} className="flex gap-2.5 px-4 py-2.5 text-[13px]"><span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-white', i.ok ? 'bg-ok' : 'bg-warn')}>{i.ok ? <Check size={10} /> : <span className="text-[10px] font-bold">!</span>}</span><span className="text-text-2"><Bold text={i.text} /></span></li>)}</ul></CardShell>
  )
  if (c.t === 'brief') return (
    <CardShell>
      <ol className="space-y-2 px-4 py-3 text-[13px] text-text-2">{c.points.map((p, k) => <li key={k} className="flex gap-2.5"><span className="font-mono text-[11px] text-text-3">{k + 1}</span><span><Bold text={p} /></span></li>)}</ol>
      <div className="flex justify-end border-t border-border bg-surface-2 px-4 py-2"><SaveBtn onClick={() => save({ brandId: c.brandId, kind: 'Note', title: `${brandOf(c.brandId).brand} review brief`, note: c.points.map(p => p.replace(/\*\*/g, '')).join(' ') })} /></div>
    </CardShell>
  )
}
const Bold = ({ text }: { text: string }) => <>{text.split(/\*\*(.+?)\*\*/g).map((p, i) => i % 2 ? <b key={i} className="font-semibold text-text">{p}</b> : p)}</>

/* ───────── Chat page ───────── */
const CARD_TITLE: Record<FCard['t'], string> = { bridge: 'What moved the number', compare: 'Scenario range', health: 'Data health', brief: 'Review brief' }

function fcSrc(brandId: string, insights: Insight[], reg: PublishedReg) {
  const b = brandOf(brandId), a = publishedOf(brandId, reg)
  return {
    fc: { name: `${b.brand} ${a ? `${a.cycle} ${a.version}` : 'forecast'}`, kind: 'Forecast', detail: `${a?.scenario ?? 'Base Case'} as submitted. No drafts.`, meta: a ? a.state : '—' },
    record: { name: 'Submission record', kind: 'Policy', detail: a ? `${a.state} by ${a.by}, ${a.date}` : 'Nothing submitted', meta: a?.version },
    model: { name: `${b.brand} model`, kind: 'Model library', detail: `${b.stream} · ${DRIVERS.length} drivers`, meta: b.cycle },
    actuals: { name: 'Actuals · Snowflake', kind: 'Data feed', detail: 'Monthly actuals', meta: 'Through Jul 2026' },
    events: { name: 'Submitted events', kind: 'File', detail: 'Formulary win, WAC increase, pediatric label and more', meta: `${SEED_EVENTS.length} events` },
    ins: { name: 'Insights', kind: 'Insight', detail: `${insights.filter(i => i.brandId === brandId).length} saved on ${b.brand}`, meta: 'Team' },
    docs: { name: 'Forecasting guidelines', kind: 'Policy', detail: 'How scenarios and submissions work', meta: 'AOP 2027' },
    access: { name: 'Role access check', kind: 'Policy', detail: `${b.brand} is assigned to your role.`, meta: 'IAM' },
  } satisfies Record<string, Source>
}

function askFc(text: string, brandId: string, insights: Insight[], via: string, reg: PublishedReg): { out: Out[] } {
  const s = text.toLowerCase(), b = brandOf(brandId)
  const base = fy27(brandId, 'sc2'), ref = fy27(brandId, 'sc1'), hi = fy27(brandId, 'sc3'), lo = fy27(brandId, 'sc4')
  const src = fcSrc(brandId, insights, reg)
  const ans = (t: string[], sources: Source[], chips?: string[]) => ({ out: [{ text: t.join('\n\n'), sources, via, chips, trace: ['Read the question', 'Searched the submitted forecast', 'Checked the figures', 'Cited sources'] }] })
  const up = base >= ref
  if (/range|optimistic|pessimistic|upside|downside|scenario/.test(s)) return ans([`**FY27 range: ${M(lo)} to ${M(hi)}**, centred on ${M(base)}.`, `**Worth knowing:** the pediatric label decision is the main swing. If it slips, expect closer to ${M(base)}.`], [src.fc, src.record], ['What are the key risks?', 'Why is Base Case above the baseline?'])
  if (/why|moved|changed|driving|above|baseline|bridge/.test(s)) return ans([`**Base Case is ${M(base)}**, ${fmtDelta(base - ref, 0)} ${up ? 'above' : 'below'} the baseline.`, 'Two events add to it: the **Part D formulary win** (70%) and the **January WAC increase** (85%). The formulary win is bigger and less certain, so defend it first.'], [src.fc, src.events, src.model], ['What is the range across scenarios?', 'How fresh is the data?'])
  if (/data|actual|fresh|quality|outlier|refresh/.test(s)) return ans(['Actuals run through **Jul 2026**. Aug arrives in 3 days.', 'Jun 2026 access is **2.1 pts above trend**, a possible outlier. The submitted forecast is fine.'], [src.actuals, src.fc], ['Why is Base Case above the baseline?', 'Which events are in Base Case?'])
  if (/event|competitor|launch|wac|label|formulary|price|risk/.test(s)) return ans([`**2 of ${SEED_EVENTS.length} events** are in Base Case: the Part D formulary win and the January WAC increase.`, '**Biggest risk:** the pediatric label decision (Optimistic only). Main downside: competitor entry (Pessimistic only).'], [src.events, src.fc], ['What is the range across scenarios?', 'What are the key risks?'])
  if (/insight|team|said|discuss|tagged|saved|board/.test(s)) { const mine = insights.filter(i => i.brandId === brandId), disc = mine.filter(i => i.thread.length).length, tagged = insights.filter(i => i.tagged.includes('me')).length; return ans([`**${mine.length} insights** on ${b.brand}, ${disc} with open discussion. **${tagged}** tag you.`, 'Start with the ones that tag you.'], [src.ins], ['Prep me for the review']) }
  if (/driver|share|access|price|how does|work|cycle|matter/.test(s)) return ans([`${b.brand} uses **${DRIVERS.length} drivers**: ${DRIVERS.map(d => d.label.toLowerCase()).join(', ')}.`, '**Worth knowing:** share and access usually move the number most.'], [src.docs, src.model, src.fc], ['Why is Base Case above the baseline?', 'What is the range across scenarios?'])
  return ans([`I can explain the submitted ${b.brand} forecast: Base Case, range, data, events and team notes.`, 'I only use submitted forecasts you can access, and I cite every source.'], [src.fc, src.model], ['What is the range across scenarios?', 'Why is Base Case above the baseline?', 'How fresh is the data?'])
}

const FC_SRC: Record<FCard['t'], (keyof ReturnType<typeof fcSrc>)[]> = { bridge: ['fc', 'events', 'model'], compare: ['fc', 'record'], health: ['actuals', 'fc'], brief: ['fc', 'record', 'ins', 'events'] }
const FC_TAKE: Partial<Record<FCard['t'], string>> = {
  bridge: '**Tip:** defend the biggest bar first.',
  compare: '**Tip:** the gap comes from judgement calls, not trend.',
  health: '**Tip:** none of this changes the submitted numbers.',
  brief: '**Tip:** lead with Base Case and range, then the open risk.',
}

const ACT_FC = /explain|compare|prep|health|help me|risk|show what/i
const fcPartner = (t: string, b: string): { q: string; chips: string[] } => {
  const s = t.toLowerCase()
  if (/range|scenario|optimistic|pessimistic/.test(s)) return { q: `**What decision is the ${b} range for?**`, chips: ['Compare Optimistic and Pessimistic', 'What are the key risks?'] }
  if (/why|baseline|moved|driver|above|change/.test(s)) return { q: '**Is that what you expected?**', chips: ['What is driving this forecast?', 'What are the key risks?'] }
  if (/data|fresh|actual|outlier/.test(s)) return { q: '**Any source you doubt?**', chips: ['Check my data health'] }
  return { q: '**What decision is this for?**', chips: ['What is driving this forecast?', 'What are the key risks?'] }
}
const fcCards = (_b: string): PromptCard[] => [
    { icon: Search, title: 'Explain the drivers', prompts: ['What is driving this forecast?'] },
    { icon: ShieldCheck, title: 'Understand the risks', prompts: ['What are the key risks?'] },
    { icon: GitCompare, title: 'Compare the range', prompts: ['Compare Optimistic and Pessimistic'] },
    { icon: Activity, title: 'Check the data', prompts: ['Check my data health'] },
    { icon: Users, title: 'What the team said', prompts: ['What did the team say?'] },
    { icon: Bookmark, title: 'Prep for the review', prompts: ['Prep me for the review'] },
]
const FC_VOICE: Record<Mode, string[]> = {
  ask: ['What is the range across scenarios?', 'Why is the Base Case above the baseline?', 'How fresh is the data?'],
  agent: ['Explain what moved the number', 'What are the key risks?', 'Compare Optimistic and Pessimistic'],
}

/** One entry point for every Forecast AI surface: scope and access guards first, then a read-only answer with citations. */
export function forecastAnswer(text: string, brandId: string, insights: Insight[], opts: { via?: string; blocked?: string[]; published?: PublishedReg } = {}): { title?: string; mode: Mode; out: Out[] } {
  const reg = opts.published ?? SEED_PUBLISHED
  const t = text.trim(), b = brandOf(brandId), a = publishedOf(brandId, reg), via = opts.via ?? '', src = fcSrc(brandId, insights, reg)
  const no = (title: string, body: string[], sources: Source[], chips: string[]) => ({ title, mode: 'ask' as const, out: [{ text: body.join('\n\n'), sources, via, chips, trace: [] }] })
  const other = (opts.blocked ?? []).find(n => t.toLowerCase().includes(n.toLowerCase()))
  if (RESTRICTED_Q.test(t) || other) return no('Outside your access', [`**${other ? `You don’t have access to ${other}.` : 'That forecast is restricted.'}**`, 'Ask the owner to share it.'], [src.access], ['Explain what moved ' + b.brand])
  if (CONFIG_Q.test(t)) return no('That’s a model-building task', ['**Model building happens in COE AI: Build & Configure.**', 'I only answer questions about forecasts.'], [src.docs], ['What is driving this forecast?', 'What are the key risks?'])
  if (EDIT_Q.test(t)) return no('Make changes in the workspace', [`**Edits happen in the ${b.brand} workspace.** Open it to try that change.`], [src.docs, src.fc], ['What are the key risks?', 'Explain what moved ' + b.brand])
  if (!a) return no(`${b.brand}: nothing submitted yet`, [`**${b.brand} has no submitted forecast yet.**`, 'I can help once one is submitted.'], [src.record], BRANDS.filter(x => publishedOf(x.id, reg)).slice(0, 2).map(x => `Explain what moved ${x.brand}`))
  const mode: Mode = ACT_FC.test(t) ? 'agent' : 'ask'
  const res: { title?: string; out: Out[] } = mode === 'ask' ? askFc(t, brandId, insights, via, reg) : reply(t, brandId, insights)
  if (mode === 'agent') res.out.forEach(o => { const k = o.card && FC_TAKE[o.card.t]; if (k && o.text) o.text += '\n\n' + k; if (o.text) { o.sources = o.card ? FC_SRC[o.card.t].map(x => src[x]) : [src.fc, src.record]; o.trace ??= ['Read your question', 'Checked the submitted forecast', 'Prepared the answer'] } })
  // Every answer carries the role check as evidence, not only refusals.
  res.out.forEach(o => { if (o.sources && !o.sources.some(x => x.name === src.access.name)) o.sources = [...o.sources, src.access] })
  res.out.forEach(o => { if (o.text && !o.text.includes('?')) { const p = fcPartner(t, b.brand); o.text += '\n\n' + p.q; o.chips = [...(o.chips ?? []).slice(0, 1), ...p.chips] } })
  return { ...res, mode }
}

/** Role scope made visible: which forecasts Forecast AI may read for you, and which are withheld. */
function AccessChip({ blocked }: { blocked: string[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isBlocked = (n: string) => blocked.some(x => x.toLowerCase() === n.toLowerCase())
  const allowed = BRANDS.filter(x => !isBlocked(x.brand))
  const withheld = [...new Set([...blocked, 'Project Halo'])]
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-text-2 hover:border-brand hover:text-brand">
        <ShieldCheck size={13} className="text-ok" />Access · {allowed.length} forecasts</button>
      {open && (
        <div role="dialog" aria-label="Your forecast access" className="rise absolute right-0 top-10 z-40 w-72 rounded-xl border border-border bg-surface p-3 text-left shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">You can ask about</p>
          <ul className="mt-1.5 space-y-1">{allowed.map(x => <li key={x.id} className="flex items-center gap-2 text-[13px]"><Check size={12} className="text-ok" /><span className="flex-1">{x.brand}</span><span className="text-[11px] text-text-3">{x.stream}</span></li>)}</ul>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-3">Not available to you</p>
          <ul className="mt-1.5 space-y-1">{withheld.slice(0, 4).map(n => <li key={n} className="flex items-center gap-2 text-[13px] text-text-2"><Lock size={12} className="text-text-3" /><span className="flex-1 truncate">{n}</span><Tag tone="neutral">Restricted</Tag></li>)}</ul>
          {withheld.length > 4 && <p className="mt-1 pl-5 text-[12px] text-text-3">+{withheld.length - 4} more</p>}
          <p className="mt-3 border-t border-border pt-2 text-[12px] text-text-3">Same access as the rest of the platform.</p>
        </div>
      )}
    </div>
  )
}

export default function ForecasterChat({ threads, setThreads, cur, setCur, brandId: ctxBrand, setBrandId, insights, setInsights, notify, assistant, userName, blocked, published = SEED_PUBLISHED }: {
  threads: FThread[]; setThreads: (f: (t: FThread[]) => FThread[]) => void; cur: number | null; setCur: (id: number | null) => void; brandId: string; setBrandId: (id: string) => void
  insights: Insight[]; setInsights: (f: (x: Insight[]) => Insight[]) => void; notify: (t: { tone: 'ok' | 'info' | 'err'; text: string }) => void; assistant: Assistant; userName: string; blocked?: string[]; published?: PublishedReg
}) {
  const AI = assistant.name
  const [thinking, setThinking] = useState<string | null>(null)
  const th = threads.find(t => t.id === cur)
  const brandId = th?.brandId ?? ctxBrand, b = brandOf(brandId), ap = publishedOf(brandId, published)

  const send = (text: string, _m: Mode, via: string) => {
    const t = text.trim(); if (!t || thinking) return
    const named = BRANDS.find(x => t.toLowerCase().includes(x.brand.toLowerCase()))
    // A blocked brand never becomes the grounding brand; the refusal answers from the current one.
    const ok = named && !(blocked ?? []).some(n => n.toLowerCase() === named.brand.toLowerCase())
    const bid = ok ? named.id : brandId
    const res = forecastAnswer(t, bid, insights, { via, blocked, published })
    const mode = res.mode
    const base: FThread = th ?? { id: Date.now(), title: t.length > 38 ? t.slice(0, 36) + '…' : t, brandId: bid, msgs: [] }
    const withQ: FThread = { ...base, brandId: bid, msgs: [...base.msgs, { id: Date.now(), role: 'user', text: t, mode }] }
    if (!th) { setThreads(ts => [withQ, ...ts]); setCur(base.id) } else setThreads(ts => ts.map(x => x.id === base.id ? withQ : x))
    if (ok) setBrandId(named.id)
    setThinking(res.out[0]?.trace?.[0] ?? `${AI} is thinking`)
    window.setTimeout(() => {
      setThreads(ts => ts.map(x => x.id === base.id ? { ...x, title: res.title && !th ? res.title : x.title, msgs: [...x.msgs, ...res.out.map((o, k) => ({ id: Date.now() + k + 1, role: 'ai' as const, mode, via, ...o }))] } : x))
      setThinking(null)
    }, 600 + (res.out[0]?.trace?.length ?? 0) * 280)
  }
  const save: Save = r => {
    const br = brandOf(r.brandId)
    setInsights(xs => [{ id: `c${Date.now()}`, brandId: br.id, brand: br.brand, cycle: br.cycle, kind: r.kind, title: r.title, note: r.note, snap: r.snap, scenario: r.scenario, by: 'me', at: 'Just now', tagged: [], thread: [] }, ...xs])
    notify({ tone: 'ok', text: `Saved to ${br.brand} Insights.` })
  }

  // Read-only grounding: the forecast is picked from the question (name a brand to switch), never chosen as a source by hand.
  const grounding = (
    <div className="flex flex-wrap items-center gap-2">
      <span title="Name another brand to switch." className="inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-full border border-border bg-surface-2 px-3 text-[12px] text-text-2">
        <span className="text-text-3">Using</span><b className="font-semibold text-text">{b.brand}</b>
        {ap ? <><span className="truncate">{ap.cycle} {ap.version}</span><Tag tone={ap.state === 'Approved' ? 'ok' : 'warn'}>{ap.state === 'Approved' ? 'Approved' : 'In review'}</Tag></> : <Tag tone="neutral">Not submitted</Tag>}
      </span>
      <span className="hidden text-[12px] text-text-3 md:inline">No drafts</span>
      <div className="ml-auto"><AccessChip blocked={blocked ?? []} /></div>
    </div>
  )

  return (
    <ChatShell<FMsg>
      assistant={assistant} userName={userName}
      threads={threads} cur={cur} setCur={setCur} msgs={th?.msgs ?? null} thinking={thinking}
      onSend={send}
      renderCard={m => m.card ? <ChatCard c={m.card} save={save} /> : null}
      cardTitle={m => m.card ? CARD_TITLE[m.card.t] : ''}
      cards={fcCards(b.brand)} voice={FC_VOICE.agent} persona={FORECAST_AI}
      variant="briefing" grounding={grounding}
      threadHeader={th ? <p className="flex items-center justify-center gap-2 text-[12px] text-text-3"><Tag tone="brand">{b.brand}</Tag>{ap ? publishedLabel(ap) : 'No submitted forecast yet'} · {b.stream}</p> : null}
      placeholder={`Ask about the ${b.brand} forecast`}
      note="Uses submitted forecasts you can access, with sources."
    />
  )
}

import type { ReactNode } from 'react'
import { CheckCircle2, Loader2, Play, RotateCcw, Square, X, Zap } from 'lucide-react'

/* Shared Charles agent pieces, so the CoE configurator and the Forecaster use the same green branding. */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export type DemoRun = { i: number; done: boolean } | null

/** Primary agent action: the same animated green as the "Collaborate with AI" button. */
export function AgentButton({ children, onClick, icon, variant = 'solid' }: { children: ReactNode; onClick: () => void; icon?: ReactNode; variant?: 'solid' | 'outline' }) {
  return (
    <button type="button" onClick={onClick} className={cx('inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition-colors',
      variant === 'solid' ? 'ai-btn text-white' : 'border border-[#0095ff]/40 bg-surface text-[#0000c9] hover:border-[#0095ff] hover:bg-[#0095ff]/5')}>
      {icon}{children}
    </button>
  )
}

/** Chat card that scripts a bounded agent run and shows each step as it happens. */
export function AgentDemoCard({ assistant, title, prompt, steps, demo, onRun, onStop, onReview, reviewLabel, note }: {
  assistant: string; title: string; prompt: string; steps: string[]; demo: DemoRun; onRun: () => void; onStop: () => void; onReview: () => void; reviewLabel: string; note: string
}) {
  const running = !!demo && !demo.done
  return (
    <div className={cx('rounded-xl p-[1.5px]', running ? 'agent-bg' : 'bg-[linear-gradient(110deg,#000067,#0095ff,#aee3ff)]')}>
      <div className="rounded-[10px] bg-surface p-3.5 text-sm">
        <span className="mb-1.5 inline-flex items-center gap-1 rounded bg-[#0095ff]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0000c9]"><Zap size={10} />Demo · agent workflow</span>
        <p className="font-semibold">{title}</p>
        <p className="mt-1.5 rounded-md bg-background px-2.5 py-2 text-xs italic text-text-2">“{prompt}”</p>
        {demo && (
          <ol className="mt-3 space-y-2">{steps.map((t, k) => {
            const st = demo.i > k || demo.done ? 'done' : demo.i === k ? 'doing' : 'todo'
            return <li key={t} className={cx('flex items-center gap-2 text-xs', st === 'todo' ? 'text-text-3' : 'text-text')}>
              {st === 'done' ? <CheckCircle2 size={14} className="shrink-0 text-[#0095ff]" /> : st === 'doing' ? <Loader2 size={14} className="shrink-0 animate-spin text-[#0095ff]" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-strong" />}
              <span className={cx(st === 'doing' && 'agent-caret font-semibold')}>{t}</span>
            </li>
          })}</ol>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {!demo && <AgentButton icon={<Play size={13} />} onClick={onRun}>Watch {assistant} build it</AgentButton>}
          {running && <AgentButton variant="outline" icon={<Square size={11} />} onClick={onStop}>Stop</AgentButton>}
          {demo?.done && <><AgentButton onClick={onReview}>{reviewLabel}</AgentButton><AgentButton variant="outline" icon={<RotateCcw size={13} />} onClick={onRun}>Replay</AgentButton></>}
        </div>
        <p className="mt-2 text-[10px] text-text-3">{note}</p>
      </div>
    </div>
  )
}

/** One status strip under the page's action bar: live progress while the agent works, then a single review hand-off. */
export function AgentBanner({ assistant, running, step, progress, title, children, onStop, actions, onDismiss }: {
  assistant: string; running: boolean; step?: string; progress?: [number, number]; title: string; children?: ReactNode; onStop?: () => void; actions?: ReactNode; onDismiss?: () => void
}) {
  return (
    <div role="status" aria-live="polite" className={cx('rise rounded-xl p-[1.5px] shadow-[0_12px_32px_-18px_rgba(15,90,67,0.55)]', running ? 'agent-bg' : 'bg-[linear-gradient(110deg,#000067,#0095ff,#aee3ff,#0095ff)]')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] bg-surface px-4 py-2.5">
        <span className={cx('ai-orb h-8 w-8 shrink-0 rounded-full', running && 'ai-orb-busy')} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-text">
            {title}
            {running && step && <span className="inline-flex items-center gap-1 rounded bg-[#0095ff]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#0000c9]"><Loader2 size={10} className="animate-spin" />{step}</span>}
            {!running && <span className="inline-flex items-center gap-1 rounded bg-[#0095ff]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#0000c9]">Built by {assistant} · needs your review</span>}
          </p>
          {children && <div className="mt-0.5 text-[12px] leading-snug text-text-2">{children}</div>}
          {running && progress && <div className="mt-1.5 h-1 max-w-sm overflow-hidden rounded-full bg-[#0095ff]/15"><div className="h-full rounded-full bg-[#0095ff] transition-all duration-500" style={{ width: `${Math.round((progress[0] / progress[1]) * 100)}%` }} /></div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {running && onStop && <AgentButton variant="outline" icon={<Square size={11} />} onClick={onStop}>Stop</AgentButton>}
          {!running && actions}
          {!running && onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text"><X size={15} /></button>}
        </div>
      </div>
    </div>
  )
}

/** Card-level ring shown while the agent works inside a section. Keeps one element tree so children keep their state. */
export function AgentFrame({ on, label, children }: { on: boolean; label: string; children: ReactNode }) {
  return (
    <div className={cx(on && 'agent-section')}>
      {on && <span className="agent-bg absolute -top-3 right-4 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"><Loader2 size={11} className="animate-spin" />{label}</span>}
      {children}
    </div>
  )
}

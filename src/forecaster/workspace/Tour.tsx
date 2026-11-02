import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Btn, cx } from './ui'

export type TourStep = { target: string; title: string; body: string }
type Rect = { top: number; left: number; width: number; height: number }
const PAD = 6, CARD_W = 340

/** Spotlight tour: highlights one on-screen component per step and dims everything else. Targets are [data-tour] or #id selectors. */
export function Tour({ steps, step, onStep, onClose }: { steps: TourStep[]; step: number; onStep: (k: number) => void; onClose: () => void }) {
  const s = steps[step]!, last = step === steps.length - 1
  const [rect, setRect] = useState<Rect | null>(null)
  useLayoutEffect(() => {
    const find = () => document.querySelector<HTMLElement>(s.target.startsWith('#') ? s.target : `[data-tour="${s.target}"]`)
    const measure = () => { const el = find(); if (!el) return setRect(null); const r = el.getBoundingClientRect(); setRect(r.width ? { top: r.top, left: r.left, width: r.width, height: r.height } : null) }
    // The view may switch for this step, so give it a frame to render before scrolling the target into view.
    const t1 = window.setTimeout(() => { find()?.scrollIntoView({ block: 'center', behavior: 'smooth' }); measure() }, 80)
    const t2 = window.setTimeout(measure, 450)
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [s.target])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') last ? onClose() : onStep(step + 1); if (e.key === 'ArrowLeft' && step) onStep(step - 1) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [step, last, onStep, onClose])

  const vw = window.innerWidth, vh = window.innerHeight
  const below = !rect || rect.top + rect.height + 220 < vh
  const card = rect
    ? { left: Math.max(12, Math.min(vw - CARD_W - 12, rect.left)), top: below ? Math.min(vh - 200, rect.top + rect.height + PAD + 12) : undefined, bottom: below ? undefined : Math.max(12, vh - rect.top + PAD + 12) }
    : { left: (vw - CARD_W) / 2, top: vh / 2 - 100 }
  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Blocks the page while touring; the spotlight's shadow does the dimming. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      {rect
        ? <div aria-hidden className="pointer-events-none absolute rounded-lg ring-2 ring-brand transition-all duration-300" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(11, 15, 46, 0.55)' }} />
        : <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgba(11,15,46,0.55)]" />}
      <div className="rise absolute rounded-xl bg-surface p-4 shadow-2xl" style={{ width: CARD_W, ...card }}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-brand">What’s new · {step + 1} of {steps.length}</p>
          <button type="button" onClick={onClose} aria-label="End tour" className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-md text-text-2 hover:bg-surface-2"><X size={15} /></button>
        </div>
        <h2 id="tour-title" className="mt-1.5 text-[16px] font-semibold tracking-tight">{s.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-text-2">{s.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden>{steps.map((_, i) => <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-4 bg-brand' : 'w-1.5 bg-border-strong')} />)}</div>
          <div className="ml-auto flex gap-1.5">
            {step > 0 ? <Btn size="sm" variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => onStep(step - 1)}>Back</Btn> : <Btn size="sm" variant="ghost" onClick={onClose}>Skip</Btn>}
            <Btn size="sm" icon={last ? undefined : <ArrowRight size={13} />} onClick={() => (last ? onClose() : onStep(step + 1))}>{last ? 'Finish' : 'Next'}</Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

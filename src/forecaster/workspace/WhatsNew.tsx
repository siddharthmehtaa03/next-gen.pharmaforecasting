import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Btn } from './ui'

export const WHATS_NEW_KEY = 'ngf-whats-new-v2'
// Read once by the forecast workspace on open, so the spotlight tour starts there.
export const TOUR_FLAG = 'ngf-tour-start'

/** Intro to the guided tour. The tour itself runs inside a forecast, on the real components. */
export function WhatsNew({ onClose, onStart, brand }: { onClose: () => void; onStart: () => void; brand: string }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-[rgba(11,15,46,0.55)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" className="rise relative w-full max-w-[440px] rounded-xl bg-surface p-6 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2"><X size={16} /></button>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand"><Sparkles size={19} /></span>
        <h2 id="whats-new-title" className="mt-4 text-[20px] font-semibold tracking-tight">The forecaster workflow has changed</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">Eight tabs in working order, actual KPIs on the baseline, five default modules in the forecast map, Analytics, sharper events and a leaner header. Take a guided tour on the {brand} forecast: each change is highlighted where it lives.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Not now</Btn>
          <Btn onClick={onStart} icon={<Sparkles size={14} />}>Start the tour</Btn>
        </div>
      </div>
    </div>
  )
}

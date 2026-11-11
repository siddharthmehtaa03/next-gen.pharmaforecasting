import { useEffect, useState } from 'react'
import { scrollFrameTop } from '../frame'
import type { ComponentType, ReactNode } from 'react'
import { Eye, Layers, Sparkles, Wand2 } from 'lucide-react'
import { EngineProvider, useEngine } from './workbook/engine'
import CurrentYear from './workbook/CurrentYear'
import Menu from './workbook/Menu'
import Events from './workbook/Events'
import Dashboard from './workbook/Dashboard'

/*
 * Full LES Model 2 workbook — the file's own tabs, in the file's own order.
 * Redesigned pages read from and drive the embedded workbook (see workbook/engine.tsx);
 * tabs not yet redesigned show the original page, restyled.
 */

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }

const MAIN = ['Menu', 'Last Year', 'Current Year', 'Next +4 Yr Budget', 'Yr 5–10 Budget', 'Pricing', 'GTN', 'Events']
const ANALYTICS = ['Patient Funnel', 'Performance Dashboard', 'Sales Drivers', 'GTN Analysis', 'Financial Bridges', 'Needs-to-Meet', 'LRP', 'Event Landscape', 'Judgment Layer', 'Competition', 'U.E. Analytics']
const PAGES: Record<string, ComponentType> = { Menu, 'Current Year': CurrentYear, Events, 'Performance Dashboard': Dashboard }
const VIEW_FALLBACK = ['Franchise', 'Oral CGRP (Migraine)', 'Nasal CGRP (Migraine)']

export default function Workbook({ initialTab = 'Current Year', embedded }: { initialTab?: string; embedded?: boolean }) {
  return (
    <EngineProvider frameClass="absolute inset-0 h-full w-full border-0">
      {frame => <Shell frame={frame} initialTab={initialTab} embedded={embedded} />}
    </EngineProvider>
  )
}

function Shell({ frame, initialTab, embedded }: { frame: ReactNode; initialTab: string; embedded?: boolean }) {
  const e = useEngine()
  const [tab, setTab] = useState(initialTab)
  const h = e.ready ? e.header() : { sub: '', scenario: '', views: VIEW_FALLBACK, activeView: '' }
  const views = h.views.length ? h.views : VIEW_FALLBACK
  const Page = PAGES[tab]
  const original = !Page || e.showOriginal

  useEffect(() => { if (e.ready) e.press(tab) }, [tab, e.ready])
  useEffect(() => { e.setFrameVisible(original) }, [original])

  const tabBtn = (t: string, analytics = false) => (
    <button key={t} type="button" onClick={() => { setTab(t); scrollFrameTop() }} aria-current={tab === t ? 'page' : undefined}
      className={cx('relative shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        tab === t ? 'bg-brand text-white shadow-sm' : analytics ? 'text-brand hover:bg-brand-soft' : 'text-text-2 hover:bg-surface-2 hover:text-text')}>
      {t}
      {PAGES[t] && tab !== t && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-ok" />}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cx('z-20 border-b border-border bg-surface/95 backdrop-blur', !embedded && 'sticky top-[57px]')}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-text-3">Market view</span>
          <div role="radiogroup" aria-label="Market view" className="inline-flex flex-wrap rounded-full border border-border bg-surface-2 p-1">
            {views.map(v => {
              const on = (h.activeView || 'Oral CGRP (Migraine)') === v
              return <button key={v} type="button" role="radio" aria-checked={on} onClick={() => e.press(v, e.doc?.querySelector('#root > div > div:first-child'))}
                className={cx('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all', on ? 'bg-surface text-text shadow-sm' : 'text-text-2 hover:text-text')}>
                {v === 'Franchise' ? <Layers size={12} /> : <span className={cx('h-1.5 w-1.5 rounded-full', on ? 'bg-brand' : 'bg-border-strong')} />}{v}
              </button>
            })}
          </div>
          {e.ready && <p className="text-xs text-text-2"><span className="text-text-3">Working on</span> <strong className="font-semibold text-text">{h.sub}</strong> · <strong className="font-semibold text-text">{h.scenario}</strong></p>}
          <div className="ml-auto flex items-center gap-2">
            {Page && (
              <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5 text-xs font-semibold">
                <button type="button" onClick={() => e.setShowOriginal(false)} className={cx('inline-flex items-center gap-1 rounded px-2.5 py-1', !e.showOriginal ? 'bg-surface text-brand shadow-sm' : 'text-text-2')}><Wand2 size={12} />New layout</button>
                <button type="button" onClick={() => e.setShowOriginal(true)} className={cx('inline-flex items-center gap-1 rounded px-2.5 py-1', e.showOriginal ? 'bg-surface text-brand shadow-sm' : 'text-text-2')}><Eye size={12} />Original</button>
              </div>
            )}
          </div>
        </div>
        <nav aria-label="Workbook tabs" className="space-y-1 px-5 pb-2.5 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto">{MAIN.map(t => tabBtn(t))}</div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="mr-1 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-widest text-text-3">Analytics</span>
            {ANALYTICS.map(t => tabBtn(t, true))}
          </div>
        </nav>
      </div>

      {!e.ready && <p className="flex items-center justify-center gap-2 py-24 text-sm text-text-2"><Sparkles size={15} className="animate-pulse text-brand" />Loading the LES workbook…</p>}
      {e.ready && !original && Page && (
        <main key={tab} className="mx-auto w-full px-10 py-6">
          {!embedded && <h1 className="font-display text-[26px] font-semibold tracking-tight">{tab}</h1>}
          <div className="mt-4"><Page /></div>
        </main>
      )}
      <div className={original ? 'relative min-h-[calc(100dvh-170px)] flex-1 bg-surface-2' : ''}>{frame}</div>
      {e.ready && original && !Page && <p className="border-t border-border bg-surface px-5 py-2 text-[11px] text-text-3">This tab shows the workbook's own layout; it's next in line for the redesign.</p>}
    </div>
  )
}

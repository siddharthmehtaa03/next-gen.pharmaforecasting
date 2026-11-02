import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { eid, txt, useEngine } from './engine'
import { Kids, MirrorCard, MTable, ProxyButton } from './Mirror'

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }
const SUBS = ['LE1', 'LE2', 'LE3', 'LE4', 'Op Plan']

function Prob({ el }: { el: HTMLInputElement }) {
  const e = useEngine(); const id = eid(el)
  const v = Number(el.value) || 0
  return (
    <div className={cx('flex items-center gap-2', el.disabled && 'opacity-50')}>
      <input type="range" min={0} max={100} value={v} disabled={el.disabled} onChange={ev => e.setValue(id, ev.target.value)} className="w-28 accent-brand" aria-label="Probability" />
      <input type="number" min={0} max={100} value={v} disabled={el.disabled} onChange={ev => e.setValue(id, ev.target.value)} className="h-7 w-14 rounded-md border border-border bg-surface px-1.5 text-right font-mono text-xs" />
      <span className="text-xs text-text-3">%</span>
    </div>
  )
}

export default function Events() {
  const e = useEngine()
  const h = e.header()
  const [openRow, setOpenRow] = useState<string | null>(null)

  const d = useMemo(() => {
    const cards = e.cards()
    const mgr = cards.find(c => txt(c).startsWith('Scenario Mgr'))
    const reg = cards.find(c => txt(c).includes('Event register'))
    const mgrBtns = mgr ? Array.from(mgr.querySelectorAll('button')) : []
    const subs = mgrBtns.filter(b => SUBS.includes(txt(b)))
    const scen = mgrBtns.filter(b => !SUBS.includes(txt(b)))
    const allText = cards.map(txt).join('\n')
    const lines = allText.split('\n').map(l => l.trim()).filter(Boolean)
    const cats = ['Market Events', 'Product Events', 'Pricing Events'].map(k => {
      const i = lines.indexOf(k)
      const inc = lines.slice(i + 1, i + 4).find(l => /in forecast/.test(l)) ?? ''
      const v = lines.slice(i + 1, i + 5).find(l => /^[+−-]\$/.test(l)) ?? ''
      return { k, inc, v }
    })
    const regBtns = reg ? Array.from(reg.querySelectorAll('button')).filter(b => !b.closest('table')) : []
    const table = reg?.querySelector('table') as HTMLTableElement | null
    const isRegister = !!table && txt(table.tHead).toUpperCase().includes('PROB')
    const rows = isRegister ? Array.from(table!.tBodies[0]!.rows).filter(r => r.cells.length > 5) : []
    const rest = cards.filter(c => c !== mgr && c !== reg && !/^(Market|Product|Pricing) Events/.test(txt(c)))
    return { mgr, reg, subs, scen, cats, regBtns, table, isRegister, rows, rest }
  }, [e.version, e.ready])

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Submission</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{d.subs.map(b => <button key={eid(b)} type="button" onClick={() => e.act(eid(b))} className={cx('rounded-full border px-3 py-1 text-xs font-semibold', txt(b) === h.sub ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/50')}>{txt(b)}</button>)}</div>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Scenario</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{d.scen.map(b => <button key={eid(b)} type="button" onClick={() => e.act(eid(b))} className={cx('rounded-full border px-3 py-1 text-xs font-semibold', txt(b) === h.scenario ? 'border-brand bg-brand-soft text-brand-dark' : 'border-border hover:border-brand/50')}>{txt(b)}</button>)}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {d.cats.map(c => (
            <div key={c.k} className="rounded-lg bg-surface-2 p-4">
              <p className="text-xs font-medium text-text-2">{c.k}</p>
              <p className={cx('mt-1 font-mono text-2xl font-semibold', c.v.startsWith('−') || c.v.startsWith('-') ? 'text-err' : c.v === '+$0.0M' ? 'text-text' : 'text-ok')}>{c.v}</p>
              <p className="text-xs text-text-3">{c.inc} · FY 2026 risk-adjusted</p>
            </div>
          ))}
        </div>
        {h.scenario === 'Trended Statistical' && <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">"Trended Statistical" always excludes events. Pick another scenario to switch events on and set probabilities.</p>}
      </section>

      {d.reg && (
        <section className="rounded-xl border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-[17px] font-semibold">Event register</h2>
              <p className="text-sm text-text-2">Switch an event into the current scenario and set how likely it is.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">{d.regBtns.map(b => <ProxyButton key={eid(b)} el={b} />)}</div>
          </div>
          {d.isRegister ? (
            <ul className="divide-y divide-border">
              {d.rows.map(r => {
                const c = Array.from(r.cells)
                const id = eid(r)
                const sw = c[0]!.querySelector('button') as HTMLButtonElement | null
                const info = c[1]!
                const name = txt(info.querySelector('span')) || txt(info).split('\n')[0]
                const pills = Array.from(info.querySelectorAll('span[style*="border-radius: 20px"]')).map(x => x as HTMLElement)
                const prob = c[5]?.querySelector('input') as HTMLInputElement | null
                const fy = txt(c[c.length - 1])
                const open = openRow === id
                return (
                  <li key={id} className={cx('px-5 py-3.5', open && 'bg-surface-2/50')}>
                    <div className="grid items-center gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]">
                      {sw ? <ProxyButton el={sw} /> : <span />}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {pills.map((p, i) => <span key={i} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: p.style.color, background: p.style.background }}>{txt(p)}</span>)}
                          <span className="text-[11px] text-text-3">· {txt(c[2])} · {txt(c[3])} · {txt(c[7])}</span>
                        </div>
                      </div>
                      <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-text-3">Mkt / share / price</p><p className="font-mono text-xs"><Kids el={c[4]!} /></p></div>
                      {prob ? <Prob el={prob} /> : <span />}
                      <div className="flex items-center gap-3">
                        <span className={cx('min-w-[84px] text-right font-mono text-sm font-semibold', fy === 'Excluded' ? 'text-text-3' : fy.startsWith('−') || fy.startsWith('-') ? 'text-err' : 'text-ok')}>{fy}</span>
                        <button type="button" aria-expanded={open} aria-label="Details" onClick={() => setOpenRow(open ? null : id)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-surface-2"><ChevronDown size={15} className={cx('transition-transform', open && 'rotate-180')} /></button>
                      </div>
                    </div>
                    {open && (
                      <div className="rise mt-3 grid gap-3 rounded-2xl border border-border bg-surface shadow-card p-4 text-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <div className="space-y-2 text-text-2 [&_input]:inline-block"><Kids el={info} /></div>
                        <dl className="space-y-1.5 text-xs">
                          {['Date', 'Markets', 'Impacts', 'Probability', 'Phase', 'Duration', 'Magnitude', 'Confidence'].map((k, i) => <div key={k} className="flex justify-between gap-2"><dt className="text-text-3">{k}</dt><dd className="font-medium">{txt(c[i + 2])}</dd></div>)}
                        </dl>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : d.table ? <div className="p-5"><MTable el={d.table} /></div> : <div className="p-5"><Kids el={d.reg} /></div>}
        </section>
      )}

      {d.rest.map((c, i) => <MirrorCard key={i} el={c} />)}
    </div>
  )
}

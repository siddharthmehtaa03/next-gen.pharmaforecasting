import { useMemo } from 'react'
import { Check, Plus } from 'lucide-react'
import { eid, txt, useEngine } from './engine'
import { MirrorCard, ProxyButton, ProxyInput } from './Mirror'

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }
const SUBS = ['LE1', 'LE2', 'LE3', 'LE4', 'Op Plan']

export default function Menu() {
  const e = useEngine()
  const h = e.header()
  const d = useMemo(() => {
    const cards = e.cards()
    const subsCard = cards.find(c => txt(c).includes('Submissions & scenarios'))
    const btns = subsCard ? Array.from(subsCard.querySelectorAll('button')) : []
    const subs = btns.filter(b => SUBS.includes(txt(b)) && !b.closest('[data-card-chip]'))
    const scen = btns.filter(b => txt(b).includes('\n') && !txt(b).startsWith('Save'))
    const nameInput = subsCard?.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null
    const saveBtn = btns.find(b => txt(b).startsWith('Save current settings'))
    const subNote = subsCard ? txt(subsCard).split('\n').find(l => /due|closed|remembers/i.test(l)) : ''
    return { cards, subsCard, subs, scen, nameInput, saveBtn, subNote }
  }, [e.version, e.ready])

  return (
    <div className="space-y-5">
      {d.subsCard && (
        <section className="rise rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[17px] font-semibold">Choose what you're forecasting</h2>
            </div>
            <p className="text-xs text-text-3">{txt(d.subsCard).split('\n').find(l => /custom slots/.test(l))}</p>
          </div>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-text-3">1 · Submission</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {d.subs.map(b => {
              const on = txt(b) === h.sub
              return <button key={eid(b)} type="button" onClick={() => e.act(eid(b))} disabled={b.disabled}
                className={cx('rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40', on ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/50')}>{txt(b)}</button>
            })}
            {d.subNote && <span className="text-xs text-text-3">{d.subNote}</span>}
          </div>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-text-3">2 · Scenario</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.scen.map(b => {
              const [title, ...rest] = txt(b).split('\n')
              const on = title === h.scenario
              const tag = rest[rest.length - 1]
              return (
                <button key={eid(b)} type="button" onClick={() => e.act(eid(b))}
                  className={cx('group relative rounded-lg border p-4 text-left transition-all', on ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-border hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-card')}>
                  <span className="flex items-center justify-between gap-2"><span className="font-semibold">{title}</span>{on && <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-white"><Check size={12} strokeWidth={3} /></span>}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-text-2">{rest.slice(0, -1).join(' ')}</span>
                  {tag && <span className="mt-2 inline-block rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-3">{tag}</span>}
                </button>
              )
            })}
          </div>

          {d.nameInput && d.saveBtn && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong p-3">
              <Plus size={15} className="text-brand" />
              <span className="text-sm font-medium">Save your current settings as a new scenario</span>
              <ProxyInput el={d.nameInput} />
              <ProxyButton el={d.saveBtn}>Save scenario</ProxyButton>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {d.cards.filter(c => c !== d.subsCard).map((c, i) => <MirrorCard key={i} el={c} />)}
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { eid, txt, useEngine } from './engine'
import { MirrorCard, ProxyButton, ProxySelect } from './Mirror'

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }

export default function Dashboard() {
  const e = useEngine()
  const d = useMemo(() => {
    const cards = e.cards()
    const head = cards[0]
    const selects = head ? Array.from(head.querySelectorAll('select')) : []
    const btns = head ? Array.from(head.querySelectorAll('button')) : []
    const kpiCard = cards.find(c => /^Net Sales\n/.test(txt(c)))
    const tiles = kpiCard ? (Array.from(kpiCard.children).length >= 6 ? Array.from(kpiCard.children) : Array.from(kpiCard.firstElementChild?.children ?? [])) as HTMLElement[] : []
    return { cards, head, selects, btns, kpiCard, tiles, rest: cards.filter(c => c !== head && c !== kpiCard) }
  }, [e.version, e.ready])

  const [title, sub] = d.head ? txt(d.head).split('\n') : []
  const labelOf = (s: HTMLSelectElement) => txt(s.previousElementSibling) || 'Period'

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-[19px] font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-text-2">{sub}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {d.selects.map(s => (
            <label key={eid(s)} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-widest text-text-3">
              {labelOf(s).split('\n').length > 1 ? 'Period' : labelOf(s)}<ProxySelect el={s} />
            </label>
          ))}
          <div className="flex flex-wrap gap-1.5">{d.btns.map(b => <ProxyButton key={eid(b)} el={b} />)}</div>
        </div>
      </section>

      {d.tiles.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {d.tiles.map((t, i) => {
            const [name, stage, value, bud, ly, ...note] = txt(t).split('\n')
            const tone = (s?: string) => (s?.startsWith('▲') ? 'text-ok' : s?.startsWith('▼') ? 'text-err' : 'text-text-2')
            return (
              <article key={i} className={cx('rise rounded-xl border border-border bg-surface p-5 shadow-card', i === 0 && 'border-brand ring-1 ring-brand/30')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{name}</p>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-3">{stage}</span>
                </div>
                <p className="mt-2 font-mono text-[28px] font-semibold tracking-tight">{value}</p>
                <div className="mt-1 flex gap-3 text-xs font-semibold"><span className={tone(bud)}>{bud}</span><span className={tone(ly)}>{ly}</span></div>
                <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-2">{note.join(' ')}</p>
              </article>
            )
          })}
        </div>
      )}

      {d.rest.map((c, i) => <MirrorCard key={i} el={c} />)}
    </div>
  )
}

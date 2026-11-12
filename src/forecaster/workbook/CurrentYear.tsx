import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTip, tipProps } from '../../chart/ChartTip'
import { ChevronDown, Lock } from 'lucide-react'
import { eid, parseTable, txt, useEngine } from './engine'
import { useSubmitGate } from '../submitGate'
import { MirrorCard, ProxyButton } from './Mirror'

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }
const num = (s: string) => { const v = parseFloat(s.replace(/[^0-9.\-−]/g, '').replace('−', '-')); return Number.isFinite(v) ? v : 0 }

type Row = { label: string; cells: string[]; growth?: string[] }
type Section = { title: string; rows: Row[] }

export default function CurrentYear() {
  const e = useEngine()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const data = useMemo(() => {
    const cards = e.cards()
    const tableCard = cards.find(c => c.querySelector('table') && txt(c).includes('Projected net sales'))
    const table = tableCard?.querySelector('table') as HTMLTableElement | undefined
    if (!table) return null
    const { head, rows } = parseTable(table)
    const months = head.slice(1).map(h => { const [m, k] = h.split(' '); return { m: m ?? h, k: k ?? '' } })
    const sections: Section[] = []
    for (const r of rows) {
      if (r.section) { sections.push({ title: r.cells[0] ?? '', rows: [] }); continue }
      if (!sections.length) sections.push({ title: 'Overview', rows: [] })
      const s = sections[sections.length - 1]!
      const label = r.cells[0] ?? ''
      if (/^%G/.test(label) && s.rows.length) { s.rows[s.rows.length - 1]!.growth = r.cells.slice(1); continue }
      s.rows.push({ label, cells: r.cells.slice(1) })
    }
    const all = sections.flatMap(s => s.rows.map(r => ({ ...r, sec: s.title })))
    const pick = (l: string, sec?: RegExp) => all.find(r => r.label.startsWith(l) && (!sec || sec.test(r.sec)))
    const net = pick('Projected net sales'), gross = pick('Projected gross sales'), gtn = pick('Total GTN')
    const trx = all.filter(r => r.label.startsWith('TRx (000s)'))[1] ?? pick('TRx (000s)')
    const share = pick('TRx Share')
    const chart = months.slice(0, -1).map((m, i) => ({ m: m.m, act: m.k === 'ACT', v: num(net?.cells[i] ?? '0') }))
    return { tableCard, months, sections, net, gross, gtn, trx, share, chart, others: cards.filter(c => c !== tableCard) }
  }, [e.version, e.ready])

  if (!data) return <p className="text-sm text-text-2">Loading Current Year…</p>
  const fy = (r?: Row) => r?.cells[r.cells.length - 1] ?? '—'
  const fyG = (r?: Row) => r?.growth?.[r.growth.length - 1]
  const submitCard = data.others.find(c => txt(c).includes('Submit'))
  const submitBtn = submitCard ? Array.from(submitCard.querySelectorAll('button')).find(b => txt(b).includes('Submit')) : undefined
  const gate = useSubmitGate()
  const actCount = data.months.filter(m => m.k === 'ACT').length

  const kpis: [string, Row | undefined][] = [['Net sales', data.net], ['Gross sales', data.gross], ['Total GTN', data.gtn], ['Nurtec TRx (000s)', data.trx], ['TRx share', data.share]]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map(([k, r], i) => {
          const g = fyG(r)
          return (
            <div key={k} className={cx('rounded-xl border p-4', i === 0 ? 'border-brand bg-brand text-white' : 'border-border bg-surface')}>
              <p className={cx('text-xs font-medium', i === 0 ? 'text-white/70' : 'text-text-2')}>{k} · FY</p>
              <p className="mt-1 font-mono text-[22px] font-semibold tracking-tight">{fy(r)}</p>
              {g && <p className={cx('mt-0.5 text-xs font-semibold', i === 0 ? 'text-white/80' : g.startsWith('−') ? 'text-err' : 'text-ok')}>{g} vs last year</p>}
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[17px] font-semibold">Net sales by month</h2>
            <p className="flex items-center gap-3 text-xs text-text-2"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-text-3" />Actuals ({actCount} mo)</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand" />Forecast</span></p>
          </div>
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer>
              <BarChart data={data.chart} margin={{ left: -8, right: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={v => `$${v}M`} />
                <Tooltip {...tipProps} cursor={{ fill: 'var(--color-brand-soft)', opacity: 0.7 }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]!.payload as { m: string; v: number; act: boolean }
                  return <ChartTip title={d.m} sections={[{ rows: [
                    { label: 'Net sales', value: `$${Number(d.v).toFixed(1)}M` },
                    { label: 'Basis', value: d.act ? 'Actual' : 'Forecast', tone: 'muted' },
                  ] }]} />
                }} />
                <Bar dataKey="v" radius={[4, 4, 0, 0]}>{data.chart.map((d, i) => <Cell key={i} fill={d.act ? 'var(--color-text-3)' : 'var(--color-brand)'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-text-3"><Lock size={12} />Official submission</p>
            <div className="mt-2 space-y-1 text-sm text-text-2">{submitCard && txt(submitCard).split('\n').filter(l => l && !l.includes('Submit FY')).slice(0, 2).map(l => <p key={l}>{l}</p>)}</div>
          </div>
          {gate ? (
            <div className="space-y-2">
              <button type="button" disabled={!!gate.submitted} onClick={() => { const id = submitBtn && eid(submitBtn); gate.request(id ? () => e.act(id) : undefined) }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50">
                <Lock size={15} />{gate.submitted ? `${gate.sub} submitted · ${gate.submitted}` : `Review & submit ${gate.sub}…`}
              </button>
              <p className="text-[11px] text-text-3">Opens the same pre-submit checks as guided steps. Nothing is submitted until you confirm.</p>
            </div>
          ) : submitBtn && <ProxyButton el={submitBtn}>Submit {e.header().sub || 'forecast'} officially</ProxyButton>}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="font-display text-[17px] font-semibold">Monthly plan</h2>
          <div className="flex gap-2 text-xs">
            <button type="button" className="font-semibold text-brand" onClick={() => setOpen(Object.fromEntries(data.sections.map(s => [s.title, true])))}>Expand all</button>
            <span className="text-text-3">·</span>
            <button type="button" className="font-semibold text-brand" onClick={() => setOpen(Object.fromEntries(data.sections.map(s => [s.title, false])))}>Collapse all</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-[13px] tabular-nums">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-3">Line</th>
                {data.months.map((m, i) => <th key={i} className={cx('px-2.5 py-2 text-right', m.k === 'ACT' ? 'bg-surface-2' : i === data.months.length - 1 ? 'bg-brand-soft' : '')}><span className="block text-[12px] font-semibold text-text">{m.m}</span><span className={cx('block font-mono text-[9px] uppercase', m.k === 'ACT' ? 'text-text-3' : 'text-brand')}>{m.k === 'ACT' ? 'Actual' : m.k || 'Total'}</span></th>)}
              </tr>
            </thead>
            {data.sections.map((s, si) => {
              const isOpen = open[s.title] ?? (si < 2 || /REVENUE/.test(s.title))
              return (
                <tbody key={s.title}>
                  <tr className="cursor-pointer border-t border-border bg-surface-2/60 hover:bg-brand-soft/50" onClick={() => setOpen(o => ({ ...o, [s.title]: !isOpen }))}>
                    <td colSpan={99} className="px-4 py-2"><span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-brand"><ChevronDown size={14} className={cx('transition-transform', !isOpen && '-rotate-90')} />{s.title}<span className="font-sans normal-case tracking-normal text-text-3">· {s.rows.length} lines</span></span></td>
                  </tr>
                  {isOpen && s.rows.map(r => {
                    const strong = /net sales|gross sales|Total/.test(r.label)
                    return (
                      <tr key={r.label} className={cx('border-t border-border/60 hover:bg-brand-soft/30', strong && 'font-semibold')}>
                        <td className="sticky left-0 z-10 max-w-[260px] bg-surface px-4 py-1.5 text-left">{r.label}</td>
                        {r.cells.map((c, i) => {
                          const g = r.growth?.[i]
                          const act = data.months[i]?.k === 'ACT', last = i === r.cells.length - 1
                          return <td key={i} className={cx('px-2.5 py-1.5 text-right align-top', act && 'bg-surface-2/70 text-text-2', last && 'bg-brand-soft/60 font-semibold')}>
                            <span className="block whitespace-nowrap font-mono text-[12.5px]">{c}</span>
                            {g && g !== '—' && <span className={cx('block font-mono text-[10px]', g.startsWith('−') ? 'text-err' : 'text-ok')}>{g}</span>}
                          </td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              )
            })}
          </table>
        </div>
        <p className="border-t border-border px-5 py-2 text-[11px] text-text-3">Gray columns are locked actuals · blue columns recalculate live · small figures are growth vs last year · * derived where the feed lacks the series</p>
      </section>

      {data.others.filter(c => c !== submitCard && !txt(c).startsWith('Gray columns')).map((c, i) => <MirrorCard key={i} el={c} />)}
    </div>
  )
}

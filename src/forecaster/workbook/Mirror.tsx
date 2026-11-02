import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { eid, txt, useEngine } from './engine'

/*
 * Generic restyled mirror of a workbook DOM subtree. Keeps the layout skeleton
 * (flex/grid), drops the legacy look, and proxies inputs, selects and buttons
 * back to the workbook so they stay fully editable.
 */

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' ') }

const LAYOUT = ['display', 'flexDirection', 'flexWrap', 'gap', 'rowGap', 'columnGap', 'gridTemplateColumns', 'gridColumn', 'alignItems', 'justifyContent', 'flex', 'textAlign', 'fontWeight', 'whiteSpace', 'minWidth'] as const

function layoutOf(el: HTMLElement): CSSProperties {
  const s: Record<string, string> = {}
  for (const k of LAYOUT) { const v = el.style[k as keyof CSSStyleDeclaration] as string; if (v) s[k] = v }
  if (el.style.color && !/rgb\((0, 0, 0|29, 29, 31|110, 110, 115|134, 134, 139)\)/.test(el.style.color)) s.color = el.style.color
  const fs = parseFloat(el.style.fontSize)
  if (fs) s.fontSize = `${Math.max(11, Math.min(fs, 30))}px`
  return s as CSSProperties
}

const isPill = (el: HTMLElement) => el.tagName === 'SPAN' && el.style.borderRadius === '20px' && !!el.style.background
const isBox = (el: HTMLElement) => el.tagName === 'DIV' && parseFloat(el.style.borderRadius) >= 8 && (!!el.style.border || !!el.style.background)

export function ProxyInput({ el }: { el: HTMLInputElement | HTMLTextAreaElement }) {
  const e = useEngine(); const id = eid(el)
  const [v, setV] = useState(el.value)
  useEffect(() => { setV(el.value) }, [el.value, e.version])
  if (el.type === 'file') return <label className="inline-flex cursor-pointer items-center rounded-md border border-dashed border-border-strong px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft">Choose file<input type="file" className="hidden" onChange={ev => { const f = ev.target.files; if (f) { const dt = new DataTransfer(); Array.from(f).forEach(x => dt.items.add(x)); (el as HTMLInputElement).files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })) } }} /></label>
  if (el.type === 'checkbox' || el.type === 'radio') return <input type={el.type} checked={(el as HTMLInputElement).checked} disabled={el.disabled} onChange={() => e.act(id)} className="h-4 w-4 accent-brand" />
  const commit = (val: string) => { setV(val); e.setValue(id, val) }
  if (el.type === 'range') return <input type="range" min={(el as HTMLInputElement).min} max={(el as HTMLInputElement).max} step={(el as HTMLInputElement).step} value={v} disabled={el.disabled} onChange={ev => commit(ev.target.value)} className="w-full accent-brand" />
  return <input type={el.type === 'number' ? 'number' : 'text'} value={v} placeholder={el.placeholder} disabled={el.disabled}
    min={(el as HTMLInputElement).min || undefined} max={(el as HTMLInputElement).max || undefined}
    onChange={ev => commit(ev.target.value)}
    className={cx('h-8 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-3', el.type === "number" ? "w-20 text-right font-mono" : "w-full min-w-0 flex-1")} />
}

export function ProxySelect({ el }: { el: HTMLSelectElement }) {
  const e = useEngine(); const id = eid(el)
  return <select value={el.value} disabled={el.disabled} onChange={ev => e.setValue(id, ev.target.value)}
    className="h-8 rounded-md border border-border bg-surface px-2 text-sm font-medium normal-case tracking-normal text-text outline-none focus:border-brand">
    {Array.from(el.options).map(o => <option key={o.value + o.text} value={o.value}>{o.text}</option>)}
  </select>
}

export function isOn(b: HTMLElement) {
  if (b.getAttribute('aria-pressed') === 'true') return true
  const bg = b.style.background || b.style.backgroundColor
  return /rgb\(0, 113, 227\)|rgb\(29, 29, 31\)|rgb\(52, 199, 89\)/.test(bg) && !/rgba/.test(bg.split(' none')[0] ?? '')
}

export function ProxyButton({ el, children }: { el: HTMLButtonElement; children?: ReactNode }) {
  const e = useEngine(); const id = eid(el)
  const label = txt(el)
  const toggle = el.hasAttribute('aria-pressed') && !label
  if (toggle) {
    const on = el.getAttribute('aria-pressed') === 'true'
    return <button type="button" role="switch" aria-checked={on} title={el.title} disabled={el.disabled || el.style.cursor === 'not-allowed'} onClick={() => e.act(id)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40', on ? 'bg-brand' : 'bg-border-strong')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  }
  const on = isOn(el)
  return <button type="button" title={el.title || undefined} disabled={el.disabled} onClick={() => e.act(id)}
    className={cx('inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40', on ? 'border-brand bg-brand text-white' : 'border-border bg-surface text-text hover:border-brand/50 hover:text-brand')}>
    {children ?? label}
  </button>
}

export function MTable({ el }: { el: HTMLTableElement }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-[13px] tabular-nums">
        {el.tHead && <thead className="bg-surface-2">{Array.from(el.tHead.rows).map((r, i) => <tr key={i}>{Array.from(r.cells).map((c, j) => <th key={j} colSpan={c.colSpan} className={cx('whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-3', j === 0 ? 'text-left' : 'text-right')}>{txt(c)}</th>)}</tr>)}</thead>}
        <tbody>
          {Array.from(el.tBodies).flatMap(b => Array.from(b.rows)).map((r, i) => {
            const cells = Array.from(r.cells)
            const section = cells.length === 1 || cells.slice(1).every(c => !txt(c) && !c.querySelector('input,button,select'))
            if (section && cells.length >= 1 && txt(cells[0]) && /^[A-Z0-9 —&·()/-]+$/.test(txt(cells[0]))) return <tr key={i}><td colSpan={99} className="bg-surface-2/60 px-3 pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-brand">{txt(cells[0])}</td></tr>
            const total = /total|^net|^fy/i.test(txt(cells[0]))
            return <tr key={i} className={cx('border-t border-border/70 hover:bg-brand-soft/40', total && 'font-semibold')}>{cells.map((c, j) => <td key={j} colSpan={c.colSpan} className={cx('px-3 py-1.5 align-top', j === 0 ? 'text-left' : 'text-right')}><Kids el={c} /></td>)}</tr>
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Kids({ el }: { el: Element }) {
  return <>{Array.from(el.childNodes).map((n, i) => <Node key={i} n={n} />)}</>
}

export function Node({ n }: { n: ChildNode }) {
  if (n.nodeType === 3) return <>{n.textContent}</>
  if (n.nodeType !== 1) return null
  const el = n as HTMLElement
  if (el.style.display === 'none' || el.dataset.skip) return null
  const tag = el.tagName
  if (tag === 'svg' || tag === 'SVG' || el instanceof SVGElement) return <span className="block max-w-full overflow-x-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: el.outerHTML }} />
  if (tag === 'TABLE') return <MTable el={el as HTMLTableElement} />
  if (tag === 'INPUT' || tag === 'TEXTAREA') return <ProxyInput el={el as HTMLInputElement} />
  if (tag === 'SELECT') return <ProxySelect el={el as HTMLSelectElement} />
  if (tag === 'BUTTON') return <ProxyButton el={el as HTMLButtonElement} />
  if (tag === 'BR') return <br />
  if (tag === 'IMG') return <img src={(el as HTMLImageElement).src} alt={(el as HTMLImageElement).alt} className="max-w-full" />
  if (/^H[1-6]$/.test(tag)) return <h3 className="font-display text-[15px] font-semibold text-text">{txt(el)}</h3>
  if (tag === 'LABEL') return <label className="flex flex-col gap-1 text-xs font-medium text-text-2" style={layoutOf(el)}><Kids el={el} /></label>
  if (isPill(el)) return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: el.style.color, background: el.style.background }}>{txt(el)}</span>
  const style = layoutOf(el)
  const inline = tag === 'SPAN' || tag === 'STRONG' || tag === 'B' || tag === 'EM' || tag === 'CODE' || tag === 'A'
  if (inline) return <span style={style} className={cx(tag === 'CODE' && 'font-mono text-[12px]')}><Kids el={el} /></span>
  return <div style={style} className={cx(isBox(el) && 'rounded-2xl border border-border bg-surface shadow-card p-3', tag === 'P' && 'text-sm leading-relaxed text-text-2')}><Kids el={el} /></div>
}

/** A workbook card rendered with the prototype's card chrome. */
export function MirrorCard({ el, title, sub, children }: { el?: HTMLElement; title?: string; sub?: string; children?: ReactNode }) {
  const h = el?.querySelector('h3,h2,h1')
  const t = title ?? txt(h)
  return (
    <section className="rise rounded-xl border border-border bg-surface p-5 shadow-card">
      {t && <h2 className="font-display text-[17px] font-semibold tracking-tight">{t}</h2>}
      {sub && <p className="mt-0.5 text-sm text-text-2">{sub}</p>}
      <div className={cx('text-sm text-text', t && 'mt-3')}>
        {children ?? (el && <SkipHeading el={el} heading={h} />)}
      </div>
    </section>
  )
}

function SkipHeading({ el, heading }: { el: HTMLElement; heading: Element | null | undefined }) {
  // Render the card body without repeating the heading we already show.
  if (heading) (heading as HTMLElement).dataset.skip = '1'
  return <Fragment><SkipKids el={el} /></Fragment>
}
function SkipKids({ el }: { el: Element }) {
  return <>{Array.from(el.childNodes).map((n, i) => (n as HTMLElement).dataset?.skip ? null : <Node key={i} n={n} />)}</>
}

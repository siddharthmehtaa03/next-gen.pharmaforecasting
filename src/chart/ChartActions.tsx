import { useEffect, useRef, useState } from 'react'
import { Download, EllipsisVertical, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Presentation } from 'lucide-react'

/* Shared "Actions" menu for every chart: download as PPTX, PDF, Excel (.xlsx/csv), CSV, or PNG image.
   Charts are captured from the page as rendered (SVG or HTML), so the export matches what the user sees. */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
const fileName = (t: string) => t.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'chart'

/** Copies computed styles onto the clone so it renders the same outside the page's stylesheet. */
function inline(src: Element, dst: Element) {
  const cs = getComputedStyle(src)
  let css = ''
  for (let i = 0; i < cs.length; i++) { const p = cs[i]!; css += `${p}:${cs.getPropertyValue(p)};` }
  dst.setAttribute('style', css)
  const a = src.children, b = dst.children
  for (let i = 0; i < a.length; i++) if (b[i]) inline(a[i]!, b[i]!)
}

/** Renders a DOM node to a PNG data URL (2x for crisp slides). Elements marked data-export-ignore are left out. */
export async function nodeToPng(el: HTMLElement, scale = 2): Promise<{ png: string; w: number; h: number }> {
  const w = Math.ceil(el.scrollWidth || el.getBoundingClientRect().width), h = Math.ceil(el.scrollHeight || el.getBoundingClientRect().height)
  const clone = el.cloneNode(true) as HTMLElement
  inline(el, clone)
  clone.querySelectorAll('[data-export-ignore]').forEach(n => n.remove())
  clone.style.margin = '0'; clone.style.width = `${w}px`; clone.style.height = `${h}px`; clone.style.overflow = 'visible'; clone.style.background = '#ffffff'
  const xml = new XMLSerializer().serializeToString(clone)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">${xml}</foreignObject></svg>`
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = w * scale; c.height = h * scale
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h)
  return { png: c.toDataURL('image/png'), w, h }
}

export async function downloadImage(el: HTMLElement, title: string) {
  const { png } = await nodeToPng(el)
  const a = document.createElement('a'); a.href = png; a.download = `${fileName(title)}.png`; a.click()
}

export async function downloadPptx(el: HTMLElement, title: string, subtitle?: string) {
  const [{ png, w, h }, { default: Pptx }] = await Promise.all([nodeToPng(el), import('pptxgenjs')])
  const p = new Pptx(); p.layout = 'LAYOUT_WIDE'
  const s = p.addSlide()
  s.addText(title, { x: 0.5, y: 0.35, w: 12.3, h: 0.5, fontSize: 24, bold: true, color: '0B0F2E' })
  if (subtitle) s.addText(subtitle, { x: 0.5, y: 0.85, w: 12.3, h: 0.35, fontSize: 12, color: '5B6078' })
  // Fit the image into the content area, keeping its proportions.
  const boxW = 12.3, boxH = 5.6, k = Math.min(boxW / w, boxH / h)
  s.addImage({ data: png, x: 0.5 + (boxW - w * k) / 2, y: 1.4, w: w * k, h: h * k })
  await p.writeFile({ fileName: `${fileName(title)}.pptx` })
}

export function downloadPdf(el: HTMLElement, title: string, subtitle?: string) {
  const w = window.open('', '_blank')
  if (!w) throw new Error('Pop-up blocked')
  const clone = el.cloneNode(true) as HTMLElement
  inline(el, clone)
  clone.querySelectorAll('[data-export-ignore]').forEach(n => n.remove())
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:32px;color:#0b0f2e}h1{font-size:22px;margin:0 0 4px}p{color:#5b6078;font-size:13px;margin:0 0 20px}@media print{@page{margin:20mm}}</style></head><body><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}${clone.outerHTML}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 350)
}

export function downloadCsv(el: HTMLElement, title: string, ext = 'csv') {
  const tables = el.querySelectorAll('table')
  let csv = '\uFEFF'
  if (tables.length > 0) {
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr')
      rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map(td => {
          const t = td.textContent?.trim().replace(/\s+/g, ' ') || ''
          return `"${t.replace(/"/g, '""')}"`
        })
        if (cells.length) csv += cells.join(',') + '\r\n'
      })
      csv += '\r\n'
    })
  } else {
    const texts = Array.from(el.querySelectorAll('p, span, text, li, b')).map(t => t.textContent?.trim()).filter(Boolean)
    csv += `"${title}"\r\n`
    texts.slice(0, 120).forEach(t => {
      csv += `"${t?.replace(/"/g, '""')}"\r\n`
    })
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName(title)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

/** The ⋮ trigger and "Actions" menu. `target` returns the element to capture (an id is the simplest). */
export function ChartActions({ target, title, subtitle, onPptx, className }: {
  target: string | (() => HTMLElement | null); title: string; subtitle?: string; onPptx?: () => Promise<void>; className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  const el = () => (typeof target === 'string' ? document.getElementById(target) : target())
  const run = async (kind: 'pptx' | 'pdf' | 'xlsx' | 'csv' | 'img') => {
    const node = el()
    if (!node) return
    setBusy(kind); setErr('')
    try {
      if (kind === 'img') await downloadImage(node, title)
      else if (kind === 'pdf') downloadPdf(node, title, subtitle)
      else if (kind === 'csv') downloadCsv(node, title, 'csv')
      else if (kind === 'xlsx') downloadCsv(node, title, 'xlsx')
      else if (kind === 'pptx' && onPptx) await onPptx()
      else await downloadPptx(node, title, subtitle)
      setOpen(false)
    } catch { setErr('Download failed. Try again.') }
    setBusy(null)
  }
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-text hover:bg-surface-2 disabled:opacity-50'
  return (
    <div ref={box} className={cx('relative', className)} data-export-ignore>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${title}`} title="Actions" onClick={() => setOpen(v => !v)}
        className={cx('grid h-8 w-8 place-items-center rounded-md border text-text-2 transition-colors hover:bg-surface-2 hover:text-text', open ? 'border-border-strong bg-surface-2' : 'border-border bg-surface')}>
        <EllipsisVertical size={15} />
      </button>
      {open && (
        <div role="menu" aria-label="Actions" className="rise absolute right-0 top-10 z-40 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.22)]">
          <p className="border-b border-border px-2.5 pb-2 pt-1 text-[13px] font-semibold text-text">Actions</p>
          <div className="pt-1">
            <button type="button" role="menuitem" disabled={!!busy} onClick={() => run('pptx')} className={item}>{busy === 'pptx' ? <Loader2 size={15} className="animate-spin text-text-2" /> : <Presentation size={15} className="text-text-2" />}Download as PPTX</button>
            <button type="button" role="menuitem" disabled={!!busy} onClick={() => run('pdf')} className={item}>{busy === 'pdf' ? <Loader2 size={15} className="animate-spin text-text-2" /> : <FileText size={15} className="text-text-2" />}Download as PDF</button>
            <button type="button" role="menuitem" disabled={!!busy} onClick={() => run('xlsx')} className={item}>{busy === 'xlsx' ? <Loader2 size={15} className="animate-spin text-text-2" /> : <FileSpreadsheet size={15} className="text-text-2" />}Download as Excel (.xlsx)</button>
            <button type="button" role="menuitem" disabled={!!busy} onClick={() => run('csv')} className={item}>{busy === 'csv' ? <Loader2 size={15} className="animate-spin text-text-2" /> : <Download size={15} className="text-text-2" />}Download as CSV (.csv)</button>
            <div className="my-1 h-px bg-border" />
            <button type="button" role="menuitem" disabled={!!busy} onClick={() => run('img')} className={item}>{busy === 'img' ? <Loader2 size={15} className="animate-spin text-text-2" /> : <ImageIcon size={15} className="text-text-2" />}Download as Image (PNG)</button>
          </div>
          {err && <p className="px-2.5 pb-1 pt-1 text-[12px] text-err" role="status">{err}</p>}
        </div>
      )}
    </div>
  )
}

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/*
 * The LES Model 2 workbook (public/les-model.html) is the calculation engine.
 * It runs in a same-origin iframe; redesigned pages read its rendered DOM and
 * drive its real inputs/buttons, so every number and edit stays 1:1 with the file.
 */

export type Engine = {
  ready: boolean
  version: number
  doc: Document | null
  /** cards (top-level sections) of the active tab */
  cards: () => HTMLElement[]
  header: () => { sub: string; scenario: string; views: string[]; activeView: string }
  press: (label: string, scope?: Element | null) => void
  act: (id: string) => void
  setValue: (id: string, value: string) => void
  find: (id: string) => HTMLElement | null
  showOriginal: boolean
  setShowOriginal: (v: boolean) => void
  setFrameVisible: (v: boolean) => void
}

const Ctx = createContext<Engine | null>(null)
export const useEngine = () => useContext(Ctx)!

let seq = 0
export const eid = (el: Element) => { const h = el as HTMLElement; if (!h.dataset.eid) h.dataset.eid = String(++seq); return h.dataset.eid }
export const txt = (el: Element | null | undefined) => ((el as HTMLElement | null)?.innerText ?? '').trim()

const SKIN = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Sora:wght@600;700&display=swap');
html,body{background:#f5f6fb!important}
body,body *:not(svg):not(svg *){font-family:"Instrument Sans",system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"!important}
div[style*="border-radius: 14px"]{border-radius:16px!important;border-color:#e3e6f0!important;box-shadow:0 1px 2px rgba(10,15,44,.04),0 8px 24px -16px rgba(10,15,44,.12)!important}
h1,h2,h3{font-family:"Sora",system-ui,sans-serif!important;color:#0a0f2c!important}
th{font-size:11px!important;text-transform:uppercase;letter-spacing:.06em;color:#868ba3!important}
tbody tr:hover td{background:#f5f6ff!important}
`

export function EngineProvider({ children, frameClass }: { children: (frame: ReactNode) => ReactNode; frameClass?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)
  const [showOriginal, setShowOriginal] = useState(false)
  const [frameVisible, setFrameVisible] = useState(false)

  const doc = ready ? ref.current?.contentDocument ?? null : null

  const onLoad = () => {
    const d = ref.current?.contentDocument
    if (!d) return
    const st = d.createElement('style'); st.textContent = SKIN; d.head.appendChild(st)
    let tries = 0
    const wait = () => {
      const header = d.querySelector('#root > div > div:first-child') as HTMLElement | null
      if (!header) { if (tries++ < 80) setTimeout(wait, 100); return }
      header.style.display = 'none'
      let t: number | undefined
      new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(() => setVersion(v => v + 1), 90) })
        .observe(d.getElementById('root')!, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'aria-pressed', 'style', 'disabled'] })
      setReady(true)
    }
    wait()
  }

  const find = useCallback((id: string) => ref.current?.contentDocument?.querySelector(`[data-eid="${id}"]`) as HTMLElement | null, [])

  const api = useMemo<Engine>(() => ({
    ready, version, doc, showOriginal, setShowOriginal, setFrameVisible, find,
    cards: () => {
      const d = ref.current?.contentDocument
      const main = d?.querySelector('#root > div > div:nth-child(2)')
      const grid = main?.firstElementChild
      return grid ? (Array.from(grid.children) as HTMLElement[]) : []
    },
    header: () => {
      const d = ref.current?.contentDocument
      const h = d?.querySelector('#root > div > div:first-child') as HTMLElement | null
      const line = h ? (h.textContent ?? '') : ''
      const m = line.match(/FY\d{4} · (.+?) \(.*?\) · (.+?) · \d+ markets?/) ?? line.match(/FY\d{4} · (.+?) · (.+?) ·/)
      const btns = h ? Array.from(h.querySelectorAll('button')) : []
      const i = btns.findIndex(b => txt(b) === 'Menu')
      const vb = btns.slice(0, i > 0 ? i : 0)
      const win = ref.current?.contentWindow
      const active = vb.find(b => win?.getComputedStyle(b).backgroundColor === 'rgb(255, 255, 255)')
      return { sub: m?.[1] ?? '', scenario: m?.[2] ?? '', views: vb.map(b => txt(b) || (b.textContent ?? '').trim()), activeView: active ? (active.textContent ?? '').trim() : '' }
    },
    press: (label, scope) => {
      const d = ref.current?.contentDocument
      const root = scope ?? d
      const b = root ? Array.from(root.querySelectorAll('button')).find(x => (x.textContent ?? '').trim() === label) : null
      b?.click()
    },
    act: (id) => find(id)?.click(),
    setValue: (id, value) => {
      const el = find(id) as HTMLInputElement | HTMLSelectElement | null
      const win = ref.current?.contentWindow as (Window & typeof globalThis) | null
      if (!el || !win) return
      const proto = el.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new win.Event('input', { bubbles: true }))
      el.dispatchEvent(new win.Event('change', { bubbles: true }))
    },
  }), [ready, version, doc, showOriginal, find])

  const frame = (
    <iframe ref={ref} src="/les-model.html" title="LES Model 2 workbook" onLoad={onLoad} aria-hidden={!frameVisible}
      className={frameVisible ? frameClass : 'pointer-events-none fixed left-[-20000px] top-0 h-[1000px] w-[1440px] border-0'} />
  )
  return <Ctx.Provider value={api}>{children(frame)}</Ctx.Provider>
}

/** Parse a workbook table into header + rows (section rows have a single filled cell). */
export function parseTable(t: HTMLTableElement) {
  const head = t.tHead ? Array.from(t.tHead.rows[t.tHead.rows.length - 1]!.cells).map(c => txt(c).replace(/\s+/g, ' ')) : []
  const rows = Array.from(t.tBodies).flatMap(b => Array.from(b.rows)).map(r => {
    const cells = Array.from(r.cells).map(c => txt(c))
    const section = r.cells.length === 1 || cells.slice(1).every(c => c === '')
    return { cells, section, el: r }
  })
  return { head, rows }
}

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

/*
 * One hover card for every chart. Styled after the Attio reference set: a hairline card with a
 * muted header strip, then label-left / value-right rows in tabular figures. Recharts charts
 * render it through <Tooltip content>, hand-drawn SVG charts through useHoverTip below.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export type TipRow = { label: string; value: ReactNode; /** Series colour, shown as a dot. */ color?: string; tone?: 'ok' | 'err' | 'muted' }
export type TipSection = { heading?: string; rows: TipRow[] }

const TONE: Record<NonNullable<TipRow['tone']>, string> = { ok: 'text-ok-strong', err: 'text-err', muted: 'text-text-3' }

export function ChartTip({ title, sections, footer }: { title: ReactNode; sections: TipSection[]; footer?: ReactNode }) {
  return (
    <div role="tooltip" className="pointer-events-none min-w-[210px] max-w-[320px] overflow-hidden rounded-xl border border-border bg-surface text-[12px] shadow-[0_10px_28px_-10px_rgba(26,26,26,0.22),0_1px_2px_rgba(26,26,26,0.06)]">
      <div className="border-b border-border bg-surface-2/70 px-3 py-1.5 font-semibold text-text">{title}</div>
      {sections.filter(s => s.rows.length).map((sec, i) => (
        <div key={i} className={cx('space-y-1 px-3 py-2', i > 0 && 'border-t border-border')}>
          {sec.heading && <p className="text-[10px] font-semibold uppercase tracking-wider text-text-3">{sec.heading}</p>}
          {sec.rows.map(r => (
            <p key={r.label} className="flex items-center justify-between gap-5">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-text-2">
                {r.color && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />}
                <span className="truncate">{r.label}</span>
              </span>
              <span className={cx('shrink-0 font-data font-medium', r.tone ? TONE[r.tone] : 'text-text')}>{r.value}</span>
            </p>
          ))}
        </div>
      ))}
      {footer && <div className="border-t border-border px-3 py-1.5 text-[11px] text-text-3">{footer}</div>}
    </div>
  )
}

/** Shared recharts <Tooltip> props: no animation, a quiet cursor, and a wrapper that sits above neighbouring cards. */
export const tipProps = {
  isAnimationActive: false,
  cursor: { stroke: 'var(--gray-30)', strokeWidth: 1 },
  wrapperStyle: { zIndex: 60, outline: 'none' },
} as const

/**
 * A card that follows the pointer. It is portalled to <body> and positioned in viewport coordinates, so no
 * ancestor with overflow:hidden (a narrow side panel, the rounded app frame) can clip it. It measures itself
 * before paint and flips or clamps so it always stays fully inside the window.
 */
function Floating({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const { width, height } = el.getBoundingClientRect(), edge = 8
    let left = x + 14
    if (left + width > window.innerWidth - edge) left = x - 14 - width   // not enough room on the right: flip to the left
    left = Math.max(edge, left)
    const top = Math.min(Math.max(edge, y - 12), window.innerHeight - height - edge)
    setPos(p => (p && p.left === left && p.top === top ? p : { left, top }))
  }, [x, y, children])
  return createPortal(
    <div ref={ref} className="pointer-events-none fixed z-[70]" style={{ left: pos?.left ?? x + 14, top: pos?.top ?? y - 12, visibility: pos ? 'visible' : 'hidden' }}>{children}</div>,
    document.body,
  )
}

/**
 * Hover state for hand-drawn SVG charts. Call `move(event, card)` from a mark's onPointerEnter/Move and `hide()`
 * from onPointerLeave, and render `node` once anywhere in the chart. `wrap` is kept so existing call sites that
 * attach it to a wrapper keep working; positioning no longer depends on it.
 */
export function useHoverTip() {
  const wrap = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null)
  const move = useCallback((e: RPointerEvent, content: ReactNode) => setTip(content ? { x: e.clientX, y: e.clientY, content } : null), [])
  const hide = useCallback(() => setTip(null), [])
  const node = tip && <Floating x={tip.x} y={tip.y}>{tip.content}</Floating>
  return { wrap, move, hide, node }
}

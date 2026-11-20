import { useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

/** A menu rendered on document.body, positioned under its anchor, so no container can clip it. */
export function Overlay({ anchor, open, onClose, align = 'right', width, className, children }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; align?: 'left' | 'right'; width?: number
  className?: string; children: ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = anchor.current?.getBoundingClientRect(); if (!r) return
      setPos(align === 'right' ? { top: r.bottom + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, left: r.left })
    }
    place()
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, align, anchor])
  useEffect(() => {
    if (!open) return
    const off = (e: Event) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') onClose(); return }
      const t = e.target as Node
      if (!anchor.current?.contains(t) && !(t as HTMLElement).closest?.('[data-overlay]')) onClose()
    }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off) }
  }, [open, onClose, anchor])
  if (!open || !pos) return null
  return createPortal(
    <div data-overlay role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right, width, zIndex: 100 }}
      className={`dropdown-container rise py-1 ${className ?? ''}`}>{children}</div>,
    document.body)
}

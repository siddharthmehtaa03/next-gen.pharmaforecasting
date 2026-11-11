import { useEffect, useRef, useState } from 'react'
import { Sparkles, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Clock, Copy, History, Lock, MoreVertical, Pencil, Trash2, X } from 'lucide-react'
import { DEFAULT_MODEL } from './engine'
import type { ModelCfg } from './engine'
import { Btn, Seg, Tag, cx } from './ui'
import type { Notify } from './Drivers'

export type BrandRow = {
  id: string
  brand: string
  stream: string
  cycle: string
  status: 'Not started' | 'In progress' | 'In review' | 'Submitted'
  updated?: string
  model: ModelCfg
  /** Submitted versions of this forecast, newest first. */
  versions?: { v: string; note: string; date: string; by: string }[]
}

const noAccess: ModelCfg = { ...DEFAULT_MODEL, modules: DEFAULT_MODEL.modules.filter(m => m.id !== 'access') }
const lockedPrice: ModelCfg = { ...DEFAULT_MODEL, outputs: ['rev', 'trx'], modules: DEFAULT_MODEL.modules.map(m => m.id === 'price' ? { ...m, editable: false } : m) }

export const BRANDS: BrandRow[] = [
  { id: 'nurtec', brand: 'Nurtec', stream: 'US net revenue', cycle: 'AOP 2027', status: 'In progress', updated: 'Oct 2 · J. Andersen', model: DEFAULT_MODEL, versions: [{ v: 'v3', note: 'LE3 submission · Part D formulary win added to Base Case.', date: 'Aug 22', by: 'J. Andersen' }, { v: 'v2', note: 'LE2 submission · share curve recalibrated to claims.', date: 'May 14', by: 'J. Andersen' }, { v: 'v1', note: 'First AOP 2027 draft from the model baseline.', date: 'Feb 3', by: 'K. Brandt' }] },
  { id: 'adcetris', brand: 'Adcetris', stream: 'US net revenue', cycle: 'AOP 2027', status: 'Not started', updated: 'Nov 3 · You', model: DEFAULT_MODEL },
  { id: 'vyndaq', brand: 'Vyndaq', stream: 'US net revenue', cycle: 'AOP 2027', status: 'In review', updated: 'Sep 28 · K. Brandt', model: DEFAULT_MODEL, versions: [{ v: 'v2', note: 'Sent for review · pediatric label event set to 60%.', date: 'Sep 28', by: 'K. Brandt' }, { v: 'v1', note: 'LE3 submission.', date: 'Aug 19', by: 'K. Brandt' }] },
  { id: 'zavzpret', brand: 'Zavzpret', stream: 'US net revenue', cycle: 'AOP 2027', status: 'Not started', updated: 'Sep 15 · A. Nguyen', model: DEFAULT_MODEL },
  { id: 'abrysvo', brand: 'Lumera', stream: 'EU5 net revenue', cycle: 'AOP 2027', status: 'In progress', updated: 'Oct 1 · M. Tran', model: noAccess, versions: [{ v: 'v1', note: 'LE3 submission · EU5 price corridor applied.', date: 'Aug 30', by: 'M. Tran' }] },
  { id: 'cibinqo', brand: 'Corvane', stream: 'US net revenue', cycle: 'Q3 reforecast', status: 'Submitted', updated: 'Oct 3 · You', model: DEFAULT_MODEL, versions: [{ v: 'v2', note: 'Q3 reforecast submitted to Finance.', date: 'Oct 3', by: 'You' }, { v: 'v1', note: 'Q2 reforecast.', date: 'Jul 2', by: 'You' }] },
  { id: 'elrexfio', brand: 'Halden', stream: 'Global net revenue', cycle: 'AOP 2027', status: 'Not started', updated: 'Sep 20 · E. Walsh', model: lockedPrice },
]

const TONE = { 'Not started': 'neutral', 'In progress': 'brand', 'In review': 'warn', Submitted: 'ok' } as const
const ACTION = { 'Not started': 'Start', 'In progress': 'Resume', 'In review': 'Open', Submitted: 'View' } as const

function RowActionMenu({
  onRename,
  onDuplicate,
  onDelete,
  label = 'Forecast',
}: {
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative inline-block text-left" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`${label} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={cx(
          'grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2 hover:text-text',
          open && 'bg-surface-2 text-text'
        )}
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${label} actions`}
          className="rise absolute right-0 top-9 z-30 w-40 rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onRename() }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-surface-2"
          >
            <Pencil size={13} className="text-text-2" />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDuplicate() }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-surface-2"
          >
            <Copy size={13} className="text-text-2" />
            Duplicate
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-err hover:bg-err-soft"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function RenameDialog({
  title,
  initialValue,
  onSave,
  onClose,
}: {
  title: string
  initialValue: string
  onSave: (val: string) => void
  onClose: () => void
}) {
  const [val, setVal] = useState(initialValue)

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (val.trim()) {
      onSave(val.trim())
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-brand-title"
      onClick={onClose}
    >
      <div
        className="rise w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="rename-brand-title" className="text-base font-semibold">{title}</h3>
        <form onSubmit={submit} className="mt-3 space-y-4">
          <input
            autoFocus
            aria-label="Name"
            value={val}
            onChange={e => setVal(e.target.value)}
            className="h-9 w-full rounded-md border border-border-strong px-2.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn size="sm" disabled={!val.trim() || val.trim() === initialValue}>Save</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteDialog({
  name,
  onConfirm,
  onClose,
}: {
  name: string
  onConfirm: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="rise w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-err">Delete {name}?</h3>
        <p className="mt-1.5 text-sm text-text-2">This will remove it from your forecasts. This action cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" size="sm" onClick={() => { onConfirm(); onClose() }}>Delete</Btn>
        </div>
      </div>
    </div>
  )
}

export default function ForecasterHome({ onOpen, notify }: { onOpen: (b: BrandRow) => void; notify?: Notify }) {
  const [f, setF] = useState<'all' | BrandRow['status']>('all')
  const [brands, setBrands] = useState<BrandRow[]>(BRANDS)
  const [renamingBrand, setRenamingBrand] = useState<BrandRow | null>(null)
  const [deletingBrand, setDeletingBrand] = useState<BrandRow | null>(null)

  const [versions, setVersions] = useState<BrandRow | null>(null)
  type SortKey = 'brand' | 'stream' | 'cycle' | 'status' | 'updated'
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 } | null>(null)
  // Temporary: compare the current table with Syeda's HTML concept, served as-is from public/.
  const [ux, setUx] = useState<'fractal' | 'syeda'>('fractal')
  const [syeda, setSyeda] = useState<BrandRow | null>(null)
  const toggleSort = (k: SortKey) => setSort(s => s?.k !== k ? { k, dir: 1 } : s.dir === 1 ? { k, dir: -1 } : null)
  const filtered = brands.filter(b => f === 'all' || b.status === f)
  const rows = sort ? [...filtered].sort((a, b) => String(a[sort.k] ?? '').localeCompare(String(b[sort.k] ?? '')) * sort.dir) : filtered

  const duplicateBrand = (b: BrandRow) => {
    const dup: BrandRow = {
      ...b,
      id: `${b.id}-copy-${Date.now()}`,
      brand: `${b.brand} (copy)`,
      status: 'In progress',
      updated: 'Just now · You',
    }
    setBrands(bs => [dup, ...bs])
    notify?.({ tone: 'ok', text: `Duplicated "${b.brand}". New forecast copy created.` })
  }

  const submitRenameBrand = (newName: string) => {
    if (!renamingBrand) return
    setBrands(bs => bs.map(x => x.id === renamingBrand.id ? { ...x, brand: newName } : x))
    notify?.({ tone: 'ok', text: `Forecast renamed to "${newName}".` })
  }

  const confirmDeleteBrand = () => {
    if (!deletingBrand) return
    setBrands(bs => bs.filter(x => x.id !== deletingBrand.id))
    notify?.({ tone: 'info', text: `"${deletingBrand.brand}" deleted.` })
  }

  // shortcut: Syeda's page takes only the brand name from the row; its numbers are her illustrative Velsipity data. Wire to row data if her UX is chosen.
  if (syeda) return (
    <div className="flex h-full flex-col bg-surface pt-4">
      <button type="button" onClick={() => setSyeda(null)} className="mx-6 mb-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-2 hover:text-brand"><ArrowLeft size={15} />Your forecasts</button>
      <iframe src={`/syeda-forecaster.html?brand=${encodeURIComponent(syeda.brand)}`} title={`${syeda.brand} · UX B`} className="min-h-[calc(100dvh-120px)] w-full flex-1" />
    </div>
  )

  return (
    <div className="min-h-full bg-bg">
      <main className="mx-auto px-10 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Your forecasts</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-text-2">Open a forecast to review the reference baseline, adjust assumptions, add events, build scenarios and run simulations.</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Forecasts · {rows.length}</h2>
          <Seg label="Status" value={f} onChange={setF} options={[{ id: 'all', label: 'All' }, { id: 'In progress', label: 'In progress' }, { id: 'In review', label: 'In review' }, { id: 'Not started', label: 'Not started' }, { id: 'Submitted', label: 'Submitted' }]} />
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-[12px] font-medium text-text-3">
                {([['brand', 'Forecast', 'w-[22%]'], ['stream', 'Scope', 'w-[20%]'], ['cycle', 'Cycle', 'w-[18%]'], ['status', 'Status', 'w-[14%]'], ['updated', 'Updated', 'w-[16%]']] as const).map(([k, h, w]) => {
                  const on = sort?.k === k
                  const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
                  return (
                    <th key={k} className={cx('px-3 py-2 font-medium', w)} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggleSort(k)} className={cx('inline-flex items-center gap-1 outline-none hover:text-text focus-visible:text-brand', on && 'text-text')}>
                        {k === 'updated' && <Clock size={11} className="mr-0.5 shrink-0 text-text-3" />}
                        {h}<Icon size={12} className={on ? 'text-brand' : 'opacity-60'} />
                      </button>
                    </th>
                  )
                })}
                <th className="w-[104px] px-3 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.id} onClick={() => ux === 'syeda' ? setSyeda(b) : onOpen(b)} title={`${ACTION[b.status]} ${b.brand}`}
                  className="group cursor-pointer border-b border-border align-middle last:border-0 hover:bg-[#f8f8fa] transition-colors">
                  <td className="px-3 py-2.5 text-[14px] font-semibold text-text whitespace-nowrap group-hover:text-brand">{b.brand}</td>
                  <td className="px-3 py-2.5 text-xs text-text-2">{b.stream}</td>
                  <td className="px-3 py-2.5 text-xs text-text-2">{b.cycle}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><Tag tone={TONE[b.status]}>{b.status}</Tag></td>
                  <td className="px-3 py-2.5 text-xs text-text-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} className="shrink-0 text-text-3" />
                      <span>{b.updated || 'Recent'}</span>
                    </span>
                  </td>
                  <td className="w-[104px] px-3 py-2.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {b.versions?.length ? (
                        <button type="button" onClick={() => setVersions(b)} title="Version history" aria-label={`Version history for ${b.brand}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2 hover:text-text">
                          <History size={14} />
                        </button>
                      ) : <span className="inline-block h-8 w-8 shrink-0" aria-hidden="true" />}
                      <RowActionMenu
                        label={b.brand}
                        onRename={() => setRenamingBrand(b)}
                        onDuplicate={() => duplicateBrand(b)}
                        onDelete={() => setDeletingBrand(b)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-text-3">No forecasts with this status.</td></tr>}
            </tbody>
          </table>
        </div>

        {versions && <VersionsDrawer b={versions} onClose={() => setVersions(null)} />}
        {renamingBrand && (
          <RenameDialog
            title="Rename forecast"
            initialValue={renamingBrand.brand}
            onSave={submitRenameBrand}
            onClose={() => setRenamingBrand(null)}
          />
        )}
        {deletingBrand && (
          <DeleteDialog
            name={deletingBrand.brand}
            onConfirm={confirmDeleteBrand}
            onClose={() => setDeletingBrand(null)}
          />
        )}
      </main>
    </div>
  )
}

/** Same pattern as the Model workspace: submitted versions (read-only) and an audit trail. */
function VersionsDrawer({ b, onClose }: { b: BrandRow; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const vs = b.versions ?? []
  const audit = [
    ...vs.map(v => ({ t: `${v.by} submitted ${v.v}`, d: v.date })),
    { t: `Last changed · ${b.updated ?? 'Recent'}`, d: b.status },
    { t: 'Actuals refreshed · through Jul 2026', d: 'Oct 3' },
  ]
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-brand-dark/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Versions and audit" onClick={e => e.stopPropagation()} className="rise flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div><p className="font-mono text-[11px] uppercase tracking-widest text-text-3">Version history</p><p className="font-semibold">{b.brand}</p><p className="text-xs text-text-2">{b.stream} · {b.cycle}</p></div>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />}><span className="sr-only">Close</span></Btn>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-3">Submitted versions · read-only</p>
          <ol className="mt-3 space-y-2">
            {vs.map((v, k) => (
              <li key={v.v} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-sm font-semibold">{v.v}{k === 0 && <Tag tone="ok">Latest</Tag>}</span><span className="text-xs text-text-3">{v.date} · {v.by}</span></div>
                <p className="mt-1 text-[13px] text-text-2">{v.note}</p>
                {k > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-text-3"><Lock size={11} />Locked snapshot</p>}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-text-3">Audit trail</p>
          <ol className="mt-3 space-y-2 border-l border-border pl-4">
            {audit.map(a => <li key={a.t} className="text-[13px]"><p>{a.t}</p><p className="text-xs text-text-3">{a.d}</p></li>)}
          </ol>
        </div>
      </aside>
    </div>
  )
}

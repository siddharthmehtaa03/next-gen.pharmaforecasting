import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Plus, Search, X } from 'lucide-react'
import { Btn, Label, Seg, Tag, Toggle, cx, field } from '../forecaster/workspace/ui'

type Notify = (t: { tone: 'ok' | 'err' | 'info'; text: string }) => void
type Tab = 'requests' | 'users'
type Role = 'Super Admin' | 'Admin' | 'Forecaster'
type AccessType = 'Standard' | 'BD / Pipeline'
type ReqStatus = 'Pending' | 'Approved' | 'Rejected'
type UStatus = 'Active' | 'Disabled'
type Person = { ntid: string; name: string; email: string; accessType: AccessType; costCenter: string; role: Role; excel: boolean; tableau: boolean }
type User = Person & { id: string; updated: string; status: UStatus }
type Req = Person & { id: string; submitted: string; status: ReqStatus; justification: string; history: { who: string; what: string; when: string }[] }

const ME = 'John Grecsek'
const SUPER_LIMIT = 3
const ROLES: { name: Role; label: string; desc: string }[] = [
  { name: 'Super Admin', label: 'Super Admin', desc: `Full control. Limited to ${SUPER_LIMIT} CoE members.` },
  { name: 'Admin', label: 'Admin · Editor', desc: 'Edits assumptions, events and scenarios, and submits forecasts.' },
  { name: 'Forecaster', label: 'Forecaster · Viewer', desc: 'Read-only access to forecasts and published outputs.' },
]
const roleLabel = (r: Role) => ROLES.find(x => x.name === r)!.label
const ACCESS_TYPES: AccessType[] = ['Standard', 'BD / Pipeline']
const COST_CENTERS = ['CC-4410 Migraine CoE', 'CC-4420 Oncology CoE', 'CC-4430 Vaccines CoE', 'CC-4440 Inflammation CoE']

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

const P = (ntid: string, name: string, role: Role, accessType: AccessType, costCenter: string, excel: boolean, tableau: boolean): Person => ({ ntid, name, role, accessType, costCenter, excel, tableau, email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.')}@pfizer.com` })
const USERS0: User[] = ([
  [P('GRECSJ01', 'John Grecsek', 'Super Admin', 'Standard', COST_CENTERS[0]!, true, true), '2026-10-21 08:02', 'Active'],
  [P('ANDERJ02', 'J. Andersen', 'Super Admin', 'Standard', COST_CENTERS[1]!, true, true), '2026-10-20 16:40', 'Active'],
  [P('TORREM03', 'M. Torres', 'Super Admin', 'Standard', COST_CENTERS[2]!, true, false), '2026-10-18 11:15', 'Active'],
  [P('BRANDK04', 'K. Brandt', 'Admin', 'Standard', COST_CENTERS[1]!, true, true), '2026-10-21 09:40', 'Active'],
  [P('NGUYEA05', 'A. Nguyen', 'Admin', 'BD / Pipeline', COST_CENTERS[3]!, true, true), '2026-10-20 14:11', 'Active'],
  [P('TRANMI06', 'Michelle Tran', 'Admin', 'Standard', COST_CENTERS[3]!, true, false), '2026-10-21 10:15', 'Active'],
  [P('OSEID07', 'David Osei', 'Forecaster', 'Standard', COST_CENTERS[0]!, false, true), '2026-10-07 17:20', 'Active'],
  [P('PATELS08', 'S. Patel', 'Forecaster', 'Standard', COST_CENTERS[1]!, false, false), '2026-10-06 16:30', 'Active'],
  [P('HADDAM09', 'M. Haddad', 'Forecaster', 'BD / Pipeline', COST_CENTERS[2]!, false, true), '2026-10-03 14:10', 'Active'],
  [P('WALSHE10', 'E. Walsh', 'Forecaster', 'Standard', COST_CENTERS[0]!, false, false), '2026-08-30 12:44', 'Disabled'],
] as [Person, string, UStatus][]).map(([p, updated, status], i) => ({ ...p, id: `u${i + 1}`, updated, status }))

const REQS0: Req[] = ([
  [P('RAMANP11', 'Priya Raman', 'Admin', 'Standard', COST_CENTERS[0]!, true, true), '2026-10-19', 'Pending', 'Taking over the AOP 2027 forecast for Nurtec from David Osei, who moves to the Japan launch team.', [['Priya Raman', 'Submitted request', '2026-10-19 09:12'], ['M. Torres (Manager)', 'Approved', '2026-10-19 15:40']]],
  [P('WEBERL12', 'Lukas Weber', 'Forecaster', 'Standard', COST_CENTERS[2]!, false, true), '2026-10-17', 'Pending', 'Needs to review the seasonal RSV forecast for the DACH region next week.', [['Lukas Weber', 'Submitted request', '2026-10-17 11:03'], ['S. Keller (Manager)', 'Approved', '2026-10-18 08:21']]],
  [P('ROSSIE13', 'Elena Rossi', 'Super Admin', 'Standard', COST_CENTERS[0]!, true, true), '2026-10-16', 'Pending', 'Nominated as the Migraine CoE lead for administrative control.', [['Elena Rossi', 'Submitted request', '2026-10-16 10:44']]],
  [P('MORIK14', 'Kenji Mori', 'Admin', 'BD / Pipeline', COST_CENTERS[3]!, true, false), '2026-10-15', 'Pending', 'Needs edit rights ahead of the Japan mid-year review, 25 Oct. Includes BD pipeline models.', [['Kenji Mori', 'Submitted request', '2026-10-15 07:55'], ['H. Sato (Manager)', 'Approved', '2026-10-15 12:10']]],
  [P('FISCHN15', 'Noah Fischer', 'Forecaster', 'Standard', COST_CENTERS[2]!, false, false), '2026-10-10', 'Approved', 'Canadian vaccine forecaster.', [['Noah Fischer', 'Submitted request', '2026-10-10 09:00'], [ME, 'Approved', '2026-10-11 10:15']]],
  [P('OKAFOG16', 'Grace Okafor', 'Admin', 'Standard', COST_CENTERS[1]!, true, true), '2026-10-09', 'Rejected', 'UK oncology forecasts.', [['Grace Okafor', 'Submitted request', '2026-10-09 14:30'], [ME, 'Rejected: no manager approval on file', '2026-10-10 08:05']]],
] as [Person, string, ReqStatus, string, [string, string, string][]][]).map(([p, submitted, status, justification, h], i) => ({ ...p, id: `REQ-${2041 - i}`, submitted, status, justification, history: h.map(([who, what, when]) => ({ who, what, when })) }))

const TONE: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = { Active: 'ok', Approved: 'ok', Pending: 'warn', Rejected: 'err', Disabled: 'neutral' }
const Status = ({ s }: { s: string }) => <Tag tone={TONE[s] ?? 'neutral'}>{s}</Tag>
const YesNo = ({ v }: { v: boolean }) => <Tag tone={v ? 'ok' : 'neutral'}>{v ? 'Yes' : 'No'}</Tag>

/* ───── shared table / overlays ───── */

type Col<T> = { key: string; label: string; val: (r: T) => string | number; render?: (r: T) => ReactNode; noSort?: boolean }
function download(name: string, mime: string, body: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: mime })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
function exportRows<T>(name: string, cols: Col<T>[], rows: T[], fmt: 'CSV' | 'Excel', notify: Notify) {
  const exp = cols.filter(c => !c.noSort)
  const head = exp.map(c => c.label), body = rows.map(r => exp.map(c => String(c.val(r))))
  const base = name.toLowerCase().replace(/[^a-z]+/g, '-')
  if (fmt === 'CSV') download(`${base}.csv`, 'text/csv', [head, ...body].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n'))
  else download(`${base}.xls`, 'application/vnd.ms-excel', [head, ...body].map(r => r.join('\t')).join('\n'))
  notify({ tone: 'ok', text: `${name} exported as ${fmt} · ${rows.length} rows` })
}

function DataTable<T extends { id: string }>({ name, title, cols, rows, onRow, notify, search, setSearch, extra, initialSort, pageSize = 10, empty = 'No matching records found.' }: { name: string; title: string; cols: Col<T>[]; rows: T[]; onRow?: (r: T) => void; notify: Notify; search: string; setSearch: (v: string) => void; extra?: ReactNode; initialSort?: { k: string; dir: 1 | -1 }; pageSize?: number; empty?: string }) {
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(initialSort ?? null)
  const [page, setPage] = useState(0)
  const [menu, setMenu] = useState(false)
  const sorted = useMemo(() => {
    const c = cols.find(x => x.key === sort?.k)
    if (!c || !sort) return rows
    return [...rows].sort((a, b) => { const x = c.val(a), y = c.val(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir })
  }, [rows, sort, cols])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize)), pg = Math.min(page, pages - 1)
  const view = sorted.slice(pg * pageSize, pg * pageSize + pageSize)
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">{title}</h2>
        <div className="relative w-full max-w-xs"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-2" /><input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search" aria-label={`Search ${title}`} className={cx(field, 'pl-9')} /></div>
        <div className="relative">
          <Btn variant="secondary" icon={<Download size={15} />} onClick={() => setMenu(v => !v)}>Export</Btn>
          {menu && <div className="rise absolute right-0 top-11 z-20 w-28 rounded-md border border-border bg-surface p-1 shadow-xl">{(['CSV', 'Excel'] as const).map(f => <button key={f} type="button" onClick={() => { setMenu(false); exportRows(name, cols, sorted, f, notify) }} className="block w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface-2">{f}</button>)}</div>}
        </div>
        {extra}
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <div>
          <table className="w-full table-auto text-left text-[13px]">
            <thead className="border-b border-border bg-surface-2/60 text-xs text-text-2"><tr>{cols.map(c => {
              const on = sort?.k === c.key
              return <th key={c.key} aria-sort={on ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-3 py-3 align-bottom font-semibold">
                {c.noSort ? c.label : <button type="button" onClick={() => setSort(on && sort!.dir === -1 ? null : { k: c.key, dir: on ? -1 : 1 })} className={cx('inline-flex items-center gap-1 hover:text-text', on && 'text-text')}>{c.label}{on ? (sort!.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="text-text-3" />}</button>}</th>
            })}</tr></thead>
            <tbody className="divide-y divide-border">
              {view.map(r => (
                <tr key={r.id} onClick={onRow && (() => onRow(r))} className={cx(onRow && 'cursor-pointer hover:bg-surface-2/60')}>
                  {cols.map(c => <td key={c.key} className="break-words px-3 py-3 align-top">{c.render ? c.render(r) : c.val(r)}</td>)}
                </tr>
              ))}
              {!view.length && <tr><td colSpan={cols.length} className="px-4 py-24 text-center text-text-3">{empty}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-2">
          <span>{sorted.length ? `${pg * pageSize + 1}–${Math.min(sorted.length, pg * pageSize + pageSize)} of ${sorted.length}` : '0 results'}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous page" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-2 disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span className="px-1">Page {pg + 1} / {pages}</span>
            <button type="button" aria-label="Next page" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-2 disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    </section>
  )
}

function useEsc(fn: () => void) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && fn(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) })
}
function Drawer({ title, sub, onClose, children, footer }: { title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEsc(onClose)
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-text/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className="rise relative flex h-full w-full max-w-[520px] flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4"><div className="min-w-0"><h2 className="text-lg font-semibold">{title}</h2>{sub && <p className="text-[13px] text-text-2">{sub}</p>}</div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-2 hover:bg-surface-2"><X size={16} /></button></header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}
function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; wide?: boolean }) {
  useEsc(onClose)
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-text/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('rise relative max-h-[92vh] w-full overflow-y-auto rounded-lg bg-surface shadow-2xl', wide ? 'max-w-xl' : 'max-w-md')}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5"><h2 className="text-base font-semibold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-2"><X size={15} /></button></header>
        <div className="space-y-4 p-5 text-[13px]">{children}</div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>
      </div>
    </div>
  )
}
const Fld = ({ label, children, error }: { label: string; children: ReactNode; error?: string }) => <label className="block"><Label className="mb-1">{label}</Label>{children}{error && <span className="mt-1 block text-xs text-err">{error}</span>}</label>
const Dl = ({ rows }: { rows: [string, ReactNode][] }) => <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[13px]">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-text-3">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}</dl>

/* ───── portal ───── */

type Ask = { title: string; body?: ReactNode; confirm: string; tone?: 'primary' | 'danger'; needText?: string; run: (text: string) => void }

export default function AdminPortal({ notify, onBack }: { notify: Notify; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('requests')
  const [reqs, setReqs] = useState(REQS0)
  const [users, setUsers] = useState(USERS0)
  const [openReq, setOpenReq] = useState<string | null>(null)
  const [edit, setEdit] = useState<User | 'new' | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [rq, setRq] = useState(''), [uq, setUq] = useState('')
  const [rf, setRf] = useState<'Pending' | 'all'>('Pending')

  const superTaken = (exceptNtid?: string) => users.filter(u => u.role === 'Super Admin' && u.status === 'Active' && u.ntid !== exceptNtid).length
  const superFull = (exceptNtid?: string) => superTaken(exceptNtid) >= SUPER_LIMIT
  const pending = reqs.filter(r => r.status === 'Pending').length

  const upsert = (p: Person) => setUsers(us => us.some(u => u.ntid === p.ntid)
    ? us.map(u => u.ntid === p.ntid ? { ...u, ...p, updated: stamp(), status: 'Active' } : u)
    : [{ ...p, id: `u${Date.now()}`, updated: stamp(), status: 'Active' }, ...us])
  const patchReq = (id: string, status: ReqStatus, what: string) => setReqs(rs => rs.map(r => r.id === id ? { ...r, status, history: [...r.history, { who: ME, what, when: stamp() }] } : r))

  const blocked = (r: Req) => r.role === 'Super Admin' && superFull(r.ntid) ? `Super Admin seats are full (${SUPER_LIMIT} of ${SUPER_LIMIT}). Free a seat first.` : ''
  const approve = (r: Req) => {
    if (blocked(r)) return notify({ tone: 'err', text: blocked(r) })
    upsert(r); patchReq(r.id, 'Approved', 'Approved'); setOpenReq(null)
    notify({ tone: 'ok', text: `${r.name} approved as ${roleLabel(r.role)}. Access is live.` })
  }
  const reject = (r: Req) => setAsk({ title: `Reject ${r.id}`, body: <p>{r.name} will be notified with your reason.</p>, confirm: 'Reject request', tone: 'danger', needText: 'Reason for rejection', run: t => { patchReq(r.id, 'Rejected', `Rejected: ${t}`); setOpenReq(null); notify({ tone: 'ok', text: `${r.id} rejected` }) } })
  const toggleActive = (u: User) => {
    if (u.status === 'Active') return setAsk({ title: `Deactivate ${u.name}`, body: <p>{u.name} loses access to forecasts, Excel models and Tableau immediately. You can re-enable them later.</p>, confirm: 'Deactivate', tone: 'danger', run: () => { setUsers(us => us.map(x => x.id === u.id ? { ...x, status: 'Disabled', updated: stamp() } : x)); notify({ tone: 'ok', text: `${u.name} deactivated` }) } })
    if (u.role === 'Super Admin' && superFull(u.ntid)) return notify({ tone: 'err', text: `Super Admin seats are full (${SUPER_LIMIT} of ${SUPER_LIMIT}).` })
    setUsers(us => us.map(x => x.id === u.id ? { ...x, status: 'Active', updated: stamp() } : x)); notify({ tone: 'ok', text: `${u.name} re-enabled` })
  }

  const R = reqs.find(r => r.id === openReq)
  const rRows = reqs.filter(r => (rf === 'all' || r.status === 'Pending') && `${r.ntid} ${r.name} ${r.email} ${r.costCenter}`.toLowerCase().includes(rq.toLowerCase()))
  const uRows = users.filter(u => `${u.ntid} ${u.name} ${u.email} ${u.costCenter} ${u.role}`.toLowerCase().includes(uq.toLowerCase()))

  const personCols = <T extends Person>(roleHead: string): Col<T>[] => [
    { key: 'ntid', label: 'NTID', val: r => r.ntid, render: r => <span className="font-mono text-xs">{r.ntid}</span> },
    { key: 'name', label: 'User Name', val: r => r.name, render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'email', label: 'Email ID', val: r => r.email },
    { key: 'access', label: 'Access Type', val: r => r.accessType },
    { key: 'cc', label: 'Cost Center', val: r => r.costCenter },
    { key: 'role', label: roleHead, val: r => r.role, render: r => <span>{roleLabel(r.role)}</span> },
  ]
  const reqCols: Col<Req>[] = [
    ...personCols<Req>('Requested Role'),
    { key: 'submitted', label: 'Submitted On', val: r => r.submitted },
    { key: 'excel', label: 'Excel Model Access', val: r => (r.excel ? 'Yes' : 'No'), render: r => <YesNo v={r.excel} /> },
    { key: 'tableau', label: 'Tableau Access', val: r => (r.tableau ? 'Yes' : 'No'), render: r => <YesNo v={r.tableau} /> },
    { key: 'status', label: 'Status', val: r => r.status, render: r => <Status s={r.status} /> },
    { key: 'actions', label: 'Actions', noSort: true, val: () => '', render: r => r.status === 'Pending'
      ? <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
          <Btn size="sm" disabled={!!blocked(r)} title={blocked(r) || undefined} onClick={() => approve(r)}>Approve</Btn>
          <Btn size="sm" variant="danger" onClick={() => reject(r)}>Reject</Btn></div>
      : <span className="text-text-3">—</span> },
  ]
  const userCols: Col<User>[] = [
    ...personCols<User>('User Role'),
    { key: 'updated', label: 'Last Updated On', val: r => r.updated },
    { key: 'excel', label: 'Excel Model Access', val: r => (r.excel ? 'Yes' : 'No'), render: r => <YesNo v={r.excel} /> },
    { key: 'tableau', label: 'Tableau Access', val: r => (r.tableau ? 'Yes' : 'No'), render: r => <YesNo v={r.tableau} /> },
    { key: 'status', label: 'Status', val: r => r.status, render: r => <Status s={r.status} /> },
    { key: 'actions', label: 'Actions', noSort: true, val: () => '', render: r => (
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <Btn size="sm" variant="secondary" onClick={() => setEdit(r)}>Edit</Btn>
        <Btn size="sm" variant={r.status === 'Active' ? 'danger' : 'secondary'} disabled={r.name === ME} title={r.name === ME ? 'You cannot deactivate yourself' : undefined} onClick={() => toggleActive(r)}>{r.status === 'Active' ? 'Deactivate' : 'Re-enable'}</Btn></div>) },
  ]

  const tabs: [Tab, string][] = [['requests', 'Access Requests'], ['users', 'User Access']]
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-6 py-8">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 self-start text-sm text-text-2 hover:text-text"><ArrowLeft size={14} />Model library</button>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold tracking-tight">Admin Portal</h1><p className="text-[13px] text-text-2">Approve access requests and manage who can use the forecaster.</p></div>
      </header>

      <nav aria-label="Admin sections" className="mb-6 border-b border-border">
        <ul role="tablist" className="-mb-px flex gap-1">
          {tabs.map(([id, label]) => (
            <li key={id}><button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx('flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', tab === id ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text')}>
              {label}{id === 'requests' && pending > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{pending}</span>}
            </button></li>
          ))}
        </ul>
      </nav>

      {tab === 'requests' && <DataTable name="Access Requests" title="Access Requests" cols={reqCols} rows={rRows} onRow={r => setOpenReq(r.id)} notify={notify} search={rq} setSearch={setRq} initialSort={{ k: 'submitted', dir: -1 }}
        empty={rf === 'Pending' ? 'No pending requests.' : 'No matching records found.'}
        extra={<Seg label="Request status" value={rf} onChange={setRf} options={[{ id: 'Pending', label: `Pending · ${pending}` }, { id: 'all', label: 'All' }]} />} />}
      {tab === 'users' && <DataTable name="User Access" title="User Access" cols={userCols} rows={uRows} onRow={u => setEdit(u)} notify={notify} search={uq} setSearch={setUq} initialSort={{ k: 'updated', dir: -1 }}
        extra={<Btn icon={<Plus size={15} />} onClick={() => setEdit('new')}>Add User</Btn>} />}

      {R && (
        <Drawer title={`${R.id} · ${R.name}`} sub={`${roleLabel(R.role)} · ${R.costCenter}`} onClose={() => setOpenReq(null)}
          footer={R.status === 'Pending' ? <>
            <Btn variant="danger" onClick={() => reject(R)}>Reject</Btn>
            <Btn onClick={() => approve(R)} disabled={!!blocked(R)} title={blocked(R) || undefined}>Approve</Btn></> : <span className="mr-auto text-[13px] text-text-2">This request is closed.</span>}>
          <Status s={R.status} />
          {blocked(R) && <p className="rounded-md bg-warn-soft p-3 text-[13px] text-warn">{blocked(R)}</p>}
          <section><Label className="mb-2">Requester</Label><Dl rows={[['NTID', R.ntid], ['Name', R.name], ['Email', R.email], ['Cost center', R.costCenter], ['Submitted', R.submitted]]} /></section>
          <section><Label className="mb-2">Access requested</Label><Dl rows={[['Role', <span>{roleLabel(R.role)}<span className="block text-xs text-text-3">{ROLES.find(x => x.name === R.role)!.desc}</span></span>], ['Access type', R.accessType], ['Excel model access', <YesNo v={R.excel} />], ['Tableau access', <YesNo v={R.tableau} />]]} /></section>
          <section><Label className="mb-2">Justification</Label><p className="rounded-md bg-surface-2 p-3 text-[13px]">{R.justification}</p></section>
          <section><Label className="mb-2">Approval history</Label><ol className="space-y-3">{R.history.map((h, k) => <li key={k} className="flex gap-3 text-[13px]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" /><div><p>{h.what}</p><p className="text-xs text-text-3">{h.who} · {h.when}</p></div></li>)}</ol></section>
        </Drawer>
      )}

      {edit && <UserForm key={edit === 'new' ? 'new' : edit.id} user={edit === 'new' ? null : edit} users={users} superFull={superFull} onClose={() => setEdit(null)}
        onSave={(p, isNew) => { upsert(p); setEdit(null); notify({ tone: 'ok', text: isNew ? `${p.name} added as ${roleLabel(p.role)}` : `${p.name} updated` }) }} />}
      {ask && <AskModal ask={ask} onClose={() => setAsk(null)} />}
    </div>
  )
}

function UserForm({ user, users, superFull, onClose, onSave }: { user: User | null; users: User[]; superFull: (except?: string) => boolean; onClose: () => void; onSave: (p: Person, isNew: boolean) => void }) {
  const [f, setF] = useState<Person>(user ?? { ntid: '', name: '', email: '', accessType: 'Standard', costCenter: COST_CENTERS[0]!, role: 'Forecaster', excel: false, tableau: false })
  const [tried, setTried] = useState(false)
  const set = <K extends keyof Person>(k: K, v: Person[K]) => setF(p => ({ ...p, [k]: v }))
  const ntid = f.ntid.trim().toUpperCase()
  const err = {
    ntid: !ntid ? 'NTID is required.' : !user && users.some(u => u.ntid === ntid) ? 'A user with this NTID already exists.' : '',
    name: f.name.trim() ? '' : 'Name is required.',
    email: /^\S+@\S+\.\S+$/.test(f.email.trim()) ? '' : 'Enter a valid email address.',
  }
  const full = superFull(user?.ntid)
  const roleErr = f.role === 'Super Admin' && full && user?.role !== 'Super Admin' ? `Super Admin seats are full (${SUPER_LIMIT} of ${SUPER_LIMIT}).` : ''
  const bad = !!(err.ntid || err.name || err.email || roleErr)
  const show = (m: string) => (tried ? m : '')
  return (
    <Modal wide title={user ? `Edit ${user.name}` : 'Add User'} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Cancel</Btn>
      <Btn onClick={() => { setTried(true); if (!bad) onSave({ ...f, ntid, name: f.name.trim(), email: f.email.trim() }, !user) }}>{user ? 'Save changes' : 'Add user'}</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Fld label="NTID" error={show(err.ntid)}><input className={field} value={f.ntid} disabled={!!user} onChange={e => set('ntid', e.target.value)} autoFocus={!user} /></Fld>
        <Fld label="User name" error={show(err.name)}><input className={field} value={f.name} onChange={e => set('name', e.target.value)} /></Fld>
        <Fld label="Email ID" error={show(err.email)}><input className={field} type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Fld>
        <Fld label="Cost center"><select className={field} value={f.costCenter} onChange={e => set('costCenter', e.target.value)}>{COST_CENTERS.map(c => <option key={c}>{c}</option>)}</select></Fld>
        <Fld label="Access type"><select className={field} value={f.accessType} onChange={e => set('accessType', e.target.value as AccessType)}>{ACCESS_TYPES.map(a => <option key={a}>{a}</option>)}</select></Fld>
      </div>
      <fieldset>
        <Label className="mb-1.5">User role</Label>
        <div className="space-y-2">
          {ROLES.map(r => { const off = r.name === 'Super Admin' && full && user?.role !== 'Super Admin'; return (
            <label key={r.name} className={cx('flex items-start gap-3 rounded-md border p-3', f.role === r.name ? 'border-brand bg-brand-soft/40' : 'border-border', off ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
              <input type="radio" name="role" className="mt-0.5" checked={f.role === r.name} disabled={off} onChange={() => set('role', r.name)} />
              <span><span className="block text-[13px] font-semibold">{r.label}</span><span className="block text-xs text-text-2">{off ? `Seats full (${SUPER_LIMIT} of ${SUPER_LIMIT}).` : r.desc}</span></span>
            </label>) })}
        </div>
        {show(roleErr) && <span className="mt-1 block text-xs text-err">{roleErr}</span>}
      </fieldset>
      <div className="space-y-3 rounded-md border border-border p-3">
        {([['excel', 'Excel model access', 'Download and run the Excel forecasting models.'], ['tableau', 'Tableau access', 'View the Tableau dashboards.']] as const).map(([k, t, d]) => (
          <div key={k} className="flex items-center justify-between gap-4"><div><p className="text-[13px] font-semibold">{t}</p><p className="text-xs text-text-2">{d}</p></div><Toggle on={f[k]} onChange={v => set(k, v)} label={t} /></div>
        ))}
      </div>
    </Modal>
  )
}

function AskModal({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const [t, setT] = useState('')
  return (
    <Modal title={ask.title} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn variant={ask.tone === 'danger' ? 'danger' : 'primary'} disabled={!!ask.needText && !t.trim()} onClick={() => { ask.run(t.trim()); onClose() }}>{ask.confirm}</Btn></>}>
      {ask.body}
      {ask.needText && <Fld label={ask.needText}><textarea autoFocus rows={3} value={t} onChange={e => setT(e.target.value)} className={cx(field, 'h-auto py-2')} /></Fld>}
    </Modal>
  )
}

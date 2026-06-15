'use client'
import { apiUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ChevronRight, Eye, Trash2, Edit2, Check, X as XIcon } from 'lucide-react'
import Select from '@/components/Select'

function fmt(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB'
  return bytes + ' B'
}

const healthDot: Record<string, string> = {
  green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)',
}

interface IndexInfo {
  name: string; health: string; status: string
  docsCount: number; storeSize: number; aliases: string[]
}

interface Mapping { [field: string]: { type?: string; properties?: Mapping } }

type Tab = 'docs' | 'mapping' | 'settings'

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  if (data === null) return <span style={{ color: 'var(--red)' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: 'var(--yellow)' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: 'var(--cyan)' }}>{data}</span>
  if (typeof data === 'string') return <span style={{ color: '#e8b45a' }}>"{data}"</span>
  if (Array.isArray(data)) {
    if (!data.length) return <span style={{ color: 'var(--text-dim)' }}>[]</span>
    return (
      <span>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, fontSize: 'inherit', fontFamily: 'inherit' }}>
          {open ? '▾' : '▸'} [{data.length}]
        </button>
        {open && (
          <div style={{ paddingLeft: 16 }}>
            {data.map((v, i) => <div key={i}><JsonTree data={v} depth={depth + 1} /></div>)}
          </div>
        )}
      </span>
    )
  }
  const keys = Object.keys(data as object)
  if (!keys.length) return <span style={{ color: 'var(--text-dim)' }}>{'{}'}</span>
  return (
    <span>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, fontSize: 'inherit', fontFamily: 'inherit' }}>
        {open ? '▾' : '▸'} {'{'}…{'}'}
      </button>
      {open && (
        <div style={{ paddingLeft: 16 }}>
          {keys.map(k => (
            <div key={k}>
              <span style={{ color: 'var(--green)' }}>{k}</span>
              <span style={{ color: 'var(--text-dim)' }}>: </span>
              <JsonTree data={(data as Record<string, unknown>)[k]} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

function DocRow({ doc, onEdit, onDelete }: {
  doc: Record<string, unknown>
  onEdit: (doc: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const id = doc._id as string
  const preview = Object.entries(doc)
    .filter(([k]) => k !== '_id' && k !== '_index')
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('  •  ')

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[rgba(0,255,65,.03)] cursor-pointer"
        onClick={() => setOpen(o => !o)}>
        <ChevronRight size={12} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(90deg)' : '', transition: 'transform .15s', flexShrink: 0 }} />
        <span style={{ color: 'var(--cyan)', fontSize: '0.72rem', fontFamily: 'monospace', flexShrink: 0 }}>{id}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{preview}</span>
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button className="icon-btn edit" onClick={() => onEdit(doc)} title="Edit"><Edit2 size={12} /></button>
          <button className="icon-btn delete" onClick={() => onDelete(id)} title="Delete"><Trash2 size={12} /></button>
        </div>
      </div>
      {open && (
        <div style={{ padding: '8px 32px 12px', fontSize: '0.78rem', background: 'var(--bg-secondary)' }}>
          <JsonTree data={doc} depth={1} />
        </div>
      )}
    </div>
  )
}

export default function EsIndexBrowser() {
  const { esBrowserIndex, setEsBrowserIndex } = useAppStore()

  const [indices, setIndices] = useState<IndexInfo[]>([])
  const [tab, setTab] = useState<Tab>('docs')
  const [docs, setDocs] = useState<Record<string, unknown>[]>([])
  const [docsTotal, setDocsTotal] = useState(0)
  const [docsPage, setDocsPage] = useState(1)
  const [docsLimit, setDocsLimit] = useState(20)
  const [mapping, setMapping] = useState<unknown>(null)
  const [settings, setSettings] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editDoc, setEditDoc] = useState<Record<string, unknown> | null>(null)
  const [editJson, setEditJson] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadIndices = useCallback(async () => {
    const res = await fetch(apiUrl('/api/es/indices'))
    const d = await res.json()
    if (d.indices) setIndices(d.indices)
  }, [])

  useEffect(() => { loadIndices() }, [loadIndices])

  const loadDocs = useCallback(async (idx: string, page = 1, limit = 20) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(apiUrl(`/api/es/indices/${encodeURIComponent(idx)}/docs?page=${page}&limit=${limit}`))
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setDocs(d.docs)
      setDocsTotal(d.total)
      setDocsPage(page)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  const loadMapping = useCallback(async (idx: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(apiUrl(`/api/es/indices/${encodeURIComponent(idx)}/mapping`))
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setMapping(d.mapping)
      setSettings(d.settings)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  const selectIndex = (name: string) => {
    setEsBrowserIndex(name)
    setDocsPage(1)
    setError(null)
    if (tab === 'docs') loadDocs(name, 1, docsLimit)
    else loadMapping(name)
  }

  useEffect(() => {
    if (!esBrowserIndex) return
    if (tab === 'docs') loadDocs(esBrowserIndex, docsPage, docsLimit)
    else loadMapping(esBrowserIndex)
  }, [tab])

  const deleteDoc = async (id: string) => {
    if (!confirm(`Delete document ${id}?`)) return
    await fetch(apiUrl('/api/es/docs'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: esBrowserIndex, id }),
    })
    loadDocs(esBrowserIndex, docsPage, docsLimit)
  }

  const openEdit = (doc: Record<string, unknown>) => {
    const { _id, _index, ...rest } = doc
    setEditDoc(doc)
    setEditJson(JSON.stringify(rest, null, 2))
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!editDoc) return
    setSaving(true); setEditError(null)
    try {
      const parsed = JSON.parse(editJson)
      const res = await fetch(apiUrl('/api/es/docs'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: esBrowserIndex, id: editDoc._id, doc: parsed }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEditDoc(null)
      loadDocs(esBrowserIndex, docsPage, docsLimit)
    } catch (e: unknown) { setEditError((e as Error).message) }
    finally { setSaving(false) }
  }

  const totalPages = Math.ceil(docsTotal / docsLimit)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0, background: 'var(--bg-secondary)' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '.08em' }}>
          INDICES ({indices.length})
        </div>
        {indices.map(idx => (
          <button key={idx.name} onClick={() => selectIndex(idx.name)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
              background: esBrowserIndex === idx.name ? 'rgba(0,212,255,.08)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,.03)',
              color: esBrowserIndex === idx.name ? 'var(--cyan)' : 'var(--text-muted)',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '0.75rem',
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: healthDot[idx.health] ?? 'var(--text-dim)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{idx.name}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', flexShrink: 0 }}>{idx.docsCount.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!esBrowserIndex ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            ← Select an index
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, padding: '8px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ color: 'var(--cyan)', fontSize: '0.8rem', fontWeight: 600, marginRight: 16 }}>{esBrowserIndex}</span>
              {(['docs', 'mapping', 'settings'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`btn text-xs py-1 px-2 ${tab === t ? 'btn-cyan' : ''}`}
                  style={{ marginRight: 4 }}>
                  {t.toUpperCase()}
                </button>
              ))}
              <button className="btn-green icon-btn ml-auto" onClick={() => {
                if (tab === 'docs') loadDocs(esBrowserIndex, docsPage, docsLimit)
                else loadMapping(esBrowserIndex)
              }} disabled={loading} title="Refresh">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {error && (
              <div style={{ padding: 12, color: 'var(--red)', fontSize: '0.8rem', background: 'rgba(255,0,60,.05)', borderBottom: '1px solid var(--border)' }}>
                {error}
              </div>
            )}

            {/* Docs tab */}
            {tab === 'docs' && (
              <>
                {/* Pagination controls */}
                <div style={{ display: 'flex', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                    {docsTotal.toLocaleString()} docs
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Select value={String(docsLimit)} onChange={v => { setDocsLimit(Number(v)); loadDocs(esBrowserIndex, 1, Number(v)) }}
                      options={['10', '20', '50', '100']}
                      labels={{ '10': '10/pg', '20': '20/pg', '50': '50/pg', '100': '100/pg' }}
                      height={26} />
                    <button className="btn text-xs py-0.5 px-1.5" disabled={docsPage <= 1} onClick={() => loadDocs(esBrowserIndex, 1, docsLimit)}>«</button>
                    <button className="btn text-xs py-0.5 px-1.5" disabled={docsPage <= 1} onClick={() => loadDocs(esBrowserIndex, docsPage - 1, docsLimit)}>‹</button>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', minWidth: 60, textAlign: 'center' }}>
                      {docsPage} / {totalPages || 1}
                    </span>
                    <button className="btn text-xs py-0.5 px-1.5" disabled={docsPage >= totalPages} onClick={() => loadDocs(esBrowserIndex, docsPage + 1, docsLimit)}>›</button>
                    <button className="btn text-xs py-0.5 px-1.5" disabled={docsPage >= totalPages} onClick={() => loadDocs(esBrowserIndex, totalPages, docsLimit)}>»</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.78rem' }}>
                  {docs.map((doc, i) => (
                    <DocRow key={doc._id as string ?? i} doc={doc} onEdit={openEdit} onDelete={deleteDoc} />
                  ))}
                </div>
              </>
            )}

            {/* Mapping tab */}
            {tab === 'mapping' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontSize: '0.78rem' }}>
                {mapping != null && <JsonTree data={mapping} depth={0} />}
              </div>
            )}

            {/* Settings tab */}
            {tab === 'settings' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontSize: '0.78rem' }}>
                {settings != null && <JsonTree data={settings} depth={0} />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit modal */}
      {editDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => e.target === e.currentTarget && setEditDoc(null)}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: 8, width: 600, maxWidth: '90vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--cyan)', fontSize: '0.8rem', fontWeight: 600 }}>EDIT — {editDoc._id as string}</span>
              <button className="icon-btn" onClick={() => setEditDoc(null)}><XIcon size={14} /></button>
            </div>
            <textarea
              value={editJson}
              onChange={e => setEditJson(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-secondary)', border: 'none',
                color: 'var(--green)', fontFamily: 'inherit', fontSize: '0.8rem',
                padding: 16, resize: 'none', outline: 'none', minHeight: 300,
              }}
            />
            {editError && <div style={{ padding: '6px 16px', color: 'var(--red)', fontSize: '0.75rem' }}>{editError}</div>}
            <div className="flex gap-2 px-4 py-3 justify-end" style={{ borderTop: '1px solid var(--border)' }}>
              <button className="btn text-xs py-1.5 px-3" onClick={() => setEditDoc(null)}>CANCEL</button>
              <button className="btn-cyan text-xs py-1.5 px-3 flex items-center gap-1" onClick={saveEdit} disabled={saving}>
                <Check size={12} /> {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { apiUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, RefreshCw, Copy, Trash2, Edit2, Check, X as XIcon, ChevronRight } from 'lucide-react'
import Select from '@/components/Select'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

function fmt(bytes: number) {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB'
  return bytes + ' B'
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 3)
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
        {open && <div style={{ paddingLeft: 16 }}>{data.map((v, i) => <div key={i}><JsonTree data={v} depth={depth + 1} /></div>)}</div>}
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

function DocCard({ doc, index, onEdit, onDelete }: {
  doc: Record<string, unknown>; index: string
  onEdit: (doc: Record<string, unknown>) => void
  onDelete: (id: string, index: string) => void
}) {
  const [open, setOpen] = useState(false)
  const id = doc._id as string
  const score = doc._score as number | null

  const preview = Object.entries(doc)
    .filter(([k]) => !['_id', '_index', '_score'].includes(k))
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('  •  ')

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[rgba(0,255,65,.03)] cursor-pointer"
        onClick={() => setOpen(o => !o)}>
        <ChevronRight size={12} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(90deg)' : '', transition: 'transform .15s', flexShrink: 0 }} />
        <span style={{ color: 'var(--cyan)', fontSize: '0.72rem', fontFamily: 'monospace', flexShrink: 0 }}>{id}</span>
        {score != null && <span style={{ color: 'var(--yellow)', fontSize: '0.65rem', flexShrink: 0 }}>▲{score.toFixed(3)}</span>}
        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{preview}</span>
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button className="icon-btn copy" title="Copy" onClick={() => navigator.clipboard.writeText(JSON.stringify(doc, null, 2))}><Copy size={11} /></button>
          <button className="icon-btn edit" onClick={() => onEdit(doc)} title="Edit"><Edit2 size={11} /></button>
          <button className="icon-btn delete" onClick={() => onDelete(id, index)} title="Delete"><Trash2 size={11} /></button>
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

export default function EsQueryView() {
  const { esIndex, esQuery, esResults, esError, esElapsed, esTotal, setEsIndex, setEsQuery, setEsResults } = useAppStore()

  const [indices, setIndices] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards')
  const lastDsl = useRef<Record<string, unknown> | null>(null)

  const [editDoc, setEditDoc] = useState<Record<string, unknown> | null>(null)
  const [editJson, setEditJson] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/api/es/indices'))
      .then(r => r.json())
      .then(d => setIndices((d.indices ?? []).map((i: { name: string }) => i.name)))
      .catch(() => {})
  }, [])

  const run = useCallback(async (p = 1) => {
    if (!esIndex) return
    let dsl: Record<string, unknown>
    try {
      dsl = JSON.parse(esQuery)
    } catch {
      setEsResults(null, null, null, 'Invalid JSON in query')
      return
    }
    lastDsl.current = dsl
    setRunning(true)
    try {
      const res = await fetch(apiUrl('/api/es/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: esIndex, dsl, page: p, limit }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setPage(p)
      setEsResults(d.docs, d.total, d.elapsed, null)
    } catch (e: unknown) {
      setEsResults(null, null, null, (e as Error).message)
    } finally {
      setRunning(false)
    }
  }, [esIndex, esQuery, limit, setEsResults])

  const totalPages = Math.ceil((esTotal ?? 0) / limit)

  const deleteDoc = async (id: string, index: string) => {
    if (!confirm(`Delete ${id}?`)) return
    await fetch(apiUrl('/api/es/docs'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, id }),
    })
    run(page)
  }

  const openEdit = (doc: Record<string, unknown>) => {
    const { _id, _index, _score, ...rest } = doc
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
        body: JSON.stringify({ index: editDoc._index ?? esIndex, id: editDoc._id, doc: parsed }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEditDoc(null)
      run(page)
    } catch (e: unknown) { setEditError((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center', flexShrink: 0 }}>
        <Select value={esIndex} onChange={setEsIndex} options={indices} minWidth={180} />
        <button className="btn-green text-xs py-1 px-3 flex items-center gap-1" onClick={() => run(1)} disabled={running || !esIndex}>
          <Play size={12} /> {running ? 'RUNNING...' : 'SEARCH'}
        </button>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginLeft: 'auto' }}>
          {esElapsed != null ? `${esElapsed}ms` : ''}
          {esTotal != null ? `  ${esTotal.toLocaleString()} hits` : ''}
        </span>
      </div>

      {/* Editor + Results */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor panel */}
        <div style={{ width: '40%', minWidth: 200, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '.06em' }}>
            DSL QUERY
          </div>
          <div style={{ flex: 1 }}>
            <MonacoEditor
              height="100%"
              defaultLanguage="json"
              value={esQuery}
              onChange={v => setEsQuery(v ?? '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false }, fontSize: 13, lineNumbers: 'off',
                scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
              }}
              beforeMount={monaco => {
                monaco.editor.defineTheme('hacker', {
                  base: 'vs-dark', inherit: true,
                  rules: [{ token: 'string.key.json', foreground: '00ff41' }],
                  colors: { 'editor.background': '#0d0d0d' },
                })
                monaco.editor.setTheme('hacker')
              }}
            />
          </div>
        </div>

        {/* Results panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Results toolbar */}
          <div style={{ display: 'flex', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center', flexShrink: 0 }}>
            <button className="btn-green icon-btn" style={{ height: 26, width: 26 }} onClick={() => run(page)} disabled={running} title="Refresh">
              <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
            </button>
            <Select value={String(limit)} onChange={v => setLimit(Number(v))}
              options={['10', '20', '50', '100']}
              labels={{ '10': '10/pg', '20': '20/pg', '50': '50/pg', '100': '100/pg' }}
              height={26} />
            <button className={`btn text-xs px-2 ${viewMode === 'cards' ? 'btn-green' : ''}`} style={{ height: 26 }} onClick={() => setViewMode('cards')}>CARDS</button>
            <button className={`btn text-xs px-2 ${viewMode === 'raw' ? 'btn-green' : ''}`} style={{ height: 26 }} onClick={() => setViewMode('raw')}>RAW</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="btn text-xs py-0.5 px-1.5" disabled={page <= 1} onClick={() => run(1)}>«</button>
              <button className="btn text-xs py-0.5 px-1.5" disabled={page <= 1} onClick={() => run(page - 1)}>‹</button>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', minWidth: 60, textAlign: 'center' }}>{page} / {totalPages || 1}</span>
              <button className="btn text-xs py-0.5 px-1.5" disabled={page >= totalPages} onClick={() => run(page + 1)}>›</button>
              <button className="btn text-xs py-0.5 px-1.5" disabled={page >= totalPages} onClick={() => run(totalPages)}>»</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {esError && (
              <div style={{ padding: 16, color: 'var(--red)', fontSize: '0.8rem' }}>{esError}</div>
            )}
            {!esError && esResults && viewMode === 'cards' && (esResults as Record<string, unknown>[]).map((doc, i) => (
              <DocCard key={(doc._id as string) ?? i} doc={doc} index={doc._index as string ?? esIndex}
                onEdit={openEdit} onDelete={deleteDoc} />
            ))}
            {!esError && esResults && viewMode === 'raw' && (
              <pre style={{ padding: 16, fontSize: '0.75rem', color: 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(esResults, null, 2)}
              </pre>
            )}
            {!esResults && !esError && (
              <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' }}>
                Enter a DSL query and press SEARCH
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setEditDoc(null)}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, width: 600, maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--cyan)', fontSize: '0.8rem', fontWeight: 600 }}>EDIT — {editDoc._id as string}</span>
              <button className="icon-btn" onClick={() => setEditDoc(null)}><XIcon size={14} /></button>
            </div>
            <textarea value={editJson} onChange={e => setEditJson(e.target.value)}
              style={{ flex: 1, background: 'var(--bg-secondary)', border: 'none', color: 'var(--green)', fontFamily: 'inherit', fontSize: '0.8rem', padding: 16, resize: 'none', outline: 'none', minHeight: 300 }} />
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

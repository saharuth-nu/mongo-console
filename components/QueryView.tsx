'use client'
import { apiUrl } from '@/lib/api'
import { useEffect, useRef, useState, useCallback } from 'react'
import Terminal from './Terminal'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import Select from './Select'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ─── JSON renderer ────────────────────────────────────────────────────────────

function JsonNode({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  if (data === null) return <span style={{ color: 'var(--red)' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: 'var(--cyan)' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: 'var(--yellow)' }}>{data}</span>
  if (typeof data === 'string') return <span style={{ color: '#98c379' }}>"{data}"</span>
  if (Array.isArray(data)) {
    if (collapsed) return <span className="cursor-pointer" style={{ color: 'var(--text-dim)' }} onClick={() => setCollapsed(false)}>[{data.length} items ▶]</span>
    return <span>
      <span className="cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => setCollapsed(true)}>▼ [</span>
      <div style={{ marginLeft: 14 }}>{data.map((v, i) => <div key={i}><JsonNode data={v} depth={depth + 1} />{i < data.length - 1 && ','}</div>)}</div>
      <span style={{ color: 'var(--text-secondary)' }}>]</span>
    </span>
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (collapsed) return <span className="cursor-pointer" style={{ color: 'var(--text-dim)' }} onClick={() => setCollapsed(false)}>{'{'}…{entries.length} keys{'}'} ▶</span>
    return <span>
      <span className="cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => setCollapsed(true)}>▼ {'{'}</span>
      <div style={{ marginLeft: 14 }}>
        {entries.map(([k, v], i) => (
          <div key={k}>
            <span style={{ color: 'var(--cyan)' }}>"{k}"</span>
            <span style={{ color: 'var(--text-secondary)' }}>: </span>
            <JsonNode data={v} depth={depth + 1} />
            {i < entries.length - 1 && ','}
          </div>
        ))}
      </div>
      <span style={{ color: 'var(--text-secondary)' }}>{'}'}</span>
    </span>
  }
  return <span style={{ color: 'var(--text-primary)' }}>{String(data)}</span>
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocCard({
  doc, index, db, col,
  onUpdated, onDeleted,
}: {
  doc: Record<string, unknown>
  index: number
  db: string
  col: string
  onUpdated: (id: string, newDoc: Record<string, unknown>) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')
  const [editJson, setEditJson] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const id = String(doc._id ?? '')
  const preview = Object.entries(doc)
    .filter(([k]) => k !== '_id')
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? '{…}' : JSON.stringify(v)}`)
    .join('  ·  ')

  function startEdit() {
    // Strip _id from editable fields
    const { _id, ...rest } = doc
    void _id
    setEditJson(JSON.stringify(rest, null, 2))
    setMode('edit')
    setExpanded(true)
    setActionError(null)
  }

  async function saveEdit() {
    setActionLoading(true)
    setActionError(null)
    try {
      const parsed = JSON.parse(editJson)
      const res = await fetch(apiUrl('/api/query'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db, collection: col, id, update: parsed }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      onUpdated(id, data.doc)
      setMode('view')
    } catch (e) {
      setActionError((e as Error).message)
    }
    setActionLoading(false)
  }

  async function deleteDoc() {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(apiUrl('/api/query'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db, collection: col, id }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      onDeleted(id)
    } catch (e) {
      setActionError((e as Error).message)
      setActionLoading(false)
    }
  }

  function copyDoc() {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{
      border: `1px solid ${mode === 'edit' ? 'var(--cyan)' : mode === 'confirm-delete' ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      background: expanded ? 'rgba(0,255,65,.02)' : 'transparent',
      transition: 'border-color .15s',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer' }}
        onClick={() => { if (mode === 'view') setExpanded(e => !e) }}>
        {/* Index */}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', flexShrink: 0, width: 22, textAlign: 'right' }}>
          {index + 1}
        </span>
        {/* _id */}
        <span style={{ fontSize: '0.68rem', color: 'var(--yellow)', flexShrink: 0, fontFamily: 'monospace' }}>
          {id.length > 24 ? id.slice(0, 24) + '…' : id}
        </span>
        {/* preview fields */}
        <span style={{ flex: 1, fontSize: '0.68rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview}
        </span>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button title="Copy JSON" onClick={copyDoc}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: copied ? 'var(--green)' : 'var(--text-dim)', padding: '2px 5px' }}>
            {copied ? '✓' : '⎘'}
          </button>
          <button title="Edit" onClick={startEdit}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: mode === 'edit' ? 'var(--cyan)' : 'var(--text-dim)', padding: '2px 5px' }}>
            ✎
          </button>
          <button title="Delete" onClick={() => setMode(m => m === 'confirm-delete' ? 'view' : 'confirm-delete')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: mode === 'confirm-delete' ? 'var(--red)' : 'var(--text-dim)', padding: '2px 5px' }}>
            ✕
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '2px 2px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded: view mode */}
      {expanded && mode === 'view' && (
        <div style={{ padding: '0 10px 10px 10px', borderTop: '1px solid var(--border)' }}>
          <pre style={{ margin: 0, fontSize: '0.72rem', lineHeight: 1.7, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
            <JsonNode data={doc} depth={0} />
          </pre>
        </div>
      )}

      {/* Edit mode */}
      {mode === 'edit' && (
        <div style={{ borderTop: '1px solid var(--cyan)', padding: '10px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--cyan)', marginBottom: 6, letterSpacing: '.08em' }}>
            ✎ EDITING — _id is read-only
          </div>
          <textarea
            value={editJson}
            onChange={e => setEditJson(e.target.value)}
            rows={12}
            style={{
              width: '100%', resize: 'vertical', boxSizing: 'border-box',
              background: '#0d1117', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--green)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem',
              lineHeight: 1.6, padding: '8px 10px',
            }}
          />
          {actionError && <div style={{ color: 'var(--red)', fontSize: '0.7rem', marginTop: 4 }}>✗ {actionError}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn" style={{ fontSize: '0.7rem', padding: '5px 12px' }}
              onClick={() => { setMode('view'); setActionError(null) }}>✕ CANCEL</button>
            <button className="btn btn-cyan" style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '5px' }}
              onClick={saveEdit} disabled={actionLoading}>
              {actionLoading ? '◌ SAVING...' : '✓ SAVE CHANGES'}
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {mode === 'confirm-delete' && (
        <div style={{ borderTop: '1px solid var(--red)', padding: '8px 10px', background: 'rgba(255,0,60,.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--red)', flex: 1 }}>⚠ Delete this document?</span>
          {actionError && <span style={{ fontSize: '0.68rem', color: 'var(--red)' }}>{actionError}</span>}
          <button className="btn" style={{ fontSize: '0.7rem', padding: '4px 10px' }}
            onClick={() => setMode('view')}>CANCEL</button>
          <button className="btn btn-red" style={{ fontSize: '0.7rem', padding: '4px 10px' }}
            onClick={deleteDoc} disabled={actionLoading}>
            {actionLoading ? '◌' : '✕ DELETE'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QueryView() {
  const {
    queryDb, queryCol, queryType, queryCode, queryResults, queryError, queryElapsed,
    setQueryDb, setQueryCol, setQueryType, setQueryCode, setQueryResults,
  } = useAppStore()

  const [dbs, setDbs] = useState<string[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activePanel, setActivePanel] = useState<'editor' | 'results'>('editor')
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards')
  // local copy of results for optimistic UI updates
  const [localResults, setLocalResults] = useState<Record<string, unknown>[] | null>(null)

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(400)

  useEffect(() => {
    fetch(apiUrl('/api/databases')).then(r => r.json()).then(d => {
      const names = (d.databases ?? []).map((x: { name: string }) => x.name)
      setDbs(names)
      if (names.length && !queryDb) setQueryDb(names[0])
    })
  }, [])

  useEffect(() => {
    if (!queryDb) return
    fetch(apiUrl(`/api/collections/${queryDb}`)).then(r => r.json()).then(d => {
      const names = (d.collections ?? []).map((x: { name: string }) => x.name)
      setCols(names)
      if (names.length && !queryCol) setQueryCol(names[0])
    })
  }, [queryDb])

  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = Math.floor(entry.contentRect.height)
        if (h > 50) setEditorHeight(h)
      }
    })
    ro.observe(container)
    requestAnimationFrame(() => {
      if (container.clientHeight > 50) setEditorHeight(container.clientHeight)
    })
    return () => ro.disconnect()
  }, [])

  // sync localResults whenever store results change
  useEffect(() => {
    setLocalResults(queryResults as Record<string, unknown>[] | null)
  }, [queryResults])

  async function runQuery() {
    setLoading(true)
    const start = Date.now()
    try {
      let parsed: unknown
      try { parsed = JSON.parse(queryCode) } catch { throw new Error('Invalid JSON: ' + queryCode.slice(0, 60)) }
      const body = queryType === 'aggregate'
        ? { db: queryDb, collection: queryCol, queryType: 'aggregate', pipeline: parsed }
        : { db: queryDb, collection: queryCol, queryType: 'find', filter: parsed }
      const res = await fetch(apiUrl('/api/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setQueryResults(data.results, Date.now() - start, null)
      setActivePanel('results')
    } catch (e) {
      setQueryResults(null, null, (e as Error).message)
      setActivePanel('results')
    }
    setLoading(false)
  }

  const handleUpdated = useCallback((id: string, newDoc: Record<string, unknown>) => {
    setLocalResults(prev => prev?.map(d => String(d._id) === id ? newDoc : d) ?? prev)
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setLocalResults(prev => prev?.filter(d => String(d._id) !== id) ?? prev)
  }, [])

  const results = localResults
  const resultCount = results?.length ?? 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px', gap: 12, minHeight: 0 }}>
      {/* Header */}
      <div className="glow-green font-bold tracking-widest" style={{ fontSize: '0.9rem', flexShrink: 0 }}>// QUERY EXECUTOR</div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', letterSpacing: '.1em' }}>DB</span>
          <Select value={queryDb} onChange={setQueryDb} options={dbs} minWidth={100} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', letterSpacing: '.1em' }}>COL</span>
          <Select value={queryCol} onChange={setQueryCol} options={cols} minWidth={130} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['find', 'aggregate'] as const).map(t => (
            <button key={t} className={`btn ${queryType === t ? 'btn-green' : 'btn-cyan'}`}
              style={{ padding: '4px 12px', fontSize: '0.68rem' }}
              onClick={() => setQueryType(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {queryElapsed !== null && !loading && (
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{queryElapsed}ms</span>
          )}
          <button className="btn btn-green" style={{ padding: '6px 18px' }} onClick={runQuery} disabled={loading}>
            {loading ? '◌ RUNNING...' : '▶ EXECUTE'}
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex md:hidden gap-1" style={{ flexShrink: 0 }}>
        <button className={`btn flex-1 text-xs ${activePanel === 'editor' ? 'btn-green' : 'btn-cyan'}`}
          style={{ padding: '5px', justifyContent: 'center' }} onClick={() => setActivePanel('editor')}>✎ EDITOR</button>
        <button className={`btn flex-1 text-xs ${activePanel === 'results' ? 'btn-green' : 'btn-cyan'}`}
          style={{ padding: '5px', justifyContent: 'center' }} onClick={() => setActivePanel('results')}>
          ◑ RESULTS {results ? `(${resultCount})` : ''}
        </button>
      </div>

      {/* Panels */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>
        {/* Editor */}
        <div className={activePanel === 'results' ? 'hidden md:flex' : 'flex'}
          style={{ flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <Terminal title={queryType === 'aggregate' ? 'AGGREGATION PIPELINE' : 'QUERY FILTER'}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div ref={editorContainerRef} style={{ position: 'absolute', inset: 0, top: 36 }}>
              <MonacoEditor
                height={editorHeight}
                defaultLanguage="json"
                value={queryCode}
                onChange={v => setQueryCode(v ?? '')}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 },
                  overviewRulerBorder: false,
                  renderLineHighlight: 'gutter',
                  automaticLayout: true,
                }}
              />
            </div>
          </Terminal>
        </div>

        {/* Results */}
        <div className={activePanel === 'editor' ? 'hidden md:flex' : 'flex'}
          style={{ flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <Terminal
            title={results ? `RESULTS (${resultCount})` : queryError ? 'ERROR' : 'RESULTS'}
            accent={queryError ? 'red' : 'green'}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            contentStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '8px' }}
          >
            {queryError ? (
              <pre style={{ color: 'var(--red)', fontSize: '0.75rem', whiteSpace: 'pre-wrap', margin: 0 }}>{queryError}</pre>
            ) : results && results.length > 0 ? (
              <>
                {/* View toggle + count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{resultCount} document{resultCount !== 1 ? 's' : ''}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {(['cards', 'raw'] as const).map(m => (
                      <button key={m} onClick={() => setViewMode(m)}
                        style={{
                          padding: '2px 10px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3,
                          background: viewMode === m ? 'rgba(0,255,65,.12)' : 'transparent',
                          border: `1px solid ${viewMode === m ? 'var(--green)' : 'var(--border)'}`,
                          color: viewMode === m ? 'var(--green)' : 'var(--text-dim)',
                        }}>
                        {m === 'cards' ? '▤ CARDS' : '{ } RAW'}
                      </button>
                    ))}
                  </div>
                </div>

                {viewMode === 'cards' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {results.map((doc, i) => (
                      <DocCard
                        key={String(doc._id ?? i)}
                        doc={doc}
                        index={i}
                        db={queryDb}
                        col={queryCol}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                      />
                    ))}
                  </div>
                ) : (
                  <pre style={{ color: 'var(--text-primary)', fontSize: '0.72rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(results, null, 2)}
                  </pre>
                )}
              </>
            ) : results && results.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: 0 }}>// no documents matched</p>
            ) : (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: 0 }}>// execute a query to see results</p>
            )}
          </Terminal>
        </div>
      </div>
    </div>
  )
}

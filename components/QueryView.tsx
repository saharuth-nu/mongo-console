'use client'
import { apiUrl } from '@/lib/api'
import { useEffect, useRef, useState, useCallback } from 'react'
import Terminal from './Terminal'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import Select from './Select'
import { Play, Copy, Check, Pencil, Trash2, ChevronDown, ChevronRight, X, Save, RefreshCw } from 'lucide-react'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ─── Query text transformer — relaxed MongoDB syntax → strict JSON ────────────

function transformMongoQuery(text: string): string {
  // ObjectId("...") or ObjectId('...') → {"$oid":"..."}
  text = text.replace(/ObjectId\(\s*["']([a-f0-9]{24})["']\s*\)/gi, '{"$$oid":"$1"}')
  // ISODate("...") → {"$date":"..."}
  text = text.replace(/ISODate\(\s*["']([^"']+)["']\s*\)/gi, '{"$$date":"$1"}')
  // /pattern/flags → {"$regex":"pattern","$options":"flags"}
  text = text.replace(/\/([^/\n\\]+)\/([gimsuy]*)/g, (_, pat, flags) => {
    const escaped = pat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return flags ? `{"$$regex":"${escaped}","$$options":"${flags}"}` : `{"$$regex":"${escaped}"}`
  })
  // Unquoted object keys → quoted keys  e.g.  { name: ... } → { "name": ... }
  text = text.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')
  return text
}

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
    const rec = data as Record<string, unknown>
    // Render special BSON markers inline
    if ('$oid' in rec) return <span style={{ color: 'var(--yellow)' }}>ObjectId("<span style={{ color: '#e5c07b' }}>{String(rec['$oid'])}</span>")</span>
    if ('$date' in rec) return <span style={{ color: 'var(--cyan)' }}>ISODate("<span style={{ color: '#56b6c2' }}>{String(rec['$date'])}</span>")</span>
    if ('$numberDecimal' in rec) return <span style={{ color: 'var(--yellow)' }}>Decimal128({String(rec['$numberDecimal'])})</span>
    if ('$regex' in rec) return <span style={{ color: '#c678dd' }}>/{String(rec['$regex'])}/{rec['$options'] ? String(rec['$options']) : ''}</span>

    const entries = Object.entries(rec)
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

  // _id may be serialized as { $oid: "..." } from the server
  const rawId = doc._id
  const id = rawId && typeof rawId === 'object' && '$oid' in (rawId as Record<string, unknown>)
    ? String((rawId as Record<string, unknown>)['$oid'])
    : String(rawId ?? '')
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
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button title="Copy JSON" onClick={copyDoc}
            className={`icon-btn copy${copied ? ' copied' : ''}`}>
            {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={1.75} />}
          </button>
          <button title="Edit" onClick={startEdit}
            className={`icon-btn edit${mode === 'edit' ? ' active-edit' : ''}`}>
            <Pencil size={13} strokeWidth={1.75} />
          </button>
          <button title="Delete" onClick={() => setMode(m => m === 'confirm-delete' ? 'view' : 'confirm-delete')}
            className={`icon-btn delete${mode === 'confirm-delete' ? ' active-delete' : ''}`}>
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
          <span className="icon-btn" style={{ cursor: 'default' }}>
            {expanded ? <ChevronDown size={13} strokeWidth={2} /> : <ChevronRight size={13} strokeWidth={2} />}
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
            <button className="btn" style={{ fontSize: '0.7rem', padding: '5px 12px', gap: 5 }}
              onClick={() => { setMode('view'); setActionError(null) }}><X size={13} /> CANCEL</button>
            <button className="btn btn-cyan" style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '5px', gap: 5 }}
              onClick={saveEdit} disabled={actionLoading}>
              {actionLoading ? '◌ SAVING...' : <><Save size={13} /> SAVE CHANGES</>}
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
            {actionLoading ? '◌' : <><Trash2 size={13} /> DELETE</>}
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
  const [queryPage, setQueryPage] = useState(1)
  const [queryLimit, setQueryLimit] = useState(50)
  const [queryTotal, setQueryTotal] = useState<number | null>(null)
  // store last parsed query so page nav can re-run without re-parsing
  const lastParsedRef = useRef<unknown>(null)

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
      if (names.length) setQueryCol(names[0])
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

  async function runQuery(page = 1) {
    setLoading(true)
    const start = Date.now()
    try {
      let parsed: unknown
      if (page === 1) {
        try {
          const transformed = transformMongoQuery(queryCode)
          parsed = JSON.parse(transformed)
          lastParsedRef.current = parsed
        } catch {
          throw new Error('Invalid query syntax: ' + queryCode.slice(0, 80))
        }
      } else {
        parsed = lastParsedRef.current
      }
      setQueryPage(page)
      const body = queryType === 'aggregate'
        ? { db: queryDb, collection: queryCol, queryType: 'aggregate', pipeline: parsed, page, limit: queryLimit }
        : { db: queryDb, collection: queryCol, queryType: 'find', filter: parsed, page, limit: queryLimit }
      const res = await fetch(apiUrl('/api/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setQueryResults(data.results, Date.now() - start, null)
      setQueryTotal(data.total ?? null)
      setActivePanel('results')
    } catch (e) {
      setQueryResults(null, null, (e as Error).message)
      setQueryTotal(null)
      setActivePanel('results')
    }
    setLoading(false)
  }

  function extractId(rawId: unknown): string {
    if (rawId && typeof rawId === 'object' && '$oid' in (rawId as Record<string, unknown>))
      return String((rawId as Record<string, unknown>)['$oid'])
    return String(rawId ?? '')
  }

  const handleUpdated = useCallback((id: string, newDoc: Record<string, unknown>) => {
    setLocalResults(prev => prev?.map(d => extractId(d._id) === id ? newDoc : d) ?? prev)
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setLocalResults(prev => prev?.filter(d => extractId(d._id) !== id) ?? prev)
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
          <button className="btn btn-green" style={{ padding: '6px 18px' }} onClick={() => runQuery(1)} disabled={loading}>
            {loading ? '◌ RUNNING...' : <><Play size={13} fill="currentColor" strokeWidth={0} /> EXECUTE</>}
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
                defaultLanguage="javascript"
                value={queryCode}
                onChange={v => setQueryCode(v ?? '')}
                theme="vs-dark"
                beforeMount={monaco => {
                  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                  })
                }}
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
            title={results ? `RESULTS (${queryTotal ?? resultCount})` : queryError ? 'ERROR' : 'RESULTS'}
            accent={queryError ? 'red' : 'green'}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            contentStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '8px' }}
          >
            {queryError ? (
              <pre style={{ color: 'var(--red)', fontSize: '0.75rem', whiteSpace: 'pre-wrap', margin: 0 }}>{queryError}</pre>
            ) : results && results.length > 0 ? (
              <>
                {/* View toggle + count + pagination */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  {/* Count info */}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                    {queryTotal !== null
                      ? `${(queryPage - 1) * queryLimit + 1}–${Math.min(queryPage * queryLimit, queryTotal)} of ${queryTotal.toLocaleString()}`
                      : `${resultCount} document${resultCount !== 1 ? 's' : ''}`}
                  </span>

                  {/* Pagination controls */}
                  {queryTotal !== null && queryTotal > queryLimit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => runQuery(1)} disabled={queryPage <= 1 || loading}
                        style={{ padding: '2px 7px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', opacity: queryPage <= 1 ? .3 : 1 }}>
                        «
                      </button>
                      <button
                        onClick={() => runQuery(queryPage - 1)} disabled={queryPage <= 1 || loading}
                        style={{ padding: '2px 7px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', opacity: queryPage <= 1 ? .3 : 1 }}>
                        ‹
                      </button>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                        {queryPage} / {Math.ceil(queryTotal / queryLimit)}
                      </span>
                      <button
                        onClick={() => runQuery(queryPage + 1)} disabled={queryPage >= Math.ceil(queryTotal / queryLimit) || loading}
                        style={{ padding: '2px 7px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', opacity: queryPage >= Math.ceil(queryTotal / queryLimit) ? .3 : 1 }}>
                        ›
                      </button>
                      <button
                        onClick={() => runQuery(Math.ceil(queryTotal / queryLimit))} disabled={queryPage >= Math.ceil(queryTotal / queryLimit) || loading}
                        style={{ padding: '2px 7px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', opacity: queryPage >= Math.ceil(queryTotal / queryLimit) ? .3 : 1 }}>
                        »
                      </button>
                    </div>
                  )}

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', height: 26 }}>
                    {/* Refresh */}
                    <button onClick={() => runQuery(queryPage)} disabled={loading}
                      title="Refresh"
                      style={{ height: 26, width: 26, padding: 0, fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <RefreshCw size={11} strokeWidth={2} />
                    </button>
                    {/* Limit selector */}
                    <Select
                      value={String(queryLimit)}
                      onChange={v => setQueryLimit(Number(v))}
                      options={['20', '50', '100', '200']}
                      labels={{ '20': '20/page', '50': '50/page', '100': '100/page', '200': '200/page' }}
                      minWidth={85}
                      height={26}
                    />
                    {/* View mode */}
                    {(['cards', 'raw'] as const).map(m => (
                      <button key={m} onClick={() => setViewMode(m)}
                        style={{
                          height: 26, padding: '0 10px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: 3,
                          background: viewMode === m ? 'rgba(0,255,65,.12)' : 'transparent',
                          border: `1px solid ${viewMode === m ? 'var(--green)' : 'var(--border)'}`,
                          color: viewMode === m ? 'var(--green)' : 'var(--text-dim)',
                          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                          fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: '.05em',
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
                        key={extractId(doc._id) || i}
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

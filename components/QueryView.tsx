'use client'
import { useEffect, useRef, useState } from 'react'
import Terminal from './Terminal'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import Select from './Select'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function QueryView() {
  const {
    queryDb, queryCol, queryType, queryCode, queryResults, queryError, queryElapsed,
    setQueryDb, setQueryCol, setQueryType, setQueryCode, setQueryResults,
  } = useAppStore()

  const [dbs, setDbs] = useState<string[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activePanel, setActivePanel] = useState<'editor' | 'results'>('editor')

  // Monaco container ref for proper height
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(400)

  // Load databases on mount
  useEffect(() => {
    fetch('/api/databases').then(r => r.json()).then(d => {
      const names = (d.databases ?? []).map((x: { name: string }) => x.name)
      setDbs(names)
      if (names.length && !queryDb) setQueryDb(names[0])
    })
  }, [])

  // Load collections when db changes
  useEffect(() => {
    const db = queryDb
    if (!db) return
    fetch(`/api/collections/${db}`).then(r => r.json()).then(d => {
      const names = (d.collections ?? []).map((x: { name: string }) => x.name)
      setCols(names)
      if (names.length && !queryCol) setQueryCol(names[0])
    })
  }, [queryDb])

  // Observe editor container height and update Monaco
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
    // also fire once after paint
    requestAnimationFrame(() => {
      if (container.clientHeight > 50) setEditorHeight(container.clientHeight)
    })
    return () => ro.disconnect()
  }, [])

  async function runQuery() {
    setLoading(true)
    const start = Date.now()
    try {
      let parsed: unknown
      try { parsed = JSON.parse(queryCode) } catch { throw new Error('Invalid JSON: ' + queryCode.slice(0, 60)) }
      const body = queryType === 'aggregate'
        ? { db: queryDb, collection: queryCol, queryType: 'aggregate', pipeline: parsed }
        : { db: queryDb, collection: queryCol, queryType: 'find', filter: parsed }
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      const elapsed = Date.now() - start
      if (data.error) throw new Error(data.error)
      setQueryResults(data.results, elapsed, null)
      setActivePanel('results')
    } catch (e) {
      setQueryResults(null, null, (e as Error).message)
      setActivePanel('results')
    }
    setLoading(false)
  }

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
        <button className={`btn flex-1 text-xs ${activePanel === 'editor' ? 'btn-green' : 'btn-cyan'}`} style={{ padding: '5px', justifyContent: 'center' }} onClick={() => setActivePanel('editor')}>✎ EDITOR</button>
        <button className={`btn flex-1 text-xs ${activePanel === 'results' ? 'btn-green' : 'btn-cyan'}`} style={{ padding: '5px', justifyContent: 'center' }} onClick={() => setActivePanel('results')}>◑ RESULTS {queryResults ? `(${queryResults.length})` : ''}</button>
      </div>

      {/* Panels — take remaining height */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>
        {/* Editor panel */}
        <div
          className={activePanel === 'results' ? 'hidden md:flex' : 'flex'}
          style={{ flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}
        >
          <Terminal title={queryType === 'aggregate' ? 'AGGREGATION PIPELINE' : 'QUERY FILTER'}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Monaco container fills terminal body — position absolute to fill the p-3 padding area */}
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

        {/* Results panel */}
        <div
          className={activePanel === 'editor' ? 'hidden md:flex' : 'flex'}
          style={{ flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}
        >
          <Terminal
            title={queryResults ? `RESULTS (${queryResults.length})` : queryError ? 'ERROR' : 'RESULTS'}
            accent={queryError ? 'red' : 'green'}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            contentStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1 }}>
              {queryError ? (
                <pre style={{ color: 'var(--red)', fontSize: '0.75rem', whiteSpace: 'pre-wrap', margin: 0 }}>{queryError}</pre>
              ) : queryResults ? (
                <pre style={{ color: 'var(--text-primary)', fontSize: '0.72rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(queryResults, null, 2)}
                </pre>
              ) : (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: 0 }}>// execute a query to see results</p>
              )}
            </div>
          </Terminal>
        </div>
      </div>
    </div>
  )
}

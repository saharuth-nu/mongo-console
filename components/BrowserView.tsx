'use client'
import { useEffect, useState } from 'react'
import Terminal from './Terminal'
import { useAppStore } from '@/lib/store'

interface DbInfo { name: string; sizeOnDisk: number }
interface ColInfo { name: string; count: number; size: number }

function JsonNode({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  if (data === null) return <span style={{ color: 'var(--red)' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: 'var(--cyan)' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: 'var(--yellow)' }}>{String(data)}</span>
  if (typeof data === 'string') return <span style={{ color: '#98c379' }}>&quot;{data}&quot;</span>
  if (Array.isArray(data)) {
    if (collapsed) return <span onClick={() => setCollapsed(false)} className="cursor-pointer" style={{ color: 'var(--text-dim)' }}>[{data.length} items ▶]</span>
    return (
      <span>
        <span onClick={() => setCollapsed(true)} className="cursor-pointer" style={{ color: 'var(--text-secondary)' }}>▼ [</span>
        <div style={{ marginLeft: 16 }}>
          {data.map((v, i) => (
            <div key={i}><JsonNode data={v} depth={depth + 1} />{i < data.length - 1 && ','}</div>
          ))}
        </div>
        <span style={{ color: 'var(--text-secondary)' }}>]</span>
      </span>
    )
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (collapsed) return <span onClick={() => setCollapsed(false)} className="cursor-pointer" style={{ color: 'var(--text-dim)' }}>{'{'}{entries.length} keys ▶{'}'}</span>
    return (
      <span>
        <span onClick={() => setCollapsed(true)} className="cursor-pointer" style={{ color: 'var(--text-secondary)' }}>▼ {'{'}</span>
        <div style={{ marginLeft: 16 }}>
          {entries.map(([k, v], i) => (
            <div key={k}>
              <span style={{ color: 'var(--cyan)' }}>&quot;{k}&quot;</span>
              <span style={{ color: 'var(--text-secondary)' }}>: </span>
              <JsonNode data={v} depth={depth + 1} />
              {i < entries.length - 1 && ','}
            </div>
          ))}
        </div>
        <span style={{ color: 'var(--text-secondary)' }}>{'}'}</span>
      </span>
    )
  }
  return <span style={{ color: 'var(--text-primary)' }}>{String(data)}</span>
}

export default function BrowserView() {
  const { browserDb, browserCol, setBrowserDb, setBrowserCol } = useAppStore()
  const [dbs, setDbs] = useState<DbInfo[]>([])
  const [expandedDb, setExpandedDb] = useState<string | null>(browserDb || null)
  const [collections, setCollections] = useState<Record<string, ColInfo[]>>({})
  const [selectedCol, setSelectedCol] = useState<{ db: string; col: string } | null>(
    browserDb && browserCol ? { db: browserDb, col: browserCol } : null
  )
  const [docs, setDocs] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState<Record<string, unknown> | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/databases').then(r => r.json()).then(d => {
      const list = d.databases ?? []
      setDbs(list)
      // restore previous collection if we have one
      if (browserDb && browserCol) {
        fetch(`/api/collections/${browserDb}`).then(r => r.json()).then(cd => {
          setCollections(prev => ({ ...prev, [browserDb]: cd.collections ?? [] }))
        })
        loadDocs(browserDb, browserCol)
      }
    })
  }, [])

  async function loadCollections(db: string) {
    if (collections[db]) { setExpandedDb(db === expandedDb ? null : db); return }
    const res = await fetch(`/api/collections/${db}`)
    const data = await res.json()
    setCollections(prev => ({ ...prev, [db]: data.collections ?? [] }))
    setExpandedDb(db)
  }

  async function loadDocs(db: string, col: string, p = 1) {
    setSelectedCol({ db, col })
    setBrowserDb(db)
    setBrowserCol(col)
    setPage(p)
    setSelectedDoc(null)
    setSidebarOpen(false)
    const res = await fetch(`/api/documents/${db}/${col}?page=${p}&limit=20`)
    const data = await res.json()
    setDocs((data.docs ?? []) as Record<string, unknown>[])
    setTotal(data.total ?? 0)
  }

  const totalPages = Math.ceil(total / 20) || 1

  const sidebar = (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--bg-panel)' }}>
      <div className="px-3 py-2 text-xs font-bold tracking-widest uppercase flex items-center justify-between"
        style={{ color: 'var(--green)', borderBottom: '1px solid var(--border)' }}>
        <span>◈ DATABASES</span>
        <button className="md:hidden btn-red py-0.5 px-2 text-xs" onClick={() => setSidebarOpen(false)}>✕</button>
      </div>
      {dbs.length === 0 && (
        <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-dim)' }}>// no databases found</p>
      )}
      {dbs.map(db => (
        <div key={db.name}>
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs"
            style={{
              color: expandedDb === db.name ? 'var(--green)' : 'var(--text-secondary)',
              background: expandedDb === db.name ? 'var(--green-glow)' : 'transparent',
              transition: 'all 0.15s',
            }}
            onClick={() => loadCollections(db.name)}
          >
            <span>{expandedDb === db.name ? '▼' : '▶'}</span>
            <span className="font-medium truncate">{db.name}</span>
          </div>
          {expandedDb === db.name && collections[db.name]?.map(col => (
            <div
              key={col.name}
              className="pl-6 pr-3 py-1.5 cursor-pointer text-xs flex items-center gap-2"
              style={{
                color: selectedCol?.col === col.name && selectedCol?.db === db.name ? 'var(--cyan)' : 'var(--text-dim)',
                background: selectedCol?.col === col.name && selectedCol?.db === db.name ? 'rgba(0,212,255,0.06)' : 'transparent',
              }}
              onClick={() => loadDocs(db.name, col.name)}
            >
              <span>◎</span>
              <span className="truncate flex-1">{col.name}</span>
              <span className="flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{col.count}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full z-50 w-56 flex-shrink-0
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ borderRight: '1px solid var(--border)' }}
      >
        {sidebar}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col p-2 md:p-3 gap-2 md:gap-3 min-w-0">
        {!selectedCol ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <button
              className="md:hidden btn-green text-xs py-2 px-4"
              onClick={() => setSidebarOpen(true)}
            >
              ◈ OPEN DATABASE TREE
            </button>
            <span className="text-3xl" style={{ color: 'var(--text-dim)' }}>◉</span>
            <p className="text-xs tracking-widest text-center px-4" style={{ color: 'var(--text-dim)' }}>SELECT A COLLECTION TO BROWSE DOCUMENTS</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Mobile: open sidebar button */}
              <button className="btn btn-green md:hidden" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => setSidebarOpen(true)}>◈</button>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <span className="glow-green font-bold truncate" style={{ fontSize: '0.85rem' }}>{selectedCol.db}</span>
                <span style={{ color: 'var(--text-dim)' }}>.</span>
                <span className="glow-cyan font-bold truncate" style={{ fontSize: '0.85rem' }}>{selectedCol.col}</span>
                <span className="tag-badge yellow" style={{ flexShrink: 0 }}>{total.toLocaleString()}</span>
              </div>
              {/* Pagination */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-green" style={{ padding: '4px 10px' }} disabled={page <= 1}
                  onClick={() => loadDocs(selectedCol.db, selectedCol.col, page - 1)}>◀</button>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{page} / {totalPages}</span>
                <button className="btn btn-green" style={{ padding: '4px 10px' }} disabled={page >= totalPages}
                  onClick={() => loadDocs(selectedCol.db, selectedCol.col, page + 1)}>▶</button>
              </div>
            </div>

            {/* Doc list + detail — always side by side on desktop, stacked on mobile */}
            <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'hidden', minHeight: 0 }}>

              {/* Document list — fixed 340px on desktop, full width on mobile when no doc selected */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                flexShrink: 0,
                width: selectedDoc ? 'min(340px, 42%)' : '100%',
                transition: 'width .2s ease',
              }}>
                <Terminal title="DOCUMENTS"
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                  contentStyle={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}
                >
                  <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                    {docs.map((d, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedDoc(d === selectedDoc ? null : d)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '0.73rem',
                          borderLeft: selectedDoc === d ? '2px solid var(--green)' : '2px solid transparent',
                          background: selectedDoc === d ? 'rgba(0,255,65,0.06)' : 'transparent',
                          transition: 'all .12s',
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 6,
                          overflow: 'hidden',
                        }}
                        onMouseEnter={e => { if (selectedDoc !== d) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,65,0.03)' }}
                        onMouseLeave={e => { if (selectedDoc !== d) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>[{(page - 1) * 20 + i + 1}]</span>
                        <span style={{ color: 'var(--green)', flexShrink: 0, fontWeight: 600 }}>{String(d._id ?? '').slice(0, 18)}</span>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.68rem' }}>
                          {Object.entries(d).filter(([k]) => k !== '_id').slice(0, 2).map(([k, v]) => `${k}:${String(v).slice(0, 12)}`).join('  ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </Terminal>
              </div>

              {/* Detail panel — slide in when doc selected */}
              {selectedDoc && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, animation: 'fadeIn .15s ease' }}>
                  <Terminal title="DOCUMENT DETAIL" accent="cyan"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                    contentStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ fontSize: '0.72rem', lineHeight: 1.7, fontFamily: 'inherit' }}>
                      <JsonNode data={selectedDoc} depth={0} />
                    </div>
                  </Terminal>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

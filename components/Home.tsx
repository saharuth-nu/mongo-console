'use client'
import { apiUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Database, Layers, Terminal, Search, AlertTriangle, Settings, Zap, ZapOff, RefreshCw, ChevronRight } from 'lucide-react'

function fmt(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB'
  return bytes + ' B'
}

function StatCard({ label, value, color = 'var(--green)' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function QuickLink({ href, Icon, label, color = 'var(--green)' }: { href: string; Icon: React.ElementType; label: string; color?: string }) {
  const router = useRouter()
  return (
    <button onClick={() => router.push(href)} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
      color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem',
      transition: 'all .15s', textAlign: 'left', width: '100%',
    }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = color; el.style.color = color; el.style.background = `${color}0d` }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text-dim)'; el.style.background = 'transparent' }}
    >
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <ChevronRight size={12} style={{ opacity: 0.4 }} />
    </button>
  )
}

export default function Home() {
  const router = useRouter()
  const { activeDb, setActiveDb } = useAppStore()

  const [mongo, setMongo] = useState<{
    connected: boolean; activeServerId?: string; envServers?: { label: string }[]
    connections?: number; dbCount?: number; version?: string
  } | null>(null)
  const [es, setEs] = useState<{
    connected: boolean; node?: string
    health?: string; clusterName?: string; nodes?: number
    indices?: number; docs?: number; storeSize?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [mongoRes, esRes] = await Promise.allSettled([
      fetch(apiUrl('/api/connect')).then(r => r.json()),
      fetch(apiUrl('/api/es/connect')).then(r => r.json()),
    ])

    let mongoConnected = false
    let esConnected = false

    if (mongoRes.status === 'fulfilled') {
      const d = mongoRes.value
      mongoConnected = d.connected
      setMongo({ connected: d.connected, activeServerId: d.activeServerId, envServers: d.envServers })
      if (d.connected) {
        Promise.allSettled([
          fetch(apiUrl('/api/metrics')).then(r => r.json()),
          fetch(apiUrl('/api/databases')).then(r => r.json()),
        ]).then(([mRes, dbRes]) => {
          const m = mRes.status === 'fulfilled' ? mRes.value : {}
          const dbs = dbRes.status === 'fulfilled' ? dbRes.value : []
          setMongo(prev => prev ? {
            ...prev,
            connections: m.connections?.current,
            version: m.version,
            dbCount: Array.isArray(dbs) ? dbs.length : undefined,
          } : prev)
        })
      }
    }

    if (esRes.status === 'fulfilled') {
      const d = esRes.value
      esConnected = d.connected
      setEs({ connected: d.connected, node: d.node })
      if (d.connected) {
        fetch(apiUrl('/api/es/cluster')).then(r => r.json()).then(c => {
          setEs(prev => prev ? {
            ...prev,
            health: c.health?.status,
            clusterName: c.health?.cluster_name,
            nodes: c.health?.number_of_nodes,
            indices: c.stats?.indices?.count,
            docs: c.stats?.indices?.docs?.count,
            storeSize: c.stats?.indices?.store?.size_in_bytes,
          } : prev)
        }).catch(() => {})
      }
    }

    // Auto-select if only one is connected
    if (mongoConnected && !esConnected) setActiveDb('mongo')
    else if (esConnected && !mongoConnected) setActiveDb('es')
    else if (!mongoConnected && !esConnected) setActiveDb(null)
    // if both connected — keep existing choice or leave null (show picker)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const mongoLabel = (() => {
    if (!mongo?.activeServerId) return null
    if (mongo.activeServerId === '__manual__') return 'Manual'
    const idx = parseInt(mongo.activeServerId.replace('env_', ''))
    return mongo.envServers?.[idx]?.label ?? mongo.activeServerId
  })()

  const mongoOn = mongo?.connected === true
  const esOn = es?.connected === true
  const bothOn = mongoOn && esOn
  const healthColor: Record<string, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' }
  const esHealthColor = healthColor[es?.health ?? ''] ?? 'var(--cyan)'

  // ── Nothing connected ──────────────────────────────────────────────────────
  if (!loading && !mongoOn && !esOn) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ZapOff size={32} style={{ color: 'var(--border)' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>No database connected</div>
        <button className="btn-green text-xs py-2 px-5 flex items-center gap-2" onClick={() => router.push('/connect')}>
          <Settings size={13} /> CONNECT
        </button>
      </div>
    )
  }

  // ── Both connected, no selection yet → picker ──────────────────────────────
  if (!loading && bothOn && !activeDb) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '.15em', color: 'var(--green)', marginBottom: 4 }}>DB_CONSOLE</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>เลือก database ที่ต้องการใช้งาน</div>
        </div>

        <div style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 480 }}>
          {/* MongoDB choice */}
          <button onClick={() => { setActiveDb('mongo'); router.push('/') }}
            style={{
              flex: 1, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--green)'; el.style.background = 'rgba(0,255,65,.06)'; el.style.boxShadow = '0 0 24px rgba(0,255,65,.1)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--bg-panel)'; el.style.boxShadow = 'none' }}
          >
            <Database size={32} style={{ color: 'var(--green)' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '.1em', marginBottom: 4 }}>MONGODB</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{mongoLabel ?? 'Connected'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {mongo?.dbCount != null && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', background: 'rgba(0,255,65,.06)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px' }}>{mongo.dbCount} databases</span>}
              {mongo?.version && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', background: 'rgba(0,255,65,.06)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px' }}>v{mongo.version}</span>}
            </div>
          </button>

          {/* ES choice */}
          <button onClick={() => { setActiveDb('es'); router.push('/es/dashboard') }}
            style={{
              flex: 1, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              background: 'var(--bg-panel)', border: '1px solid rgba(0,212,255,.2)', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--cyan)'; el.style.background = 'rgba(0,212,255,.06)'; el.style.boxShadow = '0 0 24px rgba(0,212,255,.1)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,212,255,.2)'; el.style.background = 'var(--bg-panel)'; el.style.boxShadow = 'none' }}
          >
            <Zap size={32} style={{ color: 'var(--cyan)' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '.1em', marginBottom: 4 }}>ELASTICSEARCH</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{es?.node ?? 'Connected'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {es?.indices != null && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)', borderRadius: 3, padding: '2px 6px' }}>{es.indices} indices</span>}
              {es?.health && <span style={{ fontSize: '0.65rem', color: esHealthColor, background: `${esHealthColor}15`, border: `1px solid ${esHealthColor}40`, borderRadius: 3, padding: '2px 6px' }}>{es.health.toUpperCase()}</span>}
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── MongoDB dashboard ──────────────────────────────────────────────────────
  if (activeDb === 'mongo' && mongoOn) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '.15em', color: 'var(--green)', margin: 0 }}>MONGODB</h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>{mongoLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            {bothOn && (
              <button className="btn text-xs py-1 px-2" onClick={() => setActiveDb(null)} style={{ color: 'var(--text-dim)' }}>
                ⇄ SWITCH DB
              </button>
            )}
            <button className="btn-green icon-btn" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          <StatCard label="DATABASES" value={mongo?.dbCount ?? '—'} />
          <StatCard label="CONNECTIONS" value={mongo?.connections ?? '—'} />
          <StatCard label="VERSION" value={mongo?.version ?? '—'} />
        </div>

        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 8 }}>QUICK ACCESS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <QuickLink href="/browser" Icon={Database} label="DB Browser" />
          <QuickLink href="/query" Icon={Terminal} label="Query Executor" />
          <QuickLink href="/slow" Icon={AlertTriangle} label="Slow Queries" />
        </div>
      </div>
    )
  }

  // ── Elasticsearch dashboard ────────────────────────────────────────────────
  if (activeDb === 'es' && esOn) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '.15em', color: 'var(--cyan)', margin: 0 }}>ELASTICSEARCH</h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
              {es?.node}
              {es?.clusterName && <span style={{ marginLeft: 8, color: 'var(--cyan)', opacity: 0.7 }}>// {es.clusterName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bothOn && (
              <button className="btn text-xs py-1 px-2" onClick={() => setActiveDb(null)} style={{ color: 'var(--text-dim)' }}>
                ⇄ SWITCH DB
              </button>
            )}
            <button className="btn-green icon-btn" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {es?.health && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 4,
            background: `${esHealthColor}0d`, border: `1px solid ${esHealthColor}40`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: esHealthColor, boxShadow: `0 0 6px ${esHealthColor}`, flexShrink: 0 }} />
            <span style={{ color: esHealthColor, fontSize: '0.8rem', fontWeight: 700 }}>{es.health.toUpperCase()}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{es.nodes} node{es.nodes !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          <StatCard label="INDICES" value={es?.indices ?? '—'} color="var(--cyan)" />
          <StatCard label="DOCUMENTS" value={es?.docs != null ? es.docs.toLocaleString() : '—'} color="var(--cyan)" />
          <StatCard label="STORE SIZE" value={es?.storeSize != null ? fmt(es.storeSize) : '—'} color="var(--cyan)" />
        </div>

        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 8 }}>QUICK ACCESS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <QuickLink href="/es/dashboard" Icon={Zap} label="Cluster Dashboard" color="var(--cyan)" />
          <QuickLink href="/es/indices" Icon={Layers} label="Index Browser" color="var(--cyan)" />
          <QuickLink href="/es/query" Icon={Search} label="Query Console" color="var(--cyan)" />
        </div>
      </div>
    )
  }

  return null
}

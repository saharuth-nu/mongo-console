'use client'
import { apiUrl } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Database, Layers, Terminal, Search, AlertTriangle, Settings, Zap, ZapOff, RefreshCw } from 'lucide-react'

function fmt(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB'
  return bytes + ' B'
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 4, padding: '10px 14px',
    }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--green)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function ESStatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid rgba(0,212,255,.2)',
      borderRadius: 4, padding: '10px 14px',
    }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cyan)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
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
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.color = color; (e.currentTarget as HTMLButtonElement).style.background = `${color}0d` }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      {label}
    </button>
  )
}

export default function Home() {
  const router = useRouter()
  const [mongo, setMongo] = useState<{
    connected: boolean; activeServerId?: string; envServers?: { label: string }[]
    ops?: number; connections?: number; dbCount?: number; version?: string
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

    if (mongoRes.status === 'fulfilled') {
      const d = mongoRes.value
      setMongo({ connected: d.connected, activeServerId: d.activeServerId, envServers: d.envServers })

      // fetch metrics if connected
      if (d.connected) {
        fetch(apiUrl('/api/metrics')).then(r => r.json()).then(m => {
          setMongo(prev => prev ? {
            ...prev,
            ops: m.opcounters ? Object.values(m.opcounters as Record<string, number>).reduce((a, b) => a + b, 0) : undefined,
            connections: m.connections?.current,
            version: m.version,
          } : prev)
        }).catch(() => {})
        fetch(apiUrl('/api/databases')).then(r => r.json()).then(dbs => {
          setMongo(prev => prev ? { ...prev, dbCount: Array.isArray(dbs) ? dbs.length : undefined } : prev)
        }).catch(() => {})
      }
    }

    if (esRes.status === 'fulfilled') {
      const d = esRes.value
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
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const mongoLabel = (() => {
    if (!mongo) return null
    if (!mongo.activeServerId) return null
    if (mongo.activeServerId === '__manual__') return 'Manual'
    const idx = parseInt(mongo.activeServerId.replace('env_', ''))
    return mongo.envServers?.[idx]?.label ?? mongo.activeServerId
  })()

  const healthColor: Record<string, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' }
  const esHealthColor = healthColor[es?.health ?? ''] ?? 'var(--text-dim)'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '.15em', color: 'var(--green)', margin: 0 }}>
            DB_CONSOLE
          </h1>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
            DATABASE MONITOR // {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
          </div>
        </div>
        <button className="btn-green icon-btn" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── MongoDB card ── */}
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 6, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            background: 'rgba(0,255,65,.04)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Database size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '.08em' }}>MONGODB</div>
              {mongoLabel && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 1 }}>{mongoLabel}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: mongo?.connected ? 'var(--green)' : 'var(--red)',
                boxShadow: mongo?.connected ? '0 0 6px var(--green)' : 'none',
              }} />
              <span style={{ fontSize: '0.7rem', color: mongo?.connected ? 'var(--green)' : 'var(--red)' }}>
                {mongo?.connected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            {mongo?.connected ? (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <StatCard label="DATABASES" value={mongo.dbCount ?? '—'} />
                  <StatCard label="CONNECTIONS" value={mongo.connections ?? '—'} />
                  <StatCard label="VERSION" value={mongo.version ?? '—'} />
                </div>
                {/* Quick links */}
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 8 }}>QUICK ACCESS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <QuickLink href="/browser" Icon={Database} label="DB Browser" />
                  <QuickLink href="/query" Icon={Terminal} label="Query Executor" />
                  <QuickLink href="/slow" Icon={AlertTriangle} label="Slow Queries" />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <ZapOff size={24} style={{ color: 'var(--border)', marginBottom: 8 }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>Not connected</div>
                <button className="btn-green text-xs py-1.5 px-4 flex items-center gap-1 mx-auto"
                  onClick={() => router.push('/connect')}>
                  <Settings size={12} /> CONNECT
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Elasticsearch card ── */}
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid rgba(0,212,255,.2)',
          borderRadius: 6, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(0,212,255,.15)',
            background: 'rgba(0,212,255,.04)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Zap size={14} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '.08em' }}>ELASTICSEARCH</div>
              {es?.node && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 1 }}>{es.node}</div>}
            </div>
            <div className="flex items-center gap-2">
              {es?.health && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: esHealthColor,
                  boxShadow: `0 0 6px ${esHealthColor}`,
                }} />
              )}
              {!es?.health && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: es?.connected ? 'var(--cyan)' : 'var(--red)' }} />
              )}
              <span style={{ fontSize: '0.7rem', color: es?.connected ? 'var(--cyan)' : 'var(--red)' }}>
                {es?.connected ? (es.health?.toUpperCase() ?? 'ONLINE') : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            {es?.connected ? (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <ESStatCard label="INDICES" value={es.indices ?? '—'} />
                  <ESStatCard label="DOCUMENTS" value={es.docs != null ? es.docs.toLocaleString() : '—'} />
                  <ESStatCard label="NODES" value={es.nodes ?? '—'} sub={es.storeSize != null ? fmt(es.storeSize) : undefined} />
                </div>
                {/* Cluster name */}
                {es.clusterName && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 12, padding: '4px 8px', background: 'rgba(0,212,255,.04)', borderRadius: 3, border: '1px solid rgba(0,212,255,.12)' }}>
                    cluster: <span style={{ color: 'var(--cyan)' }}>{es.clusterName}</span>
                  </div>
                )}
                {/* Quick links */}
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '.08em', marginBottom: 8 }}>QUICK ACCESS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <QuickLink href="/es/dashboard" Icon={Zap} label="Cluster Dashboard" color="var(--cyan)" />
                  <QuickLink href="/es/indices" Icon={Layers} label="Index Browser" color="var(--cyan)" />
                  <QuickLink href="/es/query" Icon={Search} label="Query Console" color="var(--cyan)" />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <ZapOff size={24} style={{ color: 'rgba(0,212,255,.2)', marginBottom: 8 }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>Not connected</div>
                <button className="btn text-xs py-1.5 px-4 flex items-center gap-1 mx-auto"
                  style={{ borderColor: 'rgba(0,212,255,.3)', color: 'var(--cyan)' }}
                  onClick={() => router.push('/connect')}>
                  <Settings size={12} /> CONNECT
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

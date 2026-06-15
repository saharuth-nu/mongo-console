'use client'
import { apiUrl } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Server, Database, HardDrive, Cpu } from 'lucide-react'

function fmt(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB'
  return bytes + ' B'
}

function pct(n: number) { return n.toFixed(1) + '%' }

type Health = { status: string; cluster_name: string; number_of_nodes: number; number_of_data_nodes: number; active_shards: number; unassigned_shards: number; active_primary_shards: number }
type Stats = { indices?: { count: number; docs?: { count: number }; store?: { size_in_bytes: number } } }
type NodeStat = {
  name: string
  jvm?: { mem?: { heap_used_percent: number; heap_max_in_bytes: number; heap_used_in_bytes: number } }
  os?: { cpu?: { percent: number }; mem?: { used_percent: number } }
  fs?: { total?: { total_in_bytes: number; available_in_bytes: number } }
  indices?: { docs?: { count: number }; store?: { size_in_bytes: number } }
}

const healthColor: Record<string, string> = {
  green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)',
}

export default function EsDashboard() {
  const router = useRouter()
  const [data, setData] = useState<{ health: Health; stats: Stats; nodes: Record<string, NodeStat> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(apiUrl('/api/es/cluster'))
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(d)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (msg.includes('not connected') || msg.includes('No ES')) {
        router.push('/es/connect')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const hc = data?.health?.status ?? 'unknown'
  const hColor = healthColor[hc] ?? 'var(--text-dim)'

  const statBox = (label: string, value: string | number, sub?: string, Icon?: React.ElementType) => (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div className="flex items-center gap-2" style={{ color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: '.08em' }}>
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--green)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold tracking-widest text-sm glow-green">ES CLUSTER DASHBOARD</h2>
          {data?.health && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{data.health.cluster_name}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="btn-green icon-btn" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', padding: '12px', background: 'rgba(255,0,60,.08)', borderRadius: 4, marginBottom: 16, fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Health banner */}
          <div style={{
            background: `${hColor}0f`, border: `1px solid ${hColor}40`,
            borderRadius: 6, padding: '12px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: hColor, boxShadow: `0 0 8px ${hColor}`, flexShrink: 0 }} />
            <span style={{ color: hColor, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '.1em' }}>
              {hc.toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              {data.health.active_shards} active shards • {data.health.active_primary_shards} primary • {data.health.unassigned_shards} unassigned
            </span>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {statBox('NODES', data.health.number_of_nodes, `${data.health.number_of_data_nodes} data`, Server)}
            {statBox('INDICES', data.stats?.indices?.count ?? 0, undefined, Database)}
            {statBox('DOCUMENTS', (data.stats?.indices?.docs?.count ?? 0).toLocaleString(), undefined, Database)}
            {statBox('STORE SIZE', fmt(data.stats?.indices?.store?.size_in_bytes ?? 0), undefined, HardDrive)}
          </div>

          {/* Node stats */}
          <div className="text-xs mb-3 tracking-widest" style={{ color: 'var(--text-dim)' }}>NODE STATS</div>
          <div className="flex flex-col gap-3">
            {Object.values(data.nodes ?? {}).map((node, i) => {
              const heapPct = node.jvm?.mem?.heap_used_percent ?? 0
              const cpuPct = node.os?.cpu?.percent ?? 0
              const memPct = node.os?.mem?.used_percent ?? 0
              const fsTotal = node.fs?.total?.total_in_bytes ?? 0
              const fsAvail = node.fs?.total?.available_in_bytes ?? 0
              const fsPct = fsTotal > 0 ? ((fsTotal - fsAvail) / fsTotal) * 100 : 0

              const bar = (val: number, color: string) => (
                <div style={{ background: 'var(--bg-secondary)', height: 4, borderRadius: 2, overflow: 'hidden', flex: 1 }}>
                  <div style={{ width: `${Math.min(100, val)}%`, height: '100%', background: color, transition: 'width .3s' }} />
                </div>
              )

              return (
                <div key={i} style={{
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '14px 18px',
                }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu size={13} style={{ color: 'var(--cyan)' }} />
                    <span style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: '0.8rem' }}>{node.name}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                      {node.indices?.docs?.count?.toLocaleString()} docs • {fmt(node.indices?.store?.size_in_bytes ?? 0)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'HEAP', val: heapPct, color: heapPct > 80 ? 'var(--red)' : 'var(--green)' },
                      { label: 'CPU', val: cpuPct, color: cpuPct > 70 ? 'var(--yellow)' : 'var(--green)' },
                      { label: 'MEM', val: memPct, color: memPct > 85 ? 'var(--red)' : 'var(--cyan)' },
                      { label: 'DISK', val: fsPct, color: fsPct > 85 ? 'var(--red)' : 'var(--text-muted)' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', width: 32, flexShrink: 0 }}>{label}</span>
                        {bar(val, color)}
                        <span style={{ color, fontSize: '0.7rem', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

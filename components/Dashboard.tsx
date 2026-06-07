'use client'
import { apiUrl } from '@/lib/api'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Terminal from './Terminal'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface MetricPoint { time: string; ops: number; connections: number; mem: number }

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'G'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}
function fmtBytes(n: number): string {
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + ' GB'
  if (n >= 1048576)    return (n / 1048576).toFixed(1) + ' MB'
  if (n >= 1024)       return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0e1419', border: '1px solid var(--border)', padding: '6px 10px', fontSize: '0.7rem', borderRadius: 3, color: 'var(--green)' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: i === 0 ? 'var(--green)' : 'var(--cyan)', margin: 0 }}>
          {p.dataKey}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [history, setHistory] = useState<MetricPoint[]>([])
  const [dbs, setDbs] = useState<{ name: string; sizeOnDisk: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isAuthError, setIsAuthError] = useState(false)
  const [prevOps, setPrevOps] = useState<number | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/metrics'))
      const data = await res.json()
      if (data.error) {
        const authErr = /auth|unauthorized|not authorized|requires authentication/i.test(data.error)
        setIsAuthError(authErr)
        setError(data.error)
        return
      }
      setIsAuthError(false)
      setError(null)
      const ss = data.serverStatus
      setMetrics(ss)
      setDbs(data.databases ?? [])
      const totalOps = (ss.opcounters?.insert ?? 0) + (ss.opcounters?.query ?? 0) + (ss.opcounters?.update ?? 0) + (ss.opcounters?.delete ?? 0)
      const opsPerSec = prevOps !== null ? Math.max(0, totalOps - prevOps) : 0
      setPrevOps(totalOps)
      setHistory(h => [...h.slice(-29), {
        time: new Date().toISOString().slice(11, 19),
        ops: opsPerSec,
        connections: ss.connections?.current ?? 0,
        mem: Math.round(ss.mem?.resident ?? 0),
      }])
    } catch (e) { setError((e as Error).message) }
  }, [prevOps])

  useEffect(() => { fetchMetrics(); const id = setInterval(fetchMetrics, 5000); return () => clearInterval(id) }, [fetchMetrics])

  const ss = metrics as Record<string, Record<string, number>> | null

  if (error) return (
    <div className="flex-1 flex items-center justify-center flex-col gap-5 p-8 text-center">
      <div style={{ fontSize: '3rem', color: 'var(--red)', opacity: .3 }}>⬡</div>
      <span className="glow-red text-xl md:text-2xl font-bold tracking-wider">CONNECTION ERROR</span>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
      {isAuthError ? (
        <button className="btn btn-green mt-2" onClick={() => router.push('/connect')}>
          🔐 Enter Credentials
        </button>
      ) : (
        <a href="/connect" className="btn btn-green mt-2">⚙ Configure Connection</a>
      )}
    </div>
  )

  const statCards = [
    {
      label: 'CONNECTIONS',
      value: ss?.connections?.current ?? '—',
      sub: `${ss?.connections?.available ?? '—'} available`,
      icon: '⬡',
      accent: 'var(--green)',
    },
    {
      label: 'RESIDENT MEM',
      value: ss?.mem?.resident ? fmtBytes(Number(ss.mem.resident) * 1024 * 1024) : '—',
      sub: `virt ${ss?.mem?.virtual ? fmtBytes(Number(ss.mem.virtual) * 1024 * 1024) : '—'}`,
      icon: '◈',
      accent: 'var(--cyan)',
    },
    {
      label: 'TOTAL OPS',
      value: ss?.opcounters ? fmt(Object.values(ss.opcounters).reduce((a, b) => a + b, 0)) : '—',
      sub: 'cumulative since start',
      icon: '▶',
      accent: 'var(--green)',
    },
    {
      label: 'UPTIME',
      value: ss?.uptimeEstimate ? `${Math.floor(Number(ss.uptimeEstimate) / 3600)}h` : '—',
      sub: `${Math.floor((Number(ss?.uptimeEstimate) ?? 0) / 60) % 60}m remaining`,
      icon: '◉',
      accent: 'var(--yellow)',
    },
  ]

  return (
    <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', minHeight: 0 }} className="fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="glow-green text-base md:text-lg font-bold tracking-widest">// SYSTEM STATUS</h1>
        <span className="tag-badge green">LIVE</span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>↺ every 5s</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        {statCards.map(c => (
          <div key={c.label} className="metric-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs tracking-widest" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
              <span style={{
                color: c.accent,
                fontSize: '1.1rem',
                opacity: 1,
                textShadow: `0 0 10px ${c.accent}`,
                lineHeight: 1,
              }}>{c.icon}</span>
            </div>
            <div className="metric-value">{String(c.value)}</div>
            <div className="mt-1 text-xs truncate" style={{ color: 'var(--text-dim)' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 mb-4">
        <Terminal title="OPS / SEC" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} width={32} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="ops" stroke="var(--green)" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </Terminal>
        <Terminal title="CONNECTIONS">
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} width={32} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="connections" stroke="var(--cyan)" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </Terminal>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
        <Terminal title="OPERATION COUNTERS">
          <table className="hacker-table">
            <thead><tr><th>Operation</th><th>Count</th></tr></thead>
            <tbody>
              {ss?.opcounters && Object.entries(ss.opcounters).map(([k, v]) => (
                <tr key={k}>
                  <td><span className="tag-badge cyan">{k}</span></td>
                  <td className="glow-green font-bold">{fmt(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Terminal>
        <Terminal title="DATABASES">
          <table className="hacker-table">
            <thead><tr><th>Name</th><th>Size</th></tr></thead>
            <tbody>
              {dbs.map(db => (
                <tr key={db.name}>
                  <td style={{ color: 'var(--green)' }}>{db.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtBytes(db.sizeOnDisk ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Terminal>
      </div>
    </div>
  )
}

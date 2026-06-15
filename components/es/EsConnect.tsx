'use client'
import { apiUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Zap, ZapOff, LogOut } from 'lucide-react'

interface EnvServer { label: string; node: string }

export default function EsConnect() {
  const router = useRouter()
  const { esConnected, esNode, setEsConnected } = useAppStore()

  const [node, setNode] = useState('http://localhost:9200')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [authMode, setAuthMode] = useState<'none' | 'basic' | 'apikey'>('none')
  const [envServers, setEnvServers] = useState<EnvServer[]>([])
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/api/es/connect'))
      .then(r => r.json())
      .then(d => {
        setEsConnected(d.connected, d.node)
        setEnvServers(d.envServers ?? [])
      })
      .catch(() => {})
  }, [])

  const connect = async (opts?: { node: string; username?: string; password?: string; apiKey?: string }) => {
    setLoading(true); setStatus(null)
    try {
      const body = opts ?? {
        node,
        ...(authMode === 'basic' ? { username, password } : {}),
        ...(authMode === 'apikey' ? { apiKey } : {}),
      }
      const res = await fetch(apiUrl('/api/es/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEsConnected(true, body.node)
      setStatus({ ok: true, msg: `Connected to ${body.node}` })
      setTimeout(() => router.push('/es/dashboard'), 1000)
    } catch (e: unknown) {
      setStatus({ ok: false, msg: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  const disconnect = async () => {
    setLoading(true)
    await fetch(apiUrl('/api/es/connect'), { method: 'DELETE' })
    setEsConnected(false, null)
    setLoading(false)
    setStatus({ ok: true, msg: 'Disconnected' })
  }

  const fieldStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--green)', fontFamily: 'inherit', fontSize: '0.8rem',
    padding: '6px 10px', borderRadius: 4, width: '100%', outline: 'none',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 560 }}>
      <h2 className="glow-green font-bold tracking-widest text-sm mb-6">
        ⚡ ELASTICSEARCH CONNECTION
      </h2>

      {/* Connection status */}
      {esConnected && (
        <div style={{
          background: 'rgba(0,255,65,.06)', border: '1px solid rgba(0,255,65,.25)',
          borderRadius: 6, padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: 'var(--green)' }} />
            <span style={{ color: 'var(--green)', fontSize: '0.8rem' }}>CONNECTED</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{esNode}</span>
          </div>
          <button className="btn-red py-1 px-2 text-xs flex items-center gap-1" onClick={disconnect} disabled={loading}>
            <LogOut size={12} /> DISCONNECT
          </button>
        </div>
      )}

      {/* Env servers */}
      {envServers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>ENV SERVERS</div>
          <div className="flex flex-col gap-1">
            {envServers.map((s, i) => (
              <button key={i} className="btn py-2 px-3 text-xs flex items-center gap-2 text-left"
                onClick={() => connect({ node: s.node })} disabled={loading}>
                <Zap size={12} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                <span style={{ color: 'var(--cyan)' }}>{s.label}</span>
                <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>{s.node}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual connect */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 16 }}>
        <div className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>MANUAL CONNECTION</div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>NODE URL</label>
            <input style={fieldStyle} value={node} onChange={e => setNode(e.target.value)}
              placeholder="http://localhost:9200" />
          </div>

          {/* Auth mode */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>AUTHENTICATION</label>
            <div className="flex gap-2">
              {(['none', 'basic', 'apikey'] as const).map(m => (
                <button key={m} onClick={() => setAuthMode(m)}
                  className={`btn text-xs py-1 px-2 ${authMode === m ? 'btn-green' : ''}`}>
                  {m === 'none' ? 'NONE' : m === 'basic' ? 'BASIC AUTH' : 'API KEY'}
                </button>
              ))}
            </div>
          </div>

          {authMode === 'basic' && (
            <>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>USERNAME</label>
                <input style={fieldStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="elastic" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>PASSWORD</label>
                <input style={fieldStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </>
          )}

          {authMode === 'apikey' && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>API KEY</label>
              <input style={fieldStyle} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="base64-encoded API key" />
            </div>
          )}

          <button className="btn-green py-2 px-4 text-xs flex items-center gap-2 justify-center mt-1"
            onClick={() => connect()} disabled={loading || !node}>
            <ZapOff size={13} />
            {loading ? 'CONNECTING...' : 'CONNECT'}
          </button>
        </div>
      </div>

      {status && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 4, fontSize: '0.8rem',
          background: status.ok ? 'rgba(0,255,65,.08)' : 'rgba(255,0,60,.08)',
          border: `1px solid ${status.ok ? 'rgba(0,255,65,.3)' : 'rgba(255,0,60,.3)'}`,
          color: status.ok ? 'var(--green)' : 'var(--red)',
        }}>
          {status.msg}
        </div>
      )}
    </div>
  )
}

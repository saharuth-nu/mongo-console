'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Terminal from '@/components/Terminal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvServer { label: string; baseUri: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT: React.CSSProperties = {
  fontSize: '0.68rem', letterSpacing: '.1em',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={ACCENT}>{children}</label>
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; disabled?: boolean
}) {
  return (
    <input
      className="input-hacker"
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={type === 'password' ? 'current-password' : 'off'}
      spellCheck={false}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ─── Credential Form (shared between ENV and manual) ─────────────────────────

function CredForm({
  title,
  onConnect,
  loading,
  error,
  onCancel,
}: {
  title: string
  onConnect: (username: string, password: string) => void
  loading: boolean
  error: string | null
  onCancel?: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '.05em' }}>
        // enter credentials for <span style={{ color: 'var(--cyan)' }}>{title}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Label>Username</Label>
          <TextInput value={username} onChange={setUsername} placeholder="admin" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Label>Password</Label>
          <div style={{ display: 'flex' }}>
            <TextInput
              value={password}
              onChange={setPassword}
              type={showPass ? 'text' : 'password'}
              placeholder="password"
            />
            <button
              onClick={() => setShowPass(s => !s)}
              style={{
                padding: '0 10px', background: 'rgba(0,255,65,.05)',
                border: '1px solid var(--border)', borderLeft: 'none',
                borderRadius: '0 var(--radius) var(--radius) 0',
                color: 'var(--text-secondary)', cursor: 'pointer',
                flexShrink: 0, fontSize: '0.8rem',
              }}
            >{showPass ? '🙈' : '👁'}</button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '7px 10px', borderRadius: 'var(--radius)',
          background: 'rgba(255,0,60,.06)', border: '1px solid var(--red)',
          fontSize: '0.72rem', color: 'var(--red)',
        }}>✗ {error}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <button className="btn" style={{ padding: '8px 14px', fontSize: '0.75rem' }} onClick={onCancel}>
            ← BACK
          </button>
        )}
        <button
          className="btn btn-green"
          style={{ flex: 1, justifyContent: 'center', padding: '9px', fontSize: '0.8rem' }}
          onClick={() => onConnect(username, password)}
          disabled={loading || !username}
        >
          {loading ? <><span>◌</span> CONNECTING...</> : <>▶ CONNECT</>}
        </button>
      </div>

      <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textAlign: 'center' }}>
        🔒 Password sent to server only — never stored in browser
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const router = useRouter()

  const [envServers, setEnvServers] = useState<EnvServer[]>([])
  const [hasEnv, setHasEnv] = useState(false)
  const [connectedServers, setConnectedServers] = useState<string[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(null)

  // Which env server is selected (waiting for creds)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // Manual connect form
  const [showManual, setShowManual] = useState(false)
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('27017')
  const [authSource, setAuthSource] = useState('admin')
  const [manualUser, setManualUser] = useState('')
  const [manualPass, setManualPass] = useState('')
  const [showManualPass, setShowManualPass] = useState(false)

  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch server state on mount ───────────────────────────────────────────
  useEffect(() => {
    fetch('/api/connect').then(r => r.json()).then(d => {
      setHasEnv(d.hasEnv ?? false)
      setEnvServers(d.envServers ?? [])
      setConnectedServers(d.connectedServers ?? [])
      setActiveServerId(d.activeServerId ?? null)
      // If already connected — go to dashboard
      if (d.connected) setTimeout(() => router.push('/'), 600)
      // No env — show manual form automatically
      if (!d.hasEnv) setShowManual(true)
    })
  }, [router])

  // ── Connect env server by index ───────────────────────────────────────────
  async function connectEnvServer(idx: number, username: string, password: string) {
    const sid = `env_${idx}`
    setLoading(sid)
    setError(null)
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envIndex: idx, username, password }),
    })
    const data = await res.json()
    if (data.ok) {
      setConnectedServers(prev => [...new Set([...prev, sid])])
      setActiveServerId(sid)
      setTimeout(() => router.push('/'), 600)
    } else {
      setError(data.error)
    }
    setLoading(null)
  }

  // ── Switch to already-connected server ────────────────────────────────────
  async function switchServer(sid: string) {
    setLoading(sid)
    setError(null)
    const res = await fetch('/api/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId: sid }),
    })
    const data = await res.json()
    if (data.ok) {
      setActiveServerId(sid)
      setTimeout(() => router.push('/'), 600)
    } else if (data.needsConnect) {
      // Server restarted — need to re-enter credentials
      const idx = parseInt(sid.replace('env_', ''))
      if (!isNaN(idx)) setSelectedIdx(idx)
    }
    setLoading(null)
  }

  // ── Manual connect ────────────────────────────────────────────────────────
  async function connectManual() {
    setLoading('__manual__')
    setError(null)
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: '__manual__',
        host, port,
        username: manualUser || undefined,
        password: manualPass || undefined,
        authSource: authSource || undefined,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      setActiveServerId('__manual__')
      setTimeout(() => router.push('/'), 600)
    } else {
      setError(data.error)
    }
    setLoading(null)
  }

  const isActive = (sid: string) => activeServerId === sid
  const isConnected = (sid: string) => connectedServers.includes(sid)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-lg fade-in">

        {/* Logo */}
        <div className="text-center mb-7">
          <pre className="inline-block text-left text-xs leading-tight select-none"
            style={{ color: 'var(--green)', textShadow: '0 0 10px rgba(0,255,65,.5)', fontSize: 'clamp(7px,1.4vw,11px)' }}
          >{`███╗   ███╗ ██████╗ ███╗   ██╗ ██████╗  ██████╗
████╗ ████║██╔═══██╗████╗  ██║██╔════╝ ██╔═══██╗
██╔████╔██║██║   ██║██╔██╗ ██║██║  ███╗██║   ██║
██║╚██╔╝██║██║   ██║██║╚██╗██║██║   ██║██║   ██║
██║ ╚═╝ ██║╚██████╔╝██║ ╚████║╚██████╔╝╚██████╔╝
╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝  ╚═════╝`}</pre>
          <p className="mt-2 text-xs tracking-[.2em]" style={{ color: 'var(--text-secondary)' }}>
            SELECT CONNECTION
          </p>
        </div>

        {/* ── ENV servers ──────────────────────────────────────────────────── */}
        {hasEnv && envServers.length > 0 && (
          <Terminal title={`SERVERS (${envServers.length})`} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              {envServers.map((srv, idx) => {
                const sid = `env_${idx}`
                const active = isActive(sid)
                const connected = isConnected(sid)
                const selected = selectedIdx === idx
                const thisLoading = loading === sid

                return (
                  <div key={idx} style={{
                    border: `1px solid ${active ? 'var(--green)' : selected ? 'var(--cyan)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    background: active ? 'rgba(0,255,65,.05)' : selected ? 'rgba(0,212,255,.04)' : 'transparent',
                    overflow: 'hidden',
                    transition: 'all .15s',
                  }}>
                    {/* Server row */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: connected ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (active) return
                        if (connected) switchServer(sid)
                        else setSelectedIdx(selected ? null : idx)
                      }}
                    >
                      {/* Status dot */}
                      <span style={{
                        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                        background: active ? 'var(--green)' : connected ? 'var(--cyan)' : 'var(--border)',
                        boxShadow: active ? '0 0 7px var(--green)' : connected ? '0 0 7px var(--cyan)' : 'none',
                      }} />

                      {/* Label */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.8rem', fontWeight: 700, letterSpacing: '.04em',
                          color: active ? 'var(--green)' : 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {srv.label}
                        </div>
                        <div style={{
                          fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {srv.baseUri}
                        </div>
                      </div>

                      {/* Badges / action */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {active && <span className="tag-badge green" style={{ fontSize: '0.6rem' }}>ACTIVE</span>}
                        {connected && !active && (
                          <button
                            className="btn btn-cyan"
                            style={{ padding: '3px 10px', fontSize: '0.68rem' }}
                            onClick={e => { e.stopPropagation(); switchServer(sid) }}
                            disabled={thisLoading}
                          >
                            {thisLoading ? '◌' : '⇄'} SWITCH
                          </button>
                        )}
                        {!connected && !active && (
                          <span style={{ fontSize: '0.75rem', color: selected ? 'var(--cyan)' : 'var(--text-dim)' }}>
                            {selected ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inline credential form — expands when selected */}
                    {selected && !connected && (
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        padding: '12px 14px',
                        background: 'rgba(0,212,255,.02)',
                      }}>
                        <CredForm
                          title={srv.label}
                          onConnect={(u, p) => connectEnvServer(idx, u, p)}
                          loading={thisLoading}
                          error={error}
                          onCancel={() => { setSelectedIdx(null); setError(null) }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Manual connect toggle */}
              <button
                className="btn"
                style={{
                  border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                  padding: '8px', justifyContent: 'center', fontSize: '0.72rem',
                  color: 'var(--text-dim)', marginTop: 2,
                  background: showManual ? 'rgba(0,255,65,.04)' : 'transparent',
                  borderColor: showManual ? 'var(--border-mid)' : 'var(--border)',
                }}
                onClick={() => { setShowManual(m => !m); setSelectedIdx(null) }}
              >
                {showManual ? '▲ HIDE MANUAL CONNECT' : '+ MANUAL CONNECT'}
              </button>
            </div>
          </Terminal>
        )}

        {/* ── Manual connect form ───────────────────────────────────────────── */}
        {showManual && (
          <Terminal title="MANUAL CONNECTION" accent="cyan">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Host + Port */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label>Host</Label>
                  <TextInput value={host} onChange={setHost} placeholder="localhost" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label>Port</Label>
                  <TextInput value={port} onChange={setPort} placeholder="27017" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label>Username</Label>
                  <TextInput value={manualUser} onChange={setManualUser} placeholder="(optional)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label>Password</Label>
                  <div style={{ display: 'flex' }}>
                    <TextInput
                      value={manualPass}
                      onChange={setManualPass}
                      type={showManualPass ? 'text' : 'password'}
                      placeholder="(optional)"
                    />
                    <button onClick={() => setShowManualPass(s => !s)} style={{
                      padding: '0 10px', background: 'rgba(0,255,65,.05)',
                      border: '1px solid var(--border)', borderLeft: 'none',
                      borderRadius: '0 var(--radius) var(--radius) 0',
                      color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0,
                    }}>{showManualPass ? '🙈' : '👁'}</button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label>Auth Source</Label>
                <TextInput value={authSource} onChange={setAuthSource} placeholder="admin" />
              </div>

              {/* Preview */}
              <div style={{
                padding: '6px 10px', background: 'rgba(0,255,65,.03)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontSize: '0.67rem', color: 'var(--text-dim)', wordBreak: 'break-all',
              }}>
                mongodb://
                {manualUser && <><span style={{ color: 'var(--cyan)' }}>{manualUser}</span>:<span style={{ color: 'var(--red)' }}>{manualPass ? '●'.repeat(Math.min(manualPass.length, 8)) : '(no pass)'}</span>@</>}
                <span style={{ color: 'var(--green)' }}>{host || 'localhost'}</span>:{port || '27017'}
                {authSource && manualUser ? `?authSource=${authSource}` : ''}
              </div>

              {error && loading === '__manual__' && (
                <div style={{
                  padding: '7px 10px', borderRadius: 'var(--radius)',
                  background: 'rgba(255,0,60,.06)', border: '1px solid var(--red)',
                  fontSize: '0.72rem', color: 'var(--red)',
                }}>✗ {error}</div>
              )}

              <button
                className="btn btn-cyan w-full justify-center"
                style={{ padding: '9px', fontSize: '0.8rem' }}
                onClick={connectManual}
                disabled={loading === '__manual__'}
              >
                {loading === '__manual__' ? <><span>◌</span> CONNECTING...</> : <>▶ CONNECT</>}
              </button>
            </div>
          </Terminal>
        )}

        <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          // 🔒 passwords sent to server only — never stored in browser
        </p>
      </div>
    </div>
  )
}

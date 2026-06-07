'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/',        label: 'DASHBOARD',   icon: '◈' },
  { href: '/browser', label: 'DB BROWSER',  icon: '◉' },
  { href: '/query',   label: 'QUERY EXEC',  icon: '▶' },
  { href: '/slow',    label: 'SLOW QUERIES',icon: '⚠' },
]

interface EnvServer { label: string; baseUri: string }

export default function Navbar() {
  const path = usePathname()
  const [time, setTime] = useState('')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().replace('T', ' ').slice(0, 19))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/connect')
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected)
        // Resolve active server label
        const sid: string | null = d.activeServerId ?? null
        if (!sid) { setActiveLabel(null); return }
        if (sid === '__manual__') { setActiveLabel('MANUAL'); return }
        const servers: EnvServer[] = d.envServers ?? []
        const idx = parseInt(sid.replace('env_', ''))
        if (!isNaN(idx) && servers[idx]) {
          setActiveLabel(servers[idx].label)
        } else {
          setActiveLabel(sid)
        }
      })
      .catch(() => setConnected(false))
  }, [path])

  useEffect(() => { setMenuOpen(false) }, [path])

  const statusColor = connected === true ? 'var(--green)' : connected === false ? 'var(--red)' : 'var(--yellow)'
  const statusClass = connected === true ? 'green' : connected === false ? 'red' : 'yellow'
  const statusLabel = connected === true ? 'ONLINE' : connected === false ? 'OFFLINE' : '...'

  return (
    <nav style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 50 }}>
      <div className="flex items-center justify-between px-3 py-2 gap-2">

        {/* Logo */}
        <span className="glitch glow-green font-bold text-sm tracking-widest flex-shrink-0">
          MONGO_CONSOLE<span className="cursor-blink" />
        </span>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 mx-3">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`nav-link px-3 py-1.5 text-xs border-l-0 ${path === n.href ? 'active' : ''}`}>
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{n.icon}</span>
              [{n.label}]
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">

          {/* Active server label — desktop only */}
          {activeLabel && connected && (
            <div className="hidden lg:flex items-center gap-1.5"
              style={{
                padding: '2px 8px', borderRadius: 20,
                border: '1px solid rgba(0,212,255,.25)',
                background: 'rgba(0,212,255,.06)',
                maxWidth: 160,
              }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0, boxShadow: '0 0 5px var(--cyan)' }} />
              <span style={{
                fontSize: '0.65rem', color: 'var(--cyan)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: '.05em',
              }}>
                {activeLabel}
              </span>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className={`status-dot ${statusClass}`} />
            <span className="hidden sm:inline text-xs" style={{ color: statusColor }}>{statusLabel}</span>
          </div>

          {/* Time */}
          <span className="hidden lg:inline text-xs" style={{ color: 'var(--text-dim)' }}>{time}</span>

          {/* Connection manager */}
          <Link href="/connect" className="btn-green text-xs py-1 px-2" title="Connection Manager">⚙</Link>

          {/* Hamburger */}
          <button className="md:hidden btn-green py-1 px-2 text-xs"
            onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`nav-link text-sm py-3 px-4 border-l-0 border-b flex items-center gap-2 ${path === n.href ? 'active' : ''}`}
              style={{ borderBottomColor: 'var(--border)' }}>
              <span style={{ color: 'var(--green)', fontSize: '1.1rem', lineHeight: 1 }}>{n.icon}</span>
              <span className="tracking-widest">[{n.label}]</span>
            </Link>
          ))}
          <div className="px-4 py-2 text-xs flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className={`status-dot ${statusClass}`} />
            <span style={{ color: statusColor }}>
              {statusLabel}{activeLabel ? ` — ${activeLabel}` : ''}
            </span>
            <span className="ml-auto">{time}</span>
          </div>
        </div>
      )}
    </nav>
  )
}

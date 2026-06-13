'use client'
import { apiUrl } from '@/lib/api'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Database, Terminal, AlertTriangle, Settings, Menu, X } from 'lucide-react'

const NAV = [
  { href: '/',        label: 'DASHBOARD',    Icon: LayoutDashboard },
  { href: '/browser', label: 'DB BROWSER',   Icon: Database },
  { href: '/query',   label: 'QUERY EXEC',   Icon: Terminal },
  { href: '/slow',    label: 'SLOW QUERIES', Icon: AlertTriangle },
]

interface EnvServer { label: string; baseUri: string }

export default function Navbar() {
  const path = usePathname()
  const router = useRouter()
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
    fetch(apiUrl('/api/connect'))
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected)
        // Redirect to connect page if no connection and not already there
        if (!d.connected && path !== '/connect') {
          router.push('/connect')
          return
        }
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
      .catch(() => {
        setConnected(false)
        if (path !== '/connect') router.push('/connect')
      })
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
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={`nav-link px-3 py-1.5 text-xs border-l-0 ${path === href ? 'active' : ''}`}>
              <Icon size={13} strokeWidth={1.75} />
              [{label}]
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
          <Link href="/connect" className="btn-green py-1 px-2" title="Connection Manager">
            <Settings size={14} strokeWidth={1.75} />
          </Link>

          {/* Hamburger */}
          <button className="md:hidden btn-green py-1 px-2"
            onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            {menuOpen ? <X size={15} strokeWidth={2} /> : <Menu size={15} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={`nav-link text-sm py-3 px-4 border-l-0 border-b flex items-center gap-2 ${path === href ? 'active' : ''}`}
              style={{ borderBottomColor: 'var(--border)' }}>
              <Icon size={16} strokeWidth={1.75} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <span className="tracking-widest">[{label}]</span>
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

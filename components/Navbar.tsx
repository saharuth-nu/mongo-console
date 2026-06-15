'use client'
import { apiUrl } from '@/lib/api'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Database, Terminal, AlertTriangle, Settings, Menu, X, Search, Layers, Zap } from 'lucide-react'

const NAV_MONGO = [
  { href: '/',        label: 'DASHBOARD',    Icon: LayoutDashboard },
  { href: '/browser', label: 'DB BROWSER',   Icon: Database },
  { href: '/query',   label: 'QUERY',        Icon: Terminal },
  { href: '/slow',    label: 'SLOW QUERIES', Icon: AlertTriangle },
]

const NAV_ES = [
  { href: '/es/dashboard', label: 'CLUSTER',  Icon: LayoutDashboard },
  { href: '/es/indices',   label: 'INDICES',  Icon: Layers },
  { href: '/es/query',     label: 'QUERY',    Icon: Search },
]

export default function Navbar() {
  const path = usePathname()
  const router = useRouter()
  const [time, setTime] = useState('')
  const [mongoConnected, setMongoConnected] = useState<boolean | null>(null)
  const [esConnected, setEsConnected] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().replace('T', ' ').slice(0, 19))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const cleanPath = path.replace(/\/$/, '') || '/'

    fetch(apiUrl('/api/connect'))
      .then(r => r.json())
      .then(d => {
        setMongoConnected(d.connected)
        if (!d.connected && cleanPath !== '/' && cleanPath !== '/connect' && !cleanPath.startsWith('/es')) {
          router.push('/')
        }
      })
      .catch(() => setMongoConnected(false))

    fetch(apiUrl('/api/es/connect'))
      .then(r => r.json())
      .then(d => setEsConnected(d.connected))
      .catch(() => setEsConnected(false))
  }, [path])

  useEffect(() => { setMenuOpen(false) }, [path])

  const isES = path.startsWith('/es')

  return (
    <nav style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 50 }}>
      <div className="flex items-center justify-between px-3 py-2 gap-2">

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span className="glitch glow-green font-bold text-sm tracking-widest flex-shrink-0" style={{ cursor: 'pointer' }}>
            DB_CONSOLE<span className="cursor-blink" />
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center flex-1 mx-2" style={{ gap: 2 }}>

          {/* MongoDB section */}
          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '.1em', padding: '0 6px', flexShrink: 0 }}>MDB</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {NAV_MONGO.map(({ href, label, Icon }) => (
              <Link key={href} href={href}
                className={`nav-link px-2 py-1.5 text-xs border-l-0 ${!isES && path === href ? 'active' : ''}`}
                style={{ opacity: mongoConnected ? 1 : 0.45 }}>
                <Icon size={12} strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px', flexShrink: 0 }} />

          {/* Elasticsearch section */}
          <span style={{ fontSize: '0.6rem', color: 'var(--cyan)', opacity: 0.7, letterSpacing: '.1em', padding: '0 6px', flexShrink: 0 }}>ES</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {NAV_ES.map(({ href, label, Icon }) => (
              <Link key={href} href={href}
                className={`nav-link px-2 py-1.5 text-xs border-l-0 ${path === href ? 'active' : ''}`}
                style={{
                  opacity: esConnected ? 1 : 0.45,
                  '--nav-active-color': 'var(--cyan)',
                } as React.CSSProperties}>
                <Icon size={12} strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Status pills */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5" title="MongoDB">
              <span className={`status-dot ${mongoConnected === true ? 'green' : mongoConnected === false ? 'red' : 'yellow'}`} />
              <span className="hidden lg:inline text-xs" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>MDB</span>
            </div>
            <div className="flex items-center gap-1.5" title="Elasticsearch">
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: esConnected ? 'var(--cyan)' : 'var(--red)',
                boxShadow: esConnected ? '0 0 5px var(--cyan)' : 'none',
              }} />
              <span className="hidden lg:inline text-xs" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>ES</span>
            </div>
          </div>

          {/* Time */}
          <span className="hidden xl:inline text-xs" style={{ color: 'var(--text-dim)' }}>{time}</span>

          {/* Connect settings */}
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
          {/* MongoDB */}
          <div style={{ padding: '4px 16px', fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '.1em', borderBottom: '1px solid var(--border)' }}>
            MONGODB {mongoConnected ? '● ONLINE' : '● OFFLINE'}
          </div>
          {NAV_MONGO.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={`nav-link text-sm py-3 px-4 border-l-0 border-b flex items-center gap-2 ${!isES && path === href ? 'active' : ''}`}
              style={{ borderBottomColor: 'var(--border)', opacity: mongoConnected ? 1 : 0.5 }}>
              <Icon size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span className="tracking-widest">{label}</span>
            </Link>
          ))}
          {/* Elasticsearch */}
          <div style={{ padding: '4px 16px', fontSize: '0.6rem', color: 'var(--cyan)', opacity: 0.8, letterSpacing: '.1em', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', marginTop: 2 }}>
            ELASTICSEARCH {esConnected ? '● ONLINE' : '● OFFLINE'}
          </div>
          {NAV_ES.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={`nav-link text-sm py-3 px-4 border-l-0 border-b flex items-center gap-2 ${path === href ? 'active' : ''}`}
              style={{ borderBottomColor: 'var(--border)', color: 'var(--cyan)', opacity: esConnected ? 1 : 0.5 }}>
              <Icon size={15} strokeWidth={1.75} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
              <span className="tracking-widest">{label}</span>
            </Link>
          ))}
          <div className="px-4 py-2 text-xs flex items-center gap-2" style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}>
            <span className="ml-auto">{time}</span>
          </div>
        </div>
      )}
    </nav>
  )
}

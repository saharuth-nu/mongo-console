'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  options: string[]
  labels?: Record<string, string>
  minWidth?: number
  placeholder?: string
}

export default function Select({ value, onChange, options, labels, minWidth = 100, placeholder = '—' }: Props) {
  const label = (opt: string) => labels?.[opt] ?? opt
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter' || e.key === ' ') { setOpen(o => !o); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = options.indexOf(value)
      if (i < options.length - 1) onChange(options[i + 1])
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const i = options.indexOf(value)
      if (i > 0) onChange(options[i - 1])
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth }} onKeyDown={onKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '5px 10px',
          background: open ? 'rgba(0,255,65,.08)' : 'rgba(0,255,65,.04)',
          border: `1px solid ${open ? 'var(--border-mid)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          color: value ? 'var(--text-primary)' : 'var(--text-dim)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.75rem',
          cursor: 'pointer',
          transition: 'all .15s',
          boxShadow: open ? '0 0 0 2px rgba(0,255,65,.12)' : 'none',
          whiteSpace: 'nowrap',
          outline: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value ? label(value) : placeholder}
        </span>
        <span style={{
          color: 'var(--green)',
          fontSize: '0.65rem',
          transition: 'transform .15s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
          lineHeight: 1,
        }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--bg-panel2)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(0,255,65,.06), 0 0 20px rgba(0,255,65,.06)',
            zIndex: 9999,
            animation: 'fadeIn .12s ease',
          }}
        >
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              style={{
                padding: '7px 12px',
                fontSize: '0.75rem',
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
                color: opt === value ? 'var(--green)' : 'var(--text-primary)',
                background: opt === value ? 'rgba(0,255,65,.08)' : 'transparent',
                borderLeft: opt === value ? '2px solid var(--green)' : '2px solid transparent',
                transition: 'all .1s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (opt !== value) {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,65,.04)'
                  ;(e.currentTarget as HTMLDivElement).style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (opt !== value) {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }
              }}
            >
              <span>{label(opt)}</span>
              {opt === value && <span style={{ fontSize: '0.6rem', color: 'var(--green)' }}>✓</span>}
            </div>
          ))}
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              // no options
            </div>
          )}
        </div>
      )}
    </div>
  )
}

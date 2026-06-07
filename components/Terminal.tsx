import { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  className?: string
  accent?: 'green' | 'cyan' | 'red'
  style?: React.CSSProperties
  /** Style applied to the inner content wrapper (the div with padding) */
  contentStyle?: React.CSSProperties
}

const ACCENT_COLOR: Record<string, string> = {
  green: 'var(--green)',
  cyan:  'var(--cyan)',
  red:   'var(--red)',
}

export default function Terminal({ title, children, className = '', accent = 'green', style, contentStyle }: Props) {
  const color = ACCENT_COLOR[accent]

  return (
    <div
      className={`terminal-panel overflow-hidden ${className}`}
      style={style}
    >
      {title && (
        <div className="terminal-header">
          {/* Colored bar accent on left */}
          <span style={{
            width: 3, height: 16, borderRadius: 3,
            background: color,
            boxShadow: `0 0 8px ${color}, 0 0 3px ${color}`,
            flexShrink: 0,
            display: 'inline-block',
          }} />
          <span
            className="terminal-header-title"
            style={{ color, textShadow: `0 0 8px ${color}44` }}
          >
            {title}
          </span>
          {/* macOS-style dots */}
          <div className="win-dots">
            <span className="win-dot r" />
            <span className="win-dot y" />
            <span className="win-dot g" />
          </div>
        </div>
      )}
      <div className="p-3" style={contentStyle}>{children}</div>
    </div>
  )
}

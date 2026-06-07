'use client'
import { apiUrl } from '@/lib/api'
import { useEffect, useState } from 'react'
import Terminal from './Terminal'
import { useAppStore } from '@/lib/store'
import Select from './Select'

interface ProfileDoc {
  ns?: string
  op?: string
  millis?: number
  ts?: string
  command?: Record<string, unknown>
  planSummary?: string
  keysExamined?: number
  docsExamined?: number
  nreturned?: number
}

interface CurrentOp {
  opid?: number
  op?: string
  ns?: string
  microsecs_running?: number
  desc?: string
  active?: boolean
}

function DurationBadge({ ms }: { ms: number }) {
  if (ms >= 1000) return <span className="tag-badge red">{ms}ms</span>
  if (ms >= 200)  return <span className="tag-badge yellow">{ms}ms</span>
  return <span className="tag-badge green">{ms}ms</span>
}

export default function SlowView() {
  const { slowDb, setSlowDb } = useAppStore()
  const [dbs, setDbs] = useState<string[]>([])
  const db = slowDb
  const setDb = setSlowDb
  const [profiler, setProfiler] = useState<ProfileDoc[]>([])
  const [currentOp, setCurrentOp] = useState<CurrentOp[]>([])
  const [error, setError] = useState<string | null>(null)
  const [profilingOn, setProfilingOn] = useState(false)
  const [selected, setSelected] = useState<ProfileDoc | null>(null)

  useEffect(() => {
    fetch(apiUrl('/api/databases')).then(r => r.json()).then(d => {
      const names = (d.databases ?? []).map((x: { name: string }) => x.name)
      setDbs(names)
      if (names.length && !slowDb) setSlowDb(names[0])
    })
  }, [])

  async function load() {
    if (!db) return
    const res = await fetch(apiUrl(`/api/slow-queries?db=${db}`))
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setError(null)
    setProfiler(data.profiler ?? [])
    setCurrentOp(data.currentOp ?? [])
  }

  useEffect(() => { load() }, [db])

  async function toggleProfiling() {
    const level = profilingOn ? 0 : 1
    await fetch(apiUrl('/api/slow-queries'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db, level }),
    })
    setProfilingOn(!profilingOn)
    setTimeout(load, 500)
  }

  return (
    <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', minHeight: 0 }}>
      {/* Toolbar — wraps on mobile */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="glow-green text-base md:text-lg font-bold tracking-widest">// SLOW QUERIES</span>
        <Select value={db} onChange={setDb} options={dbs} minWidth={110} />
        <button className={`btn ${profilingOn ? 'btn-red' : 'btn-green'}`} onClick={toggleProfiling}>
          {profilingOn ? '■ STOP' : '▶ PROFILE'}
        </button>
        <button className="btn btn-cyan" onClick={load}>↺ REFRESH</button>
        {profilingOn && <span className="tag-badge green">PROFILING &gt;100ms</span>}
        {error && <span className="text-xs" style={{ color: 'var(--red)' }}>⚠ {error}</span>}
      </div>

      {/* Outer: always row — left=tables, right=detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 8, overflow: 'hidden', minHeight: 0 }}>
        {/* Left column: CURRENT OPS + SLOW QUERY LOG stacked */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minWidth: 0 }}>
          {/* Current ops — fixed height */}
          <Terminal
            title={`CURRENT OPS (${currentOp.length})`}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 220 }}
            contentStyle={{ overflow: 'auto', padding: 0 }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="hacker-table" style={{ minWidth: 480 }}>
                <thead><tr><th>OPID</th><th>OP</th><th>NAMESPACE</th><th>DURATION</th><th className="hidden md:table-cell">DESC</th></tr></thead>
                <tbody>
                  {currentOp.length === 0 ? (
                    <tr><td colSpan={5} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '12px' }}>// no active operations</td></tr>
                  ) : currentOp.map((op, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--yellow)' }}>{op.opid}</td>
                      <td><span className="tag-badge cyan">{op.op ?? '-'}</span></td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.ns ?? '-'}</td>
                      <td>{op.microsecs_running !== undefined ? <DurationBadge ms={Math.round(op.microsecs_running / 1000)} /> : '-'}</td>
                      <td className="hidden md:table-cell" style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{op.desc ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Terminal>

          {/* Profiler — takes remaining height, scrollable */}
          <Terminal
            title={`SLOW QUERY LOG (${profiler.length})`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            contentStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="hacker-table" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th className="hidden sm:table-cell">TIMESTAMP</th>
                    <th>OP</th>
                    <th>NAMESPACE</th>
                    <th>DURATION</th>
                    <th className="hidden md:table-cell">EXAMINED</th>
                    <th>RET</th>
                  </tr>
                </thead>
                <tbody>
                  {profiler.length === 0 ? (
                    <tr><td colSpan={6} style={{ color: 'var(--text-dim)', textAlign: 'center' }}>// no slow queries — enable profiling to capture them</td></tr>
                  ) : profiler.map((q, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelected(selected === q ? null : q)}
                      className="cursor-pointer"
                      style={{ background: selected === q ? 'var(--bg-hover)' : 'transparent' }}
                    >
                      <td className="hidden sm:table-cell" style={{ color: 'var(--text-dim)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                        {q.ts ? new Date(q.ts).toISOString().slice(11, 23) : '-'}
                      </td>
                      <td><span className="tag-badge cyan">{q.op ?? '-'}</span></td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.ns ?? '-'}</td>
                      <td>{q.millis !== undefined ? <DurationBadge ms={q.millis} /> : '-'}</td>
                      <td className="hidden md:table-cell" style={{ color: 'var(--yellow)' }}>{q.docsExamined ?? '-'}</td>
                      <td style={{ color: 'var(--green)' }}>{q.nreturned ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Terminal>
        </div>

        {/* Detail panel */}
        {selected && (
          <Terminal
            title="QUERY DETAIL"
            accent="cyan"
            style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            contentStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <button className="btn btn-red w-full text-xs" style={{ padding: '5px', justifyContent: 'center', flexShrink: 0 }} onClick={() => setSelected(null)}>✕ CLOSE</button>
            {/* Fixed metadata fields */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.72rem' }}>
              {[
                { label: 'NAMESPACE',     value: selected.ns },
                { label: 'OPERATION',     value: selected.op },
                { label: 'DURATION',      value: selected.millis !== undefined ? `${selected.millis}ms` : undefined },
                { label: 'PLAN',          value: selected.planSummary },
                { label: 'KEYS EXAMINED', value: selected.keysExamined },
                { label: 'DOCS EXAMINED', value: selected.docsExamined },
                { label: 'RETURNED',      value: selected.nreturned },
              ].map(r => r.value !== undefined && (
                <div key={r.label}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '.08em', marginBottom: 2 }}>{r.label}</div>
                  <div style={{ color: 'var(--text-primary)' }}>{String(r.value)}</div>
                </div>
              ))}
            </div>

            {/* COMMAND — fills remaining space */}
            {selected.command && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 4 }}>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '.08em', marginBottom: 4, flexShrink: 0 }}>COMMAND</div>
                <pre style={{
                  flex: 1,
                  overflow: 'auto',
                  color: 'var(--green)',
                  fontSize: '0.7rem',
                  lineHeight: 1.6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  background: 'rgba(0,255,65,.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '8px',
                }}>
                  {JSON.stringify(selected.command, null, 2)}
                </pre>
              </div>
            )}
          </Terminal>
        )}
      </div>
    </div>
  )
}

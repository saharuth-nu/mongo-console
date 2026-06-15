import { NextResponse } from 'next/server'
import { getESClient } from '@/lib/elastic'

export async function GET() {
  try {
    const client = getESClient()
    const stats = await client.indices.stats({ index: '_all' })
    const aliases = await client.indices.getAlias({ index: '_all' }).catch(() => ({}))

    const indices = Object.entries(stats.indices ?? {}).map(([name, data]) => {
      const s = data as Record<string, unknown>
      const primaries = s.primaries as Record<string, Record<string, number>> | undefined
      const total = s.total as Record<string, Record<string, number>> | undefined
      const aliasNames = Object.keys((aliases as Record<string, { aliases?: Record<string, unknown> }>)[name]?.aliases ?? {})
      return {
        name,
        health: (s as Record<string, string>).health ?? 'unknown',
        status: (s as Record<string, string>).status ?? 'unknown',
        docsCount: primaries?.docs?.count ?? 0,
        docsDeleted: primaries?.docs?.deleted ?? 0,
        storeSize: total?.store?.size_in_bytes ?? 0,
        primarySize: primaries?.store?.size_in_bytes ?? 0,
        aliases: aliasNames,
      }
    }).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ indices })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

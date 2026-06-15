import { NextRequest, NextResponse } from 'next/server'
import { getESClient } from '@/lib/elastic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { index, dsl, page = 1, limit = 20 } = body as {
      index: string
      dsl: Record<string, unknown>
      page?: number
      limit?: number
    }

    if (!index) return NextResponse.json({ error: 'index is required' }, { status: 400 })

    const from = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, limit))
    const size = Math.min(200, Math.max(1, limit))

    const client = getESClient()
    const start = Date.now()
    const res = await client.search({
      index,
      from,
      size,
      track_total_hits: true,
      ...dsl,
    })
    const elapsed = Date.now() - start

    const total = typeof res.hits.total === 'object' ? res.hits.total.value : res.hits.total ?? 0
    const docs = res.hits.hits.map(h => ({ _id: h._id, _index: h._index, _score: h._score, ...h._source as object }))

    return NextResponse.json({ docs, total, page, limit, elapsed, took: res.took })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

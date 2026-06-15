import { NextRequest, NextResponse } from 'next/server'
import { getESClient } from '@/lib/elastic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ index: string }> }) {
  try {
    const { index } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const from = (page - 1) * limit

    const client = getESClient()
    const res = await client.search({
      index,
      from,
      size: limit,
      query: { match_all: {} },
      track_total_hits: true,
    })

    const total = typeof res.hits.total === 'object' ? res.hits.total.value : res.hits.total ?? 0
    const docs = res.hits.hits.map(h => ({ _id: h._id, _index: h._index, ...h._source as object }))

    return NextResponse.json({ docs, total, page, limit })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

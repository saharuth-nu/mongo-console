import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'

export async function POST(req: NextRequest) {
  try {
    const { db, collection, queryType, pipeline, filter, limit = 50 } = await req.json()
    const client = await getClient()
    const col = client.db(db).collection(collection)
    let results
    if (queryType === 'aggregate') {
      results = await col.aggregate(pipeline).limit(limit).toArray()
    } else {
      results = await col.find(filter ?? {}).limit(limit).toArray()
    }
    return NextResponse.json({ results, count: results.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

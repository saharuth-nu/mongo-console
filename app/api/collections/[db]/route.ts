import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ db: string }> }) {
  try {
    const { db } = await params
    const client = await getClient()
    const collections = await client.db(db).listCollections().toArray()
    const withStats = await Promise.all(
      collections.map(async (col) => {
        try {
          const stats = await client.db(db).command({ collStats: col.name })
          return { name: col.name, count: stats.count, size: stats.size, avgObjSize: stats.avgObjSize }
        } catch {
          return { name: col.name, count: 0, size: 0, avgObjSize: 0 }
        }
      })
    )
    return NextResponse.json({ collections: withStats })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'

export async function GET(req: NextRequest, { params }: { params: Promise<{ db: string; col: string }> }) {
  try {
    const { db, col } = await params
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit
    const client = await getClient()
    const collection = client.db(db).collection(col)
    const [docs, total] = await Promise.all([
      collection.find({}).skip(skip).limit(limit).toArray(),
      collection.countDocuments(),
    ])
    return NextResponse.json({ docs, total, page, limit })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

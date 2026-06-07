import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const db = searchParams.get('db') ?? 'admin'
    const client = await getClient()
    const currentOp = await client.db('admin').command({ currentOp: 1, active: true })
    let profilerDocs: unknown[] = []
    try {
      profilerDocs = await client
        .db(db)
        .collection('system.profile')
        .find({ millis: { $gt: 100 } })
        .sort({ ts: -1 })
        .limit(50)
        .toArray()
    } catch {
      // profiling may not be enabled
    }
    return NextResponse.json({ currentOp: currentOp.inprog, profiler: profilerDocs })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { db, level } = await req.json()
    const client = await getClient()
    await client.db(db).command({ profile: level ?? 1, slowms: 100 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

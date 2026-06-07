import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'
import { ObjectId } from 'mongodb'

function toFilter(id: string) {
  try { return { _id: new ObjectId(id) } } catch { return { _id: id as unknown as ObjectId } }
}

// ─── POST — find / aggregate ──────────────────────────────────────────────────
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

// ─── PATCH — update one document ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { db, collection, id, update } = await req.json()
    if (!db || !collection || !id || !update) {
      return NextResponse.json({ error: 'db, collection, id, update are required' }, { status: 400 })
    }
    const client = await getClient()
    const col = client.db(db).collection(collection)
    const result = await col.findOneAndReplace(
      toFilter(id),
      update,
      { returnDocument: 'after' }
    )
    if (!result) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json({ ok: true, doc: result })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// ─── DELETE — delete one document ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { db, collection, id } = await req.json()
    if (!db || !collection || !id) {
      return NextResponse.json({ error: 'db, collection, id are required' }, { status: 400 })
    }
    const client = await getClient()
    const col = client.db(db).collection(collection)
    const result = await col.deleteOne(toFilter(id))
    if (result.deletedCount === 0) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

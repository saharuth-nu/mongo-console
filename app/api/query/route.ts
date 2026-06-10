import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'
import { ObjectId, Decimal128, Binary } from 'mongodb'

// ─── BSON deserialize — convert $oid/$date markers back to native types ────────

function deserializeBson(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deserializeBson)
  const rec = obj as Record<string, unknown>
  if ('$oid' in rec && typeof rec['$oid'] === 'string') {
    try { return new ObjectId(rec['$oid']) } catch { return obj }
  }
  if ('$date' in rec && typeof rec['$date'] === 'string') {
    return new Date(rec['$date'])
  }
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    result[k] = deserializeBson(v)
  }
  return result
}

// ─── Serialize MongoDB docs to plain JSON-safe objects ─────────────────────────

function serializeDoc(doc: unknown): unknown {
  if (doc === null || doc === undefined) return doc
  if (doc instanceof ObjectId) return { $oid: doc.toHexString() }
  if (doc instanceof Date) return { $date: doc.toISOString() }
  if (doc instanceof Decimal128) return { $numberDecimal: doc.toString() }
  if (doc instanceof Binary) return { $binary: doc.toString('base64') }
  if (typeof doc !== 'object') return doc
  if (Array.isArray(doc)) return doc.map(serializeDoc)
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
    result[k] = serializeDoc(v)
  }
  return result
}

function toFilter(id: string) {
  try { return { _id: new ObjectId(id) } } catch { return { _id: id as unknown as ObjectId } }
}

// ─── POST — find / aggregate ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { db, collection, queryType, pipeline, filter, limit = 50, page = 1 } = await req.json()
    const skip = (Math.max(1, page) - 1) * limit
    const client = await getClient()
    const col = client.db(db).collection(collection)
    let results: object[]
    let total: number
    if (queryType === 'aggregate') {
      const bsonPipeline = (Array.isArray(pipeline) ? pipeline : [pipeline]).map(deserializeBson) as object[]
      // Count via $count stage, then fetch page
      const countPipeline = [...bsonPipeline, { $count: '__total' }]
      const countRes = await col.aggregate(countPipeline).toArray()
      total = (countRes[0] as { __total?: number })?.__total ?? 0
      results = await col.aggregate([...bsonPipeline, { $skip: skip }, { $limit: limit }]).toArray()
    } else {
      const bsonFilter = deserializeBson(filter ?? {}) as object
      total = await col.countDocuments(bsonFilter)
      results = await col.find(bsonFilter).skip(skip).limit(limit).toArray()
    }
    return NextResponse.json({ results: serializeDoc(results), count: results.length, total, page, limit })
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
    return NextResponse.json({ ok: true, doc: serializeDoc(result) })
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

import { NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'

export async function GET() {
  try {
    const client = await getClient()
    const result = await client.db('admin').command({ listDatabases: 1 })
    return NextResponse.json({ databases: result.databases })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

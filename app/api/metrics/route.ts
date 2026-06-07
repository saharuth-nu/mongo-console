import { NextResponse } from 'next/server'
import { getClient } from '@/lib/mongo'

export async function GET() {
  try {
    const client = await getClient()
    const admin = client.db('admin')
    const [serverStatus, dbList] = await Promise.all([
      admin.command({ serverStatus: 1 }),
      admin.command({ listDatabases: 1 }),
    ])
    return NextResponse.json({ serverStatus, databases: dbList.databases })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

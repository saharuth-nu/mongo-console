import { NextRequest, NextResponse } from 'next/server'
import { getESClient } from '@/lib/elastic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ index: string }> }) {
  try {
    const { index } = await params
    const client = getESClient()
    const mapping = await client.indices.getMapping({ index })
    const settings = await client.indices.getSettings({ index })
    return NextResponse.json({ mapping, settings })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

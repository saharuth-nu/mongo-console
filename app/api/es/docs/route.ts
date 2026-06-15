import { NextRequest, NextResponse } from 'next/server'
import { getESClient } from '@/lib/elastic'

export async function PATCH(req: NextRequest) {
  try {
    const { index, id, doc } = await req.json() as { index: string; id: string; doc: Record<string, unknown> }
    if (!index || !id) return NextResponse.json({ error: 'index and id are required' }, { status: 400 })
    const client = getESClient()
    await client.update({ index, id, doc })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { index, id } = await req.json() as { index: string; id: string }
    if (!index || !id) return NextResponse.json({ error: 'index and id are required' }, { status: 400 })
    const client = getESClient()
    await client.delete({ index, id })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

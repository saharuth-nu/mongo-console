import { NextRequest, NextResponse } from 'next/server'
import { disconnectServer } from '@/lib/mongo'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params
    await disconnectServer(profileId)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

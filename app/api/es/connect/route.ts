import { NextRequest, NextResponse } from 'next/server'
import { connectES, disconnectES, isESConnected, getESNode, getEnvESServers, hasEnvES } from '@/lib/elastic'

export async function GET() {
  return NextResponse.json({
    connected: isESConnected(),
    node: getESNode(),
    envServers: getEnvESServers(),
    hasEnv: hasEnvES(),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { node, username, password, apiKey } = body as {
      node: string; username?: string; password?: string; apiKey?: string
    }
    if (!node) return NextResponse.json({ error: 'node URL is required' }, { status: 400 })
    await connectES({ node, username, password, apiKey })
    return NextResponse.json({ ok: true, node })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await disconnectES()
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

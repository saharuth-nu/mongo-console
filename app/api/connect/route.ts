import { NextRequest, NextResponse } from 'next/server'
import {
  getEnvServers, hasEnvUri,
  connectServer, setActiveServer, getActiveClient,
  getActiveServerId, isServerConnected, listConnectedServers,
  disconnectServer, disconnectAll,
  injectCredsIntoUri, buildUri,
} from '@/lib/mongo'

// ─── GET — status + env server list ──────────────────────────────────────────

export async function GET() {
  const envServers = getEnvServers()
  const activeId = getActiveServerId()

  try {
    const client = await getActiveClient()
    await client.db('admin').command({ listDatabases: 1, nameOnly: true })
    return NextResponse.json({
      connected: true,
      activeServerId: activeId,
      connectedServers: listConnectedServers(),
      envServers,            // [{ label, baseUri (no creds) }]
      hasEnv: hasEnvUri(),
    })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ''
    const needsAuth = /auth|unauthorized|not authorized|requires authentication/i.test(msg)
    return NextResponse.json({
      connected: false,
      activeServerId: activeId,
      connectedServers: listConnectedServers(),
      envServers,
      hasEnv: hasEnvUri(),
      needsAuth,
      error: msg,
    })
  }
}

// ─── POST — connect a server ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { serverId = '__manual__' } = body as { serverId?: string }

    let uri: string

    if (body.envIndex !== undefined) {
      // Connect one of the ENV URI list by index
      const servers = getEnvServers()
      const idx = Number(body.envIndex)
      if (idx < 0 || idx >= servers.length) {
        return NextResponse.json({ error: 'Invalid server index' }, { status: 400 })
      }
      const { baseUri } = servers[idx]
      const { username, password } = body as { username?: string; password?: string }
      // Inject credentials if provided
      uri = username ? injectCredsIntoUri(baseUri, username, password ?? '') : baseUri
      const sid = `env_${idx}`
      await connectServer(sid, uri)
      setActiveServer(sid)
      return NextResponse.json({ ok: true, serverId: sid })
    }

    if (body.uri) {
      uri = body.uri
    } else {
      const { host, port, username, password, authSource, tls } = body as {
        host?: string; port?: string; username?: string; password?: string
        authSource?: string; tls?: boolean
      }
      if (!host) return NextResponse.json({ error: 'Host is required' }, { status: 400 })
      uri = buildUri({ host, port, username, password, authSource, tls })
    }

    await connectServer(serverId, uri)
    setActiveServer(serverId)
    return NextResponse.json({ ok: true, serverId })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// ─── PATCH — switch active server ────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { serverId } = await req.json()
    if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 })
    if (!isServerConnected(serverId)) {
      return NextResponse.json({ error: 'Not connected — please connect first', needsConnect: true }, { status: 409 })
    }
    setActiveServer(serverId)
    return NextResponse.json({ ok: true, serverId })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// ─── DELETE — disconnect one or all servers ───────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { serverId } = body as { serverId?: string }
    if (serverId) {
      await disconnectServer(serverId)
    } else {
      await disconnectAll()
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

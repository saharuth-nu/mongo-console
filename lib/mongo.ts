import { MongoClient, MongoClientOptions } from 'mongodb'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServerEntry {
  /** Display label, e.g. "localhost:27017" */
  label: string
  /** Base URI (no credentials) */
  baseUri: string
}

export interface ClientEntry {
  uri: string          // full URI including credentials (server-side only)
  client: MongoClient
  connectedAt: Date
}

// ─── In-memory state ──────────────────────────────────────────────────────────

/** Map of serverId → connected client */
const clients = new Map<string, ClientEntry>()

/** Currently active server ID */
let activeServerId: string | null = null

// ─── ENV URI parsing ──────────────────────────────────────────────────────────

/**
 * Parse MONGODB_URI env var — supports comma-separated list:
 *   mongodb://localhost:27017/?authSource=admin,mongodb://localhost:37017/?authSource=admin
 * Optional named format (pipe-separated):
 *   Local|mongodb://localhost:27017,Production|mongodb://mongo.prod.com:27017
 */
export function getEnvServers(): ServerEntry[] {
  const raw = process.env.MONGODB_URI ?? ''
  if (!raw.trim()) return []

  return raw.split(',').map((entry, i) => {
    const trimmed = entry.trim()
    const pipeIdx = trimmed.indexOf('|')
    if (pipeIdx > 0) {
      const label = trimmed.slice(0, pipeIdx).trim()
      const baseUri = trimmed.slice(pipeIdx + 1).trim()
      return { label, baseUri }
    }
    // Auto-derive label from host:port
    try {
      const url = new URL(trimmed)
      return { label: `${url.hostname}:${url.port || 27017}`, baseUri: trimmed }
    } catch {
      return { label: `Server ${i + 1}`, baseUri: trimmed }
    }
  }).filter(s => s.baseUri)
}

/** Returns true if MONGODB_URI is set */
export function hasEnvUri(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim())
}

// ─── URI helpers ──────────────────────────────────────────────────────────────

/**
 * Inject username:password into a URI that may lack credentials.
 */
export function injectCredsIntoUri(baseUri: string, username: string, password: string): string {
  try {
    const url = new URL(baseUri)
    url.username = encodeURIComponent(username)
    url.password = encodeURIComponent(password)
    return url.toString()
  } catch {
    const proto = baseUri.startsWith('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://'
    const rest = baseUri.slice(proto.length)
    const atIdx = rest.indexOf('@')
    const hostAndRest = atIdx >= 0 ? rest.slice(atIdx + 1) : rest
    return `${proto}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostAndRest}`
  }
}

/** Build URI from form fields */
export function buildUri(opts: {
  host: string; port?: string; username?: string
  password?: string; authSource?: string; tls?: boolean
}): string {
  const { host, port = '27017', username, password, authSource, tls } = opts
  const auth = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password ?? '')}@` : ''
  const params = new URLSearchParams()
  if (authSource) params.set('authSource', authSource)
  if (tls) params.set('tls', 'true')
  const qs = params.toString() ? `?${params.toString()}` : ''
  return `mongodb://${auth}${host}:${port}${qs}`
}

// ─── Connection API ───────────────────────────────────────────────────────────

/** Connect a server and store its client. Throws on failure. */
export async function connectServer(serverId: string, uri: string): Promise<MongoClient> {
  // Close existing client for this server
  const existing = clients.get(serverId)
  if (existing) {
    try { await existing.client.close() } catch { /* ignore */ }
    clients.delete(serverId)
  }

  const opts: MongoClientOptions = { serverSelectionTimeoutMS: 5000 }
  const client = new MongoClient(uri, opts)
  await client.connect()
  // Verify auth
  await client.db('admin').command({ listDatabases: 1, nameOnly: true })

  clients.set(serverId, { uri, client, connectedAt: new Date() })
  return client
}

/** Set the active server (must already be connected) */
export function setActiveServer(id: string): void {
  if (!clients.has(id)) throw new Error(`Server "${id}" is not connected`)
  activeServerId = id
}

/** Get the currently active MongoClient */
export async function getActiveClient(): Promise<MongoClient> {
  // Auto-connect single env URI if no active server
  if (!activeServerId) {
    const servers = getEnvServers()
    if (servers.length === 1) {
      // Single URI and no credentials needed — try direct connect
      try {
        await connectServer('env_0', servers[0].baseUri)
        activeServerId = 'env_0'
      } catch { /* needs credentials */ }
    }
  }

  if (!activeServerId) throw new Error('No MongoDB connection active')
  const entry = clients.get(activeServerId)
  if (!entry) throw new Error('Connection lost — please reconnect')
  return entry.client
}

export function getActiveServerId(): string | null { return activeServerId }

export function isServerConnected(id: string): boolean { return clients.has(id) }

export function listConnectedServers(): string[] { return Array.from(clients.keys()) }

export async function disconnectServer(id: string): Promise<void> {
  const entry = clients.get(id)
  if (entry) {
    try { await entry.client.close() } catch { /* ignore */ }
    clients.delete(id)
  }
  if (activeServerId === id) activeServerId = null
}

// ─── Legacy compat ────────────────────────────────────────────────────────────

/** @deprecated */
export async function getClient(): Promise<MongoClient> { return getActiveClient() }

/** @deprecated */
export function isEnvUri(): boolean { return activeServerId?.startsWith('env_') ?? hasEnvUri() }

/** @deprecated */
export function setUri(uri: string) {
  connectServer('__manual__', uri).then(() => { activeServerId = '__manual__' }).catch(() => {})
}

/** @deprecated */
export function injectCredsIntoUri_compat(baseUri: string, u: string, p: string) {
  return injectCredsIntoUri(baseUri, u, p)
}

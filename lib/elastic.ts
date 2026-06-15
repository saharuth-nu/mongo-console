import { Client } from '@elastic/elasticsearch'

interface ESClientEntry {
  client: Client
  node: string
  connectedAt: Date
}

let activeEntry: ESClientEntry | null = null

export interface ESServerEntry {
  label: string
  node: string
}

export function getEnvESServers(): ESServerEntry[] {
  const raw = process.env.ELASTICSEARCH_URI ?? ''
  if (!raw.trim()) return []
  return raw.split(',').map((entry, i) => {
    const trimmed = entry.trim()
    const pipeIdx = trimmed.indexOf('|')
    if (pipeIdx > 0) {
      return { label: trimmed.slice(0, pipeIdx).trim(), node: trimmed.slice(pipeIdx + 1).trim() }
    }
    try {
      const url = new URL(trimmed)
      return { label: `${url.hostname}:${url.port || 9200}`, node: trimmed }
    } catch {
      return { label: `ES Server ${i + 1}`, node: trimmed }
    }
  }).filter(s => s.node)
}

export function hasEnvES(): boolean {
  return Boolean(process.env.ELASTICSEARCH_URI?.trim())
}

export async function connectES(opts: {
  node: string
  username?: string
  password?: string
  apiKey?: string
}): Promise<Client> {
  const { node, username, password, apiKey } = opts

  const auth = apiKey
    ? { apiKey }
    : username
    ? { username, password: password ?? '' }
    : undefined

  const client = new Client({
    node,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auth: auth as any,
    requestTimeout: 8000,
    ...(node.startsWith('https') ? { tls: { rejectUnauthorized: false } } : {}),
  })

  // verify connection
  await client.cluster.health()

  if (activeEntry) {
    try { await activeEntry.client.close() } catch { /* ignore */ }
  }
  activeEntry = { client, node, connectedAt: new Date() }
  return client
}

export function getESClient(): Client {
  if (!activeEntry) throw new Error('No Elasticsearch connection active')
  return activeEntry.client
}

export async function disconnectES(): Promise<void> {
  if (activeEntry) {
    try { await activeEntry.client.close() } catch { /* ignore */ }
    activeEntry = null
  }
}

export function isESConnected(): boolean { return activeEntry !== null }

export function getESNode(): string | null { return activeEntry?.node ?? null }

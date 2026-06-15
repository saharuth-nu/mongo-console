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
  username?: string
  password?: string
  apiKey?: string
}

export function getEnvESServer(): ESServerEntry | null {
  const node = process.env.ELASTICSEARCH_URI?.trim()
  if (!node) return null
  try {
    const url = new URL(node)
    const label = `${url.hostname}:${url.port || 9200}`
    return {
      label,
      node,
      username: process.env.ELASTICSEARCH_USERNAME?.trim() || undefined,
      password: process.env.ELASTICSEARCH_PASSWORD?.trim() || undefined,
      apiKey: process.env.ELASTICSEARCH_API_KEY?.trim() || undefined,
    }
  } catch {
    return { label: node, node }
  }
}

export function hasEnvES(): boolean {
  return Boolean(process.env.ELASTICSEARCH_URI?.trim())
}

// keep backward compat for places that expect array
export function getEnvESServers(): ESServerEntry[] {
  const s = getEnvESServer()
  return s ? [s] : []
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

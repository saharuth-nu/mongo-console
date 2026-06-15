import { NextResponse } from 'next/server'
import { getESClient } from '@/lib/elastic'

export async function GET() {
  try {
    const client = getESClient()
    const [health, stats, nodesInfo] = await Promise.all([
      client.cluster.health(),
      client.cluster.stats(),
      client.nodes.stats({ metric: ['jvm', 'os', 'fs', 'indices'] }),
    ])
    return NextResponse.json({ health, stats, nodes: nodesInfo.nodes })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

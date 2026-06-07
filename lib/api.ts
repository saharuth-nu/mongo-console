/**
 * Prefix all API calls with basePath so they work correctly behind a
 * reverse proxy (e.g. nginx serving the app under /db-console).
 *
 * basePath is baked into the bundle at build time via NEXT_PUBLIC_BASE_PATH.
 * In development (no env set) it defaults to "" so nothing changes.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function apiUrl(path: string): string {
  return `${BASE}${path}`
}

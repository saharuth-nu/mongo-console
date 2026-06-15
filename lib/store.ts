import { create } from 'zustand'

interface AppState {
  // Connection
  connected: boolean
  setConnected: (v: boolean) => void

  // Browser
  browserDb: string
  browserCol: string
  setBrowserDb: (v: string) => void
  setBrowserCol: (v: string) => void

  // Query
  queryDb: string
  queryCol: string
  queryType: 'find' | 'aggregate'
  queryCode: string
  queryResults: unknown[] | null
  queryError: string | null
  queryElapsed: number | null
  setQueryDb: (v: string) => void
  setQueryCol: (v: string) => void
  setQueryType: (v: 'find' | 'aggregate') => void
  setQueryCode: (v: string) => void
  setQueryResults: (results: unknown[] | null, elapsed: number | null, error: string | null) => void

  // Slow queries
  slowDb: string
  setSlowDb: (v: string) => void

  // Elasticsearch
  esConnected: boolean
  esNode: string | null
  esIndex: string
  esBrowserIndex: string
  esQuery: string
  esResults: unknown[] | null
  esError: string | null
  esElapsed: number | null
  esTotal: number | null
  setEsConnected: (v: boolean, node?: string | null) => void
  setEsIndex: (v: string) => void
  setEsBrowserIndex: (v: string) => void
  setEsQuery: (v: string) => void
  setEsResults: (results: unknown[] | null, total: number | null, elapsed: number | null, error: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Connection
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // Browser
  browserDb: '',
  browserCol: '',
  setBrowserDb: (v) => set({ browserDb: v }),
  setBrowserCol: (v) => set({ browserCol: v }),

  // Query
  queryDb: '',
  queryCol: '',
  queryType: 'find',
  queryCode: '{}',
  queryResults: null,
  queryError: null,
  queryElapsed: null,
  setQueryDb: (v) => set({ queryDb: v }),
  setQueryCol: (v) => set({ queryCol: v }),
  setQueryType: (v) => set({ queryType: v, queryCode: v === 'aggregate' ? '[\n  { "$match": {} },\n  { "$limit": 10 }\n]' : '{}' }),
  setQueryCode: (v) => set({ queryCode: v }),
  setQueryResults: (results, elapsed, error) => set({ queryResults: results, queryElapsed: elapsed, queryError: error }),

  // Slow queries
  slowDb: '',
  setSlowDb: (v) => set({ slowDb: v }),

  // Elasticsearch
  esConnected: false,
  esNode: null,
  esIndex: '',
  esBrowserIndex: '',
  esQuery: '{\n  "query": {\n    "match_all": {}\n  }\n}',
  esResults: null,
  esError: null,
  esElapsed: null,
  esTotal: null,
  setEsConnected: (v, node = null) => set({ esConnected: v, esNode: node ?? null }),
  setEsIndex: (v) => set({ esIndex: v }),
  setEsBrowserIndex: (v) => set({ esBrowserIndex: v }),
  setEsQuery: (v) => set({ esQuery: v }),
  setEsResults: (results, total, elapsed, error) => set({ esResults: results, esTotal: total, esElapsed: elapsed, esError: error }),
}))

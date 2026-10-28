import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Snapshot of the fields a deployment monitor compares between checks.
export type DeploymentSnapshot = {
  replicas: number
  ready: number
  images: string[]
}

export type MonitoredDeployment = {
  context: string
  namespace: string
  name: string
  // Null until the first check records a baseline.
  last: DeploymentSnapshot | null
  lastCheckedAt: number | null
  error: string | null
}

export const MONITOR_INTERVAL_MS = 60_000

export function monitorKey(m: { context: string; namespace: string; name: string }): string {
  return `${m.context}/${m.namespace}/${m.name}`
}

// Human-readable list of what changed between two snapshots; empty when
// nothing did.
export function diffSnapshots(prev: DeploymentSnapshot, next: DeploymentSnapshot): string[] {
  const changes: string[] = []
  if (prev.replicas !== next.replicas) changes.push(`desired pods ${prev.replicas} → ${next.replicas}`)
  if (prev.ready !== next.ready) changes.push(`ready pods ${prev.ready} → ${next.ready}`)
  const a = [...prev.images].sort().join(', ')
  const b = [...next.images].sort().join(', ')
  if (a !== b) changes.push(`image ${a || 'none'} → ${b || 'none'}`)
  return changes
}

type State = {
  monitors: MonitoredDeployment[]
  add: (context: string, namespace: string, name: string) => void
  remove: (key: string) => void
  record: (key: string, patch: Partial<Pick<MonitoredDeployment, 'last' | 'lastCheckedAt' | 'error'>>) => void
}

export const useDeploymentMonitors = create<State>()(
  persist(
    (set) => ({
      monitors: [],
      add: (context, namespace, name) =>
        set((s) => {
          const key = monitorKey({ context, namespace, name })
          if (s.monitors.some((m) => monitorKey(m) === key)) return s
          return {
            monitors: [...s.monitors, { context, namespace, name, last: null, lastCheckedAt: null, error: null }],
          }
        }),
      remove: (key) => set((s) => ({ monitors: s.monitors.filter((m) => monitorKey(m) !== key) })),
      record: (key, patch) =>
        set((s) => ({ monitors: s.monitors.map((m) => (monitorKey(m) === key ? { ...m, ...patch } : m)) })),
    }),
    { name: 'klustr.deploymentMonitors' },
  ),
)

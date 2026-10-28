import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { api } from '@/lib/api'

// Snapshot of the fields a deployment monitor compares between checks.
// The optional fields were added later; a snapshot saved before then lacks
// them, and comparisons skip a field either side is missing.
export type DeploymentSnapshot = {
  replicas: number
  ready: number
  images: string[]
  exists?: boolean
  uid?: string
  restartedAt?: string
  podRestarts?: number
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
  const wasThere = prev.exists !== false
  const isThere = next.exists !== false
  // Deletion and re-creation replace every other comparison: the pod counts
  // and images of a deleted deployment are meaningless.
  if (wasThere && !isThere) return ['deployment deleted']
  if (!wasThere && isThere) return ['deployment created again']
  if (!wasThere && !isThere) return []
  if (prev.uid && next.uid && prev.uid !== next.uid) return ['deployment deleted and created again']

  const changes: string[] = []
  if (prev.restartedAt !== undefined && next.restartedAt !== undefined && prev.restartedAt !== next.restartedAt)
    changes.push('deployment restarted (rollout restart)')
  if (prev.podRestarts !== undefined && next.podRestarts !== undefined && next.podRestarts > prev.podRestarts) {
    const n = next.podRestarts - prev.podRestarts
    changes.push(`${n} container restart${n === 1 ? '' : 's'}`)
  }
  if (prev.replicas !== next.replicas) changes.push(`desired pods ${prev.replicas} → ${next.replicas}`)
  if (prev.ready !== next.ready) changes.push(`ready pods ${prev.ready} → ${next.ready}`)
  const a = [...prev.images].sort().join(', ')
  const b = [...next.images].sort().join(', ')
  if (a !== b) changes.push(`image ${a || 'none'} → ${b || 'none'}`)
  return changes
}

export type MonitorAlert = {
  id: string
  context: string
  namespace: string
  name: string
  changes: string[]
  at: number
}

// Older alerts are dropped past this many, so the persisted list stays small.
export const MAX_ALERTS = 200

// Alerts are dropped once they are older than this.
export const ALERT_TTL_MS = 20 * 60_000

// Alerts still within ALERT_TTL_MS of now; the same array when none expired,
// so a no-op prune does not trigger a re-render or a disk write.
export function freshAlerts(alerts: MonitorAlert[], now: number): MonitorAlert[] {
  const fresh = alerts.filter((a) => now - a.at < ALERT_TTL_MS)
  return fresh.length === alerts.length ? alerts : fresh
}

type State = {
  monitors: MonitoredDeployment[]
  alerts: MonitorAlert[]
  addAlert: (alert: Omit<MonitorAlert, 'id'>) => void
  clearAlerts: (context?: string) => void
  pruneAlerts: (now: number) => void
  add: (context: string, namespace: string, name: string) => void
  remove: (key: string) => void
  record: (key: string, patch: Partial<Pick<MonitoredDeployment, 'last' | 'lastCheckedAt' | 'error'>>) => void
  // Monitor the Monitor page scrolls to and highlights, set by clicking an alert.
  focusedKey: string | null
  focus: (key: string | null) => void
}

// Saves to a file through the backend so monitors survive restarts no matter
// what happens to the webview's storage. localStorage stays as a fallback for
// the first run after upgrading, and for when the backend is not reachable.
const monitorFileStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const saved = await api.loadMonitorState()
      if (saved) return saved
    } catch {
      // fall through to localStorage
    }
    return localStorage.getItem(name)
  },
  setItem: async (name, value) => {
    // A write before the saved state has loaded would replace it with the
    // empty initial state and lose every monitor.
    if (!useDeploymentMonitors.persist.hasHydrated()) return
    localStorage.setItem(name, value)
    try {
      await api.saveMonitorState(value)
    } catch {
      // localStorage still holds it
    }
  },
  removeItem: async (name) => {
    localStorage.removeItem(name)
    try {
      await api.saveMonitorState('{}')
    } catch {
      // ignore
    }
  },
}

export const useDeploymentMonitors = create<State>()(
  persist(
    (set) => ({
      monitors: [],
      alerts: [],
      addAlert: (alert) =>
        set((s) => ({
          alerts: [{ ...alert, id: `${monitorKey(alert)}@${alert.at}` }, ...s.alerts].slice(0, MAX_ALERTS),
        })),
      pruneAlerts: (now) =>
        set((s) => {
          const alerts = freshAlerts(s.alerts, now)
          return alerts === s.alerts ? s : { alerts }
        }),
      clearAlerts: (context) =>
        set((s) => ({ alerts: context ? s.alerts.filter((a) => a.context !== context) : [] })),
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
      focusedKey: null,
      focus: (key) => set({ focusedKey: key }),
    }),
    {
      name: 'klustr.deploymentMonitors',
      storage: createJSONStorage(() => monitorFileStorage),
      // Only the configuration and history persist; the focus is per session.
      partialize: (s) => ({ monitors: s.monitors, alerts: s.alerts }),
    },
  ),
)

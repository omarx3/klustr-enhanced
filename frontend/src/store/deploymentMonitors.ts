import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { api } from '@/lib/api'

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

type State = {
  monitors: MonitoredDeployment[]
  alerts: MonitorAlert[]
  addAlert: (alert: Omit<MonitorAlert, 'id'>) => void
  clearAlerts: (context?: string) => void
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

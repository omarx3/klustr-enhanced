import { create } from 'zustand'

// The pod shells open in this window, by key. Live state only: the terminals
// and backend sessions behind them live in features/pods/podShellSessions,
// which is loaded with the Exec tab so xterm stays out of the main bundle.

export type PodShellTarget = {
  context: string
  namespace: string
  pod: string
  container: string
  shell: string
}

export type PodShellInfo = PodShellTarget & {
  key: string
  status: 'connecting' | 'running' | 'ended'
  startedAt: number
  error: string | null
}

type PodShellState = {
  shells: Record<string, PodShellInfo>
  upsert: (info: PodShellInfo) => void
  patch: (key: string, change: Partial<PodShellInfo>) => void
  remove: (key: string) => void
}

export const usePodShells = create<PodShellState>((set) => ({
  shells: {},
  upsert: (info) => set((s) => ({ shells: { ...s.shells, [info.key]: info } })),
  patch: (key, change) =>
    set((s) => {
      const current = s.shells[key]
      if (!current) return s
      return { shells: { ...s.shells, [key]: { ...current, ...change } } }
    }),
  remove: (key) =>
    set((s) => {
      if (!s.shells[key]) return s
      const shells = { ...s.shells }
      delete shells[key]
      return { shells }
    }),
}))

// One shell per container: reopening the pod's Exec tab picks it up again.
export function podShellKey(t: Pick<PodShellTarget, 'context' | 'namespace' | 'pod' | 'container'>): string {
  return [t.context, t.namespace, t.pod, t.container].join('\n')
}

// stopPodShell ends a shell from outside the Exec tab (the Overview list)
// without pulling xterm into the caller's bundle.
export function stopPodShell(key: string): Promise<void> {
  return import('@/features/pods/podShellSessions').then((m) => m.stopPodShellSession(key))
}

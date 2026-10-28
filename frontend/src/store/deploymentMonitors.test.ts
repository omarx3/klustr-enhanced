import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: { loadMonitorState: vi.fn().mockResolvedValue(''), saveMonitorState: vi.fn().mockResolvedValue(undefined) },
}))

import { diffSnapshots, MAX_ALERTS, monitorKey, useDeploymentMonitors } from './deploymentMonitors'

describe('diffSnapshots', () => {
  const base = { replicas: 3, ready: 3, images: ['nginx:1.25'] }

  it('reports nothing when unchanged, ignoring image order', () => {
    expect(diffSnapshots({ ...base, images: ['a', 'b'] }, { ...base, images: ['b', 'a'] })).toEqual([])
  })

  it('reports deletion and re-creation instead of field changes', () => {
    const live = { ...base, exists: true, uid: 'a', restartedAt: '', podRestarts: 0 }
    const gone = { replicas: 0, ready: 0, images: [], exists: false, uid: '', restartedAt: '', podRestarts: 0 }
    expect(diffSnapshots(live, gone)).toEqual(['deployment deleted'])
    expect(diffSnapshots(gone, gone)).toEqual([])
    expect(diffSnapshots(gone, live)).toEqual(['deployment created again'])
    expect(diffSnapshots(live, { ...live, uid: 'b', replicas: 9 })).toEqual(['deployment deleted and created again'])
  })

  it('reports rollout restarts and new container restarts', () => {
    const live = { ...base, exists: true, uid: 'a', restartedAt: '', podRestarts: 2 }
    expect(diffSnapshots(live, { ...live, restartedAt: '2026-10-28T18:00:00Z' })).toEqual([
      'deployment restarted (rollout restart)',
    ])
    expect(diffSnapshots(live, { ...live, podRestarts: 5 })).toEqual(['3 container restarts'])
    // Pods replaced by a rollout reset their counts; a drop is not an alert.
    expect(diffSnapshots(live, { ...live, podRestarts: 0 })).toEqual([])
  })

  it('skips the new checks against a snapshot saved before they existed', () => {
    expect(diffSnapshots(base, { ...base, exists: true, uid: 'a', restartedAt: 'x', podRestarts: 4 })).toEqual([])
  })

  it('reports pod count and image changes', () => {
    expect(diffSnapshots(base, { replicas: 5, ready: 2, images: ['nginx:1.26'] })).toEqual([
      'desired pods 3 → 5',
      'ready pods 3 → 2',
      'image nginx:1.25 → nginx:1.26',
    ])
  })
})

describe('useDeploymentMonitors', () => {
  beforeEach(() => useDeploymentMonitors.setState({ monitors: [] }))

  it('keeps newest alerts first, capped, and clears per context', () => {
    const s = useDeploymentMonitors.getState()
    useDeploymentMonitors.setState({ alerts: [] })
    for (let i = 0; i < MAX_ALERTS + 5; i++)
      s.addAlert({ context: i % 2 ? 'a' : 'b', namespace: 'ns', name: 'web', changes: ['x'], at: i })
    const alerts = useDeploymentMonitors.getState().alerts
    expect(alerts).toHaveLength(MAX_ALERTS)
    expect(alerts[0].at).toBe(MAX_ALERTS + 4)
    s.clearAlerts('a')
    expect(useDeploymentMonitors.getState().alerts.every((a) => a.context === 'b')).toBe(true)
    s.clearAlerts()
    expect(useDeploymentMonitors.getState().alerts).toEqual([])
  })

  it('adds once, records and removes', () => {
    const s = useDeploymentMonitors.getState()
    s.add('ctx', 'ns', 'web')
    s.add('ctx', 'ns', 'web')
    expect(useDeploymentMonitors.getState().monitors).toHaveLength(1)
    const key = monitorKey({ context: 'ctx', namespace: 'ns', name: 'web' })
    s.record(key, { last: { replicas: 1, ready: 1, images: [] }, lastCheckedAt: 1 })
    expect(useDeploymentMonitors.getState().monitors[0].last?.replicas).toBe(1)
    s.remove(key)
    expect(useDeploymentMonitors.getState().monitors).toEqual([])
  })
})

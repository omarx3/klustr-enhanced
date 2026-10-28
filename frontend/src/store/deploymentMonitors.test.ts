import { describe, expect, it, beforeEach } from 'vitest'
import { diffSnapshots, monitorKey, useDeploymentMonitors } from './deploymentMonitors'

describe('diffSnapshots', () => {
  const base = { replicas: 3, ready: 3, images: ['nginx:1.25'] }

  it('reports nothing when unchanged, ignoring image order', () => {
    expect(diffSnapshots({ ...base, images: ['a', 'b'] }, { ...base, images: ['b', 'a'] })).toEqual([])
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

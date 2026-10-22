import { describe, expect, it } from 'vitest'
import type { ContainerDetail, PodDetail } from '@/lib/api'
import { podDiagnosis } from './podDiagnosis'

function ctr(o: Partial<ContainerDetail>): ContainerDetail {
  return {
    name: 'app',
    image: 'app:1.0',
    state: 'Running',
    stateReason: '',
    ready: true,
    restartCount: 0,
    startedAt: '',
    lastState: '',
    ports: [],
    env: [],
    envFrom: [],
    ...o,
  } as unknown as ContainerDetail
}

function pod(o: Partial<PodDetail>): PodDetail {
  return {
    phase: 'Running',
    conditions: [],
    initContainers: [],
    containers: [],
    ...o,
  } as unknown as PodDetail
}

describe('podDiagnosis', () => {
  it('returns nothing for a healthy running pod', () => {
    expect(podDiagnosis(pod({ containers: [ctr({})] }))).toEqual([])
  })

  it('ignores transient startup waiting states', () => {
    const containers = [ctr({ state: 'Waiting', stateReason: 'ContainerCreating', ready: false })]
    expect(podDiagnosis(pod({ containers }))).toEqual([])
  })

  it('flags CrashLoopBackOff as an error with the last exit', () => {
    const containers = [ctr({ state: 'Waiting', stateReason: 'CrashLoopBackOff', ready: false, restartCount: 7, lastState: 'Error' })]
    const [issue] = podDiagnosis(pod({ containers }))
    expect(issue.severity).toBe('error')
    expect(issue.title).toContain('CrashLoopBackOff')
    expect(issue.detail).toContain('7 times')
    expect(issue.detail).toContain('Error')
  })

  it('flags an OOMKilled terminated container', () => {
    const containers = [ctr({ state: 'Terminated', stateReason: 'OOMKilled', ready: false })]
    const [issue] = podDiagnosis(pod({ containers }))
    expect(issue.severity).toBe('error')
    expect(issue.title).toContain('OOMKilled')
    expect(issue.detail).toContain('memory limit')
  })

  it('flags an image pull failure with the image name', () => {
    const containers = [ctr({ state: 'Waiting', stateReason: 'ImagePullBackOff', ready: false, image: 'ghcr.io/x/y:bad' })]
    const [issue] = podDiagnosis(pod({ containers }))
    expect(issue.severity).toBe('error')
    expect(issue.detail).toContain('ghcr.io/x/y:bad')
  })

  it('flags an unschedulable pending pod with the scheduler message', () => {
    const detail = pod({
      phase: 'Pending',
      conditions: [
        { type: 'PodScheduled', status: 'False', reason: 'Unschedulable', message: '0/5 nodes are available: insufficient cpu.' },
      ],
      containers: [ctr({ state: 'Waiting', stateReason: 'ContainerCreating', ready: false })],
    } as unknown as Partial<PodDetail>)
    const issues = podDiagnosis(detail)
    expect(issues).toHaveLength(1)
    expect(issues[0].title).toContain('not scheduled')
    expect(issues[0].detail).toContain('insufficient cpu')
  })

  it('warns about a running container that was previously OOMKilled', () => {
    const containers = [ctr({ state: 'Running', restartCount: 3, lastState: 'OOMKilled' })]
    const [issue] = podDiagnosis(pod({ containers }))
    expect(issue.severity).toBe('warning')
    expect(issue.title).toContain('previously OOMKilled')
  })

  it('warns about a running container with a high restart count', () => {
    const containers = [ctr({ state: 'Running', restartCount: 9, lastState: 'Error' })]
    const [issue] = podDiagnosis(pod({ containers }))
    expect(issue.severity).toBe('warning')
    expect(issue.title).toContain('9 restarts')
  })

  it('does not warn about a low restart count', () => {
    expect(podDiagnosis(pod({ containers: [ctr({ restartCount: 2 })] }))).toEqual([])
  })

  it('diagnoses init containers too', () => {
    const initContainers = [ctr({ name: 'migrate', state: 'Waiting', stateReason: 'CrashLoopBackOff', ready: false, restartCount: 2 })]
    const [issue] = podDiagnosis(pod({ initContainers }))
    expect(issue.title).toContain('migrate')
    expect(issue.detail).toContain('init container')
  })
})

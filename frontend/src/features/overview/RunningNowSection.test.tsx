import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  listJobs: vi.fn(),
  podsForOwner: vi.fn(),
  stopExec: vi.fn(() => Promise.resolve()),
}))

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({
  api: { listJobs: mocks.listJobs, podsForOwner: mocks.podsForOwner, stopExec: mocks.stopExec },
}))
vi.mock('@/lib/events', () => ({ onKubeChange: () => () => {} }))
vi.mock('@/features/pods/podShellSessions', () => ({
  stopPodShellSession: (key: string) => {
    mocks.stopExec()
    return import('@/store/podShells').then((m) => m.usePodShells.getState().remove(key))
  },
}))

import { podShellKey, usePodShells } from '@/store/podShells'
import { useUIStore } from '@/store/ui'
import { RunningNowSection } from './RunningNowSection'

let container: HTMLDivElement
let root: Root
const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })

const job = (name: string, status: string) => ({
  name,
  namespace: 'batch',
  completions: '0/1',
  duration: '',
  startTime: '2026-10-22T10:00:00Z',
  status,
  createdAt: '2026-10-22T10:00:00Z',
})

const shell = {
  context: 'kind-a',
  namespace: 'default',
  pod: 'web-1',
  container: 'app',
  shell: '/bin/sh',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listJobs.mockResolvedValue([job('migrate', 'Running'), job('done', 'Complete')])
  mocks.podsForOwner.mockResolvedValue([
    { name: 'migrate-old', namespace: 'batch', status: 'Failed', createdAt: '2026-10-22T10:00:00Z' },
    { name: 'migrate-new', namespace: 'batch', status: 'Running', createdAt: '2026-10-22T10:05:00Z' },
  ])
  usePodShells.setState({
    shells: { [podShellKey(shell)]: { ...shell, key: podShellKey(shell), status: 'running', startedAt: Date.now(), error: null } },
  })
  useUIStore.setState({
    selectedContext: 'kind-b',
    aggregatedContexts: [],
    selectedView: 'overview',
    selectedCRDKey: null,
    openTabs: [{ kind: 'view', view: 'overview' }],
    selectedResource: null,
    detailDirty: false,
    pendingDetailNavigation: null,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(contexts: string[] = ['kind-a']) {
  act(() => root.render(<RunningNowSection activeContexts={contexts} />))
  await flush()
}

const rowByLabel = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!

describe('RunningNowSection', () => {
  it('lists the shells of its own cluster and only running jobs', async () => {
    await render()
    expect(container.textContent).toContain('Shells: 1')
    expect(container.textContent).toContain('web-1')
    expect(container.textContent).toContain('Running jobs: 1')
    expect(container.textContent).toContain('migrate')
    expect(container.textContent).not.toContain('done')
    expect(mocks.listJobs).toHaveBeenCalledWith('kind-a', '')
  })

  it("another cluster's Overview does not list the shell", async () => {
    await render(['kind-b'])
    expect(container.textContent).toContain('Shells: 0')
    expect(container.textContent).not.toContain('web-1')
    // The shell keeps running in the background all the same.
    expect(Object.keys(usePodShells.getState().shells)).toHaveLength(1)
  })

  it('a shell entry opens the pod on the Exec tab', async () => {
    useUIStore.setState({ selectedContext: 'kind-a' })
    await render()
    act(() => rowByLabel('Open shell in web-1').click())
    const s = useUIStore.getState()
    expect(s.selectedContext).toBe('kind-a')
    expect(s.selectedView).toBe('pods')
    expect(s.selectedResource).toMatchObject({ kind: 'Pod', name: 'web-1', namespace: 'default', context: 'kind-a' })
    expect(s.requestedTab).toBe('exec')
  })

  it('a job entry opens the running pod the job launched', async () => {
    await render()
    act(() => rowByLabel('Open pod of job migrate').click())
    await flush()
    expect(mocks.podsForOwner).toHaveBeenCalledWith('kind-a', 'Job', 'batch', 'migrate')
    const s = useUIStore.getState()
    expect(s.selectedView).toBe('pods')
    expect(s.selectedResource).toMatchObject({ kind: 'Pod', name: 'migrate-new', context: 'kind-a' })
    expect(s.requestedTab).toBe('logs')
  })

  it('a job without pods opens the job', async () => {
    mocks.podsForOwner.mockResolvedValue([])
    await render()
    act(() => rowByLabel('Open pod of job migrate').click())
    await flush()
    expect(useUIStore.getState().selectedResource).toMatchObject({ kind: 'Job', name: 'migrate' })
  })

  it('the stop button ends the shell without navigating', async () => {
    await render()
    act(() => rowByLabel('Stop shell in web-1').click())
    await flush()
    expect(mocks.stopExec).toHaveBeenCalled()
    expect(usePodShells.getState().shells).toEqual({})
    expect(useUIStore.getState().selectedView).toBe('overview')
  })
})

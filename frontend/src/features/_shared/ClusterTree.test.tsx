import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextInfo } from '@/lib/api'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({ contexts: [] as unknown[] }))

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({
  api: { listContexts: () => Promise.resolve({ contexts: mocks.contexts }) },
}))
vi.mock('@/lib/events', () => ({ onKubeChange: () => () => {} }))

import { useUIStore } from '@/store/ui'
import { EXPANDED_CLUSTERS_KEY, FAVOURITE_CLUSTERS_KEY } from '@/store/ui.persistence'
import { ClusterTree } from './ClusterTree'

const ctx = (name: string): ContextInfo =>
  ({ name, cluster: name, server: '', user: name, namespace: '' }) as ContextInfo

let container: HTMLDivElement
let root: Root
const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })

beforeEach(() => {
  localStorage.clear()
  mocks.contexts = [ctx('gke_b_prod'), ctx('kind-dev')]
  useUIStore.setState({
    selectedContext: null,
    aggregatedContexts: [],
    contextDisplayNames: { gke_b_prod: 'Production' },
    expandedClusters: [],
    favouriteClusters: [],
    expandedClusterGroups: [],
    hiddenSidebarItemsByContext: {},
    selectedView: 'overview',
    selectedCRDKey: null,
    openTabs: [{ kind: 'view', view: 'overview' }],
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

async function render() {
  act(() => root.render(<ClusterTree />))
  await flush()
}

const clusterButton = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find(
    (b) => b.textContent?.trim() === label,
  )!
const clusterRow = (label: string) => clusterButton(label).parentElement!
const itemByLabel = (label: string) =>
  Array.from(container.querySelectorAll('li')).filter((li) => li.textContent?.trim() === label)

describe('ClusterTree', () => {
  it('lists every context by display name, sorted', async () => {
    await render()
    const names = Array.from(container.querySelectorAll('button[aria-expanded]')).map((b) => b.textContent?.trim())
    expect(names).toEqual(['kind-dev', 'Production'])
  })

  it('the arrow toggles a cluster resource tree open and closed', async () => {
    await render()
    expect(itemByLabel('Nodes')).toHaveLength(0)
    act(() => clusterButton('Production').click())
    expect(clusterButton('Production').getAttribute('aria-expanded')).toBe('true')
    expect(itemByLabel('Nodes')).toHaveLength(1)
    expect(localStorage.getItem(EXPANDED_CLUSTERS_KEY)).toBe('["gke_b_prod"]')
    act(() => clusterButton('Production').click())
    expect(itemByLabel('Nodes')).toHaveLength(0)
    expect(localStorage.getItem(EXPANDED_CLUSTERS_KEY)).toBeNull()
  })

  it('expands the connected cluster and marks it with a status dot', async () => {
    useUIStore.setState({ selectedContext: 'kind-dev' })
    await render()
    expect(clusterButton('kind-dev').getAttribute('aria-expanded')).toBe('true')
    expect(clusterRow('kind-dev').querySelector('[aria-label^="Connected"]')).not.toBeNull()
    expect(clusterRow('Production').querySelector('[aria-label^="Connected"]')).toBeNull()
  })

  it('opening a view under another cluster switches to it', async () => {
    useUIStore.setState({ selectedContext: 'kind-dev' })
    await render()
    act(() => clusterButton('Production').click())
    const nodes = itemByLabel('Nodes')
    expect(nodes).toHaveLength(2)
    // Clusters render alphabetically by label: kind-dev first, Production second.
    act(() => nodes[1].click())
    const s = useUIStore.getState()
    expect(s.selectedContext).toBe('gke_b_prod')
    expect(s.selectedView).toBe('nodes')
  })

  it('Ctrl+click adds the cluster to the active set', async () => {
    useUIStore.setState({ selectedContext: 'kind-dev' })
    await render()
    act(() => clusterButton('Production').click())
    act(() => {
      itemByLabel('Nodes')[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })
    expect(useUIStore.getState().aggregatedContexts).toEqual(['gke_b_prod', 'kind-dev'])
  })

  it('a resource group inside a cluster expands on its own', async () => {
    useUIStore.setState({ expandedClusters: ['kind-dev', 'gke_b_prod'] })
    await render()
    expect(itemByLabel('Pods')).toHaveLength(0)
    const workloads = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
      (b) => b.textContent?.trim() === 'Workloads',
    )
    act(() => workloads[0].click())
    expect(itemByLabel('Pods')).toHaveLength(1)
  })
})

describe('favourite clusters', () => {
  const names = () =>
    Array.from(container.querySelectorAll('ul > li')).map((li) =>
      li.getAttribute('role') === 'separator' ? '---' : li.querySelector('button[aria-expanded]')?.textContent?.trim(),
    )

  it('the star moves a cluster to the top, below which a line separates the rest', async () => {
    mocks.contexts = [ctx('alpha'), ctx('gke_b_prod'), ctx('kind-dev')]
    await render()
    expect(names()).toEqual(['alpha', 'kind-dev', 'Production'])
    expect(container.querySelector('[role="separator"]')).toBeNull()

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Add Production to favourites"]')!.click())
    expect(names()).toEqual(['Production', '---', 'alpha', 'kind-dev'])
    expect(localStorage.getItem(FAVOURITE_CLUSTERS_KEY)).toBe('["gke_b_prod"]')
    const star = container.querySelector('[aria-label="Remove Production from favourites"]')!
    expect(star.getAttribute('aria-pressed')).toBe('true')

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Add kind-dev to favourites"]')!.click())
    expect(names()).toEqual(['kind-dev', 'Production', '---', 'alpha'])
  })

  it('unstarring returns the cluster to the list and drops the line when none are left', async () => {
    useUIStore.setState({ favouriteClusters: ['kind-dev'] })
    await render()
    expect(names()).toEqual(['kind-dev', '---', 'Production'])
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Remove kind-dev from favourites"]')!.click())
    expect(names()).toEqual(['kind-dev', 'Production'])
    expect(localStorage.getItem(FAVOURITE_CLUSTERS_KEY)).toBeNull()
  })

  it('starring does not expand or collapse the cluster', async () => {
    await render()
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Add kind-dev to favourites"]')!.click())
    expect(clusterButton('kind-dev').getAttribute('aria-expanded')).toBe('false')
  })

  it('forgetContext drops a deleted cluster from favourites', () => {
    useUIStore.setState({ favouriteClusters: ['gone', 'kept'] })
    act(() => useUIStore.getState().forgetContext('gone'))
    expect(useUIStore.getState().favouriteClusters).toEqual(['kept'])
  })
})

describe('cluster tree store state', () => {
  it('forgetContext drops the cluster expansion state', () => {
    useUIStore.setState({
      expandedClusters: ['gone', 'kept'],
      expandedClusterGroups: ['gone\nWorkloads', 'kept\nWorkloads'],
    })
    act(() => useUIStore.getState().forgetContext('gone'))
    const s = useUIStore.getState()
    expect(s.expandedClusters).toEqual(['kept'])
    expect(s.expandedClusterGroups).toEqual(['kept\nWorkloads'])
  })

  it('hiding an item under one cluster leaves the others alone', () => {
    useUIStore.setState({ selectedContext: 'a' })
    act(() => useUIStore.getState().hideSidebarItem('nodes', ['b']))
    expect(useUIStore.getState().hiddenSidebarItemsByContext).toEqual({ b: ['nodes'] })
  })
})

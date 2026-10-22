import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextInfo } from '@/lib/api'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({ del: vi.fn(), toast: vi.fn() }))

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({ api: { deleteKubeconfigContext: mocks.del } }))
vi.mock('sonner', () => ({ toast: { success: mocks.toast, error: vi.fn() } }))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUIStore } from '@/store/ui'
import { HOME_LAYOUT_KEY, readHomeLayout } from '@/store/ui.persistence'
import { ContextEntryMenu } from './ContextEntryMenu'
import { sortContextsAlphabetically } from './contextSort'

const ctx = (name: string): ContextInfo => ({ name, cluster: name, server: '', user: name, namespace: '' }) as ContextInfo

let container: HTMLDivElement
let root: Root
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useUIStore.setState({
    selectedContext: null,
    aggregatedContexts: [],
    contextTags: {},
    contextDisplayNames: {},
    contextGroups: [],
    defaultContext: null,
    lastSession: null,
    hiddenSidebarItemsByContext: {},
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('sortContextsAlphabetically', () => {
  it('sorts by the shown label, case-insensitive and numeric-aware', () => {
    const names = { 'gke_x_prod': 'Zulu prod', 'gke_y': 'alpha' } as Record<string, string>
    const sorted = sortContextsAlphabetically(
      [ctx('gke_x_prod'), ctx('dev-10'), ctx('Beta'), ctx('dev-2'), ctx('gke_y')],
      (n) => names[n] ?? n,
    )
    expect(sorted.map((c) => c.name)).toEqual(['gke_y', 'Beta', 'dev-2', 'dev-10', 'gke_x_prod'])
  })
})

describe('home layout preference', () => {
  it('defaults to grid and persists list', () => {
    expect(readHomeLayout()).toBe('grid')
    act(() => useUIStore.getState().setHomeLayout('list'))
    expect(localStorage.getItem(HOME_LAYOUT_KEY)).toBe('list')
    expect(readHomeLayout()).toBe('list')
    act(() => useUIStore.getState().setHomeLayout('grid'))
    expect(localStorage.getItem(HOME_LAYOUT_KEY)).toBeNull()
  })
})

describe('forgetContext', () => {
  it('drops every local preference of the deleted context and nothing else', () => {
    useUIStore.setState({
      contextTags: { gone: ['prod'], kept: ['dev'] },
      contextDisplayNames: { gone: 'Old', kept: 'Kept' },
      contextGroups: [
        { id: 'g1', name: 'pair', contexts: ['gone', 'kept'], color: 'sky' },
        { id: 'g2', name: 'trio', contexts: ['gone', 'kept', 'other'], color: 'sky' },
      ],
      activeGroupId: 'g1',
      defaultContext: 'gone',
      lastSession: { contexts: ['gone', 'kept'], groupId: null, at: 1 },
    })
    act(() => useUIStore.getState().forgetContext('gone'))
    const s = useUIStore.getState()
    expect(s.contextTags).toEqual({ kept: ['dev'] })
    expect(s.contextDisplayNames).toEqual({ kept: 'Kept' })
    // A group left with one member is no longer a group.
    expect(s.contextGroups).toEqual([{ id: 'g2', name: 'trio', contexts: ['kept', 'other'], color: 'sky' }])
    expect(s.activeGroupId).toBeNull()
    expect(s.defaultContext).toBeNull()
    expect(s.lastSession?.contexts).toEqual(['kept'])
  })

  it('disconnects the context when it is active', () => {
    useUIStore.setState({ selectedContext: 'gone' })
    act(() => useUIStore.getState().forgetContext('gone'))
    expect(useUIStore.getState().selectedContext).toBeNull()
  })
})

describe('ContextEntryMenu', () => {
  function render(node: React.ReactNode) {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    act(() => root.render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>))
  }
  const item = (label: string) =>
    Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.trim() === label) as HTMLElement
  const button = (label: string) =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!

  async function openDelete() {
    render(
      <ContextEntryMenu context={ctx('gke_swift_prod')}>
        <div data-testid="row">row</div>
      </ContextEntryMenu>,
    )
    const row = document.querySelector('[data-testid="row"]')!
    act(() => {
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    })
    await flush()
    expect(item('Delete')).toBeDefined()
    act(() => {
      item('Delete').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      item('Delete').click()
    })
    await flush()
  }

  it('right-click shows Delete, which asks before deleting', async () => {
    useUIStore.setState({ contextDisplayNames: { gke_swift_prod: 'OneApp Prod' } })
    await openDelete()
    expect(document.body.textContent).toContain('Delete OneApp Prod?')
    expect(document.body.textContent).toContain('gke_swift_prod')
    expect(mocks.del).not.toHaveBeenCalled()
    act(() => button('Cancel').click())
    await flush()
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('deletes from the kubeconfig and forgets local prefs on confirm', async () => {
    mocks.del.mockResolvedValue({
      context: 'gke_swift_prod', cluster: 'gke_swift_prod', user: '', files: ['/k'], backups: ['/k.klustr-backup-1'],
    })
    useUIStore.setState({ contextDisplayNames: { gke_swift_prod: 'OneApp Prod' }, defaultContext: 'gke_swift_prod' })
    await openDelete()
    act(() => button('Delete').click())
    await flush()
    expect(mocks.del).toHaveBeenCalledWith('gke_swift_prod')
    expect(useUIStore.getState().contextDisplayNames).toEqual({})
    expect(useUIStore.getState().defaultContext).toBeNull()
    const [title, opts] = mocks.toast.mock.calls[0]
    expect(title).toBe('Deleted OneApp Prod from kubeconfig')
    expect(opts.description).toContain('/k.klustr-backup-1')
  })

  it('keeps the dialog open and shows the error when deletion fails', async () => {
    mocks.del.mockRejectedValue(new Error('permission denied'))
    useUIStore.setState({ defaultContext: 'gke_swift_prod' })
    await openDelete()
    act(() => button('Delete').click())
    await flush()
    expect(document.body.textContent).toContain('permission denied')
    expect(useUIStore.getState().defaultContext).toBe('gke_swift_prod')
  })
})

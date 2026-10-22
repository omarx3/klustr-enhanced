import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  getDeployment: vi.fn(),
  getStatefulSet: vi.fn(),
  scale: vi.fn(),
  managers: vi.fn(),
}))

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({
  api: {
    getDeployment: mocks.getDeployment,
    getStatefulSet: mocks.getStatefulSet,
    scaleResource: mocks.scale,
    getResourceManagers: mocks.managers,
    stopServicePortForwards: vi.fn(),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The managers hook follows owner changes over Wails events, absent in jsdom.
vi.mock('@/lib/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/events')>()),
  onKubeChange: () => () => {},
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUIStore, type ResourceKind } from '@/store/ui'
import { RowActionDialogs } from './RowActionDialogs'
import { RowContextMenu } from './RowContextMenu'

let container: HTMLDivElement
let root: Root
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDeployment.mockResolvedValue({ replicas: 3 })
  mocks.getStatefulSet.mockResolvedValue({ replicas: 1 })
  mocks.scale.mockResolvedValue(undefined)
  mocks.managers.mockResolvedValue([])
  useUIStore.setState({ globalReadOnly: false, pendingAction: null, selectedContext: 'ctx' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

function render(kind: ResourceKind) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <RowContextMenu kind={kind} contextName="ctx" namespace="apps" name="web">
            <div data-testid="row">row</div>
          </RowContextMenu>
          <RowActionDialogs />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  )
}

async function openMenu() {
  act(() => {
    document.querySelector('[data-testid="row"]')!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 5, clientY: 5 }),
    )
  })
  await flush()
  return Array.from(document.querySelectorAll('[role="menuitem"]')).map((e) => e.textContent?.trim())
}

function menuItem(label: string): HTMLElement {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((e) => e.textContent?.trim() === label)!
}

describe('row menu Scale', () => {
  it.each(['Deployment', 'StatefulSet'] as const)('is offered for a %s', async (kind) => {
    render(kind)
    expect(await openMenu()).toContain('Scale')
  })

  it.each(['Pod', 'DaemonSet', 'ReplicaSet', 'Service'] as const)('is not offered for a %s', async (kind) => {
    render(kind)
    expect(await openMenu()).not.toContain('Scale')
  })

  it('is hidden in read-only mode', async () => {
    useUIStore.setState({ globalReadOnly: true })
    render('Deployment')
    expect(await openMenu()).not.toContain('Scale')
  })

  it('opens the scale dialog with the current replicas and applies the new count', async () => {
    render('Deployment')
    await openMenu()
    act(() => menuItem('Scale').click())
    await flush()
    expect(document.body.textContent).toContain('Scale Deployment')
    const input = document.querySelector<HTMLInputElement>('#scale-replicas-input')!
    expect(input.value).toBe('3')
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Increment replicas"]')!.click())
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Increment replicas"]')!.click())
    const apply = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Apply')!
    act(() => apply.click())
    await flush()
    expect(mocks.scale).toHaveBeenCalledWith('ctx', 'Deployment', 'apps', 'web', 5)
    expect(useUIStore.getState().pendingAction).toBeNull()
  })

  it('reads a StatefulSet through its own getter', async () => {
    render('StatefulSet')
    await openMenu()
    act(() => menuItem('Scale').click())
    await flush()
    expect(mocks.getStatefulSet).toHaveBeenCalledWith('ctx', 'apps', 'web')
    expect(document.querySelector<HTMLInputElement>('#scale-replicas-input')!.value).toBe('1')
  })
})

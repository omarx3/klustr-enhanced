import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({ getYAML: vi.fn(), getCRYAML: vi.fn(), create: vi.fn(), error: vi.fn() }))

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({
  api: {
    getResourceYAML: mocks.getYAML,
    getCustomResourceYAML: mocks.getCRYAML,
    createResourceYAML: mocks.create,
    stopServicePortForwards: vi.fn(),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock('@/lib/monaco', () => ({
  Editor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUIStore, type ResourceKind, type SelectedResource } from '@/store/ui'
import { RowActionDialogs } from '@/features/_shared/RowActionDialogs'
import { RowContextMenu } from '@/features/_shared/RowContextMenu'

const BACKEND = `apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: backend
  name: backend
  namespace: apps
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - image: nginx
        name: web
`

let container: HTMLDivElement
let root: Root
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getYAML.mockResolvedValue(BACKEND)
  mocks.create.mockImplementation(async (_ctx: string, manifest: string) => ({
    kind: 'Deployment',
    namespace: 'apps',
    name: /name: (\S+)/.exec(manifest)![1],
  }))
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

function render(kind: ResourceKind | string, resource?: SelectedResource, name = 'backend') {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <RowContextMenu kind={kind as ResourceKind} contextName="ctx" namespace="apps" name={name} resource={resource}>
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

async function chooseDuplicate() {
  await openMenu()
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (e) => e.textContent?.trim() === 'Duplicate',
  )!
  act(() => item.click())
  await flush()
}

const editor = () => document.querySelector<HTMLTextAreaElement>('[data-testid="editor"]')

describe('row menu Duplicate', () => {
  it.each(['Deployment', 'Service', 'ConfigMap', 'Secret', 'Pod', 'ClusterRole'] as const)('is offered for a %s', async (kind) => {
    render(kind)
    expect(await openMenu()).toContain('Duplicate')
  })

  it.each(['HelmRelease', 'Node', 'CSINode'] as const)('is not offered for a %s', async (kind) => {
    render(kind)
    expect(await openMenu()).not.toContain('Duplicate')
  })

  it('is hidden in read-only mode', async () => {
    useUIStore.setState({ globalReadOnly: true })
    render('Deployment')
    expect(await openMenu()).not.toContain('Duplicate')
  })

  it('opens the manifest of the original renamed to copy-of-<name>', async () => {
    render('Deployment')
    await chooseDuplicate()
    expect(mocks.getYAML).toHaveBeenCalledWith('ctx', 'Deployment', 'apps', 'backend')
    expect(document.body.textContent).toContain('Duplicate Deployment')
    const text = editor()!.value
    expect(text).toContain('  name: copy-of-backend\n')
    expect(text).toContain('  namespace: apps\n')
    expect(text).toContain('replicas: 2')
    expect(text).toContain('image: nginx')
  })

  it('creates the copy on Save and opens it', async () => {
    render('Deployment')
    await chooseDuplicate()
    const save = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Save')!
    act(() => save.click())
    await flush()
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(mocks.create.mock.calls[0][2]).toBe(true)
    expect(mocks.create.mock.calls[1][1]).toContain('name: copy-of-backend')
    expect(mocks.create.mock.calls[1][2]).toBe(false)
    expect(useUIStore.getState().pendingAction).toBeNull()
    expect(useUIStore.getState().selectedResource).toMatchObject({
      kind: 'Deployment',
      namespace: 'apps',
      name: 'copy-of-backend',
      context: 'ctx',
    })
  })

  it('reads a custom resource through its GVR and opens the copy with the row kind', async () => {
    const gvr = { group: 'cert-manager.io', version: 'v1', resource: 'certificates' }
    mocks.getCRYAML.mockResolvedValue(
      'apiVersion: cert-manager.io/v1\nkind: Certificate\nmetadata:\n  name: tls\n  namespace: apps\nspec:\n  secretName: tls\n',
    )
    mocks.create.mockResolvedValue({ kind: 'Certificate', namespace: 'apps', name: 'copy-of-tls' })
    render('Certificate', { kind: 'Certificate', namespace: 'apps', name: 'tls', context: 'ctx', gvr }, 'tls')
    await chooseDuplicate()
    expect(mocks.getCRYAML).toHaveBeenCalledWith('ctx', 'cert-manager.io', 'v1', 'certificates', 'apps', 'tls')
    expect(editor()!.value).toContain('name: copy-of-tls')
    const save = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Save')!
    act(() => save.click())
    await flush()
    expect(useUIStore.getState().selectedResource).toMatchObject({ kind: 'Certificate', gvr, name: 'copy-of-tls' })
  })

  it('reports a failed read and closes', async () => {
    mocks.getYAML.mockRejectedValue(new Error('forbidden'))
    render('Deployment')
    await chooseDuplicate()
    expect(mocks.error).toHaveBeenCalled()
    expect(editor()).toBeNull()
    expect(useUIStore.getState().pendingAction).toBeNull()
  })
})

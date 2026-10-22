import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({ create: vi.fn(), open: vi.fn() }))

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({ api: { createResourceYAML: mocks.create } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Monaco does not run in jsdom; a textarea stands in with the same value/onChange contract.
vi.mock('@/lib/monaco', () => ({
  Editor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUIStore } from '@/store/ui'
import { CreateResourceDialog } from './CreateResourceDialog'
import { resourceTemplate } from './templates'

let container: HTMLDivElement
let root: Root
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) })

const target = () => ({
  contextName: 'ctx-a',
  kind: 'Service',
  namespaced: true,
  template: resourceTemplate('Service', 'apps')!,
})

async function render(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <CreateResourceDialog target={target()} onClose={onClose} />
      </QueryClientProvider>,
    ),
  )
  await flush()
  return onClose
}

function editor(): HTMLTextAreaElement {
  return document.querySelector('[data-testid="editor"]')!
}

function type(value: string) {
  const el = editor()
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function button(label: string): HTMLButtonElement {
  return Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!
}

function problems(): string {
  return document.querySelector('[aria-label="Manifest problems"]')!.textContent ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  useUIStore.setState({ globalReadOnly: false, openResource: mocks.open })
  mocks.create.mockImplementation((_ctx: string, _yaml: string, dryRun: boolean) =>
    Promise.resolve({ kind: 'Service', namespace: 'apps', name: dryRun ? 'my-service' : 'my-service' }),
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('CreateResourceDialog', () => {
  it('opens with the template and saves via dry-run then create, then opens the new resource', async () => {
    const onClose = await render()
    expect(editor().value).toBe(target().template)
    expect(problems()).toContain('No problems found.')
    act(() => button('Save').click())
    await flush()
    expect(mocks.create.mock.calls.map((c) => c[2])).toEqual([true, false])
    expect(mocks.create.mock.calls[1][1]).toBe(target().template)
    expect(onClose).toHaveBeenCalled()
    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'Service', namespace: 'apps', name: 'my-service', context: 'ctx-a' }),
    )
  })

  it('normalizes indentation before saving', async () => {
    await render()
    type('apiVersion: v1\nkind: Service\nmetadata:\n    name: web\n    namespace: apps\nspec:\n  ports:\n  - port: 80\n')
    act(() => button('Save').click())
    await flush()
    expect(mocks.create.mock.calls[1][1]).toBe(
      'apiVersion: v1\nkind: Service\nmetadata:\n  name: web\n  namespace: apps\nspec:\n  ports:\n    - port: 80\n',
    )
  })

  it('lists indentation errors with line numbers and blocks Save', async () => {
    await render()
    type('apiVersion: v1\nkind: Service\nmetadata:\n\tname: web\n')
    expect(problems()).toContain('Ln 4')
    expect(problems()).toContain('Tabs cannot be used for indentation')
    expect(button('Save').disabled).toBe(true)
    expect(document.body.textContent).toContain('1 error')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('warns first and saves only on a second press', async () => {
    await render()
    type('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: cfg\n  namespace: apps\n')
    act(() => button('Save').click())
    await flush()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Press Save again to create anyway')
    act(() => button('Save anyway').click())
    await flush()
    expect(mocks.create).toHaveBeenCalledTimes(2)
  })

  it('shows a server rejection and does not create when the dry run fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('services "my-service" already exists'))
    const onClose = await render()
    act(() => button('Save').click())
    await flush()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(problems()).toContain('Rejected by the cluster')
    expect(problems()).toContain('already exists')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables Save in read-only mode', async () => {
    useUIStore.setState({ globalReadOnly: true })
    await render()
    expect(button('Save').disabled).toBe(true)
  })
})

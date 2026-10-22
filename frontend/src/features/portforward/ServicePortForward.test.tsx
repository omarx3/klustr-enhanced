import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortForwardInfo } from '@/lib/api'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  getService: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('@/lib/wails/wailsjs/runtime/runtime', () => ({ BrowserOpenURL: mocks.open }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api', () => ({
  api: {
    getService: mocks.getService,
    startServicePortForward: mocks.start,
    stopServicePortForwards: mocks.stop,
  },
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePortForwards } from '@/store/portForwards'
import { ServicePortForwardDialog } from './ServicePortForwardDialog'
import { ServicePortForwardTag } from './ServicePortForwardTag'
import { activeServiceForwards, parseLocalPort } from './servicePortForward'

const svc = { context: 'ctx-a', namespace: 'apps', name: 'web' }

function forward(over: Partial<PortForwardInfo> = {}): PortForwardInfo {
  return {
    id: 'pf-1', context: 'ctx-a', namespace: 'apps', podName: 'web-1',
    localPort: 9090, remotePort: 8080, serviceName: 'web', servicePort: 80,
    status: 'ready', error: '', ...over,
  } as PortForwardInfo
}

let container: HTMLDivElement
let root: Root
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

function render(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  act(() => root.render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>))
}

function button(label: string) {
  return Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().endsWith(label))
}

function typeInto(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  usePortForwards.setState({ list: [] })
  mocks.getService.mockResolvedValue({ ports: [{ name: 'http', protocol: 'TCP', port: 80, targetPort: '8080', nodePort: 0 }] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('service port-forward helpers', () => {
  it('counts only ready forwards of the same service, context and namespace', () => {
    const list = [
      forward(),
      forward({ id: 'pf-2', status: 'error' }),
      forward({ id: 'pf-3', serviceName: '' }),
      forward({ id: 'pf-4', namespace: 'other' }),
      forward({ id: 'pf-5', context: 'ctx-b' }),
    ]
    expect(activeServiceForwards(list, svc).map((f) => f.id)).toEqual(['pf-1'])
  })

  it('validates the local port', () => {
    expect(parseLocalPort('')).toBeNull()
    expect(parseLocalPort('8080')).toEqual({ port: 8080 })
    expect(parseLocalPort('0')).toEqual({ port: 0 })
    expect(parseLocalPort('80a')).toEqual({ error: 'Enter a number.' })
    expect(parseLocalPort('70000')).toEqual({ error: 'Port must be 65535 or lower.' })
  })
})

describe('ServicePortForwardTag', () => {
  it('renders only while a forward is active', () => {
    render(<ServicePortForwardTag service={svc} />)
    expect(container.textContent).toBe('')
    act(() => usePortForwards.setState({ list: [forward()] }))
    expect(container.textContent).toContain(':9090')
    act(() => usePortForwards.setState({ list: [forward({ status: 'error' })] }))
    expect(container.textContent).toBe('')
    act(() => usePortForwards.setState({ list: [] }))
    expect(container.textContent).toBe('')
  })
})

describe('ServicePortForwardDialog', () => {
  it('starts on the custom local port and opens the browser there', async () => {
    mocks.start.mockResolvedValue(forward({ localPort: 18080 }))
    const onOpenChange = vi.fn()
    render(<ServicePortForwardDialog service={svc} open onOpenChange={onOpenChange} />)
    await flush()
    const input = document.querySelector<HTMLInputElement>('#service-pf-local-port')!
    typeInto(input, '18080')
    act(() => button('Start')!.click())
    await flush()
    expect(mocks.start).toHaveBeenCalledWith('ctx-a', 'apps', 'web', 80, 18080)
    expect(mocks.open).toHaveBeenCalledWith('http://localhost:18080')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('blocks Start for an invalid port', async () => {
    render(<ServicePortForwardDialog service={svc} open onOpenChange={() => {}} />)
    await flush()
    typeInto(document.querySelector<HTMLInputElement>('#service-pf-local-port')!, 'abc')
    expect(button('Start')!.disabled).toBe(true)
    expect(document.body.textContent).toContain('Enter a number.')
  })

  it('shows Stop instead of Start while a forward is active, and stops it', async () => {
    mocks.stop.mockResolvedValue(undefined)
    usePortForwards.setState({ list: [forward()] })
    render(<ServicePortForwardDialog service={svc} open onOpenChange={() => {}} />)
    await flush()
    expect(button('Start')).toBeUndefined()
    expect(document.body.textContent).toContain('http://localhost:9090')
    act(() => button('Stop')!.click())
    await flush()
    expect(mocks.stop).toHaveBeenCalledWith('ctx-a', 'apps', 'web')
  })

  it('has no Stop button when nothing is forwarded', async () => {
    render(<ServicePortForwardDialog service={svc} open onOpenChange={() => {}} />)
    await flush()
    expect(button('Stop')).toBeUndefined()
    expect(button('Start')).toBeDefined()
  })
})

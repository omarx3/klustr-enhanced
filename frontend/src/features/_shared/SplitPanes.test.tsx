import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

import { useUIStore } from '@/store/ui'
import { SplitPanes } from './SplitPanes'
import { usePane } from './paneContext'

function Probe({ name }: { name: string }) {
  return <div data-testid={name}>{`${name} in ${usePane()}`}</div>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  useUIStore.setState({ selectedView: 'pods', selectedCRDKey: null, split: null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = () =>
  act(() => root.render(<SplitPanes primary={<Probe name="A" />} secondary={<Probe name="B" />} />))
const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!

describe('SplitPanes', () => {
  it('renders only the primary pane without a split', () => {
    render()
    expect(container.textContent).toBe('A in primary')
    expect(container.querySelector('[role="separator"]')).toBeNull()
  })

  it('lays panes side by side, labels each pane, and flips to stacked', () => {
    useUIStore.setState({ split: { tab: { kind: 'view', view: 'deployments' }, direction: 'vertical', ratio: 0.5 } })
    render()
    expect(container.querySelector('[data-testid="A"]')!.textContent).toBe('A in primary')
    expect(container.querySelector('[data-testid="B"]')!.textContent).toBe('B in secondary')
    expect(container.textContent).toContain('Deployments')
    const sep = container.querySelector('[role="separator"]')!
    expect(sep.getAttribute('aria-orientation')).toBe('vertical')
    act(() => button('Split horizontally').click())
    expect(useUIStore.getState().split?.direction).toBe('horizontal')
    expect(container.querySelector('[role="separator"]')!.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('resizes with the keyboard and closes', () => {
    useUIStore.setState({ split: { tab: { kind: 'view', view: 'deployments' }, direction: 'vertical', ratio: 0.5 } })
    render()
    const sep = container.querySelector<HTMLElement>('[role="separator"]')!
    act(() => sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(useUIStore.getState().split?.ratio).toBeCloseTo(0.55)
    expect(container.querySelector<HTMLElement>('[data-split-pane="primary"]')!.style.flexBasis).toBe('55%')
    act(() => button('Close split').click())
    expect(useUIStore.getState().split).toBeNull()
    expect(container.textContent).toBe('A in primary')
  })
})

describe('SplitPanes Escape', () => {
  it('closes the shared inspector when Esc is pressed in the split pane', () => {
    useUIStore.setState({
      split: { tab: { kind: 'view', view: 'deployments' }, direction: 'vertical', ratio: 0.5 },
      selectedResource: { kind: 'Deployment', namespace: 'default', name: 'web', context: 'ctx' },
      detailDirty: false,
    })
    render()
    const target = container.querySelector<HTMLElement>('[data-testid="B"]')!
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(useUIStore.getState().selectedResource).toBeNull()
  })
})

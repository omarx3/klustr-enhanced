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
import { useCRDStore } from '@/store/crds'
import { ViewTabs } from './ViewTabs'

const base = useUIStore.getState()

function tabs(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'))
}

function labels(container: HTMLElement) {
  return tabs(container).map((t) => t.textContent)
}

function active(container: HTMLElement) {
  return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

describe('ViewTabs', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    useUIStore.setState({
      ...base,
      selectedContext: 'cluster-a',
      selectedView: 'overview',
      selectedCRDKey: null,
      openTabs: [{ kind: 'view', view: 'overview' }],
      detailDirty: false,
      pendingDetailNavigation: null,
    })
    useCRDStore.setState({ crds: [], byKey: {}, byContext: {} })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<ViewTabs />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
  })

  it('adds a tab beside the previous one for each opened view', () => {
    act(() => useUIStore.getState().setSelectedView('nodes'))
    act(() => useUIStore.getState().setSelectedView('deployments'))
    expect(labels(container)).toEqual(['Overview', 'Nodes', 'Deployments'])
    expect(active(container)).toBe('Deployments')
  })

  it('qualifies repeated sidebar labels and names CRD tabs by kind', () => {
    act(() => useCRDStore.setState({
      byKey: { 'example.com/widgets': { kind: 'Widget' } as never },
    }))
    act(() => useUIStore.getState().setSelectedView('workloadsoverview'))
    act(() => useUIStore.getState().setSelectedCRD('example.com/widgets'))
    expect(labels(container)).toEqual(['Overview', 'Workloads Overview', 'Widget'])
  })

  it('switches on click and closes with the button or a middle-click', () => {
    act(() => useUIStore.getState().setSelectedView('nodes'))
    act(() => useUIStore.getState().setSelectedView('deployments'))
    act(() => tabs(container)[1].click())
    expect(useUIStore.getState().selectedView).toBe('nodes')

    const close = tabs(container)[2].querySelector('button')!
    act(() => close.click())
    expect(labels(container)).toEqual(['Overview', 'Nodes'])
    // Closing an inactive tab must not move the selection.
    expect(useUIStore.getState().selectedView).toBe('nodes')

    act(() => {
      tabs(container)[1].dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }))
    })
    expect(labels(container)).toEqual(['Overview'])
    expect(useUIStore.getState().selectedView).toBe('overview')
  })

  it('cycles tabs with Alt+Left and Alt+Right', () => {
    act(() => useUIStore.getState().setSelectedView('nodes'))
    act(() => useUIStore.getState().setSelectedView('deployments'))

    const ev = press('ArrowLeft', { altKey: true })
    expect(ev.defaultPrevented).toBe(true)
    expect(active(container)).toBe('Nodes')
    press('ArrowRight', { altKey: true })
    expect(active(container)).toBe('Deployments')
    press('ArrowRight', { altKey: true })
    expect(active(container)).toBe('Overview')
  })

  it('leaves Alt+arrows alone in text fields, editors, the shell, overlays and other chords', () => {
    act(() => useUIStore.getState().setSelectedView('nodes'))
    const input = document.createElement('input')
    const monaco = document.createElement('div')
    monaco.className = 'monaco-editor'
    const monacoChild = document.createElement('div')
    monaco.appendChild(monacoChild)
    const xterm = document.createElement('div')
    xterm.className = 'xterm'
    document.body.append(input, monaco, xterm)

    for (const target of [input, monacoChild, xterm]) {
      const ev = press('ArrowLeft', { altKey: true }, target)
      expect(ev.defaultPrevented).toBe(false)
    }
    press('ArrowLeft')
    press('ArrowLeft', { altKey: true, shiftKey: true })
    press('ArrowLeft', { altKey: true, ctrlKey: true })
    expect(useUIStore.getState().selectedView).toBe('nodes')

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    document.body.appendChild(dialog)
    press('ArrowLeft', { altKey: true })
    expect(useUIStore.getState().selectedView).toBe('nodes')
  })

  it('keeps the tab while an unsaved draft blocks leaving it', () => {
    act(() => useUIStore.getState().setSelectedView('nodes'))
    useUIStore.setState({ detailDirty: true })
    press('ArrowLeft', { altKey: true })
    expect(useUIStore.getState().selectedView).toBe('nodes')
    expect(useUIStore.getState().pendingDetailNavigation).not.toBeNull()
    act(() => useUIStore.getState().confirmDetailNavigation())
    expect(active(container)).toBe('Overview')
  })

  it('stops listening after unmount', () => {
    act(() => useUIStore.getState().setSelectedView('nodes'))
    act(() => root.unmount())
    press('ArrowLeft', { altKey: true })
    expect(useUIStore.getState().selectedView).toBe('nodes')
    root = createRoot(container)
  })
})

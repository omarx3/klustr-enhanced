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
import { ContextBadge } from '@/features/_shared/ContextBadge'
import { ContextName } from '@/features/_shared/ContextName'
import { ContextDisplayNameDialog } from './ContextDisplayNameDialog'

const CTX = 'gke_swift-implement-155307_europe-west2_oneapp-production'

let container: HTMLDivElement
let root: Root

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function input(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#context-display-name')!
}

function type(value: string) {
  const el = input()
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function click(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label,
  )!
  act(() => button.click())
}

beforeEach(() => {
  localStorage.clear()
  useUIStore.setState({ contextDisplayNames: {} })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('context display names in the UI', () => {
  it('shows the kubeconfig name until a display name is set, then the display name', () => {
    render(
      <>
        <ContextName name={CTX} />
        <ContextBadge contextName={CTX} />
      </>,
    )
    expect(container.textContent).toContain(CTX)

    act(() => useUIStore.getState().setContextDisplayName(CTX, 'OneApp prod'))
    expect(container.textContent).toContain('OneApp prod')
    expect(container.textContent).not.toContain(CTX)
    // The kubeconfig name stays reachable in the tooltip.
    expect(container.querySelector('span')?.title).toBe(`OneApp prod (${CTX})`)
  })

  it('prefills the dialog with the kubeconfig name and saves a new display name', () => {
    const onClose = vi.fn()
    render(<ContextDisplayNameDialog contextName={CTX} onClose={onClose} />)
    expect(input().value).toBe(CTX)

    type('OneApp prod')
    click('Save')
    expect(useUIStore.getState().contextDisplayNames).toEqual({ [CTX]: 'OneApp prod' })
    expect(onClose).toHaveBeenCalled()
  })

  it('prefills the current display name and resets back to the kubeconfig name', () => {
    useUIStore.getState().setContextDisplayName(CTX, 'OneApp prod')
    render(<ContextDisplayNameDialog contextName={CTX} onClose={() => {}} />)
    expect(input().value).toBe('OneApp prod')

    click('Reset')
    expect(useUIStore.getState().contextDisplayNames).toEqual({})
  })

  it('treats saving a blank name as a reset', () => {
    useUIStore.getState().setContextDisplayName(CTX, 'OneApp prod')
    render(<ContextDisplayNameDialog contextName={CTX} onClose={() => {}} />)
    type('   ')
    click('Save')
    expect(useUIStore.getState().contextDisplayNames).toEqual({})
  })
})

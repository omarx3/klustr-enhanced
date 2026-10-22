import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

import { useUIStore } from '@/store/ui'
import { FONT_SCALE_KEY, clampFontScale, readFontScale, steppedFontScale } from '@/store/ui.persistence'
import { fontScaleKey, useFontScaleShortcuts } from './useFontScale'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const key = (k: string, mods: Partial<KeyboardEvent> = { ctrlKey: true }, code = '') =>
  ({ key: k, code, ctrlKey: false, metaKey: false, altKey: false, ...mods }) as KeyboardEvent

describe('fontScaleKey', () => {
  it('maps Ctrl with + / = / - / 0', () => {
    expect(fontScaleKey(key('='))).toBe('in')
    expect(fontScaleKey(key('+', { ctrlKey: true, shiftKey: true }))).toBe('in')
    expect(fontScaleKey(key('-'))).toBe('out')
    expect(fontScaleKey(key('0'))).toBe('reset')
    expect(fontScaleKey(key('Unidentified', { ctrlKey: true }, 'NumpadAdd'))).toBe('in')
    expect(fontScaleKey(key('Unidentified', { ctrlKey: true }, 'NumpadSubtract'))).toBe('out')
  })

  it('accepts Cmd on macOS', () => {
    expect(fontScaleKey(key('=', { metaKey: true }))).toBe('in')
  })

  it('ignores the keys without a modifier or with Alt', () => {
    expect(fontScaleKey(key('-', {}))).toBeNull()
    expect(fontScaleKey(key('=', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(fontScaleKey(key('k'))).toBeNull()
  })
})

describe('font scale steps', () => {
  beforeEach(() => localStorage.clear())

  it('steps up and down and stops at the ends', () => {
    expect(steppedFontScale(1, 1)).toBe(1.1)
    expect(steppedFontScale(1, -1)).toBe(0.9)
    expect(steppedFontScale(1.5, 1)).toBe(1.5)
    expect(steppedFontScale(0.8, -1)).toBe(0.8)
  })

  it('snaps stored values onto the ladder', () => {
    expect(clampFontScale(1.12)).toBe(1.1)
    expect(clampFontScale(9)).toBe(1.5)
    expect(clampFontScale(Number.NaN)).toBe(1)
    localStorage.setItem(FONT_SCALE_KEY, 'junk')
    expect(readFontScale()).toBe(1)
    localStorage.setItem(FONT_SCALE_KEY, '1.2')
    expect(readFontScale()).toBe(1.2)
  })
})

describe('setFontScale', () => {
  beforeEach(() => {
    localStorage.clear()
    useUIStore.getState().setFontScale(1)
  })

  it('scales the root font size and persists the choice', () => {
    useUIStore.getState().setFontScale(1.2)
    expect(useUIStore.getState().fontScale).toBe(1.2)
    expect(document.documentElement.style.fontSize).toBe('120%')
    expect(localStorage.getItem(FONT_SCALE_KEY)).toBe('1.2')
  })

  it('clears the override at the default size', () => {
    useUIStore.getState().setFontScale(1.3)
    useUIStore.getState().setFontScale(1)
    expect(document.documentElement.style.fontSize).toBe('')
    expect(localStorage.getItem(FONT_SCALE_KEY)).toBeNull()
  })

  it('responds to the keyboard shortcuts while mounted', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(<Shortcuts />))
    const press = (k: string) =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey: true, cancelable: true }))
      })
    press('=')
    press('=')
    expect(useUIStore.getState().fontScale).toBe(1.2)
    press('-')
    expect(useUIStore.getState().fontScale).toBe(1.1)
    press('0')
    expect(useUIStore.getState().fontScale).toBe(1)
    act(() => root.unmount())
    press('=')
    expect(useUIStore.getState().fontScale).toBe(1)
  })
})

function Shortcuts() {
  useFontScaleShortcuts()
  return null
}

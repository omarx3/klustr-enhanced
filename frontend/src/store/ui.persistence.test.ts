import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_DARK, DEFAULT_LIGHT } from '@/features/_shared/themes'
import {
  CONTEXT_DISPLAY_NAMES_KEY,
  THEME_STORAGE_KEY,
  readContextDisplayNames,
  readSavedThemeId,
} from './ui.persistence'

describe('readSavedThemeId', () => {
  beforeEach(() => localStorage.clear())

  it('restores a saved theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'nord-light')
    expect(readSavedThemeId()).toBe('nord-light')
  })

  it('maps the legacy light and dark values to the default themes', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(readSavedThemeId()).toBe(DEFAULT_LIGHT)
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readSavedThemeId()).toBe(DEFAULT_DARK)
  })

  it('keeps users of the removed Tokyo Night Day theme on a light theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'tokyo-night-day')
    expect(readSavedThemeId()).toBe(DEFAULT_LIGHT)
  })

  it('returns null when nothing usable is saved', () => {
    expect(readSavedThemeId()).toBeNull()
    localStorage.setItem(THEME_STORAGE_KEY, 'no-such-theme')
    expect(readSavedThemeId()).toBeNull()
  })
})

describe('readContextDisplayNames', () => {
  beforeEach(() => localStorage.clear())

  it('restores saved names and drops blank, non-string or no-op entries', () => {
    localStorage.setItem(
      CONTEXT_DISPLAY_NAMES_KEY,
      JSON.stringify({ a: ' Prod ', b: '   ', c: 3, d: 'd' }),
    )
    expect(readContextDisplayNames()).toEqual({ a: 'Prod' })
  })

  it('returns an empty map for missing or corrupt storage', () => {
    expect(readContextDisplayNames()).toEqual({})
    localStorage.setItem(CONTEXT_DISPLAY_NAMES_KEY, '{nope')
    expect(readContextDisplayNames()).toEqual({})
    localStorage.setItem(CONTEXT_DISPLAY_NAMES_KEY, '["a"]')
    expect(readContextDisplayNames()).toEqual({})
  })
})

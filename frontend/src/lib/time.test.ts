import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatAge } from './time'

describe('formatAge', () => {
  const now = new Date('2026-05-17T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns em dash for empty input', () => {
    expect(formatAge('')).toBe('—')
  })

  it('returns em dash for invalid date', () => {
    expect(formatAge('not-a-date')).toBe('—')
  })

  it('formats seconds', () => {
    const iso = new Date(now - 45_000).toISOString()
    expect(formatAge(iso)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    const iso = new Date(now - 125_000).toISOString()
    expect(formatAge(iso)).toBe('2m5s')
  })

  it('formats minutes only when seconds are zero', () => {
    const iso = new Date(now - 120_000).toISOString()
    expect(formatAge(iso)).toBe('2m')
  })

  it('formats hours and minutes', () => {
    const iso = new Date(now - (3 * 3600 + 10 * 60) * 1000).toISOString()
    expect(formatAge(iso)).toBe('3h10m')
  })

  it('formats hours only when minutes are zero', () => {
    const iso = new Date(now - 3 * 3600 * 1000).toISOString()
    expect(formatAge(iso)).toBe('3h')
  })

  it('formats days and hours', () => {
    const iso = new Date(now - (2 * 86400 + 5 * 3600) * 1000).toISOString()
    expect(formatAge(iso)).toBe('2d5h')
  })

  it('formats days only when hours are zero', () => {
    const iso = new Date(now - 2 * 86400 * 1000).toISOString()
    expect(formatAge(iso)).toBe('2d')
  })

  it('clamps future timestamps to zero', () => {
    const iso = new Date(now + 60_000).toISOString()
    expect(formatAge(iso)).toBe('0s')
  })
})

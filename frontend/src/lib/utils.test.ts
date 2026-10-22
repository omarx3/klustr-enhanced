import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('merges conflicting tailwind classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm text-base')).toBe('text-base')
  })

  it('handles object and array inputs from clsx', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d')
  })
})

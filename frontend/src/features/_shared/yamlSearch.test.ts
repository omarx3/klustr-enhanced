import { describe, expect, it } from 'vitest'
import { findMatches, nearestMatch, stepMatch } from './yamlSearch'

describe('findMatches', () => {
  it('finds every case-insensitive, literal occurrence', () => {
    const text = 'image: nginx\nname: NGINX\nimagePullPolicy: Always\n'
    expect(findMatches(text, 'nginx')).toEqual([
      { start: 7, end: 12 },
      { start: 19, end: 24 },
    ])
    // Regex characters are taken literally.
    expect(findMatches('a.b axb a.b', 'a.b')).toHaveLength(2)
  })

  it('finds nothing for an empty query', () => {
    expect(findMatches('anything', '')).toEqual([])
  })

  it('does not overlap matches', () => {
    expect(findMatches('aaaa', 'aa')).toHaveLength(2)
  })
})

describe('stepMatch', () => {
  it('moves forward and back, wrapping at both ends', () => {
    expect(stepMatch(0, 3, 1)).toBe(1)
    expect(stepMatch(2, 3, 1)).toBe(0)
    expect(stepMatch(0, 3, -1)).toBe(2)
    expect(stepMatch(-1, 3, 1)).toBe(0)
    expect(stepMatch(-1, 3, -1)).toBe(2)
    expect(stepMatch(0, 0, 1)).toBe(-1)
  })
})

describe('nearestMatch', () => {
  const matches = [{ start: 5, end: 8 }, { start: 20, end: 23 }]
  it('picks the first match at or after the caret, wrapping to the first', () => {
    expect(nearestMatch(matches, 0)).toBe(0)
    expect(nearestMatch(matches, 10)).toBe(1)
    expect(nearestMatch(matches, 30)).toBe(0)
    expect(nearestMatch([], 0)).toBe(-1)
  })
})

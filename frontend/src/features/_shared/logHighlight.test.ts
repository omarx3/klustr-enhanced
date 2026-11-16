import { describe, expect, it } from 'vitest'
import { highlightLogContent, highlightMatches, searchPattern } from './logHighlight'

const ON = '\x1b[30;43m'
const OFF = '\x1b[39;49m'

describe('highlightMatches', () => {
  it('marks every match, ignoring case', () => {
    expect(highlightMatches('Foo bar foo', searchPattern('foo', false)!)).toBe(`${ON}Foo${OFF} bar ${ON}foo${OFF}`)
  })

  it('matches across styling and restores it afterwards', () => {
    const styled = highlightLogContent('level=error done')
    const out = highlightMatches(styled, searchPattern('=error d', false)!)
    expect(out).toBe(`level${ON}=\x1b[31m${ON}error\x1b[0m${ON} d${OFF}one`)
  })

  it('replays the active colour when a match ends inside a styled span', () => {
    expect(highlightMatches('\x1b[31mabcd\x1b[0m', searchPattern('b', false)!)).toBe(
      `\x1b[31ma${ON}b${OFF}\x1b[31mcd\x1b[0m`,
    )
  })

  it('treats plain text literally and skips empty regex matches', () => {
    expect(highlightMatches('a.b axb', searchPattern('a.b', false)!)).toBe(`${ON}a.b${OFF} axb`)
    expect(highlightMatches('abc', searchPattern('x*', true)!)).toBe('abc')
  })

  it('returns no pattern for an empty or invalid search', () => {
    expect(searchPattern('', false)).toBeNull()
    expect(searchPattern('(', true)).toBeNull()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { selectFavorites, useNamespaceFavorites } from './namespaceFavorites'

function reset() {
  localStorage.clear()
  useNamespaceFavorites.setState({ byContext: {} })
}

describe('useNamespaceFavorites', () => {
  beforeEach(reset)

  it('starts empty for any context', () => {
    expect(selectFavorites('prod')(useNamespaceFavorites.getState())).toEqual([])
  })

  it('toggle adds and removes a namespace alphabetically', () => {
    const { toggle } = useNamespaceFavorites.getState()
    toggle('prod', 'kube-system')
    toggle('prod', 'default')
    expect(selectFavorites('prod')(useNamespaceFavorites.getState())).toEqual([
      'default',
      'kube-system',
    ])
    toggle('prod', 'default')
    expect(selectFavorites('prod')(useNamespaceFavorites.getState())).toEqual(['kube-system'])
  })

  it('keeps favorites isolated per context', () => {
    const { toggle } = useNamespaceFavorites.getState()
    toggle('prod', 'a')
    toggle('staging', 'b')
    expect(selectFavorites('prod')(useNamespaceFavorites.getState())).toEqual(['a'])
    expect(selectFavorites('staging')(useNamespaceFavorites.getState())).toEqual(['b'])
  })

  it('setAll dedupes and sorts input', () => {
    useNamespaceFavorites.getState().setAll('prod', ['b', 'a', 'a', 'c'])
    expect(selectFavorites('prod')(useNamespaceFavorites.getState())).toEqual(['a', 'b', 'c'])
  })

  it('clear wipes only the target context', () => {
    const { toggle, clear } = useNamespaceFavorites.getState()
    toggle('prod', 'a')
    toggle('staging', 'b')
    clear('prod')
    expect(selectFavorites('prod')(useNamespaceFavorites.getState())).toEqual([])
    expect(selectFavorites('staging')(useNamespaceFavorites.getState())).toEqual(['b'])
  })

  it('persists to localStorage under klustr.namespaceFavorites', () => {
    useNamespaceFavorites.getState().toggle('prod', 'kube-system')
    const raw = localStorage.getItem('klustr.namespaceFavorites')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? '{}') as {
      state: { byContext: Record<string, string[]> }
    }
    expect(parsed.state.byContext.prod).toEqual(['kube-system'])
  })

  it('selectFavorites returns empty when no context is selected', () => {
    expect(selectFavorites(null)(useNamespaceFavorites.getState())).toEqual([])
  })
})

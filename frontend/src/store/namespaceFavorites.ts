import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type State = {
  byContext: Record<string, string[]>
  toggle: (contextName: string, namespace: string) => void
  setAll: (contextName: string, namespaces: string[]) => void
  clear: (contextName: string) => void
}

export const useNamespaceFavorites = create<State>()(
  persist(
    (set) => ({
      byContext: {},
      toggle: (contextName, namespace) =>
        set((s) => {
          const current = s.byContext[contextName] ?? []
          const next = current.includes(namespace)
            ? current.filter((n) => n !== namespace)
            : [...current, namespace].sort((a, b) => a.localeCompare(b))
          return { byContext: { ...s.byContext, [contextName]: next } }
        }),
      setAll: (contextName, namespaces) =>
        set((s) => ({
          byContext: {
            ...s.byContext,
            [contextName]: Array.from(new Set(namespaces)).sort((a, b) => a.localeCompare(b)),
          },
        })),
      clear: (contextName) =>
        set((s) => {
          const next = { ...s.byContext }
          delete next[contextName]
          return { byContext: next }
        }),
    }),
    { name: 'klustr.namespaceFavorites' },
  ),
)

const EMPTY: readonly string[] = Object.freeze([])

export function selectFavorites(contextName: string | null) {
  return (s: { byContext: Record<string, string[]> }): readonly string[] => {
    if (!contextName) return EMPTY
    return s.byContext[contextName] ?? EMPTY
  }
}

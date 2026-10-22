import type { ContextInfo } from '@/lib/api'

// Alphabetical order for the list layout: by the label the user sees (display
// name when set), case-insensitive and numeric-aware so "dev-2" sorts before
// "dev-10"; the kubeconfig name breaks ties between equal labels.
export function sortContextsAlphabetically(
  contexts: readonly ContextInfo[],
  labelOf: (name: string) => string,
): ContextInfo[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  return [...contexts].sort(
    (a, b) => collator.compare(labelOf(a.name), labelOf(b.name)) || collator.compare(a.name, b.name),
  )
}

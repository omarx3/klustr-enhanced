// Find-in-YAML for the resource editor. Matching is plain, case-insensitive
// text, so a search for "image:" or "app.kubernetes.io/name" means exactly
// what was typed. Offsets are character indexes into the text.

export type TextMatch = { start: number; end: number }

export function findMatches(text: string, query: string): TextMatch[] {
  if (!query) return []
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  const out: TextMatch[] = []
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    out.push({ start: at, end: at + needle.length })
  }
  return out
}

// stepMatch moves to the next (+1) or previous (-1) match, wrapping at both
// ends. From no current match, next lands on the first and previous on the
// last.
export function stepMatch(current: number, count: number, delta: 1 | -1): number {
  if (count === 0) return -1
  if (current < 0) return delta === 1 ? 0 : count - 1
  return (current + delta + count) % count
}

// nearestMatch keeps the search anchored where the user is: after an edit or
// a new query, the current match is the first one at or after the caret.
export function nearestMatch(matches: TextMatch[], offset: number): number {
  if (matches.length === 0) return -1
  const i = matches.findIndex((m) => m.start >= offset)
  return i === -1 ? 0 : i
}

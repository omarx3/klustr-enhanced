import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { findMatches, nearestMatch, stepMatch, type TextMatch } from './yamlSearch'

// Just the editor surface the search needs, so the bar stays testable without
// Monaco and the YAML tab can pass its editor straight in.
type Position = { lineNumber: number; column: number }
type Range = { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
export type SearchableEditor = {
  getModel(): { getPositionAt(offset: number): Position; getOffsetAt(p: Position): number } | null
  getPosition(): Position | null
  setSelection(r: Range): void
  revealRangeInCenterIfOutsideViewport(r: Range): void
  createDecorationsCollection(d?: { range: Range; options: { inlineClassName: string } }[]): {
    set(d: { range: Range; options: { inlineClassName: string } }[]): void
    clear(): void
  }
}

type Props = {
  editor: SearchableEditor | null
  text: string
  onClose?: () => void
  // Bumped to focus the field, e.g. from Ctrl+F in the editor.
  focusRequest?: number
}

function rangeOf(editor: SearchableEditor, m: TextMatch): Range | null {
  const model = editor.getModel()
  if (!model) return null
  const a = model.getPositionAt(m.start)
  const b = model.getPositionAt(m.end)
  return { startLineNumber: a.lineNumber, startColumn: a.column, endLineNumber: b.lineNumber, endColumn: b.column }
}

export function YAMLSearchBar({ editor, text, onClose, focusRequest = 0 }: Props) {
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => findMatches(text, query), [text, query])
  const decorations = useRef<ReturnType<SearchableEditor['createDecorationsCollection']> | null>(null)

  useEffect(() => {
    if (focusRequest > 0) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [focusRequest])

  // A new query or edited text re-anchors on the first match at the caret.
  const [anchoredFor, setAnchoredFor] = useState<TextMatch[] | null>(null)
  if (anchoredFor !== matches) {
    setAnchoredFor(matches)
    const model = editor?.getModel()
    const pos = editor?.getPosition()
    const offset = model && pos ? model.getOffsetAt(pos) : 0
    setCurrent(nearestMatch(matches, offset))
  }

  useEffect(() => {
    if (!editor) return
    decorations.current ??= editor.createDecorationsCollection()
    const all = matches.flatMap((m, i) => {
      const range = rangeOf(editor, m)
      return range
        ? [{ range, options: { inlineClassName: i === current ? 'yaml-search-current' : 'yaml-search-match' } }]
        : []
    })
    decorations.current.set(all)
  }, [editor, matches, current])

  useEffect(() => () => decorations.current?.clear(), [])

  const go = (delta: 1 | -1) => {
    if (!editor || matches.length === 0) return
    const next = stepMatch(current, matches.length, delta)
    setCurrent(next)
    const range = rangeOf(editor, matches[next])
    if (!range) return
    editor.setSelection(range)
    editor.revealRangeInCenterIfOutsideViewport(range)
  }

  const count = matches.length
  const status = !query ? '' : count === 0 ? 'No results' : `${current + 1} of ${count}`

  return (
    <div role="search" className="flex items-center gap-1.5 border-b border-border px-4 py-1.5 text-xs">
      <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            go(e.shiftKey ? -1 : 1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            go(1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            go(-1)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (query) setQuery('')
            else onClose?.()
          }
        }}
        placeholder="Search YAML"
        aria-label="Search YAML"
        spellCheck={false}
        className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <span
        aria-live="polite"
        className={`w-20 shrink-0 text-right tabular-nums ${query && count === 0 ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {status}
      </span>
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={count === 0}
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronUp className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={count === 0}
        aria-label="Next match"
        title="Next match (Enter)"
        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronDown className="size-3.5" aria-hidden />
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

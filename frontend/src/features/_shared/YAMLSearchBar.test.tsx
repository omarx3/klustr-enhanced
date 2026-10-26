import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YAMLSearchBar, type SearchableEditor } from './YAMLSearchBar'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const TEXT = 'name: web\nimage: web:1\nlabels:\n  app: web\n'

// A line/column model over TEXT, enough for the bar's offset math.
function fakeEditor() {
  const lineStarts = [0, ...[...TEXT].flatMap((c, i) => (c === '\n' ? [i + 1] : []))]
  const toPos = (offset: number) => {
    let line = 0
    while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line++
    return { lineNumber: line + 1, column: offset - lineStarts[line] + 1 }
  }
  const decorations = { set: vi.fn(), clear: vi.fn() }
  const editor = {
    getModel: () => ({
      getPositionAt: toPos,
      getOffsetAt: (p: { lineNumber: number; column: number }) => lineStarts[p.lineNumber - 1] + p.column - 1,
    }),
    getPosition: () => ({ lineNumber: 1, column: 1 }),
    setSelection: vi.fn(),
    revealRangeInCenterIfOutsideViewport: vi.fn(),
    createDecorationsCollection: vi.fn(() => decorations),
  }
  return { editor: editor as SearchableEditor & typeof editor, decorations }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function key(input: HTMLInputElement, k: string, shiftKey = false) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }))
  })
}

const status = () => container.querySelector('[aria-live]')!.textContent
const selectedLine = (editor: ReturnType<typeof fakeEditor>['editor']) =>
  editor.setSelection.mock.lastCall?.[0].startLineNumber

describe('YAMLSearchBar', () => {
  it('counts matches and the up and down arrows step through them, wrapping', () => {
    const { editor } = fakeEditor()
    act(() => root.render(<YAMLSearchBar editor={editor} text={TEXT} />))
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search YAML"]')!
    type(input, 'web')
    expect(status()).toBe('1 of 3')

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next match"]')!.click())
    expect(status()).toBe('2 of 3')
    expect(selectedLine(editor)).toBe(2)
    expect(editor.revealRangeInCenterIfOutsideViewport).toHaveBeenCalled()

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next match"]')!.click())
    expect(selectedLine(editor)).toBe(4)
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next match"]')!.click())
    expect(status()).toBe('1 of 3')
    expect(selectedLine(editor)).toBe(1)

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Previous match"]')!.click())
    expect(status()).toBe('3 of 3')
    expect(selectedLine(editor)).toBe(4)
  })

  it('keyboard: Enter and ArrowDown go next, Shift+Enter and ArrowUp go back', () => {
    const { editor } = fakeEditor()
    act(() => root.render(<YAMLSearchBar editor={editor} text={TEXT} />))
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search YAML"]')!
    type(input, 'web')
    key(input, 'Enter')
    expect(status()).toBe('2 of 3')
    key(input, 'ArrowDown')
    expect(status()).toBe('3 of 3')
    key(input, 'ArrowUp')
    expect(status()).toBe('2 of 3')
    key(input, 'Enter', true)
    expect(status()).toBe('1 of 3')
  })

  it('highlights every match and marks the current one', () => {
    const { editor, decorations } = fakeEditor()
    act(() => root.render(<YAMLSearchBar editor={editor} text={TEXT} />))
    type(container.querySelector<HTMLInputElement>('input')!, 'web')
    const last = decorations.set.mock.lastCall![0] as { options: { inlineClassName: string } }[]
    expect(last.map((d) => d.options.inlineClassName)).toEqual([
      'yaml-search-current',
      'yaml-search-match',
      'yaml-search-match',
    ])
  })

  it('reports no results and disables the arrows', () => {
    const { editor } = fakeEditor()
    act(() => root.render(<YAMLSearchBar editor={editor} text={TEXT} />))
    type(container.querySelector<HTMLInputElement>('input')!, 'nope')
    expect(status()).toBe('No results')
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next match"]')!.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Previous match"]')!.disabled).toBe(true)
  })

  it('Escape clears the query, then closes', () => {
    const onClose = vi.fn()
    const { editor } = fakeEditor()
    act(() => root.render(<YAMLSearchBar editor={editor} text={TEXT} onClose={onClose} />))
    const input = container.querySelector<HTMLInputElement>('input')!
    type(input, 'web')
    key(input, 'Escape')
    expect(input.value).toBe('')
    expect(onClose).not.toHaveBeenCalled()
    key(input, 'Escape')
    expect(onClose).toHaveBeenCalled()
  })
})

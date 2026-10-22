import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/ui'
import { FONT_SCALE_DEFAULT, steppedFontScale } from '@/store/ui.persistence'

export type FontScaleKey = 'in' | 'out' | 'reset'

// Maps a keydown to a zoom step. Ctrl (Cmd on macOS) with "=" or "+" grows,
// "-" shrinks and "0" resets; e.code covers the numpad and layouts where the
// shifted key is reported instead.
export function fontScaleKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): FontScaleKey | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') return 'in'
  if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') return 'out'
  if (e.key === '0' || e.code === 'Numpad0') return 'reset'
  return null
}

// Installs the app-wide Ctrl+= / Ctrl+- / Ctrl+0 shortcuts. The listener runs
// in the capture phase so the keys work while an editor or terminal has
// focus; xterm would otherwise send Ctrl+- to the shell as ^_.
export function useFontScaleShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = fontScaleKey(e)
      if (!step) return
      e.preventDefault()
      e.stopPropagation()
      const { fontScale, setFontScale } = useUIStore.getState()
      setFontScale(step === 'reset' ? FONT_SCALE_DEFAULT : steppedFontScale(fontScale, step === 'in' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

// Monaco and xterm size their text in pixels, outside the rem cascade, so
// they read the scale and multiply their own base size.
export function useScaledFontSize(base: number): number {
  const scale = useUIStore((s) => s.fontScale)
  return Math.round(base * scale)
}

// Non-reactive read for code that builds a terminal inside an effect.
export function scaledFontSize(base: number): number {
  return Math.round(base * useUIStore.getState().fontScale)
}

type XtermLike = { cols: number; rows: number; options: { fontSize?: number } }
type FitLike = { fit(): void }

// Keeps an xterm instance at the scaled size. A new font size changes how
// many cells fit, so the terminal is refit and onResized lets a shell session
// tell the remote side about the new geometry. Declare it after the effect
// that creates the terminal so the refs are set on the first run.
export function useXtermFontSize(
  termRef: { current: XtermLike | null },
  fitRef: { current: FitLike | null },
  base: number,
  onResized?: (cols: number, rows: number) => void,
) {
  const size = useScaledFontSize(base)
  const onResizedRef = useRef(onResized)
  useEffect(() => {
    onResizedRef.current = onResized
  })
  useEffect(() => {
    const term = termRef.current
    if (!term || term.options.fontSize === size) return
    term.options.fontSize = size
    try {
      fitRef.current?.fit()
    } catch {
      // A hidden host has no size to fit to; the ResizeObserver refits later.
      return
    }
    onResizedRef.current?.(term.cols, term.rows)
  }, [size, termRef, fitRef])
}

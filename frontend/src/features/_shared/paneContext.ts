import { createContext, useContext } from 'react'
import type { Pane } from '@/store/ui'

// Which workspace pane a list renders in. Lists outside any split (detail
// tabs, dialogs) report 'primary', so their behavior is unchanged.
export const PaneContext = createContext<Pane>('primary')

export function usePane(): Pane {
  return useContext(PaneContext)
}

// The pane the user last interacted with. Keyboard shortcuts that target "the"
// list (the / filter shortcut) go to this pane when the view is split.
let focusedPane: Pane = 'primary'

export function setFocusedPane(pane: Pane): void {
  focusedPane = pane
}

export function getFocusedPane(): Pane {
  return focusedPane
}

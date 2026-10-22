import { isEditableTarget, isOverlayOpen } from '@/lib/dom'
import type { ResourceView, ViewTab } from './ui.types'

export function sameTab(a: ViewTab, b: ViewTab): boolean {
  if (a.kind === 'view') return b.kind === 'view' && a.view === b.view
  return b.kind === 'crd' && a.key === b.key
}

export function activeTab(s: { selectedView: ResourceView; selectedCRDKey: string | null }): ViewTab {
  return s.selectedCRDKey ? { kind: 'crd', key: s.selectedCRDKey } : { kind: 'view', view: s.selectedView }
}

// withTab returns tabs unchanged when the tab is already open, so a view that
// has a tab is switched to rather than opened twice.
export function withTab(tabs: readonly ViewTab[], tab: ViewTab): ViewTab[] {
  return tabs.some((t) => sameTab(t, tab)) ? (tabs as ViewTab[]) : [...tabs, tab]
}

export function tabIndex(tabs: readonly ViewTab[], tab: ViewTab): number {
  return tabs.findIndex((t) => sameTab(t, tab))
}

// The tab delta steps away from the current one, wrapping at both ends.
export function cycledTab(tabs: readonly ViewTab[], current: ViewTab, delta: number): ViewTab | null {
  if (tabs.length < 2) return null
  const i = tabIndex(tabs, current)
  const start = i >= 0 ? i : 0
  return tabs[(((start + delta) % tabs.length) + tabs.length) % tabs.length]
}

// After closing a tab, the one that took its place is activated, or the new
// last tab when the closed one was last. Closing the only tab leaves Overview.
export function afterClose(
  tabs: readonly ViewTab[],
  closed: ViewTab,
): { tabs: ViewTab[]; next: ViewTab } | null {
  const i = tabIndex(tabs, closed)
  if (i < 0) return null
  const rest = tabs.filter((_, j) => j !== i)
  if (rest.length === 0) {
    const overview: ViewTab = { kind: 'view', view: 'overview' }
    return { tabs: [overview], next: overview }
  }
  return { tabs: rest, next: rest[Math.min(i, rest.length - 1)] }
}

// Alt+Left/Right cycles tabs everywhere except where Alt+arrows already mean
// something: word movement in text fields, Monaco and the shell, and Radix
// overlays, which don't stop keys bubbling out.
export function tabCycleDelta(e: KeyboardEvent): number | null {
  if (e.defaultPrevented) return null
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return null
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return null
  if (isEditableTarget(e.target)) return null
  if (e.target instanceof Element && e.target.closest('.monaco-editor, .xterm')) return null
  if (isOverlayOpen()) return null
  return e.key === 'ArrowRight' ? 1 : -1
}

// The split pane may not shrink below 15% of the workspace on either side,
// so neither list ever collapses to an unusable sliver.
export const SPLIT_RATIO_MIN = 0.15
export const SPLIT_RATIO_MAX = 0.85

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  // Rounded to 0.1%: enough precision for a divider, and keyboard steps of
  // 5% stay exact instead of drifting (0.5 + 0.05 = 0.55000000000000004).
  return Math.round(Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio)) * 1000) / 1000
}

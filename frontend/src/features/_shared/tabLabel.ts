import { BellRing, Puzzle } from 'lucide-react'
import { ALL_SIDEBAR_GROUPS, type SidebarIcon } from '@/features/_shared/resourceGroups'
import type { ResourceView, ViewTab } from '@/store/ui'

export type TabMeta = { label: string; icon?: SidebarIcon }

// Sidebar labels repeat across groups ("Overview"), so a repeated label is
// qualified with its group to keep tabs distinguishable.
function buildViewMeta(): Map<ResourceView, TabMeta> {
  const counts = new Map<string, number>()
  for (const g of ALL_SIDEBAR_GROUPS)
    for (const i of g.items) if (i.view) counts.set(i.label, (counts.get(i.label) ?? 0) + 1)
  const out = new Map<ResourceView, TabMeta>()
  for (const g of ALL_SIDEBAR_GROUPS) {
    for (const i of g.items) {
      if (!i.view || out.has(i.view)) continue
      const label = (counts.get(i.label) ?? 0) > 1 && g.label !== 'Cluster' ? `${g.label} ${i.label}` : i.label
      out.set(i.view, { label, icon: i.icon })
    }
  }
  // Opened from the top bar rather than the sidebar.
  out.set('monitor', { label: 'Monitor', icon: BellRing })
  return out
}

const VIEW_META = buildViewMeta()

// Label and icon for a tab, shared by the tab strip and the split pane header.
export function tabLabel(tab: ViewTab, crdByKey: Record<string, { kind: string } | undefined>): TabMeta {
  if (tab.kind === 'view') return VIEW_META.get(tab.view) ?? { label: tab.view }
  const crd = crdByKey[tab.key]
  return { label: crd?.kind ?? tab.key.split('/')[1] ?? tab.key, icon: Puzzle }
}

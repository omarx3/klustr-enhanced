import { useCallback } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_DARK, DEFAULT_LIGHT, getTheme, type ThemeId } from '@/features/_shared/themes'
import { ALL_RESOURCE_VIEWS } from '@/features/_shared/resourceGroups'
import {
  MAX_TAGS_PER_CONTEXT,
  type ContextGroup,
  type ContextHealth,
  type ContextTag,
  type CustomTagDef,
  type DetailTab,
  type LastSession,
  type PendingAction,
  type ResourceView,
  type ResourceHistoryEntry,
  type SelectedResource,
  type SidebarMode,
  type ViewTab,
  type SplitDirection,
  type SplitView,
} from './ui.types'
import { activeTab, afterClose, clampSplitRatio, cycledTab, sameTab, withTab } from './viewTabs'
import {
  applyThemeClasses,
  clampDetailWidth,
  clampSidebarWidth,
  isValidGroupColor,
  persistAggregatedContexts,
  persistCollapsedNavGroups,
  persistContextGroups,
  persistContextTags,
  persistContextDisplayNames,
  persistCustomTags,
  persistDefaultContext,
  persistHiddenSidebarItemsByContext,
  persistLastSession,
  persistSidebarMode,
  persistSidebarWidth,
  persistDetailWidth,
  persistThemeId,
  readAggregatedContexts,
  readNamespacesByContext,
  persistNamespacesByContext,
  readGlobalReadOnly,
  persistGlobalReadOnly,
  readLogWrap,
  persistLogWrap,
  readCollapsedNavGroups,
  readContextGroups,
  readContextTags,
  readContextDisplayNames,
  readCustomTags,
  readDefaultContext,
  readExpandedClusters,
  persistExpandedClusters,
  readFavouriteClusters,
  persistFavouriteClusters,
  readExpandedClusterGroups,
  persistExpandedClusterGroups,
  clusterGroupKey,
  readHiddenSidebarItemsByContext,
  readLastSession,
  readSavedThemeId,
  readSidebarMode,
  readSidebarWidth,
  readDetailWidth,
  readHomeLayout,
  persistHomeLayout,
  type HomeLayout,
  readFontScale,
  persistFontScale,
  applyFontScale,
  clampFontScale,
  systemThemeId,
} from './ui.persistence'

export {
  MAX_TAGS_PER_CONTEXT,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from './ui.types'
export type {
  ContextGroup,
  ContextTag,
  CustomTagDef,
  DetailTab,
  LastSession,
  PendingAction,
  ResourceKind,
  ResourceView,
  SelectedResource,
  SelectedResourceGVR,
  SidebarMode,
  TagColor,
  ViewTab,
  SplitDirection,
  SplitView,
  Pane,
} from './ui.types'

type UIState = {
  contextHealth: Record<string, ContextHealth>
  setContextHealth: (update: (previous: Record<string, ContextHealth>) => Record<string, ContextHealth>) => void
  selectedContext: string | null
  aggregatedContexts: string[]
  activeGroupId: string | null
  selectedNamespaces: string[]
  namespacesByContext: Record<string, string[]>
  globalReadOnly: boolean
  logWrap: boolean
  selectedView: ResourceView
  selectedCRDKey: string | null
  openTabs: ViewTab[]
  selectedResource: SelectedResource | null
  lastSelectedResource: SelectedResource | null
  resourceNavStack: ResourceHistoryEntry[]
  requestedTab: DetailTab | null
  detailRequestId: number
  activeDetailTab: string
  detailWidth: number
  detailExpanded: boolean
  detailDirty: boolean
  detailOutsideResults: boolean
  pendingDetailNavigation: (() => void) | null
  detailDiscardRequest: number
  pendingAction: PendingAction | null
  themeId: ThemeId
  sidebarMode: SidebarMode
  sidebarWidth: number
  collapsedNavGroups: string[]
  // Kubeconfig contexts whose resource tree is open in the sidebar. Expanding
  // is display only; a cluster connects when one of its views is opened.
  expandedClusters: string[]
  // Kubeconfig contexts starred in the sidebar; they list first.
  favouriteClusters: string[]
  toggleFavouriteCluster: (name: string) => void
  // Resource groups open inside a cluster's tree, keyed by clusterGroupKey.
  expandedClusterGroups: string[]
  hiddenSidebarItemsByContext: Record<string, ResourceView[]>
  defaultContext: string | null
  contextTags: Record<string, ContextTag[]>
  // User-chosen labels keyed by kubeconfig context name. Display only: every
  // API call, persisted key and store lookup keeps using the kubeconfig name.
  contextDisplayNames: Record<string, string>
  customTags: Record<string, CustomTagDef>
  contextGroups: ContextGroup[]
  lastSession: LastSession | null
  clearLastSession: () => void
  setSelectedContext: (name: string | null) => void
  setAggregatedContexts: (names: string[], groupId?: string | null) => void
  toggleAggregatedContext: (name: string) => void
  clearAggregatedContexts: () => void
  setSelectedNamespaces: (names: string[]) => void
  toggleSelectedNamespace: (name: string) => void
  clearSelectedNamespaces: () => void
  setGlobalReadOnly: (value: boolean) => void
  setLogWrap: (value: boolean) => void
  setSelectedView: (view: ResourceView) => void
  setSelectedCRD: (key: string | null) => void
  selectTab: (tab: ViewTab) => void
  browseTo: (tab: ViewTab) => void
  closeTab: (tab: ViewTab) => void
  cycleTab: (delta: number) => void
  setSelectedResource: (resource: SelectedResource | null) => void
  closeRemovedResource: (resource: SelectedResource) => void
  openResourceInView: (view: ResourceView, resource: SelectedResource) => void
  // Opens a resource of any kubeconfig context in its list view on the given
  // detail tab, switching to that context first when it is not active.
  goToResource: (view: ResourceView, resource: SelectedResource & { context: string }, tab?: DetailTab) => void
  openResource: (resource: SelectedResource, tab?: DetailTab) => void
  openResourceFromList: (resource: SelectedResource, tab?: DetailTab) => void
  goBackResource: () => void
  setActiveDetailTab: (tab: string) => void
  setDetailWidth: (width: number) => void
  setDetailExpanded: (expanded: boolean) => void
  setDetailDirty: (dirty: boolean) => void
  setDetailOutsideResults: (outside: boolean) => void
  requestDetailNavigation: (navigate: () => void) => void
  cancelDetailNavigation: () => void
  confirmDetailNavigation: () => void
  setPendingAction: (action: PendingAction | null) => void
  setTheme: (id: ThemeId) => void
  toggleSidebarMode: () => void
  setSidebarWidth: (px: number) => void
  toggleNavGroup: (label: string) => void
  toggleClusterExpanded: (name: string) => void
  expandClusters: (names: readonly string[]) => void
  toggleClusterGroup: (name: string, label: string) => void
  // Opens a tab under a cluster in the sidebar tree, switching to that
  // cluster first when it is not among the active contexts.
  openClusterTab: (name: string, tab: ViewTab, additive?: boolean) => void
  hideSidebarItem: (view: ResourceView, contexts?: readonly string[]) => void
  showSidebarItem: (view: ResourceView) => void
  clearHiddenSidebarItems: () => void
  setDefaultContext: (name: string | null) => void
  toggleContextTag: (name: string, tagId: string) => void
  clearContextTags: (name: string) => void
  setContextDisplayName: (name: string, displayName: string | null) => void
  addCustomTag: (def: CustomTagDef) => void
  removeCustomTag: (id: string) => void
  upsertContextGroup: (group: ContextGroup) => void
  removeContextGroup: (id: string) => void
  forgetContext: (name: string) => void
  // A second view shown beside (vertical) or below (horizontal) the active
  // tab. The primary pane keeps all existing behavior; the split pane is just
  // another list over the same contexts and namespace selection.
  split: SplitView | null
  openSplit: (tab: ViewTab, direction: SplitDirection) => void
  closeSplit: () => void
  setSplitDirection: (direction: SplitDirection) => void
  setSplitRatio: (ratio: number) => void
  swapSplit: () => void
  homeLayout: HomeLayout
  setHomeLayout: (layout: HomeLayout) => void
  fontScale: number
  setFontScale: (scale: number) => void
}

export function sameResource(a: SelectedResource, b: SelectedResource): boolean {
  // context and gvr are part of the identity: in aggregated mode the same
  // namespace/name can exist in two clusters, and two CRDs can share a kind
  // name across API groups.
  return (
    a.kind === b.kind &&
    a.namespace === b.namespace &&
    a.name === b.name &&
    a.context === b.context &&
    a.gvr?.group === b.gvr?.group &&
    a.gvr?.version === b.gvr?.version &&
    a.gvr?.resource === b.gvr?.resource
  )
}

function dedupeSorted(names: readonly string[]): string[] {
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
}

type ContextSlice = Pick<UIState, 'selectedContext' | 'aggregatedContexts'>

function effectiveContextList(s: ContextSlice): string[] {
  if (s.aggregatedContexts.length > 0) return s.aggregatedContexts
  return s.selectedContext ? [s.selectedContext] : []
}

// Key under which a namespace selection is remembered: the active contexts
// (already sorted) joined. Single-context mode keys by the context's name.
function namespaceKey(contexts: readonly string[]): string {
  return contexts.join('\n')
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((n, i) => b[i] === n)
}

// Re-selecting the inspected resource keeps its object unless a row snapshot
// field changed, so the memoized inspector and the list's effects don't re-run.
function sameSnapshot(a: SelectedResource, b: SelectedResource): boolean {
  return a.suspended === b.suspended && a.logContainer === b.logContainer
}

// Terminal tabs open a session, so they never reconnect on their own when
// moving between resources or returning through history. Every other tab is
// a reading tab, including integration tabs added later; each detail body
// falls back to its default for a tab it does not have.
const CONNECTING_TABS: ReadonlySet<string> = new Set<DetailTab>(['exec', 'shell'])

function readingDetailTab(tab: string): DetailTab | null {
  return CONNECTING_TABS.has(tab) ? null : (tab as DetailTab)
}

function retainedDetailTab(s: UIState, resource: SelectedResource | null): DetailTab | null {
  const current = s.selectedResource
  if (!current || !resource || current.kind !== resource.kind ||
    current.gvr?.group !== resource.gvr?.group || current.gvr?.resource !== resource.gvr?.resource) return null
  return readingDetailTab(s.activeDetailTab)
}

type NormalizedContexts = {
  selectedContext: string | null
  aggregatedContexts: string[]
  activeGroupId: string | null
  selectedNamespaces: string[]
  selectedCRDKey: string | null
  openTabs: ViewTab[]
  selectedResource: SelectedResource | null
  lastSelectedResource: SelectedResource | null
  resourceNavStack: ResourceHistoryEntry[]
  requestedTab: DetailTab | null
  detailOutsideResults: boolean
  split: SplitView | null
}

// normalizeContexts also re-applies the namespace selection saved for the
// newly active context set, so switching clusters restores that cluster's
// filter (and an unseen cluster defaults to all namespaces).
// CRD tabs are dropped because the new context set may not serve them, and
// the CRD selection is cleared with them, as is a CRD split pane. Leaving
// every cluster closes the split.
function normalizeContexts(
  next: readonly string[],
  namespacesByContext: Record<string, string[]>,
  s: Pick<UIState, 'openTabs' | 'selectedView' | 'split'>,
): NormalizedContexts {
  const sortedNext = dedupeSorted(next)
  const aggregatedNext = sortedNext.length >= 2 ? sortedNext : []
  const selectedNext = sortedNext.length === 1 ? sortedNext[0] : null
  persistAggregatedContexts(aggregatedNext)
  const activeNext = aggregatedNext.length > 0 ? aggregatedNext : selectedNext ? [selectedNext] : []
  return {
    selectedContext: selectedNext,
    aggregatedContexts: aggregatedNext,
    activeGroupId: null,
    selectedNamespaces: namespacesByContext[namespaceKey(activeNext)] ?? [],
    selectedCRDKey: null,
    openTabs: withTab(
      s.openTabs.filter((t) => t.kind === 'view'),
      { kind: 'view', view: s.selectedView },
    ),
    selectedResource: null,
    lastSelectedResource: null,
    resourceNavStack: [],
    requestedTab: null,
    detailOutsideResults: false,
    split: s.split && s.split.tab.kind === 'view' && next.length > 0 ? s.split : null,
  }
}

// applyNamespaceSelection updates the effective selection and saves it under
// the active context set (clearing the key when the selection is empty, since
// "all namespaces" is the default and need not be stored).
function applyNamespaceSelection(
  s: Pick<UIState, 'selectedContext' | 'aggregatedContexts' | 'namespacesByContext'>,
  next: string[],
): Pick<UIState, 'selectedNamespaces' | 'namespacesByContext'> {
  const key = namespaceKey(effectiveContextList(s))
  if (!key) return { selectedNamespaces: next, namespacesByContext: s.namespacesByContext }
  const map = { ...s.namespacesByContext }
  if (next.length === 0) delete map[key]
  else map[key] = next
  persistNamespacesByContext(map)
  return { selectedNamespaces: next, namespacesByContext: map }
}

export const useUIStore = create<UIState>((set, get) => {
  const navigate = (action: () => void) => {
    if (!get().detailDirty) action()
    // The discard dialog blocks clicks, so a request arriving while it is open
    // comes from async work (a resolved lookup) and must not replace the
    // destination the user is deciding on.
    else if (!get().pendingDetailNavigation) set({ pendingDetailNavigation: action })
  }
  // Following a reference from the inspector records the current resource for
  // Back. Opening another row from the list starts over, as a row click does.
  const openWithTab = (resource: SelectedResource, tab: DetailTab | undefined, recordHistory: boolean) => {
    const current = get().selectedResource
    const containerRequest = tab === 'logs' && resource.logContainer !== undefined
    if (current && sameResource(current, resource) && (!tab || tab === get().activeDetailTab) && !containerRequest) {
      if (!sameSnapshot(current, resource)) set({ selectedResource: resource })
      return
    }
    navigate(() => set((s) => {
      const same = !!s.selectedResource && sameResource(s.selectedResource, resource)
      return {
        resourceNavStack:
          same ? s.resourceNavStack
            : recordHistory && s.selectedResource
              ? [...s.resourceNavStack, { resource: s.selectedResource, tab: readingDetailTab(s.activeDetailTab) }]
              : [],
        selectedResource: resource,
        detailOutsideResults: false,
        lastSelectedResource: resource,
        requestedTab: tab ?? retainedDetailTab(s, resource),
        // Repeated requests must remain observable after manual tab/container changes.
        detailRequestId: s.detailRequestId + 1,
      }
    }))
  }
  const saved = readSavedThemeId()
  const initialThemeId = saved ?? systemThemeId()
  applyThemeClasses(getTheme(initialThemeId))
  const initialFontScale = readFontScale()
  applyFontScale(initialFontScale)

  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = (e: MediaQueryListEvent) => {
    const next = e.matches ? DEFAULT_DARK : DEFAULT_LIGHT
    applyThemeClasses(getTheme(next))
    set({ themeId: next })
  }
  let followingSystem = saved === null
  if (followingSystem) {
    mql.addEventListener('change', onSystemChange)
  }

  const initialDefaultContext = readDefaultContext()
  const initialAggregatedContexts = readAggregatedContexts()
  const aggregatedAtBoot = initialAggregatedContexts.length >= 2 ? initialAggregatedContexts : []
  const selectedAtBoot = aggregatedAtBoot.length > 0 ? null : initialDefaultContext
  const namespacesByContext = readNamespacesByContext()
  const activeAtBoot = aggregatedAtBoot.length > 0 ? aggregatedAtBoot : selectedAtBoot ? [selectedAtBoot] : []

  // Validate persisted hidden views against the live set, dropping ids whose
  // view was renamed or removed across releases instead of force-casting them.
  const hiddenSidebarItemsByContext: Record<string, ResourceView[]> = {}
  for (const [ctx, list] of Object.entries(readHiddenSidebarItemsByContext())) {
    const valid = list.filter((v): v is ResourceView => ALL_RESOURCE_VIEWS.has(v as ResourceView))
    if (valid.length > 0) hiddenSidebarItemsByContext[ctx] = valid
  }

  return {
    contextHealth: {},
    setContextHealth: (update) => set((s) => {
      const contextHealth = update(s.contextHealth)
      return contextHealth === s.contextHealth ? s : { contextHealth }
    }),
    selectedContext: selectedAtBoot,
    aggregatedContexts: aggregatedAtBoot,
    activeGroupId: null,
    selectedNamespaces: namespacesByContext[namespaceKey(activeAtBoot)] ?? [],
    namespacesByContext,
    globalReadOnly: readGlobalReadOnly(),
    logWrap: readLogWrap(),
    selectedView: 'overview',
    selectedCRDKey: null,
    openTabs: [{ kind: 'view', view: 'overview' }],
    selectedResource: null,
    lastSelectedResource: null,
    resourceNavStack: [],
    requestedTab: null,
    detailRequestId: 0,
    activeDetailTab: 'overview',
    detailWidth: readDetailWidth(),
    detailExpanded: false,
    detailDirty: false,
    detailOutsideResults: false,
    pendingDetailNavigation: null,
    detailDiscardRequest: 0,
    pendingAction: null,
    themeId: initialThemeId,
    sidebarMode: readSidebarMode(),
    sidebarWidth: readSidebarWidth(),
    collapsedNavGroups: readCollapsedNavGroups(),
    hiddenSidebarItemsByContext,
    expandedClusters: readExpandedClusters(),
    favouriteClusters: readFavouriteClusters(),
    toggleFavouriteCluster: (name) =>
      set((s) => {
        const next = s.favouriteClusters.includes(name)
          ? s.favouriteClusters.filter((n) => n !== name)
          : [...s.favouriteClusters, name]
        persistFavouriteClusters(next)
        return { favouriteClusters: next }
      }),
    toggleClusterExpanded: (name) =>
      set((s) => {
        const next = s.expandedClusters.includes(name)
          ? s.expandedClusters.filter((n) => n !== name)
          : [...s.expandedClusters, name]
        persistExpandedClusters(next)
        return { expandedClusters: next }
      }),
    expandClusters: (names) =>
      set((s) => {
        const added = names.filter((n) => !s.expandedClusters.includes(n))
        if (added.length === 0) return s
        const next = [...s.expandedClusters, ...added]
        persistExpandedClusters(next)
        return { expandedClusters: next }
      }),
    expandedClusterGroups: readExpandedClusterGroups(),
    toggleClusterGroup: (name, label) =>
      set((s) => {
        const key = clusterGroupKey(name, label)
        const next = s.expandedClusterGroups.includes(key)
          ? s.expandedClusterGroups.filter((k) => k !== key)
          : [...s.expandedClusterGroups, key]
        persistExpandedClusterGroups(next)
        return { expandedClusterGroups: next }
      }),
    // Both steps run inside one guarded navigation: once the discard prompt
    // is confirmed the detail is clean, so the nested calls apply directly.
    // additive adds the cluster to the active set instead of replacing it.
    openClusterTab: (name, tab, additive) =>
      navigate(() => {
        const current = effectiveContextList(get())
        if (!current.includes(name)) {
          if (additive && current.length > 0) get().setAggregatedContexts([...current, name])
          else get().setSelectedContext(name)
        }
        get().selectTab(tab)
      }),
    defaultContext: initialDefaultContext,
    contextTags: readContextTags(),
    contextDisplayNames: readContextDisplayNames(),
    customTags: readCustomTags(),
    contextGroups: readContextGroups(),
    lastSession: readLastSession(),
    homeLayout: readHomeLayout(),
    fontScale: initialFontScale,
    setFontScale: (scale) => {
      const next = clampFontScale(scale)
      if (next === get().fontScale) return
      persistFontScale(next)
      applyFontScale(next)
      set({ fontScale: next })
    },
    split: null,
    openSplit: (tab, direction) => {
      const s = get()
      // Splitting a view with itself would show the same list twice.
      if (sameTab(tab, activeTab(s))) return
      set({
        split: { tab, direction, ratio: s.split?.ratio ?? 0.5 },
        openTabs: withTab(s.openTabs, tab),
      })
    },
    closeSplit: () => set({ split: null }),
    setSplitDirection: (direction) =>
      set((s) => (s.split && s.split.direction !== direction ? { split: { ...s.split, direction } } : s)),
    setSplitRatio: (ratio) =>
      set((s) => (s.split ? { split: { ...s.split, ratio: clampSplitRatio(ratio) } } : s)),
    swapSplit: () => {
      const s = get()
      if (!s.split) return
      const primary = activeTab(s)
      const secondary = s.split.tab
      navigate(() => set({
        split: { ...s.split!, tab: primary },
        selectedView: secondary.kind === 'view' ? secondary.view : s.selectedView,
        selectedCRDKey: secondary.kind === 'crd' ? secondary.key : null,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      }))
    },
    setHomeLayout: (layout) => {
      persistHomeLayout(layout)
      set({ homeLayout: layout })
    },
    setSelectedContext: (name) => {
      if (sameList(name ? [name] : [], effectiveContextList(get()))) return
      navigate(() => set((s) => {
        const next = name ? [name] : []
        if (sameList(next, effectiveContextList(s))) return s
        const out = normalizeContexts(next, s.namespacesByContext, s)
        if (name) {
          const ls: LastSession = { contexts: [name], groupId: null, at: Date.now() }
          persistLastSession(ls)
          return { ...out, lastSession: ls }
        }
        return out
      }))
    },
    setAggregatedContexts: (names, groupId) => {
      const next = dedupeSorted(names)
      const nextGroup = groupId ?? null
      if (sameList(next, effectiveContextList(get())) && get().activeGroupId === nextGroup) return
      navigate(() => set((s) => {
        if (sameList(next, effectiveContextList(s)) && s.activeGroupId === nextGroup) return s
        const out = { ...normalizeContexts(next, s.namespacesByContext, s), activeGroupId: nextGroup }
        if (next.length > 0) {
          const ls: LastSession = { contexts: next, groupId: nextGroup, at: Date.now() }
          persistLastSession(ls)
          return { ...out, lastSession: ls }
        }
        return out
      }))
    },
    clearLastSession: () => {
      persistLastSession(null)
      set({ lastSession: null })
    },
    toggleAggregatedContext: (name) => navigate(() =>
      set((s) => {
        const current = effectiveContextList(s)
        const next = current.includes(name)
          ? current.filter((n) => n !== name)
          : dedupeSorted([...current, name])
        if (sameList(next, current)) return s
        return normalizeContexts(next, s.namespacesByContext, s)
      })),
    clearAggregatedContexts: () => {
      if (effectiveContextList(get()).length === 0) return
      navigate(() => set((s) => {
        if (effectiveContextList(s).length === 0) return s
        return normalizeContexts([], s.namespacesByContext, s)
      }))
    },
    setSelectedNamespaces: (names) =>
      set((s) => applyNamespaceSelection(s, dedupeSorted(names))),
    toggleSelectedNamespace: (name) =>
      set((s) => {
        const has = s.selectedNamespaces.includes(name)
        const next = has
          ? s.selectedNamespaces.filter((n) => n !== name)
          : dedupeSorted([...s.selectedNamespaces, name])
        return applyNamespaceSelection(s, next)
      }),
    clearSelectedNamespaces: () => set((s) => applyNamespaceSelection(s, [])),
    setGlobalReadOnly: (value) => {
      persistGlobalReadOnly(value)
      set({ globalReadOnly: value })
    },
    setLogWrap: (value) => {
      persistLogWrap(value)
      set({ logWrap: value })
    },
    setSelectedView: (view) => {
      if (get().selectedView === view && get().selectedCRDKey === null) return
      navigate(() => set((s) => ({
        selectedView: view,
        selectedCRDKey: null,
        openTabs: withTab(s.openTabs, { kind: 'view', view }),
        split: s.split && sameTab(s.split.tab, { kind: 'view', view }) ? null : s.split,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      })))
    },
    setSelectedCRD: (key) => {
      if (get().selectedCRDKey === key) return
      navigate(() => set((s) => ({
        selectedCRDKey: key,
        openTabs: key
          ? withTab(s.openTabs, { kind: 'crd', key })
          : withTab(s.openTabs, { kind: 'view', view: s.selectedView }),
        split: key && s.split && sameTab(s.split.tab, { kind: 'crd', key }) ? null : s.split,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      })))
    },
    browseTo: (entry) => {
      const s = get()
      const current = activeTab(s)
      if (sameTab(current, entry)) return
      // Arrow browsing walks the sidebar one view at a time; opening a tab for
      // each step would flood the strip, so the active tab is retargeted.
      // A destination that already has a tab just switches to it.
      const i = s.openTabs.findIndex((t) => sameTab(t, current))
      const open = s.openTabs.some((t) => sameTab(t, entry))
      const openTabs = open || i < 0
        ? withTab(s.openTabs, entry)
        : s.openTabs.map((t, j) => (j === i ? entry : t))
      navigate(() => set({
        openTabs,
        split: s.split && sameTab(s.split.tab, entry) ? null : s.split,
        selectedView: entry.kind === 'view' ? entry.view : s.selectedView,
        selectedCRDKey: entry.kind === 'crd' ? entry.key : null,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      }))
    },
    selectTab: (tab) => {
      if (tab.kind === 'crd') get().setSelectedCRD(tab.key)
      else get().setSelectedView(tab.view)
    },
    closeTab: (tab) => {
      const s = get()
      const result = afterClose(s.openTabs, tab)
      if (!result) return
      // The split pane shows an open tab; closing that tab closes the pane.
      const split = s.split && sameTab(s.split.tab, tab) ? null : s.split
      if (!sameTab(tab, activeTab(s))) {
        set({ openTabs: result.tabs, split })
        return
      }
      // Closing the active tab leaves its view, so an unsaved draft is guarded
      // like any other navigation. If the next tab is the split's own view,
      // it moves to the primary pane and the split closes.
      navigate(() => set({
        openTabs: result.tabs,
        split: split && sameTab(split.tab, result.next) ? null : split,
        selectedView: result.next.kind === 'view' ? result.next.view : s.selectedView,
        selectedCRDKey: result.next.kind === 'crd' ? result.next.key : null,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      }))
    },
    cycleTab: (delta) => {
      const s = get()
      const next = cycledTab(s.openTabs, activeTab(s), delta)
      if (next) s.selectTab(next)
    },
    setSelectedResource: (resource) => {
      const current = get().selectedResource
      if (resource && current && sameResource(resource, current)) {
        if (!sameSnapshot(current, resource)) set({ selectedResource: resource })
        return
      }
      navigate(() => set((s) => ({
        selectedResource: resource,
        detailOutsideResults: false,
        lastSelectedResource: resource ?? s.selectedResource ?? s.lastSelectedResource,
        resourceNavStack: [],
        requestedTab: retainedDetailTab(s, resource),
        detailRequestId: s.detailRequestId + 1,
      })))
    },
    closeRemovedResource: (resource) =>
      set((s) => {
        if (!s.selectedResource || !sameResource(s.selectedResource, resource)) return s
        // The object is gone, so its draft can no longer be applied: close
        // without the draft prompt, and drop a prompt already on screen.
        return {
          selectedResource: null,
          lastSelectedResource: s.selectedResource,
          resourceNavStack: [],
          requestedTab: null,
          detailRequestId: s.detailRequestId + 1,
          detailOutsideResults: false,
          detailDirty: false,
          pendingDetailNavigation: null,
        }
      }),
    openResourceInView: (view, resource) => {
      const s = get()
      if (s.selectedView === view && s.selectedCRDKey === null) {
        s.setSelectedResource(resource)
        return
      }
      // View and resource are one destination, including after a draft decision.
      navigate(() => set((s) => ({
        selectedView: view,
        selectedCRDKey: null,
        openTabs: withTab(s.openTabs, { kind: 'view', view }),
        selectedResource: resource,
        lastSelectedResource: resource,
        resourceNavStack: [],
        requestedTab: null,
        detailRequestId: s.detailRequestId + 1,
        detailOutsideResults: false,
      })))
    },
    goToResource: (view, resource, tab) =>
      navigate(() => {
        if (!effectiveContextList(get()).includes(resource.context)) get().setSelectedContext(resource.context)
        set((s) => ({
          selectedView: view,
          selectedCRDKey: null,
          openTabs: withTab(s.openTabs, { kind: 'view', view }),
          selectedResource: resource,
          lastSelectedResource: resource,
          resourceNavStack: [],
          requestedTab: tab ?? null,
          detailRequestId: s.detailRequestId + 1,
          detailOutsideResults: false,
        }))
      }),
    openResource: (resource, tab) => openWithTab(resource, tab, true),
    openResourceFromList: (resource, tab) => openWithTab(resource, tab, false),
    goBackResource: () => {
      if (get().resourceNavStack.length === 0) return
      navigate(() => set((s) => {
        if (s.resourceNavStack.length === 0) return s
        const next = s.resourceNavStack[s.resourceNavStack.length - 1]
        return {
          selectedResource: next.resource,
          lastSelectedResource: next.resource,
          resourceNavStack: s.resourceNavStack.slice(0, -1),
          requestedTab: next.tab,
          detailRequestId: s.detailRequestId + 1,
          detailOutsideResults: false,
        }
      }))
    },
    setActiveDetailTab: (activeDetailTab) => set({ activeDetailTab }),
    setDetailWidth: (value) => {
      const detailWidth = clampDetailWidth(value)
      persistDetailWidth(detailWidth)
      set({ detailWidth })
    },
    setDetailExpanded: (detailExpanded) => set({ detailExpanded }),
    setDetailDirty: (detailDirty) => set({ detailDirty }),
    // Lists report this on every informer update; an unchanged value must not
    // notify every store subscriber.
    setDetailOutsideResults: (detailOutsideResults) => {
      if (get().detailOutsideResults !== detailOutsideResults) set({ detailOutsideResults })
    },
    requestDetailNavigation: navigate,
    cancelDetailNavigation: () => set({ pendingDetailNavigation: null }),
    confirmDetailNavigation: () => {
      const action = get().pendingDetailNavigation
      // The editor drops its draft on this signal: a destination that keeps it
      // mounted (an unavailable tab, a no-op closure) must not leave an
      // unguarded draft behind.
      set((s) => ({ detailDirty: false, pendingDetailNavigation: null, detailDiscardRequest: s.detailDiscardRequest + 1 }))
      action?.()
    },
    setPendingAction: (action) => set({ pendingAction: action }),
    setTheme: (id) => {
      if (followingSystem) {
        mql.removeEventListener('change', onSystemChange)
        followingSystem = false
      }
      applyThemeClasses(getTheme(id))
      persistThemeId(id)
      set({ themeId: id })
    },
    toggleSidebarMode: () =>
      set((s) => {
        const next: SidebarMode = s.sidebarMode === 'expanded' ? 'icons' : 'expanded'
        persistSidebarMode(next)
        return { sidebarMode: next }
      }),
    setSidebarWidth: (px) =>
      set((s) => {
        const next = clampSidebarWidth(px)
        if (next === s.sidebarWidth) return s
        persistSidebarWidth(next)
        return { sidebarWidth: next }
      }),
    toggleNavGroup: (label) =>
      set((s) => {
        const next = s.collapsedNavGroups.includes(label)
          ? s.collapsedNavGroups.filter((g) => g !== label)
          : [...s.collapsedNavGroups, label]
        persistCollapsedNavGroups(next)
        return { collapsedNavGroups: next }
      }),
    hideSidebarItem: (view, contexts) =>
      set((s) => {
        const ctxs = contexts ?? effectiveContextList(s)
        if (ctxs.length === 0) return s
        const next = { ...s.hiddenSidebarItemsByContext }
        let changed = false
        for (const ctx of ctxs) {
          const list = next[ctx] ?? []
          if (list.includes(view)) continue
          next[ctx] = [...list, view]
          changed = true
        }
        if (!changed) return s
        persistHiddenSidebarItemsByContext(next)
        return { hiddenSidebarItemsByContext: next }
      }),
    showSidebarItem: (view) =>
      set((s) => {
        const ctxs = effectiveContextList(s)
        if (ctxs.length === 0) return s
        const next = { ...s.hiddenSidebarItemsByContext }
        let changed = false
        for (const ctx of ctxs) {
          const list = next[ctx]
          if (!list || !list.includes(view)) continue
          const filtered = list.filter((v) => v !== view)
          if (filtered.length === 0) delete next[ctx]
          else next[ctx] = filtered
          changed = true
        }
        if (!changed) return s
        persistHiddenSidebarItemsByContext(next)
        return { hiddenSidebarItemsByContext: next }
      }),
    clearHiddenSidebarItems: () =>
      set((s) => {
        const ctxs = effectiveContextList(s)
        if (ctxs.length === 0) return s
        const next = { ...s.hiddenSidebarItemsByContext }
        let changed = false
        for (const ctx of ctxs) {
          if (next[ctx]) {
            delete next[ctx]
            changed = true
          }
        }
        if (!changed) return s
        persistHiddenSidebarItemsByContext(next)
        return { hiddenSidebarItemsByContext: next }
      }),
    setDefaultContext: (name) => {
      const value = name && name.length > 0 ? name : null
      persistDefaultContext(value)
      set({ defaultContext: value })
    },
    toggleContextTag: (name, tagId) =>
      set((s) => {
        const current = s.contextTags[name] ?? []
        let nextList: string[]
        if (current.includes(tagId)) {
          nextList = current.filter((t) => t !== tagId)
        } else {
          if (current.length >= MAX_TAGS_PER_CONTEXT) return s
          nextList = [...current, tagId]
        }
        const next = { ...s.contextTags }
        if (nextList.length === 0) delete next[name]
        else next[name] = nextList
        persistContextTags(next)
        return { contextTags: next }
      }),
    clearContextTags: (name) =>
      set((s) => {
        if (!s.contextTags[name]) return s
        const next = { ...s.contextTags }
        delete next[name]
        persistContextTags(next)
        return { contextTags: next }
      }),
    setContextDisplayName: (name, displayName) =>
      set((s) => {
        const value = displayName?.trim() ?? ''
        // Blank or equal to the kubeconfig name means "no override": the
        // kubeconfig name is always the default, so it is never stored.
        const clear = value.length === 0 || value === name
        if (clear ? !(name in s.contextDisplayNames) : s.contextDisplayNames[name] === value) return s
        const next = { ...s.contextDisplayNames }
        if (clear) delete next[name]
        else next[name] = value
        persistContextDisplayNames(next)
        return { contextDisplayNames: next }
      }),
    addCustomTag: (def) =>
      set((s) => {
        const next = { ...s.customTags, [def.id]: def }
        persistCustomTags(next)
        return { customTags: next }
      }),
    removeCustomTag: (id) =>
      set((s) => {
        const nextTags = { ...s.customTags }
        delete nextTags[id]
        const nextAssignments: Record<string, string[]> = {}
        for (const [ctx, list] of Object.entries(s.contextTags)) {
          const filtered = list.filter((t) => t !== id)
          if (filtered.length > 0) nextAssignments[ctx] = filtered
        }
        persistCustomTags(nextTags)
        persistContextTags(nextAssignments)
        return { customTags: nextTags, contextTags: nextAssignments }
      }),
    upsertContextGroup: (group) =>
      set((s) => {
        const color = isValidGroupColor(group.color) ? group.color : 'sky'
        const cleaned: ContextGroup = {
          id: group.id,
          name: group.name.trim(),
          contexts: Array.from(new Set(group.contexts.filter((c) => c.length > 0))),
          color,
        }
        if (cleaned.name.length === 0 || cleaned.contexts.length === 0) return s
        const idx = s.contextGroups.findIndex((g) => g.id === cleaned.id)
        const next = idx === -1
          ? [...s.contextGroups, cleaned]
          : s.contextGroups.map((g, i) => (i === idx ? cleaned : g))
        persistContextGroups(next)
        return { contextGroups: next }
      }),
    removeContextGroup: (id) =>
      set((s) => {
        const next = s.contextGroups.filter((g) => g.id !== id)
        if (next.length === s.contextGroups.length) return s
        persistContextGroups(next)
        // If the removed group was active, clear the dangling association too,
        // otherwise activeGroupId keeps pointing at a deleted id and the
        // colored top-bar stripe / switcher highlight go inconsistent until the
        // next context change. The aggregated contexts themselves stay.
        if (s.activeGroupId === id) {
          return { contextGroups: next, activeGroupId: null }
        }
        return { contextGroups: next }
      }),
    // Drops every local preference keyed by a context that no longer exists
    // (deleted from the kubeconfig), so a later context with the same name
    // does not inherit its tags, display name, auto-connect or group slot.
    forgetContext: (name) => {
      if (effectiveContextList(get()).includes(name)) {
        const rest = effectiveContextList(get()).filter((c) => c !== name)
        set((s) => normalizeContexts(rest, s.namespacesByContext, s))
      }
      set((s) => {
        const tags = { ...s.contextTags }
        delete tags[name]
        persistContextTags(tags)
        const names = { ...s.contextDisplayNames }
        delete names[name]
        persistContextDisplayNames(names)
        const hidden = { ...s.hiddenSidebarItemsByContext }
        delete hidden[name]
        persistHiddenSidebarItemsByContext(hidden)
        const expandedClusters = s.expandedClusters.filter((c) => c !== name)
        persistExpandedClusters(expandedClusters)
        const favouriteClusters = s.favouriteClusters.filter((c) => c !== name)
        persistFavouriteClusters(favouriteClusters)
        const expandedClusterGroups = s.expandedClusterGroups.filter((k) => !k.startsWith(`${name}\n`))
        persistExpandedClusterGroups(expandedClusterGroups)
        const groups = s.contextGroups
          .map((g) => ({ ...g, contexts: g.contexts.filter((c) => c !== name) }))
          .filter((g) => g.contexts.length >= 2)
        persistContextGroups(groups)
        const defaultContext = s.defaultContext === name ? null : s.defaultContext
        if (defaultContext !== s.defaultContext) persistDefaultContext(null)
        let lastSession = s.lastSession
        if (lastSession?.contexts.includes(name)) {
          const remaining = lastSession.contexts.filter((c) => c !== name)
          lastSession = remaining.length > 0 ? { ...lastSession, contexts: remaining } : null
          persistLastSession(lastSession)
        }
        return {
          contextTags: tags,
          contextDisplayNames: names,
          hiddenSidebarItemsByContext: hidden,
          expandedClusters,
          favouriteClusters,
          expandedClusterGroups,
          contextGroups: groups,
          activeGroupId: groups.some((g) => g.id === s.activeGroupId) ? s.activeGroupId : null,
          defaultContext,
          lastSession,
        }
      })
    },
  }
})

export function useActiveContexts(): string[] {
  return useUIStore(
    useShallow((s) =>
      s.aggregatedContexts.length > 0
        ? s.aggregatedContexts
        : s.selectedContext
          ? [s.selectedContext]
          : [],
    ),
  )
}

export function useIsAggregated(): boolean {
  return useUIStore((s) => s.aggregatedContexts.length > 1)
}

// The label a context is shown under: the user's display name when set,
// otherwise the kubeconfig context name.
export function contextDisplayName(
  names: Record<string, string>,
  contextName: string,
): string {
  return (Object.hasOwn(names, contextName) && names[contextName]) || contextName
}

export function useContextDisplayName(contextName: string): string
export function useContextDisplayName(contextName: string | null | undefined): string | null
export function useContextDisplayName(contextName: string | null | undefined): string | null {
  return useUIStore((s) =>
    contextName ? contextDisplayName(s.contextDisplayNames, contextName) : null,
  )
}

// Stable resolver for components that label many contexts at once.
export function useContextLabel(): (contextName: string) => string {
  const names = useUIStore((s) => s.contextDisplayNames)
  return useCallback((contextName: string) => contextDisplayName(names, contextName), [names])
}

// Hidden sidebar items are stored per-context so each cluster can have its
// own curated sidebar. In aggregated mode we intersect across contexts: only
// items hidden in *every* active context stay hidden, so switching to
// multi-context view doesn't suddenly hide things the user wanted to see in
// the additional clusters.
export function useEffectiveHiddenSidebarItems(): ResourceView[] {
  return useUIStore(
    useShallow((s) => {
      const ctxs = effectiveContextList(s)
      if (ctxs.length === 0) return []
      const first = s.hiddenSidebarItemsByContext[ctxs[0]] ?? []
      if (ctxs.length === 1) return first
      const rest = ctxs.slice(1).map((c) => new Set(s.hiddenSidebarItemsByContext[c] ?? []))
      return first.filter((v) => rest.every((set) => set.has(v)))
    }),
  )
}

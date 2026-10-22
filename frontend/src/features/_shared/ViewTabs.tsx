import { useEffect, useMemo, useRef } from 'react'
import { Columns2, Rows2, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useVisibleResourceGroups } from '@/features/_shared/useVisibleResourceGroups'
import { useCRDStore } from '@/store/crds'
import { useUIStore, type ResourceView, type SplitDirection, type ViewTab } from '@/store/ui'
import { activeTab, sameTab, tabCycleDelta } from '@/store/viewTabs'
import { tabLabel, type TabMeta } from './tabLabel'

function tabKey(tab: ViewTab): string {
  return tab.kind === 'view' ? `view:${tab.view}` : `crd:${tab.key}`
}

export function ViewTabs() {
  const openTabs = useUIStore((s) => s.openTabs)
  const selectedView = useUIStore((s) => s.selectedView)
  const selectedCRDKey = useUIStore((s) => s.selectedCRDKey)
  const selectTab = useUIStore((s) => s.selectTab)
  const closeTab = useUIStore((s) => s.closeTab)
  const crdByKey = useCRDStore((s) => s.byKey)
  const current = useMemo(() => activeTab({ selectedView, selectedCRDKey }), [selectedView, selectedCRDKey])
  const activeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const reveal = () => activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    reveal()
    // Geist loads after first paint and widens the tabs, which can push the
    // active one back out of view.
    void document.fonts?.ready.then(reveal)
  }, [current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const delta = tabCycleDelta(e)
      if (delta === null) return
      e.preventDefault()
      useUIStore.getState().cycleTab(delta)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const meta = (tab: ViewTab): TabMeta => tabLabel(tab, crdByKey)
  const split = useUIStore((s) => s.split)
  const openSplit = useUIStore((s) => s.openSplit)
  const closeSplit = useUIStore((s) => s.closeSplit)
  const visibleGroups = useVisibleResourceGroups()

  return (
    <div
      role="tablist"
      aria-label="Open views"
      className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-muted/30 px-2 pt-1"
    >
      {openTabs.map((tab) => {
        const active = sameTab(tab, current)
        const inSplit = !!split && sameTab(split.tab, tab)
        const { label, icon: Icon } = meta(tab)
        const title = tab.kind === 'crd' ? tab.key : label
        // Right-click a tab: split the workspace with another view. For the
        // active tab the other view is the target; for any other tab, that
        // tab is opened beside the active one.
        const others = openTabs.filter((t) => !sameTab(t, current))
        const splitWith = (target: ViewTab, direction: SplitDirection) => {
          if (!active) selectTab(current)
          openSplit(target, direction)
        }
        const element = (
          <div
            key={tabKey(tab)}
            ref={active ? activeRef : undefined}
            role="tab"
            aria-selected={active}
            data-split={inSplit || undefined}
            tabIndex={active ? 0 : -1}
            title={title}
            onClick={() => selectTab(tab)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                closeTab(tab)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                selectTab(tab)
              }
            }}
            className={[
              'nav-item group -mb-px flex h-8 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 pl-2.5 pr-1 text-xs transition-colors',
              active
                ? ''
                : inSplit
                  ? 'border-border/60 bg-background/60 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{label}</span>
            {inSplit && <Columns2 className="size-3 shrink-0 text-muted-foreground" aria-label="In split view" />}
            <button
              type="button"
              aria-label={`Close ${label}`}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab)
              }}
              className={[
                'flex size-5 shrink-0 items-center justify-center rounded',
                active ? 'hover:bg-black/15' : 'opacity-0 hover:bg-muted-foreground/20 group-hover:opacity-100',
              ].join(' ')}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        )
        return (
          <ContextMenu key={tabKey(tab)}>
            <ContextMenuTrigger asChild>{element}</ContextMenuTrigger>
            <ContextMenuContent className="min-w-56">
              {active ? (
                (['vertical', 'horizontal'] as const).map((direction) => (
                  <ContextMenuSub key={direction}>
                    <ContextMenuSubTrigger>
                      {direction === 'vertical' ? <Columns2 /> : <Rows2 />}
                      {direction === 'vertical' ? 'Split vertically with' : 'Split horizontally with'}
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="max-h-[60vh] min-w-52 overflow-y-auto">
                      {others.length > 0 && (
                        <>
                          <ContextMenuLabel className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                            Open tabs
                          </ContextMenuLabel>
                          {others.map((t) => {
                            const m = meta(t)
                            return (
                              <ContextMenuItem key={tabKey(t)} onSelect={() => splitWith(t, direction)}>
                                {m.icon && <m.icon />}
                                {m.label}
                              </ContextMenuItem>
                            )
                          })}
                          <ContextMenuSeparator />
                        </>
                      )}
                      {visibleGroups.map((g) => {
                        const items = g.items.filter(
                          (i): i is typeof i & { view: ResourceView } =>
                            !!i.view && !sameTab({ kind: 'view', view: i.view }, current),
                        )
                        if (items.length === 0) return null
                        return (
                          <ContextMenuSub key={g.label}>
                            <ContextMenuSubTrigger>{g.label}</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="max-h-[60vh] overflow-y-auto">
                              {items.map((i) => (
                                <ContextMenuItem
                                  key={i.view}
                                  onSelect={() => splitWith({ kind: 'view', view: i.view }, direction)}
                                >
                                  {i.icon && <i.icon />}
                                  {i.label}
                                </ContextMenuItem>
                              ))}
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                        )
                      })}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                ))
              ) : (
                <>
                  <ContextMenuItem onSelect={() => splitWith(tab, 'vertical')}>
                    <Columns2 />
                    Open in split, side by side
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => splitWith(tab, 'horizontal')}>
                    <Rows2 />
                    Open in split, stacked
                  </ContextMenuItem>
                </>
              )}
              {split && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={closeSplit}>
                    <X />
                    Close split
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => closeTab(tab)}>Close tab</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </div>
  )
}

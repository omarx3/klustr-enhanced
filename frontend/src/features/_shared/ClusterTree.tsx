import { useEffect, useMemo, useState, type MouseEvent, type Ref } from 'react'
import { ChevronRight, Columns2, EyeOff, Puzzle, Rows2, Search, Star } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { ContextInfo } from '@/lib/api'
import { ContextEntryMenu } from '@/features/contexts/ContextEntryMenu'
import { sortContextsAlphabetically } from '@/features/contexts/contextSort'
import { useKubeContexts } from '@/features/contexts/useKubeContexts'
import { groupByAPIGroup, SUBGROUP_PREFIX, ROOT_LABEL } from '@/features/crds/crdGrouping'
import { ProviderIcon } from '@/features/_shared/providerIcons'
import type { NavItem, ResourceGroup } from '@/features/_shared/resourceGroups'
import { buildVisibleResourceGroups } from '@/features/_shared/visibleResourceGroups'
import { useAccessStore } from '@/store/access'
import { crdKey, useCRDStore } from '@/store/crds'
import { clusterGroupKey } from '@/store/ui.persistence'
import { useActiveContexts, useContextLabel, useUIStore, type ResourceView } from '@/store/ui'
import type { ContextHealth } from '@/store/ui.types'

// Groups whose items sit directly under the cluster instead of behind a
// collapsible header, as the everyday entry points.
const FLAT_GROUPS = new Set(['Cluster'])

// Showing the filter for a handful of clusters only adds noise.
const FILTER_THRESHOLD = 6

const NO_HIDDEN: ResourceView[] = []

type Props = {
  activeItemRef?: Ref<HTMLLIElement>
}

// Expanded-sidebar navigation: every kubeconfig context as a collapsible
// node with its own resource tree. Opening a view under a cluster that is
// not connected switches to it; Ctrl/Cmd+click adds it to the current set.
export function ClusterTree({ activeItemRef }: Props) {
  const contexts = useKubeContexts()
  const labelOf = useContextLabel()
  const activeContexts = useActiveContexts()
  const expandedClusters = useUIStore((s) => s.expandedClusters)
  const expandClusters = useUIStore((s) => s.expandClusters)
  const [filter, setFilter] = useState('')

  // A cluster that becomes active opens its tree once; collapsing it again
  // sticks until the active set changes.
  useEffect(() => {
    expandClusters(activeContexts)
  }, [activeContexts, expandClusters])

  const sorted = useMemo(() => sortContextsAlphabetically(contexts, labelOf), [contexts, labelOf])
  const favouriteNames = useUIStore((s) => s.favouriteClusters)
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      (c) => labelOf(c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    )
  }, [sorted, filter, labelOf])
  // Favourites list first, both groups alphabetical, with a divider between.
  const favourites = visible.filter((c) => favouriteNames.includes(c.name))
  const others = visible.filter((c) => !favouriteNames.includes(c.name))

  const renderNode = (c: ContextInfo) => (
    <ClusterNode
      key={c.name}
      context={c}
      label={labelOf(c.name)}
      active={activeContexts.includes(c.name)}
      expanded={expandedClusters.includes(c.name)}
      favourite={favouriteNames.includes(c.name)}
      activeItemRef={activeItemRef}
    />
  )

  return (
    <div className="flex flex-col">
      <div className="flex h-7 items-center gap-1 pl-2 pr-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Clusters</span>
        {contexts.length > 0 && (
          <span className="text-[0.625rem] font-normal normal-case tracking-normal text-muted-foreground/70">
            {contexts.length}
          </span>
        )}
      </div>
      {contexts.length > FILTER_THRESHOLD && (
        <label className="mx-1 mb-1 flex items-center gap-1.5 rounded border border-sidebar-border bg-background/40 px-2 py-1 text-xs focus-within:ring-1 focus-within:ring-ring">
          <Search className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setFilter('')
            }}
            placeholder="Filter clusters"
            aria-label="Filter clusters"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
          />
        </label>
      )}
      <ul className="flex flex-col gap-px">
        {favourites.map(renderNode)}
        {favourites.length > 0 && others.length > 0 && (
          <li role="separator" aria-label="End of favourites" className="mx-2 my-1.5 border-t border-sidebar-border" />
        )}
        {others.map(renderNode)}
        {visible.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground/70">
            {contexts.length === 0 ? 'No contexts found.' : 'No clusters match.'}
          </li>
        )}
      </ul>
    </div>
  )
}

function healthDotClass(health: ContextHealth | undefined): string {
  switch (health?.status) {
    case 'ok':
      return 'bg-emerald-500'
    case 'slow':
      return 'bg-amber-500'
    case 'stale':
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/50'
  }
}

type NodeProps = {
  context: ContextInfo
  label: string
  active: boolean
  expanded: boolean
  favourite: boolean
  activeItemRef?: Ref<HTMLLIElement>
}

function ClusterNode({ context, label, active, expanded, favourite, activeItemRef }: NodeProps) {
  const toggle = useUIStore((s) => s.toggleClusterExpanded)
  const toggleFavourite = useUIStore((s) => s.toggleFavouriteCluster)
  const health = useUIStore((s) => (active ? s.contextHealth[context.name] : undefined))

  return (
    <li className="flex flex-col">
      <ContextEntryMenu context={context}>
        <div
          className={[
            'nav-item group/cluster flex w-full items-center rounded text-sm transition-colors',
            active ? 'font-medium text-sidebar-foreground' : 'text-sidebar-foreground/80',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => toggle(context.name)}
            aria-expanded={expanded}
            title={label === context.name ? context.name : `${label} (${context.name})`}
            className="flex min-w-0 shrink items-center gap-2 py-1 pl-2 text-left"
          >
            <ProviderIcon context={context} className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{label}</span>
          </button>
          <button
            type="button"
            onClick={() => toggleFavourite(context.name)}
            aria-pressed={favourite}
            aria-label={favourite ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
            title={favourite ? 'Remove from favourites' : 'Add to favourites'}
            className={[
              'mx-1 flex size-5 shrink-0 items-center justify-center rounded transition-opacity hover:bg-background/60',
              favourite
                ? 'text-amber-400'
                : 'text-muted-foreground opacity-0 hover:text-amber-400 focus-visible:opacity-100 group-hover/cluster:opacity-100',
            ].join(' ')}
          >
            <Star className={`size-3.5 ${favourite ? 'fill-current' : ''}`} aria-hidden />
          </button>
          {/* The rest of the row toggles too, so the whole line stays a hit
              target; keyboard users reach the same action on the name button. */}
          <div
            onClick={() => toggle(context.name)}
            className="flex min-w-6 flex-1 cursor-pointer items-center justify-end gap-2 self-stretch pr-2"
          >
            {active && (
              <span
                role="img"
                aria-label={health ? `Connected, ${health.status}` : 'Connected'}
                className={`size-2 shrink-0 rounded-full ${healthDotClass(health)}`}
              />
            )}
            <ChevronRight
              aria-hidden
              className={`size-4 shrink-0 text-muted-foreground transition-transform group-hover/cluster:text-foreground ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          </div>
        </div>
      </ContextEntryMenu>
      {expanded && (
        <ClusterResources contextName={context.name} active={active} activeItemRef={activeItemRef} />
      )}
    </li>
  )
}

function ClusterResources({
  contextName,
  active,
  activeItemRef,
}: {
  contextName: string
  active: boolean
  activeItemRef?: Ref<HTMLLIElement>
}) {
  const crds = useCRDStore((s) => s.byContext[contextName])
  const access = useAccessStore((s) => s.byContext[contextName])
  const hidden = useUIStore((s) => s.hiddenSidebarItemsByContext[contextName] ?? NO_HIDDEN)
  const expandedGroups = useUIStore((s) => s.expandedClusterGroups)
  const toggleGroup = useUIStore((s) => s.toggleClusterGroup)

  // CRDs and access are only known for connected clusters; until then the
  // built-in groups show and integrations appear once the cluster connects.
  const groups = useMemo(
    () =>
      buildVisibleResourceGroups({
        activeContexts: [contextName],
        crdsByContext: crds ? { [contextName]: crds } : {},
        accessByContext: access ? { [contextName]: access } : {},
        hiddenItems: hidden,
      }),
    [contextName, crds, access, hidden],
  )

  return (
    <div className="ml-3 flex flex-col border-l border-sidebar-border/70 pl-1.5">
      {groups.map((group) => {
        if (FLAT_GROUPS.has(group.label)) {
          return (
            <ul key={group.label} className="flex flex-col">
              {group.items.map((item) => (
                <TreeItem
                  key={item.label}
                  item={item}
                  contextName={contextName}
                  contextActive={active}
                  activeItemRef={activeItemRef}
                />
              ))}
            </ul>
          )
        }
        return (
          <TreeGroup
            key={group.label}
            group={group}
            contextName={contextName}
            contextActive={active}
            expanded={expandedGroups.includes(clusterGroupKey(contextName, group.label))}
            onToggle={() => toggleGroup(contextName, group.label)}
            activeItemRef={activeItemRef}
          />
        )
      })}
      {active && (
        <ClusterCRDs
          contextName={contextName}
          crds={crds ?? []}
          expanded={expandedGroups.includes(clusterGroupKey(contextName, ROOT_LABEL))}
          onToggle={() => toggleGroup(contextName, ROOT_LABEL)}
        />
      )}
    </div>
  )
}

const groupRowClass =
  'nav-item flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm text-sidebar-foreground transition-colors'

function TreeGroup({
  group,
  contextName,
  contextActive,
  expanded,
  onToggle,
  activeItemRef,
}: {
  group: ResourceGroup
  contextName: string
  contextActive: boolean
  expanded: boolean
  onToggle: () => void
  activeItemRef?: Ref<HTMLLIElement>
}) {
  const Icon = group.icon
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className={groupRowClass}>
        <ChevronRight
          aria-hidden
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
      </button>
      {expanded && (
        <ul className="flex flex-col pl-5">
          {group.items.map((item) => (
            <TreeItem
              key={item.label}
              item={item}
              contextName={contextName}
              contextActive={contextActive}
              activeItemRef={activeItemRef}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function isAdditive(e: MouseEvent): boolean {
  return e.ctrlKey || e.metaKey
}

function TreeItem({
  item,
  contextName,
  contextActive,
  activeItemRef,
}: {
  item: NavItem
  contextName: string
  contextActive: boolean
  activeItemRef?: Ref<HTMLLIElement>
}) {
  const selected = useUIStore(
    (s) => contextActive && item.view !== undefined && s.selectedView === item.view && s.selectedCRDKey === null,
  )
  const openClusterTab = useUIStore((s) => s.openClusterTab)
  const hideSidebarItem = useUIStore((s) => s.hideSidebarItem)
  const openSplit = useUIStore((s) => s.openSplit)
  const Icon = item.icon
  const view = item.view

  const row = (
    <li
      ref={selected ? activeItemRef : undefined}
      aria-disabled={!view}
      aria-current={selected ? 'page' : undefined}
      onClick={(e) => {
        if (view) openClusterTab(contextName, { kind: 'view', view }, isAdditive(e))
      }}
      className={[
        'nav-item group/sidebar-item flex items-center gap-2 rounded border-l-2 py-1 pl-1.5 pr-1 text-sm transition-colors',
        view ? 'cursor-pointer' : 'cursor-default text-muted-foreground/60',
        selected ? '' : view ? 'border-transparent text-sidebar-foreground' : 'border-transparent',
      ].join(' ')}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {view && (
        <button
          type="button"
          aria-label={`Hide ${item.label} from sidebar`}
          title="Hide from sidebar"
          onClick={(e) => {
            e.stopPropagation()
            hideSidebarItem(view, [contextName])
          }}
          className="ml-auto flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/sidebar-item:opacity-100"
        >
          <EyeOff className="size-3" aria-hidden />
        </button>
      )}
    </li>
  )
  if (!view) return row
  // A split shows the same contexts as the primary pane, so it is offered
  // only under a connected cluster.
  const canSplit = contextActive && !selected
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        {canSplit && (
          <>
            <ContextMenuItem onSelect={() => openSplit({ kind: 'view', view }, 'vertical')}>
              <Columns2 className="size-3.5" aria-hidden />
              Open in split, side by side
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => openSplit({ kind: 'view', view }, 'horizontal')}>
              <Rows2 className="size-3.5" aria-hidden />
              Open in split, stacked
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={() => hideSidebarItem(view, [contextName])}>
          <EyeOff className="size-3.5" aria-hidden />
          Hide from sidebar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function ClusterCRDs({
  contextName,
  crds,
  expanded,
  onToggle,
}: {
  contextName: string
  crds: NonNullable<ReturnType<typeof useCRDStore.getState>['byContext'][string]>
  expanded: boolean
  onToggle: () => void
}) {
  const grouped = useMemo(() => groupByAPIGroup(crds), [crds])
  const expandedGroups = useUIStore((s) => s.expandedClusterGroups)
  const toggleGroup = useUIStore((s) => s.toggleClusterGroup)
  const selectedCRDKey = useUIStore((s) => s.selectedCRDKey)
  const openClusterTab = useUIStore((s) => s.openClusterTab)

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className={groupRowClass}>
        <ChevronRight
          aria-hidden
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <Puzzle className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Custom Resources</span>
        <span className="text-[0.625rem] text-muted-foreground/70">{crds.length}</span>
      </button>
      {expanded && grouped.length === 0 && (
        <div className="py-1 pl-6 text-xs text-muted-foreground/70">No CRDs found in this cluster.</div>
      )}
      {expanded &&
        grouped.map((g) => {
          const subExpanded = expandedGroups.includes(clusterGroupKey(contextName, SUBGROUP_PREFIX + g.group))
          return (
            <div key={g.group} className="min-w-0 pl-5">
              <button
                type="button"
                onClick={() => toggleGroup(contextName, SUBGROUP_PREFIX + g.group)}
                aria-expanded={subExpanded}
                title={g.group}
                className="flex w-full items-center gap-1 px-1 py-0.5 text-xs text-muted-foreground hover:text-sidebar-foreground"
              >
                <ChevronRight
                  aria-hidden
                  className={`size-3 shrink-0 transition-transform ${subExpanded ? 'rotate-90' : ''}`}
                />
                <span className="truncate">{g.group}</span>
              </button>
              {subExpanded && (
                <ul className="flex min-w-0 flex-col pl-3">
                  {g.crds.map((crd) => {
                    const key = crdKey(crd)
                    const selected = selectedCRDKey === key
                    return (
                      <li
                        key={key}
                        aria-current={selected ? 'page' : undefined}
                        title={`${crd.kind} (${crd.group}/${crd.version})`}
                        onClick={(e) => openClusterTab(contextName, { kind: 'crd', key }, isAdditive(e))}
                        className={[
                          'nav-item min-w-0 cursor-pointer truncate rounded px-2 py-1 text-sm',
                          selected ? '' : 'text-sidebar-foreground',
                        ].join(' ')}
                      >
                        {crd.kind}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
    </div>
  )
}

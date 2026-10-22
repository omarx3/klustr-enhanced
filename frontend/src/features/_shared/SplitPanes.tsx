import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Columns2, Rows2, X } from 'lucide-react'
import { useCRDStore } from '@/store/crds'
import { isEditableTarget, isOverlayOpen } from '@/lib/dom'
import { useUIStore, type Pane, type ViewTab } from '@/store/ui'
import { PaneContext, setFocusedPane } from './paneContext'
import { tabLabel } from './tabLabel'

type Props = {
  primary: ReactNode
  secondary: ReactNode | null
}

// Lays out the primary list and, when a split is open, the split list beside
// it (vertical) or below it (horizontal), with a draggable divider. Each pane
// gets its own PaneContext so per-list behavior (the / shortcut, the
// "outside the list" notice) knows which pane it is in.
export function SplitPanes({ primary, secondary }: Props) {
  const split = useUIStore((s) => s.split)
  const setRatio = useUIStore((s) => s.setSplitRatio)
  const boxRef = useRef<HTMLDivElement>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  if (!split || !secondary) {
    return (
      <PaneContext value="primary">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onPointerDownCapture={() => setFocusedPane('primary')}>
          {primary}
        </div>
      </PaneContext>
    )
  }

  const vertical = split.direction === 'vertical'
  const ratio = dragRatio ?? split.ratio
  // A row clicked in the split pane opens in the one shared inspector, which
  // lives in the primary pane; Esc from the split list closes it, as it does
  // from the primary list.
  const closeInspectorOnEscape = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || isEditableTarget(e.target) || isOverlayOpen()) return
    const s = useUIStore.getState()
    if (!s.selectedResource) return
    e.preventDefault()
    s.requestDetailNavigation(() => s.setSelectedResource(null))
  }
  const ratioFrom = (e: { clientX: number; clientY: number }) => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return split.ratio
    return vertical ? (e.clientX - box.left) / box.width : (e.clientY - box.top) / box.height
  }

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    let last = split.ratio
    const move = (ev: PointerEvent) => {
      last = ratioFrom(ev)
      setDragRatio(Math.min(0.85, Math.max(0.15, last)))
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      setRatio(last)
      setDragRatio(null)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  const pane = (which: Pane, node: ReactNode, basis: number) => (
    <PaneContext value={which}>
      <div
        data-split-pane={which}
        onPointerDownCapture={() => setFocusedPane(which)}
        onFocusCapture={() => setFocusedPane(which)}
        onKeyDown={which === 'secondary' ? closeInspectorOnEscape : undefined}
        style={{ flexBasis: `${Math.round(basis * 1000) / 10}%` }}
        className="flex min-h-0 min-w-0 shrink grow-0 flex-col overflow-hidden"
      >
        {which === 'secondary' && <SplitPaneHeader tab={split.tab} />}
        {node}
      </div>
    </PaneContext>
  )

  return (
    <div ref={boxRef} className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${vertical ? 'flex-row' : 'flex-col'}`}>
      {pane('primary', primary, ratio)}
      <div
        role="separator"
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-label="Resize split"
        aria-valuemin={15}
        aria-valuemax={85}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={startDrag}
        onDoubleClick={() => setRatio(0.5)}
        onKeyDown={(e) => {
          const back = vertical ? 'ArrowLeft' : 'ArrowUp'
          const fwd = vertical ? 'ArrowRight' : 'ArrowDown'
          if (e.key !== back && e.key !== fwd) return
          e.preventDefault()
          setRatio(split.ratio + (e.key === fwd ? 0.05 : -0.05))
        }}
        className={`group relative z-10 shrink-0 bg-border outline-none focus-visible:bg-ring ${
          vertical ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'
        }`}
      >
        {/* A wider invisible hit area than the 1px line. */}
        <span
          aria-hidden
          className={`absolute ${vertical ? '-left-1 -right-1 inset-y-0' : '-top-1 -bottom-1 inset-x-0'} group-hover:bg-ring/40`}
        />
      </div>
      {pane('secondary', secondary, 1 - ratio)}
    </div>
  )
}

function SplitPaneHeader({ tab }: { tab: ViewTab }) {
  const split = useUIStore((s) => s.split)
  const closeSplit = useUIStore((s) => s.closeSplit)
  const setDirection = useUIStore((s) => s.setSplitDirection)
  const swap = useUIStore((s) => s.swapSplit)
  const crdByKey = useCRDStore((s) => s.byKey)
  const { label, icon: Icon } = tabLabel(tab, crdByKey)
  const vertical = split?.direction === 'vertical'
  const iconButton = 'inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
  return (
    <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border bg-muted/30 px-3 text-xs">
      {Icon && <Icon className="size-3.5 text-muted-foreground" aria-hidden />}
      <span className="truncate font-medium" aria-label="Split view">{label}</span>
      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          className={iconButton}
          aria-label={vertical ? 'Split horizontally' : 'Split vertically'}
          title={vertical ? 'Stack the panes' : 'Place the panes side by side'}
          onClick={() => setDirection(vertical ? 'horizontal' : 'vertical')}
        >
          {vertical ? <Rows2 className="size-3.5" /> : <Columns2 className="size-3.5" />}
        </button>
        <button type="button" className={iconButton} aria-label="Swap panes" title="Swap panes" onClick={swap}>
          <ArrowLeftRight className="size-3.5" />
        </button>
        <button type="button" className={iconButton} aria-label="Close split" title="Close split" onClick={closeSplit}>
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

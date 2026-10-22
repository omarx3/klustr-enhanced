import { Copy, CopyPlus, FileCode2, FileText, Network, RotateCcw, ScanEye, ScrollText, Sliders, Square, Terminal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { usePortForwards } from '@/store/portForwards'
import { activeServiceForwards } from '@/features/portforward/servicePortForward'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useUIStore, type DetailTab, type ResourceKind, type SelectedResource } from '@/store/ui'

const POD_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>(['Pod'])

const WORKLOAD_LOG_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>([
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
])

const RESTARTABLE_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
])

const SCALABLE_ROW_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>(['Deployment', 'StatefulSet'])

// Kinds a copy cannot be created for: Helm releases are Secrets owned by Helm,
// CSINodes are written by the kubelet, Nodes register themselves and Events
// are records rather than objects people author.
const NOT_DUPLICABLE_KINDS: ReadonlySet<string> = new Set(['HelmRelease', 'CSINode', 'Node', 'Event'])

const EVENT_BEARING_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>([
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'ReplicationController',
  'Job',
  'CronJob',
  'HorizontalPodAutoscaler',
  'PodDisruptionBudget',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'Node',
  'Service',
  'Ingress',
])

type Props = {
  kind: ResourceKind
  contextName: string
  namespace: string
  name: string
  canPortForward?: boolean
  // CR rows pass the view-built SelectedResource (alias kind + gvr); without
  // it the table-prefs key (`cr:group/resource`) would leak in as the kind
  // and the detail panel would open blank.
  resource?: SelectedResource
  children: React.ReactNode
}

export function RowContextMenu({
  kind,
  contextName,
  namespace,
  name,
  canPortForward,
  resource: resourceOverride,
  children,
}: Props) {
  const openResourceFromList = useUIStore((s) => s.openResourceFromList)
  const setPendingAction = useUIStore((s) => s.setPendingAction)
  const readOnly = useUIStore((s) => s.globalReadOnly)

  const resource: SelectedResource = resourceOverride ?? {
    kind,
    namespace,
    name,
    context: contextName,
  }
  const isPod = POD_KINDS.has(kind)
  const hasLogs = WORKLOAD_LOG_KINDS.has(kind)
  const hasEvents = EVENT_BEARING_KINDS.has(kind)
  const isRestartable = RESTARTABLE_KINDS.has(kind)
  // Only the workloads the user asked for: a Deployment or a StatefulSet row.
  // CR rows (an alias kind with a gvr) never qualify.
  const isScalableKind = SCALABLE_ROW_KINDS.has(kind) && !resource.gvr
  const canDuplicate = !NOT_DUPLICABLE_KINDS.has(String(resource.kind))
  const isService = kind === 'Service'
  const serviceForwarding = usePortForwards(
    (s) => isService && activeServiceForwards(s.list, { context: contextName, namespace, name }).length > 0,
  )

  const open = (tab?: DetailTab) => openResourceFromList(resource, tab)

  const copy = (value: string, label: string) => {
    if (!value) return
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`Copied ${label}`))
      .catch(() => toast.error(`Could not copy ${label}`))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => open()}>
          <ScanEye />
          <span>Open details</span>
        </ContextMenuItem>
        {hasLogs && (
          <ContextMenuItem onSelect={() => open('logs')}>
            <ScrollText />
            <span>View logs</span>
          </ContextMenuItem>
        )}
        {isPod && (
          <ContextMenuItem onSelect={() => open('exec')}>
            <Terminal />
            <span>Exec shell</span>
          </ContextMenuItem>
        )}
        {isPod && canPortForward && (
          <ContextMenuItem onSelect={() => setPendingAction({ kind: 'portforward', resource })}>
            <Network />
            <span>Port-forward</span>
          </ContextMenuItem>
        )}
        {isService && (
          <ContextMenuItem onSelect={() => setPendingAction({ kind: 'service-portforward', resource })}>
            <Network />
            <span>Port-forward</span>
          </ContextMenuItem>
        )}
        {isService && serviceForwarding && (
          <ContextMenuItem
            onSelect={() =>
              api
                .stopServicePortForwards(contextName, namespace, name)
                .then(() => toast.success(`Stopped port-forward for service/${name}`))
                .catch((e) => toast.error('Could not stop port-forward', { description: String(e) }))
            }
          >
            <Square />
            <span>Stop port-forward</span>
          </ContextMenuItem>
        )}
        {hasEvents && (
          <ContextMenuItem onSelect={() => open('events')}>
            <FileText />
            <span>View events</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => open('yaml')}>
          <FileCode2 />
          <span>View YAML</span>
        </ContextMenuItem>
        {!readOnly && isRestartable && (
          <ContextMenuItem onSelect={() => setPendingAction({ kind: 'restart', resource })}>
            <RotateCcw />
            <span>Rolling restart</span>
          </ContextMenuItem>
        )}
        {!readOnly && isScalableKind && (
          <ContextMenuItem onSelect={() => setPendingAction({ kind: 'scale', resource })}>
            <Sliders />
            <span>Scale</span>
          </ContextMenuItem>
        )}
        {!readOnly && canDuplicate && (
          <ContextMenuItem onSelect={() => setPendingAction({ kind: 'duplicate', resource })}>
            <CopyPlus />
            <span>Duplicate</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copy(name, 'name')}>
          <Copy />
          <span>Copy name</span>
        </ContextMenuItem>
        {namespace && (
          <ContextMenuItem onSelect={() => copy(namespace, 'namespace')}>
            <Copy />
            <span>Copy namespace</span>
          </ContextMenuItem>
        )}
        {!readOnly && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onSelect={() => setPendingAction({ kind: 'delete', resource })}
            >
              <Trash2 />
              <span>Delete</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

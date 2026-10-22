import { DeleteResourceDialog } from './DeleteResourceButton'
import { RestartWorkloadDialog } from './RestartWorkloadButton'
import { DeleteArgoApplicationDialog } from '@/features/argocd/DeleteArgoApplicationButton'
import { isArgoApplication } from '@/features/argocd/argoApplication'
import { PortForwardDialog } from '@/features/portforward/PortForwardButton'
import { ServicePortForwardDialog } from '@/features/portforward/ServicePortForwardDialog'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { ScaleResourceDialog } from './ScaleResourceButton'
import { useResourceManagers } from './useResourceManagers'
import { DuplicateResourceDialog } from '@/features/create/DuplicateResourceDialog'

// Loads the GitOps owners so the row-menu scale dialog warns about a revert
// just like the detail panel's Scale button does.
function RowScaleDialog({
  contextName,
  resource,
  onOpenChange,
}: {
  contextName: string | null
  resource: SelectedResource
  onOpenChange: (open: boolean) => void
}) {
  const managers = useResourceManagers(contextName, resource)
  return (
    <ScaleResourceDialog
      contextName={contextName}
      resource={resource}
      managers={managers}
      open
      onOpenChange={onOpenChange}
    />
  )
}

export function RowActionDialogs() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const pendingAction = useUIStore((s) => s.pendingAction)
  const setPendingAction = useUIStore((s) => s.setPendingAction)

  if (!pendingAction) return null

  const contextName = pendingAction.resource.context ?? selectedContext

  const close = () => setPendingAction(null)
  const onOpenChange = (o: boolean) => {
    if (!o) close()
  }

  if (pendingAction.kind === 'delete') {
    if (isArgoApplication(pendingAction.resource)) {
      return (
        <DeleteArgoApplicationDialog
          contextName={contextName}
          resource={pendingAction.resource}
          open
          onOpenChange={onOpenChange}
        />
      )
    }
    return (
      <DeleteResourceDialog
        contextName={contextName}
        resource={pendingAction.resource}
        open
        onOpenChange={onOpenChange}
      />
    )
  }

  if (pendingAction.kind === 'restart') {
    return (
      <RestartWorkloadDialog
        contextName={contextName}
        resource={pendingAction.resource}
        open
        onOpenChange={onOpenChange}
      />
    )
  }

  if (pendingAction.kind === 'scale') {
    return <RowScaleDialog contextName={contextName} resource={pendingAction.resource} onOpenChange={onOpenChange} />
  }

  if (pendingAction.kind === 'duplicate') {
    if (!contextName) return null
    return <DuplicateResourceDialog contextName={contextName} resource={pendingAction.resource} onClose={close} />
  }

  if (pendingAction.kind === 'service-portforward') {
    return (
      <ServicePortForwardDialog
        service={{
          context: contextName ?? '',
          namespace: pendingAction.resource.namespace,
          name: pendingAction.resource.name,
        }}
        open
        onOpenChange={onOpenChange}
      />
    )
  }

  return (
    <PortForwardDialog
      contextName={contextName}
      resource={pendingAction.resource}
      open
      onOpenChange={onOpenChange}
    />
  )
}

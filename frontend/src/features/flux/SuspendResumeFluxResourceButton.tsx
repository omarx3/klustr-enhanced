import { useMutation } from '@tanstack/react-query'
import { Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type FluxKind } from '@/lib/api'
import { useUIStore } from '@/store/ui'
import { FLUX_KIND_LABEL } from './fluxKinds'

type Props = {
  contextName: string | null
  kind: FluxKind
  namespace: string
  name: string
  suspended: boolean
  variant?: 'detail' | 'row'
  onDone?: () => void
}

export function SuspendResumeFluxResourceButton({
  contextName,
  kind,
  namespace,
  name,
  suspended,
  variant = 'detail',
  onDone,
}: Props) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.setFluxResourceSuspended(contextName, kind, namespace, name, !suspended)
    },
    onSuccess: () => {
      toast.success(
        suspended
          ? `Resumed ${FLUX_KIND_LABEL[kind]} ${name}`
          : `Suspended ${FLUX_KIND_LABEL[kind]} ${name}`,
      )
      // The header's button label reads from SelectedResource.suspended,
      // which the row click snapshotted. Toggle it locally so the dialog
      // flips Suspend ↔ Resume immediately, without waiting for the next
      // informer event to refresh the list.
      const ui = useUIStore.getState()
      const sel = ui.selectedResource
      if (sel && sel.kind === kind && sel.namespace === namespace && sel.name === name) {
        ui.setSelectedResource({ ...sel, suspended: !suspended })
      }
      onDone?.()
    },
    onError: (e) => {
      toast.error(`Suspend toggle failed: ${e instanceof Error ? e.message : String(e)}`)
    },
  })

  const label = suspended ? 'Resume' : 'Suspend'
  const Icon = suspended ? Play : Pause
  const tooltip = suspended
    ? `Clear .spec.suspend — the ${FLUX_KIND_LABEL[kind].toLowerCase()} controller will reconcile this resource again`
    : `Set .spec.suspend=true — the ${FLUX_KIND_LABEL[kind].toLowerCase()} controller will stop reconciling this resource until resumed`

  if (variant === 'row') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-[5.5rem] px-2 text-xs"
        disabled={mutation.isPending}
        onClick={(e) => {
          e.stopPropagation()
          mutation.mutate()
        }}
        title={tooltip}
      >
        <Icon className="size-3" />
        {label}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Icon />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

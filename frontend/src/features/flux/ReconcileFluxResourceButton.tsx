import { useMutation } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type FluxKind } from '@/lib/api'
import { FLUX_KIND_LABEL } from './fluxKinds'

type Props = {
  contextName: string | null
  kind: FluxKind
  namespace: string
  name: string
  variant?: 'detail' | 'row'
}

export function ReconcileFluxResourceButton({
  contextName,
  kind,
  namespace,
  name,
  variant = 'detail',
}: Props) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.reconcileFluxResource(contextName, kind, namespace, name)
    },
    onSuccess: () => {
      toast.success(`Reconciling ${FLUX_KIND_LABEL[kind]} ${namespace}/${name}`)
    },
    onError: (e) => {
      toast.error(`Reconcile failed: ${e instanceof Error ? e.message : String(e)}`)
    },
  })

  const tooltip = `Bump reconcile.fluxcd.io/requestedAt — the ${FLUX_KIND_LABEL[kind].toLowerCase()} controller reconciles immediately, same as \`flux reconcile\``

  if (variant === 'row') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={mutation.isPending}
        onClick={(e) => {
          e.stopPropagation()
          mutation.mutate()
        }}
        title={tooltip}
      >
        <RotateCw className="size-3" />
        Reconcile
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
          <RotateCw />
          Reconcile
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

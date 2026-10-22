import { useMutation } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  variant?: 'detail' | 'row'
}

export function RenewCertificateButton({
  contextName,
  namespace,
  name,
  variant = 'detail',
}: Props) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.renewCertificate(contextName, namespace, name)
    },
    onSuccess: () => {
      toast.success(`Renewing certificate ${namespace}/${name}`)
    },
    onError: (e) => {
      toast.error(`Renew failed: ${e instanceof Error ? e.message : String(e)}`)
    },
  })

  const tooltip =
    'Set the Issuing condition — cert-manager re-issues immediately, same as `cmctl renew`'

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
        <RefreshCw className="size-3" />
        Renew
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
          <RefreshCw />
          Renew
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

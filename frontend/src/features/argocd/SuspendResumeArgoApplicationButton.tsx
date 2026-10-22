import { useMutation } from '@tanstack/react-query'
import { Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  autoSync: boolean
  variant?: 'detail' | 'row'
  onDone?: () => void
}

export function SuspendResumeArgoApplicationButton({
  contextName,
  namespace,
  name,
  autoSync,
  variant = 'detail',
  onDone,
}: Props) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.setArgoApplicationAutomation(contextName, namespace, name, !autoSync)
    },
    onSuccess: () => {
      toast.success(
        autoSync
          ? `Suspended auto-sync on ${name}`
          : `Resumed auto-sync on ${name}`,
      )
      onDone?.()
    },
    onError: (e) => {
      toast.error(`Toggle automation failed: ${e instanceof Error ? e.message : String(e)}`)
    },
  })

  const label = autoSync ? 'Suspend' : 'Resume'
  const Icon = autoSync ? Pause : Play
  const tooltip = autoSync
    ? 'Suspend Argo auto-sync — the spec.syncPolicy.automated block is stashed in an annotation so Resume can restore it'
    : 'Resume Argo auto-sync — restores the previously suspended automation block from annotation'

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

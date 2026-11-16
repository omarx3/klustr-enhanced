import { useMutation } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ContextBadge } from '@/features/_shared/ContextBadge'
import { api } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

type DialogProps = {
  contextName: string | null
  resource: SelectedResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TriggerCronJobDialog({ contextName, resource, open, onOpenChange }: DialogProps) {
  const trigger = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      return api.triggerCronJob(contextName, resource.namespace, resource.name)
    },
    onSuccess: (jobName) => {
      toast.success(`Created job/${jobName}`)
      onOpenChange(false)
    },
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) trigger.reset()
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Trigger CronJob?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Creates a Job now from the job template of{' '}
                <span className="font-mono text-xs allow-select">cronjob/{resource.name}</span>
                {' '}in <span className="font-mono text-xs allow-select">{resource.namespace}</span>{' '}
                — equivalent to <code className="font-mono text-xs">kubectl create job --from=cronjob/{resource.name}</code>.
                The schedule is not affected.
              </p>
              <ContextBadge contextName={contextName} label="Target context" />
              {trigger.error && (
                <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
                  {String(trigger.error)}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={trigger.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={trigger.isPending}
            onClick={(e) => {
              e.preventDefault()
              trigger.mutate()
            }}
          >
            {trigger.isPending ? 'Triggering…' : 'Trigger'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function TriggerCronJobButton({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <Play />
            Trigger
          </Button>
        </TooltipTrigger>
        <TooltipContent>Run a Job from this CronJob now</TooltipContent>
      </Tooltip>
      <TriggerCronJobDialog contextName={contextName} resource={resource} open={open} onOpenChange={setOpen} />
    </>
  )
}

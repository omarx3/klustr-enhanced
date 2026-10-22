import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { SelectedResource } from '@/store/ui'
import { SyncArgoApplicationDialog } from './SyncArgoApplicationDialog'

type Props = {
  contextName: string | null
  resource: SelectedResource
}

export function SyncArgoApplicationButton({ contextName, resource }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <RotateCw />
            Sync…
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open sync dialog with all argocd CLI options</TooltipContent>
      </Tooltip>
      <SyncArgoApplicationDialog
        contextName={contextName}
        namespace={resource.namespace}
        name={resource.name}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

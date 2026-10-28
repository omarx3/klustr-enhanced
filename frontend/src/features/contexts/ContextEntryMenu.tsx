import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, type ContextInfo } from '@/lib/api'
import { useContextLabel, useUIStore } from '@/store/ui'
import { ContextDisplayNameDialog } from './ContextDisplayNameDialog'

// Right-click menu for a context on the home screen. Delete edits the user's
// kubeconfig, so it always goes through a confirmation that names exactly
// what will be removed.
export function ContextEntryMenu({ context, children }: { context: ContextInfo; children: ReactNode }) {
  const label = useContextLabel()(context.name)
  const [confirming, setConfirming] = useState(false)
  const [renaming, setRenaming] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setRenaming(true)}>
            <Pencil />
            <span>Set display name</span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              navigator.clipboard
                .writeText(context.name)
                .then(() => toast.success('Copied context name'))
                .catch(() => toast.error('Could not copy context name'))
            }
          >
            <Copy />
            <span>Copy context name</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 />
            <span>Delete</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {confirming && (
        <DeleteContextDialog context={context} label={label} onClose={() => setConfirming(false)} />
      )}
      {renaming && <ContextDisplayNameDialog contextName={context.name} onClose={() => setRenaming(false)} />}
    </>
  )
}

function DeleteContextDialog({ context, label, onClose }: { context: ContextInfo; label: string; onClose: () => void }) {
  const forgetContext = useUIStore((s) => s.forgetContext)
  const remove = useMutation({
    mutationFn: () => api.deleteKubeconfigContext(context.name),
    onSuccess: (res) => {
      forgetContext(context.name)
      const extra = [res.cluster && `cluster ${res.cluster}`, res.user && `user ${res.user}`].filter(Boolean)
      toast.success(`Deleted ${label} from kubeconfig`, {
        description: [
          extra.length > 0 ? `Also removed ${extra.join(' and ')}, which nothing else used.` : '',
          res.backups.length > 0 ? `Backup: ${res.backups.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' '),
        duration: 10000,
      })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && !remove.isPending && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Delete {label}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                This removes the context <span className="break-all font-mono text-xs text-foreground">{context.name}</span>{' '}
                from your local kubeconfig. Its cluster and user entries are removed too unless another context still
                uses them. Nothing in the cluster itself is touched.
              </p>
              <p>A backup of the kubeconfig is saved to Klustr's config folder first.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        {remove.error && (
          <p className="break-words rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {String(remove.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? <Spinner size="sm" /> : <Trash2 />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

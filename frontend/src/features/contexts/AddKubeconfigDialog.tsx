import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

// Pastes a kubeconfig and merges its contexts into the local kubeconfig.
// The contexts list refreshes from the backend's contexts-changed event.
export function AddKubeconfigDialog({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('')
  const merge = useMutation({
    mutationFn: () => api.mergeKubeconfig(content),
    onSuccess: (res) => {
      const added = res.contexts.length
      toast.success(
        added > 0 ? `Added ${added === 1 ? `context ${res.contexts[0]}` : `${added} contexts`}` : 'Kubeconfig merged',
        {
          description: [res.contexts.length > 1 ? res.contexts.join(', ') : '', res.backup ? `Backup: ${res.backup}` : '']
            .filter(Boolean)
            .join(' '),
          duration: 10000,
        },
      )
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && !merge.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add kubeconfig</DialogTitle>
          <DialogDescription>
            Paste a kubeconfig. Its contexts, clusters and users are added to your local kubeconfig after a backup.
            Existing entries are not changed.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="apiVersion: v1&#10;kind: Config&#10;clusters: ..."
          aria-label="Kubeconfig content"
          spellCheck={false}
          autoFocus
          className="h-72 resize-none font-mono text-xs"
        />
        {merge.error && (
          <p className="break-words rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {String(merge.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={merge.isPending}>
            Cancel
          </Button>
          <Button onClick={() => merge.mutate()} disabled={merge.isPending || content.trim() === ''}>
            {merge.isPending ? <Spinner size="sm" /> : <Plus />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

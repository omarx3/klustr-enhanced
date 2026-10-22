import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'
import { CreateResourceDialog, type CreateTarget } from './CreateResourceDialog'
import { duplicateManifest } from './duplicate'

type Props = {
  contextName: string
  resource: SelectedResource
  onClose: () => void
}

// Reads the live object, renames it to copy-of-<name> and hands it to the
// create editor. Reads go through the same YAML endpoints as the YAML tab, so
// the copy starts from exactly what that tab shows.
export function DuplicateResourceDialog({ contextName, resource, onClose }: Props) {
  const [target, setTarget] = useState<CreateTarget | null>(null)
  const { gvr, namespace, name } = resource
  const kind = String(resource.kind)

  useEffect(() => {
    let cancelled = false
    const fetcher = gvr
      ? api.getCustomResourceYAML(contextName, gvr.group, gvr.version, gvr.resource, namespace, name)
      : api.getResourceYAML(contextName, kind, namespace, name)
    fetcher
      .then((yaml) => {
        if (cancelled) return
        const copy = duplicateManifest(yaml)
        setTarget({
          contextName,
          kind: copy.kind,
          namespaced: namespace !== '',
          template: copy.manifest,
          duplicateOf: name,
          ...(gvr ? { gvr } : {}),
          openAs: { kind: resource.kind, ...(gvr ? { gvr } : {}) },
        })
      })
      .catch((e) => {
        if (cancelled) return
        toast.error(`Could not read ${kind.toLowerCase()}/${name}`, { description: String(e) })
        onClose()
      })
    return () => {
      cancelled = true
    }
    // onClose is a fresh closure on every parent render; the read depends only
    // on which object is duplicated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextName, kind, namespace, name, gvr?.group, gvr?.version, gvr?.resource])

  if (target) return <CreateResourceDialog target={target} onClose={onClose} />

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicate {kind}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Spinner size="sm" />
            Reading {name}…
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

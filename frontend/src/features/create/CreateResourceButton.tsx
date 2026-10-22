import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findCRD, useCRDStore } from '@/store/crds'
import { useContextLabel, useUIStore } from '@/store/ui'
import { CreateResourceDialog, type CreateTarget } from './CreateResourceDialog'
import { canCreateKind, resourceTemplate } from './templates'

type Props = {
  // The table's kind: a built-in kind, or "cr:<group>/<resource>".
  kind: string
  scope: 'namespaced' | 'cluster'
  // Contexts the table lists; the new resource goes to the first one.
  contexts: string[]
  nounSingular: string
}

export function CreateResourceButton({ kind, scope, contexts, nounSingular }: Props) {
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const crdsByContext = useCRDStore((s) => s.byContext)
  const labelOf = useContextLabel()
  const [target, setTarget] = useState<CreateTarget | null>(null)

  if (!canCreateKind(kind)) return null
  const contextName = contexts[0]
  if (!contextName) return null

  // A single selected namespace is where the user is looking, so it is the
  // natural home for the new object; otherwise "default".
  const namespace = selectedNamespaces.length === 1 ? selectedNamespaces[0] : 'default'

  const buildTarget = (): CreateTarget | null => {
    if (kind.startsWith('cr:')) {
      const [group, resource] = kind.slice(3).split('/')
      const crd = findCRD(crdsByContext, contextName, group, resource)
      if (!crd) return null
      const namespaced = crd.scope === 'Namespaced'
      const template = resourceTemplate(kind, namespace, { group, version: crd.version, kind: crd.kind, namespaced })
      if (!template) return null
      return { contextName, kind: crd.kind, namespaced, template, gvr: { group, version: crd.version, resource } }
    }
    const template = resourceTemplate(kind, namespace)
    if (!template) return null
    return { contextName, kind, namespaced: scope === 'namespaced', template }
  }

  const label = `Create ${nounSingular}`
  const where = contexts.length > 1 ? ` in ${labelOf(contextName)}` : ''

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-7 shrink-0 p-0"
        aria-label={label}
        title={readOnly ? 'Read-only mode is on' : `${label}${where}`}
        disabled={readOnly}
        onClick={() => setTarget(buildTarget())}
      >
        <Plus className="size-4" />
      </Button>
      {target && <CreateResourceDialog target={target} onClose={() => setTarget(null)} />}
    </>
  )
}

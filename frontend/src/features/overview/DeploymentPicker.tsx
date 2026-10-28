import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { ContextName } from '@/features/_shared/ContextName'
import { api, type DeploymentRef } from '@/lib/api'
import { monitorKey, useDeploymentMonitors } from '@/store/deploymentMonitors'

type Props = {
  // Fixed cluster (Overview). Without it the menu lists clusters first.
  contextName?: string
  contexts?: string[]
  children: ReactNode
}

// Dropdown of namespaces → deployments; picking one starts monitoring it.
export function DeploymentPicker({ contextName, contexts = [], children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`max-h-96 overflow-y-auto ${contextName ? '' : 'w-96 max-w-[90vw]'}`}>
        {open &&
          (contextName ? (
            <NamespaceItems contextName={contextName} />
          ) : (
            <>
              <DropdownMenuLabel className="text-xs">Clusters</DropdownMenuLabel>
              {contexts.length === 0 && (
                <DropdownMenuItem disabled className="text-xs">
                  No clusters in kubeconfig
                </DropdownMenuItem>
              )}
              {contexts.map((ctx) => (
                <DropdownMenuSub key={ctx}>
                  <DropdownMenuSubTrigger className="text-xs" title={ctx}>
                    <span className="min-w-0 flex-1 truncate">
                      <ContextName name={ctx} />
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                    <NamespaceItems contextName={ctx} />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Loads on mount, which for a submenu is when it opens, so only the clusters
// the user hovers are queried.
function NamespaceItems({ contextName }: { contextName: string }) {
  const [deployments, setDeployments] = useState<DeploymentRef[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const monitors = useDeploymentMonitors((s) => s.monitors)
  const add = useDeploymentMonitors((s) => s.add)

  useEffect(() => {
    let cancelled = false
    api
      .listDeploymentNames(contextName)
      .then((list) => !cancelled && setDeployments(list ?? []))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [contextName])

  if (error)
    return (
      <DropdownMenuItem disabled className="max-w-80 text-xs text-destructive">
        {error}
      </DropdownMenuItem>
    )
  if (!deployments)
    return (
      <DropdownMenuItem disabled className="text-xs">
        <Spinner size="sm" /> Loading…
      </DropdownMenuItem>
    )

  const byNamespace = new Map<string, string[]>()
  for (const d of deployments) byNamespace.set(d.namespace, [...(byNamespace.get(d.namespace) ?? []), d.name])
  const namespaces = [...byNamespace.keys()].sort()
  const watched = new Set(monitors.map(monitorKey))

  return (
    <>
      <DropdownMenuLabel className="text-xs">Namespaces</DropdownMenuLabel>
      {namespaces.length === 0 && (
        <DropdownMenuItem disabled className="text-xs">
          No deployments found
        </DropdownMenuItem>
      )}
      {namespaces.map((ns) => (
        <DropdownMenuSub key={ns}>
          <DropdownMenuSubTrigger className="text-xs">{ns}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            {(byNamespace.get(ns) ?? []).sort().map((name) => {
              const isWatched = watched.has(monitorKey({ context: contextName, namespace: ns, name }))
              return (
                <DropdownMenuItem
                  key={name}
                  disabled={isWatched}
                  className="text-xs"
                  onSelect={() => {
                    add(contextName, ns, name)
                    toast.success(`Monitoring ${ns}/${name}`, { description: 'Checked every minute.' })
                  }}
                >
                  {name}
                  {isWatched && <span className="ml-auto text-muted-foreground">monitored</span>}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ))}
    </>
  )
}

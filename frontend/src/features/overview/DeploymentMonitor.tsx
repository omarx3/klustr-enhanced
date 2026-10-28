import { useEffect, useState } from 'react'
import { Activity, X } from 'lucide-react'
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
import { api, type DeploymentInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import {
  diffSnapshots,
  MONITOR_INTERVAL_MS,
  monitorKey,
  useDeploymentMonitors,
  type DeploymentSnapshot,
  type MonitoredDeployment,
} from '@/store/deploymentMonitors'

async function snapshot(m: MonitoredDeployment): Promise<DeploymentSnapshot> {
  const d = await api.getDeployment(m.context, m.namespace, m.name)
  return { replicas: d.replicas, ready: d.ready, images: (d.containers ?? []).map((c) => c.image) }
}

function notify(title: string, body: string) {
  toast.warning(title, { description: body, duration: 30000 })
  // The webview may not support desktop notifications; the toast is the
  // fallback that always shows.
  if (typeof Notification === 'undefined') return
  try {
    if (Notification.permission === 'granted') new Notification(title, { body })
    else if (Notification.permission !== 'denied') void Notification.requestPermission()
  } catch {
    // ignore
  }
}

async function checkAll() {
  const { monitors, record } = useDeploymentMonitors.getState()
  await Promise.all(
    monitors.map(async (m) => {
      const key = monitorKey(m)
      try {
        const next = await snapshot(m)
        if (m.last) {
          const changes = diffSnapshots(m.last, next)
          if (changes.length > 0) notify(`Deployment ${m.namespace}/${m.name} changed`, `${m.context}: ${changes.join(', ')}`)
        }
        record(key, { last: next, lastCheckedAt: Date.now(), error: null })
      } catch (e) {
        record(key, { lastCheckedAt: Date.now(), error: String(e) })
      }
    }),
  )
}

// Mounted once in App so monitors keep running whichever view is open.
export function DeploymentMonitorRunner() {
  const count = useDeploymentMonitors((s) => s.monitors.length)
  useEffect(() => {
    if (count === 0) return
    void checkAll()
    const id = window.setInterval(() => void checkAll(), MONITOR_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [count])
  return null
}

// Overview section: pick a deployment by namespace and list active monitors.
export function DeploymentMonitorSection({ contextName }: { contextName: string }) {
  const allMonitors = useDeploymentMonitors((s) => s.monitors)
  const add = useDeploymentMonitors((s) => s.add)
  const remove = useDeploymentMonitors((s) => s.remove)
  const monitors = allMonitors.filter((m) => m.context === contextName)
  const [open, setOpen] = useState(false)
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  useNowTick()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let tries = 0
    // The deployment informer starts on first use, so the first list can be
    // empty; retry briefly while the menu is open.
    const load = () => {
      api
        .listDeployments(contextName, '')
        .then((list) => {
          if (cancelled) return
          setDeployments(list ?? [])
          if ((list ?? []).length === 0 && tries++ < 5) window.setTimeout(load, 500)
        })
        .catch(() => {})
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, contextName])

  const byNamespace = new Map<string, string[]>()
  for (const d of deployments) byNamespace.set(d.namespace, [...(byNamespace.get(d.namespace) ?? []), d.name])
  const namespaces = [...byNamespace.keys()].sort()
  const watched = new Set(monitors.map(monitorKey))

  return (
    <section className="px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deployment monitors</h2>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              <Activity className="size-3.5" aria-hidden />
              Monitor deployment
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {monitors.length === 0 ? (
        <p className="text-xs text-muted-foreground">No deployments monitored.</p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border text-xs">
          {monitors.map((m) => (
            <li key={monitorKey(m)} className="flex items-center gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono">
                {m.namespace}/{m.name}
              </span>
              {m.error ? (
                <span className="truncate text-destructive" title={m.error}>
                  {m.error}
                </span>
              ) : m.last ? (
                <span className="text-muted-foreground">
                  {m.last.ready}/{m.last.replicas} ready · {m.last.images.join(', ')}
                </span>
              ) : (
                <span className="text-muted-foreground">Checking…</span>
              )}
              <span className="w-16 text-right text-muted-foreground">
                {m.lastCheckedAt ? formatAge(new Date(m.lastCheckedAt).toISOString()) : ''}
              </span>
              <button
                type="button"
                aria-label={`Stop monitoring ${m.name}`}
                title="Stop monitoring"
                onClick={() => remove(monitorKey(m))}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

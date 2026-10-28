import { useEffect, useMemo, useRef } from 'react'
import { Activity, BellRing, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextName } from '@/features/_shared/ContextName'
import { useKubeContexts } from '@/features/contexts/useKubeContexts'
import { DeploymentPicker } from '@/features/overview/DeploymentPicker'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { cn } from '@/lib/utils'
import {
  monitorKey,
  useDeploymentMonitors,
  type MonitorAlert,
  type MonitoredDeployment,
} from '@/store/deploymentMonitors'
import { useActiveContexts } from '@/store/ui'

// Configured monitors and their recent alerts, grouped by cluster. Covers
// every context with monitors or alerts, not only the active ones, since
// monitors keep running for clusters that are not in view.
export function MonitorView() {
  const alerts = useDeploymentMonitors((s) => s.alerts)
  const monitors = useDeploymentMonitors((s) => s.monitors)
  const clearAlerts = useDeploymentMonitors((s) => s.clearAlerts)
  const activeContexts = useActiveContexts()
  const kubeContexts = useKubeContexts()
  // Active clusters first, as the likeliest pick, then the rest of the kubeconfig.
  const allContexts = useMemo(() => {
    const rest = kubeContexts
      .map((c) => c.name)
      .filter((n) => !activeContexts.includes(n))
      .sort()
    return [...activeContexts, ...rest]
  }, [kubeContexts, activeContexts])
  useNowTick()

  const contexts = useMemo(() => {
    const set = new Set<string>([
      ...activeContexts,
      ...monitors.map((m) => m.context),
      ...alerts.map((a) => a.context),
    ])
    return [...set].sort()
  }, [activeContexts, monitors, alerts])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">Monitor</h1>
          <span className="text-xs text-muted-foreground">
            {monitors.length} deployment{monitors.length === 1 ? '' : 's'} monitored · {alerts.length} alert
            {alerts.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DeploymentPicker contexts={allContexts}>
            <Button variant="outline" size="sm">
              <Activity />
              Add monitor
            </Button>
          </DeploymentPicker>
          <Button variant="outline" size="sm" disabled={alerts.length === 0} onClick={() => clearAlerts()}>
            <Trash2 />
            Clear all
          </Button>
        </div>
      </div>
      {contexts.length === 0 && (
        <p className="px-6 py-8 text-center text-xs text-muted-foreground">
          No deployments monitored. Use Add monitor to pick one.
        </p>
      )}
      {contexts.map((ctx) => (
        <ClusterSection
          key={ctx}
          context={ctx}
          monitors={monitors.filter((m) => m.context === ctx)}
          alerts={alerts.filter((a) => a.context === ctx)}
          onClear={() => clearAlerts(ctx)}
        />
      ))}
    </div>
  )
}

function ClusterSection({
  context,
  monitors,
  alerts,
  onClear,
}: {
  context: string
  monitors: MonitoredDeployment[]
  alerts: MonitorAlert[]
  onClear: () => void
}) {
  const focus = useDeploymentMonitors((s) => s.focus)
  const keys = new Set(monitors.map(monitorKey))
  return (
    <section className="border-b border-border px-6 py-4">
      <div className="mb-3 flex min-w-0 items-center gap-2 text-sm font-medium">
        <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <ContextName name={context} />
        <span className="text-xs font-normal text-muted-foreground">
          {monitors.length} monitored · {alerts.length} alert{alerts.length === 1 ? '' : 's'}
        </span>
      </div>

      <h3 className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Monitors</h3>
      {monitors.length === 0 ? (
        <p className="mb-4 text-xs text-muted-foreground">No deployments monitored.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border rounded border border-border text-xs">
          {monitors.map((m) => (
            <MonitorRow key={monitorKey(m)} monitor={m} />
          ))}
        </ul>
      )}

      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Recent alerts</h3>
        {alerts.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent alerts.</p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border text-xs">
          {alerts.map((a) => {
            const key = monitorKey(a)
            const live = keys.has(key)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!live}
                  onClick={() => focus(key)}
                  title={live ? 'Show this monitor' : 'This monitor was stopped'}
                  className="flex w-full items-start gap-3 border-l-2 border-l-amber-500 px-3 py-2 text-left enabled:hover:bg-accent disabled:opacity-60"
                >
                  <span className="w-56 shrink-0 truncate font-mono" title={`${a.namespace}/${a.name}`}>
                    {a.namespace}/{a.name}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{a.changes.join(', ')}</span>
                  <span
                    className="w-16 shrink-0 text-right text-muted-foreground"
                    title={new Date(a.at).toLocaleString()}
                  >
                    {formatAge(new Date(a.at).toISOString())}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MonitorRow({ monitor: m }: { monitor: MonitoredDeployment }) {
  const key = monitorKey(m)
  const focused = useDeploymentMonitors((s) => s.focusedKey === key)
  const focus = useDeploymentMonitors((s) => s.focus)
  const remove = useDeploymentMonitors((s) => s.remove)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!focused) return
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // The highlight fades after a few seconds so it does not stick around.
    const id = window.setTimeout(() => focus(null), 4000)
    return () => window.clearTimeout(id)
  }, [focused, focus])

  return (
    <li
      ref={ref}
      data-monitor-key={key}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 transition-colors',
        focused && 'bg-amber-500/15 ring-2 ring-inset ring-amber-500',
      )}
    >
      <span className="w-56 shrink-0 truncate font-mono" title={`${m.namespace}/${m.name}`}>
        {m.namespace}/{m.name}
      </span>
      {m.error ? (
        <span className="min-w-0 flex-1 truncate text-destructive" title={m.error}>
          {m.error}
        </span>
      ) : m.last ? (
        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={m.last.images.join(', ')}>
          {m.last.ready}/{m.last.replicas} ready · {m.last.images.join(', ')}
        </span>
      ) : (
        <span className="min-w-0 flex-1 text-muted-foreground">Checking…</span>
      )}
      <span className="w-16 shrink-0 text-right text-muted-foreground">
        {m.lastCheckedAt ? formatAge(new Date(m.lastCheckedAt).toISOString()) : ''}
      </span>
      <Button
        variant={focused ? 'destructive' : 'outline'}
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => remove(key)}
        aria-label={`Stop monitoring ${m.namespace}/${m.name}`}
      >
        <Square className="size-3" />
        Stop
      </Button>
    </li>
  )
}

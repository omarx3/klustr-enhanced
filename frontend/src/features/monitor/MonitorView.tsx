import { useMemo } from 'react'
import { Activity, BellRing, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextName } from '@/features/_shared/ContextName'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { useDeploymentMonitors, type MonitorAlert } from '@/store/deploymentMonitors'
import { useActiveContexts, useUIStore } from '@/store/ui'

// Recent deployment monitor alerts, grouped by cluster. Covers every context
// with monitors or alerts, not only the active ones, since monitors keep
// running for clusters that are not in view.
export function MonitorView() {
  const alerts = useDeploymentMonitors((s) => s.alerts)
  const monitors = useDeploymentMonitors((s) => s.monitors)
  const clearAlerts = useDeploymentMonitors((s) => s.clearAlerts)
  const activeContexts = useActiveContexts()
  const setSelectedView = useUIStore((s) => s.setSelectedView)
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
          <Button variant="outline" size="sm" onClick={() => setSelectedView('overview')}>
            <Activity />
            Add monitor
          </Button>
          <Button variant="outline" size="sm" disabled={alerts.length === 0} onClick={() => clearAlerts()}>
            <Trash2 />
            Clear all
          </Button>
        </div>
      </div>
      {contexts.length === 0 && (
        <p className="px-6 py-8 text-center text-xs text-muted-foreground">
          No deployments monitored. Add one from the cluster Overview.
        </p>
      )}
      {contexts.map((ctx) => (
        <ClusterAlerts
          key={ctx}
          context={ctx}
          alerts={alerts.filter((a) => a.context === ctx)}
          monitored={monitors.filter((m) => m.context === ctx).length}
          onClear={() => clearAlerts(ctx)}
        />
      ))}
    </div>
  )
}

function ClusterAlerts({
  context,
  alerts,
  monitored,
  onClear,
}: {
  context: string
  alerts: MonitorAlert[]
  monitored: number
  onClear: () => void
}) {
  return (
    <section className="border-b border-border px-6 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <ContextName name={context} />
          <span className="text-xs font-normal text-muted-foreground">
            {monitored} monitored · {alerts.length} alert{alerts.length === 1 ? '' : 's'}
          </span>
        </div>
        {alerts.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent alerts.</p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border text-xs">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-3 border-l-2 border-l-amber-500 px-3 py-2">
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
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

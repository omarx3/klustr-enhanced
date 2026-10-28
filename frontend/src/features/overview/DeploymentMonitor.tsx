import { useEffect } from 'react'
import { Activity, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
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
import { DeploymentPicker } from './DeploymentPicker'

// Reads the API directly instead of the informer cache, which exists only
// for the cluster in view, so monitors keep running after a cluster switch.
async function snapshot(m: MonitoredDeployment): Promise<DeploymentSnapshot> {
  const d = await api.deploymentStatus(m.context, m.namespace, m.name)
  return { replicas: d.replicas, ready: d.ready, images: d.images ?? [] }
}

function notify(key: string, title: string, body: string) {
  toast.warning(title, {
    // One toast per deployment: a newer change replaces the older one.
    id: `monitor:${key}`,
    description: body,
    duration: 30000,
    position: 'top-center',
    richColors: true,
    closeButton: true,
    // Larger than the default toast so a change is hard to miss.
    className: '!w-[28rem] !p-5 !text-sm [&_[data-title]]:!text-base [&_[data-description]]:!text-sm',
  })
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

let checking = false

async function checkAll() {
  // Overlapping runs would compare against the same baseline and notify twice.
  if (checking) return
  checking = true
  const { monitors, record, addAlert } = useDeploymentMonitors.getState()
  try {
    await Promise.all(
      monitors.map(async (m) => {
        const key = monitorKey(m)
        try {
          const next = await snapshot(m)
          if (m.last) {
            const changes = diffSnapshots(m.last, next)
            if (changes.length > 0) {
              addAlert({ context: m.context, namespace: m.namespace, name: m.name, changes, at: Date.now() })
              notify(key, `Deployment ${m.namespace}/${m.name} changed`, `${m.context}: ${changes.join(', ')}`)
            }
          }
          record(key, { last: next, lastCheckedAt: Date.now(), error: null })
        } catch (e) {
          record(key, { lastCheckedAt: Date.now(), error: String(e) })
        }
      }),
    )
  } finally {
    checking = false
  }
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
  const remove = useDeploymentMonitors((s) => s.remove)
  const monitors = allMonitors.filter((m) => m.context === contextName)
  useNowTick()

  return (
    <section className="px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deployment monitors</h2>
        <DeploymentPicker contextName={contextName}>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            <Activity className="size-3.5" aria-hidden />
            Monitor deployment
          </button>
        </DeploymentPicker>
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

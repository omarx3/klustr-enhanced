import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ExternalLink, Play, Square } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { api, type ServicePortDetail } from '@/lib/api'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { usePortForwards } from '@/store/portForwards'
import { activeServiceForwards, localURL, parseLocalPort, serviceForwards, type ServiceRef } from './servicePortForward'

type Props = {
  service: ServiceRef
  open: boolean
  onOpenChange: (open: boolean) => void
}

const tcp = (p: ServicePortDetail) => !p.protocol || p.protocol === 'TCP'

export function ServicePortForwardDialog({ service, open, onOpenChange }: Props) {
  const list = usePortForwards((s) => s.list)
  const forwards = serviceForwards(list, service)
  const active = activeServiceForwards(list, service)
  const [ports, setPorts] = useState<ServicePortDetail[] | null>(null)
  const [servicePort, setServicePort] = useState<number | null>(null)
  const [localPort, setLocalPort] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .getService(service.context, service.namespace, service.name)
      .then((d) => {
        if (cancelled) return
        const usable = (d?.ports ?? []).filter(tcp)
        setPorts(usable)
        const first = usable[0]?.port ?? null
        setServicePort(first)
        setLocalPort((current) => current || (first ? String(first >= 1024 ? first : first + 8000) : ''))
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [open, service.context, service.namespace, service.name])

  const parsed = parseLocalPort(localPort)
  const portError = parsed && 'error' in parsed ? parsed.error : null
  const canStart = servicePort !== null && parsed !== null && 'port' in parsed

  const start = useMutation({
    mutationFn: async () => {
      if (servicePort === null || !parsed || !('port' in parsed)) throw new Error('Pick a port first')
      return api.startServicePortForward(service.context, service.namespace, service.name, servicePort, parsed.port)
    },
    onSuccess: (info) => {
      toast.success(`Forwarding ${localURL(info.localPort)} to service/${service.name}:${info.servicePort}`)
      BrowserOpenURL(localURL(info.localPort))
      onOpenChange(false)
    },
  })

  const stop = useMutation({
    mutationFn: () => api.stopServicePortForwards(service.context, service.namespace, service.name),
    onSuccess: () => toast.success(`Stopped port-forward for service/${service.name}`),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) start.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Port-forward</DialogTitle>
          <DialogDescription>
            Forward <span className="font-mono text-xs">service/{service.name}</span> in{' '}
            <span className="font-mono text-xs">{service.namespace}</span> to a port on your machine.
          </DialogDescription>
        </DialogHeader>

        {forwards.length > 0 && (
          <div className="space-y-1.5" aria-label="Active port-forwards">
            {forwards.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${f.status === 'ready' ? 'bg-emerald-500' : 'bg-destructive'}`}
                />
                <span className="min-w-0 flex-1 truncate font-mono" title={f.error || undefined}>
                  {localURL(f.localPort)} → :{f.servicePort}
                  {f.status !== 'ready' && <span className="ml-1 text-destructive">{f.error || f.status}</span>}
                </span>
                {f.status === 'ready' && (
                  <Button size="xs" variant="ghost" onClick={() => BrowserOpenURL(localURL(f.localPort))}>
                    <ExternalLink />
                    Open
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {active.length === 0 && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (canStart && !start.isPending) start.mutate()
            }}
          >
            {ports && ports.length > 1 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Service port</div>
                <div className="flex flex-wrap gap-1.5">
                  {ports.map((p) => (
                    <button
                      key={p.port}
                      type="button"
                      aria-pressed={servicePort === p.port}
                      onClick={() => setServicePort(p.port)}
                      className={[
                        'rounded border px-2 py-0.5 font-mono text-xs',
                        servicePort === p.port
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:bg-muted',
                      ].join(' ')}
                    >
                      {p.name ? `${p.name} ` : ''}
                      {p.port}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {ports && ports.length === 1 && (
              <div className="text-xs text-muted-foreground">
                Service port <span className="font-mono text-foreground">{ports[0].port}</span>
              </div>
            )}
            {ports && ports.length === 0 && (
              <p className="text-xs text-destructive">This service has no TCP ports to forward.</p>
            )}
            <div className="space-y-1">
              <label htmlFor="service-pf-local-port" className="text-xs text-muted-foreground">
                Local port
              </label>
              <Input
                id="service-pf-local-port"
                inputMode="numeric"
                autoFocus
                spellCheck={false}
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                placeholder="e.g. 8080"
                aria-invalid={!!portError}
                className="w-40 font-mono"
              />
              {portError ? (
                <p className="text-xs text-destructive">{portError}</p>
              ) : (
                <p className="text-[0.6875rem] text-muted-foreground">
                  Start opens localhost on this port in your browser. 0 picks a free port.
                </p>
              )}
            </div>
          </form>
        )}

        {(loadError || start.error || stop.error) && (
          <p className="break-words rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {String(start.error ?? stop.error ?? loadError)}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {forwards.length > 0 && (
            <Button variant="destructive" onClick={() => stop.mutate()} disabled={stop.isPending}>
              <Square />
              {stop.isPending ? 'Stopping…' : 'Stop'}
            </Button>
          )}
          {active.length === 0 && (
            <Button onClick={() => start.mutate()} disabled={!canStart || start.isPending}>
              <Play />
              {start.isPending ? 'Starting…' : 'Start'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

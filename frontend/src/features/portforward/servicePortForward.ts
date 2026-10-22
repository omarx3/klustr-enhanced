import type { PortForwardInfo } from '@/lib/api'

export type ServiceRef = { context: string; namespace: string; name: string }

// Forwards started for one Service. Pod forwards (no serviceName) never
// match, so a pod forward is never mistaken for a service one.
export function serviceForwards(list: readonly PortForwardInfo[], svc: ServiceRef): PortForwardInfo[] {
  return list.filter(
    (f) =>
      !!f.serviceName &&
      f.serviceName === svc.name &&
      f.namespace === svc.namespace &&
      f.context === svc.context,
  )
}

// Active means the tunnel is up. Errored forwards stay listed until stopped
// (so the failure is visible) but are not active and do not earn the tag.
export function activeServiceForwards(
  list: readonly PortForwardInfo[],
  svc: ServiceRef,
): PortForwardInfo[] {
  return serviceForwards(list, svc).filter((f) => f.status === 'ready')
}

// Parses the local port field. Empty means "not set yet"; 0 is allowed and
// lets the OS pick a free port. Anything else must be a whole port number.
export function parseLocalPort(raw: string): { port: number } | { error: string } | null {
  const v = raw.trim()
  if (v === '') return null
  if (!/^\d+$/.test(v)) return { error: 'Enter a number.' }
  const port = Number(v)
  if (port > 65535) return { error: 'Port must be 65535 or lower.' }
  return { port }
}

export function localURL(port: number): string {
  return `http://localhost:${port}`
}

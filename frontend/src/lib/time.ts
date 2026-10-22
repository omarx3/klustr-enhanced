export function formatAge(iso: string): string {
  if (!iso) return '—'
  const created = new Date(iso).getTime()
  if (Number.isNaN(created)) return '—'
  let diff = Math.max(0, Math.floor((Date.now() - created) / 1000))
  const days = Math.floor(diff / 86400)
  diff -= days * 86400
  const hours = Math.floor(diff / 3600)
  diff -= hours * 3600
  const minutes = Math.floor(diff / 60)
  const seconds = diff - minutes * 60
  if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`
  if (minutes > 0) return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`
  return `${seconds}s`
}

// formatTimestamp renders an absolute ISO timestamp as a human-readable
// local date-time (e.g. "Jan 27, 2025, 08:15"), falling back to "—" for
// empty or unparseable input. Used for detail fields where the raw RFC3339
// string (2025-01-27T08:15:16Z) is too noisy to scan.
export function formatTimestamp(iso: string): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return '—'
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type ExpiryTone = 'ok' | 'warn' | 'crit' | 'expired'

export type Expiry = {
  label: string
  tone: ExpiryTone
}

// formatExpiry turns an absolute timestamp (e.g. a certificate's notAfter)
// into a human countdown plus a severity tone the UI colours by. Anything
// under 7 days is critical, under 30 days a warning — the thresholds match
// cert-manager's default 2/3-of-lifetime renewal window for 90-day certs.
export function formatExpiry(iso: string): Expiry | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  const secs = Math.floor((target - Date.now()) / 1000)
  if (secs <= 0) {
    return { label: `expired ${roughDuration(-secs)} ago`, tone: 'expired' }
  }
  const tone: ExpiryTone = secs < 7 * 86400 ? 'crit' : secs < 30 * 86400 ? 'warn' : 'ok'
  return { label: `in ${roughDuration(secs)}`, tone }
}

// roughDuration renders a coarse single-or-double-unit duration ("63d",
// "5h", "12m") from a positive number of seconds.
function roughDuration(secs: number): string {
  const days = Math.floor(secs / 86400)
  if (days > 0) {
    const hours = Math.floor((secs - days * 86400) / 3600)
    return days < 2 && hours > 0 ? `${days}d${hours}h` : `${days}d`
  }
  const hours = Math.floor(secs / 3600)
  if (hours > 0) return `${hours}h`
  const minutes = Math.floor(secs / 60)
  if (minutes > 0) return `${minutes}m`
  return `${secs}s`
}

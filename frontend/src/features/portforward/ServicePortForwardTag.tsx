import { Network } from 'lucide-react'
import { usePortForwards } from '@/store/portForwards'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { activeServiceForwards, localURL, type ServiceRef } from './servicePortForward'

// Shown next to a Service name only while one of its forwards is up. Clicking
// it opens the forwarded port in the browser.
export function ServicePortForwardTag({ service }: { service: ServiceRef }) {
  const ports = usePortForwards((s) =>
    activeServiceForwards(s.list, service)
      .map((f) => f.localPort)
      .join(','),
  )
  if (!ports) return null
  const list = ports.split(',').map(Number)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        BrowserOpenURL(localURL(list[0]))
      }}
      title={`Port-forward active: ${list.map(localURL).join(', ')}`}
      aria-label={`Port-forward active on ${list.map((p) => `localhost:${p}`).join(', ')}`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px font-mono text-[0.625rem] font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
    >
      <Network className="size-3" />
      :{list.join(', :')}
    </button>
  )
}

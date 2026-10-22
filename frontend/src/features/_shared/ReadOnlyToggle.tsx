import { Lock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

// Header control for global read-only mode, styled as an iOS-style sliding
// switch: a lock beside an amber track whose knob slides on. The store flag is
// pushed to the Go ClientManager, which refuses every mutation while set (a
// hard guard, not just disabled buttons). The StatusBar carries the spelled-out
// status; this is purely the control.
export function ReadOnlyToggle() {
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const setReadOnly = useUIStore((s) => s.setGlobalReadOnly)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={readOnly}
          aria-label="Toggle read-only mode"
          onClick={() => setReadOnly(!readOnly)}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
        >
          <Lock
            className={cn(
              'size-3.5 transition-colors',
              readOnly ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors',
              readOnly ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span
              className={cn(
                'inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                readOnly ? 'translate-x-[16px]' : 'translate-x-[2px]',
              )}
            />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {readOnly
          ? 'Read-only mode is ON — Klustr refuses every mutation. Click to allow writes.'
          : 'Read-only mode is OFF — click to block all mutations on the active context(s).'}
      </TooltipContent>
    </Tooltip>
  )
}

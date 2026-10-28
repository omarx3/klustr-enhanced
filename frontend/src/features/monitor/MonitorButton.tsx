import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDeploymentMonitors } from '@/store/deploymentMonitors'
import { useUIStore } from '@/store/ui'

export function MonitorButton() {
  const active = useUIStore((s) => s.selectedView === 'monitor' && s.selectedCRDKey === null)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const alertCount = useDeploymentMonitors((s) => s.alerts.length)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Open monitor"
          onClick={() => setSelectedView('monitor')}
          className={active ? 'text-foreground' : 'text-muted-foreground'}
        >
          <BellRing />
          <span className="text-xs">Monitor</span>
          {alertCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[0.625rem] font-medium leading-4 text-white">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Deployment monitor alerts</TooltipContent>
    </Tooltip>
  )
}

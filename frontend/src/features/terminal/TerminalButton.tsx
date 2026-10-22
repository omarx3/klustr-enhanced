import { SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTerminalStore } from '@/store/terminals'

export function TerminalButton() {
  const open = useTerminalStore((s) => s.drawerOpen)
  const tabs = useTerminalStore((s) => s.tabs)
  const toggle = useTerminalStore((s) => s.toggleDrawer)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Toggle terminal panel"
          onClick={toggle}
          className={open ? 'text-foreground' : 'text-muted-foreground'}
        >
          <SquareTerminal />
          <span className="text-xs">
            {tabs.length > 0 ? `${tabs.length} terminal${tabs.length === 1 ? '' : 's'}` : 'Terminal'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Toggle terminal (Cmd/Ctrl+`)</TooltipContent>
    </Tooltip>
  )
}

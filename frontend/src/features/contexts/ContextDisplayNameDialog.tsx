import { useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useUIStore } from '@/store/ui'

type Props = {
  contextName: string
  onClose: () => void
}

// Sets the label a kubeconfig context is shown under. The kubeconfig name is
// the default and stays the identity; saving it unchanged or blank clears the
// override.
export function ContextDisplayNameDialog({ contextName, onClose }: Props) {
  const current = useUIStore((s) => s.contextDisplayNames[contextName] ?? '')
  const setDisplayName = useUIStore((s) => s.setContextDisplayName)
  const [value, setValue] = useState(current || contextName)
  const trimmed = value.trim()

  const save = () => {
    setDisplayName(contextName, trimmed)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Display name</DialogTitle>
          <DialogDescription className="break-all">
            Kubeconfig context: <span className="font-mono">{contextName}</span>
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <label htmlFor="context-display-name" className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            id="context-display-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={contextName}
            maxLength={100}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="text-[0.6875rem] text-muted-foreground">
            Leave blank to use the kubeconfig name.
          </p>
        </form>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={!current}
            onClick={() => {
              setDisplayName(contextName, null)
              onClose()
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button onClick={save}>
              <Check className="size-3.5" />
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

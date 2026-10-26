import { useState } from 'react'
import { History } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { api, type ResourceBackup } from '@/lib/api'

type Props = {
  contextName: string | null
  kind: string
  namespace: string
  name: string
  disabled?: boolean
  // Receives the chosen backup's manifest; the YAML tab opens it as a draft
  // so the restore goes through the usual review and dry-run.
  onRestore: (manifest: string, backup: ResourceBackup) => void
}

function formatTaken(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function RestoreBackupMenu({ contextName, kind, namespace, name, disabled, onRestore }: Props) {
  const [backups, setBackups] = useState<ResourceBackup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The list is read each time the menu opens, so a backup taken by the last
  // apply shows without a refresh.
  const load = () => {
    if (!contextName) return
    setBackups(null)
    setError(null)
    api
      .listResourceBackups(contextName, kind, namespace, name)
      .then((list) => setBackups(list ?? []))
      .catch((e: unknown) => setError(String(e)))
  }

  const restore = (b: ResourceBackup) => {
    api
      .readResourceBackup(b.file)
      .then((manifest) => onRestore(manifest, b))
      .catch((e: unknown) => toast.error('Could not read backup', { description: String(e) }))
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled || !contextName}
          title="Restore a backup taken before an earlier edit"
        >
          <History className="size-3" />
          Restore
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Backups in ~/klustr-backup
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {error ? (
          <div className="px-2 py-2 text-xs text-destructive">{error}</div>
        ) : backups === null ? (
          <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
            <Spinner size="sm" />
            Loading…
          </div>
        ) : backups.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            No backups yet. One is saved each time you apply an edit.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {backups.map((b) => (
              <DropdownMenuItem key={b.file} onSelect={() => restore(b)} className="flex-col items-start gap-0.5">
                <span className="text-xs">{formatTaken(b.takenAt)}</span>
                <span className="w-full truncate font-mono text-[0.625rem] text-muted-foreground" title={b.file}>
                  {b.file}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

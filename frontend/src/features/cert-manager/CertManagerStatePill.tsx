// CertManagerStatePill renders the .status.state string ACME Orders and
// Challenges use (pending / ready / valid / invalid / errored / expired /
// processing) as a coloured chip. Unlike conditions these are free-form
// strings, so we bucket them into success / in-progress / failure tones.
const SUCCESS = new Set(['valid', 'ready'])
const PENDING = new Set(['pending', 'processing'])

export function CertManagerStatePill({ state }: { state: string }) {
  if (!state) return <span className="text-muted-foreground/70">—</span>
  const lower = state.toLowerCase()
  const cls = SUCCESS.has(lower)
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : PENDING.has(lower)
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide ${cls}`}
    >
      {state}
    </span>
  )
}

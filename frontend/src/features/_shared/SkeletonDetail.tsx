import { Skeleton } from '@/components/ui/skeleton'

const FIELD_WIDTHS = ['65%', '40%', '55%', '48%', '35%']

function SkeletonField({ valueWidth }: { valueWidth: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <Skeleton className="h-3 w-32 shrink-0" />
      <Skeleton className="h-3" style={{ width: valueWidth }} />
    </div>
  )
}

function SkeletonSection({ rows }: { rows: number }) {
  return (
    <section className="rounded-md border border-border bg-card/40 p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonField key={i} valueWidth={FIELD_WIDTHS[i % FIELD_WIDTHS.length]} />
        ))}
      </div>
    </section>
  )
}

export function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <SkeletonSection rows={4} />
        <SkeletonSection rows={3} />
      </div>
      <SkeletonSection rows={5} />
    </div>
  )
}

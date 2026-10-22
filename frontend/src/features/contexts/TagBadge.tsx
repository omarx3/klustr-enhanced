import type { ContextTagMeta } from './contextTagMeta'

type Size = 'xs' | 'sm'

const SIZES: Record<Size, { container: string; dot: string; text: string }> = {
  xs: { container: 'gap-1 px-1.5 py-px', dot: 'size-1', text: 'text-[0.5625rem]' },
  sm: { container: 'gap-1.5 px-2 py-0.5', dot: 'size-1.5', text: 'text-[0.625rem]' },
}

export function TagBadge({
  meta,
  size = 'sm',
  className,
}: {
  meta: ContextTagMeta
  size?: Size
  className?: string
}) {
  const s = SIZES[size]
  return (
    <span
      title={meta.label}
      className={[
        'inline-flex shrink-0 items-center rounded-full border font-semibold tracking-wider',
        s.container,
        s.text,
        meta.badgeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden className={`shrink-0 rounded-full ${s.dot} ${meta.dotClass}`} />
      {meta.shortLabel}
    </span>
  )
}

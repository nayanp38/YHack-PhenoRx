/** Lower tier number = more favorable coverage (e.g. preferred generic). */
function tierVisuals(tier: number): {
  border: string
  background: string
  color: string
  label: string
} {
  const t = Math.min(4, Math.max(1, tier))
  const map: Record<number, { border: string; background: string; color: string }> = {
    1: {
      border: 'var(--tier-1-green)',
      background: 'rgba(22, 163, 74, 0.14)',
      color: 'var(--tier-1-green)',
    },
    2: {
      border: 'var(--tier-2-blue)',
      background: 'rgba(37, 99, 235, 0.12)',
      color: 'var(--tier-2-blue)',
    },
    3: {
      border: 'var(--tier-3-amber)',
      background: 'rgba(217, 119, 6, 0.12)',
      color: 'var(--tier-3-amber)',
    },
    4: {
      border: 'var(--tier-4-red)',
      background: 'rgba(220, 38, 38, 0.1)',
      color: 'var(--tier-4-red)',
    },
  }
  const v = map[t] ?? {
    border: 'var(--px-border)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--px-text-secondary)',
  }
  return { ...v, label: `Tier ${tier}` }
}

type Props = {
  tier: number | null | undefined
  /** Larger padding for table cells */
  size?: 'sm' | 'md'
}

export function TierBadge({ tier, size = 'sm' }: Props) {
  if (tier == null) {
    return (
      <span
        className={`inline-flex items-center rounded-md border-2 border-dashed font-semibold text-[var(--px-text-tertiary)] ${size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'}`}
        style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.03)' }}
      >
        —
      </span>
    )
  }

  const { border, background, color, label } = tierVisuals(tier)
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      className={`inline-flex items-center rounded-md border-2 font-bold tracking-tight ${pad}`}
      style={{
        borderColor: border,
        background,
        color,
        boxShadow: `0 0 0 1px ${border}33`,
      }}
      title={`Formulary tier ${tier} (${tier <= 2 ? 'more favorable' : 'higher cost / less preferred'})`}
    >
      {label}
    </span>
  )
}

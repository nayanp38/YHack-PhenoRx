/** Visualize side-effect burden (WSI/SAP scale ~0–15 for typical drugs). */
type Props = {
  value: number | null
  className?: string
}

function zoneColor(pct: number): string {
  if (pct < 33) return 'var(--severity-low)'
  if (pct < 66) return 'var(--severity-moderate)'
  return 'var(--severity-high)'
}

export function SeverityBar({ value, className = '' }: Props) {
  if (value == null || Number.isNaN(value)) {
    return (
      <div className={`text-sm italic text-[var(--px-text-tertiary)] ${className}`}>
        Side effect index not available
      </div>
    )
  }

  const capped = Math.min(15, Math.max(0, value))
  const pct = (capped / 15) * 100
  const fill = zoneColor(pct)

  return (
    <div className={className}>
      <div className="mb-1 flex justify-between text-xs text-[var(--px-text-secondary)]">
        <span>Side effect burden</span>
        <span className="font-mono font-semibold text-[var(--px-text)]">{value.toFixed(2)}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: fill,
            minWidth: value > 0 ? '4px' : 0,
          }}
        />
      </div>
    </div>
  )
}

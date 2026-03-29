export function TierBadge({ tier }: { tier: number | null | undefined }) {
  if (tier == null) return <span className="text-xs text-[var(--gray-500)]">—</span>
  const colors: Record<number, string> = {
    1: 'bg-[var(--tier-1-green)]',
    2: 'bg-[var(--tier-2-blue)]',
    3: 'bg-[var(--tier-3-amber)]',
    4: 'bg-[var(--tier-4-red)]',
  }
  const c = colors[tier] ?? 'bg-[var(--gray-500)]'
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white ${c}`}>
      Tier {tier}
    </span>
  )
}

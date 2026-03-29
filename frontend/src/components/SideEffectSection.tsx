import type { SideEffectFlagItem } from '../types'

type Props = {
  flags: SideEffectFlagItem[]
}

export function SideEffectSection({ flags }: Props) {
  if (!flags.length) return null

  return (
    <section className="mb-8">
      <h3 className="mb-4 font-display text-[18px] font-medium text-[var(--px-high)]">
        Side Effect Considerations for Recommended Alternatives
      </h3>
      <div className="space-y-4">
        {flags.map((f) => (
          <div key={`${f.original_drug}-${f.alternative_drug}`} className="summary-callout summary-callout--warning">
            <p className="text-[14px] font-bold text-[var(--px-text)]">{f.headline}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--px-text-secondary)]">{f.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {f.boxed_warning && <span className="boxed-warning-badge">Boxed Warning</span>}
              {(f.new_severe_events || [])
                .filter((e) => e.meddra_pt)
                .map((e) => (
                  <span
                    key={e.meddra_pt}
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--px-critical)]"
                    style={{ background: 'var(--px-critical-dim)' }}
                  >
                    NEW: {e.meddra_pt.replace(/_/g, ' ')}
                    {e.grade != null ? ` (Grade ${e.grade})` : ''}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

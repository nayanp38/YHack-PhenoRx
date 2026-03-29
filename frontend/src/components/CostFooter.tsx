import type { AlternativeComparison, InsuranceScreeningResult, PipelineResult } from '../types'
import { SeverityBadge } from './SeverityBadge'
import { TierBadge } from './TierBadge'

type Props = {
  insurance: InsuranceScreeningResult
  pipeline?: PipelineResult | null
}

function hasSideEffectColumn(pipeline?: PipelineResult | null): boolean {
  return Boolean(pipeline?.interactions?.some((i) => i.side_effect_comparison))
}

function findAltComparison(
  pipeline: PipelineResult | undefined,
  originalDrug: string,
  alternativeDrug: string
): AlternativeComparison | undefined {
  if (!pipeline?.interactions) return undefined
  const od = originalDrug.toLowerCase()
  const ad = alternativeDrug.toLowerCase()
  for (const it of pipeline.interactions) {
    if (it.drug_name.toLowerCase() !== od) continue
    const sec = it.side_effect_comparison
    if (!sec) continue
    const c = sec.alternative_comparisons.find((x) => x.alternative_drug.toLowerCase() === ad)
    if (c) return c
  }
  return undefined
}

export function CostFooter({ insurance, pipeline }: Props) {
  const showFx = hasSideEffectColumn(pipeline)
  const current = insurance.totalEstimatedMonthlyCost
  const savingsSum = insurance.alternativeSavings.reduce(
    (acc, s) => acc + Math.max(0, s.monthlySavings ?? 0),
    0
  )
  const recommended = Math.max(0, current - savingsSum)
  const delta = current - recommended

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: '#a78bfa',
        background: 'rgba(167, 139, 250, 0.06)',
        borderColor: 'var(--px-border)',
      }}
    >
      <h3 className="mb-4 text-[16px] font-bold text-[var(--px-text)]">Cost comparison</h3>
      <table className="mb-4 w-full text-sm text-[var(--px-text)]">
        <thead>
          <tr className="border-b text-left text-[var(--px-text-tertiary)]" style={{ borderColor: 'var(--px-border)' }}>
            <th className="py-2 pr-2">Drug</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 pr-2">Tier</th>
            <th className="py-2 pr-2">Monthly</th>
            {showFx && <th className="py-2">Side Effects</th>}
          </tr>
        </thead>
        <tbody>
          {insurance.drugCoverages.map((d) => (
            <tr key={d.drugName} className="border-b" style={{ borderColor: 'var(--px-border)' }}>
              <td className="py-2 pr-2 font-medium">{d.drugName}</td>
              <td className="py-2 pr-2 text-[var(--px-text-secondary)]">Current</td>
              <td className="py-2 pr-2">
                <TierBadge tier={d.tierLevel} size="md" />
              </td>
              <td className="py-2 pr-2">
                {d.estimatedMonthlyCost != null ? `$${d.estimatedMonthlyCost}` : '—'}
              </td>
              {showFx && <td className="py-2 text-[var(--px-text-tertiary)]">—</td>}
            </tr>
          ))}
          {insurance.alternativeSavings.map((s) => {
            const comp = findAltComparison(pipeline ?? undefined, s.originalDrug, s.alternativeDrug)
            return (
              <tr
                key={`${s.originalDrug}-${s.alternativeDrug}`}
                style={{ background: 'rgba(52,211,153,0.06)' }}
              >
                <td className="py-2 pr-2">
                  <span className="opacity-60 line-through">{s.originalDrug}</span>
                  {' → '}
                  {s.alternativeDrug}
                </td>
                <td className="py-2 pr-2 text-[var(--px-accent)]">Recommended</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2 pr-2 font-semibold text-[var(--px-accent)]">
                  {s.monthlySavings != null ? `Save $${s.monthlySavings}/mo` : '—'}
                </td>
                {showFx && (
                  <td className="py-2">
                    {comp ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <SeverityBadge verdict={comp.severity_verdict} size="md" />
                        <span className="font-mono text-[11px] text-[var(--px-text-secondary)]">
                          ({comp.severity_delta > 0 ? '+' : ''}
                          {comp.severity_delta.toFixed(2)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--px-text-tertiary)]">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-[16px] font-bold text-[var(--px-text)]">
        Estimated monthly medication cost: ${current.toFixed(0)} → ${recommended.toFixed(0)} (
        {delta >= 0 ? (
          <span style={{ color: 'var(--px-accent)' }}>Save ${delta.toFixed(0)}/mo</span>
        ) : (
          <span style={{ color: 'var(--px-critical)' }}>
            +${Math.abs(delta).toFixed(0)}/mo increase
          </span>
        )}
        )
      </p>
    </div>
  )
}

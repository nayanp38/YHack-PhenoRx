import type { AlternativeComparison, InsuranceScreeningResult, PipelineResult } from '../types'
import { SeverityBadge } from './SeverityBadge'

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
      className="rounded-xl border border-[var(--gray-200)] p-6"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: 'var(--insurance-purple)',
        background: 'rgba(124, 58, 237, 0.03)',
      }}
    >
      <h3 className="mb-4 text-[16px] font-bold text-[var(--navy)]">Cost comparison</h3>
      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--gray-200)] text-left text-[var(--gray-500)]">
            <th className="py-2 pr-2">Drug</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 pr-2">Tier</th>
            <th className="py-2 pr-2">Monthly</th>
            {showFx && <th className="py-2">Side Effects</th>}
          </tr>
        </thead>
        <tbody>
          {insurance.drugCoverages.map((d) => (
            <tr key={d.drugName} className="border-b border-[var(--gray-100)]">
              <td className="py-2 pr-2 font-medium">{d.drugName}</td>
              <td className="py-2 pr-2 text-[var(--gray-500)]">Current</td>
              <td className="py-2 pr-2">{d.tierLevel ?? '—'}</td>
              <td className="py-2 pr-2">
                {d.estimatedMonthlyCost != null ? `$${d.estimatedMonthlyCost}` : '—'}
              </td>
              {showFx && <td className="py-2 text-[var(--gray-400)]">—</td>}
            </tr>
          ))}
          {insurance.alternativeSavings.map((s) => {
            const comp = findAltComparison(pipeline ?? undefined, s.originalDrug, s.alternativeDrug)
            return (
              <tr key={`${s.originalDrug}-${s.alternativeDrug}`} className="bg-[var(--safe-green-bg)]/40">
                <td className="py-2 pr-2">
                  <span className="line-through opacity-60">{s.originalDrug}</span>
                  {' → '}
                  {s.alternativeDrug}
                </td>
                <td className="py-2 pr-2 text-[var(--savings-green)]">Recommended</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2 pr-2 font-semibold text-[var(--savings-green)]">
                  {s.monthlySavings != null ? `Save $${s.monthlySavings}/mo` : '—'}
                </td>
                {showFx && (
                  <td className="py-2">
                    {comp ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <SeverityBadge verdict={comp.severity_verdict} size="md" />
                        <span className="font-mono text-[11px] text-[var(--gray-600)]">
                          ({comp.severity_delta > 0 ? '+' : ''}
                          {comp.severity_delta.toFixed(2)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--gray-400)]">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-[16px] font-bold text-[var(--gray-800)]">
        Estimated monthly medication cost: ${current.toFixed(0)} → ${recommended.toFixed(0)} (
        {delta >= 0 ? (
          <span style={{ color: 'var(--savings-green)' }}>Save ${delta.toFixed(0)}/mo</span>
        ) : (
          <span style={{ color: 'var(--cost-increase-red)' }}>
            +${Math.abs(delta).toFixed(0)}/mo increase
          </span>
        )}
        )
      </p>
    </div>
  )
}

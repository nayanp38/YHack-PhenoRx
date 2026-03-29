import type { PhenoconversionSummaryAlert } from '../types'

type Props = {
  alerts: PhenoconversionSummaryAlert[]
}

export function PhenoconversionSection({ alerts }: Props) {
  if (!alerts.length) return null

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="phenoconversion-pulse" aria-hidden />
        <h3 className="font-display text-[18px] font-medium text-[var(--px-critical)]">
          Phenoconversion Risk Detected
        </h3>
      </div>
      <div className="space-y-4">
        {alerts.map((a) => (
          <div key={`${a.drug_name}-${a.failure_type}`}>
            <p className="text-[15px] font-semibold text-[var(--px-text)]">
              Your patient&apos;s {a.drug_name} is at risk of{' '}
              {a.failure_type.replace(/_/g, ' ')} due to a phenoconversion interaction.
            </p>
            <div className="summary-callout summary-callout--critical mt-2">
              <p className="text-[14px] leading-relaxed text-[var(--px-text)]">{a.mechanism_explanation}</p>
            </div>
            <p className="mt-3 text-[14px] font-bold text-[var(--px-text)]">
              <span className="text-[var(--px-accent)]">Recommendation:</span> {a.recommendation}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

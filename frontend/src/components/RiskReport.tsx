import { CheckCircle2 } from 'lucide-react'
import { RISK_ORDER } from '../lib/constants'
import type { InsuranceScreeningResult, InteractionResult, PipelineResult } from '../types'
import { CostSummaryBanner } from './CostSummaryBanner'
import { InteractionCard } from './InteractionCard'

type Props = {
  pipeline: PipelineResult
  insurance: InsuranceScreeningResult | null
}

function sortInteractions(items: InteractionResult[]): InteractionResult[] {
  return [...items].sort((a, b) => {
    const oa = RISK_ORDER[a.risk_level] ?? 99
    const ob = RISK_ORDER[b.risk_level] ?? 99
    if (oa !== ob) return oa - ob
    return b.predicted_aucr - a.predicted_aucr
  })
}

function globalReplacementOptions(interactions: InteractionResult[]) {
  const byPerpetrator = new Map<string, { drug: string; alternatives: string[] }>()

  for (const item of interactions) {
    const drug = item.perpetrator_drug?.trim()
    if (!drug || !(item.perpetrator_alternatives || []).length) continue
    const key = drug.toLowerCase()
    const current = byPerpetrator.get(key) ?? { drug, alternatives: [] }
    const merged = new Set([...current.alternatives, ...item.perpetrator_alternatives])
    byPerpetrator.set(key, { drug, alternatives: [...merged] })
  }

  return [...byPerpetrator.values()]
}

export function RiskReport({ pipeline, insurance }: Props) {
  const sorted = sortInteractions(pipeline.interactions || [])
  const replacementOptions = globalReplacementOptions(sorted)
  const hasCostData =
    insurance != null &&
    insurance.totalEstimatedMonthlyCost != null &&
    insurance.alternativeSavings.some((s) => s.monthlySavings != null)

  if (sorted.length === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8">
        <div className="rounded-xl border border-[var(--gray-200)] bg-white p-12 text-center shadow-[var(--card-shadow)]">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[var(--safe-green)]" />
          <p className="text-[20px] font-bold text-[var(--safe-green)]">No Interactions Detected</p>
          <p className="mt-2 text-[var(--gray-500)]">
            All medications are compatible with this patient&apos;s pharmacogenomic profile.
          </p>
        </div>
      </div>
    )
  }

  const profilesMissing = pipeline.meta?.side_effect_profiles_loaded === false

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8">
      <h1 className="mb-8 text-[24px] font-bold text-[var(--navy)]">Integrated Risk Report</h1>
      {profilesMissing && (
        <div
          className="mb-6 rounded-xl border border-[var(--high-amber)] bg-[var(--boxed-warning-amber-bg)] px-4 py-3 text-sm text-[var(--gray-800)]"
          role="status"
        >
          <p className="font-semibold text-[var(--boxed-warning-amber)]">Side effect data not loaded</p>
          <p className="mt-1 text-[var(--gray-600)]">
            The server could not read{' '}
            <code className="rounded bg-white/80 px-1 text-xs">drug_side_effect_profiles.json</code> at{' '}
            <code className="break-all text-xs">{pipeline.meta?.side_effect_profiles_path ?? '—'}</code>.
            Run the API from the PhenoRx repo root so <code className="text-xs">data/</code> is on disk.
          </p>
        </div>
      )}
      {replacementOptions.length > 0 && (
        <section className="mb-6 rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-5 shadow-[var(--card-shadow)]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--gray-500)]">
            Global Medication Optimization
          </p>
          <div className="mt-3 space-y-3">
            {replacementOptions.map((entry) => (
              <div key={entry.drug} className="rounded-lg bg-white p-4">
                <p className="text-sm font-semibold text-[var(--gray-800)]">
                  {entry.drug} is driving multiple interactions in this regimen.
                </p>
                <p className="mt-1 text-sm text-[var(--gray-500)]">
                  Consider alternatives: {entry.alternatives.join(', ')}.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-5">
        {sorted.map((item) => (
          <InteractionCard
            key={`${item.drug_name}-${item.enzyme_name}`}
            interaction={item}
            affordability={pipeline.affordability}
            insurance={insurance}
            clinicalSapVerdictThreshold={pipeline.meta?.sap_verdict_threshold}
          />
        ))}
      </div>
      {hasCostData && insurance && <CostSummaryBanner insurance={insurance} />}
    </div>
  )
}

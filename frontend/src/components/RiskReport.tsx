import { CheckCircle2 } from 'lucide-react'
import { RISK_ORDER } from '../lib/constants'
import type {
  DrugProfile,
  InsuranceScreeningResult,
  InteractionResult,
  MedicationInput,
  PipelineResult,
} from '../types'
import { CostSummaryBanner } from './CostSummaryBanner'
import { InteractionCard } from './InteractionCard'
import { SafeDrugCard } from './SafeDrugCard'
import { ViewHero } from './ViewHero'

type Props = {
  pipeline: PipelineResult
  insurance: InsuranceScreeningResult | null
  drugProfiles: DrugProfile[]
  medications: MedicationInput[]
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

export function RiskReport({ pipeline, insurance, drugProfiles, medications }: Props) {
  const sorted = sortInteractions(pipeline.interactions || [])
  const replacementOptions = globalReplacementOptions(sorted)
  const namedMedCount = medications.filter((m) => m.drug_name.trim()).length

  const hasCostData =
    insurance != null &&
    insurance.totalEstimatedMonthlyCost != null &&
    insurance.alternativeSavings.some((s) => s.monthlySavings != null)

  const profilesMissing = pipeline.meta?.side_effect_profiles_loaded === false

  if (namedMedCount === 0) {
    return (
      <div className="animate-fade-up">
        <ViewHero title="Risk Report" subtitle="Interaction analysis across discharge medications" />
        <div
          className="rounded-[14px] border p-12 text-center"
          style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
        >
          <p className="text-[16px] font-semibold text-[var(--px-text)]">
            No medications to analyze. Add medications in the Patient Input view.
          </p>
        </div>
      </div>
    )
  }

  const showFlaggedHeader = sorted.length > 0
  const showSafeSection = drugProfiles.length > 0

  if (!showFlaggedHeader && !showSafeSection) {
    return (
      <div className="animate-fade-up">
        <ViewHero title="Risk Report" subtitle="Interaction analysis across discharge medications" />
        <div
          className="rounded-[14px] border p-12 text-center"
          style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
        >
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16" color="var(--px-accent)" />
          <p className="text-[20px] font-bold text-[var(--px-accent)]">No Interactions Detected</p>
          <p className="mt-2 text-[var(--px-text-secondary)]">
            All medications are compatible with this patient&apos;s pharmacogenomic profile.
          </p>
        </div>
      </div>
    )
  }

  const ixCount = sorted.length

  return (
    <div className="animate-fade-up">
      <ViewHero
        title="Risk Report"
        subtitle={`${ixCount} interaction${ixCount !== 1 ? 's' : ''} flagged across discharge medications`}
      />

      {profilesMissing && (
        <div
          className="mb-6 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--px-high)',
            background: 'var(--px-high-dim)',
            color: 'var(--px-text)',
          }}
          role="status"
        >
          <p className="font-semibold text-[var(--px-high)]">Side effect data not loaded</p>
          <p className="mt-1 text-[var(--px-text-secondary)]">
            The server could not read{' '}
            <code className="rounded bg-black/20 px-1 text-xs">drug_side_effect_profiles.json</code> at{' '}
            <code className="break-all text-xs">{pipeline.meta?.side_effect_profiles_path ?? '—'}</code>.
            Run the API from the CYPher repo root so <code className="text-xs">data/</code> is on disk.
          </p>
        </div>
      )}

      {replacementOptions.length > 0 && (
        <section
          className="mb-6 rounded-xl border p-5"
          style={{ background: 'var(--px-bg-elevated)', borderColor: 'var(--px-border)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
            Global Medication Optimization
          </p>
          <div className="mt-3 space-y-3">
            {replacementOptions.map((entry) => (
              <div
                key={entry.drug}
                className="rounded-lg border px-4 py-3"
                style={{
                  background: 'var(--px-bg-card)',
                  borderColor: 'var(--px-border)',
                }}
              >
                <p className="text-sm font-semibold text-[var(--px-text)]">
                  {entry.drug} is driving multiple interactions in this regimen.
                </p>
                <p className="mt-1 text-sm text-[var(--px-text-secondary)]">
                  Consider alternatives: {entry.alternatives.join(', ')}.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showFlaggedHeader && (
        <>
          <h2 className="mb-4 font-display text-[20px] font-medium text-[var(--px-text)]">
            Flagged Interactions
          </h2>
          <div className="flex flex-col gap-4">
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
        </>
      )}

      {hasCostData && insurance && <CostSummaryBanner insurance={insurance} />}

      {showSafeSection && (
        <>
          {showFlaggedHeader && (
            <hr className="my-8 border-[var(--px-border)]" />
          )}
          <h2 className="font-display text-[20px] font-medium text-[var(--px-text)]">
            Medication Profiles
          </h2>
          <p className="mt-1 text-[14px] text-[var(--px-text-secondary)]">
            Side effect and coverage information for medications with no detected interactions
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {drugProfiles.map((p) => (
              <SafeDrugCard key={p.drug_name} profile={p} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

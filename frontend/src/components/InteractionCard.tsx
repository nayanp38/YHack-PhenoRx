import { AlertTriangle } from 'lucide-react'
import type {
  AffordabilityResult,
  AlternativeComparison,
  InsuranceScreeningResult,
  InteractionResult,
} from '../types'
import { DrugChip } from './DrugChip'
import { SeverityBadge } from './SeverityBadge'

function riskStyles(level: string) {
  const l = level.toLowerCase()
  if (l === 'critical')
    return {
      bg: 'var(--critical-red)',
      text: 'white',
      border: 'var(--critical-red)',
      pulse: true,
    }
  if (l === 'high')
    return { bg: 'var(--high-amber)', text: 'white', border: 'var(--high-amber)', pulse: false }
  if (l === 'moderate')
    return {
      bg: 'var(--moderate-yellow)',
      text: 'var(--gray-800)',
      border: 'var(--moderate-yellow)',
      pulse: false,
    }
  if (l === 'low')
    return { bg: 'var(--low-gray)', text: 'white', border: 'var(--low-gray)', pulse: false }
  return { bg: 'var(--gray-500)', text: 'white', border: 'var(--gray-500)', pulse: false }
}

function affordabilityFor(
  drug: string,
  aff: AffordabilityResult[] | undefined
): AffordabilityResult | undefined {
  if (!aff) return undefined
  const d = drug.toLowerCase()
  return aff.find((x) => x.interaction_drug.toLowerCase() === d)
}

function coverageForDrug(insurance: InsuranceScreeningResult | null | undefined, drugName: string) {
  if (!insurance) return undefined
  const d = drugName.toLowerCase()
  return insurance.drugCoverages.find((c) => c.drugName.toLowerCase() === d)
}

type Props = {
  interaction: InteractionResult
  affordability: AffordabilityResult[] | undefined
  insurance?: InsuranceScreeningResult | null
}

export function InteractionCard({ interaction, affordability, insurance }: Props) {
  const rs = riskStyles(interaction.risk_level)
  const affRow = affordabilityFor(interaction.drug_name, affordability)
  const rankedAlternatives = affRow?.ranked_alternatives ?? []
  const altRows =
    rankedAlternatives.length > 0
      ? rankedAlternatives
      : (interaction.alternative_drugs || []).map((drug_name, index) => ({
          drug_name,
          affordability_rank: index + 1,
          covered: false,
          tier: null,
          tier_label: null,
          prior_auth_required: false,
        }))

  const perp = interaction.perpetrator_drug
  const strength = interaction.perpetrator_strength || ''
  const sideEffects = interaction.side_effect_comparison

  const verdictMap: Record<string, AlternativeComparison> = {}
  if (sideEffects) {
    for (const comp of sideEffects.alternative_comparisons) {
      verdictMap[comp.alternative_drug.toLowerCase()] = comp
    }
  }

  const cov = coverageForDrug(insurance ?? null, interaction.drug_name)

  return (
    <article
      className={`mb-4 rounded-xl border-l-4 bg-white p-6 shadow-[var(--card-shadow)] ${rs.pulse ? 'animate-pulse-border border-l-[var(--critical-red)]' : ''}`}
      style={
        rs.pulse
          ? undefined
          : {
              borderLeftColor: rs.border,
            }
      }
    >
      {/* Section A: Clinical Finding */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span
            className="rounded-md px-3 py-1 text-[12px] font-bold"
            style={{ background: rs.bg, color: rs.text }}
          >
            {interaction.risk_level.toUpperCase()}
          </span>
          <span className="text-[16px] font-bold text-[var(--gray-800)]">
            {interaction.drug_name}
          </span>
          <span className="text-[var(--gray-200)]">|</span>
          <span className="text-[var(--gray-500)]">{interaction.enzyme_name}</span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-[var(--safe-green-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--safe-green)]">
            {interaction.baseline_phenotype}
          </span>
          <span className="text-[var(--gray-500)]">→</span>
          <span className="rounded bg-[var(--critical-red-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--critical-red)]">
            {interaction.effective_phenotype}
          </span>
          <span className="font-mono text-[13px] text-[var(--gray-800)]">
            {(interaction.baseline_activity_score ?? '—').toString()} →{' '}
            {(interaction.effective_activity_score ?? '—').toString()}
          </span>
        </div>

        <p className="mb-3 text-sm italic text-[var(--gray-500)]">
          {perp ? (
            <>
              Caused by: {perp}
              {strength
                ? ` (${strength} ${interaction.enzyme_name} inhibitor)`
                : ` (${interaction.enzyme_name})`}
            </>
          ) : (
            'Genotypic risk (no drug interaction required)'
          )}
        </p>

        <p className="text-[14px] leading-relaxed text-[var(--gray-800)]">
          {interaction.clinical_consequence}
        </p>
      </section>

      {/* Section B: Recommendations */}
      <section className="mt-4 rounded-lg bg-[var(--gray-50)] p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold text-[var(--gray-800)]">
              Alternative Medications
            </h3>
            <div className="flex flex-wrap gap-2">
              {altRows.map((alt) => {
                const parts: string[] = []
                if (alt.covered) {
                  parts.push(alt.tier != null ? `Tier ${alt.tier}` : 'Covered')
                } else {
                  parts.push('Not covered')
                }
                if (alt.prior_auth_required) parts.push('PA')
                const comp = verdictMap[alt.drug_name.toLowerCase()]
                return (
                  <DrugChip
                    key={alt.drug_name}
                    drugName={alt.drug_name}
                    sub={parts.join(' · ')}
                    severityVerdict={comp?.severity_verdict}
                    sideEffectData={comp}
                    flaggedDrugName={interaction.drug_name}
                    flaggedDrugWsi={sideEffects?.flagged_drug_wsi}
                    flaggedTop3={sideEffects?.flagged_drug_top_3}
                  />
                )
              })}
            </div>
          </div>
          {(interaction.perpetrator_alternatives || []).length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold text-[var(--gray-800)]">
                Consider Replacing {interaction.perpetrator_drug || 'perpetrator'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {interaction.perpetrator_alternatives.map((d) => (
                  <DrugChip key={d} label={d} accent="perp" />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section C: Insurance Cost Context */}
      {insurance && (
        <section className="mt-4 rounded-lg bg-[var(--gray-50)] p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--gray-500)]">
            Insurance Cost Context
          </h3>
          <p className="text-xs text-[var(--gray-600)]">
            Plan: {insurance.plan.planName || '—'} ({insurance.plan.contractId}-{insurance.plan.planId})
          </p>
          {cov && (
            <p className="mt-1 text-xs text-[var(--gray-800)]">
              <span className="font-semibold">{interaction.drug_name}</span>:{' '}
              {cov.covered ? 'Covered' : 'Not covered'}
              {cov.tierLevel != null ? ` · Tier ${cov.tierLevel}` : ''}
              {cov.tierName ? ` · ${cov.tierName}` : ''}
              {cov.estimatedMonthlyCost != null
                ? ` · ~$${cov.estimatedMonthlyCost}/mo`
                : ''}
            </p>
          )}
        </section>
      )}

      {/* Section D: Side Effect Profile */}
      {sideEffects && (
        <div
          style={{
            borderTop: '1px solid var(--gray-200)',
            padding: '16px 0',
            display: 'flex',
            gap: '24px',
          }}
        >
          <div style={{ flex: '0 0 40%' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--gray-500)',
                marginBottom: '8px',
              }}
            >
              Side Effect Profile
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{interaction.drug_name}</span>
              <span
                className="font-mono text-[13px] text-[var(--gray-500)]"
              >
                WSI: {sideEffects.flagged_drug_wsi.toFixed(2)}
              </span>
            </div>
            {sideEffects.flagged_drug_top_3.map((ae) => (
              <div
                key={ae.meddra_pt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  marginBottom: '2px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      ae.ctcae_typical_grade >= 4
                        ? 'var(--critical-red)'
                        : ae.ctcae_typical_grade >= 3
                          ? 'var(--high-amber)'
                          : 'var(--low-gray)',
                  }}
                />
                <span>{ae.meddra_pt.replace(/_/g, ' ')}</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--gray-500)',
                    fontSize: '11px',
                  }}
                >
                  G{ae.ctcae_typical_grade}
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--gray-500)',
                    fontSize: '11px',
                  }}
                >
                  {ae.event_score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignContent: 'flex-start',
            }}
          >
            {sideEffects.alternative_comparisons.map((comp) => (
              <div
                key={comp.alternative_drug}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 500 }}>{comp.alternative_drug}</span>
                <SeverityBadge verdict={comp.severity_verdict} size="sm" />
                {comp.severity_verdict === 'WORSE' && comp.unique_severe_events.length > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--high-amber)' }}>
                    +{comp.unique_severe_events.length} new G3+ risk
                    {comp.unique_severe_events.length > 1 ? 's' : ''}
                  </span>
                )}
                {comp.alternative_boxed_warning && !sideEffects.flagged_drug_boxed_warning && (
                  <AlertTriangle
                    size={12}
                    strokeWidth={2}
                    color="var(--boxed-warning-amber)"
                    aria-label="Alternative has boxed warning; flagged drug does not"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence sources */}
      {(interaction.evidence_sources?.length ?? 0) > 0 && (
        <footer className="mt-4 border-t border-[var(--gray-200)] pt-3">
          <p className="text-[11px] text-[var(--gray-500)]">
            Sources: {interaction.evidence_sources.join(', ')}
          </p>
        </footer>
      )}
    </article>
  )
}

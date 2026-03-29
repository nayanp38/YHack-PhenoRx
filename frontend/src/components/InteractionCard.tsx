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
  /** From pipeline meta: SAP Δ band for BETTER/WORSE (v3 default 0.5). */
  clinicalSapVerdictThreshold?: number
}

export function InteractionCard({
  interaction,
  affordability,
  insurance,
  clinicalSapVerdictThreshold,
}: Props) {
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
                    flaggedDrugSap={sideEffects?.flagged_drug_sap}
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

      {/* Section D: Side Effect Profile — SAP v3 (severity-adjusted probability) */}
      {sideEffects && (
        <div
          className="mt-4 flex flex-col gap-4 border-t border-[var(--gray-200)] pt-4 md:flex-row md:gap-6"
          data-testid="side-effect-profile"
        >
          <div className="min-w-0 md:w-[40%] md:flex-shrink-0 md:flex-grow-0">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--gray-500)]">
              Side Effect Profile (SAP v3)
            </div>
            {clinicalSapVerdictThreshold != null && (
              <p className="mb-2 text-[10px] leading-snug text-[var(--gray-500)]">
                BETTER/WORSE when SAP |Δ| exceeds {clinicalSapVerdictThreshold.toFixed(2)}. Actionable
                warnings (NEW / higher frequency) follow §2.5 of the module spec.
              </p>
            )}
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="text-[14px] font-semibold text-[var(--gray-800)]">{interaction.drug_name}</span>
              <span className="font-mono text-[13px] text-[var(--gray-500)]">
                SAP: {sideEffects.flagged_drug_sap.toFixed(3)}
              </span>
              {sideEffects.flagged_drug_boxed_warning && (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--boxed-warning-amber)]"
                  style={{ background: 'var(--boxed-warning-amber-bg)' }}
                >
                  Boxed warning (+1.0 SAP)
                </span>
              )}
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
                  {ae.sap_score != null ? ae.sap_score.toFixed(3) : ae.event_score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--gray-500)]">
              Alternatives (SAP · Δ vs flagged)
            </p>
            <div className="flex flex-wrap content-start gap-x-3 gap-y-2">
              {sideEffects.alternative_comparisons.map((comp) => (
                <div
                  key={comp.alternative_drug}
                  className="flex max-w-full flex-wrap items-center gap-1.5 border-b border-[var(--gray-100)] pb-2 text-[12px] last:border-b-0 md:border-b-0 md:pb-0"
                >
                  <span className="font-medium text-[var(--gray-800)]">{comp.alternative_drug}</span>
                  {comp.severity_verdict !== 'DATA_UNAVAILABLE' && (
                    <span className="font-mono text-[11px] text-[var(--gray-500)]">
                      SAP {comp.alternative_sap.toFixed(3)} · Δ{' '}
                      {comp.severity_delta >= 0 ? '+' : ''}
                      {comp.severity_delta.toFixed(3)}
                    </span>
                  )}
                  <SeverityBadge verdict={comp.severity_verdict} size="md" />
                  {(comp.actionable_warnings ?? []).length > 0 && (
                    <span className="w-full text-[10px] leading-snug text-[var(--gray-600)] md:max-w-[360px]">
                      Actionable: {(comp.actionable_warnings ?? []).map((w) => w.display).join(' · ')}
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

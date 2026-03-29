import { AlertTriangle, ArrowRight } from 'lucide-react'
import type {
  AffordabilityResult,
  AlternativeComparison,
  InsuranceScreeningResult,
  InteractionResult,
} from '../types'
import { DrugChip } from './DrugChip'
import { SeverityBadge } from './SeverityBadge'
import { TierBadge } from './TierBadge'

function riskStyles(level: string) {
  const l = level.toLowerCase()
  if (l === 'critical')
    return {
      bg: 'var(--px-critical)',
      text: '#0a0a0b',
      border: 'var(--px-critical)',
      pulse: true,
    }
  if (l === 'high')
    return { bg: 'var(--px-high)', text: '#0a0a0b', border: 'var(--px-high)', pulse: false }
  if (l === 'moderate')
    return {
      bg: '#fbbf24',
      text: '#0a0a0b',
      border: '#fbbf24',
      pulse: false,
    }
  if (l === 'low')
    return {
      bg: 'rgba(255,255,255,0.08)',
      text: 'var(--px-text-secondary)',
      border: 'var(--px-border)',
      pulse: false,
    }
  return {
    bg: 'rgba(255,255,255,0.12)',
    text: 'var(--px-text)',
    border: 'var(--px-border)',
    pulse: false,
  }
}

function phenotypeAbbr(p: string): string {
  const u = p.toUpperCase()
  if (u.includes('POOR')) return 'PM'
  if (u.includes('INTERMEDIATE')) return 'IM'
  if (u.includes('NORMAL')) return 'NM'
  return p.slice(0, 3)
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
  const isCritical = interaction.risk_level.toLowerCase() === 'critical'
  const aucr = interaction.predicted_aucr

  return (
    <article
      className={`overflow-visible rounded-[14px] border border-[var(--px-border)] ${rs.pulse ? 'animate-pulse-border' : ''}`}
      style={{
        background: 'var(--px-bg-card)',
        borderLeftWidth: 3,
        borderLeftColor: rs.border,
        boxShadow: isCritical ? '0 0 40px var(--px-critical-glow)' : undefined,
      }}
    >
      <div
        className="flex flex-wrap items-center gap-3 border-b px-6 py-4"
        style={{
          borderColor: 'var(--px-border)',
          background: isCritical ? 'var(--px-critical-glow)' : 'transparent',
        }}
      >
        <span
          className="inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-[10px] font-bold tracking-[0.08em]"
          style={{ background: rs.bg, color: rs.text }}
        >
          {isCritical && <AlertTriangle size={11} />}
          {interaction.risk_level.toUpperCase()}
        </span>
        <span className="font-display text-[20px] font-medium text-[var(--px-text)]">
          {interaction.drug_name}
        </span>
        <span className="text-[var(--px-text-tertiary)]">·</span>
        <span className="text-[13px] text-[var(--px-text-secondary)]">{interaction.enzyme_name}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--px-accent)]">
            {phenotypeAbbr(interaction.baseline_phenotype)}
          </span>
          <ArrowRight size={12} className="text-[var(--px-text-tertiary)]" />
          <span className="text-[12px] font-semibold text-[var(--px-critical)]">
            {phenotypeAbbr(interaction.effective_phenotype)}
          </span>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
              Clinical consequence
            </div>
            <p className="text-[14px] leading-relaxed text-[var(--px-text)]">
              {interaction.clinical_consequence}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
                Perpetrator
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--px-text)]">
                  {perp ?? '—'}
                </span>
                {strength && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: strength.toLowerCase() === 'strong' ? 'var(--px-critical)' : 'var(--px-high)',
                      background:
                        strength.toLowerCase() === 'strong'
                          ? 'var(--px-critical-dim)'
                          : 'var(--px-high-dim)',
                    }}
                  >
                    {strength}
                  </span>
                )}
              </div>
              {!perp && (
                <p className="mt-1 text-[12px] italic text-[var(--px-text-secondary)]">
                  Genotypic risk (no drug interaction required)
                </p>
              )}
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
                Exposure change
              </div>
              <span
                className="text-[13px] font-medium"
                style={{ color: isCritical ? 'var(--px-critical)' : 'var(--px-high)' }}
              >
                {interaction.exposure_classification}
                {aucr > 0 ? ` (${aucr.toFixed(1)}× AUC)` : ''}
              </span>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
                Phenotype / activity
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--px-text-secondary)]">
                <span className="rounded bg-[var(--px-accent-dim)] px-2 py-0.5 font-semibold text-[var(--px-accent)]">
                  {interaction.baseline_phenotype}
                </span>
                <span>→</span>
                <span className="rounded bg-[var(--px-critical-dim)] px-2 py-0.5 font-semibold text-[var(--px-critical)]">
                  {interaction.effective_phenotype}
                </span>
                {(interaction.baseline_activity_score != null ||
                  interaction.effective_activity_score != null) && (
                  <span className="font-mono text-[12px]">
                    {(interaction.baseline_activity_score ?? '—').toString()} →{' '}
                    {(interaction.effective_activity_score ?? '—').toString()}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
                Safer alternatives
              </div>
              <div className="flex flex-wrap gap-1.5">
                {altRows.map((alt) => {
                  const parts: string[] = []
                  if (alt.covered) {
                    if (alt.tier == null) {
                      parts.push('Covered')
                    }
                  } else {
                    parts.push('Not covered')
                  }
                  if (alt.prior_auth_required) parts.push('PA')
                  const comp = verdictMap[alt.drug_name.toLowerCase()]
                  return (
                    <DrugChip
                      key={alt.drug_name}
                      drugName={alt.drug_name}
                      formularyTier={alt.covered ? alt.tier : null}
                      sub={parts.length ? parts.join(' · ') : undefined}
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
          </div>
        </div>

        {(interaction.perpetrator_alternatives || []).length > 0 && (
          <section
            className="mt-5 rounded-lg border p-4"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--px-border)' }}
          >
            <h3 className="mb-2 text-xs font-bold text-[var(--px-text)]">
              Consider replacing {interaction.perpetrator_drug || 'perpetrator'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {interaction.perpetrator_alternatives.map((d) => (
                <DrugChip key={d} label={d} accent="perp" />
              ))}
            </div>
          </section>
        )}

        {insurance && (
          <section
            className="mt-4 rounded-lg border p-4"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--px-border)' }}
          >
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
              Insurance cost context
            </h3>
            <p className="text-xs text-[var(--px-text-secondary)]">
              Plan: {insurance.plan.planName || '—'} ({insurance.plan.contractId}-{insurance.plan.planId})
            </p>
            {cov && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--px-text)]">
                <span className="font-semibold">{interaction.drug_name}</span>
                <span>:</span>
                {cov.covered ? 'Covered' : 'Not covered'}
                <TierBadge tier={cov.tierLevel} size="md" />
                {cov.tierName ? (
                  <span className="text-[var(--px-text-secondary)]">({cov.tierName})</span>
                ) : null}
                {cov.estimatedMonthlyCost != null ? (
                  <span className="text-[var(--px-text-secondary)]">
                    ~${cov.estimatedMonthlyCost}/mo
                  </span>
                ) : null}
              </p>
            )}
          </section>
        )}

        {sideEffects && (
          <div
            className="mt-4 flex flex-col gap-4 border-t border-[var(--px-border)] pt-4 md:flex-row md:gap-6"
            data-testid="side-effect-profile"
          >
            <div className="min-w-0 md:w-[40%] md:flex-shrink-0 md:flex-grow-0">
              <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--px-text-tertiary)]">
                Side Effect Profile (SAP v3)
              </div>
              {clinicalSapVerdictThreshold != null && (
                <p className="mb-2 text-[10px] leading-snug text-[var(--px-text-tertiary)]">
                  BETTER/WORSE when SAP |Δ| exceeds {clinicalSapVerdictThreshold.toFixed(2)}. Actionable
                  warnings (NEW / higher frequency) follow §2.5 of the module spec.
                </p>
              )}
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="text-[14px] font-semibold text-[var(--px-text)]">{interaction.drug_name}</span>
                <span className="font-mono text-[13px] text-[var(--px-text-secondary)]">
                  SAP: {sideEffects.flagged_drug_sap.toFixed(3)}
                </span>
                {sideEffects.flagged_drug_boxed_warning && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--boxed-warning-amber)]"
                    style={{ background: 'rgba(245, 158, 11, 0.15)' }}
                  >
                    Boxed warning (+1.0 SAP)
                  </span>
                )}
              </div>
              {sideEffects.flagged_drug_top_3.map((ae) => (
                <div
                  key={ae.meddra_pt}
                  className="mb-0.5 flex items-center gap-1.5 text-[12px] text-[var(--px-text)]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        ae.ctcae_typical_grade >= 4
                          ? 'var(--px-critical)'
                          : ae.ctcae_typical_grade >= 3
                            ? 'var(--px-high)'
                            : 'var(--px-text-tertiary)',
                    }}
                  />
                  <span>{ae.meddra_pt.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-[11px] text-[var(--px-text-secondary)]">
                    G{ae.ctcae_typical_grade}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--px-text-secondary)]">
                    {ae.sap_score != null ? ae.sap_score.toFixed(3) : ae.event_score.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--px-text-tertiary)]">
                Alternatives (SAP · Δ vs flagged)
              </p>
              <div className="flex flex-wrap content-start gap-x-3 gap-y-2">
                {sideEffects.alternative_comparisons.map((comp) => (
                  <div
                    key={comp.alternative_drug}
                    className="flex max-w-full flex-wrap items-center gap-1.5 border-b border-[var(--px-border)] pb-2 text-[12px] last:border-b-0 md:border-b-0 md:pb-0"
                  >
                    <span className="font-medium text-[var(--px-text)]">{comp.alternative_drug}</span>
                    {comp.severity_verdict !== 'DATA_UNAVAILABLE' && (
                      <span className="font-mono text-[11px] text-[var(--px-text-secondary)]">
                        SAP {comp.alternative_sap.toFixed(3)} · Δ{' '}
                        {comp.severity_delta >= 0 ? '+' : ''}
                        {comp.severity_delta.toFixed(3)}
                      </span>
                    )}
                    <SeverityBadge verdict={comp.severity_verdict} size="md" />
                    {(comp.actionable_warnings ?? []).length > 0 && (
                      <span className="w-full text-[10px] leading-snug text-[var(--px-text-secondary)] md:max-w-[360px]">
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

        {(interaction.evidence_sources?.length ?? 0) > 0 && (
          <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--px-border)] pt-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--px-text-tertiary)]">
              Sources
            </span>
            {interaction.evidence_sources!.map((s) => (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--px-text-secondary)]"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {s}
              </span>
            ))}
          </footer>
        )}
      </div>
    </article>
  )
}

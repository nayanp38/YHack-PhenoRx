import type { DrugCoverage, DrugProfile } from '../types'
import { SeverityBar } from './SeverityBar'

function formatPt(s: string): string {
  return s.replace(/_/g, ' ')
}

type Props = {
  profile: DrugProfile
}

function InsuranceBlock({ cov }: { cov: DrugCoverage }) {
  if (!cov.covered) {
    return (
      <div
        className="mt-3 rounded-lg border px-3 py-2"
        style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.02)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--px-text-tertiary)]">
          Insurance
        </p>
        <span className="mt-1 inline-block rounded-md bg-[var(--px-critical-dim)] px-2 py-0.5 text-xs font-bold text-[var(--px-critical)]">
          Not Covered
        </span>
      </div>
    )
  }

  return (
    <div
      className="mt-3 rounded-lg border px-3 py-2"
      style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.02)' }}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--px-text-tertiary)]">Insurance</p>
      <p className="mt-1 text-sm text-[var(--px-text)]">
        Tier {cov.tierLevel ?? '—'}
        {cov.tierName ? ` · ${cov.tierName}` : ''}
        {cov.estimatedMonthlyCost != null ? ` · ~$${cov.estimatedMonthlyCost}/mo` : ''}
      </p>
    </div>
  )
}

export function SafeDrugCard({ profile }: Props) {
  const sep = profile.side_effect_profile
  const hasSepData =
    sep.weighted_severity_index != null ||
    (sep.top_3_severe_events && sep.top_3_severe_events.length > 0) ||
    (sep.common_side_effects && sep.common_side_effects.length > 0)

  return (
    <article
      className="flex flex-col rounded-xl border p-4"
      style={{
        borderColor: 'var(--px-border)',
        background: 'var(--px-bg-card)',
        borderLeftWidth: 4,
        borderLeftColor: 'var(--px-accent)',
      }}
    >
      <h3 className="text-[16px] font-bold capitalize text-[var(--px-text)]">{profile.drug_name}</h3>
      <p className="mt-1 text-xs text-[var(--px-text-secondary)]">
        No phenoconversion interaction flagged
      </p>

      <div
        className="mt-3 rounded-lg px-3 py-3"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--px-text-tertiary)]">
          Side effects
        </p>
        {!hasSepData ? (
          <p className="mt-2 text-sm italic text-[var(--px-text-secondary)]">
            Side effect data not available for this medication
          </p>
        ) : (
          <>
            <div className="mt-2">
              <SeverityBar value={sep.weighted_severity_index} />
            </div>
            {sep.top_3_severe_events && sep.top_3_severe_events.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-sm text-[var(--px-text)]">
                {sep.top_3_severe_events.slice(0, 3).map((e) => (
                  <li key={e.meddra_pt}>
                    {formatPt(e.meddra_pt)}
                    {e.ctcae_typical_grade ? ` (grade ${e.ctcae_typical_grade})` : ''}
                  </li>
                ))}
              </ul>
            )}
            {sep.common_side_effects && sep.common_side_effects.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--px-text-secondary)]">Common / frequent</p>
                <ul className="mt-1 list-inside list-disc text-sm text-[var(--px-text)]">
                  {sep.common_side_effects.map((e) => (
                    <li key={e.meddra_pt}>
                      {formatPt(e.meddra_pt)}
                      {e.frequency_pct != null ? ` (~${e.frequency_pct}%)` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sep.data_source && (
              <p className="mt-2 text-[11px] text-[var(--px-text-tertiary)]">Source: {sep.data_source}</p>
            )}
          </>
        )}
      </div>

      {profile.insurance_coverage && <InsuranceBlock cov={profile.insurance_coverage} />}
    </article>
  )
}

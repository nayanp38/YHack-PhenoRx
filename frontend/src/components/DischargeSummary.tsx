import { useState } from 'react'
import { FileText, Loader2, Sparkles } from 'lucide-react'
import type { ClinicianSummary, InsuranceScreeningResult, PipelineResult } from '../types'
import { CostFooter } from './CostFooter'
import { InsuranceSection } from './InsuranceSection'
import { PhenoconversionSection } from './PhenoconversionSection'
import { SideEffectSection } from './SideEffectSection'
import { ViewHero } from './ViewHero'

function renderSummaryMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const bold = /^\*\*(.+)\*\*$/.exec(line.trim())
    if (bold) {
      return (
        <h3 key={i} className="mb-2 mt-6 font-display text-[18px] font-medium text-[var(--px-text)] first:mt-0">
          {bold[1]}
        </h3>
      )
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    return (
      <p key={i} className="mb-2 text-[15px] leading-[1.75] text-[var(--px-text)]">
        {line}
      </p>
    )
  })
}

type Props = {
  patientId: string
  clinicianSummary: ClinicianSummary | null
  insurance: InsuranceScreeningResult | null
  pipeline?: PipelineResult | null
  onRequestPatientHandout: () => void
  patientHandoutText: string | null
  patientHandoutLoading: boolean
}

export function DischargeSummary({
  patientId,
  clinicianSummary,
  insurance,
  pipeline,
  onRequestPatientHandout,
  patientHandoutText,
  patientHandoutLoading,
}: Props) {
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const hasCostData =
    insurance != null &&
    insurance.totalEstimatedMonthlyCost != null &&
    insurance.alternativeSavings.some((s) => s.monthlySavings != null)

  const [showHandout, setShowHandout] = useState(false)

  const cs: ClinicianSummary | null = clinicianSummary
  const showValidationBanner =
    cs?.validation_ok === false && (cs?.validation_warnings?.length ?? 0) > 0

  return (
    <div className="animate-fade-up">
      <ViewHero
        title="Discharge Summary"
        subtitle="Clinical review and plain-language patient handout"
      />

      <div
        className="mx-auto max-w-[720px] overflow-hidden rounded-[14px] border"
        style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
      >
        <div
          className="flex items-center justify-between border-b px-8 py-5"
          style={{
            borderColor: 'var(--px-border)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <FileText size={16} color="var(--px-accent)" aria-hidden />
            <span className="font-display text-[16px] text-[var(--px-text)]">Clinical Discharge Review</span>
          </div>
          <button
            type="button"
            onClick={() => {
              void onRequestPatientHandout()
              setShowHandout(true)
            }}
            disabled={patientHandoutLoading}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.04] disabled:opacity-50"
            style={{ borderColor: 'var(--px-border)', color: 'var(--px-accent)' }}
          >
            {patientHandoutLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </span>
            ) : (
              <>
                <Sparkles size={14} />
                Generate Patient Handout
              </>
            )}
          </button>
        </div>

        <div
          className="flex flex-wrap gap-4 border-b px-8 py-3 text-[12px] text-[var(--px-text-secondary)]"
          style={{ borderColor: 'var(--px-border)' }}
        >
          <span>
            Prepared for: Attending Physician · <span className="text-[var(--px-text)]">{date}</span>
          </span>
          <span>
            Patient:{' '}
            <span className="font-mono text-[11px] text-[var(--px-text)]">{patientId}</span>
          </span>
        </div>

        <div className="px-8 py-7">
          {showValidationBanner && (
            <div
              className="mb-6 rounded-lg border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--px-high)',
                background: 'var(--px-high-dim)',
                color: 'var(--px-text)',
              }}
              role="status"
            >
              Some sections could not be generated. Review the Risk Report for complete details.
            </div>
          )}

          {cs && (
            <div className="max-w-none">
              <PhenoconversionSection alerts={cs.phenoconversion_alerts} />
              <SideEffectSection flags={cs.side_effect_flags} />
              <InsuranceSection statement={cs.insurance_statement} />
              {!cs.phenoconversion_alerts?.length &&
                !cs.side_effect_flags?.length &&
                !cs.insurance_statement && (
                  <p className="text-[var(--px-text-secondary)]">
                    No structured summary items were returned for this run.
                  </p>
                )}
            </div>
          )}

          {!cs && (
            <p className="text-[var(--px-text-secondary)]">Run analysis to generate the clinical summary.</p>
          )}

          {showHandout && (patientHandoutLoading || patientHandoutText) && (
            <div className="mt-8 border-t border-[var(--px-border)] pt-8">
              <h3 className="mb-3 flex items-center gap-2 font-display text-[16px] font-medium text-[var(--px-text)]">
                <Sparkles size={14} className="text-[var(--px-accent)]" />
                Patient handout (plain language)
              </h3>
              {patientHandoutLoading ? (
                <div className="flex items-center gap-2 text-[var(--px-text-secondary)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating handout…
                </div>
              ) : (
                patientHandoutText && (
                  <div className="prose max-w-none">{renderSummaryMarkdown(patientHandoutText)}</div>
                )
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t px-8 py-4 text-[11px] text-[var(--px-text-tertiary)]"
          style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'var(--px-border)' }}
        >
          <span>Generated for clinical review · CPIC + FDA sourced</span>
          <span className="font-mono text-[10px]">PhenoRx</span>
        </div>
      </div>

      {hasCostData && insurance && (
        <div className="mt-6">
          <CostFooter insurance={insurance} pipeline={pipeline} />
        </div>
      )}
    </div>
  )
}

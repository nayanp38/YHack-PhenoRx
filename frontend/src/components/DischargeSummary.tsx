import { FileText } from 'lucide-react'
import type { InsuranceScreeningResult, PipelineResult } from '../types'
import { CostFooter } from './CostFooter'

function renderSummaryMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const bold = /^\*\*(.+)\*\*$/.exec(line.trim())
    if (bold) {
      return (
        <h3 key={i} className="mb-2 mt-6 text-[18px] font-bold text-[var(--navy)] first:mt-0">
          {bold[1]}
        </h3>
      )
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    return (
      <p key={i} className="mb-2 text-[18px] leading-[1.7] text-[var(--gray-800)]">
        {line}
      </p>
    )
  })
}

type Props = {
  patientId: string
  summaryText: string
  insurance: InsuranceScreeningResult | null
  pipeline?: PipelineResult | null
}

export function DischargeSummary({ patientId, summaryText, insurance, pipeline }: Props) {
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const hasCostData =
    insurance != null &&
    insurance.totalEstimatedMonthlyCost != null &&
    insurance.alternativeSavings.some((s) => s.monthlySavings != null)

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8">
      <div
        className="rounded-2xl border border-[var(--gray-200)] bg-white p-8 shadow-[var(--card-shadow)]"
        style={{ padding: 32 }}
      >
        <div className="mb-6 flex items-start gap-3">
          <FileText className="h-8 w-8 shrink-0 text-[var(--navy)]" aria-hidden />
          <div>
            <h2 className="text-[20px] font-bold text-[var(--navy)]">
              Discharge Medication Summary
            </h2>
            <p className="mt-1 text-sm text-[var(--gray-500)]">
              Prepared for: {patientId} · {date}
            </p>
          </div>
        </div>
        <div className="prose max-w-none">{renderSummaryMarkdown(summaryText)}</div>
      </div>
      {hasCostData && insurance && (
        <div className="mt-4">
          <CostFooter insurance={insurance} pipeline={pipeline} />
        </div>
      )}
    </div>
  )
}

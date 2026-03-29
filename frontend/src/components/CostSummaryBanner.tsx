import type { InsuranceScreeningResult } from '../types'

type Props = {
  insurance: InsuranceScreeningResult
}

export function CostSummaryBanner({ insurance }: Props) {
  const current = insurance.totalEstimatedMonthlyCost
  const savingsSum = insurance.alternativeSavings.reduce(
    (acc, s) => acc + Math.max(0, s.monthlySavings),
    0
  )
  const recommended = Math.max(0, current - savingsSum)
  const delta = current - recommended

  return (
    <div
      className="mt-6 rounded-xl border p-5"
      style={{
        background: 'rgba(167, 139, 250, 0.08)',
        borderColor: 'rgba(167, 139, 250, 0.25)',
      }}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--px-text-secondary)]">Current Monthly Cost</p>
          <p className="text-[24px] font-bold text-[var(--px-text)]">${current.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--px-text-secondary)]">Recommended Monthly Cost</p>
          <p className="text-[24px] font-bold text-[var(--px-text)]">${recommended.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--px-text-secondary)]">Monthly Savings</p>
          <p
            className="text-[24px] font-bold"
            style={{ color: delta >= 0 ? 'var(--px-accent)' : 'var(--px-critical)' }}
          >
            {delta >= 0 ? `$${delta.toFixed(0)}` : `-$${Math.abs(delta).toFixed(0)}`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--px-text-tertiary)]">
        Based on {insurance.plan.planName} formulary data
      </p>
    </div>
  )
}

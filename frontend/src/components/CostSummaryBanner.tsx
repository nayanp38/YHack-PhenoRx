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
        background: 'rgba(124, 58, 237, 0.05)',
        borderColor: 'rgba(124, 58, 237, 0.2)',
      }}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--gray-500)]">Current Monthly Cost</p>
          <p className="text-[24px] font-bold text-[var(--gray-800)]">${current.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--gray-500)]">Recommended Monthly Cost</p>
          <p className="text-[24px] font-bold text-[var(--gray-800)]">${recommended.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--gray-500)]">Monthly Savings</p>
          <p
            className="text-[24px] font-bold"
            style={{ color: delta >= 0 ? 'var(--savings-green)' : 'var(--cost-increase-red)' }}
          >
            {delta >= 0 ? `$${delta.toFixed(0)}` : `-$${Math.abs(delta).toFixed(0)}`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--gray-500)]">
        Based on {insurance.plan.planName} formulary data
      </p>
    </div>
  )
}

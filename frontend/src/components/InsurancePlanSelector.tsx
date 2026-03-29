import { Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchPlans } from '../lib/api'
import type { InsurancePlan } from '../types'

type Props = {
  value: InsurancePlan | null
  onChange: (p: InsurancePlan | null) => void
}

export function InsurancePlanSelector({ value, onChange }: Props) {
  const [plans, setPlans] = useState<InsurancePlan[]>([])

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])

  return (
    <div className="rounded-xl border border-[var(--gray-200)] bg-white p-6 shadow-[var(--card-shadow)]">
      <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold text-[var(--gray-800)]">
        <Shield className="h-5 w-5 text-[var(--navy)]" aria-hidden />
        Medicare Part D Plan
      </h2>
      <select
        className="w-full rounded-lg border border-[var(--gray-200)] px-3 py-2 text-sm"
        value={value ? `${value.contractId}|${value.planId}` : ''}
        onChange={(e) => {
          const v = e.target.value
          if (!v) {
            onChange(null)
            return
          }
          const [c, p] = v.split('|')
          const pl = plans.find((x) => x.contractId === c && x.planId === p)
          onChange(pl ?? null)
        }}
      >
        <option value="">— Select plan (optional) —</option>
        {plans.map((pl) => (
          <option key={`${pl.contractId}-${pl.planId}`} value={`${pl.contractId}|${pl.planId}`}>
            {pl.planName} ({pl.planType})
          </option>
        ))}
      </select>
      {!value && (
        <p className="mt-3 text-sm italic text-[var(--gray-500)]">
          Optional. Skip to analyze without insurance data.
        </p>
      )}
    </div>
  )
}

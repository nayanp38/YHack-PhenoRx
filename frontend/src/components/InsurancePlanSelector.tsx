import { Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchPlans } from '../lib/api'
import type { InsurancePlan } from '../types'

const selectClass =
  'w-full rounded-lg border border-[var(--px-border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-[var(--px-text)] outline-none focus:border-[var(--px-border-active)]'

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
    <div
      className="rounded-xl border p-6"
      style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Shield size={16} color="var(--px-accent)" aria-hidden />
        <h3 className="font-display text-[18px] font-medium text-[var(--px-text)]">
          Medicare Part D Plan
        </h3>
      </div>
      <select
        className={selectClass}
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
        <p className="mt-3 text-sm italic text-[var(--px-text-tertiary)]">
          Optional. Skip to analyze without insurance data.
        </p>
      )}
    </div>
  )
}

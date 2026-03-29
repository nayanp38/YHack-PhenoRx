import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActivityGauge } from './ActivityGauge'
import type { EnzymeDashboardRow } from '../types'

type Props = {
  enzyme: string
  row: EnzymeDashboardRow
  diplotype: string
  index: number
}

function badgeClassForPhenotype(p: string): string {
  const u = p.toUpperCase()
  if (u.includes('POOR')) return 'bg-[var(--critical-red)] text-white'
  if (u.includes('INTERMEDIATE')) return 'bg-[var(--high-amber)] text-white'
  if (u.includes('ULTRA') || u.includes('RAPID')) return 'bg-[var(--accent-blue)] text-white'
  return 'bg-[var(--safe-green)] text-white'
}

export function EnzymeCard({ enzyme, row, diplotype, index }: Props) {
  const [visible, setVisible] = useState(false)
  const stagger = index * 200

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), stagger)
    return () => clearTimeout(t)
  }, [stagger])

  const same =
    row.baseline_phenotype === row.effective_phenotype &&
    Math.abs(row.baseline_activity_score - row.effective_activity_score) < 1e-6

  return (
    <div
      className="mb-4 flex h-[120px] max-w-[1280px] flex-row items-stretch rounded-xl border border-[var(--gray-200)] bg-white p-4 shadow-[var(--card-shadow)] transition-all duration-[400ms]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div className="flex w-[20%] min-w-[100px] flex-col justify-center border-r border-[var(--gray-100)] pr-3">
        <h2 className="text-[18px] font-semibold text-[var(--gray-800)]">{enzyme}</h2>
        <p className="text-[12px] text-[var(--gray-500)]">{diplotype}</p>
      </div>

      <ActivityGauge enzyme={enzyme} row={row} startDelayMs={stagger + 300} />

      <div className="flex w-[25%] min-w-[140px] flex-col justify-center gap-2 pl-3">
        {same ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--safe-green)] px-3 py-1 text-center text-[12px] font-bold text-white">
            <Check className="h-3 w-3" /> No Change
          </span>
        ) : (
          <>
            <span className="rounded-full bg-[var(--safe-green)] px-3 py-1 text-center text-[12px] font-bold text-white">
              {row.baseline_phenotype}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-center text-[12px] font-bold ${badgeClassForPhenotype(row.effective_phenotype)}`}
            >
              {row.effective_phenotype}
            </span>
          </>
        )}
        {row.dominant_perpetrator_drug && (
          <p className="text-[12px] text-[var(--gray-500)]">
            Perpetrator: {row.dominant_perpetrator_drug}
            {row.perpetrator_strength ? ` (${row.perpetrator_strength})` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

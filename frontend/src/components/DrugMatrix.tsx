import { MATRIX_ENZYMES, RISK_ORDER } from '../lib/constants'
import type { DrugClassificationCell, InteractionResult } from '../types'
import { MatrixCell } from './MatrixCell'

type Props = {
  drugMatrix: Record<string, Record<string, DrugClassificationCell>>
  interactions: InteractionResult[]
}

function maxRiskForDrug(drug: string, interactions: InteractionResult[]): string | null {
  const rows = interactions.filter((i) => i.drug_name.toLowerCase() === drug.toLowerCase())
  if (!rows.length) return null
  let best = 'info'
  let ord = 99
  for (const r of rows) {
    const o = RISK_ORDER[r.risk_level] ?? 99
    if (o < ord) {
      ord = o
      best = r.risk_level
    }
  }
  return best
}

function borderForRisk(level: string | null): string {
  if (!level) return 'transparent'
  const l = level.toLowerCase()
  if (l === 'critical') return 'var(--critical-red)'
  if (l === 'high') return 'var(--high-amber)'
  if (l === 'moderate') return 'var(--moderate-yellow)'
  if (l === 'low') return 'var(--low-gray)'
  return 'transparent'
}

export function DrugMatrix({ drugMatrix, interactions }: Props) {
  const drugs = Object.keys(drugMatrix).sort()

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8">
      <h1 className="mb-6 text-[24px] font-bold text-[var(--navy)]">Drug Classification Matrix</h1>
      <div className="overflow-x-auto rounded-xl border border-[var(--gray-200)] bg-white shadow-[var(--card-shadow)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--gray-200)] bg-[var(--gray-50)]">
              <th className="sticky left-0 z-10 bg-[var(--gray-50)] px-3 py-3 text-left font-semibold text-[var(--navy)]">
                Drug
              </th>
              {MATRIX_ENZYMES.map((e) => (
                <th key={e} className="px-2 py-3 font-semibold text-[var(--navy)]">
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drugs.map((drug) => {
              const mr = maxRiskForDrug(drug, interactions)
              const border = borderForRisk(mr)
              return (
                <tr
                  key={drug}
                  className="border-b border-[var(--gray-100)]"
                  style={{ borderLeftWidth: mr ? 3 : 0, borderLeftColor: border, borderLeftStyle: 'solid' }}
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-[var(--gray-800)]">
                    {drug}
                  </td>
                  {MATRIX_ENZYMES.map((enz) => (
                    <td key={enz}>
                      <MatrixCell cell={drugMatrix[drug]?.[enz]} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

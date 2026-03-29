import { useRef, useState } from 'react'
import type { DrugClassificationCell } from '../types'

function cellLabel(cell: DrugClassificationCell | undefined): { bg: string; fg: string; text: string } {
  if (!cell || cell.role === 'irrelevant') {
    return { bg: '#f3f4f6', fg: '#6b7280', text: '—' }
  }
  const role = cell.role
  const st = (cell.strength || cell.inhibitor_strength || '').toLowerCase()
  if (role === 'substrate' || role === 'substrate_and_inhibitor') {
    return { bg: '#dbeafe', fg: '#1e40af', text: 'Substrate' }
  }
  if (role === 'inducer') {
    return { bg: '#f3e8ff', fg: '#6b21a8', text: 'Inducer' }
  }
  if (role === 'inhibitor' || role === 'substrate_and_inhibitor') {
    if (st.includes('strong')) return { bg: '#fee2e2', fg: '#991b1b', text: 'Strong Inhibitor' }
    if (st.includes('moderate')) return { bg: '#ffedd5', fg: '#9a3412', text: 'Moderate Inhibitor' }
    if (st.includes('weak')) return { bg: '#fef9c3', fg: '#854d0e', text: 'Weak Inhibitor' }
    return { bg: '#fee2e2', fg: '#991b1b', text: 'Inhibitor' }
  }
  return { bg: '#f3f4f6', fg: '#6b7280', text: '—' }
}

type Props = {
  cell: DrugClassificationCell | undefined
}

export function MatrixCell({ cell }: Props) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const { bg, fg, text } = cellLabel(cell)

  const irrelevant = !cell || cell.role === 'irrelevant'

  return (
    <div ref={wrap} className="relative px-1 py-2 text-center">
      <button
        type="button"
        disabled={irrelevant}
        className="rounded px-2 py-1 text-[11px] font-semibold"
        style={{ background: bg, color: fg }}
        onMouseEnter={() => !irrelevant && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {text}
      </button>
      {open && cell && !irrelevant && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1 w-[280px] max-w-[80vw] -translate-x-1/2 rounded-lg border border-[var(--gray-200)] bg-white p-3 text-left text-[11px] shadow-lg"
          style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
        >
          <dl className="space-y-1">
            <div>
              <dt className="text-[var(--gray-500)]">Role</dt>
              <dd>{cell.role}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">Strength</dt>
              <dd>{cell.strength ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">Substrate sensitivity</dt>
              <dd>{cell.substrate_sensitivity ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">Substrate type</dt>
              <dd>{cell.substrate_type ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">fm_cyp</dt>
              <dd>{cell.fm_cyp ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">AUCR (strong inhibitor)</dt>
              <dd>{cell.aucr_strong_inhibitor ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">Therapeutic window</dt>
              <dd>{cell.therapeutic_window ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--gray-500)]">Source</dt>
              <dd>{cell.data_source ?? '—'}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}

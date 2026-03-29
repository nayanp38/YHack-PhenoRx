import { useEffect, useState } from 'react'
import type { DemoPatient } from '../types'

type Props = {
  onLoadDemo: (p: DemoPatient) => void
}

export function NavBar({ onLoadDemo }: Props) {
  const [patients, setPatients] = useState<DemoPatient[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/demo_patients.json')
      .then((r) => r.json())
      .then(setPatients)
      .catch(() => setPatients([]))
  }, [])

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between px-4 md:px-6"
      style={{ background: 'var(--dark-navy)' }}
    >
      <span className="text-[20px] font-bold text-white">PhenoRx</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-white/30 bg-transparent px-3 py-2 text-sm text-white"
        >
          Load Demo Patient ▾
        </button>
        {open && (
          <ul
            className="absolute right-0 mt-1 max-h-64 min-w-[280px] overflow-auto rounded-lg border border-[var(--gray-200)] bg-white py-1 shadow-lg"
            role="listbox"
          >
            {patients.map((p) => (
              <li key={p.patient_id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[var(--gray-800)] hover:bg-[var(--gray-100)]"
                  onClick={() => {
                    onLoadDemo(p)
                    setOpen(false)
                  }}
                >
                  {p.patient_id} — {p.age != null ? `${p.age}y` : '—'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  )
}

import { useEffect, useState } from 'react'
import { ChevronDown, Dna } from 'lucide-react'
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
      className="fixed left-0 right-0 top-0 z-[100] flex h-14 items-center justify-between border-b px-8"
      style={{
        height: 'var(--px-nav-h)',
        background: 'rgba(10,10,11,0.8)',
        backdropFilter: 'blur(20px)',
        borderColor: 'var(--px-border)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[7px]"
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.13), rgba(52,211,153,0.05))',
            border: '1px solid rgba(52,211,153,0.2)',
          }}
        >
          <Dna size={14} color="var(--px-accent)" aria-hidden />
        </div>
        <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--px-text)]">
          <span style={{ color: 'var(--px-accent)' }}>CYP</span>her
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em]"
          style={{ background: 'var(--px-accent-dim)', color: 'var(--px-accent)' }}
        >
          BETA
        </span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition hover:brightness-110"
          style={{
            background: 'transparent',
            color: 'var(--px-text)',
            borderColor: 'var(--px-border)',
          }}
        >
          Load Demo Patient
          <ChevronDown size={14} style={{ color: 'var(--px-text-secondary)' }} />
        </button>
        {open && (
          <ul
            className="absolute right-0 top-[calc(100%+6px)] z-[110] max-h-64 min-w-[280px] overflow-auto rounded-[10px] p-1.5 shadow-2xl"
            style={{
              background: 'rgba(20,20,22,0.98)',
              border: '1px solid var(--px-border)',
              backdropFilter: 'blur(20px)',
            }}
            role="listbox"
          >
            {patients.map((p) => (
              <li key={p.patient_id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                  onClick={() => {
                    onLoadDemo(p)
                    setOpen(false)
                  }}
                >
                  <span className="text-[13px] font-medium text-[var(--px-text)]">
                    {p.patient_id}
                    {p.age != null ? ` · ${p.age}y` : ''}
                  </span>
                  {p.insurance?.plan_name && (
                    <span className="text-[11px] text-[var(--px-text-secondary)]">
                      {p.insurance.plan_name}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  )
}

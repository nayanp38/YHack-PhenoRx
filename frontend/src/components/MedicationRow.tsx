import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MedicationInput } from '../types'

const fieldClass =
  'rounded-lg border border-[var(--px-border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-[var(--px-text)] placeholder:text-[var(--px-text-tertiary)] outline-none focus:border-[var(--px-border-active)]'

type Props = {
  med: MedicationInput
  index: number
  drugNames: string[]
  onChange: (i: number, m: MedicationInput) => void
  onRemove: (i: number) => void
}

export function MedicationRow({ med, index, drugNames, onChange, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(med.drug_name)
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQ(med.drug_name) }, [med.drug_name])

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return drugNames.slice(0, 12)
    return drugNames.filter((d) => d.includes(s)).slice(0, 12)
  }, [drugNames, q])

  return (
    <div className="mb-2 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
      <div className="relative min-w-0 flex-[2] basis-0">
        <input
          className={`w-full min-w-0 ${fieldClass}`}
          placeholder="Drug name"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            onChange(index, { ...med, drug_name: e.target.value })
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurRef.current = setTimeout(() => setOpen(false), 150)
          }}
        />
        {open && suggestions.length > 0 && (
          <ul
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border shadow-lg"
            style={{
              background: 'rgba(20,20,22,0.98)',
              borderColor: 'var(--px-border)',
            }}
          >
            {suggestions.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[var(--px-text)] hover:bg-white/[0.06]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQ(d)
                    onChange(index, { ...med, drug_name: d })
                    setOpen(false)
                    document.getElementById(`dose-${index}`)?.focus()
                  }}
                >
                  {d}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        id={`dose-${index}`}
        type="text"
        inputMode="decimal"
        className={`w-[5.5rem] shrink-0 sm:w-28 ${fieldClass}`}
        placeholder="Dose (e.g. mg)"
        value={med.dosage}
        onChange={(e) => {
          onChange(index, {
            ...med,
            dosage: e.target.value,
          })
        }}
      />
      <input
        className={`min-w-0 flex-1 basis-0 ${fieldClass}`}
        placeholder="indication"
        value={med.indication}
        onChange={(e) => onChange(index, { ...med, indication: e.target.value })}
      />
      <button
        type="button"
        className="shrink-0 rounded-lg p-2 text-[var(--px-critical)] hover:bg-[var(--px-critical-dim)]"
        aria-label="Remove medication"
        onClick={() => onRemove(index)}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

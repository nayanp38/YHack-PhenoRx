import { Check } from 'lucide-react'
import type { ActiveView } from '../types'

const STEPS: { id: ActiveView; label: string }[] = [
  { id: 'intake', label: 'Patient Intake' },
  { id: 'enzyme', label: 'Enzyme Dashboard' },
  { id: 'risk', label: 'Risk Report' },
  { id: 'matrix', label: 'Drug Matrix' },
  { id: 'summary', label: 'Discharge Summary' },
]

type Props = {
  active: ActiveView
  hasAnalyzed: boolean
  onSelect: (v: ActiveView) => void
}

export function ViewStepper({ active, hasAnalyzed, onSelect }: Props) {
  const activeIndex = STEPS.findIndex((s) => s.id === active)

  return (
    <div
      className="fixed left-0 right-0 top-14 z-40 flex h-12 items-center justify-center border-b border-[var(--gray-200)] bg-white px-2"
      role="navigation"
      aria-label="Analysis steps"
    >
      <div className="flex max-w-[1280px] flex-1 flex-wrap items-center justify-center gap-1 md:gap-2">
        {STEPS.map((step, i) => {
          const isActive = i === activeIndex
          const isCompleted = hasAnalyzed && i < activeIndex
          const canClick = hasAnalyzed ? i <= activeIndex : i === 0

          return (
            <div key={step.id} className="flex items-center">
              {i > 0 && (
                <div
                  className="mx-1 hidden h-px w-4 bg-[var(--gray-200)] sm:block md:w-8"
                  aria-hidden
                />
              )}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => {
                  if (!canClick) return
                  onSelect(step.id)
                }}
                className="flex items-center gap-2 rounded-full px-2 py-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold"
                  style={{
                    borderColor: isActive
                      ? 'var(--navy)'
                      : isCompleted
                        ? 'var(--safe-green)'
                        : 'var(--gray-200)',
                    background: isActive
                      ? 'var(--navy)'
                      : isCompleted
                        ? 'var(--safe-green)'
                        : 'white',
                    color: isActive || isCompleted ? 'white' : 'var(--gray-500)',
                  }}
                >
                  {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className="hidden max-w-[120px] text-xs sm:inline md:max-w-none md:text-sm"
                  style={{
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? 'var(--navy)' : 'var(--gray-500)',
                  }}
                >
                  {step.label}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

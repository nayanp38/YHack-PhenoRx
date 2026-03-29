import { Activity, Check, FileText, Pill, ShieldAlert } from 'lucide-react'
import type { ActiveView } from '../types'

const STEPS: { id: ActiveView; label: string; Icon: typeof Pill }[] = [
  { id: 'intake', label: 'Patient Intake', Icon: Pill },
  { id: 'enzyme', label: 'Enzyme Activity', Icon: Activity },
  { id: 'risk', label: 'Risk Report', Icon: ShieldAlert },
  { id: 'summary', label: 'Discharge Summary', Icon: FileText },
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
      className="fixed left-0 right-0 z-[99] flex items-center justify-center gap-0 border-b px-8"
      style={{
        top: 'var(--px-nav-h)',
        height: 'var(--px-stepper-h)',
        background: 'rgba(10,10,11,0.7)',
        backdropFilter: 'blur(16px)',
        borderColor: 'var(--px-border)',
      }}
      role="navigation"
      aria-label="Analysis steps"
    >
      {STEPS.map((step, i) => {
        const isActive = i === activeIndex
        const isCompleted = hasAnalyzed && i < activeIndex
        const canClick = hasAnalyzed ? i <= activeIndex : i === 0
        const Icon = step.Icon

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => {
                if (!canClick) return
                onSelect(step.id)
              }}
              className="flex items-center gap-1.5 rounded-lg border-none py-1.5 pl-3.5 pr-3.5 transition disabled:cursor-not-allowed"
              style={{
                cursor: canClick ? 'pointer' : 'default',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            >
              <span
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition"
                style={{
                  background: isActive
                    ? 'var(--px-accent)'
                    : isCompleted
                      ? 'var(--px-accent-dim)'
                      : 'rgba(255,255,255,0.04)',
                  borderColor: isActive
                    ? 'var(--px-accent)'
                    : isCompleted
                      ? 'rgba(52,211,153,0.27)'
                      : 'var(--px-border)',
                }}
              >
                {isCompleted ? (
                  <Check size={11} color="var(--px-accent)" strokeWidth={3} />
                ) : (
                  <Icon
                    size={11}
                    color={isActive ? 'var(--px-bg)' : 'var(--px-text-tertiary)'}
                    aria-hidden
                  />
                )}
              </span>
              <span
                className="hidden text-[12px] sm:inline"
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? 'var(--px-text)'
                    : isCompleted
                      ? 'var(--px-text-secondary)'
                      : 'var(--px-text-tertiary)',
                }}
              >
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className="mx-0.5 h-px w-6 transition"
                style={{
                  background: isCompleted ? 'rgba(52,211,153,0.27)' : 'var(--px-border)',
                }}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

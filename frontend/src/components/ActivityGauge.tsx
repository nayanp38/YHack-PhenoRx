import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MAX_ACTIVITY_BY_ENZYME } from '../lib/constants'
import { easeOutCubic } from '../lib/easing'
import type { EnzymeDashboardRow } from '../types'

const DURATION_MS = 1200
const EASE = easeOutCubic

type Props = {
  enzyme: string
  row: EnzymeDashboardRow
  startDelayMs: number
}

export function ActivityGauge({ enzyme, row, startDelayMs }: Props) {
  const max = MAX_ACTIVITY_BY_ENZYME[enzyme] ?? 2
  const baseline = row.baseline_activity_score
  const effective = row.effective_activity_score
  const decreased = effective < baseline - 1e-6

  const [displayEffective, setDisplayEffective] = useState(baseline)
  const [barFrac, setBarFrac] = useState(baseline / max)
  const [flash, setFlash] = useState(false)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    setDisplayEffective(baseline)
    setBarFrac(baseline / max)
    const t0 = performance.now() + startDelayMs
    let started = false

    const tick = (now: number) => {
      if (!started) {
        if (now < t0) {
          raf.current = requestAnimationFrame(tick)
          return
        }
        started = true
      }
      const elapsed = now - t0
      const t = Math.min(1, elapsed / DURATION_MS)
      const eased = EASE(t)
      const v = baseline + (effective - baseline) * eased
      setDisplayEffective(Number(v.toFixed(4)))
      setBarFrac((baseline + (effective - baseline) * eased) / max)
      if (t >= 1 && effective === 0 && baseline > 0) {
        setFlash(true)
        setTimeout(() => setFlash(false), 400)
      }
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [baseline, effective, max, startDelayMs])

  const baselinePct = Math.min(100, (baseline / max) * 100)
  const effectivePct = Math.min(100, barFrac * 100)

  return (
    <div className="flex min-w-0 flex-[55] flex-col justify-center px-2">
      <div className="mb-1 flex items-center justify-between text-[12px] text-[var(--gray-500)]">
        <span>
          Baseline:{' '}
          <span className="font-mono text-[13px] font-medium text-[var(--gray-800)]">
            {baseline.toFixed(1)}
          </span>
        </span>
        <span className="flex items-center gap-1">
          {decreased && <ArrowRight className="h-3 w-3" />}
          <span>
            Effective:{' '}
            <span className="font-mono text-[13px] font-medium text-[var(--gray-800)]">
              {displayEffective.toFixed(1)}
            </span>
          </span>
        </span>
      </div>
      <div
        className="relative h-8 w-full overflow-hidden rounded-md transition-colors duration-300"
        style={{
          background: flash ? 'rgba(220, 38, 38, 0.5)' : 'var(--gray-100)',
        }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-md bg-[var(--safe-green)] opacity-90"
          style={{ width: `${baselinePct}%` }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-md"
          style={{
            width: `${effectivePct}%`,
            background: decreased ? 'var(--critical-red)' : 'var(--safe-green)',
          }}
        />
      </div>
    </div>
  )
}

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

/** Thin bar + centered effective score (reference PhenoRx gauge styling). */
export function ActivityGauge({ enzyme, row, startDelayMs }: Props) {
  const max = MAX_ACTIVITY_BY_ENZYME[enzyme] ?? 2
  const baseline = row.baseline_activity_score
  const effective = row.effective_activity_score

  const [displayEffective, setDisplayEffective] = useState(baseline)
  const [barFrac, setBarFrac] = useState(baseline / max)
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
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [baseline, effective, max, startDelayMs])

  const pct = Math.max(0, Math.min(100, barFrac * 100))
  const color =
    displayEffective <= 0
      ? 'var(--px-critical)'
      : displayEffective < max * 0.5
        ? 'var(--px-high)'
        : 'var(--px-accent)'

  return (
    <div className="w-full">
      <div className="mb-1.5 flex justify-between font-sans text-[12px] text-[var(--px-text-secondary)]">
        <span>0</span>
        <span
          className="font-display text-[18px] font-semibold"
          style={{ color }}
        >
          {displayEffective.toFixed(1)}
        </span>
        <span>{max}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-sm"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-sm transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 12px ${color}44`,
          }}
        />
      </div>
    </div>
  )
}

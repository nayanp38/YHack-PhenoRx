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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Track shows 0–max; filled bar = effective activity; vertical marker = baseline (difference is visible). */
export function ActivityGauge({ enzyme, row, startDelayMs }: Props) {
  const enzymeKey = enzyme.toUpperCase()
  const maxRaw = MAX_ACTIVITY_BY_ENZYME[enzymeKey] ?? MAX_ACTIVITY_BY_ENZYME[enzyme] ?? 2
  const max = Math.max(maxRaw, 1e-6)

  const baseline = Number(row.baseline_activity_score ?? 0)
  const effective = Number(row.effective_activity_score ?? 0)

  const baselinePct = clamp((baseline / max) * 100, 0, 100)

  const [effectivePct, setEffectivePct] = useState(baselinePct)
  const [displayEffective, setDisplayEffective] = useState(baseline)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    setEffectivePct(baselinePct)
    setDisplayEffective(baseline)
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
      const effInterp = baseline + (effective - baseline) * eased
      setDisplayEffective(Number(effInterp.toFixed(4)))
      setEffectivePct(clamp((effInterp / max) * 100, 0, 100))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [baseline, effective, max, baselinePct, startDelayMs])

  const delta = Math.abs(baseline - effective)
  const showDeltaShade = delta >= 1e-6
  const lo = Math.min(baselinePct, effectivePct)
  const hi = Math.max(baselinePct, effectivePct)

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
        <span className="font-display text-[18px] font-semibold" style={{ color }}>
          {displayEffective.toFixed(1)}
        </span>
        <span>{max}</span>
      </div>

      <div
        className="relative h-3 w-full overflow-visible rounded-sm"
        aria-label={`Enzyme activity from ${baseline.toFixed(2)} toward ${effective.toFixed(2)} on scale 0–${max}`}
      >
        {/* Track */}
        <div
          className="absolute inset-0 overflow-hidden rounded-sm"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          {/* Optional delta band: baseline ↔ effective */}
          {showDeltaShade && (
            <div
              className="absolute top-0 h-full rounded-sm"
              style={{
                left: `${lo}%`,
                width: `${hi - lo}%`,
                background: 'rgba(255,255,255,0.12)',
              }}
            />
          )}
          {/* Effective level fill (0 → current animated effective) */}
          <div
            className="h-full rounded-sm"
            style={{
              width: `${effectivePct}%`,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              boxShadow: `0 0 14px ${color}55`,
              minWidth: effectivePct > 0 ? '2px' : 0,
            }}
          />
        </div>

        {/* Baseline marker — always visible so difference vs effective is clear */}
        <div
          className="pointer-events-none absolute top-[-2px] z-10 h-[calc(100%+4px)] w-[3px] -translate-x-1/2 rounded-sm"
          style={{
            left: `${baselinePct}%`,
            background: 'var(--px-text)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
          }}
          title={`Baseline activity: ${baseline.toFixed(2)}`}
        />

        {/* Effective marker at animated position (when different from baseline, second tick) */}
        {showDeltaShade && (
          <div
            className="pointer-events-none absolute top-[-2px] z-10 h-[calc(100%+4px)] w-[3px] -translate-x-1/2 rounded-sm"
            style={{
              left: `${effectivePct}%`,
              background: color,
              boxShadow: `0 0 0 1px rgba(0,0,0,0.25), 0 0 8px ${color}88`,
            }}
            title={`Effective activity: ${displayEffective.toFixed(2)}`}
          />
        )}
      </div>
    </div>
  )
}

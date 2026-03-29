import { ArrowRight, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActivityGauge } from './ActivityGauge'
import type { EnzymeDashboardRow } from '../types'

type Props = {
  enzyme: string
  row: EnzymeDashboardRow
  diplotype: string
  index: number
}

function phenotypeColor(p: string): string {
  const u = p.toUpperCase()
  if (u.includes('POOR')) return 'var(--px-critical)'
  if (u.includes('INTERMEDIATE')) return 'var(--px-high)'
  return 'var(--px-accent)'
}

function PhenotypeLine({ label, phenotype }: { label: string; phenotype: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase tracking-[0.05em] text-[var(--px-text-tertiary)]">
        {label}
      </div>
      <span className="text-[13px] font-medium" style={{ color: phenotypeColor(phenotype) }}>
        {phenotype}
      </span>
    </div>
  )
}

export function EnzymeCard({ enzyme, row, diplotype, index }: Props) {
  const [visible, setVisible] = useState(false)
  const stagger = index * 100

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), stagger)
    return () => clearTimeout(t)
  }, [stagger])

  const changed =
    row.baseline_phenotype !== row.effective_phenotype ||
    Math.abs(row.baseline_activity_score - row.effective_activity_score) >= 1e-6

  const borderColor = changed
    ? row.effective_activity_score <= 0
      ? 'var(--px-critical)'
      : 'var(--px-high)'
    : 'var(--px-border)'

  const strength = row.perpetrator_strength
  const isStrong = strength?.toLowerCase() === 'strong'

  return (
    <div
      className="relative overflow-hidden rounded-[14px] border p-7 transition-opacity duration-500"
      style={{
        background: 'var(--px-bg-card)',
        borderColor,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        boxShadow: changed ? `0 0 40px ${borderColor}11` : 'none',
      }}
    >
      {changed && (
        <div
          className="absolute left-0 right-0 top-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`,
          }}
        />
      )}
      <div className="mb-5 flex items-center justify-between gap-2">
        <h3 className="font-display text-[20px] font-medium text-[var(--px-text)]">{enzyme}</h3>
        {changed && row.dominant_perpetrator_drug && (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold tracking-[0.05em]"
            style={{
              color: strength ? (isStrong ? 'var(--px-critical)' : 'var(--px-high)') : 'var(--px-text-secondary)',
              background: strength
                ? isStrong
                  ? 'var(--px-critical-dim)'
                  : 'var(--px-high-dim)'
                : 'rgba(255,255,255,0.06)',
            }}
          >
            {strength ? `${strength.toUpperCase()} INHIBITION` : 'PHENOCONVERSION'}
          </span>
        )}
      </div>

      <ActivityGauge enzyme={enzyme} row={row} startDelayMs={stagger + 200} />

      <div className="mt-4 flex items-start justify-between gap-2">
        <PhenotypeLine label="Baseline" phenotype={row.baseline_phenotype} />
        {changed && (
          <>
            <ArrowRight size={14} className="mt-4 shrink-0 text-[var(--px-text-tertiary)]" />
            <div className="text-right">
              <PhenotypeLine label="Effective" phenotype={row.effective_phenotype} />
            </div>
          </>
        )}
      </div>

      <p className="mt-3 font-mono text-[11px] text-[var(--px-text-tertiary)]">{diplotype}</p>

      {changed && row.dominant_perpetrator_drug && (
        <div
          className="mt-4 flex items-center gap-1.5 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderColor: 'var(--px-border)',
            color: 'var(--px-text-secondary)',
          }}
        >
          <Zap size={12} color="var(--px-high)" />
          <span>
            Caused by{' '}
            <span className="font-medium text-[var(--px-text)]">{row.dominant_perpetrator_drug}</span>
          </span>
        </div>
      )}
    </div>
  )
}

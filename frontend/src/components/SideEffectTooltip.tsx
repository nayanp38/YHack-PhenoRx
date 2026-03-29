import type { AdverseEvent, AlternativeComparison } from '../types'
import { SeverityBadge } from './SeverityBadge'

export interface SideEffectTooltipProps {
  flaggedDrugName: string
  flaggedDrugSap: number
  flaggedTop3: AdverseEvent[]
  alternativeComparison: AlternativeComparison
  position?: 'above' | 'below'
}

function gradeDotClass(g: number): string {
  if (g >= 4) return 'bg-[var(--critical-red)]'
  if (g >= 3) return 'bg-[var(--high-amber)]'
  return 'bg-[var(--low-gray)]'
}

function formatBucket(b: string): string {
  return b.replace(/_/g, ' ')
}

function AeList({ title, events }: { title: string; events: AdverseEvent[] }) {
  return (
    <div>
      <div className="mb-1 truncate text-[10px] font-bold text-[var(--gray-500)]" title={title}>
        {title}
      </div>
      <ul className="max-h-[140px] space-y-1 overflow-auto">
        {events.slice(0, 3).map((ae) => (
          <li key={ae.meddra_pt} className="flex items-start gap-1.5 text-[10px] text-[var(--gray-800)]">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${gradeDotClass(ae.ctcae_typical_grade)}`}
            />
            <span className="min-w-0 flex-1">
              {ae.meddra_pt.replace(/_/g, ' ')}{' '}
              <span className="font-mono text-[var(--gray-500)]">· {formatBucket(ae.frequency_bucket)}</span>
              {ae.sap_score != null && (
                <span className="font-mono text-[var(--gray-500)]"> · SAP {ae.sap_score.toFixed(3)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SideEffectTooltip({
  flaggedDrugName,
  flaggedDrugSap,
  flaggedTop3,
  alternativeComparison,
  position = 'below',
}: SideEffectTooltipProps) {
  const alt = alternativeComparison
  const altName = alt.alternative_drug
  const altSap = alt.alternative_sap
  const delta = alt.severity_delta
  const warnings = alt.actionable_warnings ?? []
  return (
    <div
      className={`absolute z-50 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-[var(--gray-200)] bg-white p-3 text-left shadow-lg ${
        position === 'below' ? 'left-0 top-full mt-1' : 'bottom-full left-0 mb-1'
      }`}
      style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
      role="tooltip"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="text-[12px] font-bold text-[var(--navy)]">Side effect comparison (SAP v3)</div>
      <div className="text-[11px] text-[var(--gray-500)]">
        {altName} vs {flaggedDrugName}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] font-mono text-[var(--gray-800)]">
          <span>{flaggedDrugSap.toFixed(3)}</span>
          <span>{alt.severity_verdict === 'DATA_UNAVAILABLE' ? '—' : altSap.toFixed(3)}</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--gray-100)]">
          <div className="h-full w-1/2 bg-[var(--critical-red)]/45" />
          <div className="h-full w-1/2 bg-[var(--safe-green)]/45" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-[var(--gray-800)]">
            Δ {delta > 0 ? '+' : ''}
            {delta.toFixed(3)}
          </span>
          <SeverityBadge verdict={alt.severity_verdict} size="md" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--gray-100)] pt-3">
        <AeList title={flaggedDrugName} events={flaggedTop3} />
        <AeList title={altName} events={alt.alternative_top_3} />
      </div>

      {warnings.length > 0 && (
        <div
          className="mt-3 rounded-md border border-[var(--high-amber)]/30 px-2 py-1.5 text-[11px] text-[var(--gray-800)]"
          style={{ background: 'rgba(217, 119, 6, 0.08)' }}
        >
          <span className="font-semibold">Actionable: </span>
          {warnings.map((w) => w.display).join(' · ')}
        </div>
      )}
    </div>
  )
}

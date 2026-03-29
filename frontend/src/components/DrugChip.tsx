import type { AdverseEvent, AlternativeComparison } from '../types'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { SeverityBadge } from './SeverityBadge'
import type { SeverityVerdict } from './SeverityBadge'
import { SideEffectTooltip } from './SideEffectTooltip'

type Props = {
  /** @deprecated use drugName */
  label?: string
  drugName?: string
  sub?: ReactNode
  accent?: 'default' | 'perp'
  showCostDimmed?: boolean
  severityVerdict?: SeverityVerdict
  sideEffectData?: AlternativeComparison
  flaggedDrugName?: string
  flaggedDrugSap?: number
  flaggedTop3?: AdverseEvent[]
}

export function DrugChip({
  label,
  drugName,
  sub,
  accent = 'default',
  showCostDimmed,
  severityVerdict,
  sideEffectData,
  flaggedDrugName,
  flaggedDrugSap,
  flaggedTop3,
}: Props) {
  const display = (drugName ?? label ?? '').trim()
  const [showTip, setShowTip] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openTip = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    showTimer.current = setTimeout(() => setShowTip(true), 200)
  }
  const closeTip = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    hideTimer.current = setTimeout(() => setShowTip(false), 100)
  }

  const canTooltip = Boolean(
    sideEffectData &&
      flaggedDrugName != null &&
      flaggedDrugSap != null &&
      flaggedTop3 != null
  )

  return (
    <span
      className="group inline-flex cursor-default items-center gap-2 rounded-[20px] border border-[var(--gray-200)] bg-white px-4 py-1 text-sm shadow-sm transition-transform duration-200 hover:scale-[1.03] hover:shadow-md"
      style={
        accent === 'perp'
          ? { borderLeftWidth: 4, borderLeftColor: 'var(--insurance-purple)' }
          : undefined
      }
    >
      {display}
      {sub != null && (
        <span
          className={`text-xs text-[var(--gray-800)] transition-opacity group-hover:opacity-100 ${showCostDimmed ? 'opacity-70' : ''}`}
        >
          {sub}
        </span>
      )}
      {severityVerdict && (
        <>
          <span
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: 'var(--gray-200)',
              margin: '0 8px',
            }}
          />
          <div className="relative inline-flex" onMouseEnter={openTip} onMouseLeave={closeTip}>
            <SeverityBadge verdict={severityVerdict} size="sm" />
            {showTip && canTooltip && sideEffectData && flaggedTop3 && (
              <SideEffectTooltip
                flaggedDrugName={flaggedDrugName!}
                flaggedDrugSap={flaggedDrugSap!}
                flaggedTop3={flaggedTop3}
                alternativeComparison={sideEffectData}
              />
            )}
          </div>
        </>
      )}
    </span>
  )
}

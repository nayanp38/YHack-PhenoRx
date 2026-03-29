import type { AdverseEvent, AlternativeComparison } from '../types'
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SeverityBadge } from './SeverityBadge'
import type { SeverityVerdict } from './SeverityBadge'
import { SideEffectTooltip } from './SideEffectTooltip'
import { TierBadge } from './TierBadge'

type Props = {
  /** @deprecated use drugName */
  label?: string
  drugName?: string
  /** Formulary tier when covered (lower = more favorable); shown as a color-coded box */
  formularyTier?: number | null
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
  formularyTier,
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
  const anchorRef = useRef<HTMLDivElement>(null)
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null)

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }

  const openTip = () => {
    cancelHide()
    if (showTimer.current) clearTimeout(showTimer.current)
    showTimer.current = setTimeout(() => setShowTip(true), 200)
  }

  const closeTip = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    hideTimer.current = setTimeout(() => setShowTip(false), 150)
  }

  useLayoutEffect(() => {
    if (!showTip || !anchorRef.current) {
      setTipPos(null)
      return
    }
    const update = () => {
      if (!anchorRef.current) return
      const r = anchorRef.current.getBoundingClientRect()
      const w = 320
      const pad = 8
      let left = r.left
      if (left + w > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - w - pad)
      }
      setTipPos({ top: r.bottom + 6, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [showTip])

  const canTooltip = Boolean(
    sideEffectData && flaggedDrugName != null && flaggedDrugSap != null && flaggedTop3 != null
  )

  const tooltipPortal =
    showTip &&
    canTooltip &&
    sideEffectData &&
    flaggedTop3 &&
    tipPos &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            className="pointer-events-auto fixed z-[10000]"
            style={{ top: tipPos.top, left: tipPos.left }}
            onMouseEnter={cancelHide}
            onMouseLeave={closeTip}
          >
            <SideEffectTooltip
              layout="portal"
              flaggedDrugName={flaggedDrugName!}
              flaggedDrugSap={flaggedDrugSap!}
              flaggedTop3={flaggedTop3}
              alternativeComparison={sideEffectData}
            />
          </div>,
          document.body
        )
      : null

  return (
    <>
      <span
        className="group inline-flex cursor-default items-center gap-2 rounded-[20px] border border-[var(--px-border)] bg-[rgba(255,255,255,0.04)] px-4 py-1 text-sm text-[var(--px-text)] shadow-sm transition-transform duration-200 hover:scale-[1.03] hover:bg-white/[0.06]"
        style={
          accent === 'perp'
            ? { borderLeftWidth: 4, borderLeftColor: 'var(--insurance-purple)' }
            : undefined
        }
      >
        {display}
        {formularyTier != null && <TierBadge tier={formularyTier} />}
        {sub != null && (
          <span
            className={`text-xs text-[var(--px-text-secondary)] transition-opacity group-hover:opacity-100 ${showCostDimmed ? 'opacity-70' : ''}`}
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
                backgroundColor: 'var(--px-border)',
                margin: '0 8px',
              }}
            />
            <div
              ref={anchorRef}
              className="relative inline-flex"
              onMouseEnter={openTip}
              onMouseLeave={closeTip}
            >
              <SeverityBadge verdict={severityVerdict} size="sm" />
            </div>
          </>
        )}
      </span>
      {tooltipPortal}
    </>
  )
}

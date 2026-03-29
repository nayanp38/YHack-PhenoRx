import { HelpCircle, TrendingDown, TrendingUp } from 'lucide-react'
import type { AlternativeComparison } from '../types'

export type SeverityVerdict = AlternativeComparison['severity_verdict']

export interface SeverityBadgeProps {
  verdict: SeverityVerdict
  size?: 'sm' | 'md'
}

const VERDICT_STYLES: Record<
  SeverityVerdict,
  { bg: string; text: string; label: string; Icon: typeof TrendingDown | typeof HelpCircle | null }
> = {
  BETTER: { bg: 'rgba(52,211,153,0.15)', text: '#34d399', label: 'Better Side Effect Profile', Icon: TrendingUp },
  EQUIVALENT: { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.55)', label: 'Similar Side Effect Profile', Icon: null },
  WORSE: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Worse Side Effect Profile', Icon: TrendingDown },
  DATA_UNAVAILABLE: { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.35)', label: 'No Data', Icon: HelpCircle },
}

export function SeverityBadge({ verdict, size = 'md' }: SeverityBadgeProps) {
  const style = VERDICT_STYLES[verdict]
  const isSmall = size === 'sm'
  const padding = isSmall ? '1px 6px' : '2px 8px'
  const fontSize = isSmall ? '10px' : '12px'
  const iconSize = isSmall ? 10 : 14
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        borderRadius: '6px',
        backgroundColor: style.bg,
        color: style.text,
        fontSize,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {style.Icon && <style.Icon size={iconSize} />}
      {style.label}
    </span>
  )
}

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
  BETTER: { bg: '#F0FDF4', text: '#16A34A', label: 'Better Side Effect Profile', Icon: TrendingUp },
  EQUIVALENT: { bg: '#F3F4F6', text: '#6B7280', label: 'Similar Side Effect Profile', Icon: null },
  WORSE: { bg: '#FEF2F2', text: '#DC2626', label: 'Worse Side Effect Profile', Icon: TrendingDown },
  DATA_UNAVAILABLE: { bg: '#F8FAFC', text: '#94A3B8', label: 'No Data', Icon: HelpCircle },
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

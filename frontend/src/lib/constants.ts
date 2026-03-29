/** Max baseline activity used for gauge denominator (spec §4.1). */
export const MAX_ACTIVITY_BY_ENZYME: Record<string, number> = {
  CYP2D6: 2.0,
  CYP2C19: 3.0,
  CYP2C9: 2.0,
  CYP3A4: 2.0,
}

export const MATRIX_ENZYMES = ['CYP2D6', 'CYP2C19', 'CYP2C9', 'CYP3A4'] as const

export const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  info: 4,
}

export const CYP2D6_ALLELES = [
  '*1',
  '*2',
  '*3',
  '*4',
  '*5',
  '*6',
  '*9',
  '*10',
  '*17',
  '*29',
  '*33',
  '*35',
  '*41',
] as const
export const CYP2C19_ALLELES = ['*1', '*2', '*3', '*9', '*17'] as const
export const CYP2C9_ALLELES = ['*1', '*2', '*3'] as const

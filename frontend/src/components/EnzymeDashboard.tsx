import type { EnzymeDashboardRow } from '../types'
import { EnzymeCard } from './EnzymeCard'

type Props = {
  enzymeDashboard: Record<string, EnzymeDashboardRow>
  genotypes: Record<string, string>
}

export function EnzymeDashboard({ enzymeDashboard, genotypes }: Props) {
  const enzymes = Object.keys(enzymeDashboard).sort()

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8">
      <h1 className="mb-8 text-[24px] font-bold text-[var(--navy)]">Enzyme Activity</h1>
      {enzymes.map((enz, i) => (
        <EnzymeCard
          key={enz}
          enzyme={enz}
          index={i}
          row={enzymeDashboard[enz]}
          diplotype={genotypes[enz] || '*1/*1'}
        />
      ))}
    </div>
  )
}

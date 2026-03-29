import type { EnzymeDashboardRow } from '../types'
import { EnzymeCard } from './EnzymeCard'
import { ViewHero } from './ViewHero'

type Props = {
  enzymeDashboard: Record<string, EnzymeDashboardRow>
  genotypes: Record<string, string>
}

export function EnzymeDashboard({ enzymeDashboard, genotypes }: Props) {
  const enzymes = Object.keys(enzymeDashboard).sort()

  return (
    <div className="animate-fade-up">
      <ViewHero
        title="Enzyme Activity"
        subtitle="Phenoconversion analysis across CYP450 enzymes"
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
    </div>
  )
}

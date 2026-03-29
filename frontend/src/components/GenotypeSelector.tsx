import { Dna } from 'lucide-react'
import { useEffect, useState } from 'react'
import { previewGenotype } from '../lib/api'
import { CYP2C19_ALLELES, CYP2C9_ALLELES, CYP2D6_ALLELES } from '../lib/constants'

const GENES: { id: string; alleles: readonly string[] }[] = [
  { id: 'CYP2D6', alleles: CYP2D6_ALLELES },
  { id: 'CYP2C19', alleles: CYP2C19_ALLELES },
  { id: 'CYP2C9', alleles: CYP2C9_ALLELES },
]

function parseDiplotype(d: string): [string, string] {
  const parts = d.split('/').map((x) => x.trim())
  if (parts.length === 2) return [parts[0], parts[1]]
  return ['*1', '*1']
}

type Props = {
  genotypes: Record<string, string>
  onChange: (g: Record<string, string>) => void
}

export function GenotypeSelector({ genotypes, onChange }: Props) {
  const [preview, setPreview] = useState<
    Record<string, { activity_score: number; phenotype: string }>
  >({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, { activity_score: number; phenotype: string }> = {}
      for (const { id } of GENES) {
        const dip = genotypes[id] || '*1/*1'
        const [a1, a2] = parseDiplotype(dip)
        try {
          const r = await previewGenotype(id, a1, a2)
          if (!cancelled) next[id] = { activity_score: r.activity_score, phenotype: r.phenotype }
        } catch {
          if (!cancelled) next[id] = { activity_score: 0, phenotype: '—' }
        }
      }
      if (!cancelled) setPreview(next)
    })()
    return () => {
      cancelled = true
    }
  }, [genotypes])

  return (
    <div className="rounded-xl border border-[var(--gray-200)] bg-white p-6 shadow-[var(--card-shadow)]">
      <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold text-[var(--gray-800)]">
        <Dna className="h-5 w-5 text-[var(--navy)]" aria-hidden />
        Pharmacogenomic Profile
      </h2>
      <div className="space-y-4">
        {GENES.map(({ id, alleles }) => {
          const [a1, a2] = parseDiplotype(genotypes[id] || '*1/*1')
          const pr = preview[id]
          return (
            <div key={id} className="border-b border-[var(--gray-100)] pb-4 last:border-0">
              <div className="mb-2 text-sm font-medium text-[var(--gray-800)]">{id}</div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-[var(--gray-500)]">
                  Allele 1
                  <select
                    className="ml-1 rounded-lg border border-[var(--gray-200)] px-2 py-1.5 text-sm"
                    value={a1}
                    onChange={(e) => {
                      const v = e.target.value
                      onChange({ ...genotypes, [id]: `${v}/${a2}` })
                    }}
                  >
                    {alleles.map((al) => (
                      <option key={al} value={al}>
                        {al}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[var(--gray-500)]">
                  Allele 2
                  <select
                    className="ml-1 rounded-lg border border-[var(--gray-200)] px-2 py-1.5 text-sm"
                    value={a2}
                    onChange={(e) => {
                      const v = e.target.value
                      onChange({ ...genotypes, [id]: `${a1}/${v}` })
                    }}
                  >
                    {alleles.map((al) => (
                      <option key={al} value={al}>
                        {al}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {pr && (
                <p className="mt-2 text-xs text-[var(--gray-500)]">
                  Activity: {pr.activity_score} | {pr.phenotype}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

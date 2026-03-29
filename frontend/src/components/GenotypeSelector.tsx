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

const selectClass =
  'ml-1 rounded border border-[var(--px-border)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-sm text-[var(--px-text)] outline-none focus:border-[var(--px-border-active)]'

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
    <div
      className="rounded-xl border p-6"
      style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
    >
      <div className="mb-5 flex items-center gap-2">
        <Dna size={16} color="var(--px-accent)" aria-hidden />
        <h3 className="font-display text-[18px] font-medium text-[var(--px-text)]">Genotype Panel</h3>
      </div>
      <div className="space-y-3">
        {GENES.map(({ id, alleles }) => {
          const [a1, a2] = parseDiplotype(genotypes[id] || '*1/*1')
          const pr = preview[id]
          return (
            <div
              key={id}
              className="rounded-lg border px-3.5 py-3"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'var(--px-border)',
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[14px] font-medium text-[var(--px-text)]">{id}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-[var(--px-text-secondary)]">
                    Allele 1
                    <select
                      className={selectClass}
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
                  <label className="text-xs text-[var(--px-text-secondary)]">
                    Allele 2
                    <select
                      className={selectClass}
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
              </div>
              {pr && (
                <p className="mt-2 text-[11px] text-[var(--px-text-tertiary)]">
                  Activity: {pr.activity_score} | {pr.phenotype}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <div
        className="mt-5 rounded-lg border border-dashed px-3 py-3 text-center text-[11px] text-[var(--px-text-tertiary)]"
        style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.02)' }}
      >
        Allele data sourced from CPIC allele function tables
      </div>
    </div>
  )
}

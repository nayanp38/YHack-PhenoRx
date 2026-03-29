import { AlertTriangle, CheckCircle, Dna, Loader2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { previewGenotype, uploadGenotype } from '../lib/api'
import type { GenotypeUploadResult } from '../lib/api'
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

const MAX_FILE_SIZE = 10 * 1024 * 1024

type Props = {
  genotypes: Record<string, string>
  onChange: (g: Record<string, string>) => void
}

export function GenotypeSelector({ genotypes, onChange }: Props) {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<GenotypeUploadResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<
    Record<string, { activity_score: number; phenotype: string }>
  >({})

  useEffect(() => {
    if (mode !== 'manual') return
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
  }, [genotypes, mode])

  const handleFileUpload = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File exceeds 10MB limit.')
      return
    }
    setUploadError(null)
    setUploadLoading(true)
    try {
      const result = await uploadGenotype(file)
      if (result.error) {
        setUploadError(result.error)
        return
      }
      setUploadResult(result)
      onChange(result.genotypes)
    } catch {
      setUploadError('Failed to process genotype file.')
    } finally {
      setUploadLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clearUpload = () => {
    setUploadResult(null)
    setUploadError(null)
  }

  return (
    <div
      className="rounded-xl border p-6"
      style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
    >
      <div className="mb-5 flex items-center gap-2">
        <Dna size={16} color="var(--px-accent)" aria-hidden />
        <h3 className="font-display text-[18px] font-medium text-[var(--px-text)]">Genotype Panel</h3>
      </div>

      {mode === 'upload' ? (
        <>
          {uploadResult ? (
            /* ---- Upload result display ---- */
            <div className="space-y-2">
              {uploadResult.details.map((d) => (
                <div
                  key={d.gene}
                  className="rounded-lg border px-3.5 py-3"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--px-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium text-[var(--px-text)]">{d.gene}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[14px]"
                        style={{ color: 'var(--px-accent)' }}
                      >
                        {d.diplotype}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background:
                            d.confidence === 'high'
                              ? 'rgba(52,211,153,0.15)'
                              : 'rgba(251,191,36,0.15)',
                          color: d.confidence === 'high' ? '#34d399' : '#fbbf24',
                        }}
                      >
                        {d.confidence}
                      </span>
                    </div>
                  </div>
                  {d.computed_phenotype && (
                    <p className="mt-1 text-[11px] text-[var(--px-text-tertiary)]">
                      {d.computed_phenotype}
                    </p>
                  )}
                  {d.validation_warning && (
                    <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: '#fbbf24' }}>
                      <AlertTriangle size={11} /> {d.validation_warning}
                    </p>
                  )}
                </div>
              ))}

              {/* Show genes that defaulted to *1/*1 (not in details) */}
              {GENES.filter((g) => !uploadResult.details.some((d) => d.gene === g.id)).map((g) => (
                <div
                  key={g.id}
                  className="rounded-lg border px-3.5 py-3"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--px-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium text-[var(--px-text)]">{g.id}</span>
                    <span className="font-mono text-[14px] text-[var(--px-text-tertiary)]">*1/*1</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--px-text-tertiary)]">
                    Not found in file — defaulted to wild-type
                  </p>
                </div>
              ))}

              {uploadResult.warnings.length > 0 && (
                <div
                  className="rounded-lg border px-3 py-2 text-[11px]"
                  style={{ borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}
                >
                  {uploadResult.warnings.map((w, i) => (
                    <p key={i} className="flex items-start gap-1">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1 text-[11px]" style={{ color: '#34d399' }}>
                  <CheckCircle size={12} />
                  Parsed from {uploadResult.source_type.toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={clearUpload}
                  className="flex items-center gap-1 text-[11px] text-[var(--px-text-tertiary)] underline hover:text-[var(--px-text-secondary)]"
                >
                  <X size={11} /> Clear & re-upload
                </button>
              </div>
            </div>
          ) : (
            /* ---- Upload drop zone ---- */
            <div
              className="flex flex-col items-center rounded-lg border border-dashed p-6 text-center transition hover:border-[var(--px-border-active)]"
              style={{ borderColor: 'var(--px-border)' }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const f = e.dataTransfer.files[0]
                if (f) handleFileUpload(f)
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".vcf,.vcf.gz,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileUpload(f)
                }}
              />
              {uploadLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--px-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Extracting genotypes...
                </div>
              ) : (
                <>
                  <Upload className="mb-1 h-6 w-6 text-[var(--px-text-tertiary)]" />
                  <p className="text-sm text-[var(--px-text-secondary)]">
                    Drag & drop or{' '}
                    <button
                      type="button"
                      className="font-medium text-[var(--px-accent)] underline"
                      onClick={() => fileRef.current?.click()}
                    >
                      browse
                    </button>{' '}
                    a VCF file or PGx lab report PDF
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--px-text-tertiary)]">
                    Supports .vcf, .vcf.gz, and .pdf up to 10MB
                  </p>
                </>
              )}
              {uploadError && <p className="mt-2 text-xs text-[var(--px-critical)]">{uploadError}</p>}
            </div>
          )}

          <button
            type="button"
            onClick={() => setMode('manual')}
            className="mt-3 block w-full text-center text-[11px] text-[var(--px-text-tertiary)] underline hover:text-[var(--px-text-secondary)]"
          >
            Switch to manual entry
          </button>
        </>
      ) : (
        /* ---- Manual dropdown mode ---- */
        <>
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

          <button
            type="button"
            onClick={() => setMode('upload')}
            className="mt-3 block w-full text-center text-[11px] text-[var(--px-text-tertiary)] underline hover:text-[var(--px-text-secondary)]"
          >
            Switch to file upload
          </button>
        </>
      )}

      <div
        className="mt-5 rounded-lg border border-dashed px-3 py-3 text-center text-[11px] text-[var(--px-text-tertiary)]"
        style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.02)' }}
      >
        Allele data sourced from CPIC allele function tables
      </div>
    </div>
  )
}

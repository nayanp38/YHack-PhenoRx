import { ChevronRight, FlaskConical, Loader2, Pill, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fetchDrugList, ocrMedications } from '../lib/api'
import type { InsurancePlan, MedicationInput } from '../types'
import { GenotypeSelector } from './GenotypeSelector'
import { InsurancePlanSelector } from './InsurancePlanSelector'
import { MedicationRow } from './MedicationRow'
import { ViewHero } from './ViewHero'

export type IntakePayload = {
  patient_id: string
  genotypes: Record<string, string>
  medications: Array<{ drug_name: string; dosage?: string; indication?: string }>
  plan: InsurancePlan | null
}

const inputClass =
  'w-full rounded-lg border border-[var(--px-border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-[var(--px-text)] placeholder:text-[var(--px-text-tertiary)] outline-none focus:border-[var(--px-border-active)]'

type Props = {
  patientId: string
  genotypes: Record<string, string>
  medications: MedicationInput[]
  plan: InsurancePlan | null
  isLoading: boolean
  onPatientIdChange: (id: string) => void
  onGenotypesChange: (g: Record<string, string>) => void
  onMedicationsChange: (m: MedicationInput[]) => void
  onPlanChange: (p: InsurancePlan | null) => void
  onAnalyze: (payload: IntakePayload) => void
}

export function PatientIntake({
  patientId,
  genotypes,
  medications,
  plan,
  isLoading,
  onPatientIdChange,
  onGenotypesChange,
  onMedicationsChange,
  onPlanChange,
  onAnalyze,
}: Props) {
  const [drugNames, setDrugNames] = useState<string[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDrugList()
      .then(setDrugNames)
      .catch(() => setDrugNames([]))
  }, [])

  const handleFileUpload = async (file: File) => {
    setOcrError(null)
    setOcrLoading(true)
    try {
      const result = await ocrMedications(file)
      if (result.error) {
        setOcrError(result.error)
        return
      }
      if (result.medications.length === 0) {
        setOcrError('No medications found in the uploaded file.')
        return
      }
      const newMeds = result.medications.map((m) => ({ drug_name: m.drug_name, dosage: m.dosage || '', indication: m.indication || '' }))
      onMedicationsChange([
        ...medications.filter((m) => m.drug_name.trim()),
        ...newMeds,
      ])
    } catch {
      setOcrError('Failed to process file. Please try again.')
    } finally {
      setOcrLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const run = () => {
    const meds = medications
      .filter((m) => m.drug_name.trim())
      .map((m) => ({
        drug_name: m.drug_name.trim().toLowerCase(),
        ...(m.dosage.trim() ? { dosage: m.dosage.trim() } : {}),
        ...(m.indication.trim() ? { indication: m.indication.trim() } : {}),
      }))
    onAnalyze({
      patient_id: patientId,
      genotypes,
      medications: meds,
      plan,
    })
  }

  const filledMeds = medications.filter((m) => m.drug_name.trim())
  const initial = patientId.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="animate-fade-up">
      <ViewHero
        title="Patient Profile"
        subtitle="Enter medications and genotype data, or load a demo patient"
      />

      <div
        className="mb-8 flex items-center gap-4 rounded-[10px] border px-5 py-4"
        style={{
          background: 'var(--px-accent-dim)',
          borderColor: 'rgba(52,211,153,0.13)',
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[18px]"
          style={{
            background: 'var(--px-accent-dim)',
            borderColor: 'rgba(52,211,153,0.2)',
            color: 'var(--px-accent)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--px-text-tertiary)]">
              Patient ID
            </span>
            <input className={`mt-1 ${inputClass} max-w-md`} value={patientId} onChange={(e) => onPatientIdChange(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-6">
        <div
          className="rounded-xl border p-6"
          style={{ background: 'var(--px-bg-card)', borderColor: 'var(--px-border)' }}
        >
          <div className="mb-5 flex items-center gap-2">
            <Pill size={16} color="var(--px-accent)" aria-hidden />
            <h3 className="font-display text-[18px] font-medium text-[var(--px-text)]">Medications</h3>
            <span className="ml-auto text-[11px] text-[var(--px-text-tertiary)]">
              {filledMeds.length} drugs
            </span>
          </div>

          <div
            className="mb-4 flex flex-col items-center rounded-lg border border-dashed p-4 text-center transition hover:border-[var(--px-border-active)]"
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
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(f)
              }}
            />
            {ocrLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--px-text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Extracting medications...
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
                  a photo/PDF of a handwritten medication list
                </p>
              </>
            )}
            {ocrError && <p className="mt-1 text-xs text-[var(--px-critical)]">{ocrError}</p>}
          </div>

          {medications.map((med, i) => (
            <MedicationRow
              key={i}
              index={i}
              med={med}
              drugNames={drugNames}
              onChange={(idx, m) => {
                const copy = [...medications]
                copy[idx] = m
                onMedicationsChange(copy)
              }}
              onRemove={(idx) => {
                onMedicationsChange(medications.filter((_, j) => j !== idx))
              }}
            />
          ))}
          <button
            type="button"
            className="mt-1 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-white/[0.04]"
            style={{ borderColor: 'var(--px-accent)', color: 'var(--px-accent)' }}
            onClick={() =>
              onMedicationsChange([
                ...medications,
                { drug_name: '', dose_mg: '', indication: '' },
              ])
            }
          >
            + Add Medication
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <GenotypeSelector genotypes={genotypes} onChange={onGenotypesChange} />
          <InsurancePlanSelector value={plan} onChange={onPlanChange} />
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          disabled={isLoading}
          onClick={run}
          className="flex items-center gap-2 rounded-[10px] border-none px-12 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
          style={{
            background: isLoading
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, var(--px-accent), #10b981)',
            color: isLoading ? 'var(--px-text-tertiary)' : 'var(--px-bg)',
            boxShadow: isLoading ? 'none' : '0 0 30px rgba(52,211,153,0.2)',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <FlaskConical size={16} />
              Analyze Discharge
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

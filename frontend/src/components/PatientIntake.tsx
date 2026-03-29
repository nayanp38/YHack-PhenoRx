import { Loader2, Pill } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchDrugList } from '../lib/api'
import type { InsurancePlan, MedicationInput } from '../types'
import { GenotypeSelector } from './GenotypeSelector'
import { InsurancePlanSelector } from './InsurancePlanSelector'
import { MedicationRow } from './MedicationRow'

export type IntakePayload = {
  patient_id: string
  genotypes: Record<string, string>
  medications: Array<{ drug_name: string; dose_mg?: number; indication?: string }>
  plan: InsurancePlan | null
}

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

  useEffect(() => {
    fetchDrugList()
      .then(setDrugNames)
      .catch(() => setDrugNames([]))
  }, [])

  const run = () => {
    const meds = medications
      .filter((m) => m.drug_name.trim())
      .map((m) => ({
        drug_name: m.drug_name.trim().toLowerCase(),
        ...(m.dose_mg !== '' ? { dose_mg: Number(m.dose_mg) } : {}),
        ...(m.indication.trim() ? { indication: m.indication.trim() } : {}),
      }))
    onAnalyze({
      patient_id: patientId,
      genotypes,
      medications: meds,
      plan,
    })
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8">
      <h1 className="mb-8 text-[32px] font-extrabold text-[var(--navy)]">Patient Intake</h1>
      <div
        className="rounded-xl border border-[var(--gray-200)] bg-white p-6 shadow-[var(--card-shadow)] md:p-8"
        style={{ padding: 24 }}
      >
        <label className="mb-4 block">
          <span className="text-xs font-medium text-[var(--gray-500)]">Patient ID</span>
          <input
            className="mt-1 w-full max-w-md rounded-lg border border-[var(--gray-200)] px-3 py-2 text-sm"
            value={patientId}
            onChange={(e) => onPatientIdChange(e.target.value)}
          />
        </label>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold text-[var(--gray-800)]">
              <Pill className="h-5 w-5 text-[var(--navy)]" aria-hidden />
              Medications
            </h2>
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
              className="rounded-lg border-2 border-[var(--navy)] px-4 py-2 text-sm font-medium text-[var(--navy)]"
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

          <div className="flex flex-col gap-4">
            <GenotypeSelector genotypes={genotypes} onChange={onGenotypesChange} />
            <InsurancePlanSelector value={plan} onChange={onPlanChange} />
          </div>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={run}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[16px] font-bold text-white transition hover:opacity-95 disabled:opacity-70"
          style={{
            background: 'var(--navy)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.background = 'var(--accent-blue)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--navy)'
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing…
            </>
          ) : (
            'Analyze Discharge'
          )}
        </button>
      </div>
    </div>
  )
}

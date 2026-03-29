import type {
  ActiveView,
  ClinicianSummary,
  DrugProfile,
  HelpChatReply,
  InsurancePlan,
  InsuranceScreeningResult,
  PipelineResult,
} from '../types'

export type ScreenInsurancePayload = {
  patient_id?: string
  genotypes: Record<string, string>
  medications: Array<{ drug_name: string; dose_mg?: number; dosage?: string; indication?: string }>
  plan: InsurancePlan
  pipeline_result: PipelineResult
}

const json = (r: Response) => {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export async function analyzePatient(payload: {
  patient_id?: string
  genotypes: Record<string, string>
  medications: Array<{ drug_name: string; dose_mg?: number; dosage?: string; indication?: string }>
}): Promise<PipelineResult> {
  return json(
    await fetch('/api/v1/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  )
}

export async function screenInsurance(
  payload: ScreenInsurancePayload
): Promise<InsuranceScreeningResult> {
  return json(
    await fetch('/api/v1/insurance/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: payload.patient_id,
        genotypes: payload.genotypes,
        medications: payload.medications,
        plan: payload.plan,
        pipeline_result: payload.pipeline_result,
      }),
    })
  )
}

export async function fetchSummary(
  pipelineResult: PipelineResult,
  drugProfiles?: DrugProfile[]
): Promise<string> {
  const data = await json(
    await fetch('/api/v1/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipeline_result: pipelineResult,
        ...(drugProfiles && drugProfiles.length > 0 ? { drug_profiles: drugProfiles } : {}),
      }),
    })
  )
  return data.summary as string
}

export async function fetchDrugProfiles(
  drugs: string[],
  plan: InsurancePlan | null
): Promise<DrugProfile[]> {
  const body: Record<string, unknown> = { drugs }
  if (plan) {
    body.insurance_plan = plan
  }
  const data = await json(
    await fetch('/api/v1/drug-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  return data.drug_profiles as DrugProfile[]
}

export async function fetchClinicianSummary(payload: {
  patient_id?: string
  patient_name: string
  pipeline_result: PipelineResult
  insurance_plan?: InsurancePlan | null
  drug_profiles?: DrugProfile[]
}): Promise<ClinicianSummary> {
  return json(
    await fetch('/api/v1/clinician-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: payload.patient_id,
        patient_name: payload.patient_name,
        pipeline_result: payload.pipeline_result,
        insurance_plan: payload.insurance_plan ?? undefined,
        drug_profiles: payload.drug_profiles,
      }),
    })
  ) as Promise<ClinicianSummary>
}

export interface GenotypeUploadDetail {
  gene: string
  diplotype: string
  source: string
  confidence: string
  reported_phenotype: string | null
  computed_phenotype: string | null
  validation_warning: string | null
}

export interface GenotypeUploadResult {
  genotypes: Record<string, string>
  details: GenotypeUploadDetail[]
  source_type: string
  warnings: string[]
  error?: string
}

export async function uploadGenotype(file: File): Promise<GenotypeUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const data = await json(
    await fetch('/api/v1/genotype/upload', { method: 'POST', body: form })
  )
  return data as GenotypeUploadResult
}

export async function previewGenotype(enzyme: string, allele1: string, allele2: string) {
  return json(
    await fetch('/api/v1/genotype/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enzyme, allele1, allele2 }),
    })
  ) as Promise<{ activity_score: number; phenotype: string; diplotype: string }>
}

export async function fetchDrugList(): Promise<string[]> {
  const data = await json(await fetch('/api/v1/meta/drugs'))
  return data.drugs as string[]
}

export async function fetchPlans(): Promise<InsurancePlan[]> {
  const data = await json(await fetch('/api/v1/meta/plans'))
  return data.plans as InsurancePlan[]
}

export type OcrMedication = { drug_name: string; dosage: string; indication: string }

export async function ocrMedications(file: File): Promise<{ medications: OcrMedication[]; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  const data = await json(
    await fetch('/api/v1/ocr/medications', { method: 'POST', body: form })
  )
  return { medications: data.medications as OcrMedication[], error: data.error as string | undefined }
}

export async function askHelpChat(page: ActiveView, question: string): Promise<HelpChatReply> {
  return json(
    await fetch('/api/v1/help-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, question }),
    })
  )
}

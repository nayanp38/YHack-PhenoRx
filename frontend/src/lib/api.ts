import type {
  ActiveView,
  HelpChatReply,
  InsurancePlan,
  InsuranceScreeningResult,
  PipelineResult,
} from '../types'

export type ScreenInsurancePayload = {
  patient_id?: string
  genotypes: Record<string, string>
  medications: Array<{ drug_name: string; dose_mg?: number; indication?: string }>
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
  medications: Array<{ drug_name: string; dose_mg?: number; indication?: string }>
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

export async function fetchSummary(pipelineResult: PipelineResult): Promise<string> {
  const data = await json(
    await fetch('/api/v1/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_result: pipelineResult }),
    })
  )
  return data.summary as string
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

export async function ocrMedications(file: File): Promise<string[]> {
  const form = new FormData()
  form.append('file', file)
  const data = await json(
    await fetch('/api/v1/ocr/medications', { method: 'POST', body: form })
  )
  return data.medications as string[]
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

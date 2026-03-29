import { useCallback, useEffect, useState } from 'react'
import {
  analyzePatient,
  fetchPlans,
  fetchSummary,
  screenInsurance,
} from './lib/api'
import type {
  ActiveView,
  DemoPatient,
  InsurancePlan,
  InsuranceScreeningResult,
  MedicationInput,
  PipelineResult,
} from './types'
import { LoadingSpinner } from './components/LoadingSpinner'
import { NavBar } from './components/NavBar'
import { PatientIntake, type IntakePayload } from './components/PatientIntake'
import { EnzymeDashboard } from './components/EnzymeDashboard'
import { RiskReport } from './components/RiskReport'
import { DrugMatrix } from './components/DrugMatrix'
import { DischargeSummary } from './components/DischargeSummary'
import { ViewStepper } from './components/ViewStepper'

const VIEW_ORDER: ActiveView[] = ['intake', 'enzyme', 'risk', 'matrix', 'summary']

function buildGenotypes(g: Record<string, string>): Record<string, string> {
  return {
    CYP2D6: g.CYP2D6 || '*1/*1',
    CYP2C19: g.CYP2C19 || '*1/*1',
    CYP2C9: g.CYP2C9 || '*1/*1',
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('intake')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  const [patientId, setPatientId] = useState('DEMO')
  const [genotypes, setGenotypes] = useState<Record<string, string>>({
    CYP2D6: '*1/*1',
    CYP2C19: '*1/*1',
    CYP2C9: '*1/*1',
  })
  const [medications, setMedications] = useState<MedicationInput[]>([
    { drug_name: '', dosage: '', indication: '' },
  ])
  const [plan, setPlan] = useState<InsurancePlan | null>(null)

  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [insuranceResult, setInsuranceResult] = useState<InsuranceScreeningResult | null>(null)
  const [summaryText, setSummaryText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const runAnalyze = useCallback(async (payload: IntakePayload) => {
    setIsLoading(true)
    try {
      const meds = payload.medications.map((m) => ({
        drug_name: m.drug_name,
        ...(m.dosage ? { dosage: m.dosage } : {}),
        ...(m.indication ? { indication: m.indication } : {}),
      }))
      const gen = buildGenotypes(payload.genotypes)

      const pipeline = await analyzePatient({
        patient_id: payload.patient_id,
        genotypes: gen,
        medications: meds,
      })
      setPipelineResult(pipeline)
      setHasAnalyzed(true)
      setActiveView('enzyme')

      const [ins, summary] = await Promise.all([
        payload.plan != null
          ? screenInsurance({
              patient_id: payload.patient_id,
              genotypes: gen,
              medications: meds,
              plan: payload.plan,
              pipeline_result: pipeline,
            })
          : Promise.resolve(null),
        fetchSummary(pipeline),
      ])
      setInsuranceResult(ins)
      setSummaryText(summary)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleDemoPatient = useCallback(
    async (p: DemoPatient) => {
      setPatientId(p.patient_id)
      setGenotypes({
        CYP2D6: p.genotypes.CYP2D6 ?? '*1/*1',
        CYP2C19: p.genotypes.CYP2C19 ?? '*1/*1',
        CYP2C9: p.genotypes.CYP2C9 ?? '*1/*1',
      })
      setMedications(
        p.medications.map((m) => ({
          drug_name: m.drug_name,
          dosage: m.dose_mg != null ? String(m.dose_mg) : '',
          indication: m.indication ?? '',
        }))
      )
      let matched: InsurancePlan | null = null
      try {
        const plans = await fetchPlans()
        if (p.insurance) {
          matched =
            plans.find((pl) => `${pl.contractId}-${pl.planId}` === p.insurance!.plan_id) ?? null
        }
      } catch {
        matched = null
      }
      setPlan(matched)
      const meds = p.medications
        .filter((m) => m.drug_name.trim())
        .map((m) => ({
          drug_name: m.drug_name.trim().toLowerCase(),
          ...(m.dose_mg != null ? { dosage: String(m.dose_mg) } : {}),
          ...(m.indication?.trim() ? { indication: m.indication.trim() } : {}),
        }))
      await runAnalyze({
        patient_id: p.patient_id,
        genotypes: {
          CYP2D6: p.genotypes.CYP2D6 ?? '*1/*1',
          CYP2C19: p.genotypes.CYP2C19 ?? '*1/*1',
          CYP2C9: p.genotypes.CYP2C9 ?? '*1/*1',
        },
        medications: meds,
        plan: matched,
      })
    },
    [runAnalyze]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (!hasAnalyzed) return
      const i = VIEW_ORDER.indexOf(activeView)
      if (e.key === 'ArrowRight' && i < VIEW_ORDER.length - 1) {
        setActiveView(VIEW_ORDER[i + 1])
      }
      if (e.key === 'ArrowLeft' && i > 0) {
        setActiveView(VIEW_ORDER[i - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeView, hasAnalyzed])

  const activeIndex = VIEW_ORDER.indexOf(activeView)
  const canGoBack = hasAnalyzed && activeIndex > 0
  const canGoNext = hasAnalyzed && activeIndex >= 0 && activeIndex < VIEW_ORDER.length - 1

  const goBack = useCallback(() => {
    if (!canGoBack) return
    setActiveView(VIEW_ORDER[activeIndex - 1])
  }, [activeIndex, canGoBack])

  const goNext = useCallback(() => {
    if (!canGoNext) return
    setActiveView(VIEW_ORDER[activeIndex + 1])
  }, [activeIndex, canGoNext])

  return (
    <div className="min-h-screen bg-[var(--gray-50)] pb-8 pt-[7.5rem]">
      <NavBar onLoadDemo={handleDemoPatient} />
      <ViewStepper
        active={activeView}
        hasAnalyzed={hasAnalyzed}
        onSelect={(v) => setActiveView(v)}
      />

      {isLoading && <LoadingSpinner label="Analyzing…" />}

      {activeView === 'intake' && (
        <PatientIntake
          patientId={patientId}
          genotypes={genotypes}
          medications={medications}
          plan={plan}
          isLoading={isLoading}
          onPatientIdChange={setPatientId}
          onGenotypesChange={setGenotypes}
          onMedicationsChange={setMedications}
          onPlanChange={setPlan}
          onAnalyze={runAnalyze}
        />
      )}

      {activeView === 'enzyme' && pipelineResult && (
        <EnzymeDashboard
          enzymeDashboard={pipelineResult.enzyme_dashboard}
          genotypes={buildGenotypes(genotypes)}
        />
      )}

      {activeView === 'risk' && pipelineResult && (
        <RiskReport pipeline={pipelineResult} insurance={insuranceResult} />
      )}

      {activeView === 'matrix' && pipelineResult && (
        <DrugMatrix
          drugMatrix={pipelineResult.drug_matrix}
          interactions={pipelineResult.interactions}
        />
      )}

      {activeView === 'summary' && pipelineResult && (
        <DischargeSummary
          patientId={patientId}
          summaryText={summaryText}
          insurance={insuranceResult}
          pipeline={pipelineResult}
        />
      )}

      {hasAnalyzed && (
        <div className="mx-auto mt-6 flex max-w-[1280px] items-center justify-between px-4">
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            className="rounded-full border border-[var(--gray-200)] bg-white px-5 py-2 text-sm font-semibold text-[var(--navy)] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="rounded-full bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {activeView === 'matrix' ? 'Go to Summary' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}

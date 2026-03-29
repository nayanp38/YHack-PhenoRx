import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  analyzePatient,
  fetchClinicianSummary,
  fetchDrugProfiles,
  fetchPlans,
  fetchSummary,
  screenInsurance,
} from './lib/api'
import type {
  ActiveView,
  ClinicianSummary,
  DemoPatient,
  DrugProfile,
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
import { DischargeSummary } from './components/DischargeSummary'
import { ViewStepper } from './components/ViewStepper'
import { HelpChat } from './components/HelpChat'

const VIEW_ORDER: ActiveView[] = ['intake', 'enzyme', 'risk', 'summary']

function buildGenotypes(g: Record<string, string>): Record<string, string> {
  return {
    CYP2D6: g.CYP2D6 || '*1/*1',
    CYP2C19: g.CYP2C19 || '*1/*1',
    CYP2C9: g.CYP2C9 || '*1/*1',
  }
}

function safeDrugNames(
  medications: Array<{ drug_name: string }>,
  pipeline: PipelineResult
): string[] {
  const names = medications.map((m) => m.drug_name.trim()).filter(Boolean)
  const inter = pipeline.interactions || []
  return names.filter(
    (name) => !inter.some((i) => i.drug_name.toLowerCase() === name.toLowerCase())
  )
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('intake')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [genotypeDefaultMode, setGenotypeDefaultMode] = useState<'upload' | 'manual' | undefined>(undefined)

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
  const [drugProfiles, setDrugProfiles] = useState<DrugProfile[]>([])
  const [clinicianSummary, setClinicianSummary] = useState<ClinicianSummary | null>(null)
  const [patientHandoutText, setPatientHandoutText] = useState<string | null>(null)
  const [patientHandoutLoading, setPatientHandoutLoading] = useState(false)
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
        plan: payload.plan,
      })
      setPipelineResult(pipeline)
      setHasAnalyzed(true)
      setActiveView('risk')

      const safe = safeDrugNames(meds, pipeline)

      const [ins, profiles] = await Promise.all([
        payload.plan != null
          ? screenInsurance({
              patient_id: payload.patient_id,
              genotypes: gen,
              medications: meds,
              plan: payload.plan,
              pipeline_result: pipeline,
            })
          : Promise.resolve(null),
        safe.length > 0
          ? fetchDrugProfiles(safe, payload.plan ?? null)
          : Promise.resolve([]),
      ])
      setInsuranceResult(ins)
      setDrugProfiles(profiles)

      const clinician = await fetchClinicianSummary({
        patient_id: payload.patient_id,
        patient_name: payload.patient_id || 'Patient',
        pipeline_result: pipeline,
        insurance_plan: payload.plan ?? null,
        drug_profiles: profiles,
      })
      setClinicianSummary(clinician)
      setPatientHandoutText(null)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleRequestPatientHandout = useCallback(async () => {
    if (!pipelineResult) return
    setPatientHandoutLoading(true)
    try {
      const t = await fetchSummary(pipelineResult, drugProfiles)
      setPatientHandoutText(t)
    } catch (e) {
      console.error(e)
    } finally {
      setPatientHandoutLoading(false)
    }
  }, [pipelineResult, drugProfiles])

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
      setGenotypeDefaultMode('manual')
      setActiveView('intake')
    },
    []
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

  const showFooterNav = hasAnalyzed && activeView !== 'intake'

  return (
    <div className="phenorx-app min-h-screen bg-[var(--px-bg)] pb-8 font-sans text-[var(--px-text)]">
      <NavBar onLoadDemo={handleDemoPatient} />
      <ViewStepper
        active={activeView}
        hasAnalyzed={hasAnalyzed}
        onSelect={(v) => setActiveView(v)}
      />

      {isLoading && <LoadingSpinner />}

      <main
        className="mx-auto max-w-[960px] px-8 pb-16 pt-[140px]"
        style={{ paddingBottom: showFooterNav ? '5.5rem' : undefined }}
      >
        {activeView === 'intake' && (
          <PatientIntake
            patientId={patientId}
            genotypes={genotypes}
            medications={medications}
            plan={plan}
            isLoading={isLoading}
            genotypeDefaultMode={genotypeDefaultMode}
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
          <RiskReport
            pipeline={pipelineResult}
            insurance={insuranceResult}
            drugProfiles={drugProfiles}
            medications={medications}
          />
        )}

        {activeView === 'summary' && pipelineResult && (
          <DischargeSummary
            patientId={patientId}
            clinicianSummary={clinicianSummary}
            insurance={insuranceResult}
            pipeline={pipelineResult}
            onRequestPatientHandout={handleRequestPatientHandout}
            patientHandoutText={patientHandoutText}
            patientHandoutLoading={patientHandoutLoading}
          />
        )}
      </main>

      {showFooterNav && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[99] flex items-center justify-between border-t px-8 py-3"
          style={{
            background: 'rgba(10,10,11,0.85)',
            backdropFilter: 'blur(16px)',
            borderColor: 'var(--px-border)',
          }}
        >
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium transition hover:brightness-110 disabled:cursor-not-allowed"
            style={{
              borderColor: 'var(--px-border)',
              background: 'transparent',
              color: 'var(--px-text-secondary)',
              opacity: canGoBack ? 1 : 0.3,
            }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-[11px] text-[var(--px-text-tertiary)]">
            Use arrow keys to navigate
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed"
            style={{
              background: canGoNext ? 'var(--px-accent)' : 'rgba(255,255,255,0.06)',
              color: canGoNext ? 'var(--px-bg)' : 'var(--px-text-tertiary)',
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {activeView === 'intake' && <HelpChat page={activeView} />}
    </div>
  )
}

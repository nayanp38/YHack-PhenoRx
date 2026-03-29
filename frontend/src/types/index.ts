/** CYPher dashboard types (aligned with API + technical spec §9). */

export type ActiveView = 'intake' | 'enzyme' | 'risk' | 'summary'

export interface HelpChatReply {
  page: ActiveView
  answer: string
  suggested_questions: string[]
}

export interface EnzymeBaseline {
  enzyme_name: string
  activity_score: number
  phenotype: string
  diplotype: string
}

export interface EnzymeDashboardRow {
  baseline_activity_score: number
  baseline_phenotype: string
  effective_activity_score: number
  effective_phenotype: string
  dominant_perpetrator_drug: string | null
  perpetrator_strength: string | null
  delta: number
}

export interface DrugClassificationCell {
  role: string
  strength: string | null
  inhibitor_strength: string | null
  inducer_strength: string | null
  substrate_sensitivity: string | null
  substrate_type: string | null
  fm_cyp: number | null
  aucr_strong_inhibitor: number | null
  therapeutic_window: string | null
  data_source: string | null
  alternative_drugs: string[]
  evidence_sources: string[]
}

export interface RankedAlternative {
  drug_name: string
  affordability_rank: number
  covered: boolean
  tier: number | null
  tier_label: string | null
  prior_auth_required: boolean
}

export interface AffordabilityResult {
  interaction_drug: string
  enzyme_name: string
  risk_level: string
  ranked_alternatives: RankedAlternative[]
}

export interface InteractionResult {
  drug_name: string
  enzyme_name: string
  baseline_phenotype: string
  effective_phenotype: string
  predicted_aucr: number
  exposure_classification: string
  clinical_consequence: string
  risk_level: 'critical' | 'high' | 'moderate' | 'low' | 'info' | string
  perpetrator_drug: string | null
  perpetrator_strength: string | null
  alternative_drugs: string[]
  perpetrator_alternatives: string[]
  perpetrator_alternative_note: string | null
  evidence_sources: string[]
  baseline_activity_score?: number
  effective_activity_score?: number
  side_effect_comparison?: SideEffectComparison
}

export interface PipelineMeta {
  side_effect_profiles_path?: string
  side_effect_profiles_loaded?: boolean
  /** SAP scale: |Δ| above this yields BETTER/WORSE (v3 default 0.5). */
  sap_verdict_threshold?: number
  side_effect_model?: string
}

export interface PipelineResult {
  patient_id?: string | null
  enzyme_dashboard: Record<string, EnzymeDashboardRow>
  drug_matrix: Record<string, Record<string, DrugClassificationCell>>
  interactions: InteractionResult[]
  affordability: AffordabilityResult[]
  meta?: PipelineMeta
}

export interface InsurancePlan {
  contractId: string
  planId: string
  planName: string
  planType: string
}

export interface DrugCoverage {
  drugName: string
  ndc: string
  covered: boolean
  tierLevel: number | null
  tierName: string | null
  copayPreferred: number | null
  coinsurancePreferred: number | null
  priorAuthRequired: boolean
  stepTherapyRequired: boolean
  quantityLimitApplies: boolean
  estimatedMonthlyCost: number | null
}

export interface AlternativeSaving {
  originalDrug: string
  alternativeDrug: string
  originalCost: number
  alternativeCost: number
  monthlySavings: number
}

export interface InsuranceScreeningResult {
  plan: InsurancePlan
  drugCoverages: DrugCoverage[]
  totalEstimatedMonthlyCost: number
  alternativeSavings: AlternativeSaving[]
}

export interface AdverseEvent {
  meddra_pt: string
  frequency_bucket:
    | 'very_common'
    | 'common'
    | 'uncommon'
    | 'rare'
    | 'very_rare'
    | 'not_reported'
    | string
  frequency_pct: number | null
  ctcae_typical_grade: number
  ctcae_max_grade: number
  severity_weight: number
  frequency_weight: number
  event_score: number
  soc: string
  /** SAP v3: contribution p×G² for included events */
  sap_score?: number
}

export interface ActionableWarning {
  kind: 'NEW_RISK' | 'HIGHER_RISK'
  meddra_pt: string
  display: string
  weight?: number
}

export interface AlternativeComparison {
  alternative_drug: string
  alternative_sap: number
  severity_delta: number
  severity_verdict: 'BETTER' | 'EQUIVALENT' | 'WORSE' | 'DATA_UNAVAILABLE'
  alternative_boxed_warning: boolean
  alternative_top_3: AdverseEvent[]
  actionable_warnings: ActionableWarning[]
}

export interface SideEffectComparison {
  flagged_drug_sap: number
  flagged_drug_boxed_warning: boolean
  flagged_drug_top_3: AdverseEvent[]
  alternative_comparisons: AlternativeComparison[]
}

export interface MedicationInput {
  drug_name: string
  dosage: string
  indication: string
}

export interface PatientFormState {
  patient_id: string
  genotypes: Record<string, string>
  medications: MedicationInput[]
}

export interface DemoPatient {
  patient_id: string
  age?: number
  genotypes: Record<string, string>
  medications: Array<{ drug_name: string; dose_mg?: number; indication?: string }>
  insurance?: { plan_id: string; plan_name: string; plan_type: string }
}

/** Safe-drug profile row from POST /api/v1/drug-profiles */
export interface AdverseEventSummary {
  meddra_pt: string
  frequency_pct: number | null
  frequency_bucket: string
  ctcae_typical_grade: number
}

export interface DrugProfile {
  drug_name: string
  side_effect_profile: {
    weighted_severity_index: number | null
    boxed_warning_flag: boolean
    boxed_warning_text: string | null
    top_3_severe_events: AdverseEventSummary[]
    common_side_effects: AdverseEventSummary[]
    data_source: string | null
  }
  insurance_coverage: DrugCoverage | null
}

export interface PhenoconversionSummaryAlert {
  drug_name: string
  failure_type: string
  mechanism_explanation: string
  recommendation: string
}

export interface SideEffectFlagItem {
  original_drug: string
  alternative_drug: string
  headline: string
  detail: string
  boxed_warning: boolean
  new_severe_events: Array<{ meddra_pt: string; grade?: number }>
}

export interface ClinicianSummary {
  phenoconversion_alerts: PhenoconversionSummaryAlert[]
  side_effect_flags: SideEffectFlagItem[]
  insurance_statement: string | null
  validation_ok?: boolean
  validation_warnings?: string[]
}

"""
CYPher REST API for the React dashboard.

Endpoints:
  POST /api/v1/analyze
  POST /api/v1/insurance/screen
  POST /api/v1/drug-profiles
  POST /api/v1/clinician-summary
  POST /api/v1/summary
  POST /api/v1/genotype/preview
  GET  /api/v1/meta/drugs
  GET  /api/v1/meta/plans
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# Repo root: .../src/cypher/api/main.py -> parents[3]
_REPO_ROOT = Path(__file__).resolve().parents[3]
try:
    from dotenv import load_dotenv

    # Load once at import so GEMINI_API_KEY etc. are available to all routes.
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local", override=False)
except ImportError:
    pass
from typing import Any, Dict, List, Optional

import base64

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cypher.engine.genotype_extractor import extract_from_pdf, parse_vcf
from cypher.engine.genotype_parser import genotype_to_activity
from cypher.engine.pipeline import (
    load_default_allele_map,
    load_default_knowledge_base,
    run_pipeline,
)
from cypher.api.clinician_summary import clinician_summary_to_dict, generate_clinician_summary
from cypher.api.drug_profile_builder import build_drug_profiles_response
from cypher.data.formulary_service import MockFormularyService, get_service_for_patient

ROOT = Path(__file__).resolve().parents[3]
HELP_PAGES = {"intake", "enzyme", "risk", "summary"}

HELP_CONTEXTS: Dict[str, Dict[str, Any]] = {
    "global": {
        "app_name": "CYPher",
        "app_purpose": (
            "CYPher is a medication review dashboard that combines entered genotypes, "
            "medications, and optional insurance plan information to explain potential "
            "drug-gene issues and show the next pages in the workflow."
        ),
        "guardrails": [
            "Only explain how to use the application and what its screens mean.",
            "Do not give diagnosis, treatment, or medication-prescribing advice.",
            "If asked for clinical decisions, direct the user to a clinician.",
        ],
        "workflow": [
            "Start on Patient Intake.",
            "Enter or load a patient, add medications, and choose genotypes.",
            "Optionally select an insurance plan.",
            "Click Analyze Discharge to generate the later views.",
            "Review enzyme status, interaction risks, risk report details, and discharge summary.",
        ],
    },
    "intake": {
        "title": "Patient Intake",
        "what_it_does": (
            "Collects patient ID, medications, genotype selections, and an optional "
            "insurance plan before analysis."
        ),
        "help_points": [
            "Patient ID is just a label for the run.",
            "Use Add Medication to add rows manually.",
            "Drug names should match known medications for autocomplete to help.",
            "Dose and indication are optional.",
            "You can drag in a photo or PDF of a handwritten list to extract medication names.",
            "Insurance selection is optional and affects later affordability coverage views.",
            "Analyze Discharge runs the backend pipeline and unlocks the next pages.",
            "Load Demo Patient in the top bar fills the form and runs the flow for a sample case.",
        ],
        "suggested_questions": [
            "How do I get started on this page?",
            "What fields are required before I click Analyze Discharge?",
            "How does the demo patient button work?",
            "Can I upload a handwritten medication list?",
        ],
    },
    "enzyme": {
        "title": "Enzyme Dashboard",
        "what_it_does": (
            "Shows baseline genotype-derived enzyme activity and how medications may "
            "shift the effective phenotype for each enzyme."
        ),
        "help_points": [
            "Baseline values come from the entered genotype.",
            "Effective values reflect the current medication list and any perpetrator drugs.",
            "Delta indicates how much the effective score changed from baseline.",
            "Use this page to understand why the risk page may flag certain drugs.",
        ],
        "suggested_questions": [
            "What is this page showing me?",
            "What is the difference between baseline and effective phenotype?",
            "What does delta mean here?",
            "How should I use this page with the next one?",
        ],
    },
    "risk": {
        "title": "Risk Report",
        "what_it_does": (
            "Summarizes flagged interactions, severity levels, consequences, alternatives, "
            "and insurance-related affordability signals when available."
        ),
        "help_points": [
            "Each card highlights a flagged interaction from the analyzed medication list.",
            "Risk level is the app's severity label for the interaction.",
            "Alternative drugs are suggestions from the project knowledge base, not final recommendations.",
            "If an insurance plan was chosen earlier, coverage information may appear here.",
        ],
        "suggested_questions": [
            "How do I read the risk levels?",
            "Where do the alternatives come from?",
            "Why am I seeing insurance information here?",
            "What should I review first on this page?",
        ],
    },
    "summary": {
        "title": "Clinical Discharge Review",
        "what_it_does": (
            "Presents a clinician-facing structured summary from the analyzed pipeline result."
        ),
        "help_points": [
            "This page summarizes phenoconversion risks, side effect tradeoffs, and insurance context.",
            "It is meant for physician review before signing orders, not as stand-alone medical advice.",
            "You can generate an optional patient handout from the same analysis.",
        ],
        "suggested_questions": [
            "What is this summary for?",
            "Can I regenerate the summary by changing the intake?",
            "How is this different from the risk page?",
        ],
    },
}

app = FastAPI(title="CYPher API", version="1.0.0")

_cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "")
_cors_allow_origins = [
    origin.strip()
    for origin in _cors_origins_env.split(",")
    if origin.strip()
]
if not _cors_allow_origins:
    _cors_allow_origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins,
    # Allow preview and production Vercel domains without code changes.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_kb: Dict[str, Any] | None = None
_allele_map: Dict[str, Dict[str, float]] | None = None
_formulary = MockFormularyService()


def _kb_data() -> Dict[str, Any]:
    global _kb
    if _kb is None:
        _kb = load_default_knowledge_base(ROOT)
    return _kb


def _allele_data() -> Dict[str, Dict[str, float]] | None:
    global _allele_map
    if _allele_map is None:
        _allele_map = load_default_allele_map(ROOT / "data" / "processed")
    return _allele_map


class MedicationIn(BaseModel):
    drug_name: str
    dose_mg: Optional[float] = None
    dosage: Optional[str] = None
    indication: Optional[str] = None


class AnalyzeRequest(BaseModel):
    patient_id: Optional[str] = None
    genotypes: Dict[str, str]
    medications: List[MedicationIn]
    plan: Optional["InsurancePlanIn"] = None


@app.post("/api/v1/analyze")
def analyze(req: AnalyzeRequest) -> Dict[str, Any]:
    patient: Dict[str, Any] = {
        "patient_id": req.patient_id or "anonymous",
        "genotypes": {k.upper(): v for k, v in req.genotypes.items()},
        "medications": [m.model_dump(exclude_none=True) for m in req.medications],
    }
    if req.plan is not None:
        patient["insurance"] = {
            "plan_id": _plan_id_string(req.plan),
            "plan_name": req.plan.planName,
            "plan_type": "medicare",
        }
    result = run_pipeline(
        patient,
        knowledge_base=_kb_data(),
        allele_function_map=_allele_data(),
        drug_side_effect_profiles_path=ROOT / "data" / "drug_side_effect_profiles.json",
    )
    result["medications_input"] = [
        {
            "drug_name": m.drug_name,
            "dosage": m.dosage or (f"{m.dose_mg}mg" if m.dose_mg else ""),
            "indication": m.indication or "",
        }
        for m in req.medications
    ]
    return result



class InsurancePlanIn(BaseModel):
    contractId: str
    planId: str
    planName: str = ""
    planType: str = "medicare"


class InsuranceScreenRequest(BaseModel):
    patient_id: Optional[str] = None
    genotypes: Dict[str, str]
    medications: List[MedicationIn]
    plan: InsurancePlanIn
    pipeline_result: Optional[Dict[str, Any]] = None


def _plan_id_string(plan: InsurancePlanIn) -> str:
    return f"{plan.contractId}-{plan.planId}"


def _coverage_for_drug(
    drug_name: str, plan_id: str, svc: MockFormularyService
) -> Dict[str, Any]:
    fe = svc.lookup(drug_name, plan_id)
    tier = fe.tier
    return {
        "drugName": drug_name,
        "ndc": "",
        "covered": fe.covered,
        "tierLevel": tier,
        "tierName": fe.tier_label,
        "copayPreferred": None,
        "coinsurancePreferred": None,
        "priorAuthRequired": fe.prior_auth_required,
        "stepTherapyRequired": False,
        "quantityLimitApplies": False,
        "estimatedMonthlyCost": None,
    }


@app.post("/api/v1/insurance/screen")
def insurance_screen(req: InsuranceScreenRequest) -> Dict[str, Any]:
    plan_id = _plan_id_string(req.plan)
    insurance = {
        "plan_id": plan_id,
        "plan_name": req.plan.planName,
        "plan_type": "medicare",
    }
    if req.pipeline_result is not None:
        pipeline_result = req.pipeline_result
    else:
        patient: Dict[str, Any] = {
            "patient_id": req.patient_id or "anonymous",
            "genotypes": {k.upper(): v for k, v in req.genotypes.items()},
            "medications": [m.model_dump(exclude_none=True) for m in req.medications],
            "insurance": insurance,
        }
        pipeline_result = run_pipeline(
            patient,
            knowledge_base=_kb_data(),
            allele_function_map=_allele_data(),
            drug_side_effect_profiles_path=ROOT / "data" / "drug_side_effect_profiles.json",
        )
    svc = get_service_for_patient(insurance)

    drug_coverages: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for m in req.medications:
        name = m.drug_name.strip().lower()
        if name in seen:
            continue
        seen.add(name)
        drug_coverages.append(_coverage_for_drug(name, plan_id, svc))

    alt_savings: List[Dict[str, Any]] = []
    for aff in pipeline_result.get("affordability") or []:
        ranked = aff.get("ranked_alternatives") or []
        if not ranked:
            continue
        orig = aff["interaction_drug"]
        best = ranked[0]
        alt_name = best["drug_name"]
        alt_savings.append(
            {
                "originalDrug": orig,
                "alternativeDrug": alt_name,
                "originalCost": None,
                "alternativeCost": None,
                "monthlySavings": None,
            }
        )

    return {
        "plan": {
            "contractId": req.plan.contractId,
            "planId": req.plan.planId,
            "planName": req.plan.planName,
            "planType": req.plan.planType,
        },
        "drugCoverages": drug_coverages,
        "totalEstimatedMonthlyCost": None,
        "alternativeSavings": alt_savings,
    }


class DrugProfilesRequest(BaseModel):
    drugs: List[str] = Field(default_factory=list)
    insurance_plan: Optional[InsurancePlanIn] = None


@app.post("/api/v1/drug-profiles")
def drug_profiles_endpoint(req: DrugProfilesRequest) -> Dict[str, Any]:
    plan = req.insurance_plan.model_dump() if req.insurance_plan else None
    return build_drug_profiles_response(
        req.drugs,
        insurance_plan=plan,
        profiles_path=ROOT / "data" / "drug_side_effect_profiles.json",
    )


class ClinicianSummaryRequest(BaseModel):
    patient_id: Optional[str] = None
    patient_name: str = ""
    pipeline_result: Dict[str, Any] = Field(default_factory=dict)
    insurance_plan: Optional[InsurancePlanIn] = None
    drug_profiles: Optional[List[Dict[str, Any]]] = None


@app.post("/api/v1/clinician-summary")
def clinician_summary_endpoint(req: ClinicianSummaryRequest) -> Dict[str, Any]:
    plan = req.insurance_plan.model_dump() if req.insurance_plan else None
    summary, ok, fails = generate_clinician_summary(
        patient_name=req.patient_name or (req.patient_id or "Patient"),
        patient_id=req.patient_id or "anonymous",
        pipeline_result=req.pipeline_result,
        insurance_plan=plan,
        drug_profiles=req.drug_profiles,
    )
    out = clinician_summary_to_dict(summary)
    out["validation_ok"] = ok
    out["validation_warnings"] = fails
    return out


class SummaryRequest(BaseModel):
    pipeline_result: Dict[str, Any] = Field(default_factory=dict)
    drug_profiles: Optional[List[Dict[str, Any]]] = None


class HelpChatRequest(BaseModel):
    page: str
    question: str


def _page_help_context(page: str) -> Dict[str, Any]:
    key = page.strip().lower()
    if key not in HELP_PAGES:
        key = "intake"
    return {
        "page": key,
        "global": HELP_CONTEXTS["global"],
        "page_context": HELP_CONTEXTS[key],
    }


def _fallback_help_answer(page: str, question: str) -> str:
    ctx = _page_help_context(page)
    page_ctx = ctx["page_context"]
    normalized = question.strip().lower()

    if not normalized:
        return (
            f"{page_ctx['title']} helps with {page_ctx['what_it_does']} "
            f"Try one of the suggested questions below."
        )

    if any(word in normalized for word in ["start", "begin", "first", "how do i use"]):
        workflow = " ".join(f"{i + 1}. {step}" for i, step in enumerate(ctx["global"]["workflow"]))
        return f"Use this workflow: {workflow}"

    if any(word in normalized for word in ["required", "need", "must", "before analyze"]):
        if page == "intake":
            return (
                "On Patient Intake, you need at least one medication with a name. "
                "Patient ID is just a label, dose and indication are optional, "
                "and insurance selection is optional."
            )
        return (
            "The later pages depend on running Analyze Discharge from Patient Intake first. "
            "If a page is empty, go back and run the intake flow."
        )

    if "demo" in normalized:
        return (
            "Use the Load Demo Patient button in the top navigation. "
            "It loads a sample patient, fills the intake fields, and starts the analysis flow."
        )

    if any(word in normalized for word in ["upload", "photo", "pdf", "handwritten", "ocr"]):
        return (
            "On Patient Intake, you can drag and drop or browse for an image or PDF of a handwritten "
            "medication list. The app extracts medication names and adds them as rows."
        )

    if any(word in normalized for word in ["medical advice", "should i take", "should i stop", "diagnose"]):
        return (
            "This help chat is only for using the app and understanding what its screens show. "
            "It should not be used for diagnosis, medication changes, or treatment decisions."
        )

    bullet_lines = "\n".join(f"- {point}" for point in page_ctx["help_points"][:4])
    return (
        f"{page_ctx['title']} is the screen that {page_ctx['what_it_does']}\n"
        f"Key details:\n{bullet_lines}"
    )


def _fallback_summary(data: Dict[str, Any]) -> str:
    pid = data.get("patient_id") or "Patient"
    interactions = data.get("interactions") or []
    med_inputs = data.get("medications_input") or []
    lines = [
        f"**Your Medications**",
        "",
    ]
    if med_inputs:
        for mi in med_inputs:
            parts = [mi.get("drug_name", "")]
            if mi.get("dosage"):
                parts.append(f"— {mi['dosage']}")
            if mi.get("indication"):
                parts.append(f"(for {mi['indication']})")
            lines.append(f"- {' '.join(parts)}")
    else:
        lines.append("This summary lists medications that were reviewed for this discharge.")
    lines.extend([
        "",
        f"**What We Found**",
        "",
    ])
    if not interactions:
        lines.append(
            "No significant drug–gene interactions were flagged for this medication list."
        )
    else:
        for it in interactions:
            lines.append(
                f"- {it.get('drug_name')} ({it.get('enzyme_name')}): "
                f"{it.get('risk_level', '').upper()} — {it.get('exposure_classification', '')}"
            )
    lines.extend(
        [
            "",
            f"**What This Means for You**",
            "",
            "Your care team should confirm any medication changes before you leave. "
            "Bring this summary to your follow-up visit.",
            "",
            f"**What to Discuss with Your Doctor**",
            "",
        ]
    )
    for it in interactions:
        alts = it.get("alternative_drugs") or []
        if alts:
            lines.append(
                f"- Ask whether {it.get('drug_name')} should be adjusted; "
                f"alternatives may include: {', '.join(alts)}."
            )
    if not interactions:
        lines.append("- Continue medications as prescribed unless your doctor advises otherwise.")
    lines.insert(0, f"*Prepared for: {pid}*")
    return "\n".join(lines)


@app.post("/api/v1/summary")
def summary(req: SummaryRequest) -> Dict[str, str]:
    """Patient handout text; uses GEMINI_API_KEY (same stack as help-chat / OCR)."""
    text: Optional[str] = None
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai

            client = genai.Client(api_key=api_key)
            payload = json.dumps(req.pipeline_result, indent=2)[:120_000]
            extra = ""
            if req.drug_profiles:
                extra = (
                    "\n\nInclude a section **Your Other Medications** after interaction findings, "
                    "briefly describing each safe medication from drug_profiles (common side effects "
                    "and coverage when present).\n"
                    f"drug_profiles JSON:\n{json.dumps(req.drug_profiles, indent=2)[:40_000]}"
                )
            prompt = (
                "Write a patient-facing discharge medication summary in plain language. "
                "Use exactly these Markdown sections with bold headers:\n"
                "**Your Medications** — list each medication with its dosage and "
                "indication/reason for taking it (from the medications_input field)\n\n"
                "**What We Found**\n\n"
                "**What This Means for You**\n\n"
                "**What to Discuss with Your Doctor**\n\n"
                "Base content only on this JSON:\n"
                f"{payload}"
                f"{extra}"
            )
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = (response.text or "").strip() or None
        except Exception:
            text = None
    if not text:
        text = _fallback_summary(req.pipeline_result)
    return {"summary": text}


@app.post("/api/v1/help-chat")
def help_chat(req: HelpChatRequest) -> Dict[str, Any]:
    page = req.page.strip().lower() or "intake"
    if page not in HELP_PAGES:
        page = "intake"

    context = _page_help_context(page)
    answer: Optional[str] = None
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=(
                    "You are the in-app help assistant for CYPher. "
                    "Answer only using the provided product context. "
                    "Be concise, practical, and UI-focused. "
                    "If asked for clinical advice, say you can only explain how the app works and "
                    "the user should consult a clinician.\n\n"
                    f"Product context JSON:\n{json.dumps(context, indent=2)}\n\n"
                    f"User question: {req.question.strip()}"
                ),
            )
            answer = (response.text or "").strip() or None
        except Exception as e:
            print(e)
            answer = None

    if not answer:
        answer = _fallback_help_answer(page, req.question)

    return {
        "page": page,
        "answer": answer,
        "suggested_questions": context["page_context"]["suggested_questions"],
    }


@app.post("/api/v1/ocr/medications")
async def ocr_medications(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Extract medications from an uploaded image or PDF of a handwritten drug list."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return {"error": "GEMINI_API_KEY not set", "medications": []}

    try:
        import tempfile
        from google import genai
        from google.genai import types

        content = await file.read()
        mime = file.content_type or "application/octet-stream"
        suffix = ".pdf" if "pdf" in mime else ".png"

        client = genai.Client(api_key=gemini_key)

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            uploaded = client.files.upload(file=tmp_path)
        finally:
            os.unlink(tmp_path)

        prompt = (
            "Look at this document carefully. It is a medication list, "
            "prescription, or pharmacy form. Extract every drug / medication "
            "you can find (printed or handwritten). For each medication, extract:\n"
            "- drug_name: the medication name (lowercase)\n"
            "- dosage: the full dosage info (e.g. '50mg twice daily', '10mg/day'). "
            "Include amount, strength, and frequency if available.\n"
            "- indication: the reason for taking it (e.g. 'high blood pressure', "
            "'pain relief'). Infer from medical knowledge if not explicitly stated.\n\n"
            "Return ONLY a JSON array of objects, e.g.:\n"
            '[{"drug_name": "metoprolol", "dosage": "50mg twice daily", '
            '"indication": "high blood pressure"}]\n'
            "No explanation, just the JSON array."
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_uri(
                            file_uri=uploaded.uri,
                            mime_type=uploaded.mime_type,
                        ),
                        types.Part(text=prompt),
                    ],
                )
            ],
        )

        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        meds = json.loads(raw)
        if not isinstance(meds, list):
            return {"error": f"Unexpected response format: {raw[:200]}", "medications": []}

        result = []
        for m in meds:
            if isinstance(m, dict):
                name = str(m.get("drug_name", "")).strip().lower()
                if name:
                    result.append({
                        "drug_name": name,
                        "dosage": str(m.get("dosage", "")).strip(),
                        "indication": str(m.get("indication", "")).strip(),
                    })
            elif isinstance(m, str) and m.strip():
                result.append({"drug_name": m.strip().lower(), "dosage": "", "indication": ""})

        return {"medications": result}

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {"error": str(exc), "medications": []}


class GenotypePreviewRequest(BaseModel):
    enzyme: str
    allele1: str
    allele2: str


@app.post("/api/v1/genotype/preview")
def genotype_preview(req: GenotypePreviewRequest) -> Dict[str, Any]:
    gene = req.enzyme.strip().upper()
    dip = f"{req.allele1.strip()}/{req.allele2.strip()}"
    baselines = genotype_to_activity({gene: dip}, allele_function_map=_allele_data())
    b = baselines[gene]
    return {
        "enzyme": gene,
        "diplotype": dip,
        "activity_score": b.activity_score,
        "phenotype": b.phenotype,
    }


@app.post("/api/v1/genotype/upload")
async def upload_genotype(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Accept a VCF file or PGx lab report PDF and extract genotypes."""
    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        return {"error": "File exceeds 10MB limit.", "genotypes": {}, "details": [], "warnings": []}

    mime = file.content_type or "application/octet-stream"
    filename = (file.filename or "").lower()

    is_vcf = filename.endswith(".vcf") or filename.endswith(".vcf.gz")
    is_pdf = "pdf" in mime or filename.endswith(".pdf")

    if is_vcf:
        allele_defs_path = ROOT / "data" / "pgx_allele_definitions.json"
        result = parse_vcf(content, allele_defs_path)
    elif is_pdf:
        result = await extract_from_pdf(content, mime)
    else:
        return {
            "error": "Unsupported file type. Upload a .vcf or .pdf file.",
            "genotypes": {}, "details": [], "warnings": [],
        }

    if result.error:
        return {
            "error": result.error,
            "genotypes": {}, "details": [], "warnings": result.warnings,
        }

    for gene in ["CYP2D6", "CYP2C19", "CYP2C9"]:
        if gene not in result.genotypes:
            result.genotypes[gene] = "*1/*1"
            result.warnings.append(f"No data found for {gene}, defaulting to *1/*1")

    return {
        "genotypes": result.genotypes,
        "details": [vars(d) for d in result.details],
        "source_type": result.source_type,
        "warnings": result.warnings,
    }


@app.get("/api/v1/meta/drugs")
def meta_drugs() -> Dict[str, List[str]]:
    path = ROOT / "data" / "knowledge_base.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    drugs: set[str] = set()
    if isinstance(payload, list):
        for row in payload:
            if isinstance(row, dict) and row.get("drug_name"):
                drugs.add(str(row["drug_name"]).lower())
    return {"drugs": sorted(drugs)}


@app.get("/api/v1/meta/plans")
def meta_plans() -> Dict[str, Any]:
    path = ROOT / "data" / "plan-info.json"
    if not path.exists():
        return {"plans": []}
    return {"plans": json.loads(path.read_text(encoding="utf-8"))}


@app.get("/api/v1/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}

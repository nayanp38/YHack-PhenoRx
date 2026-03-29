"""
PhenoRx REST API for the React dashboard.

Endpoints:
  POST /api/v1/analyze
  POST /api/v1/insurance/screen
  POST /api/v1/summary
  POST /api/v1/genotype/preview
  GET  /api/v1/meta/drugs
  GET  /api/v1/meta/plans
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import base64

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from phenorx.engine.genotype_parser import genotype_to_activity
from phenorx.engine.pipeline import (
    load_default_allele_map,
    load_default_knowledge_base,
    run_pipeline,
)
from phenorx.data.formulary_service import MockFormularyService, get_service_for_patient

ROOT = Path(__file__).resolve().parents[3]

app = FastAPI(title="PhenoRx API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ],
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
    indication: Optional[str] = None


class AnalyzeRequest(BaseModel):
    patient_id: Optional[str] = None
    genotypes: Dict[str, str]
    medications: List[MedicationIn]


@app.post("/api/v1/analyze")
def analyze(req: AnalyzeRequest) -> Dict[str, Any]:
    patient: Dict[str, Any] = {
        "patient_id": req.patient_id or "anonymous",
        "genotypes": {k.upper(): v for k, v in req.genotypes.items()},
        "medications": [m.model_dump(exclude_none=True) for m in req.medications],
    }
    return run_pipeline(
        patient,
        knowledge_base=_kb_data(),
        allele_function_map=_allele_data(),
        drug_side_effect_profiles_path=ROOT / "data" / "drug_side_effect_profiles.json",
    )


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


class SummaryRequest(BaseModel):
    pipeline_result: Dict[str, Any] = Field(default_factory=dict)


def _fallback_summary(data: Dict[str, Any]) -> str:
    pid = data.get("patient_id") or "Patient"
    interactions = data.get("interactions") or []
    lines = [
        f"**Your Medications**",
        "",
        "This summary lists medications that were reviewed for this discharge.",
        "",
        f"**What We Found**",
        "",
    ]
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
    text: Optional[str] = None
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)
            payload = json.dumps(req.pipeline_result, indent=2)[:120_000]
            msg = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Write a patient-facing discharge medication summary in plain language. "
                            "Use exactly these Markdown sections with bold headers:\n"
                            "**Your Medications**\n\n"
                            "**What We Found**\n\n"
                            "**What This Means for You**\n\n"
                            "**What to Discuss with Your Doctor**\n\n"
                            "Base content only on this JSON:\n"
                            f"{payload}"
                        ),
                    }
                ],
            )
            block = msg.content[0]
            if block.type == "text":
                text = block.text
        except Exception:
            text = None
    if not text:
        text = _fallback_summary(req.pipeline_result)
    return {"summary": text}


@app.post("/api/v1/ocr/medications")
async def ocr_medications(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Extract medications from an uploaded image or PDF of a handwritten drug list."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return {"error": "GEMINI_API_KEY not set", "medications": []}

    from google import genai

    content = await file.read()
    b64 = base64.b64encode(content).decode("utf-8")
    mime = file.content_type or "image/png"

    client = genai.Client(api_key=gemini_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": mime, "data": b64}},
                    {
                        "text": (
                            "This is a handwritten medication list from a doctor or pharmacy. "
                            "Extract every medication name from it. Return ONLY a JSON array of "
                            'strings, e.g. ["metoprolol", "lisinopril"]. Lowercase all names. '
                            "If you cannot read a name, skip it. No explanation, just the JSON array."
                        )
                    },
                ],
            }
        ],
    )

    raw = response.text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()

    try:
        meds = json.loads(raw)
        if not isinstance(meds, list):
            meds = []
    except json.JSONDecodeError:
        meds = []

    return {"medications": [str(m).strip().lower() for m in meds if str(m).strip()]}


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

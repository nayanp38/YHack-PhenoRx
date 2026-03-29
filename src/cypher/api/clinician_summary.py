"""Clinician-facing discharge summary via Claude (structured JSON)."""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


class PhenoconversionAlertJson(BaseModel):
    drug_name: str
    failure_type: str = Field(
        description="therapeutic_failure | toxicity | subtherapeutic_response"
    )
    mechanism_explanation: str
    recommendation: str


class SideEffectFlagJson(BaseModel):
    original_drug: str
    alternative_drug: str
    headline: str
    detail: str
    boxed_warning: bool = False
    new_severe_events: List[Dict[str, Any]] = Field(default_factory=list)


class ClinicianSummaryJson(BaseModel):
    phenoconversion_alerts: List[PhenoconversionAlertJson] = Field(default_factory=list)
    side_effect_flags: List[SideEffectFlagJson] = Field(default_factory=list)
    insurance_statement: Optional[str] = None


def _build_insurance_statement(
    affordability: List[Dict[str, Any]], has_plan: bool
) -> Optional[str]:
    if not has_plan:
        return None

    for item in affordability:
        ranked = item.get("ranked_alternatives") or []
        if len(ranked) < 2:
            continue

        better = ranked[0]
        worse = ranked[1]
        better_tier = better.get("tier")
        worse_tier = worse.get("tier")
        if better_tier is None or worse_tier is None or better_tier >= worse_tier:
            continue

        better_name = str(better.get("drug_name") or "").strip()
        worse_name = str(worse.get("drug_name") or "").strip()
        if not better_name or not worse_name:
            continue

        return (
            f"For your patient, {better_name} (Tier {better_tier}) is covered better by insurance "
            f"than {worse_name} (Tier {worse_tier})."
        )

    return "Review the cost footer for per-drug tier and estimated copays under the selected plan."


_ABBREV_REPLACEMENTS = (
    (r"\bQD\b", "once daily (QD)"),
    (r"\bBID\b", "twice daily (BID)"),
    (r"\bTID\b", "three times daily (TID)"),
    (r"\bQID\b", "four times daily (QID)"),
    (r"\bPRN\b", "as needed (PRN)"),
)


def _expand_abbreviations(text: str) -> str:
    s = text
    for pat, rep in _ABBREV_REPLACEMENTS:
        s = re.sub(pat, rep, s)
    return s


def _substrate_type(
    drug_matrix: Dict[str, Any], drug_name: str, enzyme_name: str
) -> str:
    row = drug_matrix.get(drug_name) or drug_matrix.get(drug_name.lower())
    if not row:
        return "active_drug"
    cell = row.get(enzyme_name)
    if isinstance(cell, dict):
        return str(cell.get("substrate_type") or "active_drug")
    return "active_drug"


def _failure_type(
    substrate_type: str, predicted_aucr: float, effective_as: Optional[float]
) -> str:
    st = substrate_type or "active_drug"
    if st == "prodrug":
        return "therapeutic_failure"
    if predicted_aucr >= 1.25:
        return "toxicity"
    return "subtherapeutic_response"


def _collect_side_effect_seed(interactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seeds: List[Dict[str, Any]] = []
    for inter in interactions:
        comp = inter.get("side_effect_comparison")
        if not comp:
            continue
        orig = str(inter.get("drug_name") or "")
        flagged_bw = bool(comp.get("flagged_drug_boxed_warning"))
        for alt in comp.get("alternative_comparisons") or []:
            verdict = str(alt.get("severity_verdict") or "")
            alt_bw = bool(alt.get("alternative_boxed_warning"))
            warnings = alt.get("actionable_warnings") or []
            new_risks = [w for w in warnings if w.get("kind") == "NEW_RISK"]
            if verdict == "WORSE" or new_risks or (alt_bw and not flagged_bw):
                seeds.append(
                    {
                        "original_drug": orig,
                        "alternative_drug": str(alt.get("alternative_drug") or ""),
                        "severity_verdict": verdict,
                        "alternative_sap": alt.get("alternative_sap"),
                        "severity_delta": alt.get("severity_delta"),
                        "alternative_boxed_warning": alt_bw,
                        "flagged_drug_boxed_warning": flagged_bw,
                        "actionable_warnings": warnings,
                        "alternative_top_3": alt.get("alternative_top_3") or [],
                    }
                )
    return seeds


def _build_phenoconversion_seed(
    interactions: List[Dict[str, Any]], drug_matrix: Dict[str, Any]
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for inter in interactions:
        rl = str(inter.get("risk_level") or "").lower()
        if rl not in {"critical", "high"}:
            continue
        dn = str(inter.get("drug_name") or "")
        en = str(inter.get("enzyme_name") or "")
        st = _substrate_type(drug_matrix, dn, en)
        aucr = float(inter.get("predicted_aucr") or 1.0)
        eff = inter.get("effective_activity_score")
        eff_f = float(eff) if eff is not None else None
        ft = _failure_type(st, aucr, eff_f)
        out.append(
            {
                "drug_name": dn,
                "enzyme_name": en,
                "failure_type": ft,
                "substrate_type": st,
                "baseline_phenotype": inter.get("baseline_phenotype"),
                "effective_phenotype": inter.get("effective_phenotype"),
                "baseline_activity_score": inter.get("baseline_activity_score"),
                "effective_activity_score": inter.get("effective_activity_score"),
                "perpetrator_drug": inter.get("perpetrator_drug"),
                "perpetrator_strength": inter.get("perpetrator_strength"),
                "predicted_aucr": aucr,
                "exposure_classification": inter.get("exposure_classification"),
                "clinical_consequence": inter.get("clinical_consequence"),
                "alternative_drugs": inter.get("alternative_drugs") or [],
                "perpetrator_alternatives": inter.get("perpetrator_alternatives") or [],
                "perpetrator_alternative_note": inter.get("perpetrator_alternative_note"),
            }
        )
    return out


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    t = text.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        if len(lines) >= 2:
            t = "\n".join(lines[1:])
            if t.endswith("```"):
                t = t.rsplit("```", 1)[0].strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}\s*$", t)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _validate_and_fix(
    data: Dict[str, Any],
    *,
    pheno_seed_count: int,
    has_plan: bool,
    insurance_seed_statement: Optional[str],
) -> Tuple[ClinicianSummaryJson, List[str]]:
    failures: List[str] = []
    alerts_raw = data.get("phenoconversion_alerts") or []
    flags_raw = data.get("side_effect_flags") or []
    ins = data.get("insurance_statement")

    if not isinstance(alerts_raw, list):
        alerts_raw = []
        failures.append("phenoconversion_alerts not a list")
    if not isinstance(flags_raw, list):
        flags_raw = []
        failures.append("side_effect_flags not a list")

    alerts: List[PhenoconversionAlertJson] = []
    for a in alerts_raw:
        if not isinstance(a, dict):
            continue
        try:
            pa = PhenoconversionAlertJson.model_validate(a)
            mech = pa.mechanism_explanation or ""
            if "phenoconversion" not in mech.lower() and "drug-drug-gene" not in mech.lower():
                mech = (
                    mech
                    + " This phenoconversion (drug-drug-gene interaction) is not explained by genetics alone."
                )
            pa = PhenoconversionAlertJson(
                drug_name=pa.drug_name,
                failure_type=pa.failure_type,
                mechanism_explanation=_expand_abbreviations(mech),
                recommendation=_expand_abbreviations(pa.recommendation),
            )
            alerts.append(pa)
        except Exception:
            continue

    if pheno_seed_count > 0 and len(alerts) != pheno_seed_count:
        failures.append(
            f"expected {pheno_seed_count} phenoconversion alerts, got {len(alerts)}"
        )

    flags: List[SideEffectFlagJson] = []
    for f in flags_raw:
        if not isinstance(f, dict):
            continue
        try:
            flags.append(
                SideEffectFlagJson(
                    original_drug=str(f.get("original_drug") or ""),
                    alternative_drug=str(f.get("alternative_drug") or ""),
                    headline=_expand_abbreviations(str(f.get("headline") or "")),
                    detail=_expand_abbreviations(str(f.get("detail") or "")),
                    boxed_warning=bool(f.get("boxed_warning")),
                    new_severe_events=list(f.get("new_severe_events") or [])
                    if isinstance(f.get("new_severe_events"), list)
                    else [],
                )
            )
        except Exception:
            continue

    if not has_plan:
        ins = None
    else:
        ins = insurance_seed_statement or (
            _expand_abbreviations(str(ins)) if ins is not None else None
        )

    summary = ClinicianSummaryJson(
        phenoconversion_alerts=alerts,
        side_effect_flags=flags,
        insurance_statement=ins,
    )
    return summary, failures


def generate_clinician_summary(
    *,
    patient_name: str,
    patient_id: str,
    pipeline_result: Dict[str, Any],
    insurance_plan: Optional[Dict[str, Any]] = None,
    drug_profiles: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[ClinicianSummaryJson, bool, List[str]]:
    """
    Returns (summary, validation_ok, failure_messages).
    """
    interactions = pipeline_result.get("interactions") or []
    drug_matrix = pipeline_result.get("drug_matrix") or {}
    pheno_seed = _build_phenoconversion_seed(
        [x for x in interactions if isinstance(x, dict)], drug_matrix
    )
    se_seed = _collect_side_effect_seed([x for x in interactions if isinstance(x, dict)])

    affordability = pipeline_result.get("affordability") or []
    insurance_seed_statement = _build_insurance_statement(
        [x for x in affordability if isinstance(x, dict)],
        insurance_plan is not None,
    )

    input_payload = {
        "patient_name": patient_name,
        "patient_id": patient_id,
        "phenoconversion_seed": pheno_seed,
        "side_effect_seed": se_seed,
        "affordability": affordability,
        "insurance_plan": insurance_plan,
        "insurance_seed_statement": insurance_seed_statement,
        "safe_drug_profiles": drug_profiles or [],
    }

    system_prompt = (
        "You are a clinical decision support writer for physicians. "
        "Output ONLY valid JSON (no markdown fences) matching this schema:\n"
        '{"phenoconversion_alerts":[{"drug_name":string,"failure_type":"therapeutic_failure"|"toxicity"|'
        '"subtherapeutic_response","mechanism_explanation":string,"recommendation":string}],'
        '"side_effect_flags":[{"original_drug":string,"alternative_drug":string,"headline":string,'
        '"detail":string,"boxed_warning":boolean,"new_severe_events":[{"meddra_pt":string,"grade":number}]}],'
        '"insurance_statement":string|null}\n'
        "Rules:\n"
        "- Address the reader as the physician (use 'Your patient').\n"
        "- Each mechanism_explanation MUST explicitly use the phrase 'phenoconversion' OR 'drug-drug-gene'.\n"
        "- Explain DDGI (not DGI alone): name perpetrator drug, enzyme, phenotype shift, and consequence.\n"
        "- phenoconversion_alerts: one entry per item in phenoconversion_seed (same drug_name order). "
        "Expand failure_type from seed.\n"
        "- side_effect_flags: only for items in side_effect_seed; keep clinically actionable.\n"
        "- insurance_statement: use insurance_seed_statement when it is provided; "
        "keep it succinct and top-line. Return null if insurance_plan is null.\n"
        "- No unexplained clinical abbreviations (spell out or use plain language).\n"
    )

    user_content = json.dumps(input_payload, indent=2)[:100_000]

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback_summary(
            pheno_seed,
            se_seed,
            insurance_plan is not None,
            insurance_seed_statement,
        ), True, []

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        def call_claude(extra: str = "") -> str:
            combined = (
                f"{system_prompt}\n\n---INPUT_JSON---\n{user_content}{extra}"
            )
            msg = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": combined,
                    }
                ],
            )
            block = msg.content[0]
            if block.type != "text":
                return ""
            return block.text

        text = call_claude()
        parsed = _extract_json_object(text)
        if not parsed:
            raise ValueError("no json")

        summary, fails = _validate_and_fix(
            parsed,
            pheno_seed_count=len(pheno_seed),
            has_plan=insurance_plan is not None,
            insurance_seed_statement=insurance_seed_statement,
        )

        if fails:
            retry_text = call_claude(
                f"\n\nYour previous response failed validation: {'; '.join(fails)}. "
                "Regenerate JSON with corrections."
            )
            parsed2 = _extract_json_object(retry_text)
            if parsed2:
                summary2, fails2 = _validate_and_fix(
                    parsed2,
                    pheno_seed_count=len(pheno_seed),
                    has_plan=insurance_plan is not None,
                    insurance_seed_statement=insurance_seed_statement,
                )
                return summary2, len(fails2) == 0, fails2
            return summary, False, fails

        return summary, True, []
    except Exception:
        return (
            _fallback_summary(
                pheno_seed,
                se_seed,
                insurance_plan is not None,
                insurance_seed_statement,
            ),
            True,
            [],
        )


def _fallback_summary(
    pheno_seed: List[Dict[str, Any]],
    se_seed: List[Dict[str, Any]],
    has_plan: bool,
    insurance_seed_statement: Optional[str],
) -> ClinicianSummaryJson:
    alerts: List[PhenoconversionAlertJson] = []
    for p in pheno_seed:
        dn = str(p.get("drug_name") or "")
        ft = str(p.get("failure_type") or "toxicity")
        perp = p.get("perpetrator_drug") or "a co-prescribed inhibitor"
        enz = p.get("enzyme_name") or ""
        mech = (
            f"This drug-drug-gene interaction (phenoconversion) involves {perp} shifting effective "
            f"{enz} activity versus baseline, changing exposure for {dn}. "
            f"({str(p.get('exposure_classification') or '')})"
        )
        alts = p.get("alternative_drugs") or []
        rec = (
            f"review alternatives such as {', '.join(str(x) for x in alts[:3])} "
            "per institutional protocol."
            if alts
            else "review dosing or alternative therapy per institutional protocol."
        )
        alerts.append(
            PhenoconversionAlertJson(
                drug_name=dn,
                failure_type=ft,
                mechanism_explanation=mech,
                recommendation=rec,
            )
        )

    flags: List[SideEffectFlagJson] = []
    for s in se_seed:
        nse: List[Dict[str, Any]] = []
        for w in s.get("actionable_warnings") or []:
            if w.get("kind") == "NEW_RISK":
                nse.append(
                    {
                        "meddra_pt": str(w.get("meddra_pt") or ""),
                        "grade": 3,
                    }
                )
        flags.append(
            SideEffectFlagJson(
                original_drug=str(s.get("original_drug") or ""),
                alternative_drug=str(s.get("alternative_drug") or ""),
                headline=(
                    f"Switching {s.get('original_drug')} to {s.get('alternative_drug')}: "
                    "Side effect advisory."
                ),
                detail=(
                    f"Verdict {s.get('severity_verdict')} (ΔSAP {s.get('severity_delta')}). "
                    "Review boxed warnings and unique severe risks before switching."
                ),
                boxed_warning=bool(s.get("alternative_boxed_warning")),
                new_severe_events=nse,
            )
        )

    ins = None
    if has_plan:
        ins = insurance_seed_statement or (
            "Review the cost footer for per-drug tier and estimated copays under the selected plan."
        )

    return ClinicianSummaryJson(
        phenoconversion_alerts=alerts,
        side_effect_flags=flags,
        insurance_statement=ins,
    )


def clinician_summary_to_dict(obj: ClinicianSummaryJson) -> Dict[str, Any]:
    return json.loads(obj.model_dump_json())

"""Build safe-drug profile payloads for POST /api/v1/drug-profiles."""
from __future__ import annotations

from typing import Any, Dict, List

from cypher.data.formulary_service import MockFormularyService, mock_estimated_monthly_cost
from cypher.engine.side_effect_severity import load_drug_profiles, top_sap_events, total_sap


def _coverage_for_drug(
    drug_name: str, plan_id: str, svc: MockFormularyService
) -> Dict[str, Any]:
    fe = svc.lookup(drug_name, plan_id)
    tier = fe.tier
    est = mock_estimated_monthly_cost(drug_name)
    return {
        "drugName": drug_name,
        "ndc": "",
        "covered": fe.covered,
        "tierLevel": tier,
        "tierName": fe.tier_label,
        "copayPreferred": est,
        "coinsurancePreferred": None,
        "priorAuthRequired": fe.prior_auth_required,
        "stepTherapyRequired": False,
        "quantityLimitApplies": False,
        "estimatedMonthlyCost": est,
    }


def _ae_summary(ae: Dict[str, Any]) -> Dict[str, Any]:
    fb = ae.get("frequency_bucket") or "not_reported"
    pct = ae.get("frequency_pct")
    return {
        "meddra_pt": str(ae.get("meddra_pt") or ""),
        "frequency_pct": None if pct is None else float(pct),
        "frequency_bucket": str(fb),
        "ctcae_typical_grade": int(ae.get("ctcae_typical_grade") or 0),
    }


def _common_side_effects(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Low-grade, higher-frequency events for patient-facing lists (spec §2.2.3)."""
    out: List[Dict[str, Any]] = []
    for ae in raw.get("adverse_events") or []:
        g = int(ae.get("ctcae_typical_grade") or 0)
        if g > 2:
            continue
        pct = ae.get("frequency_pct")
        try:
            pvf = float(pct) if pct is not None else None
        except (TypeError, ValueError):
            pvf = None
        fb = str(ae.get("frequency_bucket") or "").lower()
        if pvf is not None and pvf >= 5.0:
            pass
        elif fb in ("very_common", "common"):
            pass
        else:
            continue
        out.append(_ae_summary(ae))

    def sort_key(x: Dict[str, Any]) -> float:
        fp = x.get("frequency_pct")
        return float(fp) if fp is not None else -1.0

    out.sort(key=sort_key, reverse=True)
    return out[:5]


def build_side_effect_profile_for_drug(
    drug_key: str, profiles: Dict[str, Any]
) -> Dict[str, Any]:
    raw = profiles.get(drug_key.strip().lower())
    if not raw:
        return {
            "weighted_severity_index": None,
            "boxed_warning_flag": False,
            "boxed_warning_text": None,
            "top_3_severe_events": [],
            "common_side_effects": [],
            "data_source": None,
        }

    wsi = raw.get("weighted_severity_index")
    if wsi is not None:
        try:
            wsi_f = float(wsi)
        except (TypeError, ValueError):
            wsi_f = round(total_sap(raw), 4)
    else:
        wsi_f = round(total_sap(raw), 4)

    top3 = top_sap_events(raw, 3)
    common = _common_side_effects(raw)

    ds = raw.get("data_source")
    if not ds:
        ds = "openFDA SPL + CTCAE v5.0"

    return {
        "weighted_severity_index": wsi_f,
        "boxed_warning_flag": bool(raw.get("boxed_warning_flag")),
        "boxed_warning_text": raw.get("boxed_warning_text"),
        "top_3_severe_events": top3,
        "common_side_effects": common,
        "data_source": ds,
    }


def build_drug_profiles_response(
    drug_names: List[str],
    *,
    insurance_plan: Optional[Dict[str, Any]],
    profiles_path: Any,
) -> Dict[str, Any]:
    profiles = load_drug_profiles(profiles_path)
    plan_id: Optional[str] = None
    svc: Optional[MockFormularyService] = None
    if insurance_plan:
        cid = str(insurance_plan.get("contractId") or "").strip()
        pid = str(insurance_plan.get("planId") or "").strip()
        if cid and pid:
            plan_id = f"{cid}-{pid}"
            svc = MockFormularyService()

    out_list: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for name in drug_names:
        nk = name.strip().lower()
        if not nk or nk in seen:
            continue
        seen.add(nk)
        sep = build_side_effect_profile_for_drug(nk, profiles)
        ins: Optional[Dict[str, Any]] = None
        if plan_id and svc is not None:
            ins = _coverage_for_drug(nk, plan_id, svc)
        out_list.append(
            {
                "drug_name": nk,
                "side_effect_profile": sep,
                "insurance_coverage": ins,
            }
        )

    return {"drug_profiles": out_list}

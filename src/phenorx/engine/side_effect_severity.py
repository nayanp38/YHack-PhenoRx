"""
Drug side effect severity (WSI) comparison for InteractionResult.side_effect_comparison.

Uses data/drug_side_effect_profiles.json (FDA SPL + CTCAE v5.0). Genotype-independent.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

VERDICT_THRESHOLD = 0.5


def _norm_ae_name(name: str) -> str:
    return (name or "").strip().lower()


def _find_ae(profile: Dict[str, Any], meddra_pt: str) -> Optional[Dict[str, Any]]:
    target = _norm_ae_name(meddra_pt)
    for ae in profile.get("adverse_events") or []:
        if _norm_ae_name(str(ae.get("meddra_pt") or "")) == target:
            return ae
    return None


def _ae_to_frontend(ae: Dict[str, Any]) -> Dict[str, Any]:
    fb = ae.get("frequency_bucket") or "not_reported"
    pct = ae.get("frequency_pct")
    return {
        "meddra_pt": str(ae.get("meddra_pt") or ""),
        "frequency_bucket": fb,
        "frequency_pct": pct if pct is None else float(pct),
        "ctcae_typical_grade": int(ae.get("ctcae_typical_grade") or 0),
        "ctcae_max_grade": int(ae.get("ctcae_max_grade") or 0),
        "severity_weight": int(ae.get("severity_weight") or 0),
        "frequency_weight": float(ae.get("frequency_weight") or 0.0),
        "event_score": float(ae.get("event_score") or 0.0),
        "soc": str(ae.get("soc") or ""),
    }


def _top3_adverse_events(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in raw.get("top_3_severe_events") or []:
        pt = str(item.get("meddra_pt") or "")
        if not pt:
            continue
        full = _find_ae(raw, pt)
        if full:
            out.append(_ae_to_frontend(full))
        else:
            g = int(item.get("ctcae_typical_grade") or 0)
            out.append(
                {
                    "meddra_pt": pt,
                    "frequency_bucket": "not_reported",
                    "frequency_pct": None,
                    "ctcae_typical_grade": g,
                    "ctcae_max_grade": g,
                    "severity_weight": 0,
                    "frequency_weight": 0.1,
                    "event_score": float(item.get("event_score") or 0.0),
                    "soc": "",
                }
            )
    return out


def _severe_ae_names(profile: Dict[str, Any]) -> Set[str]:
    out: Set[str] = set()
    for ae in profile.get("adverse_events") or []:
        if int(ae.get("ctcae_typical_grade") or 0) >= 3:
            n = _norm_ae_name(str(ae.get("meddra_pt") or ""))
            if n:
                out.add(n)
    return out


def _unique_severe_strings(flagged_raw: Dict[str, Any], alt_raw: Dict[str, Any]) -> List[str]:
    flagged_severe = _severe_ae_names(flagged_raw)
    by_name: Dict[str, str] = {}
    for ae in alt_raw.get("adverse_events") or []:
        g = int(ae.get("ctcae_typical_grade") or 0)
        if g < 3:
            continue
        pt = str(ae.get("meddra_pt") or "").strip()
        if not pt:
            continue
        key = _norm_ae_name(pt)
        if key in flagged_severe:
            continue
        if key not in by_name:
            by_name[key] = pt
    return sorted(by_name.values(), key=str.lower)


def _verdict(delta: float) -> str:
    if delta < -VERDICT_THRESHOLD:
        return "BETTER"
    if delta > VERDICT_THRESHOLD:
        return "WORSE"
    return "EQUIVALENT"


def _build_alternative_comparison(
    flagged_wsi: float,
    flagged_raw: Dict[str, Any],
    alt_key: str,
    alt_display: str,
    profiles: Dict[str, Any],
) -> Dict[str, Any]:
    alt_raw = profiles.get(alt_key)
    if not alt_raw:
        return {
            "alternative_drug": alt_display,
            "alternative_wsi": 0.0,
            "severity_delta": 0.0,
            "severity_verdict": "DATA_UNAVAILABLE",
            "alternative_boxed_warning": False,
            "alternative_top_3": [],
            "unique_severe_events": [],
        }
    wsi_alt = float(alt_raw.get("weighted_severity_index") or 0.0)
    delta = round(wsi_alt - flagged_wsi, 4)
    return {
        "alternative_drug": str(alt_raw.get("drug_name") or alt_display),
        "alternative_wsi": wsi_alt,
        "severity_delta": delta,
        "severity_verdict": _verdict(delta),
        "alternative_boxed_warning": bool(alt_raw.get("boxed_warning_flag")),
        "alternative_top_3": _top3_adverse_events(alt_raw),
        "unique_severe_events": _unique_severe_strings(flagged_raw, alt_raw),
    }


def build_side_effect_comparison(
    flagged_drug: str,
    alternative_drugs: List[str],
    profiles: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Returns SideEffectComparison dict or None if flagged drug has no profile."""
    fk = flagged_drug.strip().lower()
    flagged_raw = profiles.get(fk)
    if not flagged_raw:
        return None
    flagged_wsi = float(flagged_raw.get("weighted_severity_index") or 0.0)
    alts: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for alt in alternative_drugs:
        alt_display = str(alt).strip()
        ak = alt_display.lower()
        if not ak or ak in seen:
            continue
        seen.add(ak)
        alts.append(_build_alternative_comparison(flagged_wsi, flagged_raw, ak, alt_display, profiles))

    return {
        "flagged_drug_wsi": round(flagged_wsi, 4),
        "flagged_drug_boxed_warning": bool(flagged_raw.get("boxed_warning_flag")),
        "flagged_drug_top_3": _top3_adverse_events(flagged_raw),
        "alternative_comparisons": alts,
    }


def load_drug_profiles(path: str | Path) -> Dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    data = json.loads(p.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def attach_side_effect_comparison(
    interactions_json: List[Dict[str, Any]],
    profiles: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Sets interaction['side_effect_comparison'] when profiles and flagged drug exist."""
    if not profiles:
        return interactions_json

    for row in interactions_json:
        drug = str(row.get("drug_name") or "")
        alts = row.get("alternative_drugs") or []
        comp = build_side_effect_comparison(drug, [str(x) for x in alts], profiles)
        if comp is not None:
            row["side_effect_comparison"] = comp
    return interactions_json

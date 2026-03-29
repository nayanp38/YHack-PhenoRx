"""
CYPher Side Effect Severity Module v3 — Severity-Adjusted Probability (SAP).

Replaces v2 WSI. Computes SAP from label adverse events with inclusion filters,
quadratic severity weighting, v3 probability defaults, and 0.50 SAP delta verdicts.

See CYPher_Side_Effect_Severity_Module_v3 specification.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# §2.3 — SAP scale; same band as spec worked examples
SAP_VERDICT_THRESHOLD = 0.5
BOXED_WARNING_PENALTY_SAP = 1.0


def _norm_ae_name(name: str) -> str:
    return (name or "").strip().lower()


def estimate_probability(ae: Dict[str, Any]) -> float:
    """§2.2 Change 2 — prefer exact % from label; else bucket defaults."""
    pct = ae.get("frequency_pct")
    if pct is not None:
        try:
            return float(pct) / 100.0
        except (TypeError, ValueError):
            pass
    bucket = str(ae.get("frequency_bucket") or "not_reported").lower().strip()
    if bucket == "very_common":
        return 0.15
    if bucket == "common":
        return 0.05
    if bucket == "uncommon":
        return 0.005
    if bucket == "rare":
        return 0.0005
    if bucket == "very_rare":
        return 0.0001
    return 0.001


def include_in_sap(ae: Dict[str, Any]) -> bool:
    """§2.2 Change 1 — G3+ always; else frequency >= 1%; exclude G1–2 & <1%."""
    g = int(ae.get("ctcae_typical_grade") or 0)
    if g < 1:
        return False
    pr = estimate_probability(ae)
    if g >= 3:
        return True
    if pr >= 0.01:
        return True
    return False


def event_sap_score(ae: Dict[str, Any]) -> float:
    """§2.3 sap_score = probability * (ctcae_grade ** 2)."""
    g = int(ae.get("ctcae_typical_grade") or 0)
    pr = estimate_probability(ae)
    return pr * float(g**2)


def total_sap(raw: Dict[str, Any]) -> float:
    """§2.3 Per-drug SAP including boxed warning penalty."""
    s = 0.0
    for ae in raw.get("adverse_events") or []:
        if include_in_sap(ae):
            s += event_sap_score(ae)
    if raw.get("boxed_warning_flag"):
        s += BOXED_WARNING_PENALTY_SAP
    return round(s, 4)


def _find_ae(profile: Dict[str, Any], meddra_pt: str) -> Optional[Dict[str, Any]]:
    target = _norm_ae_name(meddra_pt)
    for ae in profile.get("adverse_events") or []:
        if _norm_ae_name(str(ae.get("meddra_pt") or "")) == target:
            return ae
    return None


def _ae_to_frontend(ae: Dict[str, Any], sap_score: Optional[float] = None) -> Dict[str, Any]:
    fb = ae.get("frequency_bucket") or "not_reported"
    pct = ae.get("frequency_pct")
    row = {
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
    if sap_score is not None:
        row["sap_score"] = round(sap_score, 6)
    return row


def top_sap_events(raw: Dict[str, Any], k: int = 3) -> List[Dict[str, Any]]:
    """Top-k included events by SAP contribution (for UI)."""
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for ae in raw.get("adverse_events") or []:
        if not include_in_sap(ae):
            continue
        sc = event_sap_score(ae)
        scored.append((sc, ae))
    scored.sort(key=lambda x: -x[0])
    out: List[Dict[str, Any]] = []
    for sc, ae in scored[:k]:
        out.append(_ae_to_frontend(ae, sap_score=sc))
    return out


def _all_flagged_terms(raw: Dict[str, Any]) -> Set[str]:
    return {_norm_ae_name(str(ae.get("meddra_pt") or "")) for ae in (raw.get("adverse_events") or []) if ae.get("meddra_pt")}


def _g3plus_by_pt(aes: List[Dict[str, Any]]) -> Dict[str, Tuple[Dict[str, Any], int, float]]:
    """Preferred AE per pt for G3+ (highest grade if duplicates)."""
    m: Dict[str, Tuple[Dict[str, Any], int, float]] = {}
    for ae in aes:
        g = int(ae.get("ctcae_typical_grade") or 0)
        if g < 3:
            continue
        k = _norm_ae_name(str(ae.get("meddra_pt") or ""))
        if not k:
            continue
        pr = estimate_probability(ae)
        if k not in m or g > m[k][1]:
            m[k] = (ae, g, pr)
    return m


def _short_label(pt: str, kind: str) -> str:
    base = pt.replace("_", " ").strip()
    if len(base) > 24:
        base = base[:22] + "…"
    suf = "(NEW)" if kind == "NEW_RISK" else "(HIG)"
    return f"{base}{suf}"


def compute_actionable_warnings(flagged_raw: Dict[str, Any], alt_raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    §2.5 — NEW_RISK and HIGHER_RISK; top 3 by composite weight.
    NEW: G3+ on alt, not on flagged label, alt frequency >= 0.5%.
    HIG: G3+ on both, absolute frequency increase > 0.5% on alt vs flagged.
    """
    flagged_aes = list(flagged_raw.get("adverse_events") or [])
    alt_aes = list(alt_raw.get("adverse_events") or [])
    flagged_terms = _all_flagged_terms(flagged_raw)
    fm = _g3plus_by_pt(flagged_aes)
    am = _g3plus_by_pt(alt_aes)

    candidates: List[Tuple[float, Dict[str, Any]]] = []

    for k, (ae, g, apr) in am.items():
        pt = str(ae.get("meddra_pt") or "")
        if g < 3 or apr < 0.005:
            continue
        if k not in flagged_terms:
            w = apr * float(g**2)
            candidates.append(
                (
                    w,
                    {
                        "kind": "NEW_RISK",
                        "meddra_pt": pt,
                        "display": _short_label(pt, "NEW_RISK"),
                        "weight": round(w, 6),
                    },
                )
            )
        elif k in fm:
            _fae, fg, fpr = fm[k]
            if fg >= 3 and (apr - fpr) > 0.005:
                w = (apr - fpr) * float(g**2)
                candidates.append(
                    (
                        w,
                        {
                            "kind": "HIGHER_RISK",
                            "meddra_pt": pt,
                            "display": _short_label(pt, "HIGHER_RISK"),
                            "weight": round(w, 6),
                        },
                    )
                )

    candidates.sort(key=lambda x: -x[0])
    return [c[1] for c in candidates[:3]]


def _verdict(delta: float) -> str:
    t = SAP_VERDICT_THRESHOLD
    if delta < -t:
        return "BETTER"
    if delta > t:
        return "WORSE"
    return "EQUIVALENT"


def _build_alternative_comparison(
    flagged_sap: float,
    flagged_raw: Dict[str, Any],
    alt_key: str,
    alt_display: str,
    profiles: Dict[str, Any],
) -> Dict[str, Any]:
    alt_raw = profiles.get(alt_key)
    if not alt_raw:
        return {
            "alternative_drug": alt_display,
            "alternative_sap": 0.0,
            "severity_delta": 0.0,
            "severity_verdict": "DATA_UNAVAILABLE",
            "alternative_boxed_warning": False,
            "alternative_top_3": [],
            "actionable_warnings": [],
        }
    alt_sap = total_sap(alt_raw)
    delta = round(alt_sap - flagged_sap, 4)
    verdict = _verdict(delta)
    warnings = compute_actionable_warnings(flagged_raw, alt_raw)
    return {
        "alternative_drug": str(alt_raw.get("drug_name") or alt_display),
        "alternative_sap": alt_sap,
        "severity_delta": delta,
        "severity_verdict": verdict,
        "alternative_boxed_warning": bool(alt_raw.get("boxed_warning_flag")),
        "alternative_top_3": top_sap_events(alt_raw, 3),
        "actionable_warnings": warnings,
    }


def build_side_effect_comparison(
    flagged_drug: str,
    alternative_drugs: List[str],
    profiles: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Returns side_effect_comparison dict or None if flagged drug has no profile."""
    fk = flagged_drug.strip().lower()
    flagged_raw = profiles.get(fk)
    if not flagged_raw:
        return None
    flagged_sap = total_sap(flagged_raw)
    alts: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for alt in alternative_drugs:
        alt_display = str(alt).strip()
        ak = alt_display.lower()
        if not ak or ak in seen:
            continue
        seen.add(ak)
        alts.append(_build_alternative_comparison(flagged_sap, flagged_raw, ak, alt_display, profiles))

    return {
        "flagged_drug_sap": flagged_sap,
        "flagged_drug_boxed_warning": bool(flagged_raw.get("boxed_warning_flag")),
        "flagged_drug_top_3": top_sap_events(flagged_raw, 3),
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
    if not profiles:
        return interactions_json
    for row in interactions_json:
        drug = str(row.get("drug_name") or "")
        alts = row.get("alternative_drugs") or []
        comp = build_side_effect_comparison(drug, [str(x) for x in alts], profiles)
        if comp is not None:
            row["side_effect_comparison"] = comp
    return interactions_json

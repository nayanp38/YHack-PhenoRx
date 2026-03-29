from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .models import EnzymeBaseline, EnzymeEffectiveState, InteractionResult


RISK_ORDER = {"critical": 0, "high": 1, "moderate": 2, "low": 3, "info": 4}

# MVP: (perpetrator drug lowercased, enzyme) -> (alternatives, note)
_PERPETRATOR_SWAP_BY_ENZYME: Dict[tuple[str, str], Tuple[List[str], str]] = {
    (
        "fluoxetine",
        "CYP2D6",
    ): (
        ["sertraline", "escitalopram", "citalopram"],
        "Consider replacing fluoxetine with a CYP2D6-neutral SSRI to resolve interaction without changing the affected medication.",
    ),
    (
        "paroxetine",
        "CYP2D6",
    ): (
        ["sertraline", "escitalopram", "citalopram"],
        "Consider replacing paroxetine with a CYP2D6-neutral SSRI to resolve interaction without changing the affected medication.",
    ),
    (
        "bupropion",
        "CYP2D6",
    ): (
        ["sertraline", "escitalopram", "citalopram", "venlafaxine"],
        "Consider replacing bupropion with a CYP2D6-neutral antidepressant to resolve interaction.",
    ),
    (
        "omeprazole",
        "CYP2C19",
    ): (
        ["pantoprazole"],
        "Consider replacing omeprazole with pantoprazole (CYP2C19-neutral PPI) to reduce interaction.",
    ),
    (
        "duloxetine",
        "CYP2D6",
    ): (
        ["venlafaxine", "desvenlafaxine"],
        "Consider replacing duloxetine with a CYP2D6-neutral SNRI.",
    ),
}


def _perpetrator_swap(
    perpetrator_drug: Optional[str], inhibited_enzyme: str
) -> Tuple[List[str], str]:
    if not perpetrator_drug:
        return [], ""
    key = (perpetrator_drug.strip().lower(), inhibited_enzyme)
    row = _PERPETRATOR_SWAP_BY_ENZYME.get(key)
    if row is None:
        return [], ""
    alts, note = row
    return list(alts), note


def _exposure_classification_active_drug(aucr: float) -> str:
    if aucr >= 5.0:
        return "Very significantly increased (~5x)"
    if 2.0 <= aucr < 5.0:
        return "Significantly increased (2-<5x)"
    if 1.25 <= aucr < 2.0:
        return "Moderately increased (1.25-<2x)"
    if 0.80 <= aucr < 1.25:
        return "No clinically significant change"
    if 0.50 <= aucr < 0.80:
        return "Moderately decreased (0.5-<0.8x)"
    if 0.20 <= aucr < 0.50:
        return "Significantly decreased (0.2-<0.5x)"
    return "Very significantly decreased (<0.2x)"


def exposure_classification_from_aucr(aucr: float, substrate_type: str | None = None) -> str:
    """
    Human-readable exposure band. For prodrugs, high parent AUCR reflects impaired activation
    (efficacy risk), not toxicity from increased active drug exposure.
    """
    st = substrate_type or "active_drug"
    if st == "prodrug":
        if aucr >= 5.0:
            return "Prodrug activation blocked; zero or near-zero conversion to active metabolite"
        if 2.0 <= aucr < 5.0:
            return "Prodrug activation severely impaired; substantially reduced conversion to active metabolite"
        if 1.25 <= aucr < 2.0:
            return "Prodrug activation moderately impaired; reduced conversion to active metabolite"
        return _exposure_classification_active_drug(aucr)
    return _exposure_classification_active_drug(aucr)


def predicted_aucr(
    *,
    baseline_activity: float,
    effective_activity: float,
    aucr_strong_inhibitor: float | None,
    fm_cyp: float | None,
) -> float:
    if aucr_strong_inhibitor is not None:
        if baseline_activity <= 0:
            # If baseline enzyme is already non-functional, treat as fully inhibited.
            return float(aucr_strong_inhibitor)
        ratio = effective_activity / baseline_activity
        return 1.0 + (aucr_strong_inhibitor - 1.0) * (1.0 - ratio)

    if fm_cyp is None:
        raise ValueError("Missing both aucr_strong_inhibitor and fm_cyp")

    if baseline_activity <= 0:
        r = 0.0
    else:
        r = effective_activity / baseline_activity

    # FDA basic static model (effective clearance ratio): AUCR = 1 / (1 - fm*(1 - R))
    denom = 1.0 - fm_cyp * (1.0 - r)
    if denom <= 0:
        return 1e9
    return 1.0 / denom


def assign_risk_level(
    *,
    aucr: float,
    substrate_type: str | None,
    therapeutic_window: str | None,
    effective_activity: float,
) -> str:
    substrate_type = substrate_type or "active_drug"
    window = therapeutic_window

    if aucr >= 5.0:
        return "critical"
    if window == "narrow" and aucr >= 2.0:
        return "critical"
    if substrate_type == "prodrug" and effective_activity == 0.0:
        return "critical"

    if 2.0 <= aucr < 5.0 and window == "moderate":
        return "high"
    if 1.25 <= aucr < 2.0:
        return "moderate"
    if window == "wide" and 2.0 <= aucr < 5.0:
        return "moderate"
    if 1.0 <= aucr < 1.25:
        return "low"
    if 0.80 <= aucr < 1.25:
        return "info"
    return "info"


def clinical_consequence_text(
    *,
    aucr: float,
    substrate_type: str | None,
    therapeutic_window: str | None,
    effective_activity: float,
) -> str:
    st = substrate_type or "active_drug"
    tw = therapeutic_window or "Any"

    if st == "prodrug":
        if effective_activity == 0.0:
            return "High-Critical: Prodrug activation blocked (reduced/zero efficacy); switch to alternative."
        return "High-Critical: Reduced prodrug activation; consider alternative or dose adjustment."

    # Active drug.
    if aucr >= 5.0:
        if tw == "narrow":
            return "Critical: Toxicity risk; dose reduction or switch strongly recommended."
        return "High: Enhanced effect/ADR risk; consider dose adjustment."
    if 2.0 <= aucr < 5.0:
        if tw in {"moderate", "narrow"}:
            return "High: Enhanced effect/ADR risk; consider dose adjustment."
        return "Moderate: Enhanced effect; monitor and consider adjustment."
    if 1.25 <= aucr < 2.0:
        return "Moderate: Mild-to-moderate exposure increase; consider dose adjustment/monitoring."
    if 0.80 <= aucr < 1.25:
        return "Info: No clinically significant exposure change predicted."
    if aucr < 0.80:
        return "Moderate-High: Reduced exposure; consider dose increase or alternative."

    return "Info: No clinically significant exposure change predicted."


def evaluate_drug_risks(
    *,
    drug_matrix: Dict[str, Dict[str, object]],
    effective_enzymes: Dict[str, EnzymeEffectiveState],
    enzyme_baselines: Dict[str, EnzymeBaseline],
) -> List[InteractionResult]:
    """
    Evaluate each medication against every enzyme column in the classification matrix where
    the drug is a substrate (no single-enzyme filter; all enzymes are considered).
    """
    results: List[InteractionResult] = []

    for drug_name, enzyme_map in drug_matrix.items():
        for enzyme_name, cell in enzyme_map.items():
            role = getattr(cell, "role", "irrelevant")
            substrate_type = getattr(cell, "substrate_type", None)
            if role not in {"substrate", "substrate_and_inhibitor"}:
                continue
            if substrate_type is None:
                continue

            baseline = enzyme_baselines.get(enzyme_name)
            effective = effective_enzymes.get(enzyme_name)
            if baseline is None or effective is None:
                continue

            fm = getattr(cell, "fm_cyp", None)
            aucr_strong = getattr(cell, "aucr_strong_inhibitor", None)

            baseline_activity = baseline.activity_score
            effective_activity = effective.effective_activity_score

            aucr = predicted_aucr(
                baseline_activity=baseline_activity,
                effective_activity=effective_activity,
                aucr_strong_inhibitor=aucr_strong,
                fm_cyp=fm,
            )

            exposure_class = exposure_classification_from_aucr(aucr, substrate_type)
            tw = getattr(cell, "therapeutic_window", None)
            perp = effective.dominant_perpetrator_drug

            perp_alts, perp_note = _perpetrator_swap(perp, enzyme_name)

            # Risk level: special prodrug "activity reduced >50%"
            risk = None
            if (substrate_type == "prodrug") and baseline_activity > 0:
                reduction_frac = (baseline_activity - effective_activity) / baseline_activity
                if effective_activity == 0.0:
                    risk = "critical"
                elif reduction_frac >= 0.5:
                    risk = "high"
                else:
                    # Not explicitly covered in the risk table for prodrugs;
                    # keep it conservative but non-critical.
                    risk = "moderate"

            if risk is None:
                risk = assign_risk_level(
                    aucr=aucr,
                    substrate_type=substrate_type,
                    therapeutic_window=tw,
                    effective_activity=effective_activity,
                )

            consequence = clinical_consequence_text(
                aucr=aucr,
                substrate_type=substrate_type,
                therapeutic_window=tw,
                effective_activity=effective_activity,
            )

            alternative_drugs = getattr(cell, "alternative_drugs", []) or []
            evidence_sources = getattr(cell, "evidence_sources", []) or []

            results.append(
                InteractionResult(
                    drug_name=drug_name,
                    enzyme_name=enzyme_name,
                    baseline_phenotype=effective.baseline_phenotype,
                    effective_phenotype=effective.effective_phenotype,
                    perpetrator_drug=perp,
                    predicted_aucr=round(float(aucr), 4),
                    exposure_classification=exposure_class,
                    clinical_consequence=consequence,
                    risk_level=risk,
                    alternative_drugs=[str(x) for x in alternative_drugs],
                    evidence_sources=[str(x) for x in evidence_sources],
                    perpetrator_alternatives=perp_alts,
                    perpetrator_alternative_note=perp_note,
                    perpetrator_strength=(
                        effective.perpetrator_strength if perp else None
                    ),
                    effective_activity_score=effective_activity,
                    baseline_activity_score=baseline_activity,
                )
            )

    # Only "flagged" interactions (exclude purely info/no-change)
    flagged = [r for r in results if r.risk_level in {"critical", "high", "moderate", "low"}]
    flagged.sort(key=lambda r: (RISK_ORDER.get(r.risk_level, 99), -r.predicted_aucr, r.drug_name))
    return flagged


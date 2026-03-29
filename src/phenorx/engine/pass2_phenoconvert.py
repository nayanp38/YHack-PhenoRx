from __future__ import annotations

from typing import Dict, Optional

from .genotype_parser import activity_to_phenotype
from .models import EnzymeBaseline, EnzymeEffectiveState
from .pass1_classify import COVERED_ENZYMES


INHIBITOR_FACTORS = {
    "CYP2D6": {"strong": 0.0, "moderate": 0.5, "weak": 1.0},
    "CYP2C19": {"strong": 0.15, "moderate": 0.40, "weak": 0.63},
    "CYP2C9": {"strong": 0.20, "moderate": 0.50, "weak": 0.80},
    "CYP3A4": {"strong": 0.20, "moderate": 0.40, "weak": 0.80},
}

STRENGTH_RANK = {"none": 0, None: 0, "weak": 1, "moderate": 2, "strong": 3}


def _strongest_inhibitor_on_list(drug_matrix: Dict[str, Dict[str, object]], enzyme: str) -> tuple[Optional[str], Optional[str]]:
    best_drug: Optional[str] = None
    best_strength: Optional[str] = None
    best_rank = -1

    for drug_name, enzyme_map in drug_matrix.items():
        cell = enzyme_map.get(enzyme)
        if cell is None:
            continue
        # roles are in cell.role; type is DrugClassificationCell but keep duck-typed
        role = getattr(cell, "role", None)
        if role not in {"inhibitor", "substrate_and_inhibitor"}:
            continue

        strength = getattr(cell, "inhibitor_strength", None)
        rank = STRENGTH_RANK.get(strength, 0)
        if rank > best_rank:
            best_drug = drug_name
            best_strength = strength
            best_rank = rank

    return best_drug, best_strength


def compute_effective_activity(
    enzyme_baselines: Dict[str, EnzymeBaseline],
    drug_matrix: Dict[str, Dict[str, object]],
) -> Dict[str, EnzymeEffectiveState]:
    """
    For each enzyme defined in INHIBITOR_FACTORS, if the patient has a baseline for that
    enzyme, apply the strongest co-administered inhibitor on that enzyme independently.
    """
    results: Dict[str, EnzymeEffectiveState] = {}

    for enzyme in INHIBITOR_FACTORS:
        baseline = enzyme_baselines.get(enzyme)
        if baseline is None:
            continue

        dominant_drug, dominant_strength = _strongest_inhibitor_on_list(drug_matrix, enzyme)

        factors = INHIBITOR_FACTORS[enzyme]
        factor = factors.get(dominant_strength, 1.0) if dominant_strength is not None else 1.0

        if enzyme == "CYP2D6" and dominant_strength == "strong":
            effective = 0.0
        else:
            effective = round(baseline.activity_score * factor, 4)

        baseline_phenotype = baseline.phenotype
        effective_phenotype = (
            "Default" if enzyme == "CYP3A4" else activity_to_phenotype(enzyme, effective)
        )
        results[enzyme] = EnzymeEffectiveState(
            enzyme_name=enzyme,
            baseline_activity_score=baseline.activity_score,
            baseline_phenotype=baseline_phenotype,
            effective_activity_score=effective,
            effective_phenotype=effective_phenotype,
            dominant_perpetrator_drug=dominant_drug,
            perpetrator_strength=dominant_strength,
        )

    return results


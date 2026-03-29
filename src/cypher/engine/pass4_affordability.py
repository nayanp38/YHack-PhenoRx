from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import AffordabilityResult, FormularyEntry, InteractionResult, RankedAlternative
from cypher.data.formulary_service import FormularyService, get_service_for_patient


def _affordability_sort_key(item: Tuple[str, FormularyEntry]) -> tuple:
    """
    Sort key that ranks alternatives:
      1. Covered drugs before uncovered ones
      2. Lower tier number first (tier 1 generic is cheapest)
      3. No prior auth before prior auth required

    Deliberately does not sort by any cost estimate, because the current
    affordability pass is based only on real formulary signals.
    """
    _, fe = item
    covered_rank = 0 if fe.covered else 1
    tier = fe.tier if fe.tier is not None else 99
    prior_auth_rank = 1 if fe.prior_auth_required else 0
    return (covered_rank, tier, prior_auth_rank)


def rank_alternatives_by_affordability(
    interactions: List[InteractionResult],
    insurance: Optional[Dict[str, Any]] = None,
    *,
    formulary_service: Optional[FormularyService] = None,
    cms_db_path: Optional[Path] = None,
    rxnorm_cache_path: Optional[Path] = None,
) -> List[AffordabilityResult]:
    """
    Pass 4: For each flagged interaction that has alternative drugs, look up
    each alternative in the patient's formulary and rank them by affordability.

    Args:
        interactions:      Output of pass 3 (evaluate_drug_risks).
        insurance:         Optional dict with keys:
                             - plan_id (str): insurer plan identifier
                             - plan_type (str): "medicare" | "commercial" | "medicaid"
        formulary_service: Injectable formulary backend (overrides auto-selection).
        cms_db_path:       Path to the CMS formulary SQLite DB (Medicare patients).
        rxnorm_cache_path: Path to the RxNorm JSON cache file.

    Returns:
        List of AffordabilityResult, one per interaction that has alternatives,
        with alternatives sorted cheapest-first.
    """
    if formulary_service is None:
        formulary_service = get_service_for_patient(
            insurance,
            cms_db_path=cms_db_path,
            rxnorm_cache_path=rxnorm_cache_path,
        )

    plan_id: Optional[str] = insurance.get("plan_id") if insurance else None

    results: List[AffordabilityResult] = []

    for interaction in interactions:
        if not interaction.alternative_drugs:
            continue

        # Look up formulary entry for each alternative drug
        entries: List[Tuple[str, FormularyEntry]] = [
            (drug, formulary_service.lookup(drug, plan_id))
            for drug in interaction.alternative_drugs
        ]

        entries.sort(key=_affordability_sort_key)

        ranked = [
            RankedAlternative(
                drug_name=drug,
                covered=fe.covered,
                tier=fe.tier,
                tier_label=fe.tier_label,
                prior_auth_required=fe.prior_auth_required,
                affordability_rank=i + 1,
            )
            for i, (drug, fe) in enumerate(entries)
        ]

        results.append(
            AffordabilityResult(
                interaction_drug=interaction.drug_name,
                enzyme_name=interaction.enzyme_name,
                risk_level=interaction.risk_level,
                ranked_alternatives=ranked,
            )
        )

    return results

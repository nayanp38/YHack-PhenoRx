from __future__ import annotations

from dataclasses import asdict
from typing import Dict, Tuple

from .models import BaselineMap, EnzymeBaseline


DEFAULT_ALLELE_FUNCTION: Dict[str, Dict[str, float]] = {
    "CYP2D6": {
        "*1": 1.0,
        "*2": 1.0,
        "*33": 1.0,
        "*35": 1.0,
        "*9": 0.5,
        "*17": 0.5,
        "*29": 0.5,
        "*41": 0.5,
        "*10": 0.25,
        "*3": 0.0,
        "*4": 0.0,
        "*5": 0.0,
        "*6": 0.0,
        "*36": 0.0,
    },
    "CYP2C19": {
        "*1": 1.0,
        "*2": 0.0,
        "*3": 0.0,
        "*9": 0.5,
        "*17": 1.5,
    },
    "CYP2C9": {
        "*1": 1.0,
        "*2": 0.5,
        "*3": 0.0,
    },
}


def _parse_allele_with_copy_number(allele_token: str) -> Tuple[str, int]:
    """
    Parse star allele tokens with optional copy notation.
    Examples:
      *1 -> ("*1", 1)
      *2xN -> ("*2", 2)  # minimum deterministic fallback for unknown N
      *1x3 -> ("*1", 3)
    """
    token = allele_token.strip()
    if "x" not in token:
        return token, 1

    base, copy_part = token.split("x", maxsplit=1)
    if copy_part.upper() == "N":
        return base, 2

    try:
        copies = int(copy_part)
    except ValueError:
        copies = 1
    return base, max(copies, 1)


def _allele_activity(gene: str, allele_token: str, allele_function_map: Dict[str, Dict[str, float]]) -> float:
    base_allele, copies = _parse_allele_with_copy_number(allele_token)
    per_copy = allele_function_map.get(gene, {}).get(base_allele, 0.0)
    return per_copy * copies


def activity_to_phenotype(gene: str, score: float) -> str:
    if gene == "CYP2D6":
        if score == 0:
            return "Poor Metabolizer"
        if 0 < score < 1.25:
            return "Intermediate Metabolizer"
        if 1.25 <= score <= 2.25:
            return "Normal Metabolizer"
        return "Ultrarapid Metabolizer"

    if gene == "CYP2C19":
        if score <= 0:
            return "Poor Metabolizer"
        if 0 < score < 0.5:
            return "Poor Metabolizer"
        if 0.5 <= score <= 1.0:
            return "Intermediate Metabolizer"
        if 1.5 <= score <= 2.0:
            return "Normal Metabolizer"
        if score == 2.5:
            return "Rapid Metabolizer"
        if score >= 3.0:
            return "Ultrarapid Metabolizer"
        return "Indeterminate"

    if gene == "CYP2C9":
        if score <= 0.5:
            return "Poor Metabolizer"
        if 0.5 < score < 1.5:
            return "Intermediate Metabolizer"
        return "Normal Metabolizer"

    return "Unknown"


def genotype_to_activity(
    genotypes: Dict[str, str],
    allele_function_map: Dict[str, Dict[str, float]] | None = None,
) -> BaselineMap:
    """
    Step 4.1 implementation:
    map diplotypes (e.g. *1/*4) to baseline activity score and phenotype.
    """
    allele_function_map = allele_function_map or DEFAULT_ALLELE_FUNCTION
    baseline: BaselineMap = {}

    for gene, diplotype in genotypes.items():
        parts = [p.strip() for p in diplotype.split("/") if p.strip()]
        if len(parts) != 2:
            raise ValueError(f"Invalid diplotype format for {gene}: {diplotype}")

        score = _allele_activity(gene, parts[0], allele_function_map) + _allele_activity(
            gene, parts[1], allele_function_map
        )
        baseline[gene] = EnzymeBaseline(
            enzyme_name=gene,
            activity_score=round(score, 4),
            phenotype=activity_to_phenotype(gene, score),
            diplotype=diplotype,
        )

    return baseline


__all__ = ["genotype_to_activity", "baseline_as_dict", "activity_to_phenotype"]


def baseline_as_dict(baseline: BaselineMap) -> Dict[str, Dict[str, str | float]]:
    return {gene: asdict(info) for gene, info in baseline.items()}


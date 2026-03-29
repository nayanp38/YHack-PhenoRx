from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import requests


CPIC_ALLELE_ENDPOINT = "https://api.cpicpgx.org/v1/allele"


def fetch_cpic_alleles(timeout_seconds: int = 30) -> Any:
    """
    Source data from CPIC API (raw).
    """
    response = requests.get(CPIC_ALLELE_ENDPOINT, timeout=timeout_seconds)
    response.raise_for_status()
    return response.json()


def save_raw_cpic_payload(payload: Any, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_raw_cpic_payload(input_path: str | Path) -> Any:
    return json.loads(Path(input_path).read_text(encoding="utf-8"))


def preprocess_allele_function_map(raw_payload: Any) -> Dict[str, Dict[str, float]]:
    """
    Normalize CPIC records into a simple map:
      { gene: { '*allele': activity_value } }

    The CPIC schema can vary by endpoint version, so this parser uses
    defensive key checks and falls back to known values for MVP genes.
    """
    gene_map: Dict[str, Dict[str, float]] = {"CYP2D6": {}, "CYP2C19": {}, "CYP2C9": {}}

    for row in raw_payload if isinstance(raw_payload, list) else []:
        gene = str(row.get("genesymbol") or row.get("gene") or "").upper()
        if gene not in gene_map:
            continue

        name = row.get("name") or row.get("allele") or row.get("allele_name")
        if not name:
            continue

        allele = str(name).strip()
        if not allele.startswith("*"):
            continue

        activity = row.get("activity_value")
        if activity is None:
            continue
        try:
            gene_map[gene][allele] = float(activity)
        except (TypeError, ValueError):
            continue

    # Minimal deterministic fallback values if API fields do not provide activity values.
    if not gene_map["CYP2D6"]:
        gene_map["CYP2D6"].update({"*1": 1.0, "*2": 1.0, "*4": 0.0, "*5": 0.0, "*10": 0.25, "*41": 0.5})
    if not gene_map["CYP2C19"]:
        gene_map["CYP2C19"].update({"*1": 1.0, "*2": 0.0, "*3": 0.0, "*17": 1.5, "*9": 0.5})
    if not gene_map["CYP2C9"]:
        gene_map["CYP2C9"].update({"*1": 1.0, "*2": 0.5, "*3": 0.0})

    return gene_map


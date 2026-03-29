from __future__ import annotations

import json
from pathlib import Path

from cypher.engine.genotype_parser import baseline_as_dict, genotype_to_activity


ROOT = Path(__file__).resolve().parents[1]
ALLELE_MAP_PATH = ROOT / "data" / "processed" / "cpic_allele_function_map.json"


DEMO_PATIENT = {
    "patient_id": "PT-DEMO-001",
    "genotypes": {
        "CYP2D6": "*1/*4",
        "CYP2C19": "*1/*1",
        "CYP2C9": "*1/*2",
    },
}


def main() -> None:
    allele_map = None
    if ALLELE_MAP_PATH.exists():
        allele_map = json.loads(ALLELE_MAP_PATH.read_text(encoding="utf-8"))

    baseline = genotype_to_activity(DEMO_PATIENT["genotypes"], allele_map)
    output = {
        "patient_id": DEMO_PATIENT["patient_id"],
        "step": "4.1_pre_pipeline_genotype_to_baseline_activity",
        "enzyme_baselines": baseline_as_dict(baseline),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()


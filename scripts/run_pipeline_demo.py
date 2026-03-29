from __future__ import annotations

import json
from pathlib import Path

from phenorx.data.knowledge_base_loader import load_knowledge_base
from phenorx.engine.genotype_parser import genotype_to_activity
from phenorx.engine.pipeline import run_pipeline, load_default_allele_map


ROOT = Path(__file__).resolve().parents[1]
KB_PATH = ROOT / "data" / "knowledge_base.json"
PATIENTS_PATH = ROOT / "data" / "demo_patients.json"
PROCESSED_DIR = ROOT / "data" / "processed"

# CMS Medicare formulary DB (built by scripts/build_cms_formulary.py).
# If the file does not exist the pipeline falls back to mock formulary data.
CMS_DB_PATH = ROOT / "data" / "cms" / "processed" / "formulary.db"
RXNORM_CACHE_PATH = ROOT / "data" / "cms" / "processed" / "rxnorm_cache.json"


def main() -> None:
    knowledge_base = load_knowledge_base(KB_PATH)
    allele_function_map = load_default_allele_map(PROCESSED_DIR)

    cms_db = CMS_DB_PATH if CMS_DB_PATH.exists() else None
    rxnorm_cache = RXNORM_CACHE_PATH if RXNORM_CACHE_PATH.exists() else None
    if cms_db:
        import sys
        print(f"[info] Using CMS Medicare formulary DB: {cms_db}", file=sys.stderr)
    else:
        import sys
        print("[info] CMS formulary DB not found — using mock formulary data.", file=sys.stderr)
        print("[info] Run: PYTHONPATH=src python3 scripts/build_cms_formulary.py", file=sys.stderr)

    patients = json.loads(PATIENTS_PATH.read_text(encoding="utf-8"))
    outputs = []

    for patient in patients:
        out = run_pipeline(
            patient,
            knowledge_base=knowledge_base,
            allele_function_map=allele_function_map,
            cms_db_path=cms_db,
            rxnorm_cache_path=rxnorm_cache,
        )
        outputs.append(out)

    print(json.dumps(outputs, indent=2))


if __name__ == "__main__":
    main()


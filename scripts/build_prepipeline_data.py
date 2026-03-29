from __future__ import annotations

import json
from pathlib import Path

from cypher.etl.cpic_loader import (
    fetch_cpic_alleles,
    preprocess_allele_function_map,
    save_raw_cpic_payload,
)


ROOT = Path(__file__).resolve().parents[1]
RAW_OUT = ROOT / "data" / "raw" / "cpic_alleles_raw.json"
PROCESSED_OUT = ROOT / "data" / "processed" / "cpic_allele_function_map.json"


def main() -> None:
    payload = fetch_cpic_alleles()
    save_raw_cpic_payload(payload, RAW_OUT)
    allele_map = preprocess_allele_function_map(payload)
    PROCESSED_OUT.parent.mkdir(parents=True, exist_ok=True)
    PROCESSED_OUT.write_text(json.dumps(allele_map, indent=2), encoding="utf-8")
    print(f"Wrote raw payload: {RAW_OUT}")
    print(f"Wrote preprocessed map: {PROCESSED_OUT}")


if __name__ == "__main__":
    main()


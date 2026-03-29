"""
One-time setup script: downloads CMS Medicare Part D / MA-PD formulary data,
builds a local SQLite database, and pre-warms the RxNorm cache for all drugs
in the knowledge base.

Run once per year when CMS releases updated formulary files.

Usage
-----
# Auto-download from CMS (update --cms-url if the link has changed):
  PYTHONPATH=src python3 scripts/build_cms_formulary.py

# Use already-downloaded CSV files (faster, avoids re-download):
  PYTHONPATH=src python3 scripts/build_cms_formulary.py \\
      --formulary-csv data/cms/raw/basic_drugs.csv \\
      --plan-csv data/cms/raw/plan_information.csv

# Skip RxNorm cache warm-up (if you just want the DB):
  PYTHONPATH=src python3 scripts/build_cms_formulary.py --skip-rxnorm

Where to find the latest CMS formulary ZIP
-------------------------------------------
  https://www.cms.gov/medicare/prescription-drug-coverage/prescriptiondrugcovgenin/downloads
  Look for "Prescription Drug Plan Formulary, Pharmacy Network, and Pricing Information"
  Update CMS_FORMULARY_URL in src/phenorx/data/cms_etl.py with the new URL each year.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from phenorx.data.cms_etl import CMS_FORMULARY_URL, build_formulary_db, download_cms_zip
from phenorx.data.knowledge_base_loader import load_knowledge_base
from phenorx.data.rxnorm_service import RxNormService

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "cms" / "raw"
PROCESSED_DIR = ROOT / "data" / "cms" / "processed"
DB_PATH = PROCESSED_DIR / "formulary.db"
RXNORM_CACHE_PATH = PROCESSED_DIR / "rxnorm_cache.json"
KB_PATH = ROOT / "data" / "knowledge_base.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the CMS Medicare formulary SQLite database.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--formulary-csv",
        type=Path,
        help="Path to already-downloaded CMS formulary CSV (skips download)",
    )
    parser.add_argument(
        "--plan-csv",
        type=Path,
        help="Path to already-downloaded CMS plan information CSV (skips download)",
    )
    parser.add_argument(
        "--cms-url",
        default=CMS_FORMULARY_URL,
        help="CMS formulary ZIP download URL (update annually)",
    )
    parser.add_argument(
        "--skip-rxnorm",
        action="store_true",
        help="Skip RxNorm cache warm-up",
    )
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # Step 1: Get CSV files (download or use provided paths)
    # ------------------------------------------------------------------
    if args.formulary_csv and args.plan_csv:
        formulary_csv = args.formulary_csv
        plan_csv = args.plan_csv
        print("Using provided CSV files (skipping download).")
    else:
        print("Step 1: Downloading CMS formulary files...")
        formulary_csv, plan_csv = download_cms_zip(args.cms_url, RAW_DIR)

    # ------------------------------------------------------------------
    # Step 2: Build SQLite database
    # ------------------------------------------------------------------
    print("\nStep 2: Building formulary database...")
    build_formulary_db(DB_PATH, formulary_csv, plan_csv)

    # ------------------------------------------------------------------
    # Step 3: Warm RxNorm cache for all KB drugs + their alternatives
    # ------------------------------------------------------------------
    if not args.skip_rxnorm:
        print("\nStep 3: Warming RxNorm cache...")
        kb = load_knowledge_base(KB_PATH)

        drug_names: list[str] = []
        for (drug, _), record in kb.items():
            drug_names.append(drug)
            drug_names.extend(record.get("alternative_drugs") or [])
        drug_names = list(dict.fromkeys(drug_names))  # deduplicate, preserve order

        print(f"  {len(drug_names)} unique drugs to cache")
        rxnorm = RxNormService(RXNORM_CACHE_PATH)
        rxnorm.warm_cache(drug_names)
        print(f"  RxNorm cache saved → {RXNORM_CACHE_PATH}")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("Setup complete.")
    print(f"  Formulary DB : {DB_PATH}")
    if not args.skip_rxnorm:
        print(f"  RxNorm cache : {RXNORM_CACHE_PATH}")
    print()
    print("Run the pipeline:")
    print("  PYTHONPATH=src python3 scripts/run_pipeline_demo.py")
    print("=" * 60)


if __name__ == "__main__":
    main()

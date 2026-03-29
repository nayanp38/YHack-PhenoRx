from __future__ import annotations

"""
CMS Medicare Part D / Medicare Advantage formulary ETL.

Downloads the annual CMS formulary ZIP and builds a local SQLite database
indexed for fast (plan_id, ndc) lookups.

CMS publishes updated formulary files each quarter at:
  https://www.cms.gov/medicare/prescription-drug-coverage/prescriptiondrugcovgenin/downloads

Download the ZIP manually and pass --formulary-csv / --plan-csv to the build
script, or set --cms-url to auto-download.
"""

import csv
import io
import sqlite3
import zipfile
from pathlib import Path
from typing import Optional

import requests

# CMS publishes formulary updates quarterly as SPUF (Standard Plan Update File) ZIPs.
# Latest: Q4 2025 / Plan Year 2026, released 2026-01-07
# To find newer releases: https://catalog.data.gov/dataset/quarterly-prescription-drug-plan-formulary-pharmacy-network-and-pricing-information
CMS_FORMULARY_URL = (
    "https://data.cms.gov/sites/default/files/2026-01/5942aa7e-a0c4-4e65-bd56-32608c33649f/SPUF_2026_20260107.zip"
)

# CMS files use pipe delimiter
_DELIMITER = "|"

# Accepted column name variants across different CMS file versions
# The formulary file contains RXCUI directly — we use that instead of NDC
# so lookups are simpler and more reliable.
_FORMULARY_COLS: dict[str, list[str]] = {
    "formulary_id": ["FORMULARY_ID", "FormularyID", "formulary_id"],
    "rxcui":        ["RXCUI", "rxcui", "RxCUI"],
    "tier":         ["TIER_LEVEL_VALUE", "TierLevelValue", "TIER", "tier_level_value"],
    "prior_auth":   ["PRIOR_AUTHORIZATION_YN", "PriorAuthorizationYN", "PRIOR_AUTH_YN"],
    "step_therapy": ["STEP_THERAPY_YN", "StepTherapyYN", "STEP_THERAPY"],
    "qty_limit":    ["QUANTITY_LIMIT_YN", "QuantityLimitYN", "QTY_LIMIT_YN"],
}

_PLAN_COLS: dict[str, list[str]] = {
    "contract_id":  ["CONTRACT_ID", "ContractID", "contract_id"],
    "plan_id":      ["PLAN_ID", "PlanID", "plan_id"],
    "plan_name":    ["PLAN_NAME", "PlanName", "plan_name"],
    "formulary_id": ["FORMULARY_ID", "FormularyID", "formulary_id"],
    "plan_type":    ["PLAN_TYPE", "PlanType", "plan_type"],
}

_BATCH_SIZE = 100_000


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def build_formulary_db(
    db_path: Path,
    formulary_csv: Path,
    plan_info_csv: Path,
) -> None:
    """
    Parse CMS formulary and plan CSV files and write a SQLite database.

    Args:
        db_path:        Output path for the SQLite file.
        formulary_csv:  Path to the CMS basic_drugs / formulary CSV.
        plan_info_csv:  Path to the CMS plan information CSV.
    """
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    _create_schema(conn)

    print(f"Loading formulary file: {formulary_csv}")
    _load_formulary(conn, formulary_csv)

    print(f"Loading plan info file: {plan_info_csv}")
    _load_plans(conn, plan_info_csv)

    conn.close()
    size_mb = db_path.stat().st_size / 1_048_576
    print(f"Database written → {db_path}  ({size_mb:.1f} MB)")


def download_cms_zip(url: str, dest_dir: Path) -> tuple[Path, Path]:
    """
    Download the CMS SPUF ZIP and extract the formulary and plan info CSVs.

    The SPUF is a ZIP of inner ZIPs (~2.3 GB outer file). This function
    streams the outer ZIP to disk, then extracts only the two inner ZIPs
    we need, then extracts the CSVs from those.

    Returns:
        (formulary_csv_path, plan_info_csv_path)
    """
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Stream outer ZIP to disk to avoid loading 2+ GB into memory
    outer_zip_path = dest_dir / "SPUF_outer.zip"
    print(f"Downloading CMS SPUF (~2.3 GB) from:\n  {url}")
    print("This will take a few minutes...")
    with requests.get(url, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        total = 0
        with open(outer_zip_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8 * 1024 * 1024):
                f.write(chunk)
                total += len(chunk)
                print(f"  Downloaded {total / 1_048_576:.0f} MB...", end="\r")
    print(f"\nDownload complete: {outer_zip_path}")

    # Identify the two inner ZIPs we need
    with zipfile.ZipFile(outer_zip_path) as outer:
        names = outer.namelist()
        print(f"Outer ZIP contents: {names}")

        formulary_inner = _pick_zip_entry(names, ["basic drugs", "basic_drugs", "formulary"])
        plan_inner = _pick_zip_entry(names, ["plan information", "plan_information", "plan_info"])

        if formulary_inner is None or plan_inner is None:
            raise ValueError(
                "Could not identify formulary/plan inner ZIPs.\n"
                f"Contents: {names}\n"
                "Pass --formulary-csv and --plan-csv manually to work around this."
            )

        print(f"Extracting inner ZIPs:\n  {formulary_inner}\n  {plan_inner}")
        formulary_inner_path = dest_dir / Path(formulary_inner).name
        plan_inner_path = dest_dir / Path(plan_inner).name

        with open(formulary_inner_path, "wb") as f:
            f.write(outer.read(formulary_inner))
        with open(plan_inner_path, "wb") as f:
            f.write(outer.read(plan_inner))

    # Extract CSVs from the inner ZIPs
    formulary_csv = _extract_csv_from_zip(formulary_inner_path, dest_dir, ["basic", "drug", "formulary"])
    plan_csv = _extract_csv_from_zip(plan_inner_path, dest_dir, ["plan"])

    print(f"CSVs ready:\n  {formulary_csv}\n  {plan_csv}")
    return formulary_csv, plan_csv


def _extract_csv_from_zip(zip_path: Path, dest_dir: Path, keywords: list[str]) -> Path:
    """Extract the first matching CSV from a ZIP file."""
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        entry = _pick_zip_entry(names, keywords) or (names[0] if names else None)
        if entry is None:
            raise ValueError(f"No CSV found in {zip_path}")
        out_path = dest_dir / Path(entry).name
        with open(out_path, "wb") as f:
            f.write(zf.read(entry))
        return out_path


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS formulary (
            formulary_id    TEXT NOT NULL,
            rxcui           TEXT NOT NULL,
            tier            INTEGER,
            prior_auth      INTEGER DEFAULT 0,
            step_therapy    INTEGER DEFAULT 0,
            qty_limit       INTEGER DEFAULT 0,
            PRIMARY KEY (formulary_id, rxcui)
        );
        CREATE TABLE IF NOT EXISTS plans (
            contract_id     TEXT NOT NULL,
            plan_id         TEXT NOT NULL,
            plan_name       TEXT,
            formulary_id    TEXT,
            plan_type       TEXT,
            PRIMARY KEY (contract_id, plan_id)
        );
        CREATE INDEX IF NOT EXISTS idx_formulary_lookup
            ON formulary (formulary_id, rxcui);
        CREATE INDEX IF NOT EXISTS idx_plans_lookup
            ON plans (contract_id, plan_id);
    """)
    conn.commit()


def _load_formulary(conn: sqlite3.Connection, path: Path) -> None:
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f, delimiter=_DELIMITER)
        header = list(reader.fieldnames or [])
        cols = {k: _pick_col(header, v) for k, v in _FORMULARY_COLS.items()}

        batch: list[tuple] = []
        total = 0

        for row in reader:
            rxcui = (row.get(cols["rxcui"] or "", "") or "").strip()
            if not rxcui:
                continue

            batch.append((
                _s(row, cols["formulary_id"]),
                rxcui,
                _int_or_none(row.get(cols["tier"] or "", "")),
                _yn(row.get(cols["prior_auth"] or "", "")),
                _yn(row.get(cols["step_therapy"] or "", "")),
                _yn(row.get(cols["qty_limit"] or "", "")),
            ))

            if len(batch) >= _BATCH_SIZE:
                conn.executemany(
                    "INSERT OR REPLACE INTO formulary VALUES (?,?,?,?,?,?)", batch
                )
                conn.commit()
                total += len(batch)
                print(f"  {total:,} formulary rows inserted...")
                batch = []

        if batch:
            conn.executemany(
                "INSERT OR REPLACE INTO formulary VALUES (?,?,?,?,?,?)", batch
            )
            conn.commit()
            total += len(batch)

    print(f"  Total formulary rows: {total:,}")


def _load_plans(conn: sqlite3.Connection, path: Path) -> None:
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f, delimiter=_DELIMITER)
        header = list(reader.fieldnames or [])
        cols = {k: _pick_col(header, v) for k, v in _PLAN_COLS.items()}

        rows = [
            (
                _s(row, cols["contract_id"]),
                _s(row, cols["plan_id"]),
                _s(row, cols["plan_name"]),
                _s(row, cols["formulary_id"]),
                _s(row, cols["plan_type"]),
            )
            for row in reader
        ]
        conn.executemany(
            "INSERT OR REPLACE INTO plans VALUES (?,?,?,?,?)", rows
        )
        conn.commit()
    print(f"  Total plan rows: {len(rows):,}")


def _pick_col(header: list[str], candidates: list[str]) -> Optional[str]:
    for c in candidates:
        if c in header:
            return c
    return None


def _pick_zip_entry(names: list[str], keywords: list[str]) -> Optional[str]:
    """Match a ZIP entry by keyword. Handles .csv and .zip entries, and filenames with spaces."""
    for name in names:
        lower = name.lower()
        if any(kw.lower() in lower for kw in keywords):
            return name
    return None


def _norm_ndc(ndc: str) -> str:
    return ndc.replace("-", "").strip().zfill(11)


def _s(row: dict, col: Optional[str]) -> str:
    if col is None:
        return ""
    return (row.get(col) or "").strip()


def _int_or_none(val: str) -> Optional[int]:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _yn(val: str) -> int:
    return 1 if (val or "").strip().upper() == "Y" else 0

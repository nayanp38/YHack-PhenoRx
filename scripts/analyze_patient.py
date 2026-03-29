#!/usr/bin/env python3
"""
Interactive-style CLI: pass genotypes and medications, get baseline/effective enzyme
activity and flagged substrate interactions.

Examples:
  PYTHONPATH=src .venv/bin/python scripts/analyze_patient.py \\
    -g 'CYP2D6=*1/*41' -g 'CYP2C19=*1/*1' \\
    -m 'metoprolol:50' -m 'paroxetine:20' -m 'lisinopril:10'

  PYTHONPATH=src .venv/bin/python scripts/analyze_patient.py --json '{
    "genotypes": {"CYP2D6": "*1/*41", "CYP2C19": "*1/*1"},
    "medications": [
      {"drug_name": "metoprolol", "dose_mg": 50},
      {"drug_name": "paroxetine", "dose_mg": 20},
      {"drug_name": "lisinopril", "dose_mg": 10}
    ]
  }'

  # Easiest: put the same object in a file, then:
  PYTHONPATH=src .venv/bin/python scripts/analyze_patient.py -f patient.json
  PYTHONPATH=src .venv/bin/python scripts/analyze_patient.py --json-file - < patient.json

  # Multiple patients in one file (array or {"patients": [...]}):
  PYTHONPATH=src .venv/bin/python scripts/analyze_patient.py -f patients_batch.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "src") not in sys.path:
    sys.path.insert(0, str(ROOT / "src"))

from phenorx.engine.pipeline import (  # noqa: E402
    load_default_allele_map,
    load_default_knowledge_base,
    run_pipeline,
)


def _parse_gene_arg(s: str) -> tuple[str, str]:
    """Accept 'GENE=diplotype' or 'GENE:diplotype'."""
    s = s.strip()
    for sep in ("=", ":"):
        if sep in s:
            gene, dip = s.split(sep, 1)
            gene = gene.strip().upper()
            dip = dip.strip()
            if gene and dip:
                return gene, dip
    raise argparse.ArgumentTypeError(
        f"Expected GENE=diplotype or GENE:diplotype, got: {s!r}"
    )


def _parse_med_arg(s: str) -> dict:
    """
    Accept 'drugname' or 'drugname:50' or 'drugname,50' (dose mg optional).
    """
    s = s.strip()
    if not s:
        raise argparse.ArgumentTypeError("Empty medication")
    dose = None
    drug = s
    if ":" in s:
        drug, rest = s.split(":", 1)
        drug, rest = drug.strip(), rest.strip()
        if rest:
            dose = float(rest)
    elif "," in s:
        parts = [p.strip() for p in s.split(",", 1)]
        drug = parts[0]
        if len(parts) > 1 and parts[1]:
            dose = float(parts[1])
    out: dict = {"drug_name": drug.lower()}
    if dose is not None:
        out["dose_mg"] = dose
    return out


def _load_patient_json_from_file(path: str) -> Any:
    """Read JSON from a path, or stdin if path is '-'."""
    if path == "-":
        text = sys.stdin.read()
    else:
        p = Path(path).expanduser()
        if not p.is_file():
            raise SystemExit(f"Not a file: {p}")
        text = p.read_text(encoding="utf-8")
    return json.loads(text)


def _json_payload_to_patient_dicts(raw: Any) -> list[dict[str, Any]]:
    """
    Accept:
      - One patient: {"patient_id": "...", "genotypes": {...}, "medications": [...]}
      - Array: [ {...}, {...} ]
      - Wrapper: {"patients": [ {...}, {...} ]}
    Returns a non-empty list of patient dicts (each must have genotypes + medications).
    """
    if raw is None:
        raise ValueError("Empty JSON")

    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict) and "patients" in raw:
        items = raw["patients"]
        if not isinstance(items, list):
            raise ValueError('"patients" must be a JSON array')
    elif isinstance(raw, dict) and ("genotypes" in raw or "medications" in raw):
        items = [raw]
    else:
        raise ValueError(
            "Expected a patient object with genotypes/medications, "
            'a JSON array of patients, or {"patients": [...]}'
        )

    if not items:
        raise ValueError("No patients in input (empty array or patients list)")

    out: list[dict[str, Any]] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"Patient entry {i} must be an object")
        if "genotypes" not in item or "medications" not in item:
            raise ValueError(
                f"Patient entry {i} must include 'genotypes' and 'medications'"
            )
        out.append(item)
    return out


def _build_patient(
    genotypes: dict[str, str],
    medications: list[dict],
    patient_id: str | None,
) -> dict:
    meds = []
    for m in medications:
        entry = {"drug_name": m["drug_name"].lower().strip()}
        if m.get("dose_mg") is not None:
            entry["dose_mg"] = m["dose_mg"]
        if m.get("indication"):
            entry["indication"] = m["indication"]
        meds.append(entry)
    return {
        "patient_id": patient_id or "CLI",
        "genotypes": genotypes,
        "medications": meds,
    }


def _print_text(result: dict, *, batch_index: int | None = None, batch_total: int | None = None) -> None:
    pid = result.get("patient_id", "")
    if batch_index is not None and batch_total is not None:
        print(f"Patient: {pid}  ({batch_index + 1}/{batch_total})")
    else:
        print(f"Patient: {pid}")
    print()
    print("--- Enzyme activity (baseline → effective) ---")
    dash = result.get("enzyme_dashboard") or {}
    if not dash:
        print("  (no genotyped enzymes in input)")
    for enzyme in sorted(dash.keys()):
        row = dash[enzyme]
        b = row["baseline_activity_score"]
        e = row["effective_activity_score"]
        bp = row["baseline_phenotype"]
        ep = row["effective_phenotype"]
        perp = row.get("dominant_perpetrator_drug")
        pstr = row.get("perpetrator_strength")
        delta = row.get("delta")
        perp_line = ""
        if perp:
            perp_line = f"  Perpetrator: {perp} ({pstr})" if pstr else f"  Perpetrator: {perp}"
        print(f"  {enzyme}:")
        print(f"    Baseline activity: {b}  ({bp})")
        print(f"    Effective activity: {e}  ({ep})  Δ {delta}")
        if perp_line:
            print(perp_line)
        print()

    flags = result.get("interactions") or []
    print("--- Flagged medications (substrate risks) ---")
    if not flags:
        print("  None (no substrate in knowledge base with meaningful risk for this profile).")
        return
    for item in flags:
        lvl = item.get("risk_level", "").upper()
        drug = item.get("drug_name")
        enz = item.get("enzyme_name")
        aucr = item.get("predicted_aucr")
        exp = item.get("exposure_classification")
        cons = item.get("clinical_consequence", "")[:200]
        perp = item.get("perpetrator_drug")
        print(f"  [{lvl}] {drug} / {enz}")
        print(f"       Predicted AUCR: {aucr}  |  {exp}")
        if perp:
            print(f"       Inhibitor on list: {perp}")
        print(f"       {cons}")
        alts = item.get("alternative_drugs") or []
        perp_alts = item.get("perpetrator_alternatives") or []
        perp_note = (item.get("perpetrator_alternative_note") or "").strip()
        if alts:
            print(f"       Substrate alternatives: {', '.join(alts)}")
        if perp_alts:
            print(f"       Perpetrator alternatives: {', '.join(perp_alts)}")
        if perp_note:
            print(f"       Note: {perp_note}")
        print()


def main() -> None:
    ap = argparse.ArgumentParser(
        description="PhenoRx: genotypes + meds → baseline/effective activity + flagged interactions."
    )
    ap.add_argument(
        "-g",
        "--gene",
        action="append",
        dest="genes",
        metavar="GENE=DIPLOTYPE",
        type=_parse_gene_arg,
        help="Repeat per gene, e.g. CYP2D6=*1/*41",
    )
    ap.add_argument(
        "-m",
        "--med",
        action="append",
        dest="meds",
        metavar="DRUG[:DOSE_MG]",
        type=_parse_med_arg,
        help="Repeat per drug, optional dose: metoprolol:50",
    )
    ap.add_argument(
        "--json",
        dest="json_input",
        metavar="JSON",
        help="Inline JSON: one patient, or [patients...], or {\"patients\":[...]}",
    )
    ap.add_argument(
        "-f",
        "--json-file",
        dest="json_file",
        metavar="PATH",
        help="JSON file: one patient, or array, or {\"patients\":[...]} (use - for stdin)",
    )
    ap.add_argument(
        "--patient-id",
        default="CLI",
        help="Label in output (default: CLI)",
    )
    ap.add_argument(
        "--raw-json",
        action="store_true",
        help="Print full pipeline JSON (enzyme_dashboard, drug_matrix, interactions)",
    )
    args = ap.parse_args()

    if args.json_input and args.json_file:
        ap.error("Use only one of --json or --json-file, not both.")

    kb = load_default_knowledge_base(ROOT)
    allele_map = load_default_allele_map(ROOT / "data" / "processed")

    if args.json_input:
        try:
            raw = json.loads(args.json_input)
            patient_entries = _json_payload_to_patient_dicts(raw)
        except (json.JSONDecodeError, ValueError) as e:
            raise SystemExit(f"Invalid --json: {e}") from e
    elif args.json_file:
        try:
            raw = _load_patient_json_from_file(args.json_file)
            patient_entries = _json_payload_to_patient_dicts(raw)
        except (json.JSONDecodeError, ValueError) as e:
            raise SystemExit(f"Invalid JSON file: {e}") from e
    else:
        if not args.genes or not args.meds:
            ap.error(
                "Provide patient input: --json-file PATH (or - for stdin), or --json ..., "
                "or both -g/--gene and -m/--med."
            )
        genotypes = {g: d for g, d in args.genes}
        medications = args.meds
        patient_id = args.patient_id
        patient_entries = [
            {
                "patient_id": patient_id,
                "genotypes": genotypes,
                "medications": medications,
            }
        ]

    results: list[dict] = []
    total = len(patient_entries)
    for idx, entry in enumerate(patient_entries):
        genotypes = {k.upper(): v for k, v in (entry.get("genotypes") or {}).items()}
        medications = entry.get("medications") or []
        patient_id = entry.get("patient_id") or args.patient_id
        if total > 1 and not entry.get("patient_id"):
            patient_id = f"{args.patient_id}-{idx + 1}"
        patient = _build_patient(genotypes, medications, patient_id)
        result = run_pipeline(patient, knowledge_base=kb, allele_function_map=allele_map)
        results.append(result)

    if args.raw_json:
        if len(results) == 1:
            print(json.dumps(results[0], indent=2))
        else:
            print(json.dumps(results, indent=2))
        return

    for idx, result in enumerate(results):
        if idx > 0:
            print()
            print("=" * 72)
            print()
        _print_text(result, batch_index=idx if total > 1 else None, batch_total=total if total > 1 else None)


if __name__ == "__main__":
    main()

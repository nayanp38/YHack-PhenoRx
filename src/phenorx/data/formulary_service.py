from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional

from phenorx.engine.models import FormularyEntry


# ---------------------------------------------------------------------------
# Mock formulary: covers drugs commonly appearing as alternatives in the KB.
# Tier 1 = generic (cheapest), 2 = preferred brand, 3 = non-preferred brand,
# 4 = specialty (most expensive / prior auth typically required).
# ---------------------------------------------------------------------------
_MOCK_FORMULARY: Dict[str, Dict[str, Any]] = {
    # --- Beta blockers ---
    "metoprolol":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "metoprolol succinate": {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "atenolol":             {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "bisoprolol":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "carvedilol":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "nebivolol":            {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 30.0},
    # --- Calcium channel blockers ---
    "amlodipine":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    # --- ACE inhibitors ---
    "lisinopril":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "enalapril":            {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "ramipril":             {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    # --- Antidepressants (SSRIs / SNRIs) ---
    "fluoxetine":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "sertraline":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "citalopram":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "escitalopram":         {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "venlafaxine":          {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 10.0},
    "duloxetine":           {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 35.0},
    "mirtazapine":          {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "bupropion":            {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    # --- Antipsychotics ---
    "aripiprazole":         {"tier": 3, "tier_label": "Non-Preferred Brand",  "covered": True,  "prior_auth": True,  "copay": 60.0},
    "quetiapine":           {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 35.0},
    "haloperidol":          {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    # --- PPI / GI ---
    "omeprazole":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "pantoprazole":         {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "lansoprazole":         {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "esomeprazole":         {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 30.0},
    "famotidine":           {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "rabeprazole":          {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 25.0},
    # --- Opioids / Pain ---
    "codeine":              {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 15.0},
    "tramadol":             {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "morphine":             {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": True,  "copay": 30.0},
    "oxycodone":            {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": True,  "copay": 30.0},
    "hydromorphone":        {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": True,  "copay": 35.0},
    "tapentadol":           {"tier": 3, "tier_label": "Non-Preferred Brand",  "covered": True,  "prior_auth": True,  "copay": 60.0},
    "buprenorphine":        {"tier": 3, "tier_label": "Non-Preferred Brand",  "covered": True,  "prior_auth": True,  "copay": 55.0},
    # --- Anticoagulants ---
    "warfarin":             {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "apixaban":             {"tier": 2, "tier_label": "Preferred Brand",      "covered": True,  "prior_auth": False, "copay": 45.0},
    "rivaroxaban":          {"tier": 3, "tier_label": "Non-Preferred Brand",  "covered": True,  "prior_auth": True,  "copay": 60.0},
    # --- Statins ---
    "simvastatin":          {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "atorvastatin":         {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "rosuvastatin":         {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    # --- Antiepileptics ---
    "phenytoin":            {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "carbamazepine":        {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    "lamotrigine":          {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 10.0},
    "levetiracetam":        {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 10.0},
    # --- Antimicrobials ---
    "fluconazole":          {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 7.0},
    # --- Diabetes ---
    "metformin":            {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
    "glipizide":            {"tier": 1, "tier_label": "Generic",              "covered": True,  "prior_auth": False, "copay": 5.0},
}


class FormularyService(ABC):
    @abstractmethod
    def lookup(self, drug_name: str, plan_id: Optional[str] = None) -> FormularyEntry:
        ...


class MockFormularyService(FormularyService):
    """
    Built-in formulary using a static drug tier table.
    Covers the most common drug classes and all alternatives listed in the
    default knowledge base. Suitable for demos and offline testing.
    """

    def lookup(self, drug_name: str, plan_id: Optional[str] = None) -> FormularyEntry:
        key = drug_name.strip().lower()
        entry = _MOCK_FORMULARY.get(key)
        if entry is None:
            return FormularyEntry(
                drug_name=drug_name,
                covered=False,
                tier=None,
                tier_label="Not on Formulary",
                prior_auth_required=False,
            )
        return FormularyEntry(
            drug_name=drug_name,
            covered=entry["covered"],
            tier=entry["tier"],
            tier_label=entry["tier_label"],
            prior_auth_required=entry["prior_auth"],
        )


def mock_estimated_monthly_cost(drug_name: str) -> Optional[float]:
    """Approximate monthly copay from the built-in mock formulary (demo / offline)."""
    key = drug_name.strip().lower()
    entry = _MOCK_FORMULARY.get(key)
    if not entry:
        return None
    copay = entry.get("copay")
    return float(copay) if copay is not None else None


def get_default_service() -> FormularyService:
    return MockFormularyService()


def get_service_for_patient(
    insurance: Optional[Dict[str, Any]],
    cms_db_path: Optional[Path] = None,
    rxnorm_cache_path: Optional[Path] = None,
) -> FormularyService:
    """
    Return the appropriate formulary service for a patient's insurance type.

    - Medicare / Medicare Advantage → MedicareFormularyService (if DB exists)
    - Everything else → MockFormularyService

    Automatically falls back to MockFormularyService if the CMS database
    has not been built yet (run scripts/build_cms_formulary.py to build it).
    """
    if insurance is None:
        return MockFormularyService()

    plan_type = (insurance.get("plan_type") or "").strip().lower()

    if plan_type == "medicare" and cms_db_path and Path(cms_db_path).exists():
        # Lazy import avoids circular dependency
        from phenorx.data.rxnorm_service import RxNormService
        from phenorx.data.medicare_formulary import MedicareFormularyService

        cache_path = Path(rxnorm_cache_path) if rxnorm_cache_path else (
            Path(cms_db_path).parent / "rxnorm_cache.json"
        )
        rxnorm = RxNormService(cache_path)
        return MedicareFormularyService(Path(cms_db_path), rxnorm)

    return MockFormularyService()

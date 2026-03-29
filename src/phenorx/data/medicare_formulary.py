from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import List, Optional

from phenorx.engine.models import FormularyEntry
from phenorx.data.formulary_service import FormularyService, MockFormularyService
from phenorx.data.rxnorm_service import RxNormService

_TIER_LABEL: dict[int, str] = {
    1: "Preferred Generic",
    2: "Generic",
    3: "Preferred Brand",
    4: "Non-Preferred Brand",
    5: "Specialty (coinsurance)",
    6: "Select Care",
}


class MedicareFormularyService(FormularyService):
    """
    Formulary service backed by the CMS Part D / Medicare Advantage SQLite
    database built by scripts/build_cms_formulary.py.

    Covers all standalone Part D (PDP) plans and Medicare Advantage
    Prescription Drug (MA-PD) plans — including those administered by
    private insurers (UnitedHealth, Aetna, Humana, BCBS, etc.).

    Falls back to MockFormularyService when the plan ID is not found or the
    RxNorm API cannot resolve a drug name to an NDC code.
    """

    def __init__(self, db_path: Path, rxnorm_service: RxNormService):
        self._db_path = Path(db_path)
        self._rxnorm = rxnorm_service
        self._fallback = MockFormularyService()

    def lookup(self, drug_name: str, plan_id: Optional[str] = None) -> FormularyEntry:
        if plan_id is None:
            return self._fallback.lookup(drug_name)

        contract_id, plan_segment = _parse_plan_id(plan_id)
        if contract_id is None:
            return self._fallback.lookup(drug_name)

        formulary_id = self._get_formulary_id(contract_id, plan_segment)
        if formulary_id is None:
            return self._fallback.lookup(drug_name)

        clinical_rxcuis = self._rxnorm.get_clinical_rxcuis(drug_name)
        if not clinical_rxcuis:
            return FormularyEntry(
                drug_name=drug_name,
                covered=False,
                tier=None,
                tier_label="Not on Formulary",
                prior_auth_required=False,
            )

        row = self._lookup_formulary(formulary_id, clinical_rxcuis)
        if row is None:
            return FormularyEntry(
                drug_name=drug_name,
                covered=False,
                tier=None,
                tier_label="Not on Formulary",
                prior_auth_required=False,
            )

        tier, prior_auth = row
        return FormularyEntry(
            drug_name=drug_name,
            covered=True,
            tier=tier,
            tier_label=_TIER_LABEL.get(tier, f"Tier {tier}") if tier else None,
            prior_auth_required=bool(prior_auth),
        )

    def get_plan_name(self, plan_id: str) -> Optional[str]:
        """Return the human-readable plan name for a given plan ID."""
        contract_id, plan_segment = _parse_plan_id(plan_id)
        if contract_id is None:
            return None
        with sqlite3.connect(self._db_path) as conn:
            row = conn.execute(
                "SELECT plan_name FROM plans WHERE contract_id=? AND plan_id=?",
                (contract_id, plan_segment),
            ).fetchone()
        return row[0] if row else None

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_formulary_id(self, contract_id: str, plan_id: str) -> Optional[str]:
        with sqlite3.connect(self._db_path) as conn:
            row = conn.execute(
                "SELECT formulary_id FROM plans WHERE contract_id=? AND plan_id=?",
                (contract_id, plan_id),
            ).fetchone()
        return row[0] if row else None

    def _lookup_formulary(self, formulary_id: str, rxcuis: List[str]) -> Optional[tuple]:
        """Return lowest (tier, prior_auth) for any clinical RxCUI match in the plan."""
        placeholders = ",".join("?" * len(rxcuis))
        with sqlite3.connect(self._db_path) as conn:
            row = conn.execute(
                f"""
                SELECT tier, prior_auth FROM formulary
                WHERE formulary_id = ? AND rxcui IN ({placeholders})
                ORDER BY tier ASC
                LIMIT 1
                """,
                [formulary_id, *rxcuis],
            ).fetchone()
        return row


def _parse_plan_id(plan_id: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse CMS plan ID format 'H1234-001' → ('H1234', '001').
    Contract prefix letters: H = MA-PD, S = PDP, R = regional MA, E = employer.
    """
    parts = plan_id.strip().split("-")
    if len(parts) == 2 and parts[0] and parts[1]:
        return parts[0], parts[1]
    return None, None

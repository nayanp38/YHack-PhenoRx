from __future__ import annotations

from typing import Any, Dict, List, Optional

from cypher.data.knowledge_base_loader import KnowledgeBaseKey, normalize_drug_name

from .models import DrugClassificationCell


COVERED_ENZYMES = ["CYP2D6", "CYP2C19", "CYP2C9", "CYP3A4"]


def _pick_strength(cell_role: str, inhibitor_strength: Optional[str], inducer_strength: Optional[str]) -> Optional[str]:
    if cell_role in {"inhibitor", "substrate_and_inhibitor"}:
        return inhibitor_strength
    if cell_role == "inducer":
        return inducer_strength
    return None


def classify_medications(
    medications: List[Dict[str, Any]],
    knowledge_base: Dict[KnowledgeBaseKey, Dict[str, Any]],
    enzymes: Optional[List[str]] = None,
) -> Dict[str, Dict[str, DrugClassificationCell]]:
    """
    Pass 1: build the per-patient drug classification matrix.
    """
    enzyme_list = enzymes or COVERED_ENZYMES
    matrix: Dict[str, Dict[str, DrugClassificationCell]] = {}

    for med in medications:
        drug_name = normalize_drug_name(str(med.get("drug_name", "")))
        if not drug_name:
            raise ValueError("Medication entries must include non-empty 'drug_name'")

        matrix[drug_name] = {}
        for enzyme in enzyme_list:
            key = (drug_name, enzyme)
            rec = knowledge_base.get(key)
            if rec is None:
                matrix[drug_name][enzyme] = DrugClassificationCell(
                    role="irrelevant",
                    inhibitor_strength=None,
                    inducer_strength=None,
                    strength=None,
                    substrate_sensitivity=None,
                    substrate_type=None,
                    fm_cyp=None,
                    aucr_strong_inhibitor=None,
                    therapeutic_window=None,
                    data_source=None,
                    alternative_drugs=[],
                    evidence_sources=[],
                )
                continue

            role = str(rec.get("role", "irrelevant"))
            inhibitor_strength = rec.get("inhibitor_strength")
            inducer_strength = rec.get("inducer_strength")

            substrate_sensitivity = rec.get("substrate_sensitivity")
            substrate_type = rec.get("substrate_type")
            fm_cyp = rec.get("fm_cyp")
            aucr_strong_inhibitor = rec.get("aucr_strong_inhibitor")
            therapeutic_window = rec.get("therapeutic_window")
            data_source = rec.get("data_source")

            alternative_drugs = rec.get("alternative_drugs") or []
            evidence_sources = rec.get("evidence_sources") or []
            if not evidence_sources and data_source:
                evidence_sources = [str(data_source)]

            matrix[drug_name][enzyme] = DrugClassificationCell(
                role=role,
                inhibitor_strength=inhibitor_strength,
                inducer_strength=inducer_strength,
                strength=_pick_strength(role, inhibitor_strength, inducer_strength),
                substrate_sensitivity=substrate_sensitivity,
                substrate_type=substrate_type,
                fm_cyp=float(fm_cyp) if fm_cyp is not None else None,
                aucr_strong_inhibitor=float(aucr_strong_inhibitor) if aucr_strong_inhibitor is not None else None,
                therapeutic_window=therapeutic_window,
                data_source=str(data_source) if data_source is not None else None,
                alternative_drugs=[str(x) for x in alternative_drugs],
                evidence_sources=[str(x) for x in evidence_sources],
            )

    return matrix


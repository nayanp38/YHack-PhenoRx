from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from .genotype_parser import genotype_to_activity
from .pass1_classify import classify_medications
from .pass2_phenoconvert import compute_effective_activity
from .pass3_evaluate import evaluate_drug_risks
from .pass4_affordability import rank_alternatives_by_affordability
from .side_effect_severity import (
    SAP_VERDICT_THRESHOLD,
    attach_side_effect_comparison,
    load_drug_profiles,
)
from .models import AffordabilityResult, EnzymeEffectiveState, EnzymeBaseline, DrugClassificationCell, InteractionResult, RankedAlternative
from phenorx.data.knowledge_base_loader import load_knowledge_base


def _cell_to_json(cell: DrugClassificationCell) -> Dict[str, Any]:
    return {
        "role": cell.role,
        "strength": cell.strength,
        "inhibitor_strength": cell.inhibitor_strength,
        "inducer_strength": cell.inducer_strength,
        "substrate_sensitivity": cell.substrate_sensitivity,
        "substrate_type": cell.substrate_type,
        "fm_cyp": cell.fm_cyp,
        "aucr_strong_inhibitor": cell.aucr_strong_inhibitor,
        "therapeutic_window": cell.therapeutic_window,
        "data_source": cell.data_source,
        "alternative_drugs": cell.alternative_drugs,
        "evidence_sources": cell.evidence_sources,
    }


def _enzyme_effective_to_json(state: EnzymeEffectiveState) -> Dict[str, Any]:
    return {
        "baseline_activity_score": state.baseline_activity_score,
        "baseline_phenotype": state.baseline_phenotype,
        "effective_activity_score": state.effective_activity_score,
        "effective_phenotype": state.effective_phenotype,
        "dominant_perpetrator_drug": state.dominant_perpetrator_drug,
        "perpetrator_strength": state.perpetrator_strength,
        "delta": state.delta,
    }


def _interaction_to_json(r: InteractionResult) -> Dict[str, Any]:
    return {
        "drug_name": r.drug_name,
        "enzyme_name": r.enzyme_name,
        "baseline_phenotype": r.baseline_phenotype,
        "effective_phenotype": r.effective_phenotype,
        "perpetrator_drug": r.perpetrator_drug,
        "perpetrator_strength": r.perpetrator_strength,
        "predicted_aucr": r.predicted_aucr,
        "exposure_classification": r.exposure_classification,
        "clinical_consequence": r.clinical_consequence,
        "risk_level": r.risk_level,
        "alternative_drugs": r.alternative_drugs,
        "evidence_sources": r.evidence_sources,
        "perpetrator_alternatives": r.perpetrator_alternatives,
        "perpetrator_alternative_note": r.perpetrator_alternative_note,
    }


def _ranked_alternative_to_json(r: RankedAlternative) -> Dict[str, Any]:
    return {
        "drug_name": r.drug_name,
        "affordability_rank": r.affordability_rank,
        "covered": r.covered,
        "tier": r.tier,
        "tier_label": r.tier_label,
        "prior_auth_required": r.prior_auth_required,
    }


def _affordability_result_to_json(a: AffordabilityResult) -> Dict[str, Any]:
    return {
        "interaction_drug": a.interaction_drug,
        "enzyme_name": a.enzyme_name,
        "risk_level": a.risk_level,
        "ranked_alternatives": [_ranked_alternative_to_json(r) for r in a.ranked_alternatives],
    }


def run_pipeline(
    patient: Dict[str, Any],
    knowledge_base: Dict[Any, Any],
    *,
    allele_function_map: Optional[Dict[str, Dict[str, float]]] = None,
    cms_db_path: Optional[Path] = None,
    rxnorm_cache_path: Optional[Path] = None,
    drug_side_effect_profiles_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Orchestrates the four-pass pipeline and returns outputs for:
      1) Enzyme Activity Dashboard
      2) Drug Classification Matrix
      3) Interaction Report
      4) Affordability-Ranked Alternatives

    For Medicare / Medicare Advantage patients, pass cms_db_path and
    rxnorm_cache_path (built by scripts/build_cms_formulary.py) to get
    real formulary data instead of mock data.
    """
    genotypes = patient.get("genotypes") or {}
    medications = patient.get("medications") or []
    insurance = patient.get("insurance") or None

    enzyme_baselines = genotype_to_activity(genotypes, allele_function_map=allele_function_map)
    drug_matrix = classify_medications(medications, knowledge_base)
    effective_enzymes = compute_effective_activity(enzyme_baselines, drug_matrix)
    interactions = evaluate_drug_risks(
        drug_matrix=drug_matrix, effective_enzymes=effective_enzymes, enzyme_baselines=enzyme_baselines
    )
    affordability = rank_alternatives_by_affordability(
        interactions,
        insurance,
        cms_db_path=cms_db_path,
        rxnorm_cache_path=rxnorm_cache_path,
    )

    enzyme_dashboard = {enzyme: _enzyme_effective_to_json(state) for enzyme, state in effective_enzymes.items()}
    drug_matrix_json: Dict[str, Any] = {}
    for drug_name, enzyme_map in drug_matrix.items():
        drug_matrix_json[drug_name] = {enzyme: _cell_to_json(cell) for enzyme, cell in enzyme_map.items()}

    interactions_json = [_interaction_to_json(r) for r in interactions]

    sep_path = drug_side_effect_profiles_path or _default_side_effect_profiles_path()
    _profiles = load_drug_profiles(sep_path)
    attach_side_effect_comparison(interactions_json, _profiles)

    affordability_json = [_affordability_result_to_json(a) for a in affordability]

    return {
        "patient_id": patient.get("patient_id"),
        "enzyme_dashboard": enzyme_dashboard,
        "drug_matrix": drug_matrix_json,
        "interactions": interactions_json,
        "affordability": affordability_json,
        "meta": {
            "side_effect_profiles_path": str(sep_path),
            "side_effect_profiles_loaded": bool(_profiles),
            "sap_verdict_threshold": SAP_VERDICT_THRESHOLD,
            "side_effect_model": "SAP_v3",
        },
    }


def load_default_allele_map(processed_dir: str | Path) -> Optional[Dict[str, Dict[str, float]]]:
    p = Path(processed_dir)
    # expected: data/processed/cpic_allele_function_map.json
    map_path = p / "cpic_allele_function_map.json"
    if not map_path.exists():
        return None
    return json.loads(map_path.read_text(encoding="utf-8"))


def load_default_knowledge_base(repo_root: str | Path) -> Dict[Any, Any]:
    kb_path = Path(repo_root) / "data" / "knowledge_base.json"
    return load_knowledge_base(kb_path)


def _default_side_effect_profiles_path() -> Path:
    """Resolve bundled JSON whether the package runs from source tree or site-packages."""
    env_dir = os.environ.get("PHENORX_DATA_DIR") or os.environ.get("PHENORX_REPO_ROOT")
    if env_dir:
        p = Path(env_dir) / "drug_side_effect_profiles.json"
        if p.is_file():
            return p
        p = Path(env_dir) / "data" / "drug_side_effect_profiles.json"
        if p.is_file():
            return p
    here = Path(__file__).resolve()
    for i in range(8):
        try:
            cand = here.parents[i] / "data" / "drug_side_effect_profiles.json"
        except IndexError:
            break
        if cand.is_file():
            return cand
    cwd = Path.cwd() / "data" / "drug_side_effect_profiles.json"
    if cwd.is_file():
        return cwd
    return here.parents[3] / "data" / "drug_side_effect_profiles.json"

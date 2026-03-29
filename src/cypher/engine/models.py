from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class EnzymeBaseline:
    enzyme_name: str
    activity_score: float
    phenotype: str
    diplotype: str


@dataclass(frozen=True)
class EnzymeEffectiveState:
    enzyme_name: str
    baseline_activity_score: float
    baseline_phenotype: str
    effective_activity_score: float
    effective_phenotype: str
    dominant_perpetrator_drug: Optional[str]
    perpetrator_strength: Optional[str]

    @property
    def delta(self) -> float:
        return round(self.effective_activity_score - self.baseline_activity_score, 4)


@dataclass(frozen=True)
class DrugClassificationCell:
    role: str  # "substrate" | "inhibitor" | "inducer" | "substrate_and_inhibitor" | "irrelevant"
    inhibitor_strength: Optional[str]
    inducer_strength: Optional[str]
    strength: Optional[str]  # normalized display: inhibitor_strength or inducer_strength
    substrate_sensitivity: Optional[str]
    substrate_type: Optional[str]  # "active_drug" | "prodrug"
    fm_cyp: Optional[float]
    aucr_strong_inhibitor: Optional[float]
    therapeutic_window: Optional[str]
    data_source: Optional[str]
    alternative_drugs: List[str]
    evidence_sources: List[str]


DrugClassificationMatrix = Dict[str, Dict[str, DrugClassificationCell]]


@dataclass(frozen=True)
class InteractionResult:
    drug_name: str
    enzyme_name: str
    baseline_phenotype: str
    effective_phenotype: str
    perpetrator_drug: Optional[str]
    predicted_aucr: float
    exposure_classification: str
    clinical_consequence: str
    risk_level: str  # "critical" | "high" | "moderate" | "low" | "info"
    alternative_drugs: List[str]
    evidence_sources: List[str]
    perpetrator_alternatives: List[str] = field(default_factory=list)
    perpetrator_alternative_note: str = ""
    perpetrator_strength: Optional[str] = None
    # Optional transparency fields
    effective_activity_score: float | None = None
    baseline_activity_score: float | None = None


BaselineMap = Dict[str, EnzymeBaseline]
EffectiveMap = Dict[str, EnzymeEffectiveState]


JsonDict = Dict[str, Any]


@dataclass(frozen=True)
class FormularyEntry:
    drug_name: str
    covered: bool
    tier: Optional[int]       # 1=generic, 2=preferred brand, 3=non-preferred, 4=specialty
    tier_label: Optional[str]
    prior_auth_required: bool


@dataclass(frozen=True)
class RankedAlternative:
    drug_name: str
    covered: bool
    tier: Optional[int]
    tier_label: Optional[str]
    prior_auth_required: bool
    affordability_rank: int  # 1 = most affordable


@dataclass(frozen=True)
class AffordabilityResult:
    interaction_drug: str
    enzyme_name: str
    risk_level: str
    ranked_alternatives: List[RankedAlternative]

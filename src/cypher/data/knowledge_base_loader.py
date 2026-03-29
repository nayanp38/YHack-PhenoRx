from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple


KnowledgeBaseRecord = Dict[str, Any]
KnowledgeBaseKey = Tuple[str, str]  # (drug_name, enzyme)


def load_knowledge_base(path: str | Path) -> Dict[KnowledgeBaseKey, KnowledgeBaseRecord]:
    """
    Load knowledge_base.json and index it by (drug_name, enzyme).
    """
    p = Path(path)
    payload = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("knowledge_base.json must be a list of records")

    out: Dict[KnowledgeBaseKey, KnowledgeBaseRecord] = {}
    for rec in payload:
        drug = str(rec.get("drug_name", "")).strip().lower()
        enzyme = str(rec.get("enzyme", "")).strip().upper()
        if not drug or not enzyme:
            continue
        out[(drug, enzyme)] = rec
    return out


def normalize_drug_name(drug_name: str) -> str:
    return drug_name.strip().lower()


from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Dict, List, Optional

import requests

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
_REQUEST_DELAY = 0.1  # be polite to NIH servers


class RxNormService:
    """
    Thin wrapper around the NIH RxNorm REST API with a local JSON cache.
    The cache persists across runs so repeated lookups never hit the API.
    """

    def __init__(self, cache_path: Path):
        self.cache_path = Path(cache_path)
        self._cache: Dict[str, Dict] = self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_rxcui(self, drug_name: str) -> Optional[str]:
        """Return the RxCUI for a drug name, or None if not found."""
        key = _normalise(drug_name)
        if key in self._cache and "rxcui" in self._cache[key]:
            return self._cache[key]["rxcui"]

        rxcui = self._fetch_rxcui(key)
        self._cache.setdefault(key, {})["rxcui"] = rxcui
        self._save()
        return rxcui

    def get_clinical_rxcuis(self, drug_name: str) -> List[str]:
        """
        Return all clinical-drug-level RxCUIs (SCD + SBD) for a drug name.
        These are the RxCUIs the CMS formulary uses (specific strength + form),
        as opposed to the ingredient-level RxCUI returned by get_rxcui().
        """
        key = _normalise(drug_name)
        cached = self._cache.get(key, {})
        if "clinical_rxcuis" in cached:
            clinical = cached["clinical_rxcuis"] or []
            # Older cache files may contain an empty list from a failed fetch or
            # from the pre-fix implementation. Only trust a non-empty list, or a
            # definitive "no RxCUI" case.
            if clinical or cached.get("rxcui") is None:
                return clinical

        rxcui = self.get_rxcui(drug_name)
        if not rxcui:
            clinical: List[str] = []
        else:
            clinical = self._fetch_clinical_rxcuis(rxcui)
            time.sleep(_REQUEST_DELAY)

        self._cache.setdefault(key, {})["clinical_rxcuis"] = clinical
        self._save()
        return clinical

    def warm_cache(self, drug_names: List[str]) -> None:
        """Pre-fetch RxCUI + clinical RxCUIs for a list of drug names."""
        unique = list(dict.fromkeys(_normalise(n) for n in drug_names))
        for i, name in enumerate(unique, 1):
            cached = self._cache.get(name, {})
            already_cached = (
                "rxcui" in cached
                and (
                    cached.get("rxcui") is None
                    or bool(cached.get("clinical_rxcuis"))
                )
            )
            status = "cached" if already_cached else "fetching"
            print(f"  [{i}/{len(unique)}] {name} ({status})")
            self.get_clinical_rxcuis(name)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fetch_rxcui(self, drug_name: str) -> Optional[str]:
        try:
            resp = requests.get(
                f"{RXNORM_BASE}/rxcui.json",
                params={"name": drug_name, "search": "1"},
                timeout=10,
            )
            resp.raise_for_status()
            ids = resp.json().get("idGroup", {}).get("rxnormId") or []
            return ids[0] if ids else None
        except Exception:
            return None

    def _fetch_clinical_rxcuis(self, rxcui: str) -> List[str]:
        """
        Fetch SCD (Semantic Clinical Drug) and SBD (Semantic Branded Drug) RxCUIs
        from an ingredient-level RxCUI. These are the clinical-drug-level RxCUIs
        that the CMS formulary file uses (drug + strength + form).
        """
        try:
            resp = requests.get(
                f"{RXNORM_BASE}/rxcui/{rxcui}/allrelated.json",
                timeout=10,
            )
            resp.raise_for_status()
            groups = resp.json().get("allRelatedGroup", {}).get("conceptGroup", [])
            result = []
            for group in groups:
                if group.get("tty") not in ("SCD", "SBD"):
                    continue
                for concept in group.get("conceptProperties", []):
                    cid = concept.get("rxcui")
                    if cid:
                        result.append(cid)
            return result
        except Exception:
            return []

    def _load(self) -> Dict:
        if self.cache_path.exists():
            return json.loads(self.cache_path.read_text(encoding="utf-8"))
        return {}

    def _save(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(
            json.dumps(self._cache, indent=2), encoding="utf-8"
        )


def _normalise(name: str) -> str:
    return name.strip().lower()


def normalise_ndc(ndc: str) -> str:
    """Strip hyphens and zero-pad to 11 digits (standard CMS format)."""
    return ndc.replace("-", "").zfill(11)

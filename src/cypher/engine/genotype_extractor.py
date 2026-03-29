"""
Genotype file upload extraction: VCF parser + Gemini PDF extractor + validation.
"""
from __future__ import annotations

import gzip
import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ExtractedGenotype:
    gene: str
    diplotype: str
    source: str
    confidence: str
    reported_phenotype: Optional[str] = None
    computed_phenotype: Optional[str] = None
    validation_warning: Optional[str] = None


@dataclass
class ExtractionResult:
    genotypes: Dict[str, str]
    details: List[ExtractedGenotype]
    source_type: str
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None


SUPPORTED_GENES = {"CYP2D6", "CYP2C19", "CYP2C9"}

KNOWN_ALLELES: Dict[str, set] = {
    "CYP2D6": {"*1", "*2", "*3", "*4", "*5", "*6", "*9", "*10", "*17", "*29", "*33", "*35", "*41"},
    "CYP2C19": {"*1", "*2", "*3", "*9", "*17"},
    "CYP2C9": {"*1", "*2", "*3"},
}

GENOTYPE_EXTRACTION_PROMPT = (
    "You are reading a pharmacogenomic (PGx) lab report PDF.\n"
    "Extract ONLY the genotype/diplotype results for pharmacogenes.\n"
    "For each gene found, extract: gene_name, diplotype, phenotype.\n"
    "Focus on CYP2D6, CYP2C19, CYP2C9, CYP3A4, CYP2B6, CYP1A2.\n"
    "Return ONLY a JSON array. No explanation.\n"
    'Example: [{"gene_name":"CYP2D6","diplotype":"*1/*4",'
    '"phenotype":"Intermediate Metabolizer"}]'
)


def parse_vcf(file_bytes: bytes, allele_defs_path: Path) -> ExtractionResult:
    """Parse a VCF file and call star alleles using the static lookup table."""
    warnings: List[str] = []

    # Decompress if gzipped
    try:
        text = gzip.decompress(file_bytes).decode("utf-8", errors="replace")
    except gzip.BadGzipFile:
        text = file_bytes.decode("utf-8", errors="replace")

    # Load allele definitions
    try:
        allele_defs = json.loads(allele_defs_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return ExtractionResult(
            genotypes={}, details=[], source_type="vcf",
            error=f"Failed to load allele definitions: {exc}",
        )

    # Check reference genome
    for line in text.splitlines():
        if line.startswith("##reference="):
            ref = line.split("=", 1)[1].strip().lower()
            if not any(tag in ref for tag in ("grch38", "hg38", "b38")):
                warnings.append(
                    f"VCF reference is '{ref}', not GRCh38. Positions may not match."
                )
            break

    # Parse VCF data lines into variant map: (chrom, pos) -> gt_call
    variant_map: Dict[Tuple[str, int], Tuple[str, str, str]] = {}
    sample_count = 0
    for line in text.splitlines():
        if line.startswith("##"):
            continue
        if line.startswith("#CHROM"):
            cols = line.split("\t")
            sample_count = max(0, len(cols) - 9)
            if sample_count > 1:
                warnings.append(
                    f"Multi-sample VCF detected ({sample_count} samples). Using first sample only."
                )
            continue

        parts = line.strip().split("\t")
        if len(parts) < 10:
            continue

        chrom = parts[0]
        try:
            pos = int(parts[1])
        except ValueError:
            continue
        ref_allele = parts[3]
        alt_allele = parts[4]
        # GT is always the first FORMAT field
        fmt_fields = parts[8].split(":")
        sample_fields = parts[9].split(":")
        gt_idx = fmt_fields.index("GT") if "GT" in fmt_fields else 0
        gt_call = sample_fields[gt_idx] if gt_idx < len(sample_fields) else "0/0"

        variant_map[(chrom, pos)] = (ref_allele, alt_allele, gt_call)

    if not variant_map:
        warnings.append("No pharmacogenomic variants found in VCF.")

    # Match alleles per gene
    gene_allele_counts: Dict[str, Dict[str, int]] = {}

    for gene, alleles in allele_defs.items():
        gene_upper = gene.upper()
        if gene_upper not in SUPPORTED_GENES:
            continue
        gene_allele_counts[gene_upper] = {}

        for star_allele, allele_info in alleles.items():
            chrom = allele_info["chrom"]
            defining_variants = allele_info["defining_variants"]

            all_match = True
            min_copies = 2  # start high, take minimum across variants

            for var in defining_variants:
                key = (chrom, var["pos"])
                if key not in variant_map:
                    all_match = False
                    break

                _ref, alt, gt = variant_map[key]
                # Normalize GT separator (/ for unphased, | for phased)
                gt_parts = re.split(r"[/|]", gt)

                if alt != var["alt"]:
                    all_match = False
                    break

                alt_count = sum(1 for g in gt_parts if g == "1")
                if alt_count == 0:
                    all_match = False
                    break
                min_copies = min(min_copies, alt_count)

            if all_match and defining_variants:
                gene_allele_counts[gene_upper][star_allele] = min_copies

    # Build diplotypes from allele counts
    genotypes: Dict[str, str] = {}
    details: List[ExtractedGenotype] = []

    for gene in SUPPORTED_GENES:
        counts = gene_allele_counts.get(gene, {})
        if not counts:
            genotypes[gene] = "*1/*1"
            continue

        # Build the two chromosome calls
        chromo: List[str] = []
        for allele, count in sorted(counts.items(), key=lambda x: x[0]):
            for _ in range(count):
                chromo.append(allele)

        # Pad with *1 if only one allele found
        while len(chromo) < 2:
            chromo.append("*1")
        # Take only first two (most impactful already sorted)
        chromo = chromo[:2]
        diplotype = f"{chromo[0]}/{chromo[1]}"
        genotypes[gene] = diplotype

        details.append(ExtractedGenotype(
            gene=gene, diplotype=diplotype, source="vcf",
            confidence="high",
        ))

    return ExtractionResult(
        genotypes=genotypes, details=details,
        source_type="vcf", warnings=warnings,
    )


async def extract_from_pdf(file_bytes: bytes, mime: str) -> ExtractionResult:
    """Use Gemini vision API to extract genotype data from a PGx lab report PDF."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return ExtractionResult(
            genotypes={}, details=[], source_type="pdf",
            error="GEMINI_API_KEY not set",
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)

        suffix = ".pdf" if "pdf" in mime else ".png"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            uploaded = client.files.upload(file=tmp_path)
        finally:
            os.unlink(tmp_path)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_uri(
                            file_uri=uploaded.uri,
                            mime_type=uploaded.mime_type,
                        ),
                        types.Part(text=GENOTYPE_EXTRACTION_PROMPT),
                    ],
                )
            ],
        )

        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        entries = json.loads(raw)
        if not isinstance(entries, list):
            return ExtractionResult(
                genotypes={}, details=[], source_type="pdf",
                error="No pharmacogenomic data found in PDF.",
            )
        return _validate_extracted_entries(entries, source_type="pdf")

    except json.JSONDecodeError:
        return ExtractionResult(
            genotypes={}, details=[], source_type="pdf",
            error="Could not parse genotype data from PDF.",
        )
    except Exception as exc:
        return ExtractionResult(
            genotypes={}, details=[], source_type="pdf",
            error=f"AI extraction service unavailable. Use manual entry. ({exc})",
        )


def _validate_extracted_entries(
    entries: List[dict], source_type: str
) -> ExtractionResult:
    """Validate and normalize extracted genotype entries from either source."""
    from cypher.engine.genotype_parser import activity_to_phenotype, genotype_to_activity

    genotypes: Dict[str, str] = {}
    details: List[ExtractedGenotype] = []
    warnings: List[str] = []

    for entry in entries:
        gene = entry.get("gene_name", "").strip().upper()
        if gene not in SUPPORTED_GENES:
            warnings.append(f"Skipping unsupported gene: {gene}")
            continue

        diplotype = entry.get("diplotype", "").strip()
        parts = [p.strip() for p in diplotype.split("/")]
        if len(parts) != 2:
            warnings.append(f"Invalid diplotype format for {gene}: {diplotype}")
            continue

        allele1, allele2 = parts
        known = KNOWN_ALLELES.get(gene, set())
        if allele1 not in known:
            warnings.append(f"Unknown allele {allele1} for {gene}, defaulting to *1")
            allele1 = "*1"
        if allele2 not in known:
            warnings.append(f"Unknown allele {allele2} for {gene}, defaulting to *1")
            allele2 = "*1"

        clean_diplotype = f"{allele1}/{allele2}"
        genotypes[gene] = clean_diplotype

        reported_pheno = entry.get("phenotype", "").strip() or None
        computed_pheno = None
        validation_warning = None
        try:
            baseline = genotype_to_activity({gene: clean_diplotype})
            computed_pheno = baseline[gene].phenotype
            if reported_pheno and computed_pheno:
                if reported_pheno.lower() != computed_pheno.lower():
                    validation_warning = (
                        f"Lab reported {reported_pheno} but CYPher computes "
                        f"{computed_pheno} for {gene} {clean_diplotype}"
                    )
                    warnings.append(validation_warning)
        except Exception:
            pass

        details.append(ExtractedGenotype(
            gene=gene, diplotype=clean_diplotype, source=source_type,
            confidence="high" if source_type == "vcf" else "medium",
            reported_phenotype=reported_pheno,
            computed_phenotype=computed_pheno,
            validation_warning=validation_warning,
        ))

    return ExtractionResult(
        genotypes=genotypes, details=details,
        source_type=source_type, warnings=warnings,
    )

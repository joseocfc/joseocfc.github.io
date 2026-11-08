"""Trim Epoch AI's notable_ai_models.csv to the fields the explorer uses.

Usage (stdlib only, run isolated):
    python3 -I trim_notable_models.py <notable_ai_models.csv> <notable_models.json>

Keeps: model, organization, date, domain, country, compute, parameters,
dataset size, notability, confidence. Drops every row that lacks either a
publication date or a training-compute estimate. Adds three derived fields
(domain_group, org_primary, country_primary) so the chart and the matplotlib
twin colour points by exactly the same rule.
"""
import csv
import json
import sys
from collections import Counter

DOMAIN_ORDER = ["Language", "Vision", "Multimodal", "Games", "Speech", "Biology", "Robotics", "Other"]

# Single-token mapping onto the eight colour slots (SPEC section 8).
TOKEN_TO_GROUP = {
    "Language": "Language",
    "Vision": "Vision",
    "Image generation": "Vision",
    "Video": "Vision",
    "Multimodal": "Multimodal",
    "Games": "Games",
    "Speech": "Speech",
    "Audio": "Speech",
    "Biology": "Biology",
    "Medicine": "Biology",
    "Robotics": "Robotics",
}
# Modalities: a model tagged with two or more of these is multimodal even when
# Epoch did not add the "Multimodal" tag (e.g. "Vision,Language").
MODALITIES = {"Language", "Vision", "Speech"}

SHORT_COUNTRY = {
    "United States of America": "United States",
    "Korea (Republic of)": "South Korea",
}


def domain_group(raw):
    tokens = [t.strip() for t in raw.split(",") if t.strip()]
    if not tokens:
        return "Other"
    if "Multimodal" in tokens:
        return "Multimodal"
    groups = [TOKEN_TO_GROUP.get(t, "Other") for t in tokens]
    if len(MODALITIES.intersection(groups)) >= 2:
        return "Multimodal"
    return groups[0]


def first(raw):
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts[0] if parts else ""


def country_primary(raw):
    parts = {SHORT_COUNTRY.get(p.strip(), p.strip()) for p in raw.split(",") if p.strip()}
    if not parts:
        return "Unknown"
    if len(parts) > 1:
        return "Multinational"
    return parts.pop()


def num(raw):
    raw = raw.strip()
    if not raw:
        return None
    try:
        v = float(raw)
    except ValueError:
        return None
    return v if v > 0 else None


def main(src, dst):
    with open(src, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)

    kept = []
    for r in rows:
        date = r["Publication date"].strip()
        compute = num(r["Training compute (FLOP)"])
        if not date or compute is None:
            continue
        kept.append({
            "model": r["Model"].strip(),
            "organization": r["Organization"].strip(),
            "org_primary": first(r["Organization"]) or "Unknown",
            "date": date,
            "domain": r["Domain"].strip(),
            "domain_group": domain_group(r["Domain"]),
            "country": r["Country (of organization)"].strip(),
            "country_primary": country_primary(r["Country (of organization)"]),
            "compute": compute,
            "parameters": num(r["Parameters"]),
            "dataset_size": num(r["Training dataset size (total)"]),
            "notability": r["Notability criteria"].strip(),
            "confidence": r["Confidence"].strip() or "Unknown",
        })
    kept.sort(key=lambda m: (m["date"], m["model"]))

    out = {
        "meta": {
            "title": "Notable AI Models (trimmed for the explorer)",
            "source": "Epoch AI, 'Notable AI Models'",
            "source_url": "https://epoch.ai/data/notable_ai_models.csv",
            "page_url": "https://epoch.ai/data/ai-models",
            "licence": "CC BY 4.0",
            "downloaded": "2026-11-07",
            "source_updated": "2026-11-03",
            "rows_source": len(rows),
            "rows_kept": len(kept),
            "columns_source": len(header),
            "rule": "Kept rows with both a publication date and a training-compute estimate.",
            "derived": {
                "domain_group": "Epoch's Domain tags mapped to 8 groups: any 'Multimodal' tag, or two of Language/Vision/Speech, is Multimodal; otherwise the first tag (Image generation and Video count as Vision, Audio as Speech, Medicine as Biology, anything else as Other).",
                "org_primary": "First organization listed.",
                "country_primary": "Country of the organization; 'Multinational' when more than one distinct country is listed.",
            },
            "domain_order": DOMAIN_ORDER,
            "redrawn_by": "José Ochoa; not affiliated with Epoch AI",
        },
        "models": kept,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    print("rows in source:", len(rows))
    print("rows kept:", len(kept))
    print("dropped (no date or no compute):", len(rows) - len(kept))
    print("domain groups:", Counter(m["domain_group"] for m in kept).most_common())
    print("top orgs:", Counter(m["org_primary"] for m in kept).most_common(10))
    print("top countries:", Counter(m["country_primary"] for m in kept).most_common(10))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

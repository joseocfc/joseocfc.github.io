# data/epoch

`notable_models.json` is a trimmed copy of Epoch AI's **Notable AI Models** dataset, used by
`/work/epoch-explorer/` (`assets/js/epoch-explorer.js`) and by the matplotlib twin
(`tools/epoch_chart.py`).

**Licence.** Data: Epoch AI, "Notable AI Models" (CC BY 4.0), downloaded 2026-11-07 from
epoch.ai/data/notable-ai-models (file https://epoch.ai/data/notable_ai_models.csv; the source page
lists it as updated 2026-11-03). Redrawn by José Ochoa; not affiliated with Epoch AI.
Epoch's terms: "Epoch AI's data is free to use, distribute, and reproduce provided the source and
authors are credited."

## Row counts

| | rows | columns |
|---|---:|---:|
| Source CSV (`research/epoch-data/notable_ai_models.csv`, 2,281,009 bytes) | 1,092 | 47 |
| Kept in `notable_models.json` (205,955 bytes) | **543** | 10 kept + 3 derived |
| Dropped: no publication date or no training-compute estimate | 549 | |

Every row in the source has a publication date; all 549 dropped rows lack a training-compute
estimate. Epoch's own explorer shows "568 Results" for the same view; the small difference is
expected, since their app also plots rows from sibling tables.

## Fields

| field | from source column | notes |
|---|---|---|
| `model` | Model | |
| `organization` | Organization | verbatim, may list several, comma-separated |
| `org_primary` | derived | first organization listed; `Unknown` when blank (15 rows) |
| `date` | Publication date | ISO `YYYY-MM-DD`, 1950-07-02 to 2026-10-15 |
| `domain` | Domain | verbatim tags, comma-separated |
| `domain_group` | derived | one of Language, Vision, Multimodal, Games, Speech, Biology, Robotics, Other (rule below) |
| `country` | Country (of organization) | verbatim |
| `country_primary` | derived | single country (`United States of America` shortened to `United States`); `Multinational` when more than one distinct country is listed |
| `compute` | Training compute (FLOP) | number, > 0 |
| `parameters` | Parameters | number or `null` |
| `dataset_size` | Training dataset size (total) | number or `null` (units vary by domain; see Epoch's documentation) |
| `notability` | Notability criteria | verbatim |
| `confidence` | Confidence | Confident / Likely / Speculative |

**Domain rule.** Any `Multimodal` tag, or two or more of Language / Vision / Speech, makes the
model `Multimodal`. Otherwise the first tag decides: Image generation and Video count as Vision,
Audio as Speech, Medicine as Biology; Earth science, Mathematics, Search, Recommendation,
Materials science and Other become `Other`. Result: Language 254, Vision 121, Multimodal 58,
Biology 35, Games 25, Other 22, Speech 21, Robotics 7.

## Rebuild

```sh
python3 -I site/data/epoch/trim_notable_models.py \
  research/epoch-data/notable_ai_models.csv site/data/epoch/notable_models.json
```

Standard library only. The script prints the counts above.

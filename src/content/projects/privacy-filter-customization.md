---
title: "Customize OpenAI privacy-filter for Snowflake semantic_categories"
description: "Fine-tune OpenAI's privacy-filter model on Snowflake's semantic_categories taxonomy, then evaluate against a hand-labeled holdout."
status: active
started: 2026-04-23
updated: 2026-05-06
tags: ["data-governance", "llm", "snowflake", "evals"]
draft: false
---

## Overview

OpenAI's [privacy-filter model](https://openai.com/index/introducing-openai-privacy-filter/) is trained on generic PII categories. Snowflake's [`semantic_categories`](https://docs.snowflake.com/en/sql-reference/functions/extract_semantic_categories) use a richer, domain-specific taxonomy (e.g. `US_PASSPORT`, `IBAN_CODE`, `HEALTHCARE_NUMBER`).

**Goal:** Customize the privacy-filter so it can output Snowflake-aligned categories directly, then evaluate quality against a hand-labeled holdout set.

**Success criteria:**
- Macro-F1 ≥ 0.80 on the holdout across all Snowflake categories that have ≥ 20 labeled examples.
- Latency p95 ≤ 150 ms per document at evaluation time.

### Resources

- [Introducing OpenAI Privacy Filter](https://openai.com/index/introducing-openai-privacy-filter/) — announcement with architecture details (1.5B params, 50M active, 128k context)
- [openai/privacy-filter on GitHub](https://github.com/openai/privacy-filter) — Python CLI (`opf`) for redaction, evaluation, and fine-tuning
- [openai/privacy-filter on Hugging Face](https://huggingface.co/openai/privacy-filter) — model weights (Apache 2.0), `AutoModelForTokenClassification` usage
- [Community fine-tuned variants](https://huggingface.co/models?other=base_model%3Afinetune%3Aopenai%2Fprivacy-filter) — existing fine-tunes including quantized and domain-specific adaptations
- [Snowflake `EXTRACT_SEMANTIC_CATEGORIES`](https://docs.snowflake.com/en/sql-reference/functions/extract_semantic_categories) — reference taxonomy (47 categories as of 8.x)
- [ai4privacy/pii-masking-300k](https://huggingface.co/datasets/ai4privacy/pii-masking-300k) — OpenPII-220k (27 PII classes, 6 languages) + FinPII-80k (~20 finance/insurance classes); ~98.3% label accuracy

---

## 2026-05-06 — kickoff

- Pulled the full Snowflake `semantic_categories` reference list (47 categories as of Snowflake 8.x).
- Mapped each Snowflake category to the closest OpenAI `privacy-filter` output label where one exists. ~30% have no direct mapping — these are the interesting gap cases.
- Next: sample the gap categories from internal datasets and build a label schema for annotation.

---

## 2026-04-23 — initial exploration

### Fine-tuning pipeline

- `opf train` ships natively — handles JSONL ingestion, 128-token banded attention windowing, AdamW with gradient accumulation, checkpoint serialization.
- Two demo workflows: *policy adaptation* (relabel existing categories) and *new taxonomy* (custom label space).
- **Output head remapping**: exact-match labels copy weights directly; new labels warm-start from closest base class (e.g. `B-custom_id` inherits `B-ID` weights). This is why OpenAI's benchmark jumped from 54% → 96% F1 on small data.
- Custom taxonomies configured via `label_space.json` with `span_class_names`. BIOES expansion is automatic; background class `O` must be first entry.

### Compute requirements

- Model: 2.8 GB safetensors (BF16), 1.5B total params / 50M active (MoE).
- Full fine-tune: ~24 GB VRAM (mixed precision) — single A100 40GB or RTX 4090 24GB.
- LoRA alternative: ~12 GB, viable on consumer GPUs.

### PoC plan (one-week target)

1. **Environment + baseline** — clone repo, pull checkpoint (~17 GB), verify `opf redact` on sample text, download ai4privacy English splits, convert to `opf` eval JSONL.
2. **Baseline eval** — collapse ai4privacy's 27 classes → Privacy Filter's 8 categories, run `opf eval`, reproduce ~96% F1 as sanity check, note per-category breakdown.
3. **Taxonomy design** — design ~15–20 target categories aligned to Snowflake's `SEMANTIC_CATEGORY` (NAME, EMAIL, PAYMENT_CARD, PASSPORT, NATIONAL_IDENTIFIER, STREET_ADDRESS, PHONE_NUMBER, IP_ADDRESS, DATE_OF_BIRTH, AGE, GENDER, OCCUPATION, SALARY, MEDICAL_CONDITION, MEDICATION…). Write `label_space.json`, maintain a mapping file.
4. **Data prep + smoke training** — generate JSONL with new labels, 80/10/10 split, run `opf train` on 5–10k subset to validate pipeline end-to-end.
5. **Full fine-tune** — ~150k examples, 2–3 epochs, single A100, checkpoint every N steps.
6. **Evaluation** — `opf eval` on held-out test, build confusion matrix. Focus on overlapping pairs: NAME vs ORGANIZATION_IDENTIFIER, NATIONAL_IDENTIFIER vs TAX_IDENTIFIER, PAYMENT_CARD vs BANK_ACCOUNT.

### Key risks

- **Category overlap degradation** — expect 10–20 pt F1 drop on overlapping numeric-ID categories.
- **Label skew** — ai4privacy over-represents `firstname`; eval needs stratified sampling to avoid misleading macro-F1.
- **OOD gap** — ai4privacy covers education/health/psychology/finance; Snowflake customer data (log lines, transaction records, support tickets) may differ.
- **Licensing** — ai4privacy is academic-friendly; production use at Snowflake needs commercial license or synthetic dataset alternative.

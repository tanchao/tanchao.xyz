---
title: "Customize OpenAI privacy-filter for Snowflake semantic_categories"
description: "Fine-tune OpenAI's privacy-filter model on Snowflake's semantic_categories taxonomy, then evaluate against a hand-labeled holdout."
status: active
started: 2026-04-23
updated: 2026-07-20
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
- [Snowflake ML Jobs overview](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-jobs/overview) — run arbitrary Python ML workloads on Snowflake GPU compute pools via `@remote` decorator or `submit_*` APIs
- [Snowflake distributed training](https://docs.snowflake.com/en/developer-guide/snowflake-ml/distributed-training) — `PyTorchDistributor` for multi-node/multi-GPU training inside Container Runtime
- [SPCS AWS instance families](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/instance-families-aws) — GPU_NV_S (1x A10G 24 GB) through GPU_NV_L (8x A100 320 GB) and GPU_L40S/GPU_R6K

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

---

## 2026-07-20 — can we train this on Snowflake?

### The question

The original plan assumed a local A100 or RTX 4090. The question is whether we can run the full `opf train` pipeline on the Snowflake platform instead — keeping training data, labeled holdout, and the fine-tuned checkpoint inside the Snowflake trust boundary. The short answer is yes, via [Snowflake ML Jobs](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-jobs/overview) on a GPU compute pool, but the product fit is narrow. The two turnkey Cortex fine-tuning offerings both miss by model family, so the right path is the general-purpose container runtime.

### Paths considered

**[Cortex Fine-Tuning](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-finetuning) (GA)** — LoRA-only, six pre-approved generative base models (`llama3-8b/70b`, `llama3.1-8b/70b`, `mistral-7b`, `mixtral-8x7b`), strict `prompt`/`completion` schema. Not applicable: privacy-filter is an `AutoModelForTokenClassification`, not one of those models.

**[Cortex Training](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-training) (Public Preview, June 2026)** — full fine-tune + reinforcement learning via managed GPU pools and ArcticTraining YAML config. Supported families: open-weight Qwen and Mistral only. Again, not applicable for this model.

**[Snowflake ML Jobs](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-jobs/overview) + Container Runtime on a GPU compute pool** — lift-and-shift of the existing `opf train` / HF `transformers` loop. Custom pip and HuggingFace packages install via `runtime_environment`. The `@remote` decorator or `submit_from_stage` submits the job; [`PyTorchDistributor`](https://docs.snowflake.com/en/developer-guide/snowflake-ml/distributed-training) handles multi-GPU data-parallel scaling. This is the right path.

**Model Registry + SPCS serving** — after training, the fine-tuned checkpoint registers as a `token-classification` HF pipeline (`TransformersPipeline`) and deploys via `create_service` on a GPU pool. The holdout eval and p95 latency check run entirely in-account.

### Revised plan (Snowflake ML Jobs)

Replaces the local A100/4090 assumption from the 2026-04-23 PoC plan. Full setup walkthrough in [`docs/plans/privacy-filter/snowflake-setup.md`](../../docs/plans/privacy-filter/snowflake-setup.md). For a lower-friction serverless PoC alternative, see [`docs/plans/privacy-filter/modal-setup.md`](../../docs/plans/privacy-filter/modal-setup.md).

1. **Data staging** — load ai4privacy English splits and any hand-labeled Snowflake-category examples into a Snowflake internal stage or table. Convert to `opf` JSONL inside a Container Runtime job using a CPU pool.
2. **Smoke training** — submit `opf train` (5–10k examples, 1 epoch) as an ML Job on `GPU_NV_S` (1× A10G, 24 GB VRAM). This covers the LoRA path (~12 GB) and is the cheapest smoke check; validates the end-to-end pipeline without burning large-GPU credits.
3. **Full fine-tune** — scale to `GPU_L40S` (up to 8× L40S, 48 GB each) or `GPU_NV_L` (8× A100, 40 GB each, on request) for the ~150k-example, 2–3 epoch run. Use `PyTorchDistributor` with `num_nodes=1, num_gpus=4` as the baseline; add nodes if epoch time exceeds a few hours.
4. **Checkpoint to stage** — write final checkpoint safetensors to a named Snowflake stage. Pin the commit hash and epoch number in the stage path for reproducibility.
5. **Register + serve** — log the fine-tuned model to the Model Registry from the stage (custom model path, not the HF repo id — see trade-offs below). Call `create_service` on a GPU pool for the holdout eval endpoint. Run `opf eval` against the held-out test set in-account; build the confusion matrix from the service response.

### Trade-offs

**GPU pool availability** — `GPU_NV_L` (A100) requires an on-request allocation; not always available in all AWS regions. `GPU_L40S` (L40S, 48 GB/GPU) and `GPU_R6K` (Blackwell RTX 6000, 96 GB/GPU) are GA as of May 2026 but AWS-only. Plan for `GPU_NV_M` (4× A10G, 96 GB total) as the fallback if neither is immediately available — it's sufficient for a distributed full fine-tune.

**Data residency win** — this is the primary reason to prefer Snowflake over local: training data never leaves the account boundary. For a model intended to run on Snowflake customer data (log lines, transaction records, support tickets), keeping the labeled examples and the training run in the same governance perimeter is meaningful.

**Model Registry caveat** — the `TransformersPipeline` wrapper in the Model Registry takes an HF Hub repo identifier by default. A custom fine-tuned checkpoint on a Snowflake stage needs to be logged either (a) via a custom `snowflake.ml.model.custom_model.CustomModel` wrapper that loads from the stage path, or (b) by pushing the checkpoint to a private HF repo first and referencing it. Option (a) keeps everything in-account; option (b) is simpler to implement. Decide before step 5.

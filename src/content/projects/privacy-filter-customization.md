---
title: "Customize OpenAI privacy-filter for Snowflake semantic_categories"
description: "Fine-tune OpenAI's privacy-filter model on Snowflake's semantic_categories taxonomy, then evaluate against a hand-labeled holdout."
status: active
started: 2026-05-06
updated: 2026-05-06
tags: ["data-governance", "llm", "snowflake", "evals"]
draft: false
---

## Overview

OpenAI's [privacy-filter model](https://platform.openai.com/docs/guides/moderation) is trained on generic PII categories. Snowflake's [`semantic_categories`](https://docs.snowflake.com/en/sql-reference/functions/extract_semantic_categories) use a richer, domain-specific taxonomy (e.g. `US_PASSPORT`, `IBAN_CODE`, `HEALTHCARE_NUMBER`).

**Goal:** Customize the privacy-filter so it can output Snowflake-aligned categories directly, then evaluate quality against a hand-labeled holdout set.

**Success criteria:**
- Macro-F1 ≥ 0.80 on the holdout across all Snowflake categories that have ≥ 20 labeled examples.
- Latency p95 ≤ 150 ms per document at evaluation time.

---

## 2026-05-06 — kickoff

- Pulled the full Snowflake `semantic_categories` reference list (47 categories as of Snowflake 8.x).
- Mapped each Snowflake category to the closest OpenAI `privacy-filter` output label where one exists. ~30% have no direct mapping — these are the interesting gap cases.
- Next: sample the gap categories from internal datasets and build a label schema for annotation.

---
title: "What Data Scientists and Analysts Should Build Now"
description: "As agents automate SQL and pipelines, the durable work for data scientists and analysts shifts from one-off reports to products: a semantic layer, an analytics agent, an eval harness, and small domain-tuned models."
tldr: "Agents now write the plumbing, so the highest-leverage work for a DS/DA is no longer the one-off report. It is building durable products around meaning: a governed semantic layer, an analytics agent that queries it, an evaluation harness that keeps both honest, and small domain-tuned models for narrow jobs."
date: 2026-07-20
tags: ["data", "career", "ai", "analytics", "semantic-layer"]
draft: true
---

The highest-leverage work for a data scientist or analyst in 2026 is no longer the one-off report. It is building durable products that survive the shift to AI: a governed semantic layer, an analytics agent that queries it, an evaluation harness that keeps both honest, and small domain-tuned models for narrow jobs. Agents now write the SQL; the human owns the meaning.

## Why the deliverable changed

The classic DS/DA output — a query, a chart, a slide — is exactly the kind of artifact generation is good at, because each is a translation of business meaning into a technical form. In January 2026, dltHub reported that [91% of new community data pipelines were built by agents](https://dlthub.com/blog/the-rise-of-the-knowledge-engineer). Transformations, dashboards, and semantic models share the same property and are automating the same way.

What agents cannot generate is meaning: which records count, why a definition excludes what it excludes, where the historical breaks in the data live. That is the gap, and it is where the new products get built. Snowflake and Atlan found that injecting governed metadata into prompts moved text-to-SQL accuracy from a [10–31% starting range to 94–99%](https://atlan.com/know/ai-agents-for-data-engineering/) on enterprise queries. The model was never the bottleneck. Context was.

## Build a semantic layer, not another dashboard

The first product is a **semantic layer**: metrics, dimensions, join paths, and access policies defined once, in version control, as a public API for every downstream consumer — BI tools, embedded apps, and increasingly AI agents. Instead of shipping a dashboard that answers one question, you ship the governed definition of `revenue`, `active_user`, and `churn` that a hundred questions resolve against.

DS/DA are the right people to build this because it is a domain-knowledge problem, not an infrastructure one. The tooling is mature: [dbt Semantic Layer (MetricFlow)](https://docs.getdbt.com/docs/build/about-metricflow), [Cube](https://cube.dev/), and platform-native options like Snowflake Semantic Views and Databricks Metric Views. The work that matters is naming, disambiguation, and encoding the logic that currently lives in one person's head.

## Build the analytics agent that sits on top of it

The second product is an **analytics agent** — a natural-language interface that answers business questions by selecting from certified metrics rather than writing raw SQL against physical tables. Pointed at raw schemas, an LLM re-derives joins and grain on every prompt and returns different numbers each time; pointed at a semantic layer, it [selects from governed definitions and applies row-level access before the query runs](https://cube.dev/articles/semantic-layer-for-ai-agents-2026).

In 2026 the agent typically reaches those metrics over the Model Context Protocol (MCP), which exposes measures and dimensions as tools. A research NL2SQL agent mediated by a semantic layer hit [94% execution accuracy on Spider2-snow](https://arxiv.org/html/2606.31041v1), a real enterprise benchmark on Snowflake, far above schema-only prompting. The product a DS/DA owns here is the mapping from business questions to the governed surface — plus the guardrails on what the agent is allowed to answer.

## Build the eval harness that keeps it honest

The third product is the least glamorous and the most valuable: an **evaluation harness**. Once agents answer questions and generate models, someone has to prove the answers are right, repeatable, and safe. That means treating metric definitions and agent responses as testable artifacts — golden question sets, regression tests on definitions, and checks that access policies actually held.

This is a genuinely new deliverable, and it is a natural fit for the analytical mindset. It is also what separates "AI you have to double-check" from "AI the organization can rely on." Evals, lineage, and audit-log review are moving from nice-to-have to [table stakes for anyone shipping AI against data](https://upriverdata.com/blog/the-state-of-agentic-data-engineering-where-major-data-players-are-headed-in-2026).

## Build small, domain-tuned models for narrow jobs

The fourth product is a **small model customized to a narrow, high-value task** — classification, extraction, redaction — trained on your own governed data rather than a generic corpus. This is not frontier model-building; it is taking an open-weight model and aligning it to a specific taxonomy where accuracy and cost both matter.

A concrete example is adapting a PII classifier to a platform's own category taxonomy: my [privacy-filter customization project](/projects/privacy-filter-customization/) is exactly this shape — take a general token classifier, retarget it to a domain schema, and evaluate against a hand-labeled holdout. The DS/DA advantage is knowing what "correct" means for the domain, which is the hard part of the eval.

## Build knowledge that outlives you

The last product is not code. It is the **context artifact**: the business glossary, the documented definitions, the ontology that captures why the data means what it means. The role is shifting from transformation engineer to [context engineer](https://infinitelambda.com/omni-semantic-layer-architecture-ai-agents/) — the person who moves institutional knowledge out of individual heads and into a versioned artifact the organization owns.

This is what makes every other product on this list work. The semantic layer, the agent, and the evals are only as good as the meaning encoded beneath them.

## Where to start

Pick the one that removes the most repeated pain. If your team re-answers the same metric questions, build the semantic layer first. If people wait days for answers, build the agent. If no one trusts the numbers, build the evals. The through-line is the same: stop producing disposable answers and start producing the governed substrate those answers come from. The reports were always the output; now they are the commodity, and the substrate is the product.

Demand for the underlying skills is not going away — the US BLS still projects data science among the [fastest-growing occupations through 2034](https://analythical.com/blog/the-data-job-market-in-2026). What changed is the deliverable. Build products, not reports.

---

## Sources

- [dltHub — The rise of the semantic engineer](https://dlthub.com/blog/the-rise-of-the-knowledge-engineer)
- [Atlan — AI agents for data engineering (2026)](https://atlan.com/know/ai-agents-for-data-engineering/)
- [Cube — Semantic layer for AI agents (2026)](https://cube.dev/articles/semantic-layer-for-ai-agents-2026)
- [Upriver — The state of agentic data engineering (2026)](https://upriverdata.com/blog/the-state-of-agentic-data-engineering-where-major-data-players-are-headed-in-2026)
- [Infinite Lambda — Semantic layer architecture and the context engineer](https://infinitelambda.com/omni-semantic-layer-architecture-ai-agents/)
- [Semantic-layer-mediated NL2SQL agent (arXiv)](https://arxiv.org/html/2606.31041v1)
- [Analythical — The data job market in 2026](https://analythical.com/blog/the-data-job-market-in-2026)

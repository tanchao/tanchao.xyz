---
title: "Data Policy Overlay Vendors: Immuta, Privacera, OneTrust, and Lake Formation"
description: "When the native catalog isn't enough: how policy overlay vendors layer ABAC, purpose-based access, masking, and audit on top of BigQuery, Databricks, Snowflake, and the wider lakehouse — and where the AWS-native overlay (Lake Formation) fits in."
date: 2026-05-13
tags: ["immuta", "privacera", "onetrust", "aws", "lake-formation", "governance", "data"]
draft: true
---

> Part of the [Data Platform Protection survey](/posts/2026/05/13/data-platform-protection-survey/).
> Sibling deep-dives:
> [BigQuery](/posts/2026/05/13/bigquery-data-protection/) ·
> [Databricks Unity Catalog](/posts/2026/05/13/databricks-unity-catalog-data-protection/) ·
> [Governance-as-code with dbt + Terraform](/posts/2026/05/13/data-governance-as-code-dbt-terraform/) ·
> [The third-party auditor's gap list](/posts/2026/05/13/data-platform-auditor-gaps/)

<!-- WRITING PROMPT — opener:
   - Frame: native catalogs (BigQuery policy tags, Unity Catalog ABAC, Snowflake masking policies) all converged on similar models. Why do overlays still exist?
   - Answer: heterogeneous estates, purpose-based access, regulatory evidence in one place, faster iteration than waiting for the warehouse vendor.
   - Tone: skeptical-but-fair — overlays add cost and a control plane. They earn it under specific conditions.
-->

## What "policy overlay" actually means

<!-- PROMPT:
   - Definition: a control plane that sits beside the warehouse, translates a single policy into native warehouse primitives (masking policies, row access policies, grants), and centralizes audit.
   - Two flavors:
     1. Compile-and-push (Immuta, Privacera PolicySync) — overlay generates native objects.
     2. Runtime intercept (less common now; older Privacera/Ranger plugin model) — query passes through an intercept layer.
   - The trade: single policy authoring vs adding another vendor to the dependency graph.
-->

## 1. Immuta

<!-- PROMPT:
   - Origin: defense / regulated workloads, founders Steve Touw and Matt Carroll.
   - The model: subscription policies (table access) + data policies (row/column).
   - ABAC throughout: user attributes + tags compose into policy conditions.
   - PBAC via projects and purposes — declared use case bound to access.
   - Cite: ABAC subscription [1], PBAC [3].
-->

### 1.1 Policy as code

<!-- PROMPT:
   - The V2 API: JSON/YAML payloads for subscription + data policies.
   - This is what makes policy diffs reviewable in PRs.
   - Cite: V2 API [2].
-->

### 1.2 The masking matrix

<!-- PROMPT:
   - Why "matrix": the cell is (data type × masking technique).
   - Techniques: hashing, regex replace, k-anonymization, randomized response, conditional masking, format-preserving.
   - The k-anonymization story is unusually deep for a vendor — engineering blog on SQL-based enforcement.
   - Cite: masking matrix [4], k-anonymity blog [9], data protection grammar [10].
-->

### 1.3 Integrations and where they enforce

<!-- PROMPT:
   - Snowflake (masking + row access policies generated), Databricks (UC integration), BigQuery, Starburst/Trino, Redshift.
   - The integration matrix tells you which capabilities work where — not all features available everywhere.
   - Cite: integrations matrix [6].
-->

### 1.4 Detect and the Universal Audit Model

<!-- PROMPT:
   - Detect: activity monitoring built on UAM events.
   - UAM schema is your single normalized audit shape across heterogeneous warehouses.
   - The auditor angle: one log shape, regardless of where the query ran.
   - Cite: Detect [7], UAM schema [8].
-->

## 2. Privacera

<!-- PROMPT:
   - Origin: Apache Ranger commercialization (founders from Hortonworks Ranger team).
   - Two enforcement modes:
     1. PolicySync — push policies into target system natively.
     2. Ranger plugin — runtime enforcement at compute (Spark, Trino, Presto, EMR).
   - Heritage gives it deeper Hadoop / on-prem coverage than Immuta.
   - Cite: PolicySync [11], Ranger plugin [12], Ranger admin [13].
-->

### 2.1 Deployment models

<!-- PROMPT:
   - PrivaceraCloud (SaaS) vs self-managed.
   - Self-managed is meaningful for FedRAMP-tight estates that won't accept a SaaS control plane.
   - Cite: deployment options [14].
-->

### 2.2 Connector example: Snowflake

<!-- PROMPT:
   - Discovery, classification, masking policy push.
   - PolicySync compiles into native Snowflake masking + row access policies.
   - Cite: Snowflake connector [15].
-->

## 3. OneTrust

<!-- PROMPT:
   - Different vendor identity: OneTrust is a privacy/compliance platform first, with a data discovery and use-governance product layered on.
   - DataDiscovery: classification across structured + unstructured.
   - Data Use Governance: purpose-aware controls, often paired with consent records held elsewhere in OneTrust.
   - Note for clarity: Convercent (OneTrust acquisition) is ethics & compliance — not the discovery line.
   - Cite: DataDiscovery launch [16], data sheet [17], Data Use Governance [18], Convercent acquisition note [19].
-->

### 3.1 When OneTrust is the right pick

<!-- PROMPT:
   - You already run OneTrust for privacy program ops (DSARs, ROPA, consent).
   - You want classification + governance to share metadata and policy with privacy.
   - Anti-pattern: buying OneTrust solely for warehouse policy enforcement — Immuta and Privacera are deeper there.
-->

## 4. AWS Lake Formation: the AWS-native overlay

<!-- PROMPT:
   - Reframe: Lake Formation is the AWS overlay for Glue Data Catalog-backed estates (Athena, Redshift Spectrum, EMR, Glue ETL, S3 Tables).
   - The model:
     - LF-Tags = tag-based access control (closest analog to UC governed tags + BigQuery policy tags).
     - Data filters = row + column + cell-level filtering as a granted permission.
     - Cross-account sharing as a first-class flow.
   - Recent direction: S3 Tables (Iceberg-native storage) ride on top of LF for governance.
   - Cite: LF-Tags [20], data filters [21], grant filters [22], cross-account [23], service integrations [24], S3 Tables catalog [25], Iceberg prescriptive guidance [26].
-->

### 4.1 LF-Tags vs Immuta/Privacera tags

<!-- PROMPT:
   - LF-Tags are AWS-only — useful inside AWS, invisible to Snowflake or Databricks-on-Azure.
   - Immuta/Privacera tags can carry across heterogeneous compute.
   - When LF is enough: AWS-only estate, Glue catalog as source of truth.
   - When you outgrow LF: multi-cloud, or you need k-anonymity / format-preserving masking.
-->

### 4.2 Iceberg + Lake Formation governance

<!-- PROMPT:
   - S3 Tables makes Iceberg a managed storage offering — LF policies apply to the Iceberg tables.
   - The audit angle: Iceberg's snapshot history + LF audit gives you "who could see this snapshot at this time".
   - Open question for an auditor: how do you prove right-to-be-forgotten on an append-only table format? (Tease the auditor-gaps post.)
-->

## When overlays earn their cost

<!-- PROMPT — opinionated bullets:
   - You query the same logical dataset from 3+ engines (Snowflake + Databricks + Trino, etc.).
   - You need PBAC tied to declared purpose (research vs operational vs marketing).
   - You need k-anonymity, format-preserving masking, or randomized response — beyond what natives ship.
   - You need a single normalized audit shape for SOC 2 / ISO 27701 evidence.
-->

## When native is enough

<!-- PROMPT — opinionated bullets:
   - Single-warehouse estate (BigQuery-only or UC-only).
   - Hash / null / regex masking is sufficient.
   - Tagging-driven ABAC in the native catalog meets your policy needs.
   - Audit shape can stay native (Cloud Audit Logs, `system.access.audit`).
-->

---

## Sources

### Immuta
1. ABAC subscription policies — <https://documentation.immuta.com/latest/governance/author-policies-for-data-access-control/authoring-policies-in-secure/section-contents/how-to-guides/abac-subscription-policy.md>
2. V2 policy-as-code API — <https://documentation.immuta.com/latest/developer-guides/api-intro/immuta-v2-api/policies>
3. PBAC — projects and purposes — <https://documentation.immuta.com/latest/governance/author-policies-for-data-access-control/projects-and-purpose-based-access-control>
4. Masking matrix functions — <https://documentation.immuta.com/latest/governance/author-policies-for-data-access-control/authoring-policies-in-secure/data-policies/reference-guides/masking-matrix-functions.md>
5. Subscription vs data policies — <https://documentation.immuta.com/latest/governance/author-policies-for-data-access-control/authoring-policies-in-secure>
6. Integrations matrix — <https://documentation.immuta.com/2026.1/configuration/integrations/integrations-overview>
7. Detect (activity monitoring) — <https://documentation.immuta.com/latest/governance/detect-your-activity>
8. Universal Audit Model schema — <https://documentation.immuta.com/latest/governance/detect-your-activity/audit/reference-guides/universal-audit-model-uam/uam-schema.md>
9. SQL-based k-anonymization (Immuta blog) — <https://www.immuta.com/blog/sql-based-enforcement-of-k-anonymization/>
10. A Data Protection Grammar (Stalla-Bourdillon et al.) — <https://www.immuta.com/resources/a-data-protection-grammar/>

### Privacera
11. PolicySync — <https://privacera.com/docs/en/policysync.html>
12. Apache Ranger plugin — <https://docs.privacera.com/resources/design/access-management/integrations/apache_ranger_plugin.html>
13. Apache Ranger admin — <https://docs.privacera.com/get-started/apache-ranger-admin/index.html>
14. Deployment options — <https://docs.privacera.com/get-started/deployment-options/index.html>
15. Snowflake connector — <https://docs.privacera.com/connectors/snowflake/index.html>

### OneTrust
16. DataDiscovery launch — <https://www.onetrust.com/news/onetrust-launches-data-discovery>
17. Data Discovery & Security data sheet — <https://www.onetrust.com/resources/data-discovery-and-security-data-sheet>
18. Data Use Governance — <https://www.onetrust.com/solutions/data-use-governance/>
19. Convercent acquisition (clarifying note) — <https://www.onetrust.com/news/onetrust-to-acquire-convercent/>

### AWS Lake Formation
20. LF-Tags / tag-based access control — <https://docs.aws.amazon.com/lake-formation/latest/dg/tag-based-access-control.html>
21. Data filters (row, column, cell) — <https://docs.aws.amazon.com/lake-formation/latest/dg/data-filtering.html>
22. Granting permissions on data filters — <https://docs.aws.amazon.com/lake-formation/latest/dg/granting-filter-perms.html>
23. Cross-account permissions — <https://docs.aws.amazon.com/lake-formation/latest/dg/cross-account-permissions.html>
24. Service integrations matrix — <https://docs.aws.amazon.com/lake-formation/latest/dg/service-integrations.html>
25. S3 Tables catalog integration — <https://docs.aws.amazon.com/lake-formation/latest/dg/create-s3-tables-catalog.html>
26. Apache Iceberg on AWS — governance — <https://docs.aws.amazon.com/prescriptive-guidance/latest/apache-iceberg-on-aws/governance.html>

<!-- VERIFY-AT-PUBLISH:
   - Immuta integrations matrix often updates per release tag (link uses 2026.1).
   - Privacera doc URLs have moved between privacera.com and docs.privacera.com.
-->

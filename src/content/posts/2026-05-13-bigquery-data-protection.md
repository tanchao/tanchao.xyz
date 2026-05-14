---
title: "Data Protection in BigQuery: A Field Guide"
description: "How BigQuery layers IAM, policy tags, dynamic masking, RLS, authorized views, VPC Service Controls, CMEK/EKM, and the (renamed) Knowledge Catalog into a defensible data protection posture — and what it leaves to you."
date: 2026-05-13
tags: ["bigquery", "gcp", "security", "governance", "data"]
draft: true
---

> Part of the overview: [How Modern Data Platforms Protect Data](/posts/2026/05/13/how-modern-data-platforms-protect-data/).
> Sibling deep-dives:
> [Databricks Unity Catalog](/posts/2026/05/13/databricks-unity-catalog-data-protection/) ·
> [Policy overlay vendors](/posts/2026/05/13/data-policy-overlay-vendors/) ·
> [Governance-as-code with dbt + Terraform](/posts/2026/05/13/data-governance-as-code-dbt-terraform/) ·
> [The third-party auditor's gap list](/posts/2026/05/13/data-platform-auditor-gaps/)

<!-- WRITING PROMPT — opener (1-2 paras):
   - Set up: BigQuery is a serverless DW. Your protection model lives in IAM, the catalog, and the query engine — not in cluster configs.
   - Frame: walk the request path: IdP → IAM → dataset/table → column/row policy → masked output → audit log.
   - Tone: opinionated, ground-truth, like the AI rubrics post.
-->

## The request path, end to end

<!-- PROMPT:
   - Diagram or numbered list of what happens when a user issues SELECT in BigQuery.
   - Steps: identity (Google Workspace / federated) → IAM check at project/dataset/table → row access policy filter applied → column policy tag check + masking applied → results returned → Cloud Audit Log written.
   - Cite: access control intro [1], data governance overview [2].
-->

## 1. IAM hierarchy and least privilege

<!-- PROMPT:
   - Project / dataset / table / view / routine granularity.
   - Predefined roles vs custom roles vs IAM Conditions.
   - Service accounts: where they sprawl (scheduled queries, Dataform, Dataflow, Composer).
   - "Dataset-level is the natural unit" — most teams over-grant at project level.
   - Cite: control access to resources [10].
-->

## 2. Policy tags: BigQuery's classification primitive

<!-- PROMPT:
   - Policy tags live in a Data Catalog taxonomy and bind to columns.
   - Two uses: column-level access control (CLS) and dynamic data masking.
   - The taxonomy is the lever — designing the taxonomy is the actual governance work.
   - Anti-pattern: tagging at table create time instead of in CI / classification scan.
   - Cite: column-level security intro [3], implement column-level control [4].
-->

## 3. Dynamic data masking

<!-- PROMPT:
   - Masking rules attach to a policy tag; readers see substituted values based on their group.
   - Built-in masking routines (NULL, default value, hash SHA256, last-4, email, date-year).
   - Custom UDF masking via authorized routines.
   - Cite: column data masking intro [5].
-->

## 4. Row-level security

<!-- PROMPT:
   - Row access policies = predicate filters with grantee lists, evaluated at query time.
   - Compose with CLS: a user can be filtered out of rows AND see masked columns simultaneously.
   - Performance: the filter is a planner-level predicate, not a post-filter.
   - Anti-pattern: trying to do RLS via authorized views when row policies are the right tool.
   - Cite: row-level security intro [6].
-->

## 5. Authorized views, datasets, and routines

<!-- PROMPT:
   - The classic "share a query, not a table" pattern.
   - Authorized datasets scale this — grant a whole dataset of views once.
   - Authorized routines do the same for table functions, UDFs, and stored procedures.
   - When to reach for these vs RLS+CLS: complex joins, business logic, derived metrics.
   - Cite: authorized views [7], authorized datasets [8], authorized routines [9].
-->

## 6. VPC Service Controls

<!-- PROMPT:
   - The IAM-orthogonal control: a network perimeter that stops data exfiltration even with valid creds.
   - Stops things like "service account credentials leaked → attacker copies tables to their project".
   - The perimeter pattern: separate ingress/egress rules, service perimeter bridges, access levels.
   - Operational pain: VPC-SC violations are noisy until your access levels match reality.
   - Cite: VPC SC for BigQuery [11].
-->

## 7. CMEK, Cloud EKM, and column-level AEAD

<!-- PROMPT:
   - Three layers of "you control the key":
     1. CMEK (Cloud KMS keys) — Google holds the HSM, you hold the policy.
     2. Cloud EKM — the key material lives in your external KMS (Fortanix, Equinix SmartKey, Thales, etc.).
     3. AEAD column encryption — selective encryption of specific columns referencing KMS keys.
   - Auditability: KMS audit logs become the second source of truth alongside BigQuery audit logs.
   - The key custody question an auditor will ask: who can read the key, who can rotate it, what triggers rotation.
   - Cite: CMEK [12], encryption at rest [13], column AEAD [14].
-->

## 8. Sensitive Data Protection (Cloud DLP)

<!-- PROMPT:
   - The classification engine BigQuery does not have natively.
   - Inspection / profiling / de-identification jobs against tables.
   - The pattern: SDP scan → infoTypes detected → write findings → driver job tags policy taxonomy.
   - This is where classification *should* originate; tagging by hand drifts.
   - Cite: SDP scan with BigQuery [15].
-->

## 9. The Knowledge Catalog (née Dataplex Universal Catalog, née Data Catalog)

<!-- PROMPT:
   - Naming history: Data Catalog → Dataplex Universal Catalog → Knowledge Catalog (verify name at publish time).
   - What it actually does for protection: holds the policy tag taxonomy, lineage, classification, business glossary.
   - The unification story: one catalog that BigQuery, AlloyDB, Cloud Storage, and Vertex AI all read from.
   - The lineage gap an auditor will ask about: derived tables, ML feature tables, BigQuery ML models.
   - Cite: Knowledge Catalog with BigQuery [16], transition guide [17], unified governance blog [18].
-->

## 10. Cloud Audit Logs: your evidence pack

<!-- PROMPT:
   - Three log streams: Admin Activity (always on), Data Access (off by default — TURN IT ON), System Event.
   - Without Data Access logs, you cannot prove who read what column. Auditors will fail you.
   - Sink the logs to a separate project the production project cannot write to (tamper resistance).
   - Cite: BigQuery audit log reference [19].
-->

## What BigQuery does well

<!-- PROMPT — short, opinionated bullets:
   - IAM at five levels of granularity, all in one consistent model.
   - Policy tags as a first-class classification primitive (rare in cloud DWs).
   - VPC-SC is a real network perimeter, not just a firewall.
   - CMEK + EKM coverage is mature.
-->

## What BigQuery leaves to you

<!-- PROMPT — short, opinionated bullets:
   - Classification: SDP is separate, integration is yours to wire.
   - Lineage: still uneven for derived / BQML / Dataflow paths.
   - Policy-as-code: Terraform providers exist but composition with dbt is a manual layering job (covered in the IaC post).
   - Cross-project / cross-org sharing via Analytics Hub: a separate audit surface most teams miss.
-->

---

## Sources

1. BigQuery security & access controls — <https://cloud.google.com/bigquery/docs/access-control-intro>
2. BigQuery data governance overview — <https://cloud.google.com/bigquery/docs/data-governance>
3. Column-level access control / policy tags — <https://cloud.google.com/bigquery/docs/column-level-security-intro>
4. Restrict columns (implementation) — <https://cloud.google.com/bigquery/docs/column-level-security>
5. Dynamic data masking — <https://cloud.google.com/bigquery/docs/column-data-masking-intro>
6. Row-level security — <https://cloud.google.com/bigquery/docs/row-level-security-intro>
7. Authorized views — <https://cloud.google.com/bigquery/docs/authorized-views>
8. Authorized datasets — <https://cloud.google.com/bigquery/docs/authorized-datasets>
9. Authorized routines — <https://cloud.google.com/bigquery/docs/authorized-routines>
10. IAM at dataset / table / view / routine granularity — <https://cloud.google.com/bigquery/docs/control-access-to-resources-iam>
11. VPC Service Controls perimeter for BigQuery — <https://cloud.google.com/bigquery/docs/vpc-sc>
12. CMEK for BigQuery — <https://cloud.google.com/bigquery/docs/customer-managed-encryption>
13. Encryption at rest (default + KMS) — <https://cloud.google.com/bigquery/docs/encryption-at-rest>
14. Column AEAD encryption with KMS — <https://cloud.google.com/bigquery/docs/column-key-encrypt>
15. Sensitive Data Protection scanning of BigQuery — <https://cloud.google.com/bigquery/docs/scan-with-dlp>
16. Knowledge Catalog with BigQuery — <https://cloud.google.com/bigquery/docs/use-knowledge-catalog>
17. Data Catalog → Knowledge Catalog transition — <https://cloud.google.com/dataplex/docs/transition-to-dataplex-catalog>
18. Unified Dataplex + Data Catalog governance (Cloud Blog) — <https://cloud.google.com/blog/products/data-analytics/manage-and-govern-data-with-the-unified-dataplex-and-data-catalog>
19. BigQuery audit logs reference — <https://cloud.google.com/bigquery/docs/reference/auditlogs>
20. Trusting your data on Google Cloud (whitepaper) — <https://cloud.google.com/security/compliance/trusting_data_gcp_whitepaper>

<!-- VERIFY-AT-PUBLISH:
   - Knowledge Catalog naming (sections 2, 9) — Google has renamed this surface twice in two years.
   - Cloud EKM provider list (section 7) — partner roster shifts.
-->

---
title: "Data Protection in Databricks Unity Catalog: A Field Guide"
description: "How Unity Catalog stitches together the three-level namespace, ABAC + governed tags, row filters and column masks, lineage, classification, customer-managed keys, network isolation, Delta Sharing, and Lakehouse Federation into a single governance surface — and where the seams still show."
date: 2026-05-13
tags: ["databricks", "unity-catalog", "security", "governance", "data"]
draft: true
---

> Part of the overview: [How Modern Data Platforms Protect Data](/posts/2026/05/13/how-modern-data-platforms-protect-data/).
> Sibling deep-dives:
> [BigQuery](/posts/2026/05/17/bigquery-data-protection/) ·
> [Policy overlay vendors](/posts/2026/05/13/data-policy-overlay-vendors/) ·
> [Governance-as-code with dbt + Terraform](/posts/2026/05/13/data-governance-as-code-dbt-terraform/) ·
> [The third-party auditor's gap list](/posts/2026/05/13/data-platform-auditor-gaps/)

<!-- WRITING PROMPT — opener (1-2 paras):
   - Set up: Unity Catalog (UC) is Databricks' answer to "the lakehouse needs a real catalog".
   - Frame: it's a single metastore per region holding catalogs, schemas, tables, volumes, models, functions, views, shares — and the access policy that wraps all of them.
   - Tone: concrete, with the same opinion-bearing voice as the BigQuery post.
-->

## The request path, end to end

<!-- PROMPT:
   - Numbered: identity (SCIM-synced) → workspace → cluster/SQL warehouse → UC privilege check at metastore → ABAC policy evaluation → row filter / column mask applied → query runs against cloud storage → lineage edge written → audit row in `system.access.audit`.
   - Cite: UC overview [1], metastore topology [2].
-->

## 1. The three-level namespace and metastore topology

<!-- PROMPT:
   - `catalog.schema.object` — the cleanest namespace any cloud DW has shipped.
   - One metastore per region; workspaces attach to a metastore.
   - Why this matters for protection: the metastore is the single source of identity-to-grant mapping. Per-workspace ACLs are the legacy world.
   - Anti-pattern: hybrid hive_metastore + UC catalogs in the same workspace, drifting forever.
   - Cite: [1], [2].
-->

## 2. The grants model

<!-- PROMPT:
   - SQL-style: `GRANT SELECT ON TABLE ... TO group`.
   - Privileges inherit down: catalog → schema → table.
   - Account-level groups vs workspace groups — why account groups win for governance.
   - Cite: UC overview [1].
-->

## 3. ABAC and governed tags

<!-- PROMPT:
   - The newer model: define a policy that says "if column has tag X, mask it for groups not in Y".
   - Governed tags = tags Databricks treats as policy inputs (curated taxonomy).
   - Why this beats hand-grants on every table: classification-driven, scales with table count.
   - Status callout: ABAC + governed tags moved into GA recently — verify at publish time.
   - Cite: ABAC [3], ABAC GA blog [16].
-->

## 4. Row filters and column masks

<!-- PROMPT:
   - The "manual" tier: define a SQL or Python UDF, attach to a table.
   - Row filter = predicate function. Column mask = transform function.
   - When to use these vs ABAC: per-table custom logic that doesn't fit the tag model.
   - Compute requirement: SQL warehouse or standard-access cluster (verify at publish).
   - Cite: filters and masks [4].
-->

## 5. Dynamic views

<!-- PROMPT:
   - The classic: views with `current_user()` / `is_account_group_member()` predicates.
   - Still useful for legacy patterns or where ABAC can't reach.
   - Trade-off: views proliferate, classification-driven policies don't.
   - Cite: dynamic views [5].
-->

## 6. Lineage as a governance primitive

<!-- PROMPT:
   - UC captures table + column lineage automatically across SQL, Python, R, Scala.
   - Surfaces in the Catalog Explorer, queryable via `system.access.column_lineage` and `system.access.table_lineage`.
   - The audit value: when a derived table contains PII, you can trace the source columns and check whether the source had a masking policy.
   - Gap: lineage outside UC (Spark structured streaming → external sink, Lakeflow connectors) still has blind spots.
   - Cite: lineage [6].
-->

## 7. The classification agent and tag taxonomy

<!-- PROMPT:
   - Databricks' answer to "where do tags come from".
   - Auto-discovery scan → suggested tags → steward approval → tag becomes ABAC input.
   - Predefined system tags map to PCI / HIPAA / GDPR identifier categories.
   - Status callout: verify GA/preview state at publish time.
   - Cite: data classification [7], classification tags [8].
-->

## 8. Customer-managed keys

<!-- PROMPT:
   - Two distinct keys, often confused:
     1. Managed services key (notebooks, query history, secrets).
     2. Workspace storage key (DBFS root, EBS volumes, S3 bucket for managed tables).
   - Enterprise tier requirement; rotation requires service downtime (mention).
   - Serverless storage exception — verify current state.
   - Cite: CMK [9].
-->

## 9. Network isolation

<!-- PROMPT:
   - Three layers:
     1. Workspace IP allowlist (web + API ingress).
     2. PrivateLink for control plane and serverless compute.
     3. Egress firewall / private endpoints for serverless workloads.
   - Why "serverless" makes this harder: the egress story changed substantially across releases.
   - Cite: serverless network [10], IP access list [11].
-->

## 10. Audit logs as a system table

<!-- PROMPT:
   - `system.access.audit` is the central evidence table — UC events, workspace events, identity events.
   - Status callout: schema and coverage have moved across previews — verify at publish.
   - Operational pattern: schedule a daily extract to immutable storage in a separate account.
   - Cite: audit logs [12].
-->

## 11. Delta Sharing security model

<!-- PROMPT:
   - Two flavors: D2D (Databricks-to-Databricks, OIDC + UC-managed recipients) and open Delta Sharing (bearer token).
   - The auditor question: who issued the token, when, expiry, IP scope.
   - Masking carries through: shared tables can wear column masks and row filters.
   - Cite: Delta Sharing [13].
-->

## 12. Lakehouse Federation governance hooks

<!-- PROMPT:
   - Foreign catalogs (Snowflake, BigQuery, Postgres, Redshift) registered as UC catalogs.
   - UC privileges layer over the foreign object — but native auth still happens at the source.
   - The compliance gap: column lineage stops at the federation boundary unless the source emits it.
   - Cite: catalog federation [14].
-->

## What Unity Catalog does well

<!-- PROMPT — opinionated bullets:
   - The cleanest namespace + grants model in the lakehouse world.
   - ABAC + governed tags are a real classification-driven access engine, not a wrapper.
   - Lineage is automatic and queryable as a system table.
   - Audit lives in SQL — no log-pipe wiring required.
-->

## What Unity Catalog leaves to you

<!-- PROMPT — opinionated bullets:
   - Mixed hive_metastore + UC environments are still common and drift.
   - Lineage outside UC-managed compute paths is uneven.
   - Serverless egress controls have moved a lot — pin your version's behavior.
   - Cross-region governance: each metastore is regional; multi-region compliance needs a federation pattern.
-->

---

## Sources

1. Unity Catalog overview — <https://docs.databricks.com/en/data-governance/unity-catalog/index.html>
2. Create a Unity Catalog metastore — <https://docs.databricks.com/aws/en/data-governance/unity-catalog/create-metastore>
3. ABAC via governed tags and policies — <https://docs.databricks.com/en/data-governance/unity-catalog/abac/>
4. Row filters and column masks — <https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks>
5. Dynamic views — <https://docs.databricks.com/aws/en/views/dynamic>
6. Unity Catalog lineage — <https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage>
7. Data classification agent — <https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification>
8. Classification / system tags taxonomy — <https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification-tags>
9. Customer-managed keys — <https://docs.databricks.com/aws/en/security/keys/configure-customer-managed-keys>
10. Serverless network security — <https://docs.databricks.com/en/security/network/serverless-network-security/index.html>
11. IP access list — <https://docs.databricks.com/security/network/ip-access-list.html>
12. Audit logs system table (`system.access.audit`) — <https://docs.databricks.com/aws/en/admin/system-tables/audit-logs>
13. Delta Sharing — <https://docs.databricks.com/aws/en/delta-sharing/>
14. Lakehouse Federation — <https://docs.databricks.com/aws/en/query-federation/catalog-federation>
15. Compliance portfolio (HIPAA, FedRAMP, PCI) — <https://docs.databricks.com/en/security/privacy/index.html>
16. ABAC + classification GA blog — <https://www.databricks.com/blog/abac-row-filtering-and-column-masking-policies-governed-tags-and-data-classification-are-now>
17. DAIS 2025 Unity Catalog roundup — <https://www.databricks.com/blog/whats-new-databricks-unity-catalog-data-ai-summit-2025>
18. DAIS 2024 Unity Catalog roundup — <https://www.databricks.com/blog/whats-new-databricks-unity-catalog-data-ai-summit-2024>
19. Lakehouse Federation announcement — <https://www.databricks.com/blog/introducing-lakehouse-federation-capabilities-unity-catalog>
20. Completing the lakehouse vision (open governance) — <https://www.databricks.com/blog/completing-lakehouse-vision-open-storage-open-access-unified-governance>
21. CIDR 2021 lakehouse paper (Zaharia et al.) — <https://www.databricks.com/wp-content/uploads/2020/12/cidr_lakehouse.pdf>

<!-- VERIFY-AT-PUBLISH:
   - ABAC + governed tags GA status (sections 3, 7).
   - `system.access.audit` schema (section 10) — has been in preview.
   - Serverless egress + storage CMK behavior (sections 8, 9) — moves often.
-->

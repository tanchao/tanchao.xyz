---
title: "Data Protection in Databricks Unity Catalog: A Field Guide"
description: "How Unity Catalog stitches together the three-level namespace, ABAC + governed tags, row filters and column masks, lineage, classification, customer-managed keys, network isolation, Delta Sharing, and Lakehouse Federation into a single governance surface — and where the seams still show."
tldr: "Unity Catalog centralizes lakehouse governance in one regional metastore: grants, ABAC policies driven by governed tags, automatic lineage, and an audit trail you query in SQL. The strong parts are the namespace, tag-driven access, and audit-as-SQL; the seams show at legacy hive_metastore, non-UC compute paths, serverless network controls, and multi-region."
date: 2026-05-24
tags: ["databricks", "unity-catalog", "security", "governance", "data"]
draft: false
faq:
  - q: "Are ABAC policies and governed tags generally available in Unity Catalog?"
    a: "Yes. Databricks moved ABAC row filter and column mask policies, governed tags, and automated data classification to General Availability in May 2026. Enforcement requires Databricks Runtime 16.4 or above, or serverless compute."
  - q: "What is the difference between ABAC policies and dynamic views in Unity Catalog?"
    a: "ABAC policies are tag-driven: one policy attached at a catalog or schema protects every table carrying the targeted governed tag, so coverage scales with classification. Dynamic views encode access logic per view with current_user() predicates, so views proliferate and cannot be centrally audited. ABAC is the default; dynamic views remain useful for logic that does not fit the tag model."
  - q: "Is the system.access.audit system table generally available?"
    a: "No. As of 2026 the audit log system table at system.access.audit is in Public Preview. It carries a 365-day free retention window, supports streaming, and holds workspace-level events regionally and account-level events globally. Treat schema and coverage as subject to change and pin your version's behavior."
  - q: "Do Delta Sharing shares preserve row filters and column masks?"
    a: "Yes. Tables shared through Unity-Catalog-managed Delta Sharing carry their row filters and column masks through to the recipient. The auditor questions are who issued the recipient token, when it expires, and from which IP ranges it can be redeemed."
  - q: "Where does Unity Catalog lineage stop?"
    a: "Lineage is captured automatically for SQL, Python, R, and Scala on Unity-Catalog-governed compute. It thins or disappears outside that boundary: structured-streaming writes to external sinks, some connectors, and foreign tables reached through Lakehouse Federation, where column lineage stops at the federation boundary unless the source emits it."
---

> Part of the overview: [How Modern Data Platforms Protect Data](/posts/2026/05/13/how-modern-data-platforms-protect-data/).
> Sibling deep-dives:
> [BigQuery](/posts/2026/05/17/bigquery-data-protection/) ·
> [Policy overlay vendors](/posts/2026/05/31/data-policy-overlay-vendors/) ·
> [Governance-as-code with dbt + Terraform](/posts/2026/06/07/data-governance-as-code-dbt-terraform/) ·
> [The third-party auditor's gap list](/posts/2026/06/14/data-platform-auditor-gaps/)

Unity Catalog is Databricks' governance layer for the lakehouse: a single [metastore per region](https://docs.databricks.com/aws/en/data-governance/unity-catalog/create-metastore) that holds catalogs, schemas, tables, volumes, models, functions, views, and shares — plus the access policy that wraps all of them. Everything that protects a query lives here or answers to it. Per-workspace access control lists are the legacy world; the metastore is now the source of truth for who can read what.

This post walks the request path from identity to audit row, then covers each control surface in the same order an auditor would probe it. The question at every step is the one from the [overview](/posts/2026/05/13/how-modern-data-platforms-protect-data/): when the query runs, what control fires, and how do you prove it?

## The request path, end to end

Every Unity Catalog access decision fires somewhere between identity resolution and the audit row. If a mechanism is not on this path, it is not protecting the query at runtime — it is supporting infrastructure. When a user runs `SELECT * FROM catalog.schema.table`, this is what happens:

1. **Identity resolves.** A [SCIM-provisioned](https://docs.databricks.com/aws/en/admin/users-groups/scim/) user or service principal authenticates through the account's IdP. Account-level groups, not workspace-local groups, carry the grants that matter.
2. **Workspace and compute check.** The request lands on a workspace attached to the region's metastore, on a SQL warehouse or a cluster in an access mode that supports Unity Catalog.
3. **Privilege check at the metastore.** Unity Catalog evaluates whether the principal holds the required privilege (`SELECT`, `USE CATALOG`, `USE SCHEMA`) on the object, with privileges inheriting down the three-level namespace.
4. **ABAC policy evaluation.** If the object carries governed tags targeted by a row filter or column mask policy, the engine applies the policy's UDF before results assemble.
5. **Query runs against cloud storage.** The engine reads Delta or Parquet files from S3, ADLS, or GCS, encrypted with the workspace's keys.
6. **Lineage edge is written.** The read is recorded in the lineage graph, queryable through `system.access.table_lineage` and `system.access.column_lineage`.
7. **Audit row lands.** An event is written to `system.access.audit` recording who ran what, when, and from where.

If a control is not on this path — customer-managed keys, network policies, classification scans — it is supporting evidence that makes the controls on the path trustworthy, not a runtime gate on the query itself.

## 1. The three-level namespace and metastore topology

Unity Catalog's namespace is `catalog.schema.object` — the cleanest three-level model any lakehouse has shipped, and the reason grants compose cleanly. One [metastore per region](https://docs.databricks.com/aws/en/data-governance/unity-catalog/create-metastore) holds the catalogs; workspaces attach to a metastore. Because the metastore is the single mapping from identity to grant, governance stops being a per-workspace chore and becomes an account-level property.

**Why this matters for protection.** When identity-to-grant lives in one place, "who can read this table?" has one answer, not one per workspace. The legacy alternative — per-workspace ACLs on the Hive metastore — produced as many answers as you had workspaces, and no way to reconcile them.

**Anti-pattern: the hybrid metastore.** The most common drift source is a workspace running `hive_metastore` catalogs alongside Unity Catalog catalogs. Objects in `hive_metastore` are outside UC governance entirely — no ABAC, no lineage, no unified audit. Migration is the only fix; a permanent hybrid state means a permanent blind spot (see the [Unity Catalog overview](https://docs.databricks.com/en/data-governance/unity-catalog/index.html)).

## 2. The grants model

Grants are SQL-style and inherit down the namespace: `GRANT SELECT ON SCHEMA catalog.schema TO group` covers every current and future table in that schema. The privilege hierarchy runs catalog → schema → table, so the natural unit to grant on is the schema, not the individual table. Granting table by table is the same folklore trap it is everywhere else — it works until the next table lands untagged and ungranted.

**Account groups win.** Unity Catalog supports both account-level groups and legacy workspace-local groups. Governance should key off account groups, synced from your IdP through SCIM, because they are consistent across every workspace attached to the metastore. Workspace-local groups reintroduce the per-workspace divergence Unity Catalog exists to remove.

**Ownership is a privilege too.** Every securable has an owner (a user or, better, a group) who can grant on it and alter it. Owning objects with individual accounts is a departure risk; own them with groups so the grant survives the person (see the [Unity Catalog overview](https://docs.databricks.com/en/data-governance/unity-catalog/index.html)).

## 3. ABAC and governed tags

Attribute-based access control (ABAC) is Unity Catalog's classification-driven access engine, and as of **May 2026 it is generally available** along with governed tags and automated data classification (see the [ABAC GA announcement](https://www.databricks.com/blog/abac-row-filtering-and-column-masking-policies-governed-tags-and-data-classification-are-now)). Instead of attaching logic to every table, you write one policy — "mask any column tagged `pii.email` for anyone outside the `pii_readers` group" — attached at a catalog or schema, and it protects every matching object automatically.

**Governed tags are the vocabulary.** A [governed tag](https://docs.databricks.com/en/data-governance/unity-catalog/abac/) is an account-level tag with a controlled set of allowed values and permissions governing who may apply it — which is exactly what makes it safe to drive access control off. An account can hold up to 1,000 governed tags with up to 50 allowed values each, and tags applied at a catalog or schema inherit down to child objects. You manage them through SQL (`CREATE GOVERNED TAG`), the Catalog Explorer UI, the REST API, or Terraform.

**Why this beats hand-grants.** With per-table grants, coverage is a function of what someone remembered to configure. With ABAC, coverage is a function of classification: tag the column and the policy fires. At GA the limits grew roughly tenfold — on the order of 10,000+ policies per metastore and 100+ per catalog or schema — so the model scales to a real enterprise estate. ABAC policies also evaluate against the session identity of whoever queries through a view or function, closing an old gap where views could leak rows the underlying policy would have filtered (see the [ABAC policy reference](https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies)). Enforcement requires Databricks Runtime 16.4 or above, or serverless compute.

## 4. Row filters and column masks

Row filters and column masks are the manual tier that ABAC automates — and they are still the right tool when the logic is genuinely per-table. A [row filter](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks) is a UDF returning a boolean predicate that decides which rows a principal sees; a column mask is a UDF that transforms a column's value on the way out. You attach the function to the table, and the engine applies it at query time.

**When to reach for these instead of ABAC.** ABAC shines when access follows a classification tag. Direct row filters and column masks shine when the logic is bespoke — a masking rule that depends on a lookup table, a row predicate that joins against an entitlements table. Under the hood ABAC compiles down to the same filter-and-mask machinery; the difference is whether the binding is tag-driven or hand-attached.

**Compute requirement.** Like ABAC, filters and masks require a SQL warehouse or a cluster in an access mode that supports Unity Catalog enforcement. Attaching a mask does not protect a table read from a legacy no-isolation cluster — verify the access mode, not just the policy (see [row filters and column masks](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks)).

## 5. Dynamic views

Dynamic views are the pre-ABAC pattern: a view whose `SELECT` embeds `current_user()` or `is_account_group_member()` predicates to filter rows and columns per caller. They still work, and they are still the fallback for logic ABAC cannot express or for objects you cannot tag. But they carry a cost the tag model does not.

**The trade-off.** Every table needing protection needs its own view, and every view encodes its own copy of the access logic. There is no central place to ask "which predicates apply to `pii.email` across the estate?" — the answer is spread across N view definitions. Dynamic views are fine for a handful of legacy tables; they do not scale as a governance strategy, which is precisely the gap ABAC and governed tags were built to close (see [dynamic views](https://docs.databricks.com/aws/en/views/dynamic)).

## 6. Lineage as a governance primitive

Unity Catalog captures table-level and column-level [lineage](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage) automatically across SQL, Python, R, and Scala, with no instrumentation on your part. It surfaces in Catalog Explorer and, more usefully for evidence, in the `system.access.table_lineage` and `system.access.column_lineage` system tables you can query directly.

**The audit value.** Lineage is what turns "this derived table contains emails" into "these emails came from `raw.customers.email`, which carries a masking policy." Without column lineage, you cannot prove that a source policy carried through to a downstream table, and an auditor will write that up as a privacy-by-design gap.

**The gap.** Lineage capture is only automatic on Unity-Catalog-governed compute. Structured-streaming writes to external sinks, some Lakeflow connectors, and anything running outside UC-governed paths can produce derived data with no lineage edge. Treat lineage coverage as a metric to monitor, not a guarantee — a table with no inbound lineage is either a true source or a blind spot, and you need to know which (see [Unity Catalog lineage](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)).

## 7. Data classification and the tag taxonomy

Governed tags are only as good as the process that applies them, which is where Unity Catalog's [automated data classification](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification) comes in — also **GA as of May 2026**. An agent scans columns, proposes classification tags, and (with steward approval) applies them, so the tags that drive ABAC stay current as schemas evolve instead of decaying from the moment someone stops hand-tagging.

**The supported taxonomy maps to regulation.** Databricks ships classification coverage aligned to common frameworks and data categories — PII, GDPR, HIPAA, GLBA, and DPDPA among them — so a steward can build broad protection without inventing a taxonomy from scratch. Custom classifiers cover business-specific patterns the built-ins miss (see the [classification tags reference](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification-tags)).

**The pattern that holds.** Scan detects → agent proposes → steward approves → tag becomes an ABAC input → policy fires on the next query. The human stays in the loop on the approval step, but the detection and the enforcement are automated. That is the loop that survives an audit; manual tagging at table-creation time is the one that drifts.

## 8. Customer-managed keys

Data at rest is encrypted by default, but Enterprise-tier workspaces can supply [customer-managed keys](https://docs.databricks.com/aws/en/security/keys/configure-customer-managed-keys) (CMK) for tighter custody. There are two distinct keys here, and conflating them is a common source of confusion in an audit conversation.

1. **Managed services key.** Encrypts control-plane data: notebook source, command results, query history, secrets, and Databricks SQL query history.
2. **Workspace storage key.** Encrypts the workspace's cloud storage: the DBFS root, managed-table storage, and cluster EBS volumes.

**Operational caveats.** CMK is an Enterprise-tier feature, and key rotation historically requires care — plan for it, and treat the KMS side as a first-class audit surface, because "we have CMK" means nothing to an auditor if you cannot produce the key policy and rotation log. For serverless workloads, customer-managed keys cover the managed-services surface (workspace storage, root storage, and internal metadata); confirm the exact coverage for your deployment because serverless behavior has moved across releases (see [configure customer-managed keys](https://docs.databricks.com/aws/en/security/keys/configure-customer-managed-keys)).

## 9. Network isolation

Network controls layer in three tiers, and the serverless story is where teams most often get the current behavior wrong. The ingress side — an [IP access list](https://docs.databricks.com/security/network/ip-access-list.html) on the workspace web and API endpoints, plus PrivateLink for the control plane — has been stable for years. The egress side changed substantially with serverless.

**Serverless egress control.** [Network policies](https://docs.databricks.com/aws/en/security/network/serverless-network-security/network-policies) now let account admins put a deny-by-default perimeter around serverless workloads — model serving, notebooks, workflows, DLT, and SQL warehouses. A policy in **Restricted Access** mode allows outbound connections only to Unity Catalog external locations and explicitly listed FQDNs and storage buckets; everything else is denied. It supports a **dry-run mode** that logs would-be violations without blocking, which is the only sane way to roll it out — run dry-run for weeks, reconcile the violations against reality, then enforce. Egress control is Enterprise tier on AWS and GCP, Premium tier on Azure, and manageable through the `databricks_account_network_policy` Terraform resource.

**Pin your version's behavior.** Because serverless networking has evolved release to release, the single most useful thing you can do for an audit is document the exact network policy in effect, in which mode, on which date. "Serverless is locked down" is not a control statement; a policy ID with an enforcement date is (see [serverless egress control](https://docs.databricks.com/aws/en/security/network/serverless-network-security/network-policies)).

## 10. Audit logs as a system table

The evidence layer is `system.access.audit`, a system table that records Unity Catalog events, workspace events, and identity events — and, crucially, lets you answer audit questions in plain SQL instead of wiring up a log pipeline. It captures grant changes, tag assignments, ABAC policy CRUD, and data access, each row carrying the actor, action, request parameters, response status, and source IP.

**Mind the preview status.** As of 2026 the audit log system table is in [Public Preview](https://docs.databricks.com/aws/en/admin/system-tables/audit-logs). It carries a 365-day free retention window, supports streaming, and holds workspace-level events regionally with account-level events surfaced globally. Because the schema and coverage have moved across previews, pin the version you rely on and re-check it at each audit.

**The operational pattern.** Preview status and a 365-day window are not an evidence-retention strategy on their own. Schedule a daily extract of `system.access.audit` into immutable storage in a separate, locked-down account, so a compromised admin in the production workspace cannot alter or delete the trail. That is the same tamper-resistance discipline the [BigQuery post](/posts/2026/05/17/bigquery-data-protection/) applies to Cloud Audit Logs (see the [audit log system table reference](https://docs.databricks.com/aws/en/admin/system-tables/audit-logs)).

## 11. Delta Sharing security model

[Delta Sharing](https://docs.databricks.com/aws/en/delta-sharing/) is Unity Catalog's outbound sharing surface, and it comes in two flavors with different security postures. Databricks-to-Databricks (D2D) sharing uses OIDC identity federation and recipients managed inside Unity Catalog. Open Delta Sharing hands a bearer token to a non-Databricks recipient. The auditor's interest is the same either way: who issued the token, when it expires, and from which IP ranges it can be used.

**Masking carries through.** A shared table keeps its row filters and column masks — the recipient sees the governed view, not the raw table. That is a genuinely strong property: sharing does not silently drop your access controls. The gap is administrative, not technical: every recipient and token needs a record tying it to a data-processing agreement, and every share should carry an expiry by default rather than living forever (see [Delta Sharing](https://docs.databricks.com/aws/en/delta-sharing/)).

## 12. Lakehouse Federation governance hooks

[Lakehouse Federation](https://docs.databricks.com/aws/en/query-federation/catalog-federation) registers foreign systems — Snowflake, BigQuery, PostgreSQL, Redshift, and others — as Unity Catalog catalogs, so you can grant and query them through the same namespace and privilege model as native tables. Unity Catalog privileges layer over the foreign object, giving you one grant surface across a heterogeneous estate.

**Where the seam shows.** Native authentication still happens at the source, and column lineage stops at the federation boundary unless the source system emits it. So a foreign table can be governed by Unity Catalog grants while its internal access decisions and lineage remain the source platform's responsibility. For compliance, federation is a convenience layer over the foreign system, not a replacement for governing that system — document both sides of the boundary (see [Lakehouse Federation](https://docs.databricks.com/aws/en/query-federation/catalog-federation)).

## What Unity Catalog does well

- **The cleanest namespace and grants model in the lakehouse.** `catalog.schema.object` with downward-inheriting privileges, anchored to one regional metastore and account-level groups.
- **ABAC and governed tags are a real classification-driven access engine** — GA since May 2026, scaling to thousands of policies, not a thin wrapper over per-table grants.
- **Lineage is automatic and queryable as a system table**, so proving that a source policy carried downstream is a SQL query, not a manual trace.
- **Audit lives in SQL.** `system.access.audit` means the auditor's "who read this on that date?" is answerable without standing up a separate log pipeline.
- **Masking carries through Delta Sharing**, so sharing a table does not quietly strip its protections.

## What Unity Catalog leaves to you

- **Legacy `hive_metastore` coexistence.** Mixed environments are common and drift permanently. Objects outside UC get no ABAC, no lineage, no unified audit. Migration is the only real fix.
- **Lineage outside UC-governed compute.** Structured-streaming external sinks, some connectors, and federated sources produce derived data with uneven or absent lineage.
- **Serverless network controls move.** Egress policy behavior has changed across releases; pin the exact policy, mode, and enforcement date for your audit.
- **Cross-region governance.** Each metastore is regional. Multi-region compliance needs a deliberate federation pattern, not an assumption that one metastore covers the estate.
- **Preview surfaces.** `system.access.audit` is still Public Preview; build the daily extract to immutable storage rather than treating the 365-day window as your retention policy.

---

## Sources

All sources are linked inline throughout the post. Consolidated here for reference:

- [Unity Catalog overview](https://docs.databricks.com/en/data-governance/unity-catalog/index.html)
- [Create a Unity Catalog metastore](https://docs.databricks.com/aws/en/data-governance/unity-catalog/create-metastore)
- [SCIM provisioning](https://docs.databricks.com/aws/en/admin/users-groups/scim/)
- [Attribute-based access control (ABAC) in Unity Catalog](https://docs.databricks.com/en/data-governance/unity-catalog/abac/)
- [Create and manage row filter and column mask policies (ABAC)](https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies)
- [ABAC, governed tags, and data classification are now GA (blog)](https://www.databricks.com/blog/abac-row-filtering-and-column-masking-policies-governed-tags-and-data-classification-are-now)
- [Row filters and column masks](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks)
- [Dynamic views](https://docs.databricks.com/aws/en/views/dynamic)
- [Unity Catalog lineage](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)
- [Automated data classification](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification)
- [Classification / system tags taxonomy](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification-tags)
- [Configure customer-managed keys](https://docs.databricks.com/aws/en/security/keys/configure-customer-managed-keys)
- [Serverless egress control (network policies)](https://docs.databricks.com/aws/en/security/network/serverless-network-security/network-policies)
- [IP access list](https://docs.databricks.com/security/network/ip-access-list.html)
- [Audit log system table (`system.access.audit`)](https://docs.databricks.com/aws/en/admin/system-tables/audit-logs)
- [Delta Sharing](https://docs.databricks.com/aws/en/delta-sharing/)
- [Lakehouse Federation](https://docs.databricks.com/aws/en/query-federation/catalog-federation)

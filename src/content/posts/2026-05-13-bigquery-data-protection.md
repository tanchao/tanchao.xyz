---
title: "Data Protection in BigQuery: A Field Guide"
description: "How BigQuery layers IAM, policy tags, dynamic masking, RLS, authorized views, VPC Service Controls, CMEK/EKM, and the Knowledge Catalog into a defensible data protection posture — and what it leaves to you."
tldr: "BigQuery's data protection model lives in IAM, policy tags, and the query engine — not cluster configs. This post walks each control surface from identity to audit log and identifies where the platform's evidence trail has gaps."
date: 2026-05-13
tags: ["bigquery", "gcp", "security", "governance", "data"]
draft: true
faq:
  - q: "Are BigQuery Data Access audit logs enabled by default?"
    a: "Yes, unlike most GCP services. BigQuery enables DATA_READ and DATA_WRITE audit logs by default. However, ADMIN_READ (metadata operations like listing datasets) is still off by default and must be enabled separately."
  - q: "Do BigQuery row access policies benefit from partition pruning?"
    a: "No. Row access policies are evaluated as predicates at query time but do not participate in partition pruning or clustering optimizations. Design policies with scan cost in mind on large tables."
  - q: "What is the difference between column-level security and dynamic masking in BigQuery?"
    a: "Both attach to policy tags. Column-level security blocks access entirely if the principal lacks Fine-Grained Reader. Dynamic masking returns a substituted value if the principal holds Masked Reader. The role hierarchy determines which applies."
  - q: "Do you need Knowledge Catalog to use BigQuery policy tags?"
    a: "No. Policy tags for column-level security and masking are managed through the BigQuery and Data Catalog APIs. Knowledge Catalog provides broader metadata, lineage, and discovery capabilities but is not required for access control."
  - q: "What does BigQuery's audit log NOT record about access controls?"
    a: "The audit log records that row access policies and policy-tag checks were evaluated, but omits the actual filter expressions, grantee lists, and direct links between policy-tag checks and the triggering query columns."
---

> Part of the overview: [How Modern Data Platforms Protect Data](/posts/2026/05/13/how-modern-data-platforms-protect-data/).
> Sibling deep-dives:
> [Databricks Unity Catalog](/posts/2026/05/13/databricks-unity-catalog-data-protection/) ·
> [Policy overlay vendors](/posts/2026/05/13/data-policy-overlay-vendors/) ·
> [Governance-as-code with dbt + Terraform](/posts/2026/05/13/data-governance-as-code-dbt-terraform/) ·
> [The third-party auditor's gap list](/posts/2026/05/13/data-platform-auditor-gaps/)

BigQuery is a serverless data warehouse. There are no clusters to configure, no storage nodes to harden, no OS patches to schedule. Your entire protection model lives in three places: IAM, the catalog (policy tags and taxonomy), and the query engine (row filters, column masks, authorized views). Everything else — VPC Service Controls, KMS, audit logs — layers on top of those three.

This post walks the request path from identity to audit log, then covers each control surface in detail. The question at every step is the same one from the [overview](/posts/2026/05/13/how-modern-data-platforms-protect-data/): how do you prove the control fired?

## The request path, end to end

Every BigQuery access control fires somewhere on the request path between identity resolution and audit emission. Understanding this path is the prerequisite for evaluating any individual control — if a mechanism is not on this path, it does not protect the query at runtime. When a user issues `SELECT * FROM project.dataset.table`, this is what fires:

1. **Identity resolves.** Google Workspace or a federated IdP (Okta, Azure AD, etc.) issues an OAuth token. The principal is a user, group, or service account.
2. **IAM check at project → dataset → table.** The Resource Manager evaluates whether the principal holds a role with `bigquery.tables.getData` (or equivalent) at the right level. Denied? Query fails with a 403 before touching data.
3. **Row access policy applies.** If the table has row access policies, the engine injects a predicate filter. Rows the principal is not entitled to never enter the query plan.
4. **Column policy tag check + masking.** If any selected column carries a policy tag, the engine checks the principal's Fine-Grained Reader role on that tag. If missing, either the query fails (column-level security) or a masking rule rewrites the value (dynamic masking).
5. **Results return.** The masked, filtered result set is delivered to the client.
6. **Cloud Audit Log written.** An entry lands in the Data Access log (if enabled) recording who queried what, when, from which IP, and the job metadata.

If a control is not on this path, it does not protect the query. VPC Service Controls protect the *perimeter* (step 0, before the query reaches the service). KMS protects data *at rest* (below step 3). But the access decision itself lives in steps 2–4 (see [BigQuery access controls](https://cloud.google.com/bigquery/docs/access-control-intro) and [data governance overview](https://cloud.google.com/bigquery/docs/data-governance)).

## 1. IAM hierarchy and least privilege

BigQuery IAM is the coarse access control layer that determines whether a principal can reach an object at all. It operates at five levels of granularity — organization, folder, project, dataset, and table/view/routine — with permissions inheriting downward. Most governance failures start here, with over-broad grants at the project level that make fine-grained controls downstream irrelevant.

**The natural unit is the dataset.** Most teams over-grant at the project level (`roles/bigquery.dataViewer` on the project gives read access to every dataset in it). The first governance win is moving grants down to dataset level and using IAM Conditions to scope time-bound or attribute-based access.

**Predefined vs custom roles.** The predefined roles (`dataViewer`, `dataEditor`, `dataOwner`, `jobUser`, `admin`) are coarse. In practice, you need custom roles to separate "can query" from "can export" from "can copy to another project." The `bigquery.tables.export` permission is the one most teams forget to restrict.

**Service account sprawl.** Scheduled queries, Dataform, Dataflow pipelines, Cloud Composer DAGs, and Vertex AI training jobs all use service accounts. Each one holds IAM bindings that accumulate over time. The audit question: can you list every service account with data access, and for each, show the last time it actually used that access?

**IAM Conditions.** Conditions let you scope grants by time, resource name, or request attribute. Example: grant `dataViewer` only on datasets whose name starts with `analytics_` and only during business hours. Conditions are the closest BigQuery gets to ABAC without policy tags (see [IAM resource-level access](https://cloud.google.com/bigquery/docs/control-access-to-resources-iam)).

## 2. Policy tags: BigQuery's classification primitive

Policy tags are the most important governance primitive BigQuery offers. They live in a Data Catalog taxonomy (a tree of labels you define) and bind to individual columns. Once bound, a policy tag does two things:

1. **Column-level security (CLS):** The column becomes invisible to any principal who lacks the `Fine-Grained Reader` role on that tag. Queries that reference the column fail outright.
2. **Dynamic data masking:** Instead of blocking access, a masking rule rewrites the column value based on the reader's group membership.

**The taxonomy is the real governance work.** Designing the tag hierarchy — `PII > email`, `PII > SSN`, `Financial > revenue`, `Internal > draft` — determines what policies you can express. A flat taxonomy forces one-off grants. A well-structured tree lets you grant at an interior node and cover all children.

**Anti-pattern: tagging at table creation time.** If policy tags are applied manually when someone creates a table, they drift the moment a new column is added or a pipeline recreates the table. Tags should originate from a classification scan (Sensitive Data Protection) or from CI (Terraform applying tags on every deploy). Manual tagging is folklore — you cannot prove it is current (see [column-level security intro](https://cloud.google.com/bigquery/docs/column-level-security-intro) and [implementation guide](https://cloud.google.com/bigquery/docs/column-level-security)).

## 3. Dynamic data masking

Dynamic data masking attaches a masking rule to a policy tag. When a principal queries a tagged column and does not hold the unmasked reader role, the engine substitutes a masked value instead of blocking the query.

**Built-in masking routines:**

- `NULL` — replaces with null
- Default value — replaces with a type-appropriate zero/empty string
- SHA-256 hash — deterministic pseudonymization (same input always produces same hash)
- Last four characters — useful for partial card numbers or SSNs
- Email mask — preserves domain, masks local part
- Date: year only — truncates to year

**Custom masking via authorized routines.** When built-in routines are not enough, you write a UDF and register it as the masking routine for a policy tag. The UDF runs with the elevated privileges of its owning dataset (an authorized routine), so it can apply business logic the caller cannot see or bypass.

**The composition model.** A single column can wear one policy tag. That tag can enforce either CLS (block) or masking (rewrite), but the outcome for a specific principal depends on which roles they hold and where those roles are granted in the policy-tag hierarchy:

- **Fine-Grained Reader on the tag (or a parent tag):** The principal sees the raw value.
- **Masked Reader on the tag (or a parent tag):** The principal sees the masked value.
- **Neither:** The query fails.

The edge case that bites real orgs: if a principal holds Fine-Grained Reader on a *parent* tag and Masked Reader on a *child* tag, the more permissive grant wins and they see raw data. Role resolution follows the tag hierarchy, not the column. Design your taxonomy and role bindings together — granting Fine-Grained Reader at the top of the tree to "admins" means no masking applies to them anywhere in the tree, even if Masked Reader is granted more narrowly (see [dynamic data masking](https://cloud.google.com/bigquery/docs/column-data-masking-intro)).

## 4. Row-level security

Row-level security (RLS) in BigQuery controls which rows a principal can see within a table by attaching SQL predicates with grantee lists. Row access policies are evaluated at query time as planner-level filters — rows that do not satisfy the policy for the calling principal are excluded before results are assembled, making RLS invisible to the caller except through the absence of rows they cannot access.

```sql
CREATE ROW ACCESS POLICY region_filter
ON project.dataset.customers
GRANT TO ("group:emea-analysts@example.com")
FILTER USING (region = 'EMEA');
```

**Composition with CLS.** A principal can be simultaneously filtered by row policies and masked on columns. The two mechanisms are orthogonal — row policies decide *which* rows, column policies decide *what* they see in those rows.

**Performance.** Row access policies are evaluated at query time as injected predicates. BigQuery handles the filtering, but do not assume the predicate participates in partition pruning or clustering benefits — it does not. A row policy on a partitioned table still requires the engine to evaluate the predicate against scanned rows within the accessed partitions. For large tables, design your row policies with this in mind: a policy that references a non-clustered column on a multi-terabyte table will scan more data than you might expect from the IAM-only path.

**Anti-pattern: RLS via authorized views.** Before row access policies existed (GA 2022), teams built authorized views with `SESSION_USER()` predicates. These still work but carry maintenance overhead — every new table needs a new view, and you cannot centrally audit which predicates apply where. Row policies are the right tool unless your access logic requires complex joins or business logic that only a view can express (see [row-level security intro](https://cloud.google.com/bigquery/docs/row-level-security-intro)).

## 5. Authorized views, datasets, and routines

The authorized pattern is BigQuery's "share a query, not a table" primitive. An authorized view runs with the permissions of its *owning* dataset, not the calling user. This means the caller can query the view without having direct access to the underlying tables.

**Authorized datasets** scale this pattern. Instead of authorizing individual views, you authorize an entire dataset. Every view and routine in that dataset inherits the elevation. This is the pattern for exposing a governed analytics layer: raw data in one dataset (locked down), curated views in another (broadly accessible).

**Authorized routines** extend the same trust model to table functions, UDFs, and stored procedures. A UDF in an authorized dataset can read tables the caller cannot — useful for aggregation services, anonymization functions, or metric definitions that should not expose raw inputs.

**When to use authorized patterns vs RLS + CLS:**

- **Authorized views/routines:** When the access logic requires joins, aggregations, or transformations that cannot be expressed as a simple predicate or mask.
- **RLS + CLS:** When the table structure is the correct interface and you just need to restrict which rows or columns a principal sees.

Mixing both is common. A governed analytics dataset might contain authorized views that read from RLS-protected tables with CLS-masked columns (see [authorized views](https://cloud.google.com/bigquery/docs/authorized-views), [authorized datasets](https://cloud.google.com/bigquery/docs/authorized-datasets), [authorized routines](https://cloud.google.com/bigquery/docs/authorized-routines)).

## 6. VPC Service Controls

VPC Service Controls (VPC-SC) are the network-perimeter layer that operates orthogonally to IAM. While IAM answers "does this principal have permission?", VPC-SC answers "is this request coming from an allowed network context?" — and a principal can hold valid credentials yet still be denied if the request originates outside the perimeter. This makes VPC-SC the primary defense against credential theft and data exfiltration.

**The exfiltration scenario VPC-SC stops:** An attacker obtains service account credentials (leaked in a log, stolen from a CI runner). Without VPC-SC, they can use those credentials from any IP to copy tables to their own project. With VPC-SC, the request is denied because it originates outside your perimeter — even though the credentials are valid.

**The perimeter model:**

- **Service perimeter:** A boundary around one or more GCP projects. BigQuery API calls crossing the boundary are denied.
- **Ingress rules:** Allow specific principals from specific sources (IP ranges, other perimeters) to call specific services.
- **Egress rules:** Allow data to leave the perimeter to specific destinations.
- **Access levels:** Context-aware conditions (corporate network, managed device, geo) that gate ingress.

**Operational reality.** VPC-SC is the single most operationally painful control in GCP. The violations are noisy until your access levels match the reality of where your users and service accounts actually operate. Plan for a "dry-run" period — VPC-SC supports a dry-run mode that logs would-be violations without blocking them. Run dry-run for weeks before enforcing (see [VPC-SC for BigQuery](https://cloud.google.com/bigquery/docs/vpc-sc)).

## 7. CMEK, Cloud EKM, and column-level AEAD

BigQuery encrypts all data at rest by default using Google-managed keys, but three opt-in layers give you progressively more key custody — from controlling the key policy, to holding the key material externally, to encrypting individual column values with application-layer AEAD. Each layer adds auditability (via Cloud KMS logs) and a kill-switch capability at the cost of operational complexity and latency.

**1. CMEK (Customer-Managed Encryption Keys).** You create a key in Cloud KMS. BigQuery uses it to encrypt your datasets. Google holds the HSM; you hold the IAM policy that governs who can use the key. You can disable or destroy the key to render data unreadable — a hard kill switch.

**2. Cloud EKM (External Key Manager).** The key material lives in your own external KMS (Fortanix, Thales CipherTrust, Equinix SmartKey, etc.). Google never sees the key plaintext. Every encryption/decryption operation calls out to your KMS. You get a real-time veto: disable the external key and BigQuery cannot read the data, even if Google's infrastructure is compromised.

**3. Column-level AEAD encryption.** Selective encryption of individual column values using `AEAD.ENCRYPT` / `AEAD.DECRYPT` SQL functions with a KMS-managed key. The ciphertext is stored in the column; only callers who hold `cloudkms.cryptoKeyVersions.useToDecrypt` on the referenced key can read the plaintext. This is application-layer encryption inside the warehouse.

**The auditor's question:** Who can use the key? Who can rotate it? What triggers rotation? The answers live in Cloud KMS audit logs — a second evidence trail alongside BigQuery's own audit logs. If you use CMEK or EKM, your compliance story now spans two log sources (see [CMEK for BigQuery](https://cloud.google.com/bigquery/docs/customer-managed-encryption), [encryption at rest](https://cloud.google.com/bigquery/docs/encryption-at-rest), [column AEAD](https://cloud.google.com/bigquery/docs/column-key-encrypt)).

## 8. Sensitive Data Protection (Cloud DLP)

BigQuery does not have a native classification engine — it cannot automatically detect which columns contain PII, financial data, or health records. Sensitive Data Protection (SDP, formerly Cloud DLP) fills this gap as a separate GCP service that inspects, profiles, and de-identifies data. Because policy tags only protect what they cover, SDP is the detection loop that keeps classification current as schemas evolve.

**The workflow:**

1. **Inspection job** scans a table or dataset for sensitive data (infoTypes: `CREDIT_CARD_NUMBER`, `US_SOCIAL_SECURITY_NUMBER`, `EMAIL_ADDRESS`, 150+ built-in detectors).
2. **Profiling** runs on a schedule and produces a sensitivity score per column.
3. **Findings** land in a BigQuery findings table or Security Command Center.
4. **A driver job** (yours to build) reads the findings and applies or updates policy tags in the Data Catalog taxonomy.

**Why this matters for governance.** Policy tags are only as good as their coverage. If a new column with PII appears in a table and nobody tags it, the policy does not fire. SDP is the detection loop that closes this gap — but you have to wire it. The scan → tag pipeline is not built-in; it is your automation to maintain.

**Anti-pattern: relying on manual classification.** If your policy tags are applied by a human at table creation time and never re-scanned, classification drifts. The correct pattern is: SDP scan detects → findings trigger a Cloud Function or Workflows pipeline → pipeline calls the Data Catalog API to apply or update tags → policy fires on next query (see [SDP scanning for BigQuery](https://cloud.google.com/bigquery/docs/scan-with-dlp)).

## 9. The Knowledge Catalog

Google has renamed its catalog surface multiple times — Data Catalog, Dataplex Universal Catalog, and now Knowledge Catalog. The naming is confusing, but the ownership boundary that matters for data protection is straightforward: policy tags (the access control primitive) are BigQuery-native and managed via the Data Catalog API, while Knowledge Catalog is the broader metadata layer for lineage, discovery, and cross-service governance.

**What lives where:**

- **Policy tags for column-level security and masking** are managed through the BigQuery and Data Catalog APIs. This is not deprecated and does not require the Knowledge Catalog. Policy tags are a BigQuery-native primitive that predates the catalog unification effort.
- **Knowledge Catalog** is the broader metadata layer: business glossary, data quality rules, lineage visualization, discovery, and cross-service catalog entries (AlloyDB, Cloud Storage, Vertex AI).

The distinction matters for protection: you do *not* need to adopt Knowledge Catalog to use policy tags, CLS, or masking. You need it if you want centralized lineage, cross-service discovery, or business-glossary-driven governance.

**What Knowledge Catalog holds for protection:**

- Business glossary and semantic definitions
- Table and column lineage captured from BigQuery SQL jobs
- Data quality validation results
- Cross-service catalog entries

**The lineage gap.** Lineage capture is automatic for BigQuery SQL jobs. It is partial or absent for Dataflow, Dataproc, BQML training jobs, and custom pipelines writing to Cloud Storage. If an auditor asks "where did this derived column originate?" and the path crosses a non-SQL engine, the lineage edge may not exist in the catalog (see [Knowledge Catalog with BigQuery](https://cloud.google.com/bigquery/docs/use-knowledge-catalog), [catalog transition guide](https://cloud.google.com/dataplex/docs/transition-to-dataplex-catalog), and [unified governance blog](https://cloud.google.com/blog/products/data-analytics/manage-and-govern-data-with-the-unified-dataplex-and-data-catalog)).

## 10. Cloud Audit Logs: your evidence pack

Cloud Audit Logs are the evidence layer that makes every other control in this post defensible. Without audit logs, you can configure IAM, policy tags, and VPC-SC perfectly and still fail an audit because you cannot prove the controls fired on a specific query at a specific time. BigQuery writes to three log streams, each with different default behavior and cost implications.

- **Admin Activity** (always on, free): WHO created/deleted/modified datasets, tables, and policies.
- **Data Access** (enabled by default for BigQuery, costs apply): WHO queried WHICH tables, with job metadata. Unlike most GCP services where Data Access logs are off by default, BigQuery enables `DATA_READ` and `DATA_WRITE` audit logs automatically. However, the scope and detail vary — `ADMIN_READ` (listing datasets, getting table metadata) is still off by default and must be enabled separately.
- **System Event** (always on, free): system-level operations like BigQuery Storage API reads.

**Verify your configuration.** Because BigQuery's default-on behavior differs from other GCP services, teams often assume full coverage without checking. The specific gap: `ADMIN_READ` logs (who listed which datasets, who called `getTable`) are not enabled by default. If your compliance requirement includes proving who *discovered* what data exists — not just who queried it — you need to enable `ADMIN_READ` explicitly.

**Tamper resistance.** Audit logs should be sunk to a separate project that the production project's principals cannot write to. The pattern: create a logging project, create a log sink in the production project that routes to the logging project, grant `logging.logWriter` only to the sink's service account. Now even a compromised admin in the production project cannot delete the evidence.

**What the log contains — and what it does not.** The audit log entry records: project, dataset, table, job ID, caller identity, caller IP, timestamp, and bytes processed. The `authorizationInfo` field shows which IAM permissions were checked and whether row access policy names were evaluated. However, the log does *not* include: the actual row filter expression that was applied, the grantee list of the policy, or a direct link between policy-tag checks and the triggering query. This means you can prove *that* access controls fired, but reconstructing *exactly what a user saw* requires correlating the audit log with the current policy definitions — the log alone is not a complete evidence pack (see [BigQuery audit logs reference](https://cloud.google.com/bigquery/docs/reference/auditlogs)).

## What BigQuery does well

- **IAM at five levels of granularity** (org, folder, project, dataset, table/view/routine), all in one consistent model with inheritance and conditions.
- **Policy tags as a first-class primitive.** Column-level security and dynamic masking keyed off a shared classification taxonomy is rare among cloud data warehouses.
- **VPC Service Controls** provide a real network-level perimeter — not just a firewall rule, but a context-aware boundary that blocks exfiltration independent of IAM.
- **Mature key custody.** CMEK, EKM, and column AEAD cover the full spectrum from "I control the policy" to "I control the key material" to "I encrypt individual values."
- **Row policies compose with column policies.** The two access control dimensions (which rows, which columns) are orthogonal and enforced at plan time.

## What BigQuery leaves to you

- **Classification automation.** Sensitive Data Protection is a separate service. The scan → detect → tag pipeline is yours to build and maintain. Without it, policy tags drift.
- **Lineage beyond SQL.** Lineage is automatic for BigQuery SQL jobs but partial or absent for Dataflow, Dataproc, BQML, and custom pipelines. If your derived tables cross these boundaries, you have blind spots.
- **Policy-as-code composition.** Terraform providers for BigQuery and Data Catalog exist, but composing them with dbt (which owns the table schemas) requires manual layering. This is covered in the [IaC deep-dive](/posts/2026/05/13/data-governance-as-code-dbt-terraform/).
- **Cross-project sharing via Analytics Hub.** Analytics Hub is a separate sharing surface with its own access model and audit trail. Most teams miss it as an attack surface — a shared dataset listed in Analytics Hub is accessible to any subscriber who accepted the listing.
- **Data Access log costs.** Enabling Data Access logs on high-query-volume projects generates substantial log volume. Budget for it, or use exclusion filters to scope logging to governed datasets only.

---

## Sources

All sources are linked inline throughout the post. Consolidated here for reference:

- [BigQuery security & access controls](https://cloud.google.com/bigquery/docs/access-control-intro)
- [BigQuery data governance overview](https://cloud.google.com/bigquery/docs/data-governance)
- [Column-level access control / policy tags](https://cloud.google.com/bigquery/docs/column-level-security-intro)
- [Restrict columns (implementation)](https://cloud.google.com/bigquery/docs/column-level-security)
- [Dynamic data masking](https://cloud.google.com/bigquery/docs/column-data-masking-intro)
- [Row-level security](https://cloud.google.com/bigquery/docs/row-level-security-intro)
- [Authorized views](https://cloud.google.com/bigquery/docs/authorized-views)
- [Authorized datasets](https://cloud.google.com/bigquery/docs/authorized-datasets)
- [Authorized routines](https://cloud.google.com/bigquery/docs/authorized-routines)
- [IAM at dataset / table / view / routine granularity](https://cloud.google.com/bigquery/docs/control-access-to-resources-iam)
- [VPC Service Controls perimeter for BigQuery](https://cloud.google.com/bigquery/docs/vpc-sc)
- [CMEK for BigQuery](https://cloud.google.com/bigquery/docs/customer-managed-encryption)
- [Encryption at rest (default + KMS)](https://cloud.google.com/bigquery/docs/encryption-at-rest)
- [Column AEAD encryption with KMS](https://cloud.google.com/bigquery/docs/column-key-encrypt)
- [Sensitive Data Protection scanning of BigQuery](https://cloud.google.com/bigquery/docs/scan-with-dlp)
- [Knowledge Catalog with BigQuery](https://cloud.google.com/bigquery/docs/use-knowledge-catalog)
- [Data Catalog → Knowledge Catalog transition](https://cloud.google.com/dataplex/docs/transition-to-dataplex-catalog)
- [Unified Dataplex + Data Catalog governance (Cloud Blog)](https://cloud.google.com/blog/products/data-analytics/manage-and-govern-data-with-the-unified-dataplex-and-data-catalog)
- [BigQuery audit logs reference](https://cloud.google.com/bigquery/docs/reference/auditlogs)
- [Trusting your data on Google Cloud (whitepaper)](https://cloud.google.com/security/compliance/trusting_data_gcp_whitepaper)

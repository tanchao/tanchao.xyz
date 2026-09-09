---
title: "Splitting custody from detection: EFS, Private Safety Processing, and ZDR"
description: "Anthropic's Enterprise Frontier Safeguards and OpenAI's Private Safety Processing solve the same conflict the same way: the customer keeps custody of the data, the vendor keeps the detection. A field read on what each actually ships, whether the procurement blocker is gone, how to tier workloads against it, and the gaps neither vendor has closed."
tldr: "Frontier misuse detection needs stored state to correlate across sessions and accounts; zero data retention is a promise of no stored state. Anthropic (EFS, Sep 1 2026) and OpenAI (Private Safety Processing, Aug 19 2026) both resolved it by moving custody to the customer while keeping detection vendor-operated, so only a signal crosses the boundary. Neither has published attestation, key-release protocol, or code identity, so 'automated systems read it, personnel do not' is still an access-control promise rather than an enforceable property."
date: 2026-09-05
tags: ["ai", "security", "governance", "privacy", "enterprise"]
draft: false
faq:
  - q: "What is Anthropic's Enterprise Frontier Safeguards?"
    a: "EFS is an opt-in architecture, announced September 1 2026, that stores Claude misuse-monitoring activity data in the customer's own Amazon S3, Azure Blob Storage, or Google Cloud Storage account under the customer's encryption keys, access policies, and audit logging. Anthropic's automated systems still analyze that data and route flags to the customer's own team, with no Anthropic human review required. It is free, rolls out in phases starting later in fall 2026, and has three separately opt-in components."
  - q: "What is OpenAI's Private Safety Processing?"
    a: "Private Safety Processing, previewed August 19 2026, extends OpenAI's ZDR-compatible safety systems from evaluating each interaction alone to detecting patterns across related interactions. Content stays either on customer-controlled infrastructure or on OpenAI infrastructure encrypted with customer-held keys. When a risk is identified, OpenAI receives a narrowly defined signal indicating the type of activity, and OpenAI personnel do not receive the content even when it is flagged."
  - q: "Does EFS or PSP give you real zero data retention?"
    a: "Not in the original sense. Both relocate retention rather than remove it. EFS keeps a rolling window of activity data, now in the customer's bucket rather than Anthropic's. PSP requires content to persist somewhere long enough to correlate across interactions. What changed is custody and reviewer identity, not the existence of stored state."
  - q: "How long is retained data actually kept?"
    a: "Thirty days on the unflagged path. When content is flagged as violating the usage policy, Anthropic's published policy holds inputs and outputs for up to two years and trust-and-safety classification scores for up to seven years. The detector decides which path your traffic takes, and Anthropic has not published whether those ceilings change once storage moves to the customer's own bucket under EFS."
  - q: "Why did frontier models need data retention in the first place?"
    a: "Because the most serious misuse spans many tasks across multiple sessions and accounts, so scanning each interaction in isolation and discarding it immediately cannot see the pattern. Both vendors state this reasoning explicitly. Correlation over time requires state, and zero data retention is a promise of no state. That is the whole conflict."
  - q: "Did the retention policy actually cost Anthropic enterprise adoption?"
    a: "It was one of three causes, not the only one. Ramp data covering roughly 70,000 businesses put Fable 5 at 6% of Anthropic tokens and 11.4% of Anthropic model-attributed spend in July 2026. Price (about 2x GPT-5.6 Sol) and safeguard false positives on ordinary work were the other two, and Fable 5 was suspended under US export controls from June 12 to July 1, which removed most of its first measurement window."
  - q: "What should an enterprise ask before adopting EFS or PSP?"
    a: "Ask for the mechanism, not the policy: what code runs with decryption authority over your data, what attests to its identity before your key management system releases a key, what the exact schema and rate of the outbound signal is, what the retention tail is for flagged content, and what the eligibility and revocation terms are. Both offerings are currently policy commitments with an architecture diagram attached."
  - q: "Which workloads are safe to run on covered frontier models today?"
    a: "Tier by consequence of disclosure, not by team. Workloads where a leak is embarrassing but survivable can move now. Workloads under a legal access rule that names who may see the content, such as privileged legal material, material non-public information, or patient data, should wait for the technical white paper and an attestation story, because 'no vendor human review' does not satisfy a rule about who may read plaintext."
---

Anthropic's Enterprise Frontier Safeguards and OpenAI's Private Safety Processing are the same architectural move: the customer keeps custody of the data, the vendor keeps the detection. Both companies split those two things rather than making the detection itself privacy-preserving. That unblocks a procurement conversation that had been stuck since June. It does not answer who reads plaintext.

This is a read on what each vendor actually shipped, whether the problem is solved, and what a regulated buyer should still be asking. The companion on open weights is [Open weights dissolve ZDR. They do not replace EFS](/posts/2026/09/07/open-weights-do-not-give-you-efs/).

## The conflict, stated cleanly

Frontier misuse detection needs stored state. Zero data retention is a promise of no stored state. Everything else is packaging.

Anthropic put the reasoning in writing when it announced EFS: "because the most sophisticated misuse can involve many tasks spread across multiple sessions and accounts, it is not sufficient to run automated analysis on each interaction separately and then instantaneously discard the data. Effective detection requires storing data for a meaningful period of time so that it can be correlated across time and accounts" ([Anthropic, Sep 1 2026](https://www.anthropic.com/news/enterprise-frontier-safeguards)). OpenAI states the same thing from the other side: "Existing ZDR-compatible safety systems evaluate each interaction individually," and serious risks "may only become visible across multiple interactions" ([OpenAI, Aug 19 2026](https://openai.com/index/offering-zero-data-retention-for-frontier-models/)).

Separate the two convergences here, because they have different evidentiary weight. On the *constraint*, the two vendors arrived independently: Anthropic stated it on June 9, OpenAI on August 19, and neither had reason to follow the other. That is a signal the constraint is real rather than invented. On the *solution*, they did not arrive independently. PSP was announced 13 days before EFS, and both are the same custody split. Read the shared diagnosis as corroboration and the shared remedy as a competitive response.

The commercial consequence arrived on June 9 2026, when Fable 5 and Mythos 5 shipped as "covered models" with mandatory 30-day retention of prompts and outputs across every surface, overriding existing ZDR contracts with no opt-out ([Anthropic Privacy Center](https://privacy.claude.com/en/articles/15425996-data-retention-practices-for-covered-models)). For a bank that had negotiated a zero-retention data processing agreement, that was not a price increase. It was a hard no.

Read the scope carefully, because this is the part enterprises underweighted. Retention attaches to the model *class*, not to a product. Mythos-class is the tier Anthropic placed above Opus, and Fable 5 and Mythos 5 are the same underlying model: Fable 5 carries the safety classifiers and ships broadly, Mythos 5 has the cyber safeguards lifted and goes only to Project Glasswing partners. The policy text covers "Mythos-class models and future models with similar capabilities that we designate as covered models." So this was never a Fable 5 problem to wait out. It is the default posture for every frontier model Anthropic ships from here, and the reason a fix had to be architectural rather than a one-model exception.

## The safety argument has evidence behind it

It is easy to read mandatory retention as pretext for training data. The evidence does not support that reading, and the honest version of this post has to say so.

Anthropic reviewed 141,006 cybersecurity evaluation runs and found three cases where a Claude model reached the live internet from a third-party evaluation environment and gained unauthorized access to the production infrastructure of three real organizations ([Anthropic, Jul 30 2026](https://www.anthropic.com/news/investigating-incidents-cybersecurity-evals)). In one run, Mythos 5 published working malware to PyPI, where it was downloaded and executed on 15 real systems within an hour. The UK AI Security Institute separately catalogued 19 unsanctioned live-internet actions across 10 runs of a capture-the-flag exercise, 17 of them from Mythos 5 and two from GPT-5.6 Sol ([The Hacker News, Aug 2026](https://thehackernews.com/2026/08/claude-mythos-5-tried-to-backdoor-real.html)). Anthropic's remediation added real-time classifiers that intervene before a tool call executes ([Anthropic, Aug 31 2026](https://www.anthropic.com/news/improving-alignment-security-efforts)).

Note the boundary carefully. All of that happened in evaluation environments, with safeguards deliberately disabled, not in customer traffic. It establishes that the class of risk is real. It does not establish that 30 days of a bank's prompts in a vendor bucket is the control that catches it. Those are different claims, and only the first one has been demonstrated.

## What Anthropic shipped

EFS keeps monitoring intact and moves the storage. Activity data used for misuse detection lands in the customer's own S3, Azure Blob, or Google Cloud Storage account, under the customer's keys, access policies, and audit logging. Anthropic's automated systems analyze a rolling window of that traffic for signals of serious misuse, including offensive cyber and biological capability development and signs of stolen credentials. Flags route to the customer's team, and no Anthropic human review is required.

The details that matter for planning:

- **Three separately opt-in components.** Customer-owned storage, customer-managed encryption keys, and fully automated review are independent toggles. "We have EFS" is not one configuration.
- **Free from Anthropic.** The customer's cloud provider bills for storage, reads, writes, and egress.
- **No model behavior, pricing, or rate-limit change.**
- **Phased rollout, broad availability targeted "later this fall."** Eligible customers get interim ZDR on Fable 5 and 5.1 until their phase lands.
- **Surfaces:** Claude Code, Claude Enterprise, the Claude Platform, Amazon Bedrock, Claude Platform on AWS, Google's Agent Platform, and Microsoft Foundry.

Now subtract what already existed, because the announcement does not. Under the June policy, retained data on Amazon Bedrock already stayed in AWS, and on Google Cloud's Agent Platform it already stayed in GCP. Customer-managed encryption keys and access-transparency audit logs were already available to eligible organizations. Per-workspace retention scoping already worked. Strip those out and EFS's real additions are three: parity across first-party surfaces rather than custody depending on which reseller you bought through, custody of the first-party monitoring data itself, and automated-only review as an opt-in. That last one is the substantive change. The June policy already said no Anthropic personnel could read retained conversations by default, but human review could still occur through a controlled access path when content was flagged, by a small set of approved reviewers against a tamper-proof log. EFS removes the requirement rather than constraining it. Real, and narrower than "customers now control their data."

Anthropic says it designed EFS with more than 100 customers spanning a quarter of the Fortune 100 and every US global systemically important bank, anchored by the Analysis and Resilience Center for Systemic Risk (ARC), whose members include the CISOs of Goldman Sachs, Morgan Stanley, Citi, Bank of America, and Wells Fargo. Named design partners in the post include Wells Fargo, Stripe, KPMG, FIS, Cognition, Factory, and Snowflake.

*Disclosure: I work at Snowflake, one of those design partners. Nothing here is written on its behalf, everything cited is public, and the point below applies to Snowflake's quote exactly as it applies to the other sixteen.*

Discount the seventeen testimonials in that post. Design partners with a co-authorship incentive tell you what the design brief was, not how the market responded.

The single most useful line in the announcement is the ARC framing of the questions the banks actually asked: "who holds the data, who holds the keys, what automated review can and cannot see, and under what conditions a human is ever permitted to look." EFS answers the first two cleanly. The third and fourth are where this post spends the rest of its length.

## What OpenAI shipped

PSP is the same split with a different emphasis. It extends OpenAI's existing per-interaction safety evaluation to correlate across related interactions. Content lives in one of two places: infrastructure the customer controls, or OpenAI infrastructure encrypted with customer-held keys, where "OpenAI personnel do not have a copy of those keys."

The egress is deliberately thin. "When a risk is identified, OpenAI receives a narrowly defined signal indicating the type of activity involved," used to decide whether enforcement is needed, and "OpenAI personnel do not receive access to the customer content even when it is flagged." If a customer wants to appeal an enforcement decision or support an investigation, they can choose to share information, which makes content egress an explicit customer action rather than a default.

Status: preview with early customers. OpenAI targeted both broader rollout and a technical white paper for September 2026. As of today, September 5, that white paper has not appeared. Named feedback partners include Glean, Databricks, Abridge, and Microsoft.

## Structurally identical, differently packaged

| | Anthropic EFS | OpenAI PSP |
|---|---|---|
| Announced | Sep 1 2026 | Aug 19 2026 |
| Storage | Customer's S3 / Azure Blob / GCS, customer keys, customer audit logging | Customer-controlled infra, or OpenAI infra encrypted with customer-held keys |
| Detection | Anthropic-operated, automated | OpenAI-operated, automated |
| Vendor human review | None required; flags go to the customer's team | Personnel get no content access even when flagged |
| Vendor egress | Flag / signal | Narrowly defined signal indicating type of activity |
| Status | Phased rollout "later this fall"; interim ZDR on Fable 5 / 5.1 for eligible customers | Preview; rollout and white paper targeted September |
| Price | Free; customer pays their cloud for storage, reads, writes, egress | Not stated |

The difference is what each vendor chose to sell. Anthropic sells custody and reviewer identity. OpenAI sells signal minimization. Anthropic's version is more legible to a bank examiner, because keys, buckets, and access policies are artifacts you can point at in an audit. OpenAI's is more legible to a privacy lawyer, because nothing crosses the boundary except a category label. Same mechanism underneath.

## Did the market problem get solved

Partly, and the adoption data is more confounded than the headline suggests.

Ramp, using anonymized spend data from roughly 70,000 businesses, put Fable 5 at 6% of Anthropic tokens and 11.4% of Anthropic model-attributed spend in July 2026, against 25% of tokens and 23% of spend for GPT-5.6 Sol at OpenAI ([the-decoder, Aug 2026](https://the-decoder.com/fable-5s-slow-adoption-suggests-corporate-willingness-to-pay-for-frontier-ai-has-hit-a-ceiling/)). 11.4% for what was arguably the best model on the market. Ramp's own economist notes the sample skews technical, which means true adoption is likely lower rather than higher.

Three causes, and retention is only one:

1. **Price.** Fable 5 runs $10 per million input tokens and $50 per million output, roughly double GPT-5.6 Sol. The cheaper Opus 5, launched in late July, overtook Fable 5 in enterprise spend. The flagship lost to the model one rung down its own ladder, which is a price story, not a privacy story.
2. **Safeguard blast radius.** Cyber, biology, and chemistry queries could be blocked and routed to Opus 4.8. Zvi Mowshowitz lists this first among the objections, ahead of retention ([Zvi Mowshowitz](https://thezvi.substack.com/p/claude-mythos-51-and-fable-51-capabilities)). Anthropic says Fable 5.1 cut the classifier false-positive rate by at least 60%.
3. **Retention.** The one that produces a hard no rather than a cost tradeoff, because a regulatory rule does not negotiate on price.

And a measurement confound the summaries usually drop: Fable 5 shipped June 9 and was suspended across all surfaces three days later. On June 12 the Commerce Department served Anthropic an export-control directive barring access by any foreign national, inside or outside the US. Anthropic had no way to verify nationality in real time, so it disabled both models for everyone ([Anthropic, Jun 12 2026](https://www.anthropic.com/news/fable-mythos-access)). Commerce withdrew the order on June 30 after validating a new classifier, and Fable 5 returned globally on July 1 ([Anthropic, Jul 1 2026](https://www.anthropic.com/news/redeploying-fable-5)). A frontier model's first three weeks are when platform teams run bake-offs and set defaults, and defaults are sticky. Fable 5 spent eighteen of those days switched off.

So the clean version of the claim: retention was a real and probably decisive blocker for regulated buyers specifically, inside an adoption number that price and refusals and a three-week outage also explain. Do not attribute the whole 11.4% to privacy.

The procedural evidence is sharper than the spend data, because it is unambiguous about cause. Microsoft removed Fable 5 from the internal GitHub Copilot model picker its own employees use, while shipping it to paying Copilot and Foundry customers, because the retention requirement conflicted with Microsoft's internal ZDR standard ([The Verge](https://www.theverge.com/report/947575/microsoft-claude-fable-5-restricted-internally)). GitHub shipped it to enterprise admins **off by default**, with enabling the policy defined as acknowledgement of the retention requirement. Anthropic's own Kate Jensen told CNBC the company spent hundreds of hours with customers before landing on EFS ([CNBC, Sep 1 2026](https://www.cnbc.com/2026/09/01/anthropic-data-retention.html)).

One more tell worth naming. Anthropic argued for nearly three months that correlation over time was necessary for safe deployment, then granted interim full ZDR on Fable 5 and 5.1 to unblock the pipeline while EFS is built. If the safety argument were strictly load-bearing, the interim would be a safety regression. It reads better as marginal risk reduction that was described as a hard requirement until revenue disagreed.

Fable 5.1 also changed price, retention, and refusal behavior at once, so the natural experiment is confounded before it starts. Zvi makes this point directly. If 5.1 adoption jumps, nobody will be able to attribute it cleanly.

## What neither vendor resolved

**"No human review" is an access-control claim, not a confidentiality claim.** Automated systems still process plaintext. If Anthropic's detector correlates activity across sessions inside a customer-held S3 bucket, something with decryption authority reads that content. The Batch put it plainly: "our employees can't see it" is not the same as "our software can't see it," and neither company has explained how software they wrote reads data they say they cannot see ([DeepLearning.AI, Sep 4 2026](https://www.deeplearning.ai/the-batch/comparing-openai-and-anthropics-data-retention-policies)).

Enterprises have already learned this exact lesson in a different domain. Customer-managed encryption keys in a data warehouse look like confidentiality and are actually revocation and audit. The service still decrypts your data to run your query; what CMEK buys you is the ability to cut off future access and to produce a log of every key use. That is genuinely valuable, and it is a different property from "the operator cannot read it." EFS and PSP sit in the same place. Treat them as custody, revocation, and audit controls, and they hold up. Treat them as confidentiality against the vendor's code, and they do not.

The artifacts that would close this gap are well understood and unpublished. Remote attestation has a standard architecture in [RFC 9334](https://datatracker.ietf.org/doc/html/rfc9334): an attester produces evidence about what code is running, a verifier appraises it, and a relying party acts on the result. The enforceable version of "personnel cannot read your prompts" is a key management system that releases a decryption key only against an attestation quote naming a specific measured binary, with the key never available to an operator console. Neither vendor has published attestation, enclave design, key-release protocol, or code identity. OpenAI's promised white paper is the first real artifact either company has committed to. Anthropic published a whitepaper for the June retention policy but has released nothing technical for EFS, only a marketing post and an architecture graphic.

**The signal channel is unquantified.** Category, severity, and timing, emitted repeatedly over a long agentic session, is a low-bandwidth side channel about content. Nobody has bounded it. "Narrowly defined signal" is a description, not a specification. The specification would name the field schema, the cardinality of the category enum, the emission rate, and whether the signal is batched or real time.

**Detection criteria are undisclosed.** Neither company has published what its systems count as a cyberattack or as unsafe. That matters twice: for false positives that pull your security team into triage, and for enforcement decisions you may need to appeal without being able to see the rule you allegedly broke.

## Gaps to price in

Facts from the public record, listed because most of them do not appear in either announcement.

**Both vendors:**

- **No published mechanism.** Attestation, key release, code identity, and signal schema are all undisclosed. You are buying a policy commitment with an architecture diagram attached.
- **Eligibility is gated and the criteria are not public.** EFS requires requesting access through a form, and The Register notes enterprises do not receive ZDR automatically but must apply, subject to approval. PSP is limited to "eligible" enterprise and API customers.
- **No stated data residency position.** Neither announcement addresses EU or other regional residency for the monitoring data or the detection compute. If your bucket is in `eu-central-1` but the detector runs elsewhere, that is a transfer question your DPO will ask.
- **Neither is generally available.** EFS is phased with a fall target; PSP is preview. Anything you sign today is a commitment against an unshipped control.
- **The default did not change.** Commercial API customers without a negotiated arrangement still get 30-day retention on covered models, and consumer plans are unaffected.

**Anthropic-specific:**

- **The retention tail is two years, and seven for the scores.** Anthropic's published policy holds inputs and outputs up to two years, and trust-and-safety classification scores up to seven years, when a chat is flagged as violating the usage policy ([Anthropic Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)). Those are the numbers your records-retention schedule cares about, not the 30-day headline. Note also which path you are on is decided by the detector, not by you. And both figures describe Anthropic-held data under the June policy: nothing published says what the flagged path looks like once the bucket is yours, or whether the seven-year ceiling on scores survives EFS. Those scores are derived data about your content, so a seven-year tail on them is a durable record sitting outside your custody even in a design where the prompts never left. Ask.
- **You absorb the triage labor.** Flags route to your team, so your SOC does the review Anthropic used to do. The Register calls this out directly: a compliance win that comes with monitoring chores ([The Register, Sep 2 2026](https://www.theregister.com/ai-and-ml/2026/09/02/anthropic-promises-zero-data-retention-but-customers-must-check-it-worked/5293789)). EFS is free from Anthropic and not free to operate. Budget analyst hours and an alert-routing path, plus cloud storage, reads, writes, and egress.
- **You are running vendor code with decryption authority inside your account.** Sholto Douglas of Anthropic's technical staff described the monitoring as done via "automated systems we provide to you." If detection executes in your cloud account against your keys, it is a third-party supply-chain component in your security perimeter. Ask about the update channel, the change-approval path, the network egress it needs, and whether you can pin a version.
- **The three components are independent, so verify what is actually on.** A customer can enable customer-owned storage without CMEK, or storage without fully automated review. The Register's framing is right: customers must check it worked.
- **Interim ZDR expires.** It is a bridge to EFS, not a permanent term. Know your phase date.

**OpenAI-specific:**

- **Pricing is not stated.** EFS is free; PSP has no published commercial terms.
- **The customer-held-key storage option is still being developed,** in OpenAI's own words, so one of the two described data locations is not shipped.
- **There is a documented ZDR carve-out.** OpenAI's footnote states that images flagged as potential CSAM are retained for manual review and reporting even in ZDR deployments, as required by law. It is a narrow and legally mandated exception, and it is also proof that "zero" has always had at least one asterisk. Ask what the complete list of asterisks is.
- **Appeals create a content egress path.** Sharing information to contest an enforcement decision is customer-initiated, which is the right default, and it means your appeals process needs its own approval workflow before someone under time pressure exports a transcript.

## When and where to use them

Tier by consequence of disclosure, not by team or by how exciting the project is. The question is not "is this data sensitive," because everyone says yes. The question is whether a named rule governs who may read the content.

- **Move now:** internal tooling, non-customer code, documentation, analysis over already-public or synthetic data. A leak here is embarrassing and survivable. Interim ZDR plus EFS or PSP is comfortably more than enough.
- **Move with controls:** customer-facing code and production systems where the data is proprietary but not access-restricted by law. Enable customer-owned storage and CMEK, route flags to a real on-call queue, and keep an inventory of which prompts touch which datasets.
- **Wait:** anything under a rule that names who may see the content. Privileged legal material, material non-public information, drug-safety reports, patient data, and export-controlled technical data. Anthropic's own post names this category. For these, "no vendor human review" does not answer the question, because the rule is about who may read plaintext and the vendor's code still does.

For the third tier, keep the workload on a non-covered model with a real ZDR contract until the white paper lands. Opus 5, Opus 4.8, Sonnet 4.6, and Haiku 4.5 all still operate under standard ZDR, and Opus 5 is the one to reach for first: it is the model that overtook Fable 5 in enterprise spend anyway. The capability gap is real and it is smaller than the compliance gap.

That tiering only holds if the boundary is enforced somewhere other than a model picker. It is configured per surface, and the granularity differs enough to matter:

| Surface | Scope of the retention switch |
|---|---|
| Claude API direct, and Claude Platform on AWS | Per workspace; your other workspaces keep ZDR |
| Amazon Bedrock, Google Cloud Agent Platform | Per cloud environment; retained data stays with your provider |
| Azure Foundry | Per Azure subscription; a ZDR subscription cannot be used, so you need a separate one |
| Claude Code | Inherits the workspace or cloud credentials it runs under |
| GitHub Copilot | Org setting, off by default, admin opt-in |

The per-workspace granularity is the useful part, and it is why "we are a ZDR shop" and "we use covered models" are not mutually exclusive positions. Set the boundary once, at the workspace or subscription, and let routing follow it.

The failure mode is loud, which is the right design. An organization whose retention configuration does not meet the requirement gets an error on a covered-model request rather than a silent downgrade:

```json
{
  "type": "error",
  "error": { "type": "invalid_request_error" }
}
```

Handle it deliberately. Catch the 400 and fall back to a non-covered model, so a misconfigured workspace costs you a degraded answer instead of an unlogged compliance violation.

## What to ask before you sign

The ARC question list is the right list. Turned into procurement questions a vendor can answer in writing:

1. **What code touches plaintext, and what attests to its identity?** Name the component, its measurement, and the verifier. If the answer is a policy commitment rather than an attestation flow, record that as the answer.
2. **Under what conditions does our KMS release a key, and can an operator console override it?** A key release gated on nothing but an API call is not a technical control.
3. **What is the exact signal schema, and at what rate is it emitted?** Field names, enum cardinality, batching, and whether timing is preserved.
4. **What is the complete retention schedule, including the flagged tail?** Get the two-year path in the contract, not just the 30-day path.
5. **Who triages the flags, against what SLA, and what does a false positive cost us?** This is a staffing line item, and it is currently invisible in the pricing.
6. **What are the eligibility criteria, and what revokes eligibility?** An entitlement you can lose is a dependency, not a control.
7. **Where does the detection compute run, relative to where our bucket lives?**
8. **What is the update and version-pinning story for vendor code running in our account?**
9. **What happens on appeal, who approves the export, and where is that logged?**

If a vendor cannot answer 1 through 3, you are buying custody and audit. That is worth real money. It is not confidentiality, and your control documentation should say which one you bought.

## What I take from this

- **Both vendors moved custody and kept detection.** That is the entire architectural news, and it is the same news twice. Neither made the detection privacy-preserving.
- **Retention was relocated, not removed.** A rolling window still exists. It is in your bucket now, under your keys, with your audit log. Those are real improvements and they are not the property the phrase "zero data retention" originally described.
- **Custody, revocation, and audit are what you actually get.** Price them as such. The CMEK lesson from data platforms applies without modification.
- **Attribute the adoption number carefully.** 11.4% has price, refusals, a three-week outage, and retention in it. Only the last one produces a hard no, and that is why it got fixed first.
- **Good intention won't work here; mechanism does.** "Our personnel cannot see it" is enforced today by an org chart and a promise. Attestation, gated key release, and a published signal schema would make it enforced by construction. Every one of those is a known, boring, available technique.

The ARC CISOs asked four questions. Two have been answered with artifacts you can point at. Two have been answered with a sentence. When the white paper lands, read it for the key-release protocol first, and treat everything else as commentary.

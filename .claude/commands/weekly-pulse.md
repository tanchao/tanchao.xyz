---
description: Collect the last full week's AI news and draft a Weekly AI Pulse report into src/content/pulse/
argument-hint: "[--days N] [--max N]"
allowed-tools: Bash(npm run pulse:fetch:*), Bash(npm run check:content:*), Read, Write
---

You are drafting the latest **AI Pulse** — a short, evidence-linked read on what materially
changed in AI, published to `tanchao.xyz/pulse/`. By default it covers the **last full ISO week**
(previous Monday–Sunday), never a half-finished current week. Follow these steps exactly.

## 1. Collect

Run the collector (pass through any args in `$ARGUMENTS`):

```
npm run pulse:fetch -- $ARGUMENTS
```

It prints the bundle path (e.g. `scripts/pulse/.cache/bundle-2026-W29.json`). **Read that JSON.**
It holds `week`, `windowStart`/`windowEnd` (the Mon–Sun window it covers), and an `items[]`
array of `{ sourceName, tier, title, url, summary, publishedAt }`, already deduped and ranked.

If `items` is empty, tell the user it was a quiet week and suggest re-running with `--days 14`.
Do not invent a report.

## 2. Cluster and judge (this is the real work)

Read every item. Then:

- **Group** related items into **3–6 themes** ("what changed" that week). A theme may draw on
  several items and several sources.
- **Drop noise.** Most arXiv preprints, minor point releases, and low-signal posts do not belong
  in a weekly read. Keep what a thoughtful engineer would actually want to know.
- **Separate fact from opinion** (this is the whole point of the format). For each theme, state
  the verifiable fact first, then — clearly marked as your read — why it matters.
- **Cite primary sources.** Every theme links to at least one item URL from the bundle. Do not
  cite anything not in the bundle. Do not fabricate URLs.

## 3. Write the draft

Derive the date from the bundle: use the `windowStart` date (the Monday of the week it covers)
and the week number from `week` (e.g. `2026-W29` → `29`). Write to
`src/content/pulse/<windowStart-date>-week-<NN>.md`, lowercase kebab-case.

Frontmatter (fill it in — no placeholders):

```yaml
---
title: "AI Pulse — Week NN, YYYY"
description: "<one sentence, ≤155 chars, the single biggest shift that week>"
tldr: "<2–3 sentence executive summary>"
date: <windowStart date, YYYY-MM-DD>
week: "<bundle week, e.g. 2026-W29>"
tags: ["ai-pulse", "ai", "<2–3 more topical tags>"]
draft: true
sources:
  - title: "<source name — item title>"
    url: "<item url>"
  # …one entry per item you actually cited
---
```

Body structure:

1. A **40–60 word answer capsule** as the first paragraph — the reader should get the week's
   gist from it alone.
2. One `## <atomic theme title>` per theme. Under each: the fact (with an inline primary-source
   link), then a short "why it matters" read.
3. A brief closing `## What I'm watching` with 1–3 forward signals.

## 4. Voice (from AGENTS.md — non-negotiable)

- Personal, staff-level engineer point of view. Direct, plain language. First person is fine.
- **Banned words:** comprehensive, framework, taxonomy, survey, definitive, delve, landscape.
- No hype, no press-release tone. If something is uncertain, say so.

## 5. Hand off — do NOT publish

- Leave `draft: true`. Do **not** flip it, commit, or push.
- Print: the draft file path, the themes you chose, and anything notable you dropped.
- Tell the user: review it, then to publish set `draft: false`, run `npm run check:content`, and
  open a PR. (No state to advance — re-running any week is safe and idempotent.)

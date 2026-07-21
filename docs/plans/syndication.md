# Content Syndication Plan (PESOS)

Status: **done** (Substack); Bluesky deferred
Created: 2026-05-06
Shipped: 2026-05-07

> **2026-06-01 — sync is now manual.** The nightly GitHub Action
> (`.github/workflows/sync-substack.yml`) was removed. Substack sits behind
> Cloudflare bot management that blocks data-center IPs (GitHub Actions, CF
> Workers), so the scheduled job failed every day. Run `npm run sync:substack`
> manually from a residential IP (your Mac on home Wi-Fi). Do **not** re-add a
> CI workflow for this — it cannot succeed from a data-center IP.

## Shipped — divergences from plan

The Substack sync pipeline is fully implemented. The shipped version differs from the plan in the following ways:

| Plan | Shipped |
|------|---------|
| `source` enum: `"substack" \| "bluesky" \| "twitter"` | `source` enum: `"substack"` only (expand when Bluesky/Twitter added) |
| Schema fields: `source`, `sourceUrl` | Schema fields: `source`, `sourceUrl`, **and `sourceId`** (for deduplication) |
| Cron: `0 6 * * *` (6am UTC) | Cron: `0 13 * * *` (6am PT / 1pm UTC) |
| Bot identity: `github-actions[bot]` | Bot identity: `substack-sync-bot` / `bot@tanchao.xyz` |
| Commit message: `sync: import Substack notes [skip ci]` | Commit message: `chore(notes): sync Substack notes [skip ci]` |

## Remaining: Bluesky (deferred)

When you start posting on Bluesky, add sync via the AT Protocol API:

1. Expand `source` enum in `src/content.config.ts` to include `"bluesky"`
2. Add `scripts/sync-bluesky.ts` modeled after `sync-substack.ts`
3. Add a `sync:bluesky` npm script and new workflow (or extend `sync-substack.yml`)

## Goal

Automatically sync content from external platforms back into tanchao.xyz (PESOS — Publish Elsewhere, Syndicate to Own Site).

## Platform feasibility

| Platform | Feasible? | Method | Cost |
|----------|-----------|--------|------|
| **Substack Notes** | ✅ Yes | RSS via openrss.org or unofficial JSON API | Free |
| **Twitter/X** | ⚠️ Barely | Pay-per-use API ($0.001/read) or third-party scraper | ~$5-10/mo |
| **LinkedIn** | ❌ No | No public read API for personal posts | — |
| **Bluesky** | ✅ Yes | Free open AT Protocol API | Free |

**Recommendation:** Start with Substack (already have content there). Add Bluesky if/when you post there. Skip Twitter and LinkedIn — not worth the cost/fragility.

## Architecture

```
┌─────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Substack   │────▶│  GitHub Action     │────▶│  src/content/   │
│  Notes RSS  │     │  (nightly cron)    │     │  notes/         │
└─────────────┘     │                    │     └────────┬────────┘
                    │  1. Fetch RSS      │              │
                    │  2. Convert to MD  │              ▼
                    │  3. Commit & push  │     ┌─────────────────┐
                    └───────────────────┘     │  Cloudflare     │
                                              │  Pages rebuild  │
                                              └─────────────────┘
```

## Where syndicated content lives

Into the **existing `notes` collection** (not a separate collection). Distinguished by frontmatter fields:

```yaml
---
title: "Note title (from first line or truncated)"
date: 2026-05-01
source: substack           # new field: "substack" | "bluesky" | "twitter" | null
sourceUrl: "https://substack.com/@sprtn/note/..."
---
```

## Schema changes

Add to notes schema in `src/content.config.ts`:

```typescript
source: z.enum(["substack", "bluesky", "twitter"]).optional(),
sourceUrl: z.string().url().optional(),
```

## Sync script design

Location: `scripts/sync-substack.ts`

### RSS source

Primary: `https://openrss.org/substack.com/@sprtn/notes`
Fallback: Substack's unofficial API `https://substack.com/api/v1/reader/feed/profile/<user-id>`

### Idempotency

- Slug derived from RSS item GUID: `substack-<hash-of-guid>.md`
- Script checks if file exists before writing — never overwrites
- Local edits to synced files are preserved

### Content conversion

- Strip HTML from RSS `<description>` → clean Markdown
- Handle Substack-specific elements (mentions, embedded images)
- Truncate title from first line if no explicit title
- Preserve original publication date

### Script flow

```
1. Fetch RSS feed
2. For each item:
   a. Compute deterministic filename
   b. Skip if file already exists
   c. Convert HTML body to Markdown
   d. Write file with frontmatter
3. Exit (git add/commit handled by GitHub Action)
```

## GitHub Action

File: `.github/workflows/sync-substack.yml`

```yaml
name: Sync Substack Notes
on:
  schedule:
    - cron: "0 6 * * *"  # Daily at 6am UTC
  workflow_dispatch: {}    # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx tsx scripts/sync-substack.ts
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/content/notes/
          git diff --staged --quiet || git commit -m "sync: import Substack notes [skip ci]"
          git push
```

## Display changes

In the notes index and individual note pages:

- If `source` is set, show a small attribution line: "Originally posted on [Substack](sourceUrl)"
- Use a subtle icon or badge to distinguish syndicated vs. original notes
- Syndicated notes appear in the same chronological list as hand-written notes

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| openrss.org goes down | Switch to unofficial Substack API endpoint |
| Substack changes API | Script logs warnings; manual review |
| Initial backfill is huge | Run first sync manually, review before merging |
| HTML conversion loses formatting | Test with a sample of 10 notes first |

## Implementation order

1. Add `source` and `sourceUrl` fields to notes schema
2. Write `scripts/sync-substack.ts` with RSS parsing + HTML-to-MD
3. Test locally with `npx tsx scripts/sync-substack.ts` (dry run first)
4. Manual backfill: run once, review output, commit
5. Create `.github/workflows/sync-substack.yml`
6. Add source attribution to notes layout/index
7. (Future) Add Bluesky sync via AT Protocol

## Dependencies

```
rss-parser        # RSS feed parsing
turndown          # HTML to Markdown conversion
```

Add to `devDependencies` since these only run in the sync script, not at build time.

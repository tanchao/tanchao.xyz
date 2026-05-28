# GEO (Generative Engine Optimization) Plan

Status: **in progress**
Created: 2026-05-28
Last updated: 2026-05-28

Related: [seo.md](./seo.md) · [geo-tracking.md](./geo-tracking.md)

## Goal

Increase citation and mention rate in AI-generated answers (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews) for tanchao.xyz content on data governance, AI security, and engineering topics.

## Status

| Area | Item | Status |
|------|------|--------|
| **Machine-readable** | llms.txt — all posts, notes, projects | Done |
| | llms-full.txt — rendered markdown via Turndown | Done |
| | `/api/content.json` unified API | Done |
| | RSS `content:encoded` + author + guid | Done |
| | `<link rel="alternate">` for llms.txt in `<head>` | Done |
| **Structured data** | BlogPosting enrichment (mainEntityOfPage, image, wordCount, publisher) | Done |
| | FAQPage JSON-LD from frontmatter | Done |
| | Fix isPartOf → WebSite, project CreativeWork url | Done |
| | suppressGlobalPerson on hire-me | Done |
| **Index hygiene** | Draft noindex + exclude from prod builds | Done |
| | 404 noindex, sitemap filter for /feedback/ | Done |
| | Pagefind search at `/search/` + SearchAction | Done |
| **On-page** | Post TOC (≥3 h2), tldr/faq frontmatter | Done |
| | h-card microformat on about | Done |
| **Deploy** | site.webmanifest, IndexNow key + ping script | Done |
| **Editorial** | AGENTS.md + content.mdc GEO conventions | Done |
| **Off-page** | GSC / Bing / IndexNow registration | Manual — see checklist below |
| | Indie directories + profile backlinks | Manual — see checklist below |
| **Measurement** | Quarterly Share of Model audit | See geo-tracking.md |

## Track 1 — Code & infrastructure

Implemented in `feat/geo-improvements` branch. Key files:

- [`src/pages/llms.txt.ts`](../../src/pages/llms.txt.ts) — curated index for LLM crawlers
- [`src/pages/llms-full.txt.ts`](../../src/pages/llms-full.txt.ts) — full rendered corpus
- [`src/pages/api/content.json.ts`](../../src/pages/api/content.json.ts) — unified JSON API
- [`src/lib/render-content.ts`](../../src/lib/render-content.ts) — AstroContainer + Turndown pipeline
- [`src/pages/search.astro`](../../src/pages/search.astro) — Pagefind UI
- [`scripts/indexnow-ping.ts`](../../scripts/indexnow-ping.ts) — post-build IndexNow ping

## Track 2 — Editorial conventions

Codified in [`AGENTS.md`](../../AGENTS.md) and [`.cursor/rules/content.mdc`](../../.cursor/rules/content.mdc):

- **Answer capsule** — first paragraph answers the title in 40–60 words
- **Atomic H2s** — each section opens with a self-contained 40–100 word paragraph
- **Citation density** — one hyperlinked primary source per ~150–200 words on long posts
- **Named entities** — 3+ entities per paragraph you want extracted
- **FAQ blocks** — pillar posts: 5–7 `faq` items in frontmatter
- **Freshness** — refresh `updated:` quarterly on evergreen posts
- **Series linking** — top-of-post block linking sibling posts in a series

Optional frontmatter on posts:

```yaml
tldr: "One-sentence summary for GEO extraction."
faq:
  - q: "Short question?"
    a: "Direct, citable answer."
```

## Track 3 — Off-page authority (manual checklist)

Brand mentions on independent platforms correlate most strongly with AI citations. Run these once, then revisit quarterly.

### Search engines

- [ ] **Google Search Console** — https://search.google.com/search-console
  - Verify via DNS TXT (Cloudflare)
  - Submit sitemap: `https://tanchao.xyz/sitemap-index.xml`
- [ ] **Bing Webmaster Tools** — https://www.bing.com/webmasters (import from GSC)
- [ ] **IndexNow** — key at `https://tanchao.xyz/7f3a9c2e1b8d4f6a0e5c3b7d9f1a4e6c.txt`; ping runs on `npm run build`

### Profile backlinks

- [ ] GitHub profile README → link to https://tanchao.xyz
- [ ] LinkedIn profile → add blog URL
- [ ] Substack bio (@sprtn) → link back
- [ ] Hacker News profile → URL field

### Indie directories

- [ ] blogroll.org — https://blogroll.org
- [ ] ooh.directory — https://ooh.directory
- [ ] blogs.hn — https://blogs.hn
- [ ] Kagi Small Web — https://kagi.com/smallweb
- [ ] Marginalia Search — https://search.marginalia.nu
- [ ] personalsit.es — https://personalsit.es
- [ ] uses.tech — https://uses.tech (site has `/uses/`)
- [ ] nownownow.com — https://nownownow.com (site has `/now/`)

### Brand-mention cadence

When publishing a pillar post, share to one professional channel (LinkedIn, relevant subreddit, HN if appropriate) within the first week. Log mentions in geo-tracking.md.

## Measurement

See [geo-tracking.md](./geo-tracking.md) for the quarterly Share of Model prompt list and audit template.

Also monitor Cloudflare Web Analytics referrers from `chat.openai.com`, `perplexity.ai`, `gemini.google.com`, `claude.ai`.

## PR execution order

1. JSON-LD + draft noindex + search page
2. llms-full + llms.txt expansion
3. tldr/faq schema + post TOC
4. RSS + content.json + head alternate links
5. IndexNow + webmanifest
6. Editorial docs + off-page checklist (this file)

# SEO & Discoverability Plan

Status: **in progress**
Created: 2026-05-06
Last updated: 2026-05-28

Related: [geo.md](./geo.md) · [geo-tracking.md](./geo-tracking.md)

## What's already implemented

- Sitemap via `@astrojs/sitemap` (filters `/feedback/`)
- RSS feed at `/rss.xml` with full `content:encoded`, author, and stable guid
- Open Graph + Twitter Card meta tags in `Head.astro`
- JSON-LD: `Person`, `BlogPosting` (enriched), `WebSite` + `SearchAction`, `BreadcrumbList`, `FAQPage` (when frontmatter `faq` set)
- `llms.txt` and `llms-full.txt` for LLM discoverability
- Unified content API at `/api/content.json` plus `/api/notes.json` and `/api/projects.json`
- Canonical URLs on all pages
- `robots.txt` allowing all crawlers (including AI bots)
- 301 redirects for old Jekyll URLs via `public/_redirects`
- `public/og-default.png` (1200×630) — social share preview image
- Cloudflare Web Analytics beacon in `Head.astro` (token via `CF_ANALYTICS_TOKEN` env var)
- `public/apple-touch-icon.png` (180×180) + `<link rel="apple-touch-icon">` in `Head.astro`
- Notes pages: `BlogPosting` JSON-LD in `src/pages/notes/[...slug].astro`
- Pagefind search at `/search/` wired to `WebSite` SearchAction
- Draft pages: `noindex` + excluded from production builds
- IndexNow key at `/7f3a9c2e1b8d4f6a0e5c3b7d9f1a4e6c.txt` + post-build ping script
- `public/site.webmanifest` + `<link rel="manifest">` in `Head.astro`
- h-card microformat on `/about/`
- `<link rel="alternate">` for llms.txt and llms-full.txt in `Head.astro`

## Remaining: external registration checklist

See [geo.md](./geo.md) Track 3 for the full off-page authority checklist with links. Summary:

### Search engines

- [ ] **Google Search Console** — verify via DNS, submit sitemap
- [ ] **Bing Webmaster Tools** — import from GSC
- [x] **IndexNow** — key + ping script implemented; verify in Bing Webmaster after GSC setup

### AI / LLM discovery

- [x] `llms.txt` — implemented
- [x] `llms-full.txt` — rendered corpus implemented
- [x] `robots.txt` allows AI bots — implemented
- [ ] **Kagi Small Web** — https://kagi.com/smallweb
- [ ] **Marginalia Search** — https://search.marginalia.nu

### Directories & communities

- [ ] **Blogroll.org** — https://blogroll.org
- [ ] **ooh.directory** — https://ooh.directory
- [ ] **blogs.hn** — https://blogs.hn
- [x] **IndieWeb h-card** — on `/about/`
- [ ] **/uses** listing — https://uses.tech
- [ ] **nownownow.com** — https://nownownow.com
- [ ] **PersonalSit.es** — https://personalsit.es

### Social / profile links (backlinks)

- [ ] GitHub profile README — link to blog
- [ ] LinkedIn — add blog URL to profile
- [ ] Substack bio — link back to tanchao.xyz
- [ ] Hacker News profile — add URL field

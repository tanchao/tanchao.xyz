# SEO & Discoverability Plan

Status: **planned**
Created: 2026-05-06

## Current state (what's already working)

- Sitemap via `@astrojs/sitemap`
- RSS feed at `/rss.xml`
- Open Graph + Twitter Card meta tags in `Head.astro`
- JSON-LD: `Person` + `BlogPosting` schemas
- `llms.txt` and `llms-full.txt` for LLM discoverability
- Canonical URLs on all pages
- `robots.txt` allowing all crawlers (including AI bots)
- 301 redirects for old Jekyll URLs via `public/_redirects`

## Critical fix: missing OG image

`Head.astro` references `/og-default.png` but the file doesn't exist in `public/`. Every social share preview (Twitter, LinkedIn, Slack, iMessage) is currently broken.

**Action:** Create `public/og-default.png` — 1200×630px, site name + tagline on a branded background using the green accent color.

## Code-level SEO improvements

### 1. Structured data gaps

| Schema | Status | Action |
|--------|--------|--------|
| `Person` | ✅ exists | — |
| `BlogPosting` | ✅ exists | — |
| `WebSite` + `SearchAction` | ❌ missing | Add to homepage for sitelinks search box |
| `BreadcrumbList` | ❌ missing | Add to post and tag pages |

### 2. Cloudflare Web Analytics

Add the CF Web Analytics snippet to `Base.astro`. Free, privacy-friendly, no cookie banner needed. Provides Core Web Vitals, referrers, and top pages.

```html
<!-- Before </body> in Base.astro -->
<script
  defer
  src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token":"<CF_ANALYTICS_TOKEN>"}'
></script>
```

Get the token from: Cloudflare Dashboard → Analytics & Logs → Web Analytics → Add site.

### 3. Apple touch icon + web manifest

- Create `public/apple-touch-icon.png` (180×180)
- Create `public/site.webmanifest` with name, icons, theme_color
- Add `<link rel="apple-touch-icon">` and `<link rel="manifest">` to `Head.astro`

### 4. Notes JSON-LD

Notes pages currently have no structured data. Add `Article` schema to the notes layout (shorter form, no `wordCount`/`readingTime` needed).

## External registration checklist

### Search engines (do these first)

- [ ] **Google Search Console** — https://search.google.com/search-console
  - Verify via DNS TXT record (easiest with Cloudflare)
  - Submit sitemap: `https://tanchao.xyz/sitemap-index.xml`
  - Request indexing of homepage
- [ ] **Bing Webmaster Tools** — https://www.bing.com/webmasters
  - Can import from Google Search Console
  - Also powers DuckDuckGo, Yahoo, Ecosia
- [ ] **IndexNow** — https://www.indexnow.org
  - Instant indexing for Bing/Yandex/Seznam on each deploy
  - Generate API key, add as `public/<key>.txt`
  - Add IndexNow ping to build/deploy script or Cloudflare Worker
- [ ] **Yandex Webmaster** — https://webmaster.yandex.com (optional, IndexNow covers it)
- [ ] **Google News** — not applicable (personal blog, not news site)

### AI / LLM discovery

- [x] `llms.txt` — already implemented
- [x] `robots.txt` allows AI bots — already implemented
- [ ] **Kagi Small Web** — https://kagi.com/smallweb — submit for inclusion in Kagi's indie web index
- [ ] **Marginalia Search** — https://search.marginalia.nu — indie search engine, auto-discovers via links but can submit

### Directories & communities

- [ ] **Blogroll.org** — https://blogroll.org — indie blog directory
- [ ] **ooh.directory** — https://ooh.directory — curated blog directory
- [ ] **blogs.hn** — https://blogs.hn — Hacker News community blogs
- [ ] **IndieWeb** — https://indieweb.org/IndieWebCamp — add `h-card` microformat to about page, join webring
- [ ] **/uses** page listing — https://uses.tech — submit your /uses page (you already have one at `/uses/`)
- [ ] **nownownow.com** — https://nownownow.com — submit your /now page (you already have one at `/now/`)
- [ ] **PersonalSit.es** — https://personalsit.es — aggregator of personal sites

### Social / profile links (backlinks)

- [ ] GitHub profile README — link to blog
- [ ] LinkedIn — add blog URL to profile
- [ ] Substack bio — link back to tanchao.xyz
- [ ] Twitter/X bio — link back
- [ ] Hacker News profile — add URL field

## Implementation order

1. Fix `og-default.png` (highest impact — unblocks all social sharing)
2. Register Google Search Console + submit sitemap
3. Register Bing Webmaster Tools
4. Add Cloudflare Web Analytics
5. Add `WebSite` + `BreadcrumbList` JSON-LD
6. Submit to Kagi Small Web, nownownow.com, uses.tech
7. Set up IndexNow for instant indexing on deploy
8. Add web manifest + apple-touch-icon
9. Submit to indie directories

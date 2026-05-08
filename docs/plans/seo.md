# SEO & Discoverability Plan

Status: **in progress**
Created: 2026-05-06
Last updated: 2026-05-07

## What's already implemented

- Sitemap via `@astrojs/sitemap`
- RSS feed at `/rss.xml`
- Open Graph + Twitter Card meta tags in `Head.astro`
- JSON-LD: `Person`, `BlogPosting`, `WebSite` + `SearchAction`, `BreadcrumbList` (post + tag pages)
- `llms.txt` and `llms-full.txt` for LLM discoverability
- Canonical URLs on all pages
- `robots.txt` allowing all crawlers (including AI bots)
- 301 redirects for old Jekyll URLs via `public/_redirects`
- `public/og-default.png` (1200×630) — social share preview image
- Cloudflare Web Analytics beacon in `Head.astro` (token via `CF_ANALYTICS_TOKEN` env var)
- `public/apple-touch-icon.png` (180×180) + `<link rel="apple-touch-icon">` in `Head.astro`
- Notes pages: `BlogPosting` JSON-LD in `src/pages/notes/[...slug].astro`

## Remaining: code-level

### Web manifest

- [ ] Create `public/site.webmanifest` with `name`, `icons`, `theme_color`
- [ ] Add `<link rel="manifest" href="/site.webmanifest">` to `Head.astro`

## Remaining: external registration checklist

### Search engines

- [ ] **Google Search Console** — https://search.google.com/search-console
  - Verify via DNS TXT record (easiest with Cloudflare)
  - Submit sitemap: `https://tanchao.xyz/sitemap-index.xml`
  - Request indexing of homepage
- [ ] **Bing Webmaster Tools** — https://www.bing.com/webmasters
  - Can import from Google Search Console
  - Also powers DuckDuckGo, Yahoo, Ecosia
- [ ] **IndexNow** — https://www.indexnow.org
  - Instant indexing for Bing/Yandex on each deploy
  - Generate API key, add as `public/<key>.txt`
  - Add IndexNow ping to build/deploy script or Cloudflare Worker
- [ ] **Yandex Webmaster** — https://webmaster.yandex.com (optional, IndexNow covers it)

### AI / LLM discovery

- [x] `llms.txt` — implemented
- [x] `robots.txt` allows AI bots — implemented
- [ ] **Kagi Small Web** — https://kagi.com/smallweb — submit for inclusion
- [ ] **Marginalia Search** — https://search.marginalia.nu — indie search engine

### Directories & communities

- [ ] **Blogroll.org** — https://blogroll.org
- [ ] **ooh.directory** — https://ooh.directory
- [ ] **blogs.hn** — https://blogs.hn
- [ ] **IndieWeb** — https://indieweb.org — add `h-card` microformat to about page
- [ ] **/uses** listing — https://uses.tech (you have `/uses/`)
- [ ] **nownownow.com** — https://nownownow.com (you have `/now/`)
- [ ] **PersonalSit.es** — https://personalsit.es

### Social / profile links (backlinks)

- [ ] GitHub profile README — link to blog
- [ ] LinkedIn — add blog URL to profile
- [ ] Substack bio — link back to tanchao.xyz
- [ ] Hacker News profile — add URL field

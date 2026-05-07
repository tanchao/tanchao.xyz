# AGENTS.md — AI Agent Guide for tanchao.xyz

This file is the single source of truth for AI coding agents (Claude Code, Cursor, Copilot, etc.)
working on this codebase.

## Project overview

`tanchao.xyz` is Chao Tan's personal engineering blog. It is a static site built with:

- **Astro 6** — static site framework
- **Tailwind CSS v4** — styling (no config file; uses CSS `@theme`)
- **Cloudflare Pages** — hosting (builds on push to `main`)
- **Biome** — linting and formatting

## Directory map

```
src/
  content/
    posts/          Blog posts as Markdown/MDX (YYYY-MM-DD-slug.md)
    notes/          Short notes as Markdown/MDX
  content.config.ts Content collection schemas (Zod)
  lib/
    posts.ts        URL slug utilities, readingTime, sortedPosts helpers
  layouts/
    Base.astro      Root layout (includes Head, Header, Footer, JSON-LD)
    Post.astro      Blog post layout (prev/next, reading time, tags)
  components/
    Head.astro      <head> with SEO meta, OG, Twitter card
    Header.astro    Site nav with dark mode toggle
    Footer.astro    Footer with RSS, llms.txt, humans.txt links
    JsonLd.astro    Injects JSON-LD <script> tag
    ThemeToggle.astro Dark/light mode toggle button
  pages/
    index.astro     Homepage (posts by year)
    about.astro     Bio page
    now.astro       /now page (nownownow.com convention)
    uses.astro      Tools and tech stack
    hire-me.astro   Career page with structured data for recruiting bots
    404.astro       Not found
    posts/
      index.astro   All posts listing
      [...slug].astro Dynamic post route (/posts/YYYY/MM/DD/slug/)
    notes/
      index.astro   Notes listing
      [...slug].astro Note route
    tags/
      index.astro   All tags
      [tag].astro   Posts for a tag
    rss.xml.ts      RSS 2.0 feed
    robots.txt.ts   robots.txt (AI bots explicitly allowed)
    llms.txt.ts     llms.txt index for LLMs
    llms-full.txt.ts Full text dump of all posts
    api/
      posts.json.ts JSON API of all posts
  styles/
    global.css      Tailwind import + CSS variables for light/dark theme
public/
  _redirects        Cloudflare Pages URL redirects (preserves old Jekyll URLs)
  humans.txt
  favicon.svg
scripts/
  migrate.ts        One-time Jekyll migration script
  new-post.ts       Scaffold a new post file
  check-content.ts  Fast Zod content validation (no full Astro build needed)
```

## Content schema

Posts (`src/content/posts/`) frontmatter (all fields):

```yaml
---
title: "Post Title"          # required, max 80 chars
description: "..."           # optional but strongly recommended for SEO
date: 2024-01-15             # required, YYYY-MM-DD
updated: 2024-02-01          # optional
tags: ["career", "api"]      # optional array
draft: true                  # optional; draft posts excluded from production build
originalUrl: "https://..."   # optional; original URL if migrated from old blog
canonical: "https://..."     # optional; canonical URL if content exists elsewhere
---
```

Notes (`src/content/notes/`) frontmatter:

```yaml
---
title: "Note title"          # required
date: 2025-05-17             # required
draft: false                 # optional
---
```

## URL structure

| Content type | File pattern | Generated URL |
|---|---|---|
| Posts | `src/content/posts/YYYY-MM-DD-slug.md` | `/posts/YYYY/MM/DD/slug/` |
| Notes | `src/content/notes/slug.md` | `/notes/slug/` |
| Tags | auto | `/tags/:tag/` |

Old Jekyll URLs (`/YYYY/MM/DD/slug.html`) are 301-redirected to the new format via `public/_redirects`.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:4321
npm run build        # Production build (also runs pagefind index)
npm run preview      # Preview production build
npm run check        # Astro type check + content schema validation
npm run check:content # Fast Zod-only content validation (no build)
npm run lint         # Biome lint
npm run format       # Biome format (write)
npm run new:post -- "My Title"  # Scaffold a new post file with today's date
```

## How to add a post

1. Run `npm run new:post -- "Your Post Title"` — this creates a draft `.md` file.
2. Open the generated file in `src/content/posts/`.
3. Fill in `description` and the body.
4. Change `draft: false` when ready to publish.
5. Run `npm run check:content` to validate frontmatter.
6. Commit and push to `main`. Cloudflare Pages auto-builds.

## Constraints (never do these)

- **Never force-push to `main`**. All changes go through commits (direct push to main is fine, but no `--force`).
- **Never edit `public/_redirects` without testing** the redirect still works — this file keeps old URLs alive.
- **Never delete `src/content/posts/` files** without adding a redirect in `public/_redirects`.
- **Never add secrets or API keys** to any file tracked in git.
- **Never import server-only packages** in `.astro` frontmatter that runs client-side.
- **Slug rules**: filenames must match `YYYY-MM-DD-kebab-case-slug.md`. Never use spaces or uppercase.

## Design system

Theme variables are in `src/styles/global.css` as CSS custom properties on `:root` (light) and `.dark` (dark mode). Colors:

- `--bg`, `--bg-alt` — background shades
- `--text`, `--text-muted` — text
- `--border` — borders and dividers
- `--link`, `--link-hover` — link color (accent green)

Dark mode is toggled by adding/removing the `dark` class on `<html>`. The preference is stored in `localStorage.theme`. An inline script in `Head.astro` applies the class before first paint (no flash).

## Deploy flow

`git push origin main` → GitHub webhook → Cloudflare Pages → `npm run build` → live at https://tanchao.xyz

Preview deployments are created automatically for every branch/PR by Cloudflare Pages.

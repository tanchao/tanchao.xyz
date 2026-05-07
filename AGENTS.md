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
    projects/       Long-running projects as Markdown (slug.md, append updates over time)
  content.config.ts Content collection schemas (Zod)
  lib/
    posts.ts        URL slug utilities, readingTime, sortedPosts, sortedProjects helpers
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
    projects/
      index.astro   Projects listing (grouped by status: active → paused → completed → archived)
      [...slug].astro Project detail (Updates TOC auto-generated from ## headings)
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
functions/
  api/
    feedback.ts     CF Pages Function: Turnstile + rate-limit + GitHub Issues API
scripts/
  migrate.ts        One-time Jekyll migration script
  new-post.ts       Scaffold a new post file
  new-project.ts    Scaffold a new project file
  check-content.ts  Fast Zod content validation (no full Astro build needed)
docs/
  plans/            Internal planning documents (not rendered on site)
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

Projects (`src/content/projects/`) frontmatter:

```yaml
---
title: "Project Title"       # required, max 80 chars
description: "..."           # optional, for SEO and listing
status: active               # required: active | paused | completed | archived
started: 2026-05-06         # required, YYYY-MM-DD
updated: 2026-05-13         # optional, YYYY-MM-DD — update when you add a new entry
tags: ["ml", "snowflake"]   # optional
repo: "https://github.com/..." # optional
link: "https://..."          # optional
draft: false                 # optional
---
```

Body convention for projects: append `## YYYY-MM-DD — update title` sections over time. These h2 headings auto-generate the Updates TOC and each gets an anchor permalink.

## URL structure

| Content type | File pattern | Generated URL |
|---|---|---|
| Posts | `src/content/posts/YYYY-MM-DD-slug.md` | `/posts/YYYY/MM/DD/slug/` |
| Notes | `src/content/notes/slug.md` | `/notes/slug/` |
| Projects | `src/content/projects/slug.md` | `/projects/slug/` |
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
npm run new:post -- "My Title"     # Scaffold a new post file with today's date
npm run new:project -- "My Project" # Scaffold a new project file
```

## How to add a post

1. Run `npm run new:post -- "Your Post Title"` — this creates a draft `.md` file.
2. Open the generated file in `src/content/posts/`.
3. Fill in `description` and the body.
4. Change `draft: false` when ready to publish.
5. Run `npm run check:content` to validate frontmatter.
6. Commit, push branch, and open a PR. Cloudflare Pages auto-builds on merge to `main`.

## How to add / update a project

1. Run `npm run new:project -- "Your Project Title"` — creates `src/content/projects/<slug>.md` with `draft: true`.
2. Fill in `description`, set tags, optionally add `repo` / `link`.
3. Write the body: start with a `## Overview` section, then dated update entries.
4. Set `draft: false` when ready to publish.
5. To add a new update later: append a new `## YYYY-MM-DD — update title` section and bump `updated:` in the frontmatter.
6. Run `npm run check:content`, commit, push branch, and open a PR.

## Git workflow

`main` is the default and production branch. It has branch protection rules:

- All changes **must** go through a pull request (direct push to `main` is rejected).
- A required status check (`build`) must pass before merge.

### Before making changes

1. **Pull latest `main`**: `git pull origin main`.
2. **Check current branch**: If you're already on a feature branch, check if it has an open PR (`gh pr view`). If the PR is merged, do NOT reuse the branch — create a new one from `main`.
3. **Create a new branch** from `main` for each change: `git checkout -b <type>/<short-description>`.

### Submitting changes

1. Commit on the feature branch.
2. Push: `git push -u origin HEAD`.
3. Create a PR: `gh pr create --title "..." --body "..."`.
4. **Stay on the feature branch** — do NOT switch back to `main`. Let the user switch when ready.
5. Wait for CI (`build` check) to pass, then merge.

### Rules

- **Never push directly to `main`** — it will be rejected by branch protection.
- **Never force-push to `main`**.
- **Never reuse a merged branch** — always create a fresh branch from up-to-date `main`.
- **Never auto-switch to `main` after creating a PR** — stay on the working branch so the user can see the changes in their editor.
- **One logical change per PR** — keep PRs small and focused.

## Constraints (never do these)

- **Never edit `public/_redirects` without testing** the redirect still works — this file keeps old URLs alive.
- **Never delete `src/content/posts/` files** without adding a redirect in `public/_redirects`.
- **Never add secrets or API keys** to any file tracked in git.
- **Never import server-only packages** in `.astro` frontmatter that runs client-side.
- **Slug rules**: filenames must match `YYYY-MM-DD-kebab-case-slug.md`. Never use spaces or uppercase.
- **Never modify `.github/workflows/claude-agent.yml`**, `functions/api/feedback.ts`, or any secrets/environment variables. These define the trust boundary for automated agents.

## Design system

Theme variables are in `src/styles/global.css` as CSS custom properties on `:root` (light) and `.dark` (dark mode). Colors:

- `--bg`, `--bg-alt` — background shades
- `--text`, `--text-muted` — text
- `--border` — borders and dividers
- `--link`, `--link-hover` — link color (accent green)

Dark mode is toggled by adding/removing the `dark` class on `<html>`. The preference is stored in `localStorage.theme`. An inline script in `Head.astro` applies the class before first paint (no flash).

## Deploy flow

Merge PR to `main` → GitHub webhook → Cloudflare Pages → `npm run build` → live at https://tanchao.xyz

Preview deployments are created automatically for every branch/PR by Cloudflare Pages.

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
    feedback.astro  Feedback form (pairs with functions/api/feedback.ts)
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
  favicon.ico
  favicon-32.png
  favicon-512.png
  apple-touch-icon.png
  og-default.png
functions/
  api/
    feedback.ts     CF Pages Function: Turnstile + rate-limit + GitHub Issues API
scripts/
  migrate.ts        One-time Jekyll migration script
  new-post.ts       Scaffold a new post file
  new-project.ts    Scaffold a new project file
  sync-substack.ts  Fetch Substack RSS and write notes to src/content/notes/
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
tldr: "..."                  # optional; one-sentence summary for GEO extraction
faq:                         # optional; pillar posts — renders FAQ + FAQPage JSON-LD
  - q: "Question?"
    a: "Direct answer."
date: 2024-01-15             # required, YYYY-MM-DD
updated: 2024-02-01          # optional
tags: ["career", "api"]      # optional array
draft: true                  # optional; draft posts excluded from production build
originalUrl: "https://..."   # optional; original URL if migrated from old blog
canonical: "https://..."     # optional; canonical URL if content exists elsewhere
image: "/path/to/image.png"  # optional; OG image override for this post
---
```

Notes (`src/content/notes/`) frontmatter:

```yaml
---
title: "Note title"          # required
date: 2025-05-17             # required
draft: false                 # optional
source: substack             # optional; set by sync-substack.ts — do not set manually
sourceUrl: "https://..."     # optional; original URL on the source platform
sourceId: "abc123"           # optional; platform-specific ID for deduplication
---
```

Syndicated notes (imported from Substack via `npm run sync:substack`) have `source`, `sourceUrl`, and `sourceId` set automatically. Do not set these fields on hand-written notes.

Projects (`src/content/projects/`) frontmatter:

```yaml
---
title: "Project Title"       # required, max 80 chars
description: "..."           # optional, for SEO and listing
status: active               # optional, defaults to "active": active | paused | completed | archived
started: 2026-05-06         # required, YYYY-MM-DD
updated: 2026-05-13         # optional, YYYY-MM-DD — update when you add a new entry
tags: ["ml", "snowflake"]   # optional, defaults to []
repo: "https://github.com/..." # optional, must be a valid URL when set
link: "https://..."          # optional, must be a valid URL when set
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
npm run sync:substack               # Fetch Substack RSS and import new notes (also runs nightly via CI)
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

## Editorial stance and voice

When writing or editing content for `src/content/**`, treat `tanchao.xyz` as a personal engineering blog: professional notes from an experienced builder and operator, not academic writing, vendor marketing, or SEO filler.

### Default lens

- Write from an engineer's point of view: systems, controls, evidence, failure modes, drift, trade-offs, and operating reality.
- The implied author stance is a staff-level software engineer who has owned production systems, reliability, data protection, governance, and performance work.
- Let the content prove authority. Do not add self-justifying sections whose real purpose is to argue that the framework, taxonomy, or author is credible.

### Tone

- Use clean, simple language. Prefer short paragraphs, direct verbs, and high-signal sections.
- Sound calm, precise, and opinionated in a grounded way.
- Use first person sparingly. It should anchor perspective, not sell credentials.
- The target reader impression is: this person has operated in this area, has a solid point, and is probably right.

### What to emphasize

- Prefer concrete discussion of controls, verification, logs, evidence, drift, and operational gaps.
- Prefer "what actually happens in production" over abstract control maps or marketecture.
- For overview or pillar posts, keep them scannable and lighter-weight. Push detail into linked deep-dives instead of overloading the top-level piece.

### Titles and framing

- Prefer plain, direct titles. Good patterns: `How ...`, `What ...`, `Where ...`, or a clear subject-only title.
- Let the `description` carry the framing such as "short, practical overview" or "field guide."
- Avoid terms like `survey`, `taxonomy`, `framework`, `comprehensive`, `definitive`, or `some thoughts on` unless they are clearly the best wording for the piece.
- Avoid sections like "why this taxonomy is the right one" or other wording that tries to self-prove the argument. The content itself should do that work.

### GEO (Generative Engine Optimization)

Structure content so AI systems can cite it accurately. See `docs/plans/geo.md` for the full plan and `docs/plans/geo-tracking.md` for measurement.

- **Answer capsule** — first paragraph answers the title in 40–60 words, definition-lead (`X is ...`).
- **Atomic H2s** — each `## section` opens with a self-contained 40–100 word paragraph that fully answers the heading without surrounding context.
- **Citation density** — on long-form posts, aim for one hyperlinked citation to a primary source (NIST, RFC, vendor docs, peer-reviewed studies) per ~150–200 words.
- **Named entities** — include 3+ named entities (products, people, standards, version numbers, dates) per paragraph you want extracted.
- **FAQ blocks** — pillar posts: 5–7 `faq` items in frontmatter (see schema below). Short questions, direct answers.
- **Freshness** — refresh `updated:` on evergreen posts at least quarterly when content still applies.
- **Series linking** — when a post belongs to a series, add a top-of-post block internal-linking sibling posts.

Optional post frontmatter for GEO:

```yaml
tldr: "One-sentence summary for extraction."
faq:
  - q: "Short question?"
    a: "Direct, citable answer."
```

## Git workflow

### Branch protection

`main` is the default and production branch. Branch protection enforces:

- All changes **must** go through a pull request (direct push is rejected).
- Required status check: `build` must pass before merge.
- No force-push allowed.

### Branch naming

Use prefixed branch names: `<type>/<short-kebab-description>`

| Prefix | Use for |
|--------|---------|
| `feat/` | New features or pages |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, config, dependency updates |
| `docs/` | Documentation-only changes |
| `refactor/` | Code restructuring without behavior change |

### Starting work

1. **Check current branch state first**:
   - Run `git branch` to see where you are.
   - If on a feature branch, run `gh pr view` to check if it has a PR and whether it's merged.
   - If the PR is merged or closed, switch to `main` — never reuse a merged branch.
2. **Sync main**: `git checkout main && git pull origin main`.
3. **Create a new branch**: `git checkout -b <type>/<short-description>`.

### Committing

- Write commit messages that explain **why**, not what (the diff shows what).
- First line: imperative mood, max ~72 chars (e.g., "Fix Turnstile using test key in production").
- Optional body after blank line for context, separated reasoning, or references.
- Keep commits atomic — one logical change per commit.
- Reference issues when relevant: `Closes #N` or `Fixes #N`.

### Submitting a PR

1. Push: `git push -u origin HEAD`.
2. Create PR: `gh pr create --title "..." --body "..."`.
3. **Stay on the feature branch** — do NOT switch back to `main`. The user's editor shows the branch files; switching reverts them and causes confusion.
4. Wait for CI to pass. If it fails, fix on the same branch and push again.

### After PR is created

- If you need to make follow-up changes to the **same** PR: commit and push to the same branch.
- If you need to make an **unrelated** change: ask the user first, or create a new branch from `main`.
- Never pile unrelated changes into an existing PR.

### After PR is merged

- Do NOT auto-clean-up. Let the user decide when to switch back to `main`.
- When starting new work, go back to "Starting work" above.

### Rules (hard constraints)

- **Never push directly to `main`** — branch protection will reject it.
- **Never force-push** to any shared branch.
- **Never reuse a merged branch** — always create a fresh branch from up-to-date `main`.
- **Never auto-switch to `main`** after creating/pushing — stay on the working branch.
- **Never amend or rebase commits that have been pushed** unless explicitly asked.
- **One logical change per PR** — if a task involves unrelated changes, split into separate PRs.

### Pre-push checklist

Before pushing, verify locally where applicable:

- `npm run check:content` — if content files were modified
- `npm run build` — if templates, components, or config were modified
- `npm run lint` — if any source file was modified

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

## Cloudflare Pages — environment variables

Understanding the two env contexts prevents a common class of bugs:

| Context | Set via | Visible to |
|---------|---------|------------|
| **Build-time** (`PUBLIC_*` vars) | CF Pages dashboard → Settings → Environment variables, or `wrangler.toml` | Astro templates and static HTML (baked in at build) |
| **Runtime** (Pages Functions) | CF Pages dashboard → Settings → Environment variables (as secrets) | `functions/api/*.ts` only — never baked into HTML |

**Key rules:**
- `PUBLIC_*` variables (e.g. `PUBLIC_TURNSTILE_SITE_KEY`) are embedded in HTML at build time. Changing them requires a redeploy.
- Secrets for Pages Functions (`TURNSTILE_SECRET`, `GITHUB_TOKEN`, `KV_RATE_LIMIT` binding) are set in the CF dashboard and never go in `wrangler.toml` or git.
- After changing any binding or environment variable in the CF dashboard, trigger a **manual redeploy** — existing deployments do not pick up the change automatically.
- `wrangler.toml` configures KV namespace IDs and compatibility settings only. Do not put secret values there.

## Cursor rules

Project-local Cursor rules live under `.cursor/rules/`:

- `blog.mdc` — always-applied global rules pointing agents to this file
- `content.mdc` — rules scoped to `src/content/**` files (frontmatter conventions)

These rules are applied automatically by Cursor and do not need to be invoked manually. AGENTS.md is the authoritative source; the rules files summarize the most critical points.

## Deploy flow

Merge PR to `main` → GitHub webhook → Cloudflare Pages → `npm run build` → live at https://tanchao.xyz

Preview deployments are created automatically for every branch/PR by Cloudflare Pages.

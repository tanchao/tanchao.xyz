# Projects Content Type

Status: **done**
Created: 2026-05-06
Implemented: 2026-05-06

## Motivation

Posts are one-shot. Notes are short. Projects are long-running work that accumulates updates over time — e.g. "Customize OpenAI's privacy-filter model with Snowflake semantic_categories as target, then eval."

## Design decisions

- **Single Markdown file per project** (not a folder with separate update files)
- **Status enum**: `active` | `paused` | `completed` | `archived`
- **Updates live as timestamped `## ` headings** within the single file — append new sections at the bottom
- **No standalone URLs for individual updates** — the project page shows all updates in chronological order
- **Not in RSS feed** — projects are only accessible via `/projects/`
- **Not on homepage** — separate section in nav

## URL structure

| Page | URL |
|------|-----|
| Projects index | `/projects/` |
| Individual project | `/projects/<slug>/` |

## Schema (content collection)

File location: `src/content/projects/<slug>.md`

```yaml
---
title: "Privacy Filter Model Customization"    # required, max 80 chars
description: "Fine-tune OpenAI's model..."     # optional, for SEO/listing
status: active                                  # required: active | paused | completed | archived
started: 2026-05-01                            # required (renamed from startDate)
updated: 2026-06-15                            # optional (renamed from endDate)
tags: ["ml", "snowflake", "privacy"]           # optional
repo: "https://github.com/..."                 # optional URL
link: "https://..."                            # optional URL
draft: false                                   # optional
---
```

> Note: implemented as `started`/`updated` (not `startDate`/`endDate`) to align with the posts/notes pattern.

Zod schema in `src/content.config.ts`:

```typescript
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string().max(80),
    description: z.string().optional(),
    status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
    started: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    repo: z.string().url().optional(),
    link: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});
```

## File structure (body convention)

```markdown
---
title: "Privacy Filter Model"
status: active
started: 2026-05-01
tags: ["ml", "snowflake"]
---

Brief overview of the project goal and approach.

## 2026-05-01 — Kickoff

Initial research, gathered Snowflake semantic_categories docs...

## 2026-05-05 — First training run

Set up fine-tuning pipeline, baseline results...

## 2026-05-10 — Eval results

Precision/recall on test set, comparison to baseline...
```

## Pages to create

### `/projects/` — Index page

`src/pages/projects/index.astro`

- List all non-draft projects grouped by status (active first, then paused, completed, archived)
- Show title, description, status badge, start date, tag chips
- Similar layout to `/posts/` but with status grouping

### `/projects/<slug>/` — Detail page

`src/pages/projects/[...slug].astro`

- Show project metadata (status badge, date range, tags)
- Render the full Markdown body (all updates in order)
- Optional: TOC generated from `## ` headings (the date-stamped updates)

## Navigation

Add "Projects" link to `Header.astro` nav, between "Posts" and "Notes" (or after Notes).

## Scaffolding script

Add `npm run new:project -- "Project Title"` that creates:

```
src/content/projects/project-title.md
```

With frontmatter pre-filled (status: active, started: today, draft: true).

Update `scripts/new-post.ts` or create `scripts/new-project.ts`.

Add to `package.json`:
```json
"new:project": "npx tsx scripts/new-project.ts"
```

## Implementation checklist

- [x] Add `projects` collection to `src/content.config.ts`
- [x] Create `src/content/projects/` directory
- [x] Create `src/pages/projects/index.astro` (grouped by status, status badges, tag pills)
- [x] Create `src/pages/projects/[...slug].astro` (Updates TOC from h2 headings, `CreativeWork` JSON-LD)
- [x] Add "Projects" to `Header.astro` nav (between Posts and Notes)
- [x] Create `scripts/new-project.ts`
- [x] Add `new:project` script to `package.json`
- [x] Create first project: `src/content/projects/privacy-filter-customization.md`
- [x] Update `scripts/check-content.ts` to validate projects
- [x] Verified with `npm run check:content` and `npm run dev`

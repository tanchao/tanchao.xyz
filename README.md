# tanchao.xyz

My personal engineering blog — and a quick way to get to know the person behind it. Live at **[tanchao.xyz](https://tanchao.xyz)**.

Built with [Astro 6](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com), deployed on [Cloudflare Pages](https://pages.cloudflare.com).

## Who I am

I'm **Chao Tan** (谭超) — call me Chao or `tc`. I've been building software since 2004, across four companies and three countries.

- **Now** — data governance & privacy engineer at [Snowflake](https://snowflake.com). I built the data classification platform that discovers and tags sensitive data across customer accounts.
- **Before** — six years at Amazon as a tech lead on Alexa's cloud platform: APIs at hundreds of millions of requests a day, a 14-person team, and the backend for Amazon's Astro robot built from scratch.
- **Earlier** — eBay and HSBC. Three pending patents. Father of two. Art, food, basketball, swimming, skiing.

What I care about: long-term value over short-term velocity, automation over process, first principles before tools, and `SDE = Somebody Do Everything` — own the outcome, not just the code.

Fuller story on the [about page](https://tanchao.xyz/about/).

### Find me

| Where | Link |
|---|---|
| Site | [tanchao.xyz](https://tanchao.xyz) |
| GitHub | [@tanchao](https://github.com/tanchao) |
| Twitter/X | [@chaostan](https://twitter.com/chaostan) |
| LinkedIn | [in/tanchao](https://www.linkedin.com/in/tanchao) |
| Substack | [@sprtn](https://substack.com/@sprtn) |
| Email | chaos.tc@gmail.com |

## What I write about

Data governance and privacy, AI system security, performance engineering, API design, and the engineering career — field notes from someone who has owned production systems at scale, not tutorials or vendor takes.

## Quick start

```bash
npm install
npm run dev       # http://localhost:4321
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (+ Pagefind index) |
| `npm run preview` | Preview production build locally |
| `npm run check` | Astro type check |
| `npm run check:content` | Fast frontmatter validation |
| `npm run lint` | Biome lint |
| `npm run format` | Biome format (write) |
| `npm run new:post -- "Title"` | Scaffold a new post |

## Writing posts

```bash
npm run new:post -- "My Post Title"
# Creates: src/content/posts/YYYY-MM-DD-my-post-title.md (draft:true)
# URL will be: /posts/YYYY/MM/DD/my-post-title/
```

Edit the file, change `draft: false` when ready. Push to `main` to deploy.

## Stack

- **Astro 6** — static site framework with content collections
- **Tailwind CSS v4** — utility-first CSS
- **expressive-code** — syntax highlighting
- **Pagefind** — static full-text search
- **Biome** — fast linter + formatter
- **Cloudflare Pages** — hosting and CDN

## AI agents

See [AGENTS.md](./AGENTS.md) for the complete guide for AI coding assistants (Cursor, Claude Code, etc.).

## Deployment

Push to `main` → Cloudflare Pages auto-builds and deploys to https://tanchao.xyz.

Build settings:
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22

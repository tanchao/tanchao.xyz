# tanchao.xyz

Chao Tan's personal engineering blog. Built with [Astro 6](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com), deployed on [Cloudflare Pages](https://pages.cloudflare.com).

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

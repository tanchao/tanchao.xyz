#!/usr/bin/env tsx
/**
 * Fast Zod-only content validation without running full Astro check.
 * Run: npm run check:content
 */

import { execFileSync } from "node:child_process";
import { z } from "zod";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const postSchema = z.object({
  title: z.string().max(80),
  description: z.string().optional(),
  tldr: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  originalUrl: z.string().optional(),
  canonical: z.string().optional(),
  image: z.string().optional(),
});

const noteSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
});

// `sources` is a multi-line YAML array of objects; the lightweight parser in
// this file can't represent it, so it's validated by Astro at build time only.
const pulseSchema = z.object({
  title: z.string().max(120),
  description: z.string().optional(),
  tldr: z.string().optional(),
  date: z.coerce.date(),
  week: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

const projectSchema = z.object({
  title: z.string().max(80),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  started: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  repo: z.string().url().optional(),
  link: z.string().url().optional(),
  draft: z.boolean().default(false),
});

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      let val: unknown = rest
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");
      if (val === "true") val = true;
      if (val === "false") val = false;
      if (typeof val === "string" && val.startsWith("[")) {
        try {
          val = JSON.parse(val.replace(/'/g, '"'));
        } catch {}
      }
      fm[key.trim()] = val;
    }
  }
  return fm;
}

// Anti-AI-isms from docs/voice.md §6 — deterministic, advisory (warnings only,
// never fail the build). The LLM judge (`npm run check:editorial`) handles the
// qualitative axes; this just flags the cheap, unambiguous tells.
const BLACKLIST = [
  "delve",
  "tapestry",
  "utilize",
  "it's important to note that",
  "in today's fast-paced world",
  "unlock the power of",
  "game-changer",
  "at the end of the day",
];

let errors = 0;
let warnings = 0;

// Scope the prose scan to posts changed vs origin/main — the point is to catch
// tells in new drafts, not relitigate pre-2025 posts (see docs/voice.md §3).
function changedPostFiles(): string[] {
  const run = (args: string[]) => {
    try {
      return execFileSync("git", args, { encoding: "utf-8" }).split("\n");
    } catch {
      return [];
    }
  };
  const committed = run(["diff", "--name-only", "origin/main", "--", "src/content/posts"]);
  const untracked = run(["ls-files", "--others", "--exclude-standard", "--", "src/content/posts"]);
  const set = new Set(
    [...committed, ...untracked].filter((f) => f.endsWith(".md") || f.endsWith(".mdx")),
  );
  return [...set].map((f) => join(process.cwd(), f));
}

function scanProse() {
  for (const file of changedPostFiles()) {
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue; // deleted or renamed
    }
    const body = content.replace(/^---\n[\s\S]*?\n---/, "").toLowerCase();
    const hits = BLACKLIST.filter((term) => body.includes(term));
    if (hits.length) {
      console.warn(`⚠️  posts/${basename(file)}: possible anti-AI-isms — ${hits.join(", ")}`);
      warnings += hits.length;
    }
  }
}

function checkDir(dir: string, schema: z.ZodObject<z.ZodRawShape>, label: string) {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
  } catch {
    return; // dir doesn't exist yet
  }
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    const fm = parseFrontmatter(content);
    const result = schema.safeParse(fm);
    if (!result.success) {
      console.error(`❌ ${label}/${file}:`);
      for (const issue of result.error.issues) {
        console.error(`   ${issue.path.join(".")}: ${issue.message}`);
      }
      errors++;
    }
  }
}

checkDir(
  join(process.cwd(), "src/content/posts"),
  postSchema as z.ZodObject<z.ZodRawShape>,
  "posts",
);
checkDir(
  join(process.cwd(), "src/content/notes"),
  noteSchema as z.ZodObject<z.ZodRawShape>,
  "notes",
);
checkDir(
  join(process.cwd(), "src/content/projects"),
  projectSchema as z.ZodObject<z.ZodRawShape>,
  "projects",
);
checkDir(
  join(process.cwd(), "src/content/pulse"),
  pulseSchema as z.ZodObject<z.ZodRawShape>,
  "pulse",
);

scanProse();

// Internal link check. A published post linking to a draft or missing page ships
// a 404 into the live site, RSS, and llms-full.txt. Only published entries are
// scanned, and only published targets count as resolvable: a draft linking to a
// draft is fine, since neither is built.
const COLLECTION_DIRS = ["posts", "notes", "projects", "pulse"] as const;

function entryUrl(collection: string, file: string): string {
  const slug = file.replace(/\.mdx?$/, "");
  if (collection === "posts") {
    const m = slug.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
    if (m) return `/posts/${m[1]}/${m[2]}/${m[3]}/${m[4]}/`;
  }
  return `/${collection}/${slug}/`;
}

/** Routes from src/pages, so new pages register themselves without edits here. */
function staticRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith(".astro") || entry.name.includes("[")) continue;
      routes.add(
        entry.name === "index.astro" ? prefix : `${prefix}${entry.name.replace(/\.astro$/, "")}/`,
      );
    }
  };
  walk(join(process.cwd(), "src/pages"), "/");
  return routes;
}

function checkInternalLinks() {
  const published: { collection: string; file: string; body: string; url: string }[] = [];
  const valid = staticRoutes();

  for (const collection of COLLECTION_DIRS) {
    const dir = join(process.cwd(), "src/content", collection);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
    } catch {
      continue;
    }
    for (const file of files) {
      const content = readFileSync(join(dir, file), "utf-8");
      const fm = parseFrontmatter(content);
      if (fm.draft === true) continue;
      const url = entryUrl(collection, file);
      valid.add(url);
      for (const tag of Array.isArray(fm.tags) ? fm.tags : []) {
        valid.add(`/tags/${String(tag).toLowerCase()}/`);
      }
      published.push({
        collection,
        file,
        url,
        body: content.replace(/^---\n[\s\S]*?\n---/, ""),
      });
    }
  }

  for (const entry of published) {
    const found = new Set<string>();
    for (const re of [/\]\((\/[^)\s"]*)\)/g, /href="(\/[^"]*)"/g]) {
      for (const m of entry.body.matchAll(re)) found.add(m[1]);
    }
    for (const raw of found) {
      const path = raw.split("#")[0].split("?")[0];
      if (!path || path === "/") continue;
      // Files (assets, generated endpoints) are served as-is, not as routes.
      if (/\.[a-z0-9]+$/i.test(path)) continue;
      const normalized = path.endsWith("/") ? path : `${path}/`;
      if (valid.has(normalized)) continue;
      console.error(
        `❌ ${entry.collection}/${entry.file}: internal link does not resolve to a published page — ${raw}`,
      );
      errors++;
    }
  }
}

checkInternalLinks();

if (errors === 0) {
  if (warnings > 0) {
    console.log(`✅ All content validated (${warnings} prose warning(s) above — advisory).`);
  } else {
    console.log("✅ All content validated successfully.");
  }
} else {
  console.error(`\n${errors} file(s) failed validation.`);
  process.exit(1);
}

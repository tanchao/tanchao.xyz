#!/usr/bin/env tsx
/**
 * Migration script: converts Jekyll posts from tanchao.github.io into
 * Astro-compatible MDX files for tanchao.xyz.
 *
 * Usage: npx tsx scripts/migrate.ts
 *
 * Reads:  ../tanchao.github.io/_posts/*.md
 * Writes: src/content/posts/*.md  (skips if file already exists)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const SRC_DIR = join(process.cwd(), "../tanchao.github.io/_posts");
const DEST_DIR = join(process.cwd(), "src/content/posts");

// Posts to skip (already in new repo with better content)
const SKIP = new Set([
  "2016-07-02-hihi.md",       // placeholder
  "2021-07-31-tech-records.md", // better version already in new repo
  "2021-12-26-bio.md",        // merged into /about
  "2021-12-26-resume.md",     // merged into /hire-me
]);

// Existing posts in new repo (check for duplicates)
const EXISTING_NEW = new Set(
  readdirSync(DEST_DIR).filter(f => f.endsWith(".md") || f.endsWith(".mdx"))
);

function parseFrontmatter(content: string): { fm: Record<string, string | string[]>, body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };
  const fm: Record<string, string | string[]> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    fm[key] = val;
  }
  return { fm, body: match[2].trim() };
}

function buildFrontmatter(fm: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(s => `"${s}"`).join(", ")}]`);
    } else if (typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function inferDescription(body: string): string {
  const stripped = body
    .replace(/^#.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .trim();
  const firstPara = stripped.split(/\n\n/)[0]?.trim() ?? "";
  return firstPara.slice(0, 160).replace(/\n/g, " ");
}

let migrated = 0;
let skipped = 0;

const files = readdirSync(SRC_DIR).filter(f => f.endsWith(".md"));

for (const file of files) {
  if (SKIP.has(file)) {
    console.log(`⏭  Skip (excluded): ${file}`);
    skipped++;
    continue;
  }

  const destFile = file; // keep same filename
  if (EXISTING_NEW.has(destFile)) {
    console.log(`⏭  Skip (exists in new repo): ${file}`);
    skipped++;
    continue;
  }

  const content = readFileSync(join(SRC_DIR, file), "utf-8");
  const { fm, body } = parseFrontmatter(content);

  // Parse date from filename
  const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : fm.date ?? "2020-01-01";

  // Build tags from both tags and categories
  const rawTags = String(fm.tags ?? "").split(/[\s,]+/).filter(Boolean);
  const rawCats = String(fm.categories ?? "").split(/[\s,]+/).filter(Boolean);
  const tags = [...new Set([...rawTags, ...rawCats])].filter(
    t => t !== "supertan" && t.length > 1
  );

  const description = fm.description
    ? String(fm.description)
    : inferDescription(body);

  const newFm: Record<string, unknown> = {
    title: fm.title ?? basename(file, ".md"),
    ...(description ? { description: description.slice(0, 160) } : {}),
    date,
    tags: tags.length ? tags : undefined,
    originalUrl: `https://tanchao.github.io${
      `/${date.replace(/-/g, "/").replace(/(\d{4})\/(\d{2})\/(\d{2})/, "$1/$2/$3")}/${
        file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "")
      }.html`
    }`,
  };

  // Remove undefined
  for (const k of Object.keys(newFm)) {
    if (newFm[k] === undefined) delete newFm[k];
  }

  // Remove Jekyll-ism from body: `{{ page.title }}\n================`
  const cleanBody = body
    .replace(/\{\{ page\.\w+ \}\}\n={3,}\n?/g, "")
    .replace(/\{\{ page\.\w+ \}\}/g, "")
    .trim();

  const output = `${buildFrontmatter(newFm)}\n\n${cleanBody}\n`;
  writeFileSync(join(DEST_DIR, destFile), output, "utf-8");
  console.log(`✅ Migrated: ${file}`);
  migrated++;
}

console.log(`\nDone. ${migrated} migrated, ${skipped} skipped.`);

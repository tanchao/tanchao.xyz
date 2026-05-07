#!/usr/bin/env tsx
/**
 * Fast Zod-only content validation without running full Astro check.
 * Run: npm run check:content
 */

import { z } from "zod";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const postSchema = z.object({
  title: z.string().max(80),
  description: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  originalUrl: z.string().optional(),
  canonical: z.string().optional(),
});

const noteSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
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
      let val: unknown = rest.join(":").trim().replace(/^["']|["']$/g, "");
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

let errors = 0;

function checkDir(dir: string, schema: z.ZodObject<z.ZodRawShape>, label: string) {
  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".md") || f.endsWith(".mdx"));
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

checkDir(join(process.cwd(), "src/content/posts"), postSchema as z.ZodObject<z.ZodRawShape>, "posts");
checkDir(join(process.cwd(), "src/content/notes"), noteSchema as z.ZodObject<z.ZodRawShape>, "notes");
checkDir(join(process.cwd(), "src/content/projects"), projectSchema as z.ZodObject<z.ZodRawShape>, "projects");

if (errors === 0) {
  console.log("✅ All content validated successfully.");
} else {
  console.error(`\n${errors} file(s) failed validation.`);
  process.exit(1);
}

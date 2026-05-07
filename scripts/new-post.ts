#!/usr/bin/env tsx
/**
 * Usage: npm run new:post -- "My Post Title"
 * Creates a new dated MDX file in src/content/posts/ with proper frontmatter.
 */

import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const title = process.argv.slice(2).join(" ");
if (!title) {
  console.error("Usage: npm run new:post -- \"My Post Title\"");
  process.exit(1);
}

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");

const slug = title
  .toLowerCase()
  .replace(/[^\w\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-")
  .trim();

const filename = `${year}-${month}-${day}-${slug}.md`;
const filepath = join(process.cwd(), "src", "content", "posts", filename);

if (existsSync(filepath)) {
  console.error(`File already exists: ${filepath}`);
  process.exit(1);
}

const template = `---
title: "${title}"
description: ""
date: ${year}-${month}-${day}
tags: []
draft: true
---

Write your post here.
`;

writeFileSync(filepath, template, "utf-8");
console.log(`Created: ${filepath}`);
console.log(`URL will be: /posts/${year}/${month}/${day}/${slug}/`);

#!/usr/bin/env tsx
/**
 * Usage: npm run new:project -- "My Project Title"
 * Creates a new project file in src/content/projects/ with frontmatter and a starter update.
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const title = process.argv.slice(2).join(" ");
if (!title) {
  console.error('Usage: npm run new:project -- "My Project Title"');
  process.exit(1);
}

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");
const dateStr = `${year}-${month}-${day}`;

const slug = title
  .toLowerCase()
  .replace(/[^\w\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-")
  .trim();

const dir = join(process.cwd(), "src", "content", "projects");
mkdirSync(dir, { recursive: true });

const filepath = join(dir, `${slug}.md`);
if (existsSync(filepath)) {
  console.error(`File already exists: ${filepath}`);
  process.exit(1);
}

const template = `---
title: "${title}"
description: ""
status: active
started: ${dateStr}
tags: []
draft: true
---

## Overview

Goal, scope, and success criteria.

---

## ${dateStr} — kickoff

Initial notes.
`;

writeFileSync(filepath, template, "utf-8");
console.log(`Created: ${filepath}`);
console.log(`URL will be: /projects/${slug}/`);

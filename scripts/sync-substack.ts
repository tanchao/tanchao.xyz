#!/usr/bin/env tsx
/**
 * Usage:
 *   npm run sync:substack             # fetch and write new notes
 *   npm run sync:substack -- --dry-run  # preview what would be written
 *
 * Fetches your public Substack Notes via the unofficial reader API
 * (https://substack.com/api/v1/reader/feed/profile/<userId>), converts
 * the ProseMirror body_json to Markdown, and writes new files into
 * src/content/notes/substack-<id>.md. Idempotent — existing files are
 * never overwritten.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PROFILE_ID = 36083884; // substack.com/@sprtn
const HANDLE = "sprtn";
const API_BASE = `https://substack.com/api/v1/reader/feed/profile/${PROFILE_ID}`;
const NOTES_DIR = join(process.cwd(), "src", "content", "notes");
const PAGE_SIZE = 25;
const MIN_BODY_LENGTH = Number(process.env.MIN_BODY_LENGTH ?? 0);
const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) {
  console.log("[dry-run] No files will be written.\n");
}

// ---------------------------------------------------------------------------
// ProseMirror JSON → Markdown
// Based on the ProseMirror schema used by Substack notes.
// ---------------------------------------------------------------------------
type PMNode = {
  type: string;
  text?: string;
  content?: PMNode[];
  marks?: PMMark[];
  attrs?: Record<string, unknown>;
};

type PMMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

function marksWrap(text: string, marks: PMMark[] = []): string {
  let out = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "strong":
      case "bold":
        out = `**${out}**`;
        break;
      case "em":
      case "italic":
        out = `_${out}_`;
        break;
      case "code":
        out = `\`${out}\``;
        break;
      case "link": {
        const href = mark.attrs?.href ?? "";
        out = `[${out}](${href})`;
        break;
      }
    }
  }
  return out;
}

function pmNodeToMd(node: PMNode, depth = 0): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(n => pmNodeToMd(n, depth)).join("\n\n");

    case "paragraph": {
      if (!node.content || node.content.length === 0) return "";
      return (node.content ?? []).map(n => pmNodeToMd(n, depth)).join("");
    }

    case "text":
      return marksWrap(node.text ?? "", node.marks);

    case "hardBreak":
      return "\\\n";

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const hashes = "#".repeat(level);
      const inner = (node.content ?? []).map(n => pmNodeToMd(n, depth)).join("");
      return `${hashes} ${inner}`;
    }

    case "bulletList":
      return (node.content ?? [])
        .map(item => pmNodeToMd(item, depth))
        .join("\n");

    case "orderedList": {
      return (node.content ?? [])
        .map((item, i) => pmNodeToMd(item, depth).replace(/^- /, `${i + 1}. `))
        .join("\n");
    }

    case "listItem": {
      const inner = (node.content ?? []).map(n => pmNodeToMd(n, depth)).join("\n");
      return `- ${inner.replace(/\n/g, "\n  ")}`;
    }

    case "blockquote": {
      const inner = (node.content ?? []).map(n => pmNodeToMd(n, depth)).join("\n\n");
      return inner
        .split("\n")
        .map(l => `> ${l}`)
        .join("\n");
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const inner = (node.content ?? []).map(n => pmNodeToMd(n)).join("");
      return `\`\`\`${lang}\n${inner}\n\`\`\``;
    }

    case "image": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      return `![${alt}](${src})`;
    }

    case "horizontalRule":
      return "---";

    default:
      // Unknown node — try to render children, fallback to empty string
      if (node.content) {
        return (node.content ?? []).map(n => pmNodeToMd(n, depth)).join("");
      }
      return node.text ?? "";
  }
}

// ---------------------------------------------------------------------------
// Substack API types (partial)
// ---------------------------------------------------------------------------
type SubstackComment = {
  id: number;
  body: string;
  body_json: PMNode;
  date: string;
  type: string;
  attachments?: unknown[];
};

type SubstackItem = {
  entity_key: string;
  type: string;
  context: {
    type: string;
    timestamp: string;
  };
  comment: SubstackComment;
};

type FeedPage = {
  items: SubstackItem[];
  nextCursor?: string;
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2_000;

// Optional Substack auth cookie. From a residential IP, the unauthenticated
// reader API works fine. From GitHub Actions runners, Cloudflare's bot
// management blocks the data-center IP regardless of User-Agent. Sending a
// valid `substack.sid` (and optionally other Substack cookies) typically
// bypasses the block because authenticated requests are exempt from
// IP-reputation scoring. Set via the SUBSTACK_COOKIE env var / GH secret.
const SUBSTACK_COOKIE = process.env.SUBSTACK_COOKIE?.trim();

// Fail fast in CI if the cookie is missing. Without this guard, GH Actions
// runs would hit the Cloudflare WAF, fall into the "silent-skip" branch,
// and report success — exactly the regression PR #18 left us with.
if (process.env.GITHUB_ACTIONS === "true" && !SUBSTACK_COOKIE && !DRY_RUN) {
  console.error(
    "SUBSTACK_COOKIE is not set. CI runs require it to bypass Cloudflare bot management on data-center IPs. Add it as a repo secret (substack.sid=<value> from a logged-in browser).",
  );
  process.exit(1);
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: "https://substack.com/@sprtn/notes",
      Origin: "https://substack.com",
    };
    if (SUBSTACK_COOKIE) headers.Cookie = SUBSTACK_COOKIE;

    const res = await fetch(url, { headers });

    if (res.ok) return res;

    if (res.status === 403 || res.status === 401) {
      // When SUBSTACK_COOKIE is set, a 401/403 means the cookie is invalid
      // or expired — fail loudly so we notice and refresh it. Without a
      // cookie (e.g. local dry-run), keep the original silent-skip so the
      // workflow stays green during transient WAF blocks.
      if (SUBSTACK_COOKIE) {
        console.error(
          `Substack API returned ${res.status} despite SUBSTACK_COOKIE being set — the cookie is likely expired or invalid. Refresh it from a logged-in browser and update the GH secret.`,
        );
        process.exit(1);
      }
      console.warn(
        `⚠ Substack API returned ${res.status} — access may be blocked. Skipping sync.`,
      );
      return null;
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
      console.warn(
        `⚠ ${res.status} ${res.statusText} — retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    console.error(
      `API error: ${res.status} ${res.statusText} (after ${attempt + 1} attempt(s))`,
    );
    process.exit(1);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fetch all notes (paginated)
// ---------------------------------------------------------------------------
async function fetchAllNotes(): Promise<SubstackItem[]> {
  const all: SubstackItem[] = [];
  let cursor: string | undefined;

  while (true) {
    const url = cursor
      ? `${API_BASE}?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`
      : `${API_BASE}?limit=${PAGE_SIZE}`;

    const res = await fetchWithRetry(url);
    if (!res) return all;

    const page: FeedPage = await res.json();
    const notes = (page.items ?? []).filter(
      item => item.context?.type === "note" && item.comment?.type === "feed",
    );
    all.push(...notes);

    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Title: first non-empty line of plain text, trimmed to 60 chars
// ---------------------------------------------------------------------------
function deriveTitle(body: string, dateStr: string): string {
  const firstLine = body.split("\n").find(l => l.trim().length > 0)?.trim() ?? "";
  if (!firstLine) return dateStr;
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const items = await fetchAllNotes();
let imported = 0;
let skipped = 0;
let tooShort = 0;

for (const item of items) {
  const comment = item.comment;
  const entityKey = item.entity_key; // e.g. "c-254757086"
  const filename = `substack-${entityKey}.md`;
  const filepath = join(NOTES_DIR, filename);

  if (existsSync(filepath)) {
    skipped++;
    continue;
  }

  const plainBody = comment.body ?? "";
  if (MIN_BODY_LENGTH > 0 && plainBody.trim().length < MIN_BODY_LENGTH) {
    tooShort++;
    continue;
  }

  // Convert rich body to Markdown; fall back to plain text
  let markdownBody: string;
  if (comment.body_json) {
    markdownBody = pmNodeToMd(comment.body_json).trim();
  } else {
    markdownBody = plainBody.trim();
  }

  const date = new Date(comment.date || item.context.timestamp);
  const dateStr = date.toISOString().slice(0, 10);
  const title = deriveTitle(plainBody, dateStr);
  const safeTitle = title.replace(/"/g, '\\"');
  const sourceUrl = `https://substack.com/@${HANDLE}/note/${entityKey}`;

  const content = `---
title: "${safeTitle}"
date: ${dateStr}
source: substack
sourceUrl: "${sourceUrl}"
sourceId: "${entityKey}"
draft: false
---

${markdownBody}
`;

  if (DRY_RUN) {
    console.log(`[dry-run] Would write: ${filename}`);
    console.log(`          title: ${title}`);
    console.log(`          date:  ${dateStr}`);
    console.log(`          url:   ${sourceUrl}`);
    console.log(`          chars: ${markdownBody.length}\n`);
  } else {
    writeFileSync(filepath, content, "utf-8");
    console.log(`Wrote: ${filename}  (${title.slice(0, 50)})`);
  }
  imported++;
}

console.log(
  `\nDone. ${DRY_RUN ? "Would import" : "Imported"} ${imported} new note(s), skipped ${skipped} existing, ${tooShort} too short.`,
);

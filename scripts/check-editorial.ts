#!/usr/bin/env tsx
/**
 * Editorial-quality gate. Judges whether a post is concise/focused, expresses
 * its opinion properly, and is valuable to the reader — the qualitative checks
 * the schema-only `check:content` gate can't make.
 *
 * Runs an LLM judge via the local `claude` CLI (reuses your Claude Code login,
 * no API key needed). Advisory by default; pass --strict to exit non-zero on a
 * `fail` verdict (used by nothing yet — the pre-push hook runs it advisory).
 *
 * Usage:
 *   npm run check:editorial                 # posts changed vs origin/main
 *   npm run check:editorial -- --all        # every published post
 *   npm run check:editorial -- path/to.md   # specific file(s)
 *   npm run check:editorial -- --strict     # exit 1 on any fail
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const POSTS_DIR = join(process.cwd(), "src/content/posts");

const RUBRIC = `You are an exacting editor for a staff-engineer's personal blog. Judge the post below against three axes only. Be strict; this is a quality gate, not encouragement.

1. CONCISE & FOCUSED — Does every section earn its place? Flag filler, throat-clearing, drafting-process narration ("I half-remembered…", "as I researched"), repetition, and padding. One clear thesis, no wandering.
2. OPINION EXPRESSED PROPERLY — Does it take a clear, grounded stance rather than hedging or listing both sides without committing? Opinions must be backed by evidence, not overclaimed. Flag wishy-washy "it depends" non-conclusions AND unsupported strong claims.
3. VALUABLE & HELPFUL — Would a technical peer come away with something they can use? Flag posts that restate common knowledge, explain to beginners what the audience already knows, or never deliver a concrete takeaway.

Score each axis 1-5 (5 = excellent). Verdict rules: any axis <=2 => "fail"; any axis ==3 => "warn"; otherwise "pass".

Output ONLY minified JSON, no prose, no code fence:
{"verdict":"pass|warn|fail","concise":{"score":N,"note":"..."},"opinion":{"score":N,"note":"..."},"value":{"score":N,"note":"..."},"top_issues":["..."],"strengths":["..."]}`;

interface Verdict {
  verdict: "pass" | "warn" | "fail";
  concise: { score: number; note: string };
  opinion: { score: number; note: string };
  value: { score: number; note: string };
  top_issues: string[];
  strengths: string[];
}

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const all = args.includes("--all");
const explicit = args.filter((a) => !a.startsWith("--"));

function isPublished(content: string): boolean {
  // Only gate posts that will go live. draft: true (or missing draft with
  // draft defaulting false) — treat explicit `draft: true` as skip.
  return !/^draft:\s*true\s*$/m.test(content.split(/^---$/m)[1] ?? "");
}

function changedPosts(): string[] {
  const run = (args: string[]) => {
    try {
      return execFileSync("git", args, { encoding: "utf-8" }).split("\n");
    } catch {
      return [];
    }
  };
  // Committed diffs vs origin/main + untracked new files (uncommitted drafts).
  const committed = run(["diff", "--name-only", "origin/main", "--", "src/content/posts"]);
  const untracked = run(["ls-files", "--others", "--exclude-standard", "--", "src/content/posts"]);
  const set = new Set([...committed, ...untracked].filter((f) => f.endsWith(".md")));
  if (!set.size && !committed.length && !untracked.length) {
    console.error("⚠️  Could not read git; use --all or pass file paths.");
  }
  return [...set].map((f) => join(process.cwd(), f));
}

function targets(): string[] {
  if (explicit.length) return explicit.map((f) => join(process.cwd(), f));
  if (all)
    return readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(POSTS_DIR, f));
  return changedPosts();
}

function judge(content: string): Verdict | null {
  const prompt = `${RUBRIC}\n\n--- POST ---\n${content}`;
  let raw: string;
  try {
    raw = execFileSync("claude", ["-p", prompt, "--output-format", "json"], {
      encoding: "utf-8",
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "ENOENT") {
      console.error(
        "⚠️  `claude` CLI not found on PATH. Editorial gate needs Claude Code installed; skipping.",
      );
      process.exit(0);
    }
    console.error("⚠️  claude invocation failed; skipping this post.");
    return null;
  }
  try {
    const wrapper = JSON.parse(raw) as { result?: string };
    const text = (wrapper.result ?? raw)
      .trim()
      .replace(/^```(?:json)?|```$/g, "")
      .trim();
    return JSON.parse(text) as Verdict;
  } catch {
    console.error("⚠️  Could not parse judge output; skipping this post.");
    return null;
  }
}

const icon = { pass: "✅", warn: "⚠️ ", fail: "❌" };
let failed = 0;

const files = targets();
if (!files.length) {
  console.log("No changed published posts to review.");
  process.exit(0);
}

for (const file of files) {
  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  if (!isPublished(content)) continue;

  const rel = relative(process.cwd(), file);
  const v = judge(content);
  if (!v) continue;

  console.log(`\n${icon[v.verdict]} ${rel}  —  ${v.verdict.toUpperCase()}`);
  console.log(
    `   concise ${v.concise.score}/5 · opinion ${v.opinion.score}/5 · value ${v.value.score}/5`,
  );
  for (const s of v.top_issues ?? []) console.log(`   → ${s}`);
  if (v.verdict === "fail") failed++;
}

console.log("");
if (failed && strict) {
  console.error(`${failed} post(s) failed the editorial gate.`);
  process.exit(1);
}
process.exit(0);

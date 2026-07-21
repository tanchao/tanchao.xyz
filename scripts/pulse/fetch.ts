#!/usr/bin/env tsx
/**
 * Weekly AI Pulse — collector.
 *
 * Fetches the curated RSS/Atom feeds in sources.ts, keeps items published in
 * the window, ranks by source tier then recency, caps the total, and writes a
 * bundle JSON that /weekly-pulse reads.
 *
 * The default window is the LAST FULL ISO week (previous Monday → this Monday),
 * so a report always covers a complete week and never stops mid-week. Runs are
 * deterministic and idempotent — the same week always yields the same window.
 *
 * Usage:
 *   npm run pulse:fetch                 # last full week (Mon–Sun)
 *   npm run pulse:fetch -- --days 14    # ad-hoc trailing N-day window instead
 *   npm run pulse:fetch -- --max 60     # cap kept items (default 40)
 */

import { XMLParser } from "fast-xml-parser";
import { type PulseSource, sources } from "./sources";
import { isoWeek, lastFullWeek, type PulseItem, writeBundle } from "./state";

const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_MAX = 40;
const PER_SOURCE_TAKE = 25; // how many raw items to scan per feed
const PER_SOURCE_KEEP = 6; // cap in the final bundle so one feed can't dominate
const SUMMARY_MAX = 700;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const daysArg = argValue("days");
const maxItems = Number(argValue("max") ?? DEFAULT_MAX);

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------
async function fetchFeed(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 tanchao-pulse/0.1",
      },
    });
    if (!res.ok) {
      console.warn(`  ⚠ ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ⚠ ${(err as Error).name === "AbortError" ? "timeout" : (err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (isRecord(value)) return textValue(value["#text"] ?? value.__cdata ?? "");
  return "";
}

function linkValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const alt = value.find((v) => isRecord(v) && (!v["@_rel"] || v["@_rel"] === "alternate"));
    return linkValue(alt ?? value[0]);
  }
  if (isRecord(value)) return textValue(value["@_href"] ?? value["#text"]);
  return "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonicalize a URL for dedup: drop hash + tracking params, trim slash. */
function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key === "ref" || key === "source") {
        u.searchParams.delete(key);
      }
    }
    let out = u.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return raw.trim();
  }
}

function extractItems(doc: Record<string, unknown>): Record<string, unknown>[] {
  const rss = doc.rss as { channel?: { item?: unknown } } | undefined;
  const feed = doc.feed as { entry?: unknown } | undefined;
  const rdf = doc["rdf:RDF"] as { item?: unknown } | undefined;
  const value = rss?.channel?.item ?? feed?.entry ?? rdf?.item ?? [];
  return (Array.isArray(value) ? value : [value]).filter(isRecord);
}

function normalizeItem(raw: Record<string, unknown>, source: PulseSource): PulseItem | null {
  const title = stripHtml(textValue(raw.title));
  const url = canonicalUrl(linkValue(raw.link));
  if (!title || !url) return null;

  const summary = stripHtml(
    textValue(raw.description) || textValue(raw.summary) || textValue(raw.content) || "",
  ).slice(0, SUMMARY_MAX);

  const published = textValue(raw.pubDate) || textValue(raw.published) || textValue(raw.updated) || textValue(raw["dc:date"]);
  const date = new Date(published);
  const publishedAt = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();

  return {
    sourceSlug: source.slug,
    sourceName: source.name,
    tier: source.tier,
    title,
    url,
    summary,
    publishedAt,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const now = new Date();
let windowStart: Date;
let windowEnd: Date;
let week: string;
if (daysArg) {
  windowEnd = now;
  windowStart = new Date(now.getTime() - Number(daysArg) * 86_400_000);
  week = isoWeek(now);
} else {
  const w = lastFullWeek(now);
  windowStart = w.start;
  windowEnd = w.end;
  week = w.week;
}

console.log(
  `Pulse collect — ${week}, window ${windowStart.toISOString().slice(0, 10)} → ${windowEnd
    .toISOString()
    .slice(0, 10)} (${sources.length} sources)\n`,
);

const collected: PulseItem[] = [];
const seenThisRun = new Set<string>();

for (const source of sources) {
  process.stdout.write(`• ${source.name} … `);
  const body = await fetchFeed(source.feedUrl);
  if (!body) continue;

  let items: Record<string, unknown>[];
  try {
    items = extractItems(parser.parse(body) as Record<string, unknown>);
  } catch {
    console.warn("  ⚠ parse failed");
    continue;
  }

  let kept = 0;
  for (const raw of items.slice(0, PER_SOURCE_TAKE)) {
    const item = normalizeItem(raw, source);
    if (!item) continue;
    const published = new Date(item.publishedAt);
    if (published < windowStart || published >= windowEnd) continue;
    if (seenThisRun.has(item.url)) continue;
    seenThisRun.add(item.url);
    collected.push(item);
    kept++;
  }
  console.log(`${kept} kept / ${items.length} in feed`);
}

collected.sort((a, b) => {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
});

// Cap per source so a high-volume feed (e.g. a busy blog) can't crowd out the rest.
const perSource = new Map<string, number>();
const items: PulseItem[] = [];
for (const item of collected) {
  if (items.length >= maxItems) break;
  const n = perSource.get(item.sourceSlug) ?? 0;
  if (n >= PER_SOURCE_KEEP) continue;
  perSource.set(item.sourceSlug, n + 1);
  items.push(item);
}
const path = writeBundle({
  generatedAt: now.toISOString(),
  week,
  windowStart: windowStart.toISOString(),
  windowEnd: windowEnd.toISOString(),
  itemCount: items.length,
  items,
});

console.log(
  `\nCollected ${collected.length} fresh item(s); kept top ${items.length} (max ${maxItems}).`,
);
console.log(`Bundle: ${path}`);
if (collected.length === 0) {
  console.log("\nNothing new in the window — a quiet week, or run with --days to widen it.");
}

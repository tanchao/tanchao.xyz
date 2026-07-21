/**
 * Bundle IO + week math for the Weekly AI Pulse pipeline.
 *
 * Bundles are written to .cache/ (gitignored) — throwaway inputs to the
 * /weekly-pulse synthesis step, not source of truth. There is no persistent
 * state: the window is a fixed calendar week, so runs are deterministic and
 * consecutive weeks never overlap.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CACHE_DIR = join(process.cwd(), "scripts", "pulse", ".cache");

export type PulseItem = {
  sourceSlug: string;
  sourceName: string;
  tier: 1 | 2 | 3;
  title: string;
  url: string;
  summary: string;
  publishedAt: string; // ISO
};

export type PulseBundle = {
  generatedAt: string;
  week: string; // ISO week the report covers, e.g. "2026-W29"
  windowStart: string; // Monday 00:00 UTC (inclusive)
  windowEnd: string; // next Monday 00:00 UTC (exclusive)
  itemCount: number;
  items: PulseItem[];
};

export function writeBundle(bundle: PulseBundle): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, `bundle-${bundle.week}.json`);
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`, "utf-8");
  return path;
}

export function latestBundlePath(): string | null {
  let files: string[];
  try {
    files = readdirSync(CACHE_DIR).filter((f) => f.startsWith("bundle-") && f.endsWith(".json"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  files.sort();
  return join(CACHE_DIR, files[files.length - 1]);
}

export function loadBundle(path: string): PulseBundle {
  return JSON.parse(readFileSync(path, "utf-8")) as PulseBundle;
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

/** The most recent fully-completed ISO week relative to `now`. */
export function lastFullWeek(now: Date): { start: Date; end: Date; week: string } {
  const thisMonday = startOfIsoWeek(now);
  const start = new Date(thisMonday.getTime() - 7 * 86_400_000);
  return { start, end: thisMonday, week: isoWeek(start) };
}

/** ISO 8601 week label, e.g. "2026-W29". */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

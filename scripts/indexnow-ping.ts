#!/usr/bin/env npx tsx
/**
 * Ping IndexNow after a production build.
 * Key file: public/7f3a9c2e1b8d4f6a0e5c3b7d9f1a4e6c.txt
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HOST = "tanchao.xyz";
const KEY = "7f3a9c2e1b8d4f6a0e5c3b7d9f1a4e6c";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const DIST = "dist";
const MAX_URLS = 100;

function collectHtmlUrls(dir: string, base = ""): string[] {
  const urls: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = `${base}/${entry}`;
    if (statSync(path).isDirectory()) {
      urls.push(...collectHtmlUrls(path, rel));
    } else if (entry === "index.html") {
      const pathname = base === "" ? "/" : `${base}/`;
      urls.push(`https://${HOST}${pathname}`);
    }
  }
  return urls;
}

async function main() {
  let urls: string[];
  try {
    urls = collectHtmlUrls(DIST);
  } catch {
    console.log("[indexnow] dist/ not found — skipping ping");
    return;
  }

  if (urls.length === 0) {
    console.log("[indexnow] no URLs found — skipping ping");
    return;
  }

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls.slice(0, MAX_URLS),
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 202) {
    console.log(`[indexnow] pinged ${payload.urlList.length} URLs (HTTP ${res.status})`);
  } else {
    console.warn(`[indexnow] ping failed: HTTP ${res.status}`);
  }
}

main().catch((err) => {
  console.warn("[indexnow] error:", err);
});

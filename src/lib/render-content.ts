import TurndownService from "turndown";
import { marked } from "marked";
import type { CollectionEntry } from "astro:content";

type RenderableEntry = CollectionEntry<"posts" | "notes" | "projects">;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("removeEmptyParagraphs", {
  filter: (node) =>
    node.nodeName === "P" && node.textContent?.trim() === "",
  replacement: () => "",
});

function bodyToHtml(body: string): string {
  return marked.parse(body, { async: false }) as string;
}

/** Convert markdown body to clean markdown suitable for LLM ingestion. */
export function bodyToMarkdown(body: string): string {
  const html = bodyToHtml(body);
  return turndown.turndown(html).trim();
}

/** Convert a content entry body to clean markdown. */
export function entryToMarkdown(entry: RenderableEntry): string {
  return bodyToMarkdown(entry.body ?? "");
}

/** Convert a content entry body to HTML for RSS content:encoded. */
export function entryToHtml(entry: RenderableEntry): string {
  return bodyToHtml(entry.body ?? "");
}

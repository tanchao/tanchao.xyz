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

/** Fenced code blocks, captured so MDX stripping can skip over them. */
const FENCED_BLOCK = /(^(?:```|~~~)[\s\S]*?^(?:```|~~~)[ \t]*$)/gm;

function stripMdxSegment(segment: string): string {
  return (
    segment
      // ESM statements MDX allows at the top level of a document
      .replace(/^[ \t]*import\s.+$/gm, "")
      .replace(/^[ \t]*export\s.+$/gm, "")
      // Promote a tab label to a heading so each panel stays identifiable
      .replace(/<Tab\b[^>]*\blabel="([^"]*)"[^>]*>/g, "\n\n#### $1\n\n")
      // Promote a callout title to a bold lead-in
      .replace(/<Callout\b[^>]*\btitle="([^"]*)"[^>]*>/g, "\n\n**$1**\n\n")
      // Every remaining component tag. MDX components are capitalized by
      // convention; HTML element names are not, so casing is a safe filter.
      .replace(/<\/?[A-Z][A-Za-z0-9]*(?:\s[^>]*?)?\/?>/g, "")
      .replace(/\n{3,}/g, "\n\n")
  );
}

/**
 * Reduce an MDX body to plain markdown.
 *
 * `marked` does not understand ESM imports or JSX, so without this the RSS
 * feed and llms-full.txt would carry component tags as literal text. Fenced
 * code is passed through untouched — a Rego sample containing `import
 * rego.v1` must survive intact.
 */
function stripMdx(body: string): string {
  return body
    .split(FENCED_BLOCK)
    .map((part, index) => (index % 2 === 1 ? part : stripMdxSegment(part)))
    .join("")
    .trim();
}

function bodyToHtml(body: string): string {
  return marked.parse(stripMdx(body), { async: false }) as string;
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

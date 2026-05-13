import { visit } from "unist-util-visit";
import type { Root, Code, Html } from "mdast";

/**
 * Replace ```mermaid fenced code blocks with raw HTML <pre class="mermaid">.
 * Runs before astro-expressive-code so the block is never syntax-highlighted;
 * the client-side renderer in Post.astro turns the <pre> into an SVG.
 */
export default function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (node.lang !== "mermaid" || !parent || typeof index !== "number") {
        return;
      }
      const escaped = node.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const replacement: Html = {
        type: "html",
        value: `<pre class="mermaid" data-mermaid-source>${escaped}</pre>`,
      };
      parent.children[index] = replacement;
    });
  };
}

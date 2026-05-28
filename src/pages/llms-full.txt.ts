import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { entryToMarkdown } from "../lib/render-content";
import { noteUrl, postUrl, sortedNotes, sortedPosts } from "../lib/posts";

export const GET: APIRoute = async () => {
  const posts = sortedPosts(await getCollection("posts"));
  const notes = sortedNotes(await getCollection("notes"));

  const sections = [
    "# tanchao.xyz — Full text dump for LLMs",
    `# Generated: ${new Date().toISOString()}`,
    "# Author: Chao Tan <chaos.tc@gmail.com>",
    "# Site: https://tanchao.xyz",
    "",
  ];

  for (const post of posts) {
    const updated = post.data.updated ?? post.data.date;
    sections.push(`${"=".repeat(60)}`);
    sections.push(`# ${post.data.title}`);
    sections.push(`URL: https://tanchao.xyz${postUrl(post.id)}`);
    sections.push(`Date: ${post.data.date.toISOString().split("T")[0]}`);
    sections.push(`Last updated: ${updated.toISOString().split("T")[0]}`);
    if (post.data.tags.length) sections.push(`Tags: ${post.data.tags.join(", ")}`);
    if (post.data.description) sections.push(`Description: ${post.data.description}`);
    if (post.data.tldr) sections.push(`TL;DR: ${post.data.tldr}`);
    sections.push("");
    sections.push(entryToMarkdown(post));
    sections.push("");
  }

  for (const note of notes) {
    sections.push(`${"=".repeat(60)}`);
    sections.push(`# ${note.data.title}`);
    sections.push(`URL: https://tanchao.xyz${noteUrl(note.id)}`);
    sections.push(`Date: ${note.data.date.toISOString().split("T")[0]}`);
    sections.push(`Last updated: ${note.data.date.toISOString().split("T")[0]}`);
    if (note.data.sourceUrl) sections.push(`Source: ${note.data.sourceUrl}`);
    sections.push("");
    sections.push(entryToMarkdown(note));
    sections.push("");
  }

  return new Response(sections.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

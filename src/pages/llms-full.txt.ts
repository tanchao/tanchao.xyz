import type { APIRoute } from "astro";
import { getCollection, render } from "astro:content";
import { sortedPosts, postUrl } from "../lib/posts";

export const GET: APIRoute = async () => {
  const posts = sortedPosts(await getCollection("posts"));

  const sections = [
    "# tanchao.xyz — Full text dump for LLMs",
    `# Generated: ${new Date().toISOString()}`,
    "# Author: Chao Tan <chaos.tc@gmail.com>",
    "# Site: https://tanchao.xyz",
    "",
  ];

  for (const post of posts) {
    sections.push(`${"=".repeat(60)}`);
    sections.push(`TITLE: ${post.data.title}`);
    sections.push(`DATE: ${post.data.date.toISOString().split("T")[0]}`);
    sections.push(`URL: https://tanchao.xyz${postUrl(post.id)}`);
    if (post.data.tags.length) sections.push(`TAGS: ${post.data.tags.join(", ")}`);
    if (post.data.description) sections.push(`DESCRIPTION: ${post.data.description}`);
    sections.push("");
    sections.push(post.body ?? "");
    sections.push("");
  }

  return new Response(sections.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

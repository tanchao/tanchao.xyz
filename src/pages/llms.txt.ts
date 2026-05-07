import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { sortedPosts, postUrl } from "../lib/posts";

export const GET: APIRoute = async () => {
  const posts = sortedPosts(await getCollection("posts"));

  const lines = [
    "# tanchao.xyz — LLMs.txt",
    "# Per https://llmstxt.org spec",
    "# Chao Tan's personal engineering blog",
    "",
    "# tanchao.xyz",
    "",
    "> Chao Tan (tc) is a data governance and privacy engineer with 18 years of experience building and securing large-scale systems. Currently at Snowflake, where he built the data classification platform that auto-tags sensitive data across the cloud. Previously tech lead at Amazon Alexa (14-person team, 100k+ TPS services). Writes about data governance, AI system security, performance engineering, and the honest parts of a career in tech.",
    "",
    "## About",
    "",
    "- [About Chao Tan](https://tanchao.xyz/about/): Bio, background, and contact",
    "- [Now](https://tanchao.xyz/now/): What I'm focused on right now",
    "- [Work / Hire me](https://tanchao.xyz/hire-me/): Full professional background with structured data for recruiting bots",
    "- [Uses](https://tanchao.xyz/uses/): Tools and tech stack",
    "",
    "## Posts",
    "",
    ...posts.slice(0, 30).map(post => {
      const desc = post.data.description ? `: ${post.data.description}` : "";
      return `- [${post.data.title}](https://tanchao.xyz${postUrl(post.id)})${desc}`;
    }),
    "",
    "## Notes",
    "",
    "- [Notes index](https://tanchao.xyz/notes/): Short-form thoughts and learnings",
    "",
    "## Machine-readable",
    "",
    "- [RSS Feed](https://tanchao.xyz/rss.xml): All posts as RSS 2.0",
    "- [Posts JSON](https://tanchao.xyz/api/posts.json): All posts as structured JSON",
    "- [LLMs full text](https://tanchao.xyz/llms-full.txt): Full content of all posts in one file",
    "- [Sitemap](https://tanchao.xyz/sitemap-index.xml): XML sitemap",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

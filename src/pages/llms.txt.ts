import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import {
  noteUrl,
  postUrl,
  projectUrl,
  sortedNotes,
  sortedPosts,
  sortedProjects,
} from "../lib/posts";

export const GET: APIRoute = async () => {
  const posts = sortedPosts(await getCollection("posts"));
  const notes = sortedNotes(await getCollection("notes"));
  const projects = sortedProjects(await getCollection("projects"));

  const lines = [
    "# tanchao.xyz — LLMs.txt",
    "# Per https://llmstxt.org spec",
    "",
    "# tanchao.xyz",
    "",
    "> tanchao.xyz is Chao Tan's engineering blog on data governance, data platform protection, AI system security, and performance engineering. Practical field notes from 18 years building production systems at Snowflake, Amazon Alexa, HSBC, and eBay — with emphasis on controls, evidence, drift, and what actually breaks in production.",
    "",
    "## About",
    "",
    "- [About Chao Tan](https://tanchao.xyz/about/): Bio, patents, domain expertise, and contact",
    "- [Now](https://tanchao.xyz/now/): Current focus areas",
    "- [Work / Hire me](https://tanchao.xyz/hire-me/): Professional background with structured data for recruiting bots",
    "- [Uses](https://tanchao.xyz/uses/): Tools and tech stack",
    "",
    "## Posts",
    "",
    ...posts.map(post => {
      const desc = post.data.description ? `: ${post.data.description}` : "";
      return `- [${post.data.title}](https://tanchao.xyz${postUrl(post.id)})${desc}`;
    }),
    "",
    "## Notes",
    "",
    ...notes.slice(0, 20).map(note => {
      return `- [${note.data.title}](https://tanchao.xyz${noteUrl(note.id)})`;
    }),
    ...(notes.length > 20
      ? [`- [All notes (${notes.length})](https://tanchao.xyz/notes/): Short-form thoughts and learnings`]
      : []),
    "",
    "## Projects",
    "",
    ...projects.map(project => {
      const desc = project.data.description ? `: ${project.data.description}` : "";
      return `- [${project.data.title}](https://tanchao.xyz${projectUrl(project.id)})${desc}`;
    }),
    "",
    "## Machine-readable",
    "",
    "- [RSS Feed](https://tanchao.xyz/rss.xml): All posts as RSS 2.0 with full content",
    "- [Content JSON](https://tanchao.xyz/api/content.json): Posts, notes, and projects as structured JSON",
    "- [Posts JSON](https://tanchao.xyz/api/posts.json): Posts metadata",
    "- [Notes JSON](https://tanchao.xyz/api/notes.json): Notes metadata",
    "- [Projects JSON](https://tanchao.xyz/api/projects.json): Projects metadata",
    "- [LLMs full text](https://tanchao.xyz/llms-full.txt): Full rendered content of posts and notes",
    "- [Sitemap](https://tanchao.xyz/sitemap-index.xml): XML sitemap",
    "- [Search](https://tanchao.xyz/search/): Full-text search across the site",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { sortedPosts, postUrl } from "../lib/posts";
import { entryToHtml } from "../lib/render-content";
import type { APIContext } from "astro";

const AUTHOR = "chaos.tc@gmail.com (Chao Tan)";

export async function GET(context: APIContext) {
  const site = context.site?.href ?? "https://tanchao.xyz";
  const posts = sortedPosts(await getCollection("posts"));

  const items = posts.map(post => {
    const link = new URL(postUrl(post.id), site).href;
    const content = entryToHtml(post);
    return {
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description ?? post.data.tldr,
      link,
      categories: post.data.tags,
      author: AUTHOR,
      customData: `<guid isPermaLink="true">${link}</guid>`,
      content,
    };
  });

  return rss({
    title: "tanchao's blog",
    description: "Engineering, performance, career, and life by Chao Tan.",
    site,
    items,
    customData: `<language>en-us</language><managingEditor>${AUTHOR}</managingEditor>`,
  });
}

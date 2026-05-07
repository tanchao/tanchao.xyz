import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { sortedPosts, postUrl } from "../lib/posts";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = sortedPosts(await getCollection("posts"));
  return rss({
    title: "tanchao's blog",
    description:
      "Engineering, performance, career, and life by Chao Tan.",
    site: context.site!.href,
    items: posts.map(post => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: postUrl(post.id),
      categories: post.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}

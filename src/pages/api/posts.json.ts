import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { sortedPosts, postUrl } from "../../lib/posts";

export const GET: APIRoute = async () => {
  const posts = sortedPosts(await getCollection("posts"));
  const data = posts.map(post => ({
    title: post.data.title,
    description: post.data.description ?? null,
    date: post.data.date.toISOString().split("T")[0],
    updated: post.data.updated?.toISOString().split("T")[0] ?? null,
    tags: post.data.tags,
    url: `https://tanchao.xyz${postUrl(post.id)}`,
  }));

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

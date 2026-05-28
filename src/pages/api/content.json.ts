import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import {
  noteUrl,
  postUrl,
  projectUrl,
  sortedNotes,
  sortedPosts,
  sortedProjects,
} from "../../lib/posts";

export const GET: APIRoute = async () => {
  const posts = sortedPosts(await getCollection("posts"));
  const notes = sortedNotes(await getCollection("notes"));
  const projects = sortedProjects(await getCollection("projects"));

  const data = [
    ...posts.map(post => ({
      type: "post" as const,
      title: post.data.title,
      description: post.data.description ?? post.data.tldr ?? null,
      date: post.data.date.toISOString().split("T")[0],
      updated: post.data.updated?.toISOString().split("T")[0] ?? null,
      tags: post.data.tags,
      url: `https://tanchao.xyz${postUrl(post.id)}`,
    })),
    ...notes.map(note => ({
      type: "note" as const,
      title: note.data.title,
      description: null,
      date: note.data.date.toISOString().split("T")[0],
      updated: null,
      tags: [] as string[],
      url: `https://tanchao.xyz${noteUrl(note.id)}`,
    })),
    ...projects.map(project => ({
      type: "project" as const,
      title: project.data.title,
      description: project.data.description ?? null,
      date: project.data.started.toISOString().split("T")[0],
      updated: project.data.updated?.toISOString().split("T")[0] ?? null,
      tags: project.data.tags,
      url: `https://tanchao.xyz${projectUrl(project.id)}`,
    })),
  ];

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

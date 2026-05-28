import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { projectUrl, sortedProjects } from "../../lib/posts";

export const GET: APIRoute = async () => {
  const projects = sortedProjects(await getCollection("projects"));
  const data = projects.map(project => ({
    title: project.data.title,
    description: project.data.description ?? null,
    status: project.data.status,
    started: project.data.started.toISOString().split("T")[0],
    updated: project.data.updated?.toISOString().split("T")[0] ?? null,
    tags: project.data.tags,
    repo: project.data.repo ?? null,
    link: project.data.link ?? null,
    url: `https://tanchao.xyz${projectUrl(project.id)}`,
  }));

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

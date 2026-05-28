import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { noteUrl, sortedNotes } from "../../lib/posts";

export const GET: APIRoute = async () => {
  const notes = sortedNotes(await getCollection("notes"));
  const data = notes.map(note => ({
    title: note.data.title,
    date: note.data.date.toISOString().split("T")[0],
    source: note.data.source ?? null,
    sourceUrl: note.data.sourceUrl ?? null,
    url: `https://tanchao.xyz${noteUrl(note.id)}`,
  }));

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

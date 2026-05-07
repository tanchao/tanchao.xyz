import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string().max(80),
    description: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    originalUrl: z.string().optional(),
    canonical: z.string().optional(),
    image: z.string().optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    source: z.enum(["substack"]).optional(),
    sourceUrl: z.string().url().optional(),
    sourceId: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string().max(80),
    description: z.string().optional(),
    status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
    started: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    repo: z.string().url().optional(),
    link: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, notes, projects };

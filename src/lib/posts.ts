import type { CollectionEntry } from "astro:content";

/** Derives URL slug from post ID (filename without extension).
 *  File `2021-07-31-tech-records.md` → slug `2021/07/31/tech-records`
 *  which generates URL `/posts/2021/07/31/tech-records/`
 */
export function postSlug(id: string): string {
  const base = id.replace(/\.(md|mdx)$/, "");
  // filename format: YYYY-MM-DD-rest-of-title
  const match = base.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (match) {
    const [, year, month, day, slug] = match;
    return `${year}/${month}/${day}/${slug}`;
  }
  return base;
}

export function postUrl(id: string): string {
  return `/posts/${postSlug(id)}/`;
}

export function noteSlug(id: string): string {
  return id.replace(/\.(md|mdx)$/, "");
}

export function noteUrl(id: string): string {
  return `/notes/${noteSlug(id)}/`;
}

/** Estimate reading time in minutes */
export function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Sort posts newest-first, excluding drafts in production */
export function sortedPosts(
  posts: CollectionEntry<"posts">[],
  includeDrafts = false,
): CollectionEntry<"posts">[] {
  return posts
    .filter((p) => includeDrafts || !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function allTags(posts: CollectionEntry<"posts">[]): string[] {
  const tags = new Set<string>();
  for (const post of posts) {
    for (const tag of post.data.tags) tags.add(tag);
  }
  return [...tags].sort();
}

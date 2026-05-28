import type { CollectionEntry } from "astro:content";

export function projectSlug(id: string): string {
  return id.replace(/\.(md|mdx)$/, "");
}

export function projectUrl(id: string): string {
  return `/projects/${projectSlug(id)}/`;
}

export function sortedProjects(
  projects: CollectionEntry<"projects">[],
  includeDrafts = false,
): CollectionEntry<"projects">[] {
  const statusRank: Record<string, number> = { active: 0, paused: 1, completed: 2, archived: 3 };
  return projects
    .filter((p) => includeDrafts || !p.data.draft)
    .sort((a, b) => {
      const s = statusRank[a.data.status] - statusRank[b.data.status];
      if (s !== 0) return s;
      const aDate = (a.data.updated ?? a.data.started).getTime();
      const bDate = (b.data.updated ?? b.data.started).getTime();
      return bDate - aDate;
    });
}

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

/** Count words in markdown/plain text content */
export function wordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

/** Estimate reading time in minutes */
export function readingTime(content: string): number {
  return Math.max(1, Math.round(wordCount(content) / 200));
}

/** Sort notes newest-first, excluding drafts in production */
export function sortedNotes(
  notes: CollectionEntry<"notes">[],
  includeDrafts = false,
): CollectionEntry<"notes">[] {
  return notes
    .filter((n) => includeDrafts || !n.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
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

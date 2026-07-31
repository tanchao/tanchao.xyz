/**
 * Curated endorsements — URL + short why.
 * Add new items at the top. Keep descriptions to one short line.
 */
export interface CollectionItem {
  title: string;
  url: string;
  description: string;
  /** Optional coarse grouping for the page */
  tags?: string[];
}

export const collections: CollectionItem[] = [
  {
    title: "Steps of AI Adoption",
    url: "https://claude.ai/code/artifact/bfdfaef9-bc62-4dfe-ba9e-c58a26c9accf",
    description:
      "Boris Cherny's trust ladder from gated AI to org-wide agents — verification is the rate limiter.",
    tags: ["agents", "adoption"],
  },
  {
    title: "The Llama 3 Herd of Models",
    url: "https://arxiv.org/abs/2407.21783",
    description:
      "Meta's Llama 3 technical report — 405B dense Transformer, post-training, and multimodal experiments.",
    tags: ["papers", "llm"],
  },
  {
    title: "Agent Skills specification",
    url: "https://agentskills.io/specification",
    description:
      "The SKILL.md format for packaging agent procedures — frontmatter, progressive disclosure, scripts.",
    tags: ["agents", "specs"],
  },
];

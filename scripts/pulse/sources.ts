/**
 * Curated AI-industry feeds for the Weekly AI Pulse.
 *
 * Only RSS/Atom-capable sources belong here — the collector (fetch.ts) parses
 * XML feeds. HTML-only sources (e.g. Anthropic's news page, Meta AI) are out
 * of scope for v1; adding them means writing an HTML scraper.
 *
 * Feed URLs are verified against agent-pulse's public source catalog and each
 * publisher's own feed. If a feed 404s, the collector logs it and continues —
 * prune or fix the row here.
 *
 * tier: rough authority/signal weight used only for ranking (1 = highest).
 */

export type PulseSource = {
  slug: string;
  name: string;
  homepageUrl: string;
  feedUrl: string;
  tier: 1 | 2 | 3;
  topics: string[];
};

export const sources: PulseSource[] = [
  // Tier 1 — frontier labs / primary product news
  {
    slug: "openai",
    name: "OpenAI",
    homepageUrl: "https://openai.com/news/",
    feedUrl: "https://openai.com/news/rss.xml",
    tier: 1,
    topics: ["foundation-model", "agent", "product", "safety"],
  },
  {
    slug: "deepmind",
    name: "Google DeepMind",
    homepageUrl: "https://deepmind.google/discover/blog/",
    feedUrl: "https://deepmind.google/blog/rss.xml",
    tier: 1,
    topics: ["research", "agi", "robotics", "science"],
  },
  {
    slug: "google-ai",
    name: "Google AI",
    homepageUrl: "https://blog.google/technology/ai/",
    feedUrl: "https://blog.google/technology/ai/rss/",
    tier: 1,
    topics: ["product", "gemini", "consumer"],
  },

  // Tier 2 — research orgs, platforms, sharp independents
  {
    slug: "microsoft-research",
    name: "Microsoft Research",
    homepageUrl: "https://www.microsoft.com/en-us/research/blog/",
    feedUrl: "https://www.microsoft.com/en-us/research/feed/",
    tier: 2,
    topics: ["research", "agent", "enterprise"],
  },
  {
    slug: "huggingface",
    name: "Hugging Face",
    homepageUrl: "https://huggingface.co/blog",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    tier: 2,
    topics: ["open-model", "tooling", "community"],
  },
  {
    slug: "bair",
    name: "Berkeley AI Research",
    homepageUrl: "https://bair.berkeley.edu/blog/",
    feedUrl: "https://bair.berkeley.edu/blog/feed.xml",
    tier: 2,
    topics: ["research", "academia"],
  },
  {
    slug: "simonwillison",
    name: "Simon Willison",
    homepageUrl: "https://simonwillison.net/",
    feedUrl: "https://simonwillison.net/atom/everything/",
    tier: 2,
    topics: ["llm", "tooling", "practitioner"],
  },
  {
    slug: "import-ai",
    name: "Import AI (Jack Clark)",
    homepageUrl: "https://importai.substack.com/",
    feedUrl: "https://importai.substack.com/feed",
    tier: 2,
    topics: ["policy", "research", "analysis"],
  },
  // arXiv — research firehose (topic-scoped)
  {
    slug: "arxiv-ai",
    name: "arXiv cs.AI",
    homepageUrl: "https://arxiv.org/list/cs.AI/recent",
    feedUrl: "https://export.arxiv.org/rss/cs.AI",
    tier: 3,
    topics: ["research", "preprint"],
  },
  {
    slug: "arxiv-cl",
    name: "arXiv cs.CL",
    homepageUrl: "https://arxiv.org/list/cs.CL/recent",
    feedUrl: "https://export.arxiv.org/rss/cs.CL",
    tier: 3,
    topics: ["research", "nlp", "preprint"],
  },
  {
    slug: "arxiv-lg",
    name: "arXiv cs.LG",
    homepageUrl: "https://arxiv.org/list/cs.LG/recent",
    feedUrl: "https://export.arxiv.org/rss/cs.LG",
    tier: 3,
    topics: ["research", "ml", "preprint"],
  },

  // Tier 3 — release feeds, community heat
  {
    slug: "vllm-releases",
    name: "vLLM releases",
    homepageUrl: "https://github.com/vllm-project/vllm/releases",
    feedUrl: "https://github.com/vllm-project/vllm/releases.atom",
    tier: 3,
    topics: ["infra", "serving", "open-source"],
  },
  {
    slug: "ollama-releases",
    name: "Ollama releases",
    homepageUrl: "https://github.com/ollama/ollama/releases",
    feedUrl: "https://github.com/ollama/ollama/releases.atom",
    tier: 3,
    topics: ["local-model", "tooling", "open-source"],
  },
  {
    slug: "hn-ai",
    name: "Hacker News (AI, ≥100 pts)",
    homepageUrl: "https://news.ycombinator.com/",
    feedUrl: "https://hnrss.org/newest?q=AI+OR+LLM+OR+agent&points=100",
    tier: 3,
    topics: ["community-heat", "discussion"],
  },
];

import type { APIRoute } from "astro";

// tanchao.xyz robot policy
// This blog explicitly welcomes all AI crawlers, training datasets,
// recruiting bots, and general web crawlers.
// We want maximum discoverability.

const ALLOW_ALL_BOTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Slurp",
  "Baiduspider",
  // AI crawlers — explicitly allowed
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "meta-externalagent",
  "cohere-ai",
  "Google-Extended",
  "CCBot",
  "YouBot",
  "Diffbot",
];

export const GET: APIRoute = () => {
  const lines = [
    "# tanchao.xyz — robots.txt",
    "# This blog welcomes all crawlers including AI/LLM training bots.",
    "# https://tanchao.xyz/llms.txt for LLM-optimized content.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    ...ALLOW_ALL_BOTS.flatMap(bot => [
      `User-agent: ${bot}`,
      "Allow: /",
      "",
    ]),
    "Sitemap: https://tanchao.xyz/sitemap-index.xml",
    "LLMs: https://tanchao.xyz/llms.txt",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

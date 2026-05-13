// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import expressiveCode from "astro-expressive-code";
import remarkMermaid from "./src/lib/remark-mermaid.ts";

export default defineConfig({
  site: "https://tanchao.xyz",
  trailingSlash: "always",

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    expressiveCode({
      themes: ["github-light", "github-dark"],
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) =>
        theme.name === "github-dark" ? ".dark" : ":root:not(.dark)",
    }),
    mdx(),
    sitemap(),
  ],

  markdown: {
    remarkPlugins: [remarkMermaid],
    shikiConfig: {
      // Handled by expressive-code
    },
  },
});

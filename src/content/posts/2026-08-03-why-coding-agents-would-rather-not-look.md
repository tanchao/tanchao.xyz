---
title: "Why coding agents would rather not look"
description: "Coding agents avoid screenshots because pixels are their most expensive, least precise input: a 1024×588 frame costs a vision model about 777 tokens, while the same page read through the accessibility tree costs 200–400 and returns exact element handles. Why the legibility ladder runs text → structured markup → pixels, how screen-reader infrastructure (WAI-ARIA) became agent-perception infrastructure, and when agents genuinely need to look."
tldr: "Coding agents would rather not look because pixels are their most expensive sense: a screenshot costs hundreds to thousands of tokens and returns approximate coordinates, while the accessibility tree costs a fraction and returns exact element refs. Agents climbed the legibility ladder cheapest-first — text, then structured markup, then pixels — and the accessibility tree built for screen readers (WAI-ARIA) is now how they perceive a UI without looking. Pixels are the deliberate fallback for canvas, layout, and no-DOM surfaces."
date: 2026-08-03
tags: ["ai", "agents", "vision", "accessibility", "context-engineering", "engineering"]
draft: false
faq:
  - q: "Why do coding agents avoid screenshots?"
    a: "Because a screenshot is their most expensive and least precise input. Claude bills an image at ⌈width/28⌉ × ⌈height/28⌉ visual tokens, so a 1024×588 frame costs about 777 tokens, and the model still has to guess element coordinates from pixels. The same page read through the accessibility tree costs roughly 200–400 tokens and returns exact, clickable element references. Agents look only when a cheaper representation cannot answer the question."
  - q: "How many tokens does a screenshot cost an LLM?"
    a: "It depends on the encoder and the size. Claude uses 28×28-pixel patches — ⌈width/28⌉ × ⌈height/28⌉ visual tokens — so a 1024×588 screenshot is about 777 tokens and a 1000×1000 image about 1,296. OpenAI charges 85 base tokens plus 170 per 512-pixel tile, making a 1024×1024 image 765 tokens. Playwright MCP's docs put a full screenshot at roughly 3,000–5,000 tokens versus 200–400 for an accessibility snapshot of the same page."
  - q: "What is the accessibility tree and why do agents use it?"
    a: "The accessibility tree is a browser's semantic model of a page — every control's role, name, and state — defined by the W3C WAI-ARIA standard and originally built so screen readers could announce interfaces to blind users. Agents use it because it is compact, deterministic, and addressable: it describes what each element is and does in a fraction of a screenshot's tokens, and it gives stable handles to click instead of pixel coordinates to guess."
  - q: "Does Playwright MCP use screenshots or the accessibility tree?"
    a: "The accessibility tree by default. Playwright MCP serializes the page to a structured text snapshot with stable element refs and states that no vision model is required. Screenshots are opt-in through vision mode (--caps=vision), added only for cases a snapshot cannot capture, such as canvas-rendered charts or visual-layout checks."
  - q: "When does an AI agent actually need to see pixels?"
    a: "When the task is genuinely visual or there is no semantic tree to read. Canvas and chart libraries like D3 and Chart.js render to an opaque <canvas> the accessibility tree cannot describe; appearance checks such as visual regression, spacing, and design review need the rendered image; and games, native desktop apps, and remote screens with no accessibility API leave computer-use agents no choice but to work from screenshots."
  - q: "Is giving agents vision the real frontier?"
    a: "Perception is largely solved — multimodal models read images, and computer-use agents scored 72.5% on OSWorld by 2026, up from under 15% in late 2024. The economic frontier is different: making media legible cheaply. Because pixels cost an order of magnitude more tokens than structured representations and return less reliable information, the design work is in reading the accessibility tree first and spending pixels only when nothing cheaper will do."
---

> Part of a two-post series on the interfaces coding agents read. Previous: [Why coding agents lean on the shell](/posts/2026/08/02/why-coding-agents-lean-on-the-shell/).

Coding agents would rather not look because pixels are their most expensive sense. A screenshot costs hundreds to thousands of tokens and hands back approximate coordinates; the same page read through the accessibility tree costs a fraction and returns exact element handles. So the frontier is not giving agents eyes. It is making media legible cheaply, and spending pixels only when nothing cheaper will do.

The [shell post](/posts/2026/08/02/why-coding-agents-lean-on-the-shell/) argued that agents lean on text because it is the cheapest legible interface, and every idiom is context discipline. Pixels sit at the other end of that ladder: the richest interface, and the priciest to read. This post follows the same constraint one rung up.

## The legibility ladder

Agents learned to read interfaces cheapest-first, in the order those interfaces became legible to a model. Text was free from day one. Structured markup came next, once tools exposed it. Raw pixels came last, because reading them at all required multimodality. The ordering is not taste; it is cost.

- **Text and shell** — the agent's native tongue. A command and its output are tokens in, tokens out. Nearly free, and covered in the shell post.
- **Structured markup** — the DOM and the accessibility tree. Semantic, compact, and addressable: every element has a role and a name.
- **Raw pixels** — a screenshot. Dense, lossy for the model, and only readable since vision models arrived.

Each rung up buys more visual fidelity and costs more to read. An agent that respects its context window climbs only as high as the task forces it to.

## Pixels are the most expensive sense

Put a number on it. Claude bills an image in 28×28-pixel patches: an image costs `⌈width/28⌉ × ⌈height/28⌉` visual tokens, per the [Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision). My `shot.mjs` — a throwaway Playwright script that screenshots a local page so I can eyeball a UI fix — renders at 1024×588, so that one frame is 37 × 21 = **777 tokens** before the model reasons about a single button. OpenAI's encoder is tile-based — 85 base tokens plus 170 per 512-pixel tile — so a 1024×1024 frame runs 765 tokens, per the [OpenAI vision guide](https://platform.openai.com/docs/guides/vision). Opening that PNG felt free to me. To a model, every glance is metered.

Worse, a screenshot gives the model *approximate* knowledge. It has to guess coordinates from pixels, and a layout shift breaks the guess. Compare the two representations of the same page, from Playwright MCP's own docs:

- **Accessibility snapshot** — ~200–400 tokens, exact element refs, deterministic.
- **Screenshot** — ~3,000–5,000 tokens, coordinate guessing, needs a vision model ([Playwright MCP snapshots](https://playwright.dev/mcp/snapshots)).

An order of magnitude more tokens to get *less* reliable information. That is why a well-built agent looks last.

## The cheap path is the accessibility tree

The cheap representation already existed, built for someone else. The accessibility tree is a browser's semantic model of a page — every control's role, name, and state — defined by the W3C's [WAI-ARIA standard](https://www.w3.org/WAI/standards-guidelines/aria/) and mapped to the operating system's accessibility API so screen readers and braille displays can announce an interface to blind users. Decades of accessibility work produced a compact, machine-readable description of any UI. It turns out that is exactly what an agent needs to perceive a page without looking at it.

That is the cross-domain surprise: screen-reader infrastructure became agent-perception infrastructure. The same layer JAWS and VoiceOver read aloud, an agent reads as tokens.

- **Playwright MCP** operates on the accessibility tree by default and serializes it to text with stable refs like `e5` — "no vision models required," per the [Playwright MCP docs](https://playwright.dev/mcp/introduction). The model clicks `ref=e5`, not a pixel coordinate.
- **Playwright's recommended locator**, `getByRole`, matches by ARIA role and accessible name because that "reflects how users and assistive technology perceive the page" ([Playwright locators](https://playwright.dev/docs/locators)). The `shot.mjs` selector `button[data-tab^="project-"]` is the older, brittler CSS style; `getByRole('tab', { name: '...' })` is the a11y-native one.

Read the button the way a screen reader would say it out loud, and both a human tester and an agent get a handle that survives a CSS refactor.

## When agents actually need pixels

Pixels are the fallback, not the default, and there are real cases where nothing cheaper works. The accessibility tree describes semantics, so it goes blind exactly where semantics run out.

- **Canvas and charts.** Libraries like D3 and Chart.js render to a `<canvas>` element. The accessibility tree sees one opaque node; only a screenshot shows the chart.
- **"Does it look right."** Visual regression, layout, spacing, a design review — anything about appearance rather than structure needs the pixels. That is what `shot.mjs` is for: a human eyeballing a UI fix.
- **No-DOM surfaces.** Games, native desktop apps, a remote screen with no accessibility API. Computer-use agents drive these by screenshot because there is no tree to read.

Playwright MCP makes this explicit: vision mode is opt-in (`--caps=vision`), added only when a snapshot cannot capture what you need to verify ([Playwright MCP snapshots](https://playwright.dev/mcp/snapshots)). Pixels on demand, not by default.

## Who is building the eyes

While harnesses learned to avoid pixels, the labs kept making pixels more useful for the cases that need them — the same toolchain move the shell post traced. Computer-use is the clearest line.

- **Anthropic shipped computer use** on [October 22, 2024](https://www.anthropic.com/news/3-5-models-and-computer-use): Claude 3.5 Sonnet reading a screen, moving a cursor, clicking, and typing.
- **OpenAI shipped Operator** on [January 23, 2025](https://openai.com/index/introducing-operator/), powered by its Computer-Using Agent model, and folded it into ChatGPT Agent that July.
- **Anthropic bought [Vercept](https://techcrunch.com/2026/02/25/anthropic-acquires-vercept-ai-startup-agents-computer-use-founders-investors/)** in February 2026 — the same "buy the agent's hands" pattern as the Bun and Astral deals in the shell post. For context on how fast the capability moved: Sonnet 4.6 reached [72.5% on the OSWorld computer-use benchmark, up from under 15% in late 2024](https://the-decoder.com/anthropic-acquires-vercept-to-give-claude-sharper-eyes-for-reading-and-controlling-computer-screens/).

The other half is the canvas: [Claude Artifacts](https://www.anthropic.com/news/claude-3-5-sonnet) (June 2024) and [OpenAI Canvas](https://openai.com/index/introducing-canvas/) (October 2024) turned media into a surface the human and the agent edit together. The eyes are getting sharper fast. The economics still say use them last.

## What I take from this

- **Pixels are the agent's most expensive sense.** A screenshot is a costly, approximate glance — read it as ~777 tokens for a small frame, not as free.
- **Context economy still rules, one rung up.** Same constraint as the shell post: prefer the cheapest representation that is legible enough.
- **The accessibility tree quietly became perception infrastructure.** Work done for screen readers is now how agents see a page without looking.
- **Pixels are the deliberate fallback.** Reach for them for canvas, layout, and no-DOM surfaces, the cases where semantics run out.

My `shot.mjs` writes a PNG for me to open. An agent would skip the file, and skip the pixels entirely if the accessibility tree already told it what it needed to know.

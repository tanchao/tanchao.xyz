---
title: "Why some AI demos resolve text instead of typing it"
description: "Some model demos don't type left-to-right — the whole answer resolves at once, like a photo developing. That's a diffusion LLM generating tokens in parallel, not a UI trick. Here's the mechanism, the whole speed ladder from render tricks to speculative decoding to true parallel generation, and how to tell which one you're actually looking at."
tldr: "Text can look faster for two different reasons: it was generated faster (throughput) or just rendered faster (a UI trick). The demos where text resolves all at once instead of typing are diffusion LLMs — Inception's Mercury and Google's Gemini Diffusion — which denoise a whole block in parallel and can even correct themselves mid-generation, something autoregressive models structurally cannot do. Between a pure UI trick and full diffusion sits a ladder of half-measures (speculative decoding, multi-token heads, lookahead) that keep the token-by-token paradigm but cut the number of serial steps."
date: 2026-07-30
tags: ["llm", "inference", "performance", "engineering", "ai"]
draft: false
faq:
  - q: "What makes text 'appear in parallel' in some AI demos?"
    a: "It is a diffusion LLM. Instead of generating one token at a time left-to-right, a diffusion language model starts from a fully masked or noised sequence and denoises the whole block over a fixed number of refinement steps, filling in and correcting many positions at once. The visual effect is that the answer resolves all at once — like a photo developing — rather than typing. Inception Labs' Mercury and Google's Gemini Diffusion are the two best-known examples as of 2026."
  - q: "Is faster-looking text a real speedup or just a UI trick?"
    a: "It can be either, and the two are constantly confused. Text can look faster because it was genuinely generated at higher tokens-per-second (a model and serving property) or because the client buffered tokens and painted them in bigger bursts (a UI property that changes nothing about generation). Diffusion demos are the first kind. A batched client render is the second. The tell is time-to-first-token and the shape of arrival: a UI trick still waits the same total time; parallel generation actually finishes sooner."
  - q: "How is a diffusion LLM different from an autoregressive LLM?"
    a: "An autoregressive model generates token t+1 conditioned on tokens 1 through t, so generation is sequential by construction — one forward pass per token, and once a token is emitted it is fixed. A diffusion LLM generates a whole block of tokens in parallel and refines it over several denoising steps, so it can revise earlier positions during generation. Autoregressive models trade parallelism for a simpler, well-understood training objective; diffusion LLMs trade that simplicity for block-level parallelism and mid-generation error correction."
  - q: "What is speculative decoding?"
    a: "A small, fast 'draft' model proposes several tokens ahead, and the large 'target' model verifies all of them in a single forward pass, accepting the longest correct prefix. The output distribution is provably identical to running the target model alone, so it is a pure latency win — typically two to three times faster — with no quality change. It is not parallel generation; it is parallel verification. The model is still autoregressive, just taking fewer serial steps."
  - q: "How fast are diffusion LLMs compared to normal models?"
    a: "Inception Labs reports Mercury generating tokens in parallel at 5-7x higher throughput than speed-optimized frontier models, with sub-300ms time-to-first-token. Google reports Gemini Diffusion sampling at 1,479 tokens per second excluding startup overhead. Both figures come from the vendors, so treat them as best-case claims rather than independent benchmarks, but the order-of-magnitude gap over token-by-token decoding is real and comes directly from generating in parallel."
  - q: "If diffusion LLMs are faster, why isn't everything a diffusion model?"
    a: "Autoregressive models still lead on most quality benchmarks, have a decade of tooling and training know-how behind them, and reuse the KV cache to make long-context decoding cheap. Diffusion LLMs are newer, their fixed refinement-step budget is a different cost knob, and their quality is still catching up on long-form and reasoning tasks. The honest 2026 read is that diffusion is a real speed frontier for latency-sensitive uses, not a drop-in replacement for every workload."
---

> Related: [How streaming works in LLM chat and agentic systems](/posts/2026/07/23/how-streaming-works-in-llm-chat-and-agentic-systems/). That post was about how tokens *move*. This one is about how they get *made*.

Some AI demos don't type their answer. It resolves — the whole paragraph appears blurry-fast and sharpens into place, more like a photo developing than a cursor crawling left to right. That's a **diffusion LLM**, and the mechanism behind the visual is worth understanding, because it's what separates a real speedup from a UI trick.

Text can look faster for two completely different reasons, and only one of them is what's happening in those demos.

## Two reasons text can look faster

Before naming the mechanism, separate the two things people mean by "faster," because they get conflated constantly.

- **It was generated faster.** Higher tokens-per-second. This is a property of the model and the serving stack.
- **It was rendered faster.** The client buffered tokens and painted them in bigger bursts, or animated already-received text more smoothly. This is a UI property and it changes nothing about generation.

A polished chat UI does the second all the time — buffer a few tokens, flush a whole clause, ease it onto the screen so it never looks like it's stalling. That makes the *cadence* nicer. It does not make the answer *arrive* sooner; the last token still lands at the same wall-clock moment.

The resolve-all-at-once demos are the first kind, and specifically the one kind a normal model cannot do: generating many tokens genuinely at once.

## The demo is a diffusion LLM, not a UI trick

The companies are **Inception Labs** (their model is **Mercury**) and **Google** (**Gemini Diffusion**, shown at I/O in May 2025). Both are diffusion language models, and both produce that resolve-all-at-once visual for the same reason: they don't generate left to right.

A diffusion LLM starts from a fully masked or noised sequence and [refines it step-by-step, denoising the whole block in parallel](https://deepmind.google/models/gemini-diffusion/) rather than emitting one token after another. Because it works on the entire block at once, it can also **correct earlier tokens during generation** — Google describes it producing "entire blocks of tokens at once" and being able to "error correct during the generation process." An autoregressive model can't do that; once it emits a token, that token is committed.

The speed follows directly from the parallelism. [Inception says Mercury generates tokens in parallel](https://www.inceptionlabs.ai/) at "5-7x higher throughput" with "sub-300ms time to first token"; Google reports [Gemini Diffusion sampling at 1,479 tokens per second](https://deepmind.google/models/gemini-diffusion/) excluding startup. Those are vendor numbers, so read them as best-case — but the gap over token-by-token decoding is structural, not marketing. The research lineage is public too: open diffusion-LM work like [LLaDA](https://arxiv.org/abs/2502.09992) showed a masked diffusion model can compete with autoregressive models of similar size, which is what made the production demos credible rather than a party trick.

## Why normal generation is sequential by construction

To see why diffusion feels like cheating, look at what it's escaping. An autoregressive model defines the probability of a sequence as a product of conditionals: token *t+1* depends on tokens *1…t*. That factorization is the whole model. It means generation is sequential by definition — you cannot produce token *t+1* until token *t* exists, so decoding is one forward pass per token.

That's also why decoding is the slow phase. As I covered in the [streaming post](/posts/2026/07/23/how-streaming-works-in-llm-chat-and-agentic-systems/), decode is memory-bound: each step re-reads the model weights and the growing KV cache to produce a single token, and the gap between tokens (inter-token latency) is set by memory bandwidth, not raw compute. Throwing more FLOPs at it barely helps. The bottleneck is the one-token-at-a-time dependency chain itself.

Diffusion sidesteps the chain by dropping the strict left-to-right factorization. The trade is real: you give up the simple, well-understood autoregressive objective and the cheap KV-cache reuse, and you take on a fixed budget of refinement steps instead. But you buy block-level parallelism. That's the deal.

## The speed ladder that keeps the paradigm

Diffusion is the far end of the spectrum — a different paradigm. Most production speedups live in the middle: they keep autoregressive generation but cut the number of *serial* steps. Worth knowing, because these ship in models you already use.

- **Speculative decoding.** A small draft model proposes *k* tokens; the big target model verifies all *k* in one forward pass and accepts the longest correct prefix. Output is [provably identical to the target model alone](https://arxiv.org/abs/2211.17192) — a pure latency win, usually 2-3x. This is not parallel generation; it's parallel *verification*. (If you've heard the podcast framing of "a fast draft model feeds a stronger model for higher throughput" — this is that. Same idea, proper name.)
- **Multi-token prediction.** Bolt extra heads onto the model so it guesses several future tokens per step, then verifies them. [Medusa](https://arxiv.org/abs/2401.10774) popularized the approach; DeepSeek-V3 [trained with a multi-token-prediction objective](https://arxiv.org/abs/2412.19437) directly. More parallelism than vanilla decoding, less than full diffusion.
- **Lookahead / guess-and-verify decoding.** Generate candidate n-gram continuations in parallel and verify them in the same pass, no separate draft model needed.

The common move across all three: the model is still autoregressive and the output is unchanged, but you stop paying for one serial forward pass per token. Diffusion is what happens when you stop paying for the serial dependency at all.

## Where diffusion wins, and where it doesn't

The honest read matters more than the demo. Diffusion LLMs are a genuine speed frontier for latency-sensitive work — sub-300ms first token and thousand-plus tokens per second is not something an autoregressive model reaches without heavy speculative machinery. For interactive coding, autocomplete, and anything where the user is watching the cursor, that's a real edge.

But it is not a free lunch, and pretending otherwise fails the accuracy floor:

- **Quality is still catching up.** Autoregressive models lead most reasoning and long-form benchmarks as of 2026, with a decade of training know-how behind them.
- **The cost knob is different.** Diffusion spends a fixed number of refinement steps per block. Fewer steps is faster but lower quality; it's a dial, not a floor.
- **No cheap KV cache.** Autoregressive decoding reuses the KV cache to make long-context continuation cheap. Block diffusion doesn't get that reuse for free, which changes the cost curve at long context.

So the 2026 picture is a spectrum, not a winner: token-by-token for maximum quality, the speculative-decoding family for a safe 2-3x with identical output, diffusion for when latency is the product and you can tolerate a newer, still-maturing quality bar.

## How to tell which one you're looking at

Since "faster" hides two mechanisms, here's the practical test — the mechanism matters more than the marketing.

- **Watch time-to-first-token, then the shape of arrival.** A UI render trick waits the same total time and just repaints in bursts; the last token lands when it always would have. Real parallel generation finishes the whole answer sooner.
- **Does earlier text change after it appears?** If tokens already on screen get revised as generation continues, that's diffusion's mid-block error correction — autoregressive output never rewrites what it already committed.
- **Does it type or resolve?** Left-to-right, one token deep, is autoregressive (however fast). A blurry block sharpening into place is diffusion.
- **Read the docs, not the animation.** "Generates in parallel" / "diffusion" / "denoising" means the real thing. "Smooth streaming" or "faster rendering" usually means the client.

## Takeaways

- **"Faster" is two different claims.** Generated-faster is a model property; rendered-faster is a UI property. Ask which one before you're impressed.
- **The resolve-all-at-once visual is a diffusion LLM.** Inception's Mercury and Google's Gemini Diffusion denoise a whole block in parallel instead of typing it token by token.
- **Autoregressive generation is sequential by construction.** Token *t+1* depends on token *t*, so decode is one memory-bound pass per token — that dependency chain is the bottleneck diffusion drops.
- **There's a ladder between the two.** Speculative decoding, multi-token heads, and lookahead keep the paradigm and just cut serial steps; speculative decoding is the proper name for the "draft model feeds a stronger model" pattern.
- **Diffusion is a frontier, not a replacement.** It wins on latency; autoregressive still wins on quality and cheap long-context decoding in 2026. Pick by what the workload is actually paying for.

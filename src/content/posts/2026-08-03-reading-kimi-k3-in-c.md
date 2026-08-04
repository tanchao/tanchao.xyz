---
title: "Reading kimi-k3-in-c: 2.8T parameters in 8GB of RAM"
description: "A learning note from reading FareedKhan-dev/kimi-k3-in-c — a C99 engine that runs Moonshot's 2.78T-parameter Kimi K3 on one CPU in 8.24GB. What I found is less an ML project than a storage-engineering one, with a few results that surprised me."
tldr: "kimi-k3-in-c fits a 1.56TB mixture-of-experts model into 8.24GB by keeping the always-on part resident and streaming the sleeping experts off NVMe. Reading it taught me three things I did not expect: you can multiply straight from 4-bit weights without ever dequantizing, an LRU cache can be strictly worse than pinning because the model's own training flattens expert usage, and allocation beats capacity — at a fixed memory budget, feeding the trunk instead of the cache was 1.69x faster."
date: 2026-08-03
tags: ["learning-notes", "ai", "llm", "performance", "engineering"]
draft: false
---

Notes to myself from reading [FareedKhan-dev/kimi-k3-in-c](https://github.com/FareedKhan-dev/kimi-k3-in-c).

A small C99 engine that runs [Kimi K3](https://github.com/moonshotai/kimi-k3), Moonshot's 2.78-trillion-parameter model (1.56TB on disk), on one CPU in a measured 8.24GB of RAM. No GPU, no BLAS, no framework. 176KB binary. The [author's write-up](https://medium.com/@fareedkhandev/building-kimi-k3-in-c-to-run-a-2-8t-model-on-consumer-hardware-a5792cbf3b59) walks it component by component.

What stuck with me: this looks like an ML project but reads like a storage one. The hard parts are not matrix math. They are which bytes must stay in memory and which can live on disk.

## Core idea: stream the sleeping experts

Kimi K3 is a mixture of experts. Each of 92 layers holds 896 experts; the router picks 16 per token. So 93% of the 1.56TB checkpoint is expert weights, and 96% of them stay asleep for any token.

The strategy: keep the always-on part resident, make the sleeping 93% reachable but never loaded. The memory ledger, four steps:

- **5,560GB** — every parameter at bf16. The naive number.
- **1,560GB** — as shipped; experts arrive at half a byte per weight.
- **113GB** — resident set once experts never load.
- **8.24GB** — measured, once the trunk is streamed instead of held.

675x smaller than bf16, byte-identical output. The 8GB run gives the same token ids as the 224GB run.

## MXFP4: multiply without dequantizing

Experts ship in MXFP4: each weight is a nibble into a 16-value table, one shared 8-bit scale per 32 weights. 0.53125 bytes per weight.

The obvious move is to expand the nibbles to float32 and run a normal matmul. I'd have done that without thinking. Cost: ~194GB of pure format conversion per token, before a single multiply.

So the engine never dequantizes. The matmul reads the packed nibbles and multiplies straight from them. The step I assumed was mandatory was the most expensive thing you could do.

## Trunk cache: pin, don't LRU

The engine walks layers 0→92 in the same order every token. A cyclic scan is the worst case for LRU: by the time layer 0 comes round again, it is the least-recently-used thing, so it has always just been evicted. An LRU of 90 slots over a 93-layer cycle hits exactly zero.

Pinning the first N layers gives a deterministic N/93. Pin 90, get 96.8%. The clever structure returns zero where the trivial one returns almost one.

Databases have special-cased sequential scans for this for decades: a big scan blows out the buffer pool, so you give it a small ring instead. Same shape, different domain.

## Expert cache: allocation beats capacity

The second cache, for routed experts, did nothing. From 8GB to 64GB of budget, every run read exactly 25.83GB per token. The cache grew 48x and moved the same bytes. Not caching inefficiently. Not caching at all.

The reason is in the model. Kimi K3 is trained to flatten expert usage across the pool, so no small set dominates. Flat usage is exactly what defeats an LRU: no hot subset, nothing worth keeping. The training choice that helps the model defeats the cache.

Better still: fix total memory at 128GB, vary only the trunk/cache split.

- Cache-heavy: 28.38 s/token, 44% hit rate.
- Trunk-heavy: 16.80 s/token, 0% hit rate.

**1.69x faster from allocation alone, same total memory.** The winner reads 79% *more* expert bytes and still wins, because the trunk is re-read in full every token while experts are only sampled. Optimizing the obvious metric, cache hit rate, takes you to the slower machine.

## Correctness: fluent but wrong

The header lists five invariants, each a mistake that compiles, runs, and produces fluent English from the wrong model. No crash, no NaN. Example: the routing bias steers *selection only*, while the combine weights come from the unbiased scores. Collapse the two into one variable and you get a different model that still writes clean prose.

That reframed testing for me. When wrong code still sounds right, distribution checks and "looks fine" are useless. The defenses are all bit-exactness:

- All paths (scalar, OpenMP, AVX2) must produce identical bits, so `-ffp-contract=off` kills the fused multiply-add. It rounds differently, and hardware must never change the output.
- The config reader errors on a missing field, never defaults. A guessed field silently yields a different architecture.
- The reference is checked against Moonshot's *released* PyTorch, not a self-written one. A shared misreading would pass every internal test.

The write-up is honest about its limits: "matches the reference exactly" is a 13-layer toy model, not the full 2.8T. The full-stack logit check used a five-punctuation-character prompt and never touched the KV cache. Strong evidence on arithmetic, none on output quality.

## Performance

It works, and it is slow. ~10.7 s/token at best, ~33 s/token at the 8GB floor. 8GB→224GB, 28x the memory, bought 1.70x the speed.

My first reaction was disappointment. Then it clicked: ~80% of a token is spent waiting on disk, not computing. When the wall is I/O, more cache RAM is not where the speed lives. He even measures the measurement: three identical runs varied by 33%, so smaller timing claims get thrown out as noise.

## Key takeaways

- **Sparsity is a storage strategy, not just a compute one.** MoE means 93% of the weights can live on disk. The engine is mostly I/O plumbing: pinning, `O_DIRECT`, batched reads.
- **Question the step you assume is mandatory.** Multiplying straight from 4-bit nibbles saved ~194GB of memory traffic per token.
- **The obvious data structure can be exactly wrong.** LRU over a cyclic scan hits zero; a dumb pinned prefix hits 96.8%. Know the access pattern before reaching for a cache.
- **Allocation can beat capacity.** At a fixed budget, feeding the trunk over the cache was 1.69x faster, and the winner had a 0% cache hit rate. The intuitive metric pointed the wrong way.
- **When wrong code still sounds fluent, only bit-exactness saves you.** Disable FMA, refuse config defaults, diff against the real released model.

The real difficulty in running a huge model sits further from the math than I expected.

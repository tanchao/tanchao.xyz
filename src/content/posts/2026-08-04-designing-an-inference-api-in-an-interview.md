---
title: "How I would design an LLM inference API in a system design interview"
description: "A 45-minute interview script for designing an LLM inference API, worked end to end on a 70B model and an H200: the KV-cache arithmetic that caps concurrency at one request for a 200K prompt, why no batch size makes decode compute-bound, when to reach for chunked prefill versus full prefill/decode disaggregation, and how cache tiers and priority classes fall out of the numbers."
tldr: "Designing an inference API in an interview comes down to one claim: the objective function is goodput under a latency SLO, not tokens per second. Everything else follows from arithmetic — KV cache per token sets your batch size, decode is memory-bandwidth-bound while prefill is compute-bound, so the two phases belong on different GPU pools. Spend the first five minutes on the traffic shape, the next ten on the capacity math, and the rest on routing, cache tiers, and priority classes."
date: 2026-08-04
tags: ["ai", "llm", "inference", "system-design", "interview", "performance", "engineering"]
draft: false
faq:
  - q: "What is the objective function when designing an inference API?"
    a: "Goodput, not throughput. The DistServe paper defines it as the maximum request rate servable while staying within both the time-to-first-token and time-per-output-token constraints. Throughput alone can be inflated by batching until every individual stream is unusably slow, which is why it is the wrong target. State the SLO first, then maximize rate subject to it."
  - q: "How do you calculate KV cache size per token?"
    a: "bytes per token = 2 × layers × KV heads × head dimension × bytes per element, where the leading 2 covers the key and value tensors. A 70B-class model with 80 layers, 8 grouped-query KV heads, and head dimension 128 in FP16 costs 327,680 bytes, or 320 KiB per token."
  - q: "How many concurrent requests fit on one GPU?"
    a: "Divide the HBM left after weights by the KV cost per token, then by context length. A 70B model in FP8 on a 141 GB H200 (131 GiB) spends 65 GiB on weights and leaves roughly 62 GiB for KV cache, or about 203,000 tokens. That is roughly 25 concurrent requests at 8K context, 6 at 32K, and exactly one at 200K — a single 200K request consumes 61 GiB of KV cache on its own."
  - q: "Can batching ever make LLM decode compute-bound?"
    a: "Not at realistic context lengths. Counting weight reads alone suggests a batch of about 206 would reach an H200's 412 FLOP/byte FP8 ridge point, but KV cache reads scale with the batch too, so intensity converges to 2P ÷ (context × KV bytes per token) with no batch term — roughly 53 FLOP/byte at 8K context, 13 at 32K, and 2 at 200K. Decode is structurally memory-bound, and batching stops paying once KV traffic dominates the read."
  - q: "Does quantization reduce the batch size needed to saturate a GPU?"
    a: "Not in the weight-dominated regime. Halving precision doubles compute throughput but also halves the weight bytes read per decode step, so intensity and the ridge point scale together and the required batch stays near 206. Quantization buys lower memory traffic and faster wall-clock decode rather than a smaller batch requirement. Once KV cache dominates read traffic — long context or high occupancy — weight precision stops being the lever and KV cache precision becomes one."
  - q: "Should you use chunked prefill or full prefill/decode disaggregation?"
    a: "Chunked prefill is the cheaper change and often sufficient: Sarathi-Serve slices prefills into equal chunks for stall-free scheduling, reporting 2.6× serving capacity on Mistral-7B and up to 5.6× on Falcon-180B. Full disaggregation pays off at scale — DistServe reports 7.4× more requests or a 12.6× tighter SLO — but it makes KV cache transfer a correctness surface and demands fast, homogeneous interconnect."
  - q: "Is speculative decoding lossless?"
    a: "Yes, when implemented correctly. A draft model proposes tokens and the target model verifies them in one forward pass, with a rejection-sampling step that leaves the output distribution unchanged; Leviathan et al. report 2×–3× on T5-XXL with no change to outputs. Acceptance rate depends on how well the draft model matches the traffic, so gains are workload-specific. Quantization is the only genuinely lossy step in the usual stack."
  - q: "How should an inference API handle multi-tenancy?"
    a: "Price latency instead of chasing fairness. Enforce per-tenant token buckets on requests and tokens per minute and return 429 with a retry-after header rather than degrading everyone. Then split traffic into an interactive tier holding reserved decode slots and a deferred batch tier that consumes headroom — Anthropic's Batch API prices that deferral at 50% of standard rates with a 24-hour window."
---

An inference API is a scheduler for scarce memory bandwidth, and the objective function is goodput under a latency SLO — not tokens per second. If you state that in the first two minutes, the rest of the interview is arithmetic. Draw the load balancer and the GPU pool first and you can get thirty minutes in before noticing you never worked out how many requests fit in one GPU, which is the number every other decision depends on.

Latent Space's [The Inference Engineering Masterclass](https://www.latent.space/p/inference-eng) with Baseten's Philip Kiely and Ali Taha is where several of the production details below come from. What follows is how I would run the 45 minutes, with the numbers I would work on the whiteboard. The architecture and trade-offs from that episode are in a companion note, [the trade-offs don't transfer](/posts/2026/08/04/inference-architecture-tradeoffs/).

## The time budget

| Minutes | What you produce |
|---|---|
| 0–5 | Traffic shape, not a requirements list |
| 5–8 | The SLO, and goodput as the objective |
| 8–18 | Capacity math on a named model and a named GPU |
| 18–30 | Architecture: router, prefill/decode pools, cache tiers |
| 30–38 | Multi-tenancy, priority classes, pricing |
| 38–45 | Failure modes and the probes |

The unusual allocation is minutes 8–18. Ten minutes of arithmetic feels like a long time to spend not drawing. It is the part that decides whether the architecture you draw afterward is defensible.

## Clarify the traffic shape, not the requirements

Ask four questions, because each one changes the design and nothing else does.

1. **What is the prompt-to-output ratio?** A 200K-token prompt with a 200-token answer is a prefill system. A 500-token prompt with a 4K answer is a decode system. These have almost nothing in common.
2. **How much prefix is shared?** If every request carries the same 10K-token system prompt, cache reuse is the highest-leverage thing in the design. If every prompt is unique, it is worth nothing.
3. **Streaming or batch?** Streaming makes inter-token latency a user-visible SLO. Batch makes it irrelevant.
4. **One model or many?** Multi-model changes the whole capacity story, because weights are the fixed cost and you cannot amortize them across models on the same GPU.

Do not ask about DAU or QPS first. Request count is a weak signal here; token count and prefix overlap are the strong ones.

## Goodput is the objective function

Name the three metrics and pick the one you are optimizing.

- **TTFT** — time to first token, set by prefill.
- **TPOT / ITL** — time per output token, set by decode. This is what a user perceives as speed.
- **Throughput** — total tokens per second across the fleet, which is what the accountant perceives.

The trap is that throughput and TPOT trade off directly. You can raise throughput by batching harder until every individual stream crawls. So the number to maximize is **goodput**: what the [DistServe paper](https://arxiv.org/abs/2401.09670) frames as "the maximum rate that can be served within both TTFT and TPOT constraints on each GPU."

This distinction is live in practice, not just in papers. Kiely and Taha put it bluntly: "there's tokens per second as the throughput number, and the latency number. Most people only care about tokens per second as the latency number." Two different quantities, one name. Separate them explicitly before you draw anything.

Commit to numbers. I would propose TTFT p95 under 500 ms for prompts up to 8K, and TPOT p95 under 25 ms — about 40 tokens/sec/stream, roughly reading speed.

## The capacity math

Take a 70B-class model on an H200. Weights in FP8, KV cache in FP16.

The KV cache per token:

```
bytes/token = 2 × layers × kv_heads × head_dim × dtype_bytes
            = 2 × 80 × 8 × 128 × 2
            = 327,680 bytes  ≈ 320 KiB/token
```

The leading 2 is key plus value. The 8 KV heads rather than 64 is grouped-query attention, which is why this number is tolerable at all.

Now the HBM budget, and it is worth keeping the units honest — NVIDIA quotes capacity in decimal GB while KV cache math is naturally binary. The [H200 SXM](https://www.nvidia.com/en-us/data-center/h200/) has 141 GB of HBM3e at 4.8 TB/s, which is 131 GiB. FP8 weights take 70 GB, or 65 GiB. That leaves 66 GiB; reserve ~4 GiB for activations and workspace and call it **62 GiB for KV cache**:

```
62 GiB ÷ 320 KiB/token ≈ 203,000 tokens of KV cache
```

That single number sizes everything:

- At 8K average context: ~25 concurrent requests per GPU.
- At 32K: ~6.
- At 200K — the long-context case the podcast opens with: **one**.

One request, occupying 61 GiB — 200,000 × 320 KiB, which is essentially the entire KV budget of the GPU. That is the number I would write largest on the board, because it quietly reprices the product: at 200K context you are not selling tokens, you are renting most of a GPU.

### Why decode is bandwidth-bound

Every decode step reads the full weight matrix to produce one token per sequence, plus each batched sequence's KV cache for attention. Count only the weights first, because that is the version most people carry around:

```
2 × P × B FLOPs ÷ P bytes = 2B FLOP/byte      (FP8 weights, 1 byte/param)
```

The H200's FP8 ridge point — peak dense compute over bandwidth — is 1,979 TFLOPS ÷ 4.8 TB/s ≈ **412 FLOP/byte**, taking the dense half of the [3,958 FP8 TFLOPS NVIDIA quotes with sparsity](https://www.nvidia.com/en-us/data-center/h200/). At batch size 1 you sit at 2 FLOP/byte: **0.5% of the silicon you are paying for**. The weight-only model says B ≈ 206 closes the gap.

It doesn't, and the correction is the more useful half. KV reads scale with the batch too:

```
intensity = 2·P·B ÷ (P + B × L × 320 KiB)
```

At 8K context and full occupancy — B = 25, from the budget above — KV traffic is 61 GiB against 65 GiB of weights. The two are comparable, so roughly half the read is something the weight-only model never counted. Push B higher and the denominator grows as fast as the numerator, so intensity converges to a ceiling with no batch term in it at all:

```
2P ÷ (L × 320 KiB)  =  53 FLOP/byte at 8K,  13 at 32K,  2 at 200K
```

**No batch size saturates decode compute.** At 8K context the ceiling sits eight times below the ridge, and longer context makes it worse rather than better. Decode is structurally memory-bound: batching buys throughput until KV traffic dominates the read, then it stops buying anything. That is the real reason a decode pool looks nothing like a training cluster, and the reason the next section exists.

It also bounds a claim worth stating carefully. In the weight-dominated regime — small batch, short context — halving precision doubles compute and halves weight bytes together, so the batch you would need is unchanged at 206. Once KV cache dominates the read, weight precision stops being the lever and KV precision becomes one.

Prefill sits on the other side of the roofline. At ~2P FLOPs per token, one H200 does 1,979 TFLOPS ÷ 140 GFLOPs ≈ 14,000 prefill tokens/sec at FP8 peak, so a 200K prompt is ~14 seconds of pure compute at 100% utilization and closer to 30 at a realistic 50%. Nobody waits 30 seconds for a first token, which is why prefill gets sharded across GPUs.

## Prefill and decode belong on different GPUs

This is the architectural claim I would build the whole design around, and it falls straight out of the numbers above: prefill saturates compute, decode saturates bandwidth. Colocate them and a long prefill stalls every decode sharing that GPU.

There are two published answers, and a strong candidate knows both.

**Chunked prefill** keeps them together but slices the prefill. [Sarathi-Serve](https://arxiv.org/abs/2403.02310) splits a prefill into near-equal chunks and builds "stall-free schedules that add new requests in a batch without pausing ongoing decodes," reporting 2.6× serving capacity for Mistral-7B on one A100 and up to 5.6× for Falcon-180B.

**Disaggregation** separates them physically: one pool of GPUs processes the input and produces the KV cache and the first token, then hands that cache to a separate pool that runs decode. DistServe reports this serves **7.4× more requests, or meets a 12.6× tighter SLO**, than colocated systems while holding latency for over 90% of requests.

The warehouse comparison is the one I reach for: this is why you do not run overnight ETL and interactive dashboards on the same Snowflake warehouse. Same data, opposite access patterns, and the bursty job starves the latency-sensitive one. The fix in both worlds is separate compute against shared state — and in both worlds it moves the hard problem to state transfer, which is where the bodies are buried.

## The cache hierarchy is the real system

Once prefill and decode are separate, KV cache becomes the object the architecture is organized around. Four tiers, cheapest first:

1. **Paged HBM.** [vLLM's PagedAttention](https://arxiv.org/abs/2309.06180) manages KV cache in fixed blocks like OS virtual memory, achieving "near-zero waste in KV cache memory" and 2–4× the throughput of prior systems at the same latency. This is table stakes.
2. **Prefix reuse.** [SGLang's RadixAttention](https://arxiv.org/abs/2312.07104) automatically reuses KV cache across requests sharing a prefix, reporting up to 6.4× higher throughput. Providers surface the economics directly: Anthropic bills a cache read at ~0.1× base input price against 1.25× for a 5-minute write, so the break-even is two requests.
3. **CPU / NVMe offload.** Cheaper than recompute for a warm conversation, more expensive than HBM.
4. **Recompute.** The fallback, and sometimes correct — recomputing a short prefix beats fetching it.

The router is what makes tiers 1 and 2 pay off. It must be **cache-aware** rather than round-robin: send a request to a replica that already holds its prefix, because a miss here turns a 0.1× cache read back into a full recompute.

So the router needs per-replica prefix-cache state, queue depth tracked separately for prefill and decode, and a scoring function that trades cache-hit value against load. Say out loud that this makes the router stateful, and that a stateful router needs its own failover story.

## Decode-side multipliers

The cache tiers reduce work you would otherwise repeat. Two more levers change the cost of the work that remains, and they differ in one way that matters.

**Speculative decoding converts spare compute into tokens.** A draft model proposes several tokens; the target verifies them in one forward pass. [Leviathan et al.](https://arxiv.org/abs/2211.17192) report 2×–3× on T5-XXL "without changing the distribution" — genuinely lossless. It works for exactly the reason the roofline gave: verifying several tokens costs one weight read instead of several, and spare compute is the thing decode has in surplus. The size of the win depends on acceptance rate, which Baseten illustrates concretely: "if you're summarizing Harry Potter books, I can train exclusively that draft model on Harry Potter books, and I can guarantee you that I'm gonna accept the three tokens every single time." Narrow traffic, high acceptance — which is an argument for per-customer draft models, and therefore for dedicated deployments.

**Quantization is the exception.** It is the only lossy step in this stack, which is why it belongs behind a quality gate and an eval suite while the rest do not.

## Multi-tenancy is a pricing problem

Fair queueing is the wrong frame. Latency is the product, so sell it.

- **Admission control.** Per-tenant token buckets on requests per minute and tokens per minute, separated into input and output. Return 429 with a `retry-after` header rather than degrading everyone.
- **Priority classes.** An interactive tier that holds reserved decode slots, and a batch tier that consumes headroom. Anthropic's Batch API prices that deferral at 50% of standard rates with a 24-hour completion window — a real number for what latency is worth.
- **Shared versus dedicated.** Shared endpoints amortize weights across tenants. Dedicated wins when a tenant's volume justifies a custom draft model, a specific quantization, or a hard SLA — and the cost floor is a dedicated GPU rather than a per-token rate, so the crossover is a volume question you should be able to state.

## What actually breaks

Three failure modes, from the operationally boring to the genuinely nasty.

- **Queue collapse.** Decode slots fill, prefill queues grow, TTFT degrades and clients retry — which adds load. Needs load shedding at the admission layer and a queue-depth signal in autoscaling, not just GPU utilization.
- **Autoscaling lag.** Cold-starting a 70B replica means loading 70 GB of weights. Your scale-up latency is minutes; your traffic spike is seconds. Warm pools are not optional.
- **Heterogeneous hardware.** The one I would not have predicted: identical software on different clusters producing different results, because "the KV cache transfer from a node to node in that one cluster is using a slower interconnect than the node to node in another cluster." That is one team's reported experience rather than a published result, so I would offer it as an anecdote and not a law — but the structural point stands on its own. Disaggregation turns cache transfer into a correctness surface, not just a latency one.

## The probes to expect

- *A tenant sends one 500K-token prompt. What happens?* It does not fit in one GPU's KV budget. Answer with prefill sharding and a per-request context cap that is a product decision, not a bug.
- *Your p99 TTFT is fine but p99.9 is 30 seconds. Why?* Almost certainly head-of-line blocking from an unchunked prefill, or a cache-aware router hot-spotting onto one replica.
- *How do you roll out a new model version safely?* Weights are the deploy artifact and they are enormous. Shadow traffic, per-replica canaries, and a quality gate — quantization regressions are silent.
- *Cut cost 40% without touching the SLO.* Quantize, raise the prefix cache hit rate, then move eligible traffic to the batch tier. In that order, because only the first is lossy.

The thing I would not do is present any of this as a stack of techniques. Every item above is downstream of two numbers: 320 KiB of KV cache per token, and a ridge point at 412 FLOP per byte. One says how many requests fit. The other says how many you would need for the GPU to be busy. They disagree by an order of magnitude, and every component in the design is something built in that gap. Get both on the whiteboard in the first fifteen minutes and the architecture argues for itself.

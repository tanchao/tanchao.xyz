---
title: "Compressing a 108 GB weight stream 31%, without changing a bit"
description: "An offloaded 2.8T-parameter MoE model re-reads 108.81 GB of dense weights per token. Byte-splitting bf16 before compression removes 31% of those bytes losslessly. What I built, what I measured, and the four ideas that were already taken."
tldr: "Kimi K3's dense trunk is streamed verbatim from NVMe because quantising it costs real accuracy. That argument is right, and it quietly made the size of the lossless stream feel fixed. It is not: a bf16 stream interleaves a 2.7-bit exponent plane with a 7.97-bit mantissa plane, so splitting the two before zstd compresses real layer runs to 0.687x with bit-identical output, taking the 108.81 GB trunk to about 74.6 GB. I implemented it as a blocked codec in kimi-k3-in-c, verified inflation against the original checkpoint bytes, and could not measure the time it saves without Linux and a 1.56 TB disk."
faq:
  - q: "Does compressing model weights lose precision?"
    a: "Not here. This is lossless compression, so the inflated bytes are bit-identical to the checkpoint's. That is different from quantisation, which discards precision to save space. The two are often conflated because both make weights smaller."
  - q: "Why not just quantise the trunk to 4-bit instead?"
    a: "Because those weights were never trained for it. Kimi K3's technical report says the non-expert components stay in higher precision, and post-hoc int4 measures 17.4% mean relative weight reconstruction error against 0.96% for int8. Lossless compression gets 31% of the size benefit at zero error."
  - q: "Why does byte-splitting help so much?"
    a: "A bf16 value packs a clustered exponent next to a near-random mantissa. Measured per tensor, the high byte carries 2.65 to 3.41 bits of entropy and the low byte carries 7.97 of a possible 8. Interleaved, the compressible half is diluted. Split into two planes, zstd can work on the structured one."
  - q: "What does inflation cost in CPU?"
    a: "About 1.7 GB/s per core at zstd level 1, so roughly six cores keep pace with a 6.5 GB/s device. In this workload the cores are idle 40 to 60% of the time waiting on disk, so the trade is favourable."
  - q: "Does this make inference faster?"
    a: "It moves 31% fewer bytes, which is measured. How many seconds that saves is not measured — that needs Linux and the full 1.56 TB checkpoint, neither of which I have. Treat the speedup as a projection."
  - q: "Why 4 MB blocks and compression level 1?"
    a: "Both came from measurement. The ratio is flat from 4 MB to 256 MB blocks, and read bandwidth is flat from 1 MB to 16 MB reads, so nothing argued for large blocks while scratch memory argued for small. Level 1 beat level 3 on both ratio and speed."
  - q: "Does it break existing packed trunks?"
    a: "No. A raw manifest has no codec key, so old files load unchanged. A binary built without zstd that is handed a compressed trunk prints why and stops rather than reading the wrong bytes."
date: 2026-08-04
tags: ["ai", "llm", "performance", "engineering", "inference", "storage"]
draft: true
---

Byte-splitting bf16 weights before compressing them takes a streamed 108.81 GB model trunk down to 74.6 GB, bit for bit identical. The gain comes from separating two planes with very different entropy. In a bf16 weight the exponent byte carries about 2.7 bits of information and the mantissa byte carries 7.97 of a possible 8. Interleaved, the compressible half is diluted by the incompressible one.

> Follow-up to [Reading kimi-k3-in-c: 2.8T parameters in 8GB of RAM](/posts/2026/08/03/reading-kimi-k3-in-c/). That was a reading note. This is what happened when I tried to improve the thing.

## Where the bytes go in an offloaded MoE

[kimi-k3-in-c](https://github.com/FareedKhan-dev/kimi-k3-in-c) runs [Kimi K3](https://github.com/moonshotai/kimi-k3), a 2.78-trillion-parameter mixture of experts, on a single CPU. It keeps the always-active weights resident and streams the sleeping experts off NVMe. The [checkpoint](https://huggingface.co/moonshotai/Kimi-K3) is 1.56 TB of [safetensors](https://github.com/huggingface/safetensors) shards. My [reading note](/posts/2026/08/03/reading-kimi-k3-in-c/) framed the expert stream as the interesting I/O problem. Reading the repo's own numbers more carefully, that emphasis was wrong.

Per token, at the smallest memory budget:

| | bytes per token | access order |
|---|---|---|
| Dense trunk, 93 layers | **108.81 GB** | fixed, layer 0 to 92, every token |
| Routed experts, 16 of 896 per layer | 25.83 GB | router-dependent |

The trunk is 4.2 times the bytes. The repo says so directly in `docs/TUNING.md`. It is why the project's central tuning advice is to feed the trunk before the expert cache. One expert is a contiguous 17,547,264-byte region; one layer's trunk is 1,267,744,256 bytes. The big term was the one I had not been looking at.

## Four ideas that were already taken, or already marginal

I started with five candidate optimisations. Four were dead or too small to matter, and finding that out was most of the work.

| Idea | Outcome |
|---|---|
| Issue the 16 expert reads concurrently | Already done, `src/cache/k3_cache.c:180`. Measured headroom on my hardware: 6.39 GB/s at queue depth 1 against 7.26 saturated, so 1.14x |
| Parallelise the trunk read | The author's single-threaded O_DIRECT read already sustains 6.55 GB/s. Little left to recover |
| Quantise the trunk | Already measured and rejected, with data in `docs/data/trunk-quantisation.txt` |
| Losslessly compress the expert stream | Real but small. The [MXFP4](https://medium.com/@fareedkhandev/building-kimi-k3-in-c-to-run-a-2-8t-model-on-consumer-hardware-a5792cbf3b59) nibbles carry 3.75 bits of 4, so 11.4% off a term that is only 19% of the bytes |

The fifth was compressing the trunk losslessly, which is the rest of this post.

The quantisation entry is the one worth dwelling on, because the author's reasoning is better than mine was. Kimi K3's technical report is quoted in the engine's header, from section 4.1.4. The experts got quantisation-aware training. The attention projections, latent MoE projections, shared experts and routers stayed in higher precision. That list is exactly the trunk.

The checkpoint's own [`config.json`](https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json) corroborates it independently: the MXFP4 quantisation config carries an `ignore` list covering `self_attn`, `shared_experts`, the dense `mlp` projections and `lm_head`. Those components ship in bf16. Post-hoc int4 on real weights then measures 17.4% mean relative reconstruction error against 0.96% for int8. So the engine quantises nothing, and `src/io/k3_trunk.h` puts it plainly: "Streaming costs zero error. The bytes are the checkpoint's own bytes."

That argument is correct. It also created the blind spot. Once "lossless" is established as the virtue, the size of the lossless stream starts to feel like a fixed cost. The repo's roadmap lists a precision dial for the trunk, which is the lossy route. Lossless compression is not mentioned anywhere in the tree.

## Why bf16 compresses when the packed experts barely do

Generic compression on a raw bf16 trunk gets 0.80x. That is weak enough to look like a dead end, and it is why the idea is easy to dismiss. The reason it is weak is that a bf16 stream interleaves two populations with different statistics.

Measured on real layer-4 tensors from the checkpoint:

- High byte, sign plus 7 exponent bits: **2.65 to 3.41 bits** of entropy. Weights cluster tightly around zero, so the exponent barely varies.
- Low byte, mantissa: **7.97 bits** of a possible 8. Very nearly random.

Deinterleave the two into separate planes and the compressor can work the structured one instead of averaging over both. With [zstd](https://github.com/facebook/zstd) at level 1, that takes 0.80x to **0.687x**, within 2.4% of the order-0 entropy bound for the split. There is almost nothing left for a stronger coder to find.

This is the columnar-storage trick. A row-major layout puts a timestamp next to a float next to a string, and a compressor sees noise. Group each column together and every run becomes homogeneous. Same shape, different domain. The reading note found a buffer-pool analogy in the same codebase. Storage engineering keeps turning out to be the right reference frame here.

Two layers 46 apart agree to within 0.2% (0.6870 and 0.6853), so this generalises across the model rather than being a property of one tensor.

## The block format

Each layer's run is stored as independently compressed blocks rather than one stream. Independence buys two things: the read and the inflate can overlap, and every thread writes a disjoint range of a buffer nothing else is reading. That second property is why the codec needs no locking. Contrast the next-layer prefetch, which the author deliberately left unwritten: it would introduce a concurrent writer to a slot the kernels are still reading.

Both format constants came from measurement rather than taste.

- **Block size, 4 MB.** The ratio is indifferent to it: 0.6869 at 4 MB against 0.6870 at 256 MB. Read bandwidth is also indifferent. Measured at queue depth 8 over an 80 GB file, so nothing was cache-resident: 6.61 GB/s at 4 MB against 6.46 at 16 MB. Since neither argued for large blocks, the deciding cost is scratch memory, and the project exists to make RAM a dial. 4 MB costs about 8 MB per thread.
- **Compression level 1.** It beat level 3 on both axes: 0.6859x at 838 MB/s against 0.7143x at 355 MB/s. Higher levels lose because a larger window finds nothing in a near-random mantissa plane while spending more time looking.

Two details keep the existing design intact. Every block starts on a 4096-byte boundary, so `O_DIRECT` reads still work and the page cache stays bypassed. And each block's inflated length is recorded in the manifest instead of derived from the block-size constant. That earned its keep immediately: when I lowered the block size from 16 MB to 4 MB, trunks packed with the old value still read correctly.

## Verifying that lossless means lossless

A compression ratio cannot tell you the bytes are right. Swapping the exponent and mantissa planes of every weight would not crash, would not produce a NaN, would not fail a length check, and would not change the ratio. It would silently substitute a different model that still writes fluent English. That is the same failure class as the five invariants at the top of the engine's own header.

So the checks are all byte comparisons, and the important ones cross the language boundary:

1. **Against the source checkpoint.** Inflate each layer and compare to the original bytes in the safetensors shard, not just to a raw repack. A self-consistently wrong packer passes the second test and fails the first.
2. **C against Python.** The test fixture is generated by the real packer's split routine. The C inverse must recover the original bytes from it. A round-trip written entirely in C would pass with both sides consistently wrong.
3. **A mutation test.** I swapped the planes on purpose and confirmed the test fails and names the cause. A test that cannot fail is worth nothing.
4. **Five adversarial layer shapes.** A run that is not a multiple of the block size, one that is an exact multiple, one smaller than a single block, one with more blocks than threads, and one of odd total length so the final block is stored unsplit.
5. **Thread-count invariance.** Identical output at 1, 2, 3, 5, 8, 12 and 16 inflate threads.

## ThreadSanitizer over OpenMP: report shape beats report count

The parallel inflate is where a real bug would live, so I ran it under [ThreadSanitizer](https://clang.llvm.org/docs/ThreadSanitizer.html). It reported 28 data races. None of them were bugs, and the reason is worth knowing before anyone trusts a clean or a dirty TSan run over OpenMP.

Homebrew's [libomp](https://openmp.llvm.org/), like most distribution builds, is compiled without TSan annotations. So TSan cannot see the implicit barrier at the end of a parallel loop. Every main-thread read after the region looks like a race with the worker writes inside it. Over 20 runs I measured 50 such reports, all benign.

The useful signal turned out to be the report's *shape*, not its count:

- **Main against worker.** Expected. An artefact of the invisible barrier.
- **Worker against worker.** Real. Two threads on one buffer is exactly the scratch-aliasing bug the design is arranged to prevent, and it is what cost the author a wrong token in the expert cache.

Six reports were worker against worker. Tracing one: two threads writing the same 4 bytes in a 308-byte heap block. Impossible inside one region, because each iteration goes to exactly one thread. The cause was a status array reused across sequential layer loads. Correct code, ordered by the barriers, and unsanitizable — the reports were indistinguishable from a genuine bug.

Allocating that array per call, 308 bytes against a 1.27 GB read, took worker-against-worker from 6 to 0. Nothing was broken and nothing got faster. What changed is that the detector can now tell correct code from a bug. Mechanism over intention: a check that depends on a human correctly dismissing 50 false positives every time is not a check.

One trap on the way. My first classifier counted 6 worker-vs-worker reports and I nearly took the number at face value, until I noticed the pattern also matched "Thread T6 created by main thread." The count happened to be right. The reasoning was not.

## What is measured, and what is not

The honest boundary matters more than the headline, so it goes in its own section rather than a footnote.

Measured, on real Kimi K3 weights:

- 0.687x compression, on two full layer runs fetched by HTTP range read
- Inflation at 1.6 to 1.7 GB/s per core
- Bit-identical output against the source shards, across seven thread counts and five layer shapes, with [AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html) clean
- Read bandwidth curves against an 80 GB file, larger than RAM

That sample is 2 layers of 93, about 2.5 GB of 108.81 GB, so the whole-trunk figure is an extrapolation. Two things support it. The two layers sit 46 apart and agree to within 0.3%. And every layer's trunk is structurally identical: I checked three shards and each holds the same 28 tensors in the same order, totalling exactly 1,267,744,256 bytes. The ratio is a property of the weight distribution, and that distribution is laid out identically in every layer. I would still expect a full pack to land near 0.687x rather than exactly on it.

Not measured: seconds per token. Projecting from the author's 6.553 GB/s trunk read, 108.81 GB becomes 74.6 GB and the trunk read drops from about 16.6 s to 11.4 s per token, which would be roughly 1.19x at the 8 GB budget. That is arithmetic, not a benchmark.

Two things stop me from closing it. The engine is AVX2-only, so my Apple silicon machine runs the scalar path. And the full checkpoint is 1.56 TB against 1.4 TB of free disk. Renting an instance-store box would fix both, and the byte reduction is hardware-independent enough that I would rather publish the measured number and label the rest.

I also got a useful reminder about measuring on the wrong platform. macOS has no O_DIRECT, and `F_NOCACHE` is advisory, so an early benchmark reported 36 GB/s from a device whose real ceiling is around 7. Repeating it over regions that had never been read gave 4.3 to 6.6 GB/s. The original project holds itself to a 33% noise floor on identical configurations, and that standard is the reason to throw the first number away rather than quote it.

## Key takeaways

- **A correct argument can still create a blind spot.** "Streaming is lossless, quantising is not" is true, and it made the size of the lossless stream feel fixed. 31% of those bytes were never information.
- **Separate populations before compressing them.** A bf16 stream mixes a 2.7-bit exponent plane with a 7.97-bit mantissa plane. Splitting the two is the whole trick, and it is the same move columnar storage makes.
- **Measure the constants you are tempted to guess.** Block size and compression level both landed on the small, cheap end, and in the level's case the intuitive direction was actively worse.
- **Check the checker.** A test that cannot fail proves nothing, and a sanitizer that cannot distinguish correct code from a bug is worse than no sanitizer, because it launders real findings into noise.
- **Publish the measured number and label the projection.** Fewer bytes is a fact. Fewer seconds is arithmetic until a benchmark says otherwise.

The engine's own header says the bytes are the checkpoint's own bytes. They still are. There are just fewer of them on the wire.

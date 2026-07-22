---
title: "JSON I/O, from standard libraries to agents"
description: "A field guide to JSON I/O across Python, Java, and Rust — the standard library vs. the fastest one, the design forks that separate them, and how agentic systems moved the problem from parsing defensively to constraining generation."
tldr: "Only Python ships JSON in its standard library; Java and Rust blessed one ecosystem library instead. The popular default is almost always the right default. And in agentic systems the JSON producer became a probabilistic model, so the industry moved the guarantee from 'parse defensively' to 'constrain generation' — with coding agents like Claude Code and Codex choosing guard-and-retry over silent repair."
date: 2026-07-22
tags: ["json", "python", "rust", "java", "llm", "agents", "structured-outputs", "engineering"]
draft: false
faq:
  - q: "Which languages have JSON in their standard library?"
    a: "Only Python ships a JSON codec in its standard library — the `json` module, added in Python 2.6 and derived from simplejson. Java has no JSON in the JDK (the JSON-P and JSON-B specs live in Jakarta EE, not the core), and Rust has nothing in `std`. Both delegate to a single de facto library: Jackson for Java, serde_json for Rust."
  - q: "What is the fastest JSON library in Python?"
    a: "For raw serialization, orjson (Rust core) is the usual winner and returns bytes. For decode-plus-validate, msgspec often beats orjson — it can decode and validate against a typed schema faster than orjson can decode alone. The stdlib json module is the correct default; reach for the fast libraries only after you have measured JSON as the bottleneck."
  - q: "What is the difference between the most popular and the best JSON library?"
    a: "They diverge almost entirely on the speed axis. The popular default (stdlib json, Jackson, serde_json) wins on correctness, safety, and ecosystem; the fast alternatives (orjson/msgspec, fastjson2, simd-json/sonic-rs) win benchmarks. For most workloads the popular default is the right choice, because JSON is rarely the bottleneck and convenience features can be a security liability."
  - q: "How do LLMs guarantee valid JSON output?"
    a: "Through constrained decoding: the JSON Schema is compiled into a formal grammar and, at each generation step, tokens that would violate the grammar are masked, so the model physically cannot emit invalid JSON. This is what OpenAI's strict structured outputs, Anthropic's structured outputs, and open-source engines like XGrammar and llguidance do. It guarantees schema-valid output but not semantic correctness."
  - q: "How does Claude Code parse tool-call JSON?"
    a: "It uses Anthropic's tool-use mechanism. Tool inputs stream as input_json_delta fragments; the client initializes an empty string, appends each partial_json fragment, and parses the accumulated string when the block closes, guarding the parse. With fine-grained tool streaming there is no server-side validation, so partial or truncated JSON is possible and must be handled explicitly."
  - q: "Should you auto-repair malformed JSON from an LLM?"
    a: "For display-oriented apps, often yes — libraries like json_repair and partial-json parsers keep the UX smooth. For coding agents, no: OpenAI's Codex deliberately avoids auto-repairing truncated tool arguments for shell, exec, and apply-patch tools, because silently repairing could mutate intent. A retry is safer than acting on a guessed argument."
---

JSON I/O is the layer that maps JSON text to in-memory types and back, under competing pressure from speed, memory, type-safety, and correctness. Every language solves the same problem, but they disagree on where it belongs: only Python ships a codec in its standard library, while Java and Rust each blessed a single ecosystem library instead. And in the last two years the problem changed shape — the producer of the JSON is now often a language model, not deterministic code — which is why you keep seeing helpers like `from common.jsonio import extract_json_object` show up in agent codebases.

This is a field guide to that landscape: what counts as "standard" in each language, why the fastest library is rarely the one you should reach for first, the design forks that actually separate these libraries, and how agentic systems moved the guarantee from parsing defensively to constraining generation.

## Only Python ships JSON in its standard library

Of the three languages, only Python has a JSON codec in its core. The `json` module was [added in Python 2.6 (2008)](https://docs.python.org/3/whatsnew/2.6.html) and derived from Bob Ippolito's [`simplejson`](https://simplejson.readthedocs.io/), which is still maintained as the external development version. Java has nothing in the JDK: the official [JSON-P (JSR 374) and JSON-B specs](https://jakarta.ee/specifications/jsonp/) live in Jakarta EE with reference implementations, but they are not part of the platform. Rust has nothing in `std` at all.

The reason is not neglect — it is that JSON *binding* is opinionated. How should Java generics, or Rust enums, map onto a schemaless wire format? The two ecosystems that adopted JSON later in their lives (Java's binding story, Rust from the start) decided that "one blessed library" beats freezing a mediocre codec into the core. So the practical standard is **Jackson** for Java and **[serde_json](https://github.com/serde-rs/json)** for Rust — libraries so dominant they function as de facto standard library, just outside the standard library.

## Best versus most popular

The "best" and "most popular" libraries diverge almost entirely on one axis: raw speed. And the useful conclusion is that the popular default is usually the right default, because correctness, safety, and ecosystem matter more than throughput for the vast majority of workloads.

In **Python**, the default is stdlib `json`. For speed, [`orjson`](https://github.com/ijl/orjson) (a Rust core) is the usual winner and returns `bytes` to skip a transcoding step; [`msgspec`](https://jcristharif.com/msgspec/benchmarks.html) is the more interesting one — it decodes *and* validates against a typed schema faster than orjson can decode alone. A [January 2026 benchmark](https://en.chr.fan/2026/01/07/python-json/) adds the necessary caveat: because orjson and msgspec return `bytes`, code that needs a `str` pays a UTF-8 decode, and msgspec's speed can carry a heavy memory cost. `ujson` is now maintenance-only. For validation-heavy work, Pydantic (its core, `pydantic-core`, is Rust) is the ecosystem standard.

In **Java**, Jackson is both the most popular and the best all-rounder — deep ecosystem, Spring's default, strong on large documents. The fastest is [`fastjson2`](https://github.com/alibaba/fastjson2) or DSL-JSON, but fastjson 1.x is a cautionary tale: its "autotype" polymorphic deserialization produced [remote-code-execution vulnerabilities](https://nvd.nist.gov/vuln/detail/CVE-2022-25845). Gson (Google) is simple but slower and now in maintenance mode.

In **Rust**, serde_json is the correct default and rarely the bottleneck. When it is, [`simd-json`](https://github.com/simd-lite/simd-json) (a SIMD port of C++ simdjson using a two-stage "tape") and [`sonic-rs`](https://github.com/cloudwego/sonic-rs) (ByteDance's, which parses direct-to-struct with more `unsafe`) are the escape hatches.

## The design forks that actually matter

Underneath the benchmarks, a handful of design decisions explain why these libraries behave differently. The one that matters most is **how types are bound**: reflection at runtime, code generation at compile time, or a typed native core.

Jackson and Gson use **runtime reflection plus annotations** — flexible, but it pays a reflection tax and defers type errors to runtime. serde uses **compile-time `derive` macros**: the (de)serializer is generated per type, which is both zero-cost and type-checked before the program runs. msgspec, pydantic-core, and orjson push the hot path into a **typed C or Rust core**. Codegen and typed cores are how you get speed and type-safety together, rather than trading one for the other.

The other forks are narrower but real. **DOM versus streaming versus binding**: a dynamic tree (`json.loads`, `serde_json::Value`) is easy but allocates everything, while pull parsers (Jackson's `JsonParser`, Python's `ijson`) stream huge payloads without materializing them. **Bytes versus str**: orjson returns `bytes` on purpose. **SIMD and parse strategy**: two-stage index-then-build (simdjson) versus direct-to-struct (sonic-rs). **Number correctness**: float round-tripping (serde_json's `float_roundtrip` feature), big integers, and NaN handling are the boring details that bite you. And **security**: memory-safe cores versus C buffer overflows, and — as fastjson showed — magic polymorphic deserialization as an attack surface.

## What changes when a model writes the JSON

Classic JSON I/O assumes a deterministic producer: your code emitted the JSON, so a malformed document is a bug you fix once. Agentic systems break that assumption. The producer is now a probabilistic model, so you get *plausible-but-invalid* JSON at runtime — markdown code fences, a prose preamble ("Sure! Here's your JSON:"), single quotes, trailing commas, hallucinated fields, and truncation when the model hits its `max_tokens` limit mid-value.

That is exactly what an `extract_json_object` helper exists to handle: scan the JSON substring out of surrounding text before parsing it. It is the first rung on a ladder that the industry has since built out, from fragile to robust:

- **Parse-and-pray.** Prompt "return JSON," then call `json.loads`. Works until it doesn't.
- **Extract and repair.** Pull the JSON out of prose ([`llm-json-extract`](https://github.com/matthiasnordwig/llm-json-extract)-style), then fix it heuristically with a library like [`json_repair`](https://github.com/mangiucugna/json_repair) (missing quotes, trailing commas, unclosed braces). Post-hoc, best-effort.
- **Function calling / tool use.** The schema becomes a hint; roughly 95–99% valid, but not guaranteed.
- **Constrained decoding.** The schema is compiled into a formal grammar and invalid tokens are masked at each decode step, so the model *physically cannot* emit invalid JSON.

## Constrained decoding is now the infrastructure default

Constrained decoding turns schema compliance from a hope into a hard guarantee. The engine compiles a JSON Schema into a finite-state machine or grammar, and at every generation step it masks the tokens that would violate it — the "100% schema-valid" claim every provider now makes rests on this mechanism. In open-source stacks, [XGrammar](https://github.com/mlc-ai/xgrammar) is the default backend across [vLLM](https://docs.vllm.ai/en/latest/features/structured_outputs/), SGLang, and TensorRT-LLM, with Outlines and lm-format-enforcer as alternatives; Microsoft's Rust-based llguidance now powers OpenAI's engine.

On the provider side, [OpenAI shipped strict structured outputs](https://platform.openai.com/docs/guides/structured-outputs) in August 2024 (`response_format: { type: "json_schema", strict: true }`), Gemini exposes `response_schema`, and [Anthropic made structured outputs generally available in February 2026](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Two caveats survive the upgrade, though. Strict mode does not enforce every JSON Schema keyword — `pattern`, `minLength`, and `format` are commonly ignored — and schema-valid is not the same as semantically correct. **Schema enforcement is a floor, not a ceiling**; keep a Pydantic or Zod validation layer after the parse. Streaming adds one more concern: partial-JSON parsers like [`partial-json-parser`](https://github.com/promplate/partial-json-parser-js) yield fields as they arrive, which a chat UI wants but a tool-call argument does not — executing a tool on a half-typed argument is worse than waiting one more chunk.

## How Claude Code and Codex do it

The two most visible coding agents converged on the same conservative philosophy: guard the parse, return the error, and let the model re-emit — do not silently repair.

**Claude Code** (TypeScript) uses Anthropic's tool-use mechanism. Tool inputs arrive as a stream of `input_json_delta` fragments, and the client follows an accumulation contract: initialize an empty string on `content_block_start`, append each `partial_json`, then parse the accumulated string on `content_block_stop` inside a try/catch. With [fine-grained tool streaming](https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming) (`eager_input_streaming: true`), the API skips server-side buffering and validation for lower latency, so the accumulated string can be partial or invalid — and the docs are explicit that you must guard the parse and, on failure, return the raw string back to Claude rather than crash.

**Codex** (Rust) calls `serde_json::from_str` on `function_call.arguments`, and its app-server speaks newline-delimited JSON-RPC 2.0 (again serde_json). When a weaker model emits truncated arguments, serde_json throws an EOF error; Codex wraps it in a `FunctionCallOutput` and hands it back so the model can retry. The revealing detail is in [openai/codex#19765](https://github.com/openai/codex/issues/19765): maintainers deliberately *refuse* auto-repair for shell, exec, and apply-patch tools, because silently repairing a truncated argument could mutate intent — and a coding agent running a mis-repaired patch is far worse than a retry. A [separate streaming bug](https://github.com/openai/codex/issues/7517) shows the flip side: the accumulation contract itself (correlate deltas by `index`, not `id`) is a classic source of parse failures.

So the split is instructive. General LLM apps climb toward repair and partial parsing to keep the UX smooth; coding agents stay conservative — constrain generation up front, guard the parse, and retry rather than guess.

## Takeaways

- **Only Python ships JSON in its standard library.** Java and Rust deliberately blessed one library (Jackson, serde_json) instead of freezing a mediocre codec into the core.
- **Popular is usually correct.** The fast libraries win benchmarks; the popular ones win on safety, correctness, and ecosystem. Swap only after you have measured JSON as the bottleneck.
- **The binding strategy is the real fork.** Compile-time codegen (serde) and typed native cores (msgspec, pydantic-core) give you speed and type-safety together; runtime reflection (Jackson, Gson) trades one for the other.
- **Convenience features are an attack surface.** fastjson's autotype RCE is the canonical warning — distrust magic polymorphic deserialization.
- **Agentic I/O moved the guarantee from parsing to generation.** The ladder is parse-and-pray → extract-and-repair → tool use → constrained decoding. `extract_json_object` lives on rung two; the frontier is rung four.
- **Constrained decoding is a floor, not a ceiling.** It guarantees schema-valid JSON but not correct values, and it does not cover every schema keyword — keep a validation layer.
- **Coding agents choose re-emission over repair.** Claude Code and Codex guard the parse and hand the error back rather than silently fix truncated tool arguments, because acting on a guessed command is worse than a retry.
- **Structured I/O is now an end-to-end contract, not a library call:** define the schema once (Pydantic or Zod as the lingua franca), constrain generation, accumulate the stream, validate semantics, and fall back to repair or retry.

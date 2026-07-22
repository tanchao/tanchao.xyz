---
title: "How agents handle structured I/O"
description: "A field guide to structured input/output between agents and language models — why model output breaks parsers, and the ladder from extract-and-repair through tool use to constrained decoding, plus how Claude Code and Codex handle it in production."
tldr: "In agentic systems the JSON producer is a probabilistic model, so the guarantee moved from 'parse defensively' to 'constrain generation.' The ladder runs from parse-and-pray through extract-and-repair and tool use to constrained decoding — and coding agents like Claude Code and Codex deliberately choose guard-and-retry over silent repair."
date: 2026-07-22
tags: ["llm", "agents", "structured-outputs", "json", "tool-use", "engineering"]
draft: false
faq:
  - q: "Why do language models produce invalid JSON?"
    a: "Because a model emits text that looks like JSON, not JSON itself. Common failure modes are markdown code fences, a prose preamble, single quotes, trailing commas, hallucinated fields, and truncation when the model hits its max_tokens limit mid-value. None of these are bugs you can fix once; they recur at runtime because the producer is probabilistic."
  - q: "What is constrained decoding?"
    a: "Constrained decoding compiles a JSON Schema into a formal grammar and, at each generation step, masks the tokens that would violate it — so the model physically cannot emit invalid JSON. It is the mechanism behind every provider's '100% schema-valid' claim, implemented by engines like XGrammar and llguidance and exposed through OpenAI, Anthropic, and Gemini structured outputs."
  - q: "What is the difference between JSON mode, function calling, and structured outputs?"
    a: "JSON mode guarantees valid JSON but not your schema. Function calling (tool use) attaches a schema as a hint and lands correct roughly 95–99% of the time. Structured outputs add strict, constrained decoding so every field, type, and required key is enforced at generation time. Only the last one makes schema violations impossible."
  - q: "How does Claude Code parse tool-call JSON?"
    a: "It uses Anthropic's tool-use mechanism. Tool inputs stream as input_json_delta fragments; the client initializes an empty string, appends each partial_json fragment, and parses the accumulated string when the block closes, guarding the parse. With fine-grained tool streaming there is no server-side validation, so partial or truncated JSON is possible and must be handled explicitly."
  - q: "Should you auto-repair malformed JSON from an LLM?"
    a: "For display-oriented apps, often yes — libraries like json_repair and partial-json parsers keep the UX smooth. For coding agents, no: OpenAI's Codex deliberately avoids auto-repairing truncated tool arguments for shell, exec, and apply-patch tools, because silently repairing could mutate intent. A retry is safer than acting on a guessed argument."
  - q: "Is constrained decoding enough on its own?"
    a: "No. It guarantees the output matches your schema's shape and types, but strict mode ignores keywords like pattern, minLength, and format on some providers, and schema-valid is not the same as semantically correct. Treat schema enforcement as a floor and keep an application-level validation layer, such as Pydantic or Zod, after the parse."
---

Structured I/O is the contract that lets an agent exchange typed data with a language model instead of free text. It matters because the model is a probabilistic producer: it emits plausible-but-invalid JSON often enough that naive parsing fails in production. The fix is to constrain generation, not just parse harder — and the difference between those two mindsets is what separates a demo from a system.

If you have worked in an agent codebase you have seen the symptom: a helper like `from common.jsonio import extract_json_object`, wrapped in a try/except, quietly cleaning up whatever the model returned. That helper is a rung on a longer ladder. This post walks the whole ladder — why model output breaks parsers, how the industry climbed from best-effort repair to hard guarantees, and how Claude Code and Codex handle it when the stakes are real.

## Why model output breaks parsers

A language model does not emit JSON; it emits text that usually looks like JSON. That distinction is the entire problem. A deterministic serializer has a bug you fix once; a model reproduces the same class of defect forever, at some rate, because sampling is stochastic. The failure modes are predictable: markdown ` ```json ` fences, a prose preamble ("Sure! Here's your JSON:"), single quotes, trailing commas, comments, hallucinated or missing fields, and — the nastiest one — truncation when the model hits its `max_tokens` limit halfway through a value.

This is why `extract_json_object` exists. Its job is to find the JSON substring inside a larger blob of text and hand it to a real parser. It is the minimum viable defense, and for a long time it was all anyone had. But extraction only recovers well-formed JSON that happens to be surrounded by junk; it does nothing for JSON that is itself malformed or cut off. To handle that, you need to climb.

## The structured-output ladder

There is a clean progression from fragile to robust, and knowing which rung you are on tells you exactly which failures you are still exposed to. The four rungs, in order:

- **Parse-and-pray.** Prompt "return JSON," then call `json.loads`. Works in the demo, fails on the long tail.
- **Extract and repair.** Pull the JSON out of prose, then fix it heuristically. Best-effort, post-hoc.
- **Tool use / function calling.** Attach a schema as a hint. Roughly 95–99% valid, but not guaranteed.
- **Constrained decoding.** Compile the schema into a grammar and mask invalid tokens at generation time. Schema-valid by construction.

Each rung eliminates a category of failure the one below it could not. The rest of this post is a tour up the ladder.

## Extract and repair: the pragmatic floor

Extraction and repair is where most codebases start, because it requires nothing from the model or the provider — just a more forgiving parser on your side. Extraction strips the fences and prose; repair fixes the syntax the model got wrong. The best-known tool here is [`json_repair`](https://github.com/mangiucugna/json_repair), a drop-in replacement for `json.loads` that closes unbalanced braces, adds missing quotes, drops trailing commas, and removes stray text; [`llm-json-extract`](https://github.com/matthiasnordwig/llm-json-extract) does the same in Rust and adds a regex fallback for JSON truncated mid-generation.

The honest framing is that this rung is a floor, not a solution. Repair is heuristic, which means it can be *wrong* — it can guess a structure the model never intended, and it will happily produce a valid object from a corrupt one. That is acceptable when the output is going to a human to read, and dangerous when it is going to a tool to execute. Keep repair as a fallback behind better mechanisms, not as the primary path.

## Tool use: the schema as a hint

Function calling — or tool use, depending on the vendor — was the first mechanism to make the schema a first-class part of the request rather than a line in the prompt. You declare a tool with a JSON Schema for its arguments, and the model returns a structured call against it. Reliability jumps to the 95–99% range because the schema now shapes generation, but it is still a hint, not a constraint: the model can produce a valid *type* with an invalid *value*, or occasionally drift from the schema entirely.

The mechanics differ enough between providers to matter when you write the parsing code. Per a [2026 comparison of the three](https://qveris.ai/guides/function-calling/), OpenAI returns arguments as a **JSON string you must parse yourself**, while Anthropic (`block.input`) and Gemini (`part.function_call.args`) hand back a **native object**. The schema field name differs too — OpenAI and Gemini use `parameters`, Anthropic uses `input_schema` — even though the JSON Schema inside is the same. If you abstract across providers, those are the seams.

## Constrained decoding: the schema as a guarantee

Constrained decoding is the rung where "usually valid" becomes "valid by construction." The inference engine compiles your JSON Schema into a formal grammar — a finite-state machine or pushdown automaton — and at every decoding step it masks out any token that would violate the grammar. The model cannot select an illegal token, so the output is schema-valid with probability one. This single mechanism is what underlies every provider's "100% reliability" claim.

In the open-source stack, [XGrammar](https://github.com/mlc-ai/xgrammar) is the default backend across [vLLM](https://docs.vllm.ai/en/latest/features/structured_outputs/), SGLang, and TensorRT-LLM, with Outlines and lm-format-enforcer as alternatives; Microsoft's Rust-based llguidance now [powers OpenAI's production engine](https://zylos.ai/research/2026-04-11-structured-output-constrained-decoding-production-agents-2026). On the provider side, [OpenAI shipped strict structured outputs](https://platform.openai.com/docs/guides/structured-outputs) in August 2024 (`response_format: { type: "json_schema", strict: true }`), Gemini exposes `response_schema`, and [Anthropic made structured outputs generally available in February 2026](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), covering both JSON-against-a-schema and strict tool use.

Two caveats survive the upgrade, and both bite in production. First, strict mode does not enforce every JSON Schema keyword — `pattern`, `minLength`, and `format` are [commonly ignored](https://devtoollab.com/blog/llm-structured-outputs-guide-2026), so a field can be the right type and still wrong. Second, schema-valid is not semantically correct: the model can return a perfectly-shaped object full of nonsense. **Schema enforcement is a floor, not a ceiling.** Define the schema once (Pydantic or Zod have become the lingua franca) and keep a validation layer *after* the parse for the business rules the grammar cannot express.

## Streaming makes it harder

Streaming reintroduces the parsing problem you thought constrained decoding solved, because a partial document is invalid JSON by definition. A [partial-JSON parser](https://github.com/promplate/partial-json-parser-js) is not a lenient parser — it is a state machine that models the open positions in the document and decides what to yield from an incomplete structure. And the right decision is application-dependent: a chat UI wants the partial string so it can render as it arrives, but a tool-call argument does *not*, because executing a tool on a half-typed argument is worse than waiting one more chunk.

Providers expose this at the API. Anthropic's [fine-grained tool streaming](https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming) (`eager_input_streaming: true`) streams a tool's input as `input_json_delta` fragments and *skips server-side buffering and validation* to cut latency — which means the fragments you accumulate can form partial or invalid JSON, and the accumulation contract is on you: start an empty string on `content_block_start`, append each `partial_json`, and parse on `content_block_stop` inside a guard. This is the exact seam where the next section's agents earn their reliability.

## How Claude Code and Codex do it

The two most visible coding agents converged on the same conservative philosophy: guard the parse, return the error, and let the model re-emit — do not silently repair. That stance is not timidity; it is the correct default when the parsed object becomes an executed action.

**Claude Code** (TypeScript) uses Anthropic's tool-use mechanism and follows the accumulation contract above: append `input_json_delta` fragments, parse on close, guard the parse. With fine-grained tool streaming there is no server-side validation, so the docs are explicit that the accumulated string may be partial — on failure you return the raw string back to Claude rather than crash. **Codex** (Rust) calls `serde_json::from_str` on `function_call.arguments`, and its app-server speaks newline-delimited JSON-RPC 2.0. When a weaker model emits truncated arguments, serde_json throws an EOF error; Codex wraps it in a `FunctionCallOutput` and hands it back for a retry.

The revealing detail is in [openai/codex#19765](https://github.com/openai/codex/issues/19765): maintainers deliberately *refuse* auto-repair for shell, exec, and apply-patch tools, because silently repairing a truncated argument could mutate intent — a coding agent running a mis-repaired patch is far worse than a retry. A [separate streaming bug](https://github.com/openai/codex/issues/7517) shows the flip side: the accumulation contract itself, correlating deltas by `index` rather than `id`, is a classic source of parse failures. The lesson generalizes. General-purpose LLM apps climb toward repair and partial parsing to keep the UX smooth; agents that take actions stay conservative — constrain generation up front, guard the parse, and retry rather than guess.

## Takeaways

- **The producer became probabilistic, so the guarantee had to move.** In agentic systems you cannot fix malformed output once; you constrain generation so it cannot happen, or you handle it every time.
- **Know which rung you are on.** Parse-and-pray → extract-and-repair → tool use → constrained decoding. Each rung removes a failure class the one below cannot. `extract_json_object` is rung two; the frontier is rung four.
- **Repair is a floor, not a solution.** Heuristic repair can produce a valid object from a corrupt one — fine for a human reader, dangerous for a tool call.
- **Tool use is a hint; constrained decoding is a guarantee.** Only grammar-masked generation makes schema violations impossible — and note that OpenAI hands you a JSON string to parse while Anthropic and Gemini return native objects.
- **Constrained decoding is a floor too.** It enforces shape and type, not every schema keyword and not semantics. Keep a Pydantic or Zod layer after the parse.
- **Streaming brings the parsing problem back.** Use a partial-JSON parser, and yield partial values to a UI but never to a tool.
- **Coding agents choose re-emission over repair.** Claude Code and Codex guard the parse and hand the error back rather than act on a guessed argument — because a retry is cheaper than an incident.

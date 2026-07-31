---
title: "The schema is the contract: structured output from protobuf to agents"
description: "How systems specify the shape of a produced object — from protobuf and Avro to JSON Schema — and what changed when the producer became a language model. The taxonomy of where you enforce the shape (prompt, decode-time, or post-hoc), the two competing philosophies, and what to actually do in 2026."
tldr: "An output schema is a machine-checkable contract for the shape of an object. Distributed systems specified these for decades with protobuf, Avro, and JSON Schema — schema-first, validated when the bytes are produced. Agents revived the problem with a stochastic producer: a language model that emits text. You can enforce the shape in three places — in the prompt (no guarantee), at decode time (a grammar masks invalid tokens so schema-valid output is the only thing samplable), or after the fact (validate and retry). That splits the field into two camps: hard-constrain the decoder, or generate freely and parse into the schema."
date: 2026-07-31
tags: ["llm", "agents", "structured-output", "engineering", "ai"]
draft: false
faq:
  - q: "What is an output schema, or structured output?"
    a: "An output schema is a machine-checkable contract describing the exact shape a producer must emit: the fields, their types, and which are required. Structured output is the practice of making a language model return data that conforms to such a schema — usually JSON validated against a JSON Schema — instead of free-form prose. It turns 'the model said something' into 'the model returned an object my code can consume without parsing English.'"
  - q: "What is the difference between a serialization format and a schema?"
    a: "A serialization format governs how bytes are laid out — the encoding rules. JSON, XML, and Protocol Buffers' binary wire format are serialization formats. A schema is a separate artifact: the contract describing which structures are valid — field names, types, required-ness, constraints. The two are orthogonal. RFC 8259 defines JSON's grammar but says nothing about whether a given document is valid for your use; JSON Schema exists to add exactly that missing validation layer."
  - q: "How does OpenAI Structured Outputs guarantee valid JSON?"
    a: "It uses constrained decoding. OpenAI compiles your JSON Schema into a grammar, then after every token the inference engine computes which tokens are still valid under that grammar and masks the rest — the probability of an invalid token is driven to zero, so the model can only sample schema-valid continuations. The compiled grammar is cached, so the cost is a one-time compile on the first request with a new schema, not per token."
  - q: "Does Anthropic Claude support structured output?"
    a: "Yes. As of 2026 Anthropic ships grammar-constrained sampling for both strict tool use (set strict: true on a tool definition) and a standalone structured outputs feature, generally available for Claude 4.5 and later models. It compiles the tool's input_schema into a grammar and constrains sampling to schema-valid tokens — the same compile-and-cache architecture OpenAI uses. Anthropic's supported JSON Schema subset differs from OpenAI's: it allows $ref, anyOf, allOf, and const, but not recursive schemas or numeric range constraints."
  - q: "What is constrained (grammar) decoding?"
    a: "Constrained decoding compiles a regular expression, JSON Schema, or context-free grammar into a finite-state machine, precomputes for each state the set of vocabulary tokens that keep the output valid, and at each decoding step masks the model's logits so only those tokens can be sampled. The 2023 Outlines paper by Willard and Louf showed this can add little to no overhead by precomputing the index over the vocabulary. It guarantees the output parses and conforms to the schema."
  - q: "Constrained decoding or generate-and-validate — which should I use?"
    a: "If your provider offers native structured outputs (OpenAI, Anthropic, Gemini), use it — decode-time constraint gives a single-pass guarantee of schema validity with no retry round-trips. Reach for generate-and-validate (instructor, BAML, TypeChat) when you need portability across models that don't expose a grammar interface, when your schema is too dynamic to maintain as a grammar, or when you want the model to reason freely before its output is coerced into shape."
  - q: "Is JSON Schema an official standard?"
    a: "No. JSON Schema is a community specification maintained by the JSON Schema organization, currently at the 2020-12 release. It has only ever been published as IETF Internet-Drafts, which have expired — it is not a ratified RFC or standard. That has not stopped it from becoming the lingua franca: OpenAPI 3.1's data models are a superset of JSON Schema 2020-12, and it is the format OpenAI, Anthropic, and Gemini structured-output modes accept."
---

> Related: [How streaming works in LLM chat and agentic systems](/posts/2026/07/23/how-streaming-works-in-llm-chat-and-agentic-systems/). That post was about how tokens are made and moved. This one is about the shape they are forced into.

Agents compose by passing objects, not paragraphs. A planner emits a list of steps; a tool call carries typed arguments; a sub-agent returns a result the caller consumes without reading it. Every one of those is a promise about shape — the fields, their types, which are required. That promise is a schema, and the interesting part is that we have been writing schemas for decades. The language model is just a new, unusually unreliable, producer on the end of a very old contract.

## A serialization format is not a schema

Start with a distinction people collapse constantly. A **serialization format** governs how bytes are laid out — the encoding. A **schema** is the contract describing which structures are valid. They are orthogonal.

[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) defines JSON's grammar: what a well-formed number, string, and object look like. It says nothing about whether `{"temperature": "hot"}` is valid for your API that wanted a float. JSON-the-format has no opinion. [JSON Schema](https://json-schema.org/specification) exists precisely to supply the opinion JSON lacks.

Some formats fuse the two. Protocol Buffers' binary wire format is not self-describing — the bytes carry field numbers, not names — so you *cannot decode them at all* without the `.proto` schema. There the contract is mandatory. XML sits at the other end: valid XML can exist with or without a DTD or XSD describing it. The format and the contract are separable, and knowing which layer you are arguing about saves a lot of confusion.

## How systems agreed on object shapes before LLMs

Long before agents, distributed systems had the same problem: two programs, written by different teams in different languages, need to agree on the shape of a message. The answer was schema-first interface definition languages, and the lineage is worth knowing because agent frameworks are re-deriving it.

- **XML Schema (XSD)** — the enterprise contract. XML 1.0 became a [W3C Recommendation in 1998](https://www.w3.org/TR/xml/); [XSD followed in 2001](https://www.w3.org/TR/2001/REC-xmlschema-1-20010502/). Rich types, namespaces, and — famously — verbose.
- **Protocol Buffers** — Google's IDL, [open-sourced in 2008](https://protobuf.dev/history/). You write a `.proto`, `protoc` generates code, and the binary encoding is compact and schema-required.
- **Apache Thrift** — Facebook's equivalent, from a [2007 whitepaper](https://thrift.apache.org/static/files/thrift-20070401.pdf): a `.thrift` IDL generating cross-language RPC stubs.
- **Apache Avro** — from [Hadoop in 2009](https://avro.apache.org/docs/), with two traits worth stealing: its schemas are *written in JSON*, and the writer's schema *travels with the data*, which is what makes its [schema evolution](https://avro.apache.org/docs/1.11.1/specification/) work — a reader with a newer schema can still read old records.
- **OpenAPI** — the REST contract, evolved from Swagger under the Linux Foundation. In [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html) the data models are a superset of JSON Schema 2020-12.

The through-line: these are all **schema-on-write**. The structure is validated or guaranteed when the bytes are *produced*. That is the opposite of dumping loose JSON and hoping the reader copes — schema-on-read, which pushes the cost and the risk onto every consumer. It is the difference between inspecting goods at the factory and inspecting them at the customer's door. Schema-first systems chose the factory.

## JSON Schema became the lingua franca

If there is one contract language to know, it is [JSON Schema](https://json-schema.org/specification). It is a vocabulary for describing valid JSON, and it is itself written in JSON — the contract and the data speak the same syntax. Current release is 2020-12.

One caveat the marketing skips: it is **not a ratified standard**. JSON Schema has only ever been published as IETF Internet-Drafts, which have expired. It is a community specification. That has not slowed adoption at all, because everything else compiles to it.

That last point is the one that matters for what follows. You rarely hand-write JSON Schema. You declare a type in the language you are already in, and a library emits the schema:

- **Pydantic** (Python) — subclass `BaseModel`, then [`.model_json_schema()`](https://pydantic.dev/docs/validation/latest/concepts/json_schema/) produces the JSON Schema.
- **Zod** (TypeScript) — [`z.object({...})`](https://zod.dev/) gives you runtime validation and a static type from one declaration.

JSON Schema is the intermediate representation the whole ecosystem agrees on. Hold that thought — it is exactly what the model APIs took as their input.

## What changed when the producer became a language model

Here is the twist. Every schema system above assumes a *deterministic* producer: code that either emits valid bytes or throws. A language model is not that. It emits a probability distribution over tokens, one at a time, and nothing about that process knows your schema exists.

The first bridge was function calling. When OpenAI shipped it in [June 2023](https://openai.com/index/function-calling-and-other-api-updates/), the framing was quiet but important: you *describe functions to the model via JSON Schema*, and the model returns arguments conforming to that schema. The realization underneath it is the whole post in one line — **the tool schema is the output schema.** Asking a model to call `get_weather(location: string)` and asking it to return `{"location": string}` are the same operation. Structured output and tool calling are one primitive.

Anthropic's tool use works the same way: each tool has an [`input_schema` that is a JSON Schema](https://platform.claude.com/docs/en/docs/build-with-claude/tool-use/overview), and `tool_choice` lets you force a specific call so the model *must* produce that object. Point a model at a schema, force the call, read the object. That is how most agents get structured data today.

But early function calling was best-effort. The model was *trained* to emit conforming JSON; it usually did; sometimes it did not. For a contract, "usually" is a bug. Which brings us to where the shape actually gets enforced.

## Three places you can enforce the shape

There are exactly three points in the pipeline where you can make the output conform, and they give very different guarantees.

1. **In the prompt.** "Reply as JSON like `{...}`." No guarantee at all — the model can still emit prose, a trailing comma, or a field you never asked for. OpenAI's original *JSON mode* was a half-step up: it guaranteed the output was syntactically valid JSON, but [not that it matched your schema](https://developers.openai.com/api/docs/guides/structured-outputs).
2. **At decode time.** A grammar or state machine masks the token logits at each step, so only schema-valid tokens can be sampled. This guarantees both valid JSON *and* schema conformance, in a single pass, by construction.
3. **After generation.** Let the model generate, validate the result against the schema, and re-ask on failure. The guarantee is eventual, at the cost of extra round-trips.

The middle option is the one that turned "usually" into "always," so it is worth seeing the mechanism.

When OpenAI shipped [Structured Outputs in August 2024](https://openai.com/index/introducing-structured-outputs-in-the-api/), the promise was that the model *will always generate responses that adhere to your supplied JSON Schema*. The mechanism, in their words: for each schema they compute a grammar, and "after every token, our inference engine will determine which tokens are valid to be produced next based on the previously generated tokens and the rules within the grammar," masking the rest so invalid tokens have probability zero. The grammar is cached, so the cost is a one-time compile on first use, not per token. OpenAI reports their `gpt-4o-2024-08-06` scoring 100% on an internal schema-following eval against under 40% for the older `gpt-4-0613`. Those are OpenAI's own numbers — read them as best-case — but the guarantee is structural, not a benchmark.

As of 2026 this is no longer a single-vendor trick. Anthropic ships [grammar-constrained sampling](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) for strict tool use and structured outputs on Claude 4.5 and later, compiling the schema to a grammar and caching it the same way. Google's Gemini takes a [`responseSchema` with `responseMimeType: application/json`](https://ai.google.dev/gemini-api/docs/structured-output) — though Google is careful to note the output is *syntactically* correct JSON and you should still validate the values. And llama.cpp has done this locally for years with [GBNF grammars](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md), auto-converted from a JSON Schema.

The idea traces to open research. The Outlines paper, ["Efficient Guided Generation for Large Language Models"](https://arxiv.org/abs/2307.09702) (Willard and Louf, 2023), showed you can compile a regex or grammar to a finite-state machine and precompute, for each state, the set of tokens that keep the output valid — turning per-step constraint into a table lookup that "adds little to no overhead." OpenAI's own announcement credits Outlines, Guidance, and Instructor as prior art. The vendors productized what the open-source constrained-decoding community built.

One catch that bites in practice: each vendor supports a *different subset* of JSON Schema. OpenAI requires every field to be `required` (optionality is expressed as a union with `null`) and forbids `additionalProperties`; Anthropic allows `$ref` and `anyOf` but not recursive schemas or numeric ranges. The schema is a real contract, but read the fine print for your provider before assuming a feature works.

## Two philosophies: constrain the decoder, or generate then parse

Decode-time constraint is not the only school, and the disagreement between the two is the most interesting part of the field right now.

**Constrain the decoder.** Make invalid tokens impossible at sample time. OpenAI strict mode, Anthropic strict tool use, [Outlines](https://github.com/dottxt-ai/outlines), [Guidance](https://github.com/guidance-ai/guidance), and GBNF all live here. The output is provably valid, with no wasted retries.

**Generate, then parse and repair.** Let the model emit text freely, then coerce it into the schema — retrying or error-correcting on failure. [instructor](https://github.com/instructor-ai/instructor) productized the retry loop: pass a Pydantic model as `response_model`, and on a validation error it re-asks with the error fed back. [TypeChat](https://microsoft.github.io/TypeChat/) uses TypeScript types as the schema, validates with the compiler, and repairs via a follow-up call. [BAML](https://www.boundaryml.com/blog/schema-aligned-parsing) goes furthest, with "Schema-Aligned Parsing" that computes the least-cost edit from the model's raw output to something the schema accepts — Postel's law applied to LLMs.

The camps genuinely disagree, and both arguments are worth holding:

- BAML argues grammars are "virtually impossible to maintain long term" — as hard as writing a compiler — and only work where the runtime exposes a grammar interface, which rules out most closed APIs. They report 92–94% on the Berkeley Function-Calling Leaderboard with parsing, above plain function calling.
- There is a real quality question, too. The paper ["Let Me Speak Freely?"](https://arxiv.org/abs/2408.02442) (Tam et al., 2024) claimed format restrictions *degrade* reasoning. The Outlines team [rebutted it](https://blog.dottxt.ai/say-what-you-mean.html) point by point, arguing the study used mismatched prompts and that structured generation, done right, matches or beats free generation (GSM8K 0.78 structured vs 0.77 unstructured, in their reproduction).

Both sets of numbers are party-authored, so I would not treat either as settled. The honest read: constraining the decoder is the strongest guarantee when your provider offers it and your schema is stable; generate-and-parse wins on portability and on schemas too dynamic to compile. Most production agents I have seen end up using both — native structured output where the provider supports it, a validate-and-retry wrapper everywhere else.

## What to actually do in 2026

- **Treat the schema as the interface, and write it once.** Declare it in Pydantic or Zod, generate the JSON Schema, feed that to the model API. Do not hand-maintain the same shape in three places.
- **Use native structured outputs when the provider has them.** OpenAI, Anthropic, and Gemini all give a single-pass guarantee now. It is strictly better than prompt-and-hope.
- **Keep a validator on the boundary regardless.** Decode-time constraint guarantees the *shape*, never the *values* — a schema-valid `{"temperature": 9000}` is still nonsense. Validate semantics in your own code, as Gemini's docs explicitly warn.
- **Read your provider's JSON Schema subset before relying on a feature.** Required-only fields, no recursion, no numeric ranges — the gaps differ per vendor and fail at request time.
- **Reach for generate-and-parse for portability.** If you need one code path across models that do not all expose a grammar, a validate-and-retry library is the pragmatic floor.

## Takeaways

- **The schema is the contract, and it predates the model.** protobuf, Avro, and JSON Schema solved "agree on the shape of an object" decades ago; agents inherited both the problem and the tooling.
- **A serialization format is not a schema.** One lays out bytes; the other says which structures are valid. JSON needs JSON Schema to have an opinion at all.
- **The tool schema is the output schema.** Function calling and structured output are the same primitive — a JSON Schema the model must fill.
- **There are three places to enforce shape: prompt, decode-time, post-hoc.** Only decode-time constraint guarantees conformance in a single pass, and as of 2026 all three major vendors offer it.
- **The live debate is constrain-the-decoder versus generate-then-parse.** Hard constraints give the strongest guarantee; flexible parsing gives portability. Pick by whether you value the guarantee or the reach — and validate the values either way, because no schema checks whether the answer is true.

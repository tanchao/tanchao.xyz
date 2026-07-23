# Blog Ideas

Internal notes on topics to research and potentially write up as posts. Not published, not rendered on the site — plain backlog for future deep-dives.

| # | Topic | Why interesting | Notes / leads | Status |
|---|-------|------------------|----------------|--------|
| 1 | Streaming architecture in current model serving and agentic systems | Worth digging into how token/event streaming actually works under the hood across model-serving stacks and agent frameworks (vs. just consuming SSE at the API level) | Drafted as `src/content/posts/2026-07-23-how-streaming-works-in-llm-chat-and-agentic-systems.md` — covers TTFT/ITL and disaggregated serving, the new agentic streaming challenges, generalizing partial/streaming beyond JSON, and comparisons to Alexa (ASR/barge-in), Tesla FSD (safety gating), and Netflix (ABR buffering) | drafting |
| 2 | How some AI demos (Inflection? Reflection AI?) render output in parallel so text appears much faster | Saw a demo where output text appeared to stream/render faster than typical token-by-token — want to figure out the actual mechanism (parallel decoding? speculative rendering? client-side trick?) | Half-remembered name — "Infection or Reflection AI"; need to verify which company/demo this was | idea |
| 3 | Draft model output tokens as input to a more powerful orchestrating model, for higher overall throughput | Heard on a podcast — a small/fast "draft" model generates output tokens that a stronger model consumes/orchestrates as input, raising overall effective output speed. Possibly related to speculative decoding, but described as an orchestration pattern rather than plain verification | Possibly from Modal (the infra company)? Need to confirm source/podcast and correct attribution | idea |
| 4 | Sandboxing for agentic code execution | Coding agents increasingly need to run untrusted or agent-generated code/commands safely — worth digging into the isolation mechanisms (gVisor, Firecracker microVMs, WASM, seccomp/namespaces) and how agents like Codex and Claude Code scope their exec/shell tools | — | idea |

## Status legend

- `idea` — captured, not yet researched
- `researching` — actively digging in
- `drafting` — turning into a post
- `posted` — shipped, link the post
- `dropped` — decided not to pursue

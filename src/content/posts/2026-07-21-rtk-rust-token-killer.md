---
title: "What RTK Does to Agent Shell Output"
description: "A field guide to RTK (Rust Token Killer): how it compresses CLI output before it reaches the AI context window, how the hook and RTK.md instruction file work, and when to use RTK versus NTK, snip, Caveman, or the agent's native tools."
tldr: "RTK is a Rust CLI proxy that intercepts shell command output and compresses it 60–90% before the AI sees it. Install with brew install rtk; run rtk init -g for Claude Code or Cursor. It covers 100+ commands, adds under 10ms, and is the right default for shell-heavy agent sessions. Stack Caveman to shrink replies and NTK for semantic compression when rule-based filters plateau."
date: 2026-07-21
tags: ["ai", "agents", "devtools", "cli"]
draft: true
faq:
  - q: "What is RTK (Rust Token Killer)?"
    a: "RTK is an open-source CLI proxy that sits between an AI coding agent and the shell. It intercepts shell command output and compresses it using filtering, grouping, truncation, and deduplication before returning it to the agent's context window. A 30-minute coding session generates roughly 118,000 shell-tool tokens unfiltered; RTK reduces that to around 24,000."
  - q: "What is RTK.md?"
    a: "RTK.md is the agent instruction file that rtk init writes to make agents always prefix shell commands with rtk. For Codex it lives at ~/.codex/RTK.md; for Claude Code it is referenced from CLAUDE.md via @RTK.md. The core instruction is a golden rule: always prefix commands with rtk — if no dedicated filter exists, rtk passes the command through unchanged."
  - q: "How does the RTK PreToolUse hook work?"
    a: "For hook-capable agents (Claude Code, Cursor, Copilot, Gemini CLI), rtk init installs a PreToolUse hook that transparently rewrites Bash commands before the agent executes them. git status becomes rtk git status; the agent never sees the change. For instruction-only agents like Codex, the agent reads RTK.md and prefixes commands itself."
  - q: "Does RTK intercept Claude Code's Read, Grep, and Glob tools?"
    a: "No. The PreToolUse hook intercepts Bash tool calls only. Claude Code's built-in Read, Grep, and Glob tools bypass the hook entirely. To get compressed output for those workflows you need to use shell commands (cat, rg, find) or call rtk read, rtk grep, or rtk find directly."
  - q: "What is the difference between RTK, NTK, and snip?"
    a: "RTK (Rust) uses synchronous rule-based filtering via a PreToolUse hook — under 10ms, no daemon. NTK (Neural Token Killer, also Rust) uses a PostToolUse hook and a local daemon with optional local LLM inference; it can stack after RTK for deeper compression. snip (Go) rebuilds the same concept with declarative YAML filters, letting teams write custom rules without touching compiled code."
  - q: "When should I use RTK versus the agent's native tools?"
    a: "Use RTK when sessions are shell-heavy — git, test runs, builds, logs. Prefer the agent's native Read/Grep/Glob tools for file reading: they bypass the RTK hook anyway and return structured, already-compact output. snip is worth considering over RTK when your team relies on internal CLIs not covered by RTK's built-in filters."
  - q: "Can RTK, NTK, and Caveman be used together?"
    a: "Yes — they target different token sources and stack without conflict. RTK compresses shell output going into the context (input-side, PreToolUse). NTK applies semantic compression on top, after the command runs (PostToolUse). Caveman shortens the agent's own replies (output-side). Running all three covers the full token lifecycle of a coding session."
---

RTK (Rust Token Killer) is an open-source CLI proxy that compresses shell command output before it reaches the AI agent's context window. A single Rust binary with no runtime dependencies, it intercepts commands like `git status` or `cargo test` and returns compact summaries in place of raw terminal output — cutting shell-tool token consumption by 60–90% with under 10ms of added latency.

This is a field guide. It covers what RTK does, where its limits are, how the `RTK.md` instruction file fits in, and how to evaluate RTK against the alternatives — [NTK](https://github.com/VALRAW-ALL/ntk), [snip](https://github.com/edouard-claude/snip), Caveman, and the agent's own native tools — when choosing what to run in a session.

The short answer: RTK is the right default for shell-heavy agent sessions. The longer answer has a few real failure modes and two complementary tools worth knowing.

## The problem: shell output is a context budget leak

Every shell command an agent runs dumps its raw output into the context window. `cargo test` on a mid-sized project: 5,000–25,000 tokens, most of it compile progress bars, success messages, and whitespace. `git log` with no flags on a busy repo: a wall of SHAs and commit bodies that takes up half the remaining budget. A test suite that passes 300 tests and fails 2 returns those 2 failures buried under 298 lines of `.` characters.

The issue is not that the output is wrong — it's that it's optimized for a human reading a terminal, not a model parsing a context window. ANSI escape codes, progress bars, repeated prefixes, and identical stack frames all cost tokens. In a typical 30-minute Claude Code session on a TypeScript/Rust project, [the RTK benchmark](https://github.com/rtk-ai/rtk) estimates roughly 118,000 tokens from shell commands before filtering, and around 24,000 after — an 80% reduction on that slice.

The practical effects are cumulative: sessions hit context limits earlier, later turns are more likely to suffer from truncated history, and the model spends compute parsing noise instead of reasoning about signal.

## What RTK is — and what RTK.md is

RTK is a CLI proxy. You run `rtk git status` and it runs the real `git status`, intercepts the output, filters it, and returns the compact version. The binary is a single Rust executable — available via `brew install rtk` on macOS — with no daemon, no cloud dependency, and no account required.

`RTK.md` is a separate artifact: the **agent instruction file** that `rtk init` writes to make the agent always prefix shell commands with `rtk`. Its core is a golden rule:

> Always prefix commands with `rtk`. If RTK has a dedicated filter, it uses it. If not, it passes the command through unchanged — so `rtk` is always safe to call.

Where `RTK.md` lives depends on the agent and integration type:

**Hook-based agents** (Claude Code, Cursor, Copilot, Gemini CLI) get a `PreToolUse` hook that transparently rewrites Bash commands before execution. The agent writes `git status`; the hook rewrites it to `rtk git status`; the agent sees the compressed result. `RTK.md` functions as a fallback reference and meta-commands guide.

**Instruction-only agents** (Codex) rely on `RTK.md` as the primary mechanism. `rtk init -g --codex` creates `~/.codex/RTK.md` and adds an `@RTK.md` reference to `AGENTS.md`. The agent reads the file and prefixes commands itself.

**Plugin-based agents** (Hermes, OpenCode) use their plugin API to mutate commands before execution — the agent receives compressed output without explicitly calling `rtk`.

## How RTK filters output

When a command runs through RTK, four strategies are applied in combination, tuned per command type:

1. **Smart filtering** — strips ANSI codes, progress indicators, empty lines, and boilerplate
2. **Grouping** — aggregates similar items (test failures by type, errors by file, log lines by pattern)
3. **Truncation** — keeps the high-signal context, discards redundancy
4. **Deduplication** — collapses repeated or near-identical log lines with a count

Per-command savings from [RTK's benchmark table](https://github.com/rtk-ai/rtk):

| Command | Standard tokens | RTK tokens | Savings |
|---------|----------------|------------|---------|
| `git status` | ~300 | ~60 | 80% |
| `git diff` | ~2,000 | ~500 | 75% |
| `git add/commit/push` | ~200 | ~15 | 92% |
| `cargo test` / `npm test` | ~5,000 | ~500 | 90% |
| `grep` / `rg` | ~2,000 | ~400 | 80% |
| `ls` / `tree` | ~200 | ~40 | 80% |

RTK ships with filters for 100+ commands across Git, Cargo, JavaScript (pnpm, npm, npx, tsc, ESLint, Prettier, Vitest, Jest, Playwright), Python (pytest, ruff), Go, Docker, Kubernetes, and more. Commands without a dedicated filter pass through unchanged — the binary is always safe to call blindly.

### The hook-bypass caveat

The `PreToolUse` hook rewrites **Bash tool calls only**. Claude Code's built-in `Read`, `Grep`, and `Glob` tools do not go through the Bash hook — they bypass RTK entirely. A session dominated by native file-reading tools rather than shell commands sees little benefit from RTK.

To get RTK filtering on file reads, use shell equivalents (`cat`/`head`, `rg`/`grep`, `find`) or call `rtk read`, `rtk grep`, `rtk find` directly.

This is not a bug — native tools are purpose-built and often more efficient than shell equivalents. The implication is that the benefit of RTK scales with how shell-heavy your session is.

### Observability

RTK has built-in analytics that most comparable tools don't:

```bash
rtk gain           # cumulative token savings across all sessions
rtk gain --daily   # day-by-day breakdown
rtk discover       # commands that ran without RTK (missed savings)
rtk session        # RTK adoption rate per Claude Code session
```

`discover` is particularly useful: it scans Claude Code's command history and reports which shell calls bypassed RTK, telling you whether the hook is working and where custom rules might help.

## Alternatives

### NTK — semantic compression, PostToolUse

[NTK (Neural Token Killer)](https://github.com/VALRAW-ALL/ntk) is the semantic compression alternative. Where RTK applies rule-based filtering synchronously at `PreToolUse`, NTK runs as a local daemon (`127.0.0.1:8765`) and applies a four-layer pipeline via a `PostToolUse` hook:

- **L1 Fast Filter** (<1ms) — ANSI removal, line dedup, blank-line collapse, stack-trace collapse
- **L2 Tokenizer-Aware** (<5ms) — BPE path shortening, prefix consolidation using `cl100k_base`
- **L3 Local Inference** (optional) — Ollama/Phi-3 Mini; only activates above a configurable token threshold (default: 300 tokens post-L1+L2)
- **L4 Context injection** — reads the Claude Code session transcript to prepend your current intent to the L3 prompt, so the compressed output prioritizes information relevant to the current task

NTK and RTK can run in sequence without conflict. RTK intercepts the command first at `PreToolUse`, filters it, then NTK receives the already-compressed output at `PostToolUse` and applies semantic compression on top. NTK's L1 layer detects RTK-pre-filtered output and skips redundant processing, keeping L1+L2 latency near zero. L3 won't trigger if RTK already cut the output below the threshold.

Use NTK when rule-based filters have plateaued — particularly for large Docker logs, complex build output, or verbose stack traces where regex doesn't generalize. The trade: you need to run a daemon (`ntk start`) and accept inference latency when L3 activates. For MCP-capable agents like Cursor and Zed, NTK can run as an MCP server (`ntk mcp-server`) without requiring the daemon.

### snip — declarative YAML filters, Go

[snip](https://github.com/edouard-claude/snip) rebuilds the CLI proxy concept in Go with a different design bet: extensibility. RTK ships compiled Rust filters; snip uses declarative YAML pipelines. Drop a YAML file in the right folder and you have a custom filter — no code to compile, no upstream PR needed.

It supports the same integration hooks as RTK (PreToolUse for Claude Code and Cursor, rules files for Copilot and Windsurf) and covers the same major command categories. snip's explicit framing: "when anyone can write a filter in 5 minutes without touching Go or Rust, the filter ecosystem grows faster."

Use snip when your team relies on internal CLI tools that RTK's built-in filters don't cover and where maintaining YAML rules is faster than waiting for upstream.

### Caveman — shrink model replies, not tool output

Caveman is not a CLI proxy. It's a system-prompt rule set that tells the agent to reply in short, blunt form — abbreviating its own output. It addresses model **reply** tokens, not tool-output tokens. The two tackle different sides of the token budget.

Per independent benchmarks, Caveman cuts output tokens by around 69%, reducing session cost by roughly 37% on output-heavy workloads. RTK and Caveman don't conflict — they're complementary. RTK trims what goes in (shell tool output); Caveman trims what comes out (model replies). If your sessions are dominated by verbose model explanations rather than shell noise, Caveman is the relevant lever; if both are a problem, run both.

### Native agent tools

Claude Code's `Read`, `Grep`, and `Glob` tools bypass the RTK hook — which is a reason to prefer them over shell equivalents for file operations. A native `Read` call returns clean, structured output; it doesn't need filtering. Using `cat | head` through Bash when `Read` is available wastes tokens twice: the overhead of the hook rewrite and the raw shell output before filtering.

RTK and native tools are complements. Native tools for file operations; RTK for git, builds, tests, and logs.

### Gateway cost controls

Tools like [LiteLLM](https://github.com/BerriAI/litellm) operate at the model gateway layer — routing requests between providers, enforcing team budgets, and centralizing usage logs. They address cost per token and per-model pricing, not tokens per command. A gateway is the right answer for org-wide cost governance or model switching. It does not reduce the volume of tokens in a session; RTK does. These are independent layers.

## When to use what

The relevant dimensions when choosing a shell-output strategy:

| Dimension | What to ask |
|-----------|-------------|
| **Latency** | Synchronous <10ms, or a daemon round-trip with optional inference? |
| **Integration depth** | Transparent hook rewrite, plugin API, or written instructions only? |
| **Fidelity risk** | Can over-filtering hide signal — errors or warnings that disappear? |
| **Coverage** | Does it handle the commands this session actually runs? |
| **Extensibility** | Can you add custom filters without modifying the tool? |
| **Observability** | Can you measure adoption and missed savings? |
| **Stackability** | Does it compose with other layers, or create conflicts? |

**RTK** is the right default for shell-heavy agent sessions. Hooks are transparent, latency is under 10ms, 100+ commands are covered out of the box, and analytics are built in. Install once globally; it's safe on any command.

**snip instead of (or alongside) RTK** when your session regularly runs internal CLIs that RTK doesn't filter and where writing a YAML rule is faster than an upstream PR.

**Add NTK** when RTK's rule-based output has plateaued on large, noisy command output — Docker logs, complex builds, verbose stack traces. Budget for a running daemon and inference latency on large outputs.

**Add Caveman** when model replies are the noisy side — long explanations, padded justifications, repeated context recaps. A separate axis from shell output.

**Prefer native tools** when file reading is the bottleneck. `Read`/`Grep`/`Glob` are more efficient than Bash equivalents for file operations and bypass RTK anyway.

**Use a gateway** when the goal is org-wide cost governance, model routing, or centralized audit. Gateways don't reduce per-session token counts; they enforce budgets and route traffic.

## Key takeaways

Shell output is not free. A 30-minute agentic session can consume over 100,000 tokens from terminal output alone, most of it noise that adds cost without improving the model's reasoning. RTK addresses this at the right layer — between the shell and the agent, transparently, without changing commands or workflows.

A few things worth keeping clear:

**Shell-token savings are not total session savings.** RTK compresses shell tool output. It does not affect prompt tokens, file reads via native tools, or model reply tokens. Actual session cost reduction depends on the mix — a session dominated by `Read`/`Grep`/`Glob` calls sees minimal benefit from RTK alone.

**Hooks only cover what they intercept.** The `PreToolUse` hook runs on Bash calls. Native agent tools bypass it. Know the difference and choose tools accordingly.

**Measure it.** `rtk gain` makes the savings visible. `rtk discover` after a few sessions tells you whether the hook is effective or whether your workflow routes around it. Both answer a question that most tool chains leave invisible: how many tokens did my shell commands actually cost?

**Middleware beats prompt nagging.** Telling an agent in a system prompt to summarize terminal output relies on the model following instructions consistently. A filter layer is deterministic — it compresses output whether the model complies or not. For high-volume, repetitive shell operations, deterministic beats instructed.

---
title: "Reading ollama launch: one verb, nineteen bespoke adapters"
description: "A learning note from reading cmd/launch in the Ollama source. Nineteen coding agents run behind one subcommand, and not one of them goes through a generic adapter. What looks like a commodity interface is a per-harness integration paid for by hand."
tldr: "ollama launch shipped 2026-01-23 and now fronts 19 registry entries, 15 of them CLI coding agents. Reading the Go source, there is no universal shim: cmd/launch holds one hand-written adapter per harness. DeepSeek Harness cooperates, carrying ollama as a first-class provider ID in its own config schema. Meta's Muse Code does the opposite, refusing to start without a model catalog, so Ollama writes an undocumented settings key and hands Muse an isolated XDG_CONFIG_HOME. The uniform verb is a facade held up by labor, which is the opposite of an interface standard."
date: 2026-08-17
tags: ["learning-notes", "ai", "agents", "tooling", "engineering"]
draft: false
---

Notes to myself from reading [`cmd/launch`](https://github.com/ollama/ollama/tree/main/cmd/launch) in [ollama/ollama](https://github.com/ollama/ollama), after filing `ollama launch` as recent news and finding it is not. It [shipped 2026-01-23](https://ollama.com/blog/launch). What happened last week was smaller: [v0.32.11](https://github.com/ollama/ollama/releases/tag/v0.32.11) added two more harnesses on 2026-08-14.

The release notes are a one-line summary. The source says something the notes do not.

## What a harness is, and what launch does

By harness I mean everything that is not the model. The loop: call the model, execute the tool calls it asks for, feed the results back, repeat until it stops asking. Then everything around the loop that makes it survive real use: a permission prompt before a write, compaction when the transcript outgrows the model's context window, retry on a truncated tool call, a terminal UI. Claude Code, Codex, and OpenCode are all harnesses in this sense. The model is the thing they call.

`ollama launch <name>` installs one of those harnesses if needed, configures it to talk to an Ollama-served model, and runs it. One command instead of an afternoon of API keys and base URLs. Requires Ollama v0.15 or later.

Ollama chose to wrap everyone else's loop.

## The registry: nineteen entries, fifteen CLI agents

I had assembled a list of eight from the blog posts and the homepage. That was wrong, because the authoritative list is in the code. [`registry.go`](https://github.com/ollama/ollama/blob/main/cmd/launch/registry.go) declares 19 entries. Four are desktop apps or an editor (Claude Desktop, ChatGPT, Hermes Desktop, VS Code), which leaves 15 CLI coding agents. A different four carry a `Hidden` flag, and two of those, `kimi` and `muse`, are CLI agents that count toward the fifteen:

| Name | Maker |
|---|---|
| `claude` | Anthropic |
| `codex` | OpenAI |
| `dsh` | DeepSeek |
| `muse` | Meta |
| `kimi` | Moonshot AI |
| `qwen` | Alibaba |
| `copilot` | GitHub |
| `droid` | Factory AI |
| `pool` | Poolside AI |
| `hermes` | Nous Research |
| `pi` | earendil-works |
| `cline`, `opencode`, `omp`, `openclaw` | independent |

Six of those come from labs with their own frontier models: Anthropic, OpenAI, DeepSeek, Meta, Moonshot, Alibaba. Five sell hosted API access, while Meta's main channel is open weights. Ollama points all six at weights running on your own hardware. That is the whole strategy in one table.

Seeing [`pi`](https://github.com/earendil-works/pi) on the list was a small surprise, since I [read its agent loop](/posts/2026/08/07/reading-pi-agent-loop/) a week ago and did not expect a model runner to be shipping an installer for it.

## The mechanism: one adapter per harness, none of them generic

This is the part the release notes do not tell you, and the reason the note changed.

There is no universal shim. `cmd/launch` contains one Go file per integration (`claude.go`, `codex.go`, `muse.go`, `deepseek_harness.go`, and so on), each with its own test file, all implementing a shared `Runner` interface plus an `Editor` where config has to be written. Every harness is reverse-engineered individually.

The two August additions sit at opposite ends of how much the harness cooperates.

**DeepSeek Harness cooperates.** Its own config schema already carries `ollama` as a provider ID (`deepSeekHarnessProvider = "ollama"` in [`deepseek_harness.go`](https://github.com/ollama/ollama/blob/main/cmd/launch/deepseek_harness.go)). Ollama is not impersonating an OpenAI endpoint; DSH knows what Ollama is. The adapter writes a patch file, sets an API-key environment variable, and execs `dsh web --patch <file>`. The file's own comment says the user's normal DSH home, profiles, sessions and credentials are left untouched.

**Muse Code does not.** From [`muse.go`](https://github.com/ollama/ollama/blob/main/cmd/launch/muse.go):

> Muse has no flag or environment variable that can supply a model catalog, and it will not start without one: its provider fetches `<origin>/muse-code/models` before the first inference call [...] The undocumented `model_catalog` key in settings.json is the one way to satisfy that without standing up the endpoint, so launch has to write a settings file.

It compounds. The endpoint setting in Muse applies to the whole install rather than to a single model, so pointing it at Ollama inside `~/.config/muse/settings.json` would hijack every Muse session the user runs. The adapter avoids that by handing Muse a private config directory, located through `XDG_CONFIG_HOME`, the environment variable a program consults to find its configuration. The user's Meta-connected setup and the Ollama-served one stay independent.

So supporting one harness required discovering an undocumented internal key and then sandboxing the whole config directory to avoid breaking the user's real install. Muse also installs through Meta's own shell installer rather than a public package registry, so there is no source to read.

The maintenance cost shows up in the tracker. An open pull request from an outside contributor, [#17801](https://github.com/ollama/ollama/pull/17801), fixes the DSH adapter to derive its `maxTokens` and `contextWindow` from the `num_ctx` the local model is actually served with — `num_ctx` being the context length Ollama loads the model with, which the harness otherwise has to guess. One harness, one schema, two files changed, still unmerged at the time of writing. Not every adapter tracks model limits, but every one that does has a version of this bill.

## What this does and does not commoditize

**Commoditized: the user's switching cost.** Trying a harness used to cost an afternoon. It now costs one command, across 15 agents. When switching is that cheap, no single harness holds a user through friction.

**Still fragmented: the interface.** If harnesses were converging on a standard, one adapter would serve all of them. Instead there are 15 adapters, one needs an undocumented key, and one has no public source. The uniform verb is a facade, and Ollama pays for it in maintenance. Every one of those files is a thing that breaks when its harness ships a release.

That reframes what I wrote in my week-33 [AI pulse](/pulse/), where I said the harness layer is commoditizing into a model runner. The user-facing experience is commoditizing. The layer itself is not — it is fragmenting, and someone is absorbing the fragmentation by hand so you do not see it.

There is a second reason to hold the strong claim at arm's length. No benchmark I could find runs one model across several harnesses, which is the measurement that would show whether the loop contributes real capability or is scaffolding around the model. SWE-bench and Terminal-Bench, the two standard agentic-coding evaluations, both report scores for a specific model-and-harness combination rather than sweeping one axis against the other. Until someone runs that grid, "harnesses are interchangeable" stays an inference from packaging.

## Key takeaways

- **Read the registry, not the announcement.** The blog posts and homepage gave me eight harnesses. `registry.go` has 19 entries and 15 CLI agents. The code is the list.
- **A uniform surface is not evidence of a standard.** One verb, 15 bespoke adapters. The uniformity is labor, and it decays with every upstream release.
- **How much a harness cooperates is the real variable.** DSH ships `ollama` as a first-class provider. Muse needs an undocumented settings key and a sandboxed config root. Same subcommand, wildly different integration cost.
- **Six of the launchable agents come from labs that sell model access.** Ollama fronts all of them and points them at open weights. The harness is the wedge, the backend is the business.
- **The missing measurement is still one model across many harnesses.** Leaderboards publish pairs. Nobody has run the grid.

Your team still should not build the loop. Fifteen of them are one command away, which is a cheaper argument than any claim about what a loop is worth.

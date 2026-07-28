---
title: "Skills vs. subagents: when to use each in coding agents"
description: "A skill loads reusable procedure into your current session; a subagent runs a task in an isolated context window and returns only a summary. The distinction, the trade-offs each vendor chose, and the decision rule Anthropic, OpenAI Codex, Cursor, and Cognition converged on by mid-2026."
tldr: "Skills vs. subagents is a context-architecture choice, not a capability one. A skill teaches the current session a procedure; a subagent sends noisy work to a separate context window and hands back a summary. Reach for a skill first — cheaper, same context, easier to debug — and promote to a subagent only when isolation, parallelism, a cheaper model, or a locked-down toolset earns the extra cost."
date: 2026-07-27
tags: ["llm", "agents", "claude-code", "context-engineering", "engineering"]
draft: false
faq:
  - q: "What is the difference between a skill and a subagent?"
    a: "A skill is reusable procedural knowledge (a SKILL.md file) that loads into your current session when invoked, and runs in the main context on the same model with your full permissions. A subagent is a separate assistant with its own fresh context window, its own tool allowlist, and often its own model; the parent delegates a task to it and only the subagent's final summary returns to the main session. A skill teaches the session; a subagent staffs the work out."
  - q: "Should I use a skill or a subagent first?"
    a: "Start with a skill. Across Anthropic, OpenAI Codex, and Cursor documentation the guidance is the same: skills are cheaper, keep everything in one steerable context, and are easier to author and debug. Promote a task to a subagent only when you have long-running work, a noisy context that would otherwise be polluted, and a clean input/output contract — or a specific need for parallelism, a cheaper model, or a restricted toolset."
  - q: "Do subagents cost more than skills?"
    a: "Yes. A subagent runs in its own context window and is billed like its own agent run, so running five subagents in parallel uses roughly five times the tokens of a single agent (per Cursor's documentation). A skill only adds its body to the existing context when invoked. The subagent's payoff is that its noisy intermediate work — dozens of file reads, long logs — never compounds into the main conversation; it returns a distilled summary, often 1,000 to 2,000 tokens."
  - q: "Can a skill call a subagent?"
    a: "Yes. Skills and subagents compose. A common pattern is one skill that defines a workflow, breaks it into subtasks, spawns subagents for each, and aggregates their summaries — for example a review skill that fans out three parallel reviewer subagents. The skill supplies the procedure; the subagents supply the isolated context boundaries."
  - q: "When is a subagent the only right choice?"
    a: "When the task must run with a reduced tool allowlist (a read-only 'reader' tier for untrusted content), on a different or cheaper model, or truly in parallel. Skills inherit your full permission set and run on the same model, so they cannot provide security isolation, per-task model selection, or concurrency. Those three needs are what a subagent uniquely provides."
  - q: "How do skills, subagents, MCP, and hooks relate?"
    a: "They solve four different problems. A skill changes how the agent does a task (procedure). A subagent protects the main context by isolating a task (context boundary). An MCP server adds a capability the agent otherwise cannot reach (connectivity). A hook enforces something deterministically regardless of what the model decides (guardrail). Most real setups use several of them together; the common mistake is reaching for the wrong one."
  - q: "Should this go in a skill or in AGENTS.md?"
    a: "Put it in the always-on project file (AGENTS.md, the cross-tool standard, or CLAUDE.md for Claude Code) if it applies to almost every task: build and test commands, project layout, coding conventions, pinned versions. Put it in a skill if it is a multi-step procedure needed only sometimes, such as a release checklist, a migration review, or an incident runbook. The line is always-on versus on-demand. One caveat from Vercel's 2026 evals: reference knowledge that should apply on every task is more reliable in the always-on file, because a skill only works if the agent decides to invoke it — which it failed to do in 56% of their test cases."
---

> Part of a two-post series on structuring agentic systems. Next: [Make an agentic workflow deterministic and verifiable](/posts/2026/07/27/make-an-agentic-workflow-deterministic-and-verifiable/).

A skill is reusable procedural knowledge that loads into your current session. A subagent is a separate context window you hand a task to, which runs in isolation and returns only a summary. They are complementary, not competing. The rule every frontier vendor converged on by mid-2026: reach for a skill first, and promote to a subagent only when isolation, parallelism, a cheaper model, or a locked-down toolset earns the extra cost.

## Same problem, two halves

Skills and subagents look like rival features. They are two answers to one constraint. The model has a finite attention budget, and everything you load competes for it. Anthropic calls the discipline [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): finding the smallest set of high-signal tokens for each step. Once you see it that way, the split is clean:

- **Skills attack upfront bloat.** You do not want every procedure and checklist preloaded into every session, diluting the instructions that matter. The always-on layer those would otherwise sit in is the project file — `AGENTS.md`, the cross-tool standard, or `CLAUDE.md` for Claude Code — read in full on every turn. A skill is its on-demand counterpart: it stays dormant until you invoke it.
- **Subagents attack execution noise.** Some tasks generate output you will never re-read: forty file reads, a giant log, a dozen dead-end searches. Run inline, that noise compounds into the main context. So a subagent runs it elsewhere and brings back only the conclusion.

If a skill is the onboarding guide you hand a new teammate, a subagent is a contractor you brief once, who works in their own office and returns a one-page memo.

## What a skill is, and what it costs

A skill lives in `.claude/skills/` as a folder with a `SKILL.md` file: a name, a description, and a body of instructions, plus optional scripts. Only the name and description load at session start; the [full body loads when the skill is invoked](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more), by slash command or auto-match. This is progressive disclosure, and it is why a large skill library is cheap to keep around.

What that design buys and costs:

- **Runs in your current context, same model, full permissions.** You see and steer each step. The flip side: once invoked, the skill's work stays in the main window, and it cannot be locked to a reduced toolset.
- **No parallelism.** A skill is a playbook the parent runs itself, one step at a time.
- **Cheap, portable, easy to author and debug.** Anthropic [published Agent Skills as an open standard](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) in December 2025, so the same `SKILL.md` runs across tools rather than being locked to one.

Anthropic's own July 2026 guidance sharpened the point: they [moved code review and verification out of the system prompt into skills](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) that get called only when relevant, and warned against over-constraining them. Think of a skill as a lightweight guide, not a rulebook.

## What a subagent is, and what it costs

A subagent is a markdown file in `.claude/agents/` whose body becomes a fresh system prompt. Its name, description, and tool list load at session start, but [the body never enters the parent conversation](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more). The parent calls it through an Agent tool, it runs in its own context window, and the only thing that returns is its final message plus metadata.

What that design buys and costs:

- **Isolation is the whole point** — but it is isolation scoped by an allowlist, not a sandbox. Each subagent gets its own tool allowlist and can run on a different, often cheaper, model. Cursor's built-in explore subagent [uses a faster model so it can run ten parallel searches](https://cursor.com/docs/subagents) in the time one main-agent search would take; OpenAI Codex recommends a fast model like `gpt-5.6-terra` for read-heavy parallel workers versus `gpt-5.4` for depth.
- **Cost scales independently.** A subagent might explore tens of thousands of tokens internally and [return a summary of only 1,000 to 2,000 tokens](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). That distillation is the win. But you still pay for the internal work: [Cursor notes five parallel subagents use roughly five times the tokens](https://cursor.com/docs/subagents) of a single agent.
- **The blank slate is a real constraint.** A subagent does not inherit your conversation history. Cognition's Devin docs make this explicit: a subagent [shares tools and codebase context but not the parent's conversation chain](https://cognitionai.mintlify.app/cli/subagents). If your delegation prompt would need half the session to make sense, the work belongs in the session.
- **Parallel writes race.** Every vendor steers concurrency toward read-heavy work. Write-heavy fan-out needs isolated workspaces and a supervisor to reconcile, which is real coordination overhead.

## When to use a skill

Reach for a skill when the work is procedure you want to run and watch inside the main thread:

- **Repeatable procedures and checklists** — deploy runbooks, release steps, review playbooks, "how we do X here." Anthropic is blunt: [procedures belong in skills](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more), not in `CLAUDE.md`.
- **Work that needs the current conversation's context** and runs fine on the same model.
- **House style and project-specific opinions** you want encoded once and applied consistently.
- **Anything where you cannot write a self-contained delegation prompt.** That alone rules out a subagent.

## When to use a subagent

Reach for a subagent when the problem is not what to do but how much noise the work makes, or where it must run. You generally want several of these true, not just one:

- **Read-heavy work with a small conclusion** — codebase exploration, deep research, log analysis, dependency audits, "find every place we handle currency rounding." Large intermediate output, one-paragraph answer.
- **Parallel fan-out** across independent workstreams.
- **Cheaper-model mechanical work** you want pinned to a fast model. A skill cannot switch models.
- **Independent verification** — a fresh context window gives an unbiased second opinion, which is why reviewer and critic agents are subagents.
- **Security isolation** — untrusted content handled by a read-only tier. Skills inherit your full permissions and cannot do this.

## The rule: skill first

The consensus across Anthropic, Cursor, and OpenAI Codex is to start with a skill and promote only when the evidence forces it. Skills are lighter, keep one steerable context, and are faster to author and debug. Most tasks people build a subagent for are a skill the parent can run inline.

One caveat, and it cuts against the grain: a skill only helps if the agent invokes it, and that is a decision the model can get wrong. In [Vercel's January 2026 agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals), a documentation skill was never invoked in 56% of cases and scored 53% — no better than shipping no docs at all. Explicit instructions to use it lifted that to 79%, while the same content placed always-on in `AGENTS.md` hit 100%. The lesson is narrow but real: reference knowledge that should apply on every task belongs in the always-on file, not behind a skill invocation. Skills earn their place for the occasional procedure you invoke on purpose.

Promote to a subagent when you have, roughly, all three: long-running work, a context that its noise would pollute, and a clean input/output contract. Add the model-switch, parallelism, or tool-lockdown needs on top. If none of those hold, you want a skill.

The failure mode is worth naming. If you have eleven subagents and cannot remember what half of them do, you have rebuilt the bloated-config problem with more moving parts, and each one runs with tool access. A good setup is boring: a handful of sharp skills and two or three subagents you actually reuse.

## They compose, and two neighbors they are not

Skills and subagents are not exclusive. A skill can orchestrate subagents: define the workflow, split it into subtasks, spawn a subagent per subtask, aggregate the summaries. That composite is often the strongest pattern for heavy work.

Three adjacent primitives get conflated with these, and shouldn't:

- **Always-on project files** — `AGENTS.md`, the vendor-neutral open standard [stewarded by the Linux Foundation's Agentic AI Foundation](https://agents.md/) and read by Codex, Cursor, Copilot, and dozens more, plus `CLAUDE.md`, Claude Code's own flavor (teams bridge the two with an `@AGENTS.md` import). These load in full on every turn and hold what is true for every task: build commands, project layout, conventions. A skill is what you reach for when a procedure would bloat that file.
- **MCP** adds a capability the agent otherwise cannot reach. It is the only one you write real code for. Anthropic's [code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) pattern is where tools and context engineering meet, and it is the bridge to the next post.
- **Hooks** enforce something deterministically, no matter what the model decides. A skill is a probabilistic instruction; a hook is a guarantee.

Always-on files hold what is true every task. Skills change how the agent works. Subagents protect context. MCP adds reach. Hooks enforce. Pick by which you actually need.

## Takeaways

- **It is a context-architecture choice.** A skill teaches the current session a procedure; a subagent sends work to a separate window and returns a summary.
- **Skills attack upfront bloat; subagents attack execution noise.** Both are progressive-disclosure mechanisms for the same finite attention budget.
- **Skill first.** Cheaper, same context, easier to debug. Promote only when long-running plus noisy plus a clean contract all hold.
- **Subagents uniquely give you three things** skills can't: a restricted toolset, a different model, and real parallelism. If you need one of those, that is your signal.
- **Keep the set small.** Eleven subagents you can't name is bloat with tool access.

Next: the same primitives, one level up — [how to make an agentic workflow deterministic and verifiable](/posts/2026/07/27/make-an-agentic-workflow-deterministic-and-verifiable/).

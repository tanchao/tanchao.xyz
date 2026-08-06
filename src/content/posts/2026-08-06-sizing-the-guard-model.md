---
title: "Sizing the guard model: why auto mode uses Sonnet, not a small classifier"
description: "Claude Code's auto mode puts a two-stage Sonnet 4.6 transcript classifier in the permission path. A walk through the design decisions behind it: rule engine or model, how much model, what context it is allowed to see, and where to sit on the false-positive/false-negative curve."
tldr: "Auto mode replaces permission prompts with a two-stage transcript classifier on Sonnet 4.6: stage 1 emits a single yes/no token with reasoning off, stage 2 re-runs the same prompt with chain-of-thought on whatever stage 1 flagged. The cascade moves false positives on real traffic from 8.5% to 0.4% and false negatives on curated overeager actions from 6.6% to 17%. Four decisions explain the shape: the shell is untyped so a rule engine cannot sit there; reasoning rather than parameter count is the dial, so both stages run the same mid-tier model and stage 2 rides stage 1's cache; the classifier is denied tool outputs and the agent's own reasoning, which buys injection resistance and costs provenance; and the error curve is priced on the fact that a wrongful block costs one turn while a miss lands on top of git, sandboxing, and IAM. The residual error concentrates on consent scope, which the transcript does not contain."
faq:
  - q: "What is Claude Code auto mode?"
    a: "A permission mode that replaces per-action approval prompts with an automated guard. A two-stage transcript classifier evaluates each tool call against more than twenty block rules before it runs, allowing safe actions through and denying dangerous ones. Anthropic positions it as an alternative to the --dangerously-skip-permissions flag rather than a replacement for sandboxing."
  - q: "What model does the auto mode classifier run on?"
    a: "Sonnet 4.6. Both stages use the same model and nearly the same prompt. Stage 1 emits a single yes/no token with reasoning disabled and instructions to err on the side of blocking; stage 2 re-runs it with chain-of-thought on the subset stage 1 flagged."
  - q: "How accurate is the auto mode classifier?"
    a: "On 10,000 real internal tool calls the full pipeline blocks 0.4% of benign actions. On 52 curated overeager actions it lets 17% through, and on 1,000 synthetic exfiltration attempts it lets 5.7% through. Stage 1 alone sits at 8.5% false positives with 6.6% and 1.8% false negatives on those same two adversarial sets."
  - q: "Why use a frontier model instead of a small fine-tuned classifier?"
    a: "Because of where the evidence lives. A token classifier works when the signal is lexical and local, as it is for PII spans. Deciding whether a force-push falls under the instruction \"clean up the PR\" requires reading a conversation and reasoning about scope, which is not a span-labelling problem."
  - q: "Why can't a policy engine like Cedar or OPA gate these calls?"
    a: "Policy-as-code needs a typed action space to write rules against. Most of a coding agent's capability arrives through one tool with one string argument: the shell. git push --force, aws s3 rm --recursive, and curl -X POST are the same tool call with different strings, so there is no schema to bind a rule to."
  - q: "What does the auto mode classifier deliberately not see?"
    a: "Assistant messages, the agent's own reasoning, tool outputs, and tool-call descriptions. Only user messages and the executable payload reach it. Tool outputs are where hostile content enters an agent's context, so excluding them closes the main injection path, at the cost of being unable to verify where a value in a command came from."
  - q: "Why does stage 2 increase the false-negative rate?"
    a: "Stage 1 is deliberately recall-biased and over-blocks. Stage 2 reasons about the actions stage 1 flagged and releases most of them, which recovers precision and lets some genuinely overeager actions through. The false-positive improvement is measured on 10,000 calls; the false-negative cost is measured on 52 curated actions, so it is a move of single-digit counts and the ratio should be read as direction rather than magnitude."
date: 2026-08-06
tags: ["ai", "agents", "security", "engineering", "llm"]
draft: false
---

Claude Code's [auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode) puts a two-stage transcript classifier on Sonnet 4.6 in front of every tool call, in place of the permission prompt. A guard in that slot could plausibly have been a rule engine or a small fine-tuned classifier. Following why it is neither, and why the model that is there is mid-tier rather than the largest available, turns out to be a tour of the constraints on any tool-call guard.

> Part of a series on agent harness design: [why coding agents lean on the shell](/posts/2026/08/02/why-coding-agents-lean-on-the-shell/), [making an agentic workflow deterministic and verifiable](/posts/2026/07/28/make-an-agentic-workflow-deterministic-and-verifiable/), and [governing multi-party agentic systems](/posts/2026/08/03/governing-multi-party-agentic-systems/).

## The slot the guard has to fill

Anthropic frames the design space as three points on a maintenance-versus-autonomy curve. Sandboxing is safe but costly to keep current: every new capability needs configuring, and network or host access breaks the isolation. Manual permission prompts sit in the middle, and users already approve 93% of them. The `--dangerously-skip-permissions` flag removes the check entirely. Auto mode aims at high autonomy with low maintenance cost, which means the guard has to be something that needs no per-project configuration and still says no sometimes.

That 93% is the load-bearing number for the whole feature. It says the prompt was already passing almost everything, so the information a prompt adds per invocation is small, and most of its cost is interruption. Replacing it therefore does not have to clear a high bar on recall. It has to be cheap, need no setup, and not block real work.

## Decision one: rule engine or model

The first fork is whether the guard can be declarative. A policy engine like [Cedar](https://www.cedarpolicy.com/) or [OPA](https://www.openpolicyagent.org/) answers a well-formed question — given this principal, this action, this resource, is it allowed — deterministically and in well under a millisecond. That is strictly better than a model call when it applies: cheaper, auditable, no false positives on inputs the rules cover.

It does not apply here, and the reason is the shape of a coding agent's tool surface. Most of its capability arrives through one tool with one string parameter, which is [why coding agents lean on the shell](/posts/2026/08/02/why-coding-agents-lean-on-the-shell/) in the first place. `git push --force`, `aws s3 rm --recursive`, and `curl -X POST` are the same tool call with different strings. There is no typed argument to bind a rule to, and no finite enumeration to check against. A declarative guard would need a parser for every CLI its users might invoke, which is the sandboxing maintenance problem in a different costume.

So something in the path has to read the command and infer its effect. That forecloses the declarative option before any question about model size comes up.

## Decision two: how much model

Given a model, the next question is which one, and the answer is less about scale than it looks. Both stages run Sonnet 4.6. What differs between them is how many reasoning tokens each is allowed.

- **Stage 1** emits a single yes/no token, no reasoning, instructed to err on the side of blocking. Recall-biased by construction.
- **Stage 2** re-runs the same prompt with chain-of-thought, only on what stage 1 flagged.
- Because the input is identical apart from the final instruction, stage 2's prompt is almost entirely a cache hit from stage 1.

Three alternatives are visible from here, and each loses something specific.

1. **One reasoning call per tool call.** Correctness is highest, but every tool call in every session pays chain-of-thought latency and tokens on the hot path. For a guard that will fire thousands of times a day per user, this is the cost that has to come down.
2. **A small model triaging into a large one.** The textbook cascade, and the obvious move. It breaks the cache identity: two different models means two different prompts and no shared prefix, so the expensive stage pays full input cost. It also introduces a second thing to train, evaluate, and keep aligned with the block rules as those change.
3. **A fine-tuned classifier alone.** Cheapest per call by far. Fails on where the evidence lives, which is the next section's problem.

Same model, two reasoning budgets, is what falls out. The dial being turned is inference-time reasoning, not parameter count. And Sonnet 4.6 is worth noticing for what it is not: not the largest model available, and not the current generation. The requirement is the ability to reason over a transcript at low cost, and a mid-tier model clears it.

## Decision three: what the classifier is allowed to see

The context boundary is the sharpest decision in the design. The classifier sees user messages and the executable tool payload. Assistant messages, the agent's own reasoning, tool outputs, and tool-call descriptions are stripped before it runs.

Two things follow. First, injection resistance: tool outputs are where hostile content enters an agent's context, so a guard that never reads them cannot be steered by a poisoned file or a crafted web page. Second, the agent loses its channel to argue. An agent that has talked itself into a force-push cannot submit that reasoning as evidence, because the guard never sees it. The judge does not read the defendant's notes.

The cost is provenance. Denied tool outputs, the classifier cannot tell whether a value in a command was read from a real config or invented two turns earlier. Anthropic names this directly as a limit of being reasoning-blind by design. The trade is forced rather than chosen: the context that would let a guard verify intent is the same context an attacker controls. Any guard in this position picks one.

## Decision four: where to sit on the error curve

| Dataset | Stage 1 | Full pipeline |
|---|---|---|
| 10,000 real internal tool calls (false positive) | 8.5% | **0.4%** |
| 52 curated overeager actions (false negative) | 6.6% | **17%** |
| 1,000 synthetic exfiltration attempts (false negative) | 1.8% | **5.7%** |

Adding stage 2 cuts wrongful blocks by 21x on a sample of 10,000 calls. The false-negative column moves the other way, and it is worth reading with the sample size in view: the overeager set is 52 items, so 6.6% and 17% are single-digit counts, and the ratio between them is coarser than two significant figures suggest. The direction is solid; the magnitude is not. The second stage is worse on the metric a security review would lead with.

Every figure here is Anthropic's own, measured on internal traffic and self-reported. There is no external audit of this guard's error rates, and the overeager set was curated by the same team that built the classifier.

The cost model that makes that coherent is asymmetric in two ways. A false positive is paid continuously, by every user, on benign work, and it is the failure that makes people turn the feature off. A false negative is rare and does not land alone: git history, sandboxing where configured, cloud IAM, and an escalation loop that halts after 3 consecutive denials or 20 total all sit underneath it.

The retry loop also changes what a false positive costs. A block returns to the agent as a tool result with an instruction to respect the boundary in good faith, and the agent usually finds another path. So a wrongful block spends a turn rather than failing the task. That is what makes 0.4% survivable across a long autonomous run and 8.5% not, and it is the mechanism that lets them take the precision trade at all.

## The constraint that survived the design

Anthropic's failure analysis of the 17% is the most informative part of the write-up. In most misses the classifier correctly identifies that the action is dangerous. What it gets wrong is whether the user's instruction authorised *that* action. "Clean up the PR" does not explicitly cover a force-push, and prior approvals do not establish a pattern. They report trying to prompt-engineer around it without finding a fix that costs less than it gains.

Structurally, that is a different kind of error from the rest. Danger recognition is a property of the command, which the classifier has. Consent scope is a property of the user's intent, and the transcript contains a goal rather than a boundary. The classifier is being asked to recover a limit that was never expressed in the text it is allowed to read. That explains why the error concentrates where it does, and why more reasoning on the same input plateaus.

## Where a small classifier fits instead

The contrast worth drawing is with a guard I am building at the other end of the size range. In [privacy-filter customization](/projects/privacy-filter-customization/) I am fine-tuning a 1.5B-parameter token classifier — [OpenAI's privacy-filter](https://openai.com/index/introducing-openai-privacy-filter/), retargeted at Snowflake's [`semantic_categories`](https://docs.snowflake.com/en/sql-reference/functions/extract_semantic_categories) taxonomy. Two properties make that the right size there:

1. **The label space is enumerable.** 47 semantic categories, fixed and documented.
2. **The evidence is lexical and local.** A passport number looks like a passport number. The signal lives in the span and its neighbours, which is what token classification is built for.

Auto mode has the first property and not the second. Its taxonomy is small and closed: more than twenty block rules in four groups covering destroy or exfiltrate, degrade security posture, cross trust boundaries, and bypass review or affect others. But mapping an arbitrary shell command plus a conversation onto that taxonomy is not lexical. `git push --force` is routine or destructive depending on the branch, the remote, and what the user asked for three turns ago.

Which is the general form of the sizing question. An enumerable label space tells you the output shape. The evidence tells you the model class, and only that sets the size.

## Key takeaways

- **The shell forecloses the declarative guard.** Cedar and OPA need typed arguments. One tool, one string, unbounded effect leaves nothing to write a rule against, so something has to read the command.
- **Reasoning is the dial, not parameter count.** Two stages, one mid-tier model, reasoning off then on. Stage 2 rides stage 1's cache because the prompts are identical but for the last instruction.
- **A small-then-large cascade would have cost the cache.** Two models means no shared prefix and a second artifact to keep aligned with the rules.
- **The context boundary is a forced trade.** Denying tool outputs closes the injection path and removes the agent's ability to argue for itself; it also makes provenance unverifiable. No configuration gets both.
- **The error curve is priced on who pays.** Wrongful blocks are paid by every user every session and cost one turn; misses are rare and sit on top of git, sandboxing, and IAM.
- **Enumerable labels do not imply a small model.** Lexical, local evidence does. Auto mode has the closed taxonomy and none of the locality.
- **The residual error is about consent, not danger.** The transcript holds a goal, not a boundary, so the limit the classifier is asked to check was never written down.

The guard ends up as large as its question is vague. Danger recognition from a command string is nearly a lexical problem. Whether the user meant to authorise it is not a problem any amount of span labelling reaches, and that gap is what buys Sonnet its seat in the permission path.

---
title: "Reading the harness debate: the prompt shrinks, the gates don't"
description: "A learning note from reading Earendil's 'What is a Harness?' and the Hacker News thread under it. The post defines a harness by four parts. The thread argues, without saying so, about which of those parts get smaller as models improve and which cannot."
tldr: "Earendil defines an agent harness as system prompt, tools, agentic loop, and translation layer, and the 179-comment Hacker News thread splits over which parts survive better models. The prescriptive layer shrinks: one commenter replaced 2,000-line skills with tools plus guardrails and covered more tasks. Gates on irreversible side effects and the verification loop do not shrink, because they encode authority and cost rather than model competence. The definition also fails to classify the ChatGPT web app, because an ownership clause is doing the discriminating that the four mechanical parts cannot."
date: 2026-08-26
tags: ["learning-notes", "ai", "agents", "engineering"]
draft: false
---

Notes to myself from reading [What is a Harness?](https://earendil.com/posts/what-is-a-harness/), published 2026-08-20 by Earendil, and the [Hacker News thread](https://news.ycombinator.com/item?id=49409092) it drew three days later: 576 points, 179 comments.

The post is a beginner explainer and it does that job well. It is not where the content is. The thread is an argument between people running harnesses in production, and they are arguing about something the post never states.

## The setup: four parts, and one disclosure

A harness is the program sitting between your terminal and the model API. Concretely, in the order it acts:

1. It sends a **system prompt** with every request.
2. It describes a set of **tools** in that request. The tool code lives in the harness. The model picks when to call; the harness does not.
3. It runs the **agentic loop**: call the model, execute the tool calls it asked for, append the results, call again, stop when it stops asking.
4. It passes everything through a **translation layer** so the same loop can address Anthropic, OpenAI, or a local open-weights model.

That is the post's decomposition, and I think the four are right.

The disclosure: the post is by Earendil, who publish [`pi`](https://github.com/earendil-works/pi). The definition is pi-shaped, meaning minimal system prompt, extensions, model-agnostic, and the fourth part carries a product argument ("delivers control to the end user"). The parts are still correct. The emphasis is a sales position, the same way [Anthropic's multiagent study](/posts/2026/08/17/reading-anthropic-multiagent/) put an unreleased model at the top of every table.

Neither the post nor the thread cites the strongest evidence that any of this matters. SWE-agent held the model fixed and replaced a generic shell with an interface built for an agent: commands to create and edit files, navigate a whole repository, and run tests. That change alone reached 12.5% pass@1 on SWE-bench and 87.7% on HumanEvalFix, state of the art on both ([arXiv:2405.15793](https://arxiv.org/abs/2405.15793), NeurIPS 2024). The interface moved the number. That is why the argument is worth having.

## Two definitions, and only one of them classifies anything

[francisofascii asked](https://news.ycombinator.com/item?id=49421661) the only question in the thread with a testable answer. Which of these is a harness?

- The Codex / GitHub Copilot plugin in VS Code
- The ChatGPT web app
- Code you wrote yourself to POST to an Anthropic or OpenAI endpoint

Nobody replied. Elsewhere [alexjurkiewicz](https://news.ycombinator.com/item?id=49413917) claimed there is "almost unanimous consensus" on the meaning, and [Revanche1367](https://news.ycombinator.com/item?id=49414682) answered by pointing at the thread.

Run the four parts against the three cases. All three have a system prompt, tools, and a loop. Only the hand-written one has a translation layer, and only if you wrote one. So the mechanical definition admits all three, and the post's extra clause does the excluding: "you as an end user can own your own agent harness."

Two definitions are in circulation:

- **Mechanical.** Prompt, tools, loop. Describes a shape. Excludes almost nothing.
- **Political.** The one you own and can point at a different model. Excludes the vendor apps, which is the whole point of saying it.

I would keep the mechanical one and treat ownership as a property. The ChatGPT web app is a harness you do not own. That leaves the word describing a thing rather than a preference.

The same confusion runs one level down. [kmansm27](https://news.ycombinator.com/item?id=49411174) noticed that most people saying "I built a harness on top of Pi" changed a system prompt, added tools and MCP servers, and wrote some skills. Three activities share one name: writing the loop, configuring someone else's loop, prompting inside a configured loop. Almost all of the claimed first is the second. [profsummergig](https://news.ycombinator.com/item?id=49413709) put it less kindly: when engineers cannot agree what a tool means, the word is holding a place for a desire.

## What shrinks: the prescriptive layer

The most useful report in the thread is [Syntaf's](https://news.ycombinator.com/item?id=49410048), building accounting agents. The sequence:

1. Built an internal CLI so the model could act on their platform. Recommends that step on its own merits.
2. Paired it with skills. Found each skill was written by whoever owned that function, and was too prescriptive. A 2,000-line skill "suffers from the same gaps as we do," and an agent working through a list stops reasoning about the request.
3. Removed the prescription. Kept tools plus guardrails and let the model plan.
4. Result: better than the prescriptive skills, across a wider set of tasks it was never instructed on.

[YZF](https://news.ycombinator.com/item?id=49411161) supplies the mechanism. Over-prescription fills the context with conflicting instructions and removes the room to handle a situation nobody wrote down. [tosh](https://news.ycombinator.com/item?id=49409601), who submitted the post, offers a backpack in place of the climbing harness: whatever you carry is not free, and the better the model the less you need to carry. [lebek](https://news.ycombinator.com/item?id=49409679) finishes it. The bigger the backpack, the slower you walk.

The same argument decides the tool surface. Syntaf [chose a CLI over MCP](https://news.ycombinator.com/item?id=49420997) on familiarity grounds: 200-plus engineers at his company know what a good CLI looks like, few have read the MCP spec. [flumes_whims_](https://news.ycombinator.com/item?id=49421506) gives the sharper reason, that MCP definitions occupy context whether the model needs them or not, while `--help` on a subcommand is fetched only when it is. [dpritchett](https://news.ycombinator.com/item?id=49410241) goes one step further and generates skill files at runtime by walking the CLI's own command tree, so the description cannot drift from the tool. Same conclusion I reached in [why coding agents lean on the shell](/posts/2026/08/02/why-coding-agents-lean-on-the-shell/).

Nobody in the thread priced the second cost. Anthropic's prompt cache is a prefix cache with a fixed hierarchy: `tools`, then `system`, then `messages`. A change at one level invalidates that level and everything after it, and editing a tool definition invalidates the entire cache. A cache read costs 10% of the base input price; a five-minute cache write costs 125% ([prompt caching docs](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)). So a large harness bills you twice: context competing with the task, and a prefix you invalidate every time you tune it. "Make it cheap to change" now has a line item.

The honest counter is [wonnage's](https://news.ycombinator.com/item?id=49411302). Open prompting works on well-trodden paths, where "fix ci" works fine, and falls over on "why app slow," where you either need an engineer who can narrow the problem or a template that will never fit it. Several people replied that models now do this unaided. [0x457](https://news.ycombinator.com/item?id=49411792) has one pull metrics, traces and CPU profiles through a Grafana MCP server. [rurban](https://news.ycombinator.com/item?id=49416681) says it reaches for `perf` without being told. [theptip](https://news.ycombinator.com/item?id=49420663) gets results from "I'm worried here about cpu and latency, please rigorously profile and propose fixes."

[wonnage's reply](https://news.ycombinator.com/item?id=49413129) is the line I would keep: if you already have something to sample, the hard part is done. The missing piece is usually the telemetry, not the reasoning.

So the prescriptive layer shrinks against a fixed environment. It shrinks because the model got better at using what is already there. It does not shrink where the data was never collected.

## What does not shrink: gates on side effects

Syntaf's other answer is the best concrete thing in the thread, and it sits four replies deep. Their agent can book a journal entry to a client's cash account only if it supplies a receipt and links the transaction from the client's bank feed. Without both, [the tool call is denied](https://news.ycombinator.com/item?id=49410431) and returns a cited code plus an explanation. The usual outcome is that the agent stops and messages the client asking for proof.

Three things in that, and I expected one.

- **The check runs before the tool call, not inside the tool.** They call it a "gate" and it sits [in front of every call an agent makes](https://news.ycombinator.com/item?id=49410498). Same position as `beforeToolCall` in pi's loop, which is [where the permission prompt lives](/posts/2026/08/07/reading-pi-agent-loop/) and the one preflight step that stays sequential even in parallel mode.
- **The denial is a result, not an exception.** A code plus a reason means the next correct action is derivable from the failure. The agent escalates instead of retrying.
- **The rule is stricter for the agent than for a human on the same platform.** Syntaf says so plainly: a human may have a valid reason to post without the receipt, so this is deliberately not platform-wide validation.

The third one is load-bearing. The gate encodes authority, not competence. A better model does not thereby acquire the standing to move a client's money on its own word. That makes this layer model-independent by construction, and it will be the same size in three years.

Good intention will not work, mechanism does. I adopted that phrase from a colleague at Amazon, and it keeps applying to things he never saw.

## What does not shrink: the verification loop

[rurban's comment](https://news.ycombinator.com/item?id=49416787) is near the bottom and reframes the word better than the post does. He has worked with harnesses for decades, because in Perl a harness is `Test::Harness`: `runtests(@test_files)`, parallel jobs via `HARNESS_OPTIONS=j9`, pass/fail statistics out the other end ([perldoc](https://perldoc.perl.org/Test::Harness); the current implementation is `TAP::Harness`, and the original was inspired by Larry Wall's `TEST` script). A build-and-test system.

His claim: a CI is the best harness, the agent is a feedback loop between the model and it, and because the loop has to be fast, a real CI is too expensive and only serves as end verification. So the harness's job is fast per-configuration tests, with cleanup and parallelization.

[theptip](https://news.ycombinator.com/item?id=49420578) states the economics. Build the harness so the solution is easy to verify, and you profit as long as verification is cheaper than building.

[avadodin](https://news.ycombinator.com/item?id=49413296) resolves the prescriptive-versus-open argument in four sentences. A minimal harness with a high-level prompt produces the outlier results. The same setup produces garbage about as often. The process exists so a human or a judge agent can review the output. The process is for the reviewer, not for the model. Both camps are correct and they are optimizing different variables: one the ceiling, the other the cost of checking.

Verification does not become free either. [stymaar](https://news.ycombinator.com/item?id=49426351) pushes back that "just read the acceptance test" is carrying a lot of weight, since tests are often longer than the code they cover. A test rig moves what you read. It does not remove the reading. Same constraint I hit from the other direction in [the verification loop decides how many agents you can run](/posts/2026/07/28/make-an-agentic-workflow-deterministic-and-verifiable/).

## The session is a file, and the file has a price

[xrd asked](https://news.ycombinator.com/item?id=49410304) for a harness that is good at handoff: terminal to phone, person to person, TUI to email, one provider to another. He keeps losing track of which machine his agent is on.

Every answer converged on one shape. The session is the raw conversation history, so it is a file. [itishappy](https://news.ycombinator.com/item?id=49411307) points at opencode storing sessions in SQLite with an export command. [gf000](https://news.ycombinator.com/item?id=49420189) notes that jsonl, one message object per line, is the common format. [dbmikus](https://news.ycombinator.com/item?id=49415145) adds that a real handoff also needs the working state, usually the git patches. [arw0n](https://news.ycombinator.com/item?id=49422160) states it and then prices it: context is just a file, switching models means re-ingesting it with no cache, and "a cost like 25c can add up when agents run amok."

That is the translation layer's bill, and the mechanism is worth naming. Prompt caching is keyed to an exact prefix under one provider, so a model swap is a guaranteed full miss. Cached input costs 10% of base, a miss costs 100%, and writing the new entry costs 125%. Model portability is roughly a 10x input charge on the request where you switch.

Which makes the post's freedom argument true and small. Swapping models at a human decision point is a rounding error. Swapping inside an automated loop is a bill. arw0n's warning lands exactly on that line.

## Commodity or moat: both, at different layers

The commodity argument ran longest and never resolved, because the two sides were describing different layers.

- [amelius](https://news.ycombinator.com/item?id=49409573): harnesses are not hard and will commoditize; value sits in hardware, then the model, then the harness a long way back.
- [conmod278](https://news.ycombinator.com/item?id=49409632) links Dan McAteer's [The Evolution of the Agent Harness](https://www.latent.space/p/attention-interface): labs post-train models inside a harness, harness capabilities get absorbed into the weights, and engineers delete whatever got absorbed.
- [layer8](https://news.ycombinator.com/item?id=49410225): the harness is by definition the part you want to keep customizable, and that part does not get absorbed.
- [wyre](https://news.ycombinator.com/item?id=49414222): what gets absorbed is tool use in general, not one harness. Training a model to a specific harness is like hiring an engineer who only performs with their own tools.
- [grim_io](https://news.ycombinator.com/item?id=49409817) expects a Chromium-shaped harness, one full implementation everyone builds against. [wyre answers](https://news.ycombinator.com/item?id=49414368) that browsers are hard and harnesses are easy, and that we are somewhere around Netscape with no JavaScript yet.

Both sides are right along the same seam as everything above. What encodes model competence gets absorbed: prompt scaffolding, how-to-use-a-tool instructions, and [reportedly hundreds of lines of Claude Code's system prompt](https://news.ycombinator.com/item?id=49409486). What encodes your authority, your money, and your standard of proof cannot be, because none of those are facts about the model. McAteer arrives at the same place from the trend line and names the residue: permissions, identity, trust, legibility.

## Key takeaways

- **Two definitions are in circulation.** Mechanical: prompt, tools, loop. Political: the one you own and can point at a different model. The arguments are about the second while claiming to be about the first.
- **The prescriptive layer shrinks with model quality.** 2,000-line skills lost to tools plus guardrails. A big harness bills twice, in context that competes with the task and in a cache prefix you invalidate every time you tune it.
- **Gates on irreversible side effects do not shrink.** They encode authority, and no amount of model improvement earns an agent the standing to move money without a receipt.
- **Verification does not shrink, and process is for the reviewer.** That is why the two camps talk past each other. One optimizes the ceiling, the other the cost of checking.
- **Model portability is priced as a cache miss**, roughly 10x the input cost of a cached continuation. A rounding error at a human decision point, a bill inside a loop.

The post asks what a harness is. The thread answers a more useful question by accident: which parts of it you will still be maintaining after the next model ships.

---
title: "Which Cursor model should I use, and what each one is for"
description: "A dated catalog of the models on my Cursor picker: what Cursor claims, what each costs, and which of them I actually reach for when coding, prototyping, or reading."
tldr: "My Cursor default is Claude Opus 5 at high thinking, because retries from a weaker model cost more time and attention than the frontier premium costs in tokens. This page catalogs the eleven picker entries as of 2026-09-06, separates the ones I run from the ones I have never hand-picked, and explains why a Claude-shaped skill library pulls the choice toward Anthropic models."
date: 2026-09-06
tags: ["cursor", "llm", "agents", "tools", "engineering"]
draft: false
faq:
  - q: "Which Cursor model should I use by default?"
    a: "Pick one capable model and stay there until a task proves you need something else. My default is Claude Opus 5 with high thinking and the 1M context window. Cursor's own advice runs the other way: start with Composer 2.5 for everyday coding and escalate to Grok 4.6 or Opus 5 when a task stalls."
  - q: "Is Claude Opus 5 worth ten times Composer's token price?"
    a: "That depends on what your time is worth more than on the token math. Opus 5 lists at $5 per million input and $25 per million output tokens; Composer 2.5 lists at $0.50 and $2.50. If the cheaper model needs several rounds of correction on a task Opus finishes once, the gap narrows and your attention is already spent."
  - q: "What does plan with Opus, build with Sonnet mean?"
    a: "Run the planning turns on Claude Opus 5, which Cursor documents as strong at mapping work before executing, then switch the picker to Claude Sonnet 5 for the implementation turns. Sonnet 5 lists at $2 and $10 per million tokens and Cursor describes it as close to Opus quality on real coding work."
  - q: "Should I use Auto in Cursor?"
    a: "Know which Auto you have first. Cursor Router, the classifier behind the Balance and Intelligence modes, is documented as available only on Teams and Enterprise plans. On a personal plan, Auto uses the older cost-optimizing routing logic. You also cannot hand-pick the model a routed request lands on."
  - q: "Why do skills behave differently across Cursor models?"
    a: "Because skills are instructions, and instruction-following differs by model. Cursor loads skills from Claude directories including .claude/skills/ and ~/.claude/skills/, so a library written for Claude Code runs unchanged in Cursor. Cursor's own docs list weaker instruction-following against the strongest Claude models as a limitation of GPT-5.6 Sol."
  - q: "Which Cursor model is best for research and learning?"
    a: "For reading and explaining, I use the same Anthropic models I code with, and I compare two or three top models when the plan matters more than the code. Cursor describes GPT-5.6 Sol as concise and a strong rubber-duck partner for planning and debugging, which is the closest thing in their docs to a research recommendation."
  - q: "Does the model choice matter if Cursor is not your main tool?"
    a: "Less than the harness choice does. Cursor is my second or third editor after Claude Code and agents I build on the Claude Agent SDK. The harness decides what context the model sees, which tools it can call, and what happens after a tool fails. A better model inside a worse loop still loses."
---

Cursor's model picker holds ten models plus Auto, and every entry is a model times a set of knobs: thinking, Fast, effort level, and context window, billed from one of two usage pools. My default is Claude Opus 5 at high thinking with the 1M window. This page records what each entry is for, and which ones I have never chosen.

Snapshot date: 2026-09-06. The list moves every few weeks, so treat the prices and the names as perishable.

## My default: one capable model, held still

I run Claude Opus 5 in agent mode and leave it there. The one variation is planning: I plan with Opus 5, then switch the picker to Claude Sonnet 5 to build. Cursor documents Opus 5 as strong at planning and tool use, mapping work before executing and adapting when tool output surprises it, and recommends [the high thinking variant](https://cursor.com/docs/models/claude-opus-5) for best results. Sonnet 5 is [documented as close to Opus quality](https://cursor.com/docs/models/claude-sonnet-5) at $2 and $10 per million tokens against Opus at $5 and $25.

I also use Auto for a large share of requests. That habit came from my work account, and it does not transfer cleanly to a personal one. See the Auto section below.

## The bet: a weak model's retries cost more than a strong model's tokens

My reason for defaulting high is a belief about cost, not a benchmark. A model that cannot finish the task hands the work back to me. I re-read a bad diff, write the correction, and pay for the second attempt in tokens too. Time, attention, and tokens all move together, and only one of the three shows up on the invoice.

The on-call version of this is familiar. Paging the least loaded engineer at 2am to protect the senior's sleep often extends the incident and costs everyone more sleep than paging the person who knows the system.

Two honest qualifications:

- **Cursor's documented advice is the opposite of mine.** They position [Composer 2.5 for everyday coding](https://cursor.com/help/models-and-usage/grok-4-6) where speed and cost matter, and Grok 4.6 for harder, longer sessions, with escalation once a task shows it needs more.
- **I have not measured it.** No retry counts, no spend comparison. At this stage I would rather reach the tool's real limits than optimize a bill, so I run the capable model and look for the edge where it fails.

## The catalog, as of 2026-09-06

Eleven entries sit on my picker. Prices are per million tokens at the standard (non-Fast) tier, from [Cursor's models and pricing page](https://cursor.com/docs/models-and-pricing); the context columns come from [Cursor's model table](https://cursor.com/docs/account/pricing/request-based-legacy).

| Picker entry | Pool | In / Out | Context | Cursor's pitch |
|---|---|---|---|---|
| Auto (Balance) | routed | routed model's rate | varies | Classifier picks per request |
| Claude Opus 5 | Other | $5 / $25 | 300k, 1M max | Long-horizon agentic coding |
| Claude Sonnet 5 | Other | $2 / $10 | 200k, 1M max | Near-Opus at lower price |
| Claude Opus 4.6 | Other | $5 / $25 | 200k, 1M max | Previous flagship; superseded |
| GPT-5.6 Sol | Other | $4 / $20 | 272k, 1M max | Persistent, concise, skimmable |
| Codex 5.3 (GPT-5.3 Codex) | Other | $1.75 / $14 | 272k | Terminal work, deep debugging |
| Cursor Grok 4.6 | Cursor | $2 / $6 | 256k | Hard, long-running agent runs |
| Composer 2.5 | Cursor | $0.50 / $2.50 | 200k | Everyday coding, cost and speed |
| Kimi K3 | Other | $3 / $15 | 200k, 1M max | Best open-weight on CursorBench |
| Gemini 3.7 Flash | Other | $0.75 / $3.50 | 200k, 1M max | Speed tier, 90% cache discount |
| GLM 5.2 | Other | $1.40 / $4.40 | 200k | Open weight, served via Fireworks |

Sol's rate is promotional through November 21, 2026, and its input price doubles above 272k tokens. Opus 5 and Sonnet 5 carry no long-context multiplier, and Kimi K3 is flat across its whole window with no cache-write fee. Two entries are already stale: Cursor recommends [Opus 5 over Opus 4.6](https://cursor.com/docs/models/claude-opus-4-6) at the same price, and [Gemini 3.8 Flash over 3.7 Flash](https://cursor.com/docs/models/gemini-3-7-flash), also at the same price.

## Anthropic models: what I run

Opus 5, Sonnet 5, and Opus 4.6 are the entries I have real hours on. Opus 5 replaces Opus 4.8 and Cursor calls it a step change on agentic coding and long-horizon reasoning, on par with Fable 5 on CursorBench at Opus pricing. It is also Zero Data Retention compatible, which the Fable models are not. The documented weakness matches what I see: it over-elaborates in long sessions where I wanted brevity. Sonnet 5's catch is mechanical rather than qualitative — its updated tokenizer maps the same input to more tokens, so a token count is not comparable to older Sonnet numbers.

## OpenAI models: the occasional second opinion

I try GPT models from time to time, mostly when a plan matters enough to hear it twice. Cursor describes [GPT-5.6 Sol](https://cursor.com/docs/models/gpt-5-6-sol) as the strongest of the Sol, Terra, and Luna family, persistent across multi-hour sessions, with less final-message padding than Claude models and useful as a rubber-duck partner. The listed limitations are specific: it over-uses subagents on mid-sized tasks, sometimes waits for an explicit "do it" after agreeing with feedback, and its instruction-following can lag the strongest Claude models on agent behavior evals. [Codex 5.3](https://cursor.com/docs/models/gpt-5-3-codex) is the cheaper terminal specialist, claimed to lead Terminal-Bench by a wide margin and to match Opus 4.6 on Cursor's internal benchmarks at roughly a third of the price, with less polished code style on architecture-heavy work.

## Cursor's own models: untested by me

I have never hand-picked [Grok 4.6](https://cursor.com/help/models-and-usage/grok-4-6) or [Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5), so I have no verdict on either. What the docs claim is worth knowing anyway. Both draw on the Cursor Models pool, which carries much more included usage than the third-party pool and is exempt from the Cursor Token Rate on team plans. Composer 2.5 is trained with reinforcement learning on long-horizon coding tasks and tuned for tool use, file edits, and terminal operations inside Cursor. Grok 4.6 offers four effort levels, low through xhigh, defaults to high, and is claimed to hold instruction-following even with many skills and rules loaded. That last claim is the one I would test first, for the reason in the next section.

## Open weights and the speed tier: also untested

[Kimi K3](https://cursor.com/docs/models/kimi-k3) is the entry I am most curious about, and reading its C implementation was worth [a post of its own](/posts/2026/08/03/reading-kimi-k3-in-c/). Cursor calls it the highest CursorBench score they have measured from an open model, with thorough upfront reasoning and strong one-shot persistence, priced flat across the full context window. [GLM 5.2](https://cursor.com/docs/models/glm-5-2) is the other open-weight option, served through Fireworks; its docs page lists no strengths and no limitations, which tells you how much Cursor is willing to promise. Gemini 3.7 Flash is the speed tier, cheap with a 90% cached-input discount and a 1M window, and already superseded by 3.8 Flash.

## Auto: know which Auto you have

Auto is where the personal and work accounts diverge, and the difference is easy to miss. [Cursor Router](https://cursor.com/docs/cursor-router), the classifier that reads each request and routes it by task type and complexity, is documented as available only on Teams and Enterprise plans. The Balance and Intelligence modes belong to that router. On a personal plan, Auto runs the older cost-optimizing logic instead.

Three properties matter whichever plan you are on:

- **You cannot hand-pick the model.** The pool changes as new models ship, and your only steering wheel is the optimization mode.
- **You are billed at the routed model's list price**, plus the $0.25 per million token Cursor Token Rate for third-party models on team plans.
- **The routed model name is hidden by default**, which Cursor recommends so results are judged on merit rather than by name.

That last default is reasonable product design and a problem for anyone trying to learn which model suits which job. If you want to build the judgment, hand-pick for a while.

## What each job actually needs

Three jobs, three different failure modes. Coding means editing a real repository under existing conventions, with tests as the verifier. Prototyping means a first version where speed beats correctness and the verifier is my own eyes. Research and learning means reading sources and explaining mechanisms, where the failure mode is a confident wrong summary that no test will catch.

| Job | What decides it | My pick | Untested candidates |
|---|---|---|---|
| Coding in a real repo | Instruction-following, tool use, recovery after a failed test | Opus 5; Sonnet 5 for the build turns | Grok 4.6, Codex 5.3 |
| Prototyping | Time to a working first pass | Opus 5, same session as the plan | Composer 2.5, Grok 4.6 |
| Research and learning | Restraint with sources, no confident filler | Opus 5, plus a second model on plans that matter | Kimi K3, GPT-5.6 Sol |

The pattern is honest but not flattering: I use one model for all three jobs. The right-hand column is my test backlog.

## Why my picks lean Claude: the skills are Claude-shaped

Habit is part of it, and the rest is the tooling. My working knowledge lives in skills and project files written for Claude Code, and [Cursor loads skills](https://cursor.com/docs/skills) from `.claude/skills/` and `~/.claude/skills/` for compatibility alongside its own directories. The library runs unchanged. Its language, structure, and idioms were tuned against Claude models.

That makes the model choice partly a compatibility question. Skills are instructions, so how well they land depends on instruction-following, and Cursor's own documentation puts numbers around this in prose: Sol's instruction-following can lag the strongest Claude models, while Grok 4.6 claims strength with many skills and rules loaded. If your procedure library was written against one family, expect the same family to follow it with less friction.

The [Agent Skills standard](https://cursor.com/docs/skills) is portable in format. Behavior under those instructions is not portable in the same clean way.

## Where Cursor sits in my stack

Cursor is my second or third editor. First is Claude Code. Second is the agents I build on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), which exposes the same agent loop, tools, and context management as a library. Cursor's value for me is steering inside the editor and comparing models side by side in one picker.

That ordering matters for anyone reading this as a model recommendation. The harness decides what the model sees, which tools it can reach, and what happens after a tool call fails. Model choice sits downstream of that. A frontier model inside a worse loop still loses to a mid-tier model inside a good one.

## What I have not tested, and what would change my mind

Written plainly so this page stays honest:

- **Grok 4.6 and Composer 2.5**, both untried by hand. Cursor's escalation advice depends on them.
- **The retry cost claim**, which I hold as a belief and have never measured.
- **Kimi K3 for reading and research**, where flat pricing across a 1M window is a genuinely different shape.

The next update either brings evidence for these or drops the claims. I plan to refresh this page each quarter, since the picker will not wait.

---
title: "Reading software factories: artifacts on the edges, humans at merge"
description: "Ostrovsky's software-factory survey: artifacts as nodes, agents on the edges, humans at merge. Not a better coding agent."
tldr: "A software factory is not a remote coding agent. It is an event-driven graph: artifacts (issues, specs, PRs) are nodes, agents transform them along the edges, and humans plus CI decide when work advances. Cloudflare reports Astro's open issues going from 200+ to about 30 over several months of label-driven triage, with a report.md passed between isolated agents. Vercel's factory authored 25–35% of weekly merges because it optimized reviewer attention, not generation. Uber's 70% is a different claim: PRs attributed to any local or cloud agent, including interactive sessions."
date: 2026-09-14
tags: ["learning-notes", "ai", "agents", "orchestration", "engineering"]
draft: false
---

> Part of a series on structuring agentic systems. Previous: [Procedural graphs: forcing the plan is worse than no plan](/posts/2026/09/11/procedural-graphs-two-papers/).

Notes from reading [Software Factories in September 2026](https://igoro.com/archive/software-factories/) by Igor Ostrovsky (Augment co-founder; the survey includes their Cosmos product). The useful content is the public factories he lined up, not the product.

## Three layers, and only the third is a factory

Ostrovsky's stack, in one sentence each:

- **Coding agent.** A harness that calls a model, runs tools, feeds results back, stops when the model stops asking. One task, one session, a human started it.
- **Cloud agent.** The same loop on managed remote compute. The machine moved. The workflow did not.
- **Software factory.** A system that *starts* work from events and coordinates several agents through a structured engineering process. Agents read and write artifacts. People approve the gates.

Concrete: a GitHub issue labeled `needs triage` starts a reproduction agent. That agent writes `report.md`. A diagnosis agent reads the file and appends a root cause. A fix agent opens a branch. A reporter confirms the preview. A human merges the PR. Nobody sat in a terminal prompting each of those steps.

If a human still has to kick off every session, you have a fleet of coding agents. You do not have a factory.

## The graph: nodes are artifacts, edges are agents

Ostrovsky models a factory as a graph. Ground it before using it.

- **Nodes** are durable artifacts: a requirement, an issue, a spec, a pull request, an alert, a support ticket. Anyone — agent, human, CI — can read and write them later.
- **Edges** are processes that turn one artifact into the next. A planning agent turns a Slack message into tickets. A coding agent turns a ticket into a PR. A review agent annotates the PR. Merge and CI are the gates on the edge, not extra nodes.

Agents do not share a context window. They share files and tickets. That is the same isolation I argued for in [the orchestrator is blind on purpose](/posts/2026/08/07/the-orchestrator-is-blind-on-purpose/): control and state live outside the model, because the lead agent sees less than the harness does. The factory makes that the default architecture, not a prompt instruction.

The public graphs, as Ostrovsky draws them:

| Factory | Start | Path | Human gate |
|---|---|---|---|
| [Astro / Cloudflare](https://blog.cloudflare.com/astro-issue-triage/) | Issue | reproduce → `report.md` → diagnose → fix branch + preview → reporter confirms | PR |
| [Vercel AI SDK](https://vercel.com/blog/building-a-software-factory-for-ai-sdk) | Issue | classify → spec → implement + test → PR + evidence → risk review | merge, then backport PRs |
| [Uber](https://www.uber.com/us/en/blog/efficient-software-factory/) | Slack / CI / alert | research → design → draft PRs → validate → evidence | review / escalation |
| LaunchDarkly | PR | review + risk → flagged change → guarded release → measurements | follow-up change |
| WorkOS | Requirements | decompose → issues → implement | review before implement, merge before the next issue |
| Ona | Human spec | plan → issues → implement + review → merge + smoke test | replan on production errors |

They start at different events and stop at different approvals. The shape is the same: artifact in, artifact out, a person at the irreversible step.

Ostrovsky's personal threshold is the one I would keep. Coding agents already generate a lot of code. The scarce thing is confidence to merge. A factory that can take a draft PR through review, verification, fix, and feedback, and only ping a human on the judgment calls, has crossed it.

## Astro: labels as the state machine, `report.md` as the ABI

Astro's factory does one workflow: incoming bug reports. Cloudflare [picked it](https://blog.cloudflare.com/astro-issue-triage/) because a single report could take hours just to reproduce, and because it was painful enough that nobody would miss doing it by hand.

They started with a skill that encoded the maintainer's own steps: reproduce, diagnose, verify, fix. Then they split each step into an isolated subagent. Isolation is load-bearing. A single agent has a bias toward forcing a solution even when the report is not a bug. Separate agents cannot keep that momentum, because they only see the file the previous one wrote.

The file is `report.md` in a triage directory. Reproduce writes whether the bug happened. Diagnose appends a root cause. Verify appends whether it is actually a bug. Fix reads that and adds tests plus a patch. No shared session. The next agent cannot "remember" a conclusion that was never written down.

Orchestration is GitHub labels, not a custom database. Open or reopen → `needs triage`. The label starts the Actions run. Cannot reproduce → needs more information. Fix lands → preview via `pkg.pr.new`, issue marked `fix pending`. Reporter accepts → PR. Reporter rejects → `fix rejected`. The pipeline holds no state of its own. It rereads labels and comments.

Cloudflare reports open issues going from more than 200 to about 30. Read it as their claim about a multi-month window with everything else the maintainers shipped in it, not as a measured effect of the bot alone. The orchestration and the agent instructions are public ([`triagebot-action`](https://github.com/withastro/triagebot-action)). Fred Schott told [The New Stack](https://thenewstack.io/cloudflare-astro-triage-bot/) that the fix step is the least essential part — a verified reproduction handed to a human is already a win. I believe that. Reproduction was the hours. Merge is the trust.

The failure mode they actually learned from is better than the headline. The bot kept trying to flip one `if` to fix a cluster of HMR bugs, and each "fix" regressed something else because that condition had no tests. They added a comment explaining the condition. The bot stopped. Cloudflare's reading: agent failure is a pointer at opaque abstractions, missing comments, or missing tests — the same three things that slow a human. Improving the factory improved the codebase.

## Vercel: one agent per task, because the bottleneck is the reviewer

By late June 2026 the AI SDK repo had more than 1,000 open issues and almost 800 pull requests, on 100+ new issues a month. [Lars Grammel and Eric Dodds](https://vercel.com/blog/building-a-software-factory-for-ai-sdk) state the constraint without hedging: every existing agent setup still routes every change through one human's attention. The factory exists to make that attention cheaper, not to remove it. Docs glance. Provider change, focused validation. New public API, deep review. Agents produce a chain of evidence so the human can pick the depth.

They tried one agent with a skill per step and dropped it. Maintenance and debugging got worse. Production is one agent per task, each with its own prompt, context, and evals: classification, bug reproduction, bug fix, PR review, backport, docs, feature analysis, feature implementation.

Worked example, issue [#17898](https://github.com/vercel/ai/issues/17898), July 24: add blocked-domain support to OpenAI web search.

1. Classifier labels it Feature, with rationale on the issue.
2. Analysis agent writes `issue-17898-type-probe.ts`, runs it, watches it fail, and uses that failure as proof the feature is missing. Then it writes a spec: optional `blockedDomains` on the existing tool, mapped to the provider field, backward compatible, docs in scope.
3. Implementation agent builds it, runs a live e2e with wikipedia.org blocked, and opens a PR with that evidence.
4. Review agent scores side-effect / performance / compatibility risk and approves.
5. Lars reads the chain and merges [#18033](https://github.com/vercel/ai/pull/18033), then merges the two backport PRs the factory opens — including the v5 conflict it repaired and pushed 17 minutes later.

Four weeks in, factory agents authored 25–35% of weekly merges to `main`. Factory PRs were above 50% of weekly merges on the v6 line — backports they used to skip because conflicts were not worth it. In July, over 75% of closed issues were closed by the factory. Open issues: 1,022 in late June to 844 by early August. Open bugs down about 25%. Every merge still needs a human on the AI SDK team.

The other useful invention is the run taxonomy. Every run ends **success**, **flawed**, **blocked**, or **manual**. Only success ships.

- Flawed → wrong output → better prompt, context, or eval case.
- Blocked → missing credential / service / dependency → provision it.
- Manual → a boundary you drew on purpose → decide whether to keep it.

That is how the automation boundary moves without a meeting. Improving the factory becomes the job.

Security is not an appendix. The second agent they built, reproduction, already executes untrusted public input. Every agent runs in an isolated Vercel Sandbox with only the secrets that task needs, plus a network shield. Untrusted text can shape a proposal. It cannot exfiltrate a key. Human merge is the last line, not the only one.

## Uber: a platform, and a number that does not mean what Vercel's means

Uber's [August 27 write-up](https://www.uber.com/us/en/blog/efficient-software-factory/) is a cost-and-platform paper, not a single workflow. The numbers that travel:

- More than 70% of pull requests are *attributed to* local or cloud agents.
- 3,600+ agent skills, 30k+ skill executions per day.
- February to mid-August 2026: weekly active users 7x, weekly agentic requests 9.4x, total AI spend relatively stable since April.
- Same model held fixed, February to July: cost per 1,000 requests down ~34% from peak; cost per session down 52% from the June peak.

Read "attributed to" carefully. That includes an engineer in a terminal with a coding agent. It is not Vercel's "authored by `ai-sdk-factory`." Mixing the two is how a 25% authored figure becomes a 70% factory figure in a slide.

What *is* factory-shaped at Uber is the managed-agent layer: sessions started by workflows rather than people — CI repair, review, alert triage, e2e PRs with visual checks, maintenance — with human review and escalation. They treat that layer as cheaper to optimize than thousands of interactive terminals, because you control the model, the harness, and the eval for each specialized agent.

The skills number connects to a problem I already have. An org that lets 3,600 skills accrete, then runs 30k executions a day, has a load-time and shadowing problem, not just a catalog problem. [Personal skills outrank project skills](/posts/2026/09/10/managing-agent-skills-in-an-engineering-org/) in Claude Code. A marketplace does not by itself decide which skill fires.

## Process pays when the work already has a shape

Ostrovsky's split is the first-principles one.

Process is worth it: a production alert. Collect logs, tie it to a recent change, open a rollback PR, wait for approval, deploy, watch recovery. The stages already exist. Agents fill them.

Process is not worth it: brainstorming a feature you cannot name yet. Fixed roles add friction. An engineer and an agent in a loop is the right tool.

So work splits. Novel design, product intent, architecture forks stay interactive. Another payment provider, the same migration across forty services, the CRUD endpoint that looks like the last twenty, go to the factory.

Team size, in his experience, does not predict success. A one-person project can run this way if every change still needs human approval and the factory annotates the PR with screenshots, risk, and decisions. Uber can run it on alert triage. What does predict it:

1. The team already uses agents heavily — build, logs, e2e, Slack, credentials, skills, MCP. A factory is not how you start.
2. The team already values structure. Factories fit process cultures. They fight free-form ones.
3. Someone owns the introduction. It changes how people work, not only what they install.

## Inversion of control, and two ways this dies

The deeper claim: instead of a human prompting an agent through each step, the system starts the work and asks for context, approval, or judgment when it needs them. Agents may end up prompting us more often than we prompt them.

Ostrovsky is honest that this will not make building software easy. Anyone who does a lot of review already knows: responding to prompts can cost more attention than writing them. The [verification loop](/posts/2026/07/28/make-an-agentic-workflow-deterministic-and-verifiable/) is still the cap on how many of these you can run. A factory that generates merge-ready PRs faster than you trust your tests has the same defect: agent count scaled before the loop earned the trust.

Two failure modes he names, both worth keeping:

- **Plateau.** Factories never get past routine alerts and simple tickets. Useful, not a paradigm.
- **Displacement.** A "synthetic engineer" that joins a team, reads the docs, asks questions, and starts work makes the graph unnecessary.

The second is real and unquantified. The first is the default until a team builds the evidence chain Vercel did. I would bet on the graph getting more autonomous, not on it being the last shape.

## Key takeaways

- **A factory is event → artifact → gate.** If a human still starts every session, you have cloud agents. The ABI between agents is a file or a ticket, not a shared context window.
- **Classify failure or the boundary never moves.** Success / flawed / blocked / manual. Only the last three tell you whether to change a prompt, provision a dependency, or keep the human gate.

The survey is a vendor-adjacent map of other people's factories. The map is worth more than the product pitch around it. The next thing to steal is not the product. It is `report.md` plus a label, and a run that can fail in a named way.

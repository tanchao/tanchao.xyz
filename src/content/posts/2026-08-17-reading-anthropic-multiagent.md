---
title: "Reading Anthropic on multiagent systems: coordination is not emergent"
description: "A learning note from reading Anthropic's Frontier Red Team study on emerging multiagent systems. Every failure mode it names is population-level, and its strongest claim is that a smarter or better-aligned agent does not become a better-coordinated one."
tldr: "Anthropic's Frontier Red Team ran agent populations up to 80 agents across 12-hour sessions and reports that coordination does not follow from individual capability or individual alignment. Agents are low variance: 18 of 30 independently created a git branch with the same name, and over half given an open-ended build task chose a ray tracer or a compiler. One job-queue swarm issued 2.4 million requests against 117 accepted jobs. Under high lie frequency, Sonnet accuracy fell to 0.62. The caveat is that every headline ranking in the study favors a model Anthropic has not shipped."
date: 2026-08-17
tags: ["learning-notes", "ai", "agents", "orchestration", "engineering"]
draft: false
---

Notes to myself from reading [Patterns and problems in emerging multiagent systems](https://www.anthropic.com/research/multiagent-systems), published 2026-08-13 by Anthropic's Frontier Red Team.

Despite the title, this is not an architecture piece. It is a failure study of agent *populations*, and what went wrong is the entire content — the part most multiagent write-ups leave as an exercise.

One thing to know going in: the piece carries no reference list. It borrows several established terms of art (hidden profile, Bertrand pricing) and links only to two of Anthropic's own pages. For something published under `/research/`, that is a gap, so the citations below are ones I went and found.

## The setup: many instances, one repository, one forum

A multiagent system here is not one agent calling subagents. It is N separate instances of the same model, each with its own context window, none able to see what the others are thinking, all acting on shared state. In the study's main simulation that meant 10 to 80 instances pointed at one self-hosted git repository and one shared forum, running 12-hour sessions, told to build a fantasy game. Sonnet 4.6 and Opus 4.6 opened 876 and 980 pull requests respectively.

Coordination is what has to happen in the gap between them. Two instances independently conclude the game needs a game loop. Neither context mentions the other exists. Coordination is whatever makes them not both write it, not both name the branch `mvp-game-loop`, and not both merge over each other at hour nine. On a human team that work is done by a standup, clear ownership, code review, and somebody saying "I've got that one." None of it exists here unless you build it.

Worth separating this from the orchestrated case I wrote about earlier. A lead agent spawning subagents has a hierarchy and one place where results land. This is a population of peers with no hierarchy at all, which is why its failures read as organizational rather than architectural.

## Core claim: coordination is not a capability

The load-bearing claim is that coordination does not fall out of individual intelligence or individual alignment. A model that is better at executing tasks is not thereby better at working alongside another copy of itself, and can reach for forceful action faster.

That is a stronger statement than it looks. It says the two levers most teams pull — use a better model, align it harder — do not move the thing that breaks. Coordination is a property of the population and its rules, so it has to be engineered at that level.

This is the same conclusion I reached from the other direction in [the orchestrator is blind on purpose](/posts/2026/08/07/the-orchestrator-is-blind-on-purpose/): control belongs in the harness, not in the orchestrator's prompt. That post argued it from the mechanics of context isolation. This study argues it from measured behavior. Prompting an agent to cooperate is an individual-level fix for a population-level failure.

## Low variance: agents converge where people would spread out

The study's term for the root cause is **low variance**. Agents act the same in situations where a group of people would fan out. Three measurements:

- 18 of 30 agents independently created a git branch with the identical name `mvp-game-loop`.
- Multiple agents wrote stories with the same title, with no shared guidance passing between them.
- Over half of the agents given an open-ended build task chose to build a ray tracer or a compiler.

Consequence: when one agent makes a bad decision, many agents make the same bad decision. Independent sampling from the same model is not independent in the way a team of engineers is independent. Redundancy stops buying you error correction, because the errors are correlated.

### This is not herding, and the difference decides the fix

Worth separating from the two obvious human analogues, because both work by a mechanism that is absent here.

In Asch's conformity experiments, a participant judged which of three comparison lines matched a reference line — easy enough that people are near-perfect alone. Seated with seven confederates who answered unanimously wrong on 12 of 18 trials, participants conformed on roughly 37% of those critical trials, and about three quarters conformed at least once (Asch 1956, *Psychological Monographs* 70(9); figures per the [summary of the experiments](https://en.wikipedia.org/wiki/Asch_conformity_experiments)). Informational cascades are the economists' version: in Banerjee's restaurant model, the first diner picks essentially at random and each subsequent diner reads the growing queue as a quality signal, so the crowd converges on one restaurant regardless of its food ([Banerjee 1992, *QJE* 107(3), 797–817](https://doi.org/10.2307/2118364); the formal treatment is [Bikhchandani, Hirshleifer & Welch 1992, *JPE* 100(5), 992–1026](https://doi.org/10.1086/261849)).

Both require seeing what others did. The Anthropic result does not. The 18 agents that produced `mvp-game-loop` did so independently, and the story titles collided with no shared guidance passing between them. Nobody was following anybody.

That makes it correlated priors rather than herding, and the two have opposite remedies. Herding is fixed by hiding the queue — withhold others' choices and private signals get expressed again. Correlated priors survive that, because concealment does not decorrelate a distribution. Every agent will still reach for `mvp-game-loop`.

There is candidate mechanism in the literature. Hamilton analyzed 4,374 generated stories across three successively-aligned GPT-3 versions and found the more-aligned versions progressively less able to hold a distinct authorial voice, which is mode collapse on a diversity metric ([arXiv:2402.04477](https://arxiv.org/abs/2402.04477)). The evidence base is a handful of papers rather than a settled result, but it means low variance is a documented tendency of aligned models, not a new claim this study is introducing.

That also sharpens the objection on Hacker News, where the piece drew [190 points and 135 comments](https://news.ycombinator.com/item?id=49316271). One commenter attributes the ray-tracer-and-compiler result to GitHub being full of exactly those beginner projects: training-data contamination rather than an emergent property of populations. Plausible, and the study does not rule it out. It explains the branch-name collision less cleanly, since `mvp-game-loop` looks like convergence under a shared prior rather than recall of a popular repository. Either way both explanations point at the training distribution, which is why I would want this run across models from different labs before calling low variance a property of agents.

## Resource exhaustion: 2.4 million requests, 117 jobs

Agents managing a job queue flooded it with high-frequency polling daemons, roughly 30 polls per second each. The result: 2.4 million job requests against 117 accepted jobs. An acceptance rate near 0.005%.

This is low variance with a cost attached. Each agent independently reasoned its way to aggressive polling, which is locally sensible and collectively a denial-of-service against your own infrastructure. No agent misbehaved. The population did.

Worth noting what this is not: a rate-limit bug. Every one of those requests was a well-formed call that a permissions layer would have approved. The mechanism that stops it is a population-level budget, which is precisely the kind of control an individual agent's prompt cannot express.

## Epistemic failure: knowing the source lies, and trusting it anyway

Two results here, and the gap between them is the finding.

Every model tested understands, in the abstract, that an information source has its own incentives. What is missing is the disposition to act on that knowledge unprompted. Under high lie frequency, Sonnet-family accuracy fell to **0.62** while the study's strongest model held around **0.85**.

The second result is worse, and it uses a paradigm with forty years behind it. A hidden-profile task splits the evidence across the group so that no member sees the decisive combination alone: solving it requires whoever holds the unshared piece to raise it unprompted. Stasser and Titus named the failure it produces — groups sample discussion toward what everyone already knows, so the unshared information never enters the pool ([*JPSP* 48(6), 1467–1478](https://doi.org/10.1037/0022-3514.48.6.1467)).

Anthropic's agents reproduce it and then some. Groups scored **17–36%** accuracy where a single agent holding all the facts scores near 100%. Adding agents made the group worse than one agent working alone. The information was in the population and never surfaced.

The study's explanation is that agents have no equivalent of the social technologies humans use to trade off vigilance against receptivity. They enter with no reputation to lose, and an agent can be forked or repurposed at will. There is a related asymmetry I had not considered: for an agent, communicating something costs about what doing it costs. For a person, telling a colleague is far cheaper than redoing their work, which is why we bother. Remove that gradient and the incentive to report rather than act quietly goes with it.

## Collusion: a price floor by round three

The economic test was a Bertrand pricing game. Two sellers of an identical good each set a price, buyers take the cheaper one, and the textbook result is that undercutting drives price to marginal cost even with only two firms — the argument Bertrand made in 1883 against Cournot's quantity-competition model. Anthropic's agents skipped it. They began coordinating almost immediately, and by round 3 had explicitly agreed on price floors.

This one should not surprise anyone who has read the pricing literature, which is the useful part. Calvano and co-authors put independent Q-learning agents in a repeated oligopoly and watched them converge on supracompetitive prices with **no communication channel at all**, including a punishment phase for defectors followed by a gradual return to cooperation ([*AER* 110(10), 3267–3297](https://doi.org/10.1257/aer.20190623)). Fish, Gonczarowski and Shorrer then ran it with LLM pricing agents and got the same supracompetitive outcome, plus a finding that matters more for anyone deploying this: small, innocuous-looking changes in prompt wording substantially shifted how much collusion occurred ([arXiv:2404.00806](https://arxiv.org/abs/2404.00806)).

So the Anthropic result is a replication, not a discovery, and the prior work is six years old. Two things follow. Agents reaching a cartel without a communication channel is the expected behavior of independent optimizers in a repeated game, so no message-passing audit will catch it. And if prompt wording moves the collusion rate, then the wording is a market-conduct decision, which is an uncomfortable place for it to live.

## Incompatible goals: escalation to self-replicating malware

Given sustained, conflicting directives, agents assumed the other side was deliberately obstructing them and escalated. The reported end states: self-replicating malware, disabling other agents' Unix accounts, and deploying malicious code disguised as belonging to another agent.

No agent was instructed to sabotage. Each was pursuing its own assignment against an obstacle it read as adversarial. Conflicting objectives are the normal state of any organization with more than one team, which makes this the failure mode I would design against first.

## The benchmark flatters an unreleased model

The low-variance objection above was methodological. This one is about incentive. The standout performer throughout is a model the study calls Claude Mythos Preview, also Mythos 5, and the name carries its own disclosure: a preview model, absent from Anthropic's published lineup, benchmarked by the team that builds it. It finds 266 vulnerabilities in a coordinated swarm where Opus 4.8 finds 41, holds 0.85 lie-detection accuracy where Sonnet falls to 0.62, and ends 98% of turf-war runs in a negotiated truce.

The sharpest Hacker News comment calls the piece a promo for the next release. Too dismissive of the failure modes, fair about the rankings, so I split them. The failure modes replicate across models and against forty years of prior literature, which is what makes them reusable. The cross-model rankings are a vendor measuring its own unreleased product. Sonnet 4.6 and Opus 4.6 opening 876 and 980 pull requests with few merged is a useful number about swarms; which model tops the table is marketing until someone else runs it.

The study also names no threshold for skipping multiagent entirely. For a piece whose own evidence has a population scoring 17–36% where one agent scores near 100%, "do not use a population here" is a conclusion the data supports and the paper declines to draw.

## Three failures, three mechanisms

The study stops at diagnosis, so here is where I would put the controls. Each one is structural, because every failure above survived agents that were individually competent and individually well-intentioned.

**Polling flood → a budget held by the population, not the agent.** Per-agent limits do not compose. Thirty agents each comfortably inside its own generous quota still summed to 2.4 million requests. The budget has to live at the serving layer, denominated across the whole population, or the sum is nobody's number.

**Branch-name collision → allocate the scarce name centrally.** Asking each agent to pick something distinct is exactly the instruction low variance defeats; 18 of 30 followed it and collided anyway. An allocator handing out names cannot collide. Same for ports, table names, output paths, and every other namespace a swarm shares.

**Hidden-profile failure → make reporting structural, not voluntary.** For an agent, telling someone costs about what doing it costs, so voluntary disclosure gets no takers. If a decision depends on private information, the report has to be a required step in the flow rather than a behavior you hope for.

Each is a control an ordinary engineering organization already runs: a budget, a name registry, a mandatory status report, and for incompatible goals a shared escalation path to someone empowered to rule. None are novel and none are about AI. They are the unglamorous machinery of running a team, and a swarm needs them for the same reason a team does: competent individuals with correlated instincts and conflicting goals do not self-organize.

## Key takeaways

- **Coordination is a population property, so fix it at the population level.** A better model and a harder alignment pass do not produce a better-coordinated swarm. A shared budget, a central allocator, and a required report do.
- **Independent samples from one model are correlated.** Redundancy stops buying error correction once every agent reaches for the same answer. Design for correlated failure.
- **Watch for the well-formed flood.** Every request valid, every agent locally reasonable, the aggregate a self-inflicted outage. Permissions do not catch this shape; a population budget does.
- **More agents can score worse than one.** A population can bury information a single agent would have surfaced. Adding agents is not free even when each is competent.
- **Separate the failure modes from the leaderboard.** The first travels across models. The second is a preview model winning its own benchmark.

The study closes by arguing that the conditions for making agent interactions work will get found either deliberately and early, or by default in production. The branch-name collision is the cheap version of that lesson. The self-replicating malware is not.

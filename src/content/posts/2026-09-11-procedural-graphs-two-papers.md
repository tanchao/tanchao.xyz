---
title: "Procedural graphs: forcing the plan is worse than no plan"
description: "A learning note from reading two papers that independently arrived at the same idea three months apart — storing an agent's what-to-do knowledge as an explicit graph. The ablation that matters is that binding the agent to the plan scored worse than giving it no graph at all."
tldr: "Google's Procedural Graphs and the earlier ProPlay both store procedural knowledge as (procedure, relation, procedure) triplets and inject it as guidance that biases without dictating. Two ablations, from different teams, say the same thing: showing the agent less of the graph beats showing it all, and forcing the agent to follow the plan (32.6 success) scored below removing the graph entirely (34.8). Procedural state works by nudging."
date: 2026-09-11
tags: ["learning-notes", "ai", "agents", "llm", "engineering"]
draft: false
---

> Part of a series on structuring agentic systems. Previous: [Long-horizon agent state](/posts/2026/09/11/long-horizon-agent-state/).

Notes from reading two papers that landed on the same idea without citing each other as inspiration: [Procedural Graphs](https://arxiv.org/abs/2609.09153) (Google, Georgia Tech, Peking University; September 8, 2026) and [ProPlay](https://arxiv.org/abs/2606.12780) (Yijun Ma and colleagues; June 11, 2026, [code released](https://github.com/antman9914/proplay)).

The [state survey](/posts/2026/09/11/long-horizon-agent-state/) that precedes this one covered factual memory. This is the other half.

## What procedural knowledge is, concretely

The clearest example is in the Google paper's evaluation. An agent runs a simulated company in EnterpriseArena, making monthly financial decisions for up to 132 months, through three crises it is not told about. Capital arrives one to six months *after* you request it.

So surviving a crisis requires asking for money while you still look fine. That rule is not a fact about the world you can retrieve. It is an ordering constraint over your own actions, and it only pays off if you apply it before you have any evidence you need it.

Unguided Gemini 3.5 Flash raised $0.00M and died. The guided version raised $9.39M.

The papers' shared diagnosis is that most agents leave this kind of knowledge implicit in an accumulating history. It is never written down anywhere, so it degrades exactly the way the rest of the history degrades: the agent loses track of objectives, calls tools out of order, and repeats things that already failed.

## The shape both papers found

Google's framing is the tidier one:

> Just as a knowledge graph organizes factual knowledge into (entity, relation, entity) triplets for what-is questions, a Procedural Graph organizes procedural knowledge into (procedure, relation, procedure) triplets for what-to-do questions.

ProPlay describes the same object as a "procedural world model": nodes are procedures induced from successful trajectories, directed edges are causal transitions between task stages.

Both then do the same two things. They select a relevant part of the graph for the current situation, and they inject it as text that *suggests* the next move. Both are explicit that the agent may ignore it. Google says the guidance "biases the solver's next action without dictating it." ProPlay calls it "soft guidance rather than a hard constraint" and deliberately permits plans containing transitions it has never seen, so the agent keeps exploring.

They differ in when they think. Google localizes the agent's active node at *every decision step* and reads its 2-hop neighborhood. ProPlay builds one procedural trajectory *before the episode starts*, which it calls preplay, borrowed from the hippocampal phenomenon of the same name.

## Show less of it

Google's usage ablation was the result I did not expect. Holding the graph and the solver fixed and varying only how much the agent sees:

| Configuration | MultiChallenge | GDPval | ALFWorld |
|---|---|---|---|
| No graph | 80.27 | — | 72.58 |
| Raw full graph injected | 86.60 | — | 70.34 |
| Full graph, generative guidance | — | — | 54.48 |
| Localized subgraph, generative guidance | **89.31** | **63.99** | **81.53** |

Dumping the whole graph in helped structured dialogue and *hurt* embodied execution. Running a guidance model over the whole graph hurt embodied execution badly, 72.58 down to 54.48, while spending more tokens. The localized neighborhood won everywhere.

More procedural state in context is not better procedural state. Retrieve the neighborhood, not the map.

## Forcing the plan is worse than having no plan

ProPlay ablates what Google asserts. Its table, on ScienceWorld, success rate and average score:

| Variant | SR | Avg. Score |
|---|---|---|
| ProPlay | **37.4** | **70.2** |
| w/ retrieval instead of preplay | 35.6 | 69.6 |
| w/ random procedure sampling | 35.9 | 69.1 |
| w/ hard constraint | 32.6 | 66.3 |
| w/o graph | 34.8 | 69.4 |
| w/o transitions | 32.2 | 64.8 |
| w/o reliability records | 35.6 | 70.1 |
| w/ action-level world model | 37.0 | 68.8 |

Read the two rows in the middle together. Forcing the agent to follow the preplay plan scores **32.6**. Deleting the graph entirely scores **34.8**. A correct plan, rigidly applied, is worse than no plan.

That single comparison is the most useful thing in either paper, and it is what makes the "soft guidance" language a finding rather than a design preference.

The corroborating evidence is in their baselines. The two action-level world-model methods, Wall-E and WorldCoder, both score 24.8 on ScienceWorld against plain ReAct's 27.0. Two systems built to model the environment lose to an agent with no model at all. The authors read this as action-level constraints limiting the agent's reasoning flexibility.

`w/o transitions` at 32.2 is the largest single drop, which supports their claim that the edges carry more value than the nodes. What you want stored is not a list of procedures but the ordering between them.

## Where I would not follow the papers' prose

ProPlay's text says the procedural world model "can provide more comprehensive environment understanding than action-level world model." Their own ablation is thinner than that: `w/ action-level` scores 37.0 against ProPlay's 37.4 on success rate. The average score gap is larger (68.8 vs 70.2), but a 0.4-point SR difference does not carry the sentence.

The main results are also closer than the framing suggests. ProPlay's ScienceWorld SR of 37.4 beats ExpeL's 36.3 by 1.1 points; PlanCraft overall is 44.4 against 43.3 for both ExpeL and LATS. The honest summary is consistent small gains with the best average ranking of 1.6, on GPT-4.1-mini at temperature 0 with a single trial per task. That is a real result and a modest one.

Google's paper is more careful with itself. It reports 85.0% test survival rather than the 95.0% its best search round hit, because reporting the better number "would amount to selecting on the test set." It describes its 20-episode accept/reject decisions as "a search trace rather than as significance tests." And it reports flat HotpotQA gains, between −0.90 and +1.30 points, rather than burying them.

## Two ideas worth stealing regardless

**Rejection memory.** Google's refiner proposes graph edits, commits them only when held-out validation does not drop, and keeps the rejected candidates so it stops re-proposing them. Durable state about what did not work. Almost nothing else in the agent stack keeps this, and every self-improving loop needs it.

**Reliability records.** ProPlay attaches an embedding to each transition measuring how consistently it contributed to success on *similar* tasks, then orders the injected transitions by cosine similarity to the current task. The stored procedure carries a confidence weight instead of being flatly true. Removing it costs 1.8 SR points, which is small but real.

There is also a reassuring growth pattern. ProPlay's graph adds nodes quickly and then plateaus, while edges keep multiplying. The vocabulary of procedures saturates; the structure between them keeps deepening. Procedural state does not appear to grow without bound.

## Key takeaways

- **Procedural knowledge is state, and nobody stores it.** "What to do, in what order, under which conditions" sits implicit in the transcript, where it rots with everything else.
- **Guide, do not dictate.** A hard constraint scored 32.6 against 34.8 for no graph at all. If you are going to encode procedure, encode it as a suggestion.
- **Edges beat nodes.** Removing transitions was the worst ablation in either paper. Store the ordering, not the inventory.
- **Show the local neighborhood, not the whole graph.** Same graph, same solver, and full-graph guidance dropped ALFWorld from 81.53 to 54.48.
- **Keep the failures.** Rejection memory and reliability records are both just state about what has not worked, and both earn their place.
- **Two teams, one architecture.** Convergence three months apart on procedure graphs with non-binding guidance is better evidence than either paper's benchmark table.

Both papers are early and most of their margins are small. One margin is not: 32.6 against 34.8. Write the ordering down, then leave the agent free to ignore it.

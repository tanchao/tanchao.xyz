---
title: "Long-horizon agent state: the dimensions, and what moved in 2026"
description: "A learning note from surveying how the field manages agent state across turns, sessions, sub-agents, tools, and multi-agent pipelines. Twelve dimensions worth naming, one axis the field only discovered this year, and a verdict on driving a pipeline off Jira labels."
tldr: "Between January and August 2026 the field converged on three rules: writes stay single-threaded, state gets an explicit name instead of hiding in a connection, and reads stay idempotent. The genuinely new idea is loss tolerance — a safety rule and an episodic log compete for the same tokens, get summarized at the same rate, and only one of them still works afterwards. Everything else is distributed systems transposed."
date: 2026-09-10
tags: ["learning-notes", "ai", "agents", "distributed-systems", "engineering"]
draft: true
---

> Part of a series on structuring agentic systems. Previous: [The orchestrator is blind on purpose](/posts/2026/08/07/the-orchestrator-is-blind-on-purpose/).

Notes to myself from a week of reading about how long-running agents keep track of what they are doing.

The series so far has been about control. [Skills versus subagents](/posts/2026/07/27/skills-vs-subagents-when-to-use-each/) set the isolation baseline, the [verification loop](/posts/2026/07/28/make-an-agentic-workflow-deterministic-and-verifiable/) capped how many agents you can run, and [the orchestrator post](/posts/2026/08/07/the-orchestrator-is-blind-on-purpose/) argued that control has to live harness-side because the lead agent sees less than the harness does. This one is the same argument applied to state, and it lands in the same place for the same reason.

The question I started with was practical. I run a pipeline where several agents work one task, and I use Jira labels as both the state store and the trigger. A cron job queries for tickets carrying a label, dispatches an agent, and the agent swaps the label when it finishes. It works. I wanted to know whether it was correct, and what the rest of the field had settled on.

Short answer on my own system: the architecture is right and the locking is wrong. Longer answer below.

## What "agent state" physically is

Worth being concrete, because the term covers at least four unrelated things.

- **The context window.** Messages, tool results, reasoning. Lives in RAM on someone else's GPU for the duration of one request, and gets rebuilt from a transcript on every turn.
- **The session record.** A JSONL file or a database row holding that transcript so the next turn can rebuild it. On disk, on your laptop or a vendor's server.
- **The workspace.** For a coding agent: a cloned repo, installed dependencies, an uncommitted working tree, a running dev server. Gigabytes, on a disk somewhere.
- **The external effects.** The PR that got opened, the email that went out, the row that got written. Not yours, not revertible.

Most discussion of "agent memory" is about the first two. Most production failures come from the last two.

## MCP deleted sessions

The `2026-07-28` revision of the Model Context Protocol removed protocol-level sessions entirely. The `Mcp-Session-Id` header, the `initialize` handshake, the standalone GET stream, and `Last-Event-ID` stream resumability are all gone. A server on the new revision must [ignore a session header and never mint one](https://modelcontextprotocol.io/specification/draft/basic/transports/streamable-http), and answers a GET or DELETE with `405`.

The stated payoff is operational: a remote MCP server that needed sticky sessions, a shared session store, and deep packet inspection at the gateway now runs behind a plain round-robin load balancer.

The replacement is that a server mints an explicit handle from a tool, and the model passes it back as an ordinary argument. The [maintainers' argument for why this is better](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) is the part I keep coming back to:

> The model can compose handles across tools, reason about them, and hand them off between steps in ways that externally managed session state, hidden in transport metadata, never really allowed. The explicit-handle pattern simply makes the state visible to the model rather than hidden away.

I would have guessed the opposite. Hide the plumbing, keep the context clean. A protocol with a large deployed base concluded that state the model can see beats state hidden from it.

Long-running work moved to a separate [Tasks extension](https://modelcontextprotocol.io/seps/2663-tasks-extension), which calls tasks "durable state machines" and has two rules worth stealing. A server must not return a task handle until a read of that handle would resolve, so callers never poll for something that does not exist yet. And `tasks/get` stays a pure idempotent read, deliberately split from `tasks/update`, so any intermediary can cache or replay it safely.

[A2A v1.0](https://a2a-protocol.org/v1.0.0/specification/) went the other way and made the Task a first-class durable object with eight lifecycle states. Same underlying conclusion: the connection is not the session. Give the state a name, store it, and let either side crash.

## Not all state survives compression equally

This is the one genuinely new idea I found, and it is the reason I think most current designs are wrong in the same way.

Compaction summarizes the context when it overflows. Every agent product does it. [The Compaction Cliff](https://arxiv.org/abs/2608.22752) (CIKM 2026) opens with the problem in two sentences:

> A safety rule and an episodic log compete for the same tokens in an AI agent's context. When the budget overflows, both are summarized at the same rate; only the rule needs exact wording to remain enforceable.

Measured on Claude Code's own `/compact` with Sonnet 4.6 across 20 production agent configurations: 53% of safety rules survive one compaction round, 10% survive five.

A companion paper, [Governance Decay](https://arxiv.org/abs/2606.22528), supplies the causal half across 1,323 episodes and seven model families. Violations go from 0% with the policy in full context to 30% after compaction, up to 59% on some models. The conditional is what makes it clean: when the constraint survives the summary, violation stays at **0%**; when it gets dropped, violation reaches **38%**. The model is not getting worse. It is being handed a different rulebook.

Then it becomes a security problem rather than a quality problem. The same paper demonstrates a Compaction-Eviction Attack, where adversarial content in the context biases the summarizer into omitting a legitimate policy, and reports that optimized injections defeat every model they evaluated. An attacker who cannot edit your policy can still get it deleted by getting it summarized.

Both papers land on the same fix, which is pinning: quarantine constraints from lossy compaction. Governance Decay measures that restoring violation to 0%.

The generalization is the useful part. **Lossy compression gets applied uniformly to state whose tolerance for loss is wildly non-uniform.** A log can be paraphrased. An identifier, a credential, a threshold, a constraint cannot. Compaction cannot tell the difference, so you have to.

There is a decision buried here that I have not seen anyone state. Anthropic's compaction block is readable and steerable, with an `instructions` field and a `pause_after_compaction` hook. OpenAI's compaction item is encrypted and documented as not intended to be human-interpretable. Constraint pinning only works if you can see and steer what the compactor keeps. The platform you pick decides whether the published fix is available to you.

## Correct rollback is not safe rollback

I spent part of this week thinking the open problem was consistency between layers: what it means to rewind a conversation to turn 5 when the filesystem is at turn 12. That turns out to be a real problem with a paper from twelve days ago.

[Safe to Resume?](https://arxiv.org/abs/2608.29381) (August 29, 2026) states it better than I did:

> Correct rollback does not imply secure recovery: a faithfully restored checkpoint may resume an execution whose states, assumptions, and external effects never coexisted in any valid history.

Five failure modes: incomplete or inconsistent internal state, stale external dependencies, nondeterministic replay, and unrecorded external effects. Three end-to-end attacks on Hermes, Cline, and LangGraph, producing malware-verification bypass, unauthorized mail forwarding, and double payment.

This is not theoretical for anyone using a coding agent today. Claude Code's rewind restores the conversation and tool-made edits. It does not restore bash-made changes, most sub-agent edits, or anything that changed outside the session. So the default rewind lands you in exactly the state the paper describes: a context that believes one thing and a disk that is doing another.

Checkpoints have a boundary. External effects are outside it. That is the whole lesson, and it is old — it is why distributed systems people talk about compensating actions rather than rollback.

## Single writer

The strongest convergence in everything I read, arriving from four unrelated directions.

Cognition published ["Multi-Agents: What's Actually Working"](https://cognition.com/blog/multi-agents-working) in April 2026. It is worth being precise about what it says, because it gets summarized as a reversal and it is not one. They keep the prohibition — "our original observations still hold today for parallel-writer swarms" — and carve out a narrower class that works:

> Multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions.

Unstructured swarms are "mostly a distraction." The shape that works is map-reduce-and-manage.

Second direction: chat frameworks keep hitting the same bug. In [Agno issue #7597](https://github.com/agno-agi/agno/issues/7597), two Slack messages arriving in one thread race on the same `session_id`, and both perform a blind `ON CONFLICT DO UPDATE` on the whole `runs` JSON column. Last-write-wins clobber, interleaved tool calls, lost messages. What I like about this bug report is that it is not a retry storm. The author is explicit that it is ordinary behavior: rapid typing, or a user sending "wait, scratch that, try X instead." The most natural thing a human does in a chat window corrupts the state.

Note also that the schema forecloses the fix. If session state is one opaque JSON document, last-write-wins is the only semantics available to you.

Agno and Mastra independently landed on the same four-policy solution (parallel / drop / queue / interrupt, and queue / debounce / batch / skip), both defaulting to queue, both keyed on the conversation so unrelated threads never block.

Third direction: the CRDT work. [AgentRoom](https://arxiv.org/abs/2608.23740) (August 2026) puts file-level claim, status, and broadcast on a CRDT-merged shared filesystem, exposed as MCP tools, and concludes: "Coordination, not parallelism or CRDT-merge, bears the load." CRDTs guarantee that concurrent edits merge deterministically. They do not guarantee the result makes sense. Two agents can each write valid code that together implement contradictory logic, so every project in this space adds an intent-declaration layer on top of the merge.

One detail from that work generalizes well beyond CRDTs. An agent's think time between reading and writing is a full inference call. That is a very long transaction, so optimistic concurrency needs read-set validation and pessimistic locks need TTLs.

## The verdict on Jira labels

Fourth direction, and the one I care about.

The pattern is now vendor-endorsed three times over. [Atlassian shipped agents in Jira](https://jirareleases.atlassian.com/announcements/put-ai-teammates-to-work-right-inside-jira) in open beta on April 27, 2026, and the headline feature is "add agents to workflow transitions" — state transition triggers agent, which is exactly what I built with labels because transitions were not available to me. GitHub surfaced agent sessions as issue and board state. Linear lets you delegate an issue to an agent while a human stays the accountable assignee, which is the schema detail worth copying: the agent does not consume the field a human needs.

There is also a public twin of my system, [IstiN/dmtools-agents](https://github.com/IstiN/dmtools-agents): a 20-minute cron, per-rule JQL, and `skipIfLabel` / `addLabel` / `releaseLock()` used as a distributed lock. It documents the defect I should have expected. `addLabel` before dispatch, `releaseLock()` after completion, no TTL and no lease. A worker that dies in between wedges the ticket forever. Separately, creating an issue *with* a label fires both `opened` and `labeled`, so you get duplicate runs.

Every documented failure of tracker-as-state-machine reduces to one missing primitive: **an atomic compare-and-set.** The label race is no test-and-set. The wedged ticket is no lease with fencing. The lost update is no reducer. Cross-field drift is no transaction.

What the tracker is genuinely good at is being durable, auditable, human-visible, and crash-safe with no infrastructure of my own. Nothing else gives me that. So the fix is not to replace it.

- Keep the tracker as the system of record.
- Stop using it as the lock. Put an atomic claim in front of it, or use a single-flight concurrency group keyed on the issue.
- Or accept at-least-once and make every side effect idempotent, with a key derived from `{issue}:{stage}` — never from model output.

That last clause is the agent-specific part, and it took me a while to see why it matters. A retrying agent does not resend bytes. It re-reasons and emits *different* bytes, which defeats request-hash deduplication. Both durable-execution camps independently derive idempotency keys from workflow position rather than model output. Or as the sharpest write-up of [effect identity](https://rokoss21.tech/en/posts/agent-effect-identity/) puts it: the runtime, not the language model, must decide whether this is a retry or a new action.

## Memory products lose to long context, with an asterisk

I expected the memory-system category to have won by now. It has not, and the benchmark situation is worse than the product situation.

[Beyond the Context Window](https://arxiv.org/abs/2603.04814) (March 2026) measures Mem0 at 49.0 against long-context GPT-5-mini at 82.4 on LongMemEval. MemoryAgentBench puts every memory system below the GPT-4o baseline. CL-Bench ranks naive in-context learning first.

The asterisk matters though. In the same paper, memory stays competitive on PersonaMemv2, because persona consistency depends on stable factual attributes that suit flat extraction. So the real finding is narrower and more useful: **extraction wins where the state is a small set of stable attributes, and loses where the question needs arbitrary recall over history.**

On cost there is a crossover rather than a winner. Even with prompt caching, long-context cost grows per turn while memory read cost stays flat after the write phase. At 100k context, memory becomes cheaper after about ten turns. Recall is a thing you buy with tokens.

As for the benchmark everyone quotes: LoCoMo has been audited, and [the audit is filed as an issue on the official repo](https://github.com/snap-research/locomo/issues/27). 99 of 1,540 questions have wrong golden answers, capping a perfect system at 93.6%. For calibration, Northcutt et al. found 3.3% average label errors across ten major ML benchmarks and showed that destabilizes rankings.

The judge is the worse half. Feed it deliberately wrong but topically adjacent answers and it accepts 62.81% of them — while catching specific-and-wrong answers (wrong name, wrong date) 89% of the time. So the benchmark passes vague answers that locate the right conversation and extract nothing specific. That is precisely the failure mode of weak retrieval, and the benchmark rewards it.

The clincher: EverMemOS published single-hop 95.96% and multi-hop 91.37% against corrected category ceilings of 95.72% and 90.07%. Those scores are arithmetically impossible without credit from wrong answer keys.

## The dimensions

The framework I was actually after. For any piece of agent state, these are the axes worth answering.

| # | Dimension | The question |
|---|---|---|
| 1 | Scope | Whose is it, and for how long? Turn, thread, task, agent, user, tenant, org. |
| 2 | Durability | Survives what — a turn, a process crash, a host loss, a region? |
| 3 | Visibility | Hidden in transport metadata, or an explicit handle the model can compose? |
| 4 | Authority | Who is the system of record: model context, harness, tracker, or protocol object? |
| 5 | Mergeability | Opaque blob, field-level, or CRDT? Decides whether concurrent writes *can* merge. |
| 6 | Write discipline | Single writer? Serialized on which key? CAS, lease, TTL, reducer? |
| 7 | Loss tolerance | Verbatim-required, paraphrasable, or recomputable? |
| 8 | Restore semantics | Which layers does a checkpoint restore, and are they consistent with each other? |
| 9 | Side-effect coupling | Are there external effects that cannot be rolled back? |
| 10 | Trust boundary | Single-party or multi-party? Who may read and write? |
| 11 | Economics | Token cost per turn to carry it, cache interaction, storage growth, retention. |
| 12 | Auditability | Can you reconstruct what happened, and how long must you keep it? |

Eleven of these are ordinary distributed-systems questions transposed onto a new substrate. Scope, durability, mergeability, write discipline, trust, and audit are the same questions I would ask about any shared mutable state.

Dimension 7 is the new one. Conventional systems do not lossily compress their own state, so there was never a reason to classify state by how much distortion it tolerates. Agents do it on every long session, by default, without telling you.

## Three contradictions nobody has resolved

- **Security versus cost.** OWASP ASI06 says expire and decay memory. Prompt caching punishes any prefix mutation. Rotate memory for safety and you pay cache misses; keep the prefix stable for cost and stale or poisoned memory persists. I found no source that addresses the tension.
- **Durability versus accounting.** Pydantic AI documents that adding durable execution silently breaks token-usage accounting and limit enforcement, and breaks it differently on replay than on first run. Fixing one property quietly breaks another.
- **Isolation versus recovery.** Clean context catches bugs the original agent cannot see. But isolating each step also removes the ability to recover from an earlier mistake. Isolation appears to pay off exactly when context degradation is the binding constraint, and to cost you otherwise.

Also worth knowing before planning around it: the EU AI Act's Article 12 record-keeping obligations moved to December 2027 by Regulation (EU) 2026/1744, so most "be ready by August 2026" guidance is now wrong. NIST's agentic overlay is still unpublished. And the observability layer everyone is standardizing on is not standard yet — MCP deprecated its own logging in favor of OpenTelemetry in the same revision where [0 of 63 GenAI attributes are stable](https://particula.tech/blog/opentelemetry-genai-semantic-conventions-stable), with no tagged release to pin.

## Key takeaways

- **Name the state.** A connection is not a session, a stream is not a record, and an attempt is not an identity. MCP deleted sessions; A2A gave the Task an ID; Cursor split a durable agent from ephemeral runs. Everything durable gets an ID that survives both sides crashing.
- **Make it visible to the model.** The instinct to hide plumbing is wrong here. A handle the model can pass, compose, and hand off beats state hidden in metadata.
- **Single writer.** Four independent lines of evidence agree. Serialize on a conversation or task key, let unrelated keys run in parallel, and let extra agents contribute intelligence rather than actions.
- **Classify state by loss tolerance before you compact it.** A safety rule and a debug log do not deserve the same summarizer. Pin the things that need exact wording.
- **A checkpoint has a boundary and your side effects are outside it.** Derive idempotency keys from workflow position, never from model output, because a retrying agent re-reasons instead of resending.
- **The tracker is a good system of record and a bad lock.** Every failure of the label-driven pattern reduces to a missing compare-and-set.
- **Recall is bought with tokens.** Extraction wins for small stable attribute sets, long context wins for open recall, and the cost crossover is around ten turns at 100k.

The series thesis holds up here without modification. The orchestrator post argued that control has to live in the harness because the lead agent sees less than the harness does. State is the same shape. The model cannot be trusted to decide whether a tool call is a retry or a new action, cannot be trusted to preserve a constraint through its own summarization, and cannot hold a lock. Good intention will not work; mechanism does. The one inversion is dimension 3: the harness should own the state, and still show the model the handle.

Most of this is 1985 coordination theory wearing new clothes. The CRDT papers cite Linda tuplespaces, blackboard architectures, and stigmergy, which is the right lineage. The one part that is actually new is that the participants forget on purpose, and nobody built the old systems to survive that.

I am going to put a claim service in front of my Jira labels and see how much of the flakiness goes away.

---
title: "Reading pi's agent-loop.ts: the hard parts are all bug-shaped"
description: "A learning note from reading the agent loop in earendil-works/pi. The skeleton is the one everybody draws on a whiteboard. The rules that make it survive contact with real models and real tools are almost all traceable to a numbered bug."
tldr: "pi's agent loop is 796 lines with 1,607 lines of tests, and its non-obvious rules each map to a filed issue: a length-truncated response fails every tool call in the batch because salvage-parsed arguments can pass schema validation while silently incomplete; parallel tools execute out of order but retire in assistant source order; early termination requires unanimity across the batch; and tool hooks get try/catch while loop-control hooks get only a documented contract."
date: 2026-08-07
tags: ["learning-notes", "ai", "agents", "engineering"]
draft: false
---

Notes to myself from reading [`packages/agent/src/agent-loop.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts) in [earendil-works/pi](https://github.com/earendil-works/pi), the MIT-licensed agent toolkit behind the `pi` coding agent. 796 lines of source, 1,607 lines of tests, and 28 commits touching that one file: 11 `fix`, 9 `feat`.

The skeleton is the one everybody draws on a whiteboard, and it is maybe 90 lines. Call the model, run the tool calls it asks for, feed the results back, repeat until it stops asking. Everything worth reading is in the other 700, and nearly every rule in there has an issue number attached. The code gives you the rule; the issue tells you which production failure paid for it.

## Truncated arguments validate fine

When an assistant message stops with `stopReason: "length"`, pi refuses to execute **every** tool call in it. Not the malformed ones. All of them ([`agent-loop.ts:211-214`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/agent-loop.ts#L211-L214)).

The reason is in the comment above `failToolCallsFromTruncatedMessage`: streamed tool-call arguments are finalized with a best-effort JSON salvage parser. A call cut off mid-stream can produce arguments that parse cleanly *and* pass schema validation while missing fields the model meant to send. Schema validation tells you the JSON is well-formed and correctly typed. It does not tell you it is complete.

My instinct says a validating parse is a safe parse. Here the validator is answering a question nobody asked.

The fix history is the interesting bit. [Issue #6284](https://github.com/earendil-works/pi/issues/6284) asked to reject partial JSON on early tool-call exit. The first attempt did it precisely: strict-parse the arguments, preserve the raw JSON on a new `ToolCall.malformedArguments` field, refuse only the calls that failed. Then it was reverted inside the same PR ([#6285](https://github.com/earendil-works/pi/pull/6285)) for the blunt version, with the rationale stated plainly in the commit body:

> when an assistant message stops with "length", all tool calls in it are potentially borked (streamed arguments are salvage-parsed), so none are executed. Each gets an error tool result telling the model to re-issue the call, and the loop continues. **No new fields on ToolCall and no provider changes.**

The precise fix needed a new field on a shared type and touched the providers. The blunt one needed a single `stopReason` check. Both fix the bug; only one is cheap to change later. Each rejected call gets an error result telling the model to re-issue it, so the recovery path costs a round trip and nothing else.

## Parallel tools execute out of order and retire in order

One tool batch, two event orderings, on purpose. `tool_execution_end` fires in **completion** order, as each tool finishes. The tool-result *messages* are emitted afterward in **assistant source** order, matching the sequence the model wrote them in ([`agent-loop.ts:540-548`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/agent-loop.ts#L540-L548)).

Two consumers want incompatible things. The UI wants liveness: a fast tool should stop showing a spinner the moment it returns. The model's transcript wants determinism: identical runs should produce identical context, regardless of which tool happened to win the race.

[Issue #3503](https://github.com/earendil-works/pi/issues/3503) names the symptom from before the split — "parallel tool calls stay in pending state until the slowest sibling finishes." Collapse the two orderings into one and you pick a side. Emit everything in completion order and the transcript becomes nondeterministic. Emit everything in source order and the UI freezes behind the slowest tool.

Commodity CPUs settled this argument in the mid-1990s. Instructions issue out of order to keep the execution units busy, then retire in program order through a reorder buffer so the architectural state stays well-defined — the structure Smith and Sohi survey in [*The Microarchitecture of Superscalar Processors*](https://doi.org/10.1109/5.476078) (Proceedings of the IEEE, 1995). Same split, same reason: the fast path and the path that must be reproducible are not the same path.

## Preflight stays sequential even in parallel mode

In parallel mode, only `execute()` runs concurrently. Argument validation and the `beforeToolCall` permission check run in a plain sequential `for` loop first, and only then do the prepared calls get handed to `Promise.all` ([`agent-loop.ts:499-542`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/agent-loop.ts#L499-L542)).

That ordering is what makes an interactive permission prompt tractable. `beforeToolCall` is where a coding agent asks "allow this write?", so it has to be one question at a time in a predictable order. Five concurrent confirmations racing each other is not a UI.

The loop also checks `signal?.aborted` between every preflight step and breaks out of the batch. [Issue #4276](https://github.com/earendil-works/pi/issues/4276) is what happens without that: calling `ctx.abort()` during an interactive tool-call confirmation duplicated the abort output and let the remaining pending calls run anyway. Aborting during a prompt is the most likely moment for a user to abort, so it is the moment worth handling.

There is a coarser rule on top. If any single tool in the batch declares `executionMode: "sequential"`, the whole batch goes sequential ([`agent-loop.ts:419-425`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/agent-loop.ts#L419-L425), added in [#3345](https://github.com/earendil-works/pi/pull/3345)). Not "serialize the sequential ones and parallelize the rest."

Given the contract, that is the correct reading. `sequential` is documented as "this tool must execute one at a time with other tool calls" ([`types.ts:401-408`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/types.ts#L401-L408)) — against *anything*, not against a category. Honor that and the batch has to collapse.

The limit is in the vocabulary, and it is where I would push on the design. One boolean cannot distinguish "I must not run concurrently with anything" from the far more common "I must not run concurrently with another writer." So a batch of five reads and one sequential write serializes all six, and the five reads pay for the write. The information needed to do better is already there — every tool declares its own mode — but the flag has no way to say what it needs exclusion *from*. Splitting it into "exclusive against everything" and "exclusive against other writers" would express the common case, though I have not worked through how a scheduler resolves a batch that mixes both, and that is where the cost of the extra level would show up.

## Early termination requires unanimity

A tool result can set `terminate: true` to ask the agent to stop after the current batch. The loop honors it only when **every** finalized result in the batch sets it ([`shouldTerminateToolBatch`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/agent-loop.ts#L582-L584)):

```typescript
function shouldTerminateToolBatch(finalizedCalls: FinalizedToolCallOutcome[]): boolean {
	return finalizedCalls.length > 0 && finalizedCalls.every((finalized) => finalized.result.terminate === true);
}
```

One tool cannot cut the run short while its siblings still have work to report. The test suite pins the mixed case directly: `should continue after a mixed batch with one terminating blocked call`. This started as a feature request for termination hints ([#3525](https://github.com/earendil-works/pi/issues/3525)) and was later extended so a *blocked* call can vote too ([#5998](https://github.com/earendil-works/pi/issues/5998), shipped in [#7715](https://github.com/earendil-works/pi/pull/7715)) — a permission denial can end the run, but only if nothing else in the batch objects.

Unanimity is the right default for a hint whose failure mode is silent truncation of work. A wrong "stop" reads to the user as the agent losing interest halfway through.

## Tool hooks are guarded, loop hooks are contracts

The file defends two categories of extension point differently, and the asymmetry is deliberate.

Tool-boundary hooks get real defense. `beforeToolCall` sits inside a `try/catch` that converts a thrown error into an error tool result, and `afterToolCall` gets its own `try/catch` in finalization. [Issue #3084](https://github.com/earendil-works/pi/issues/3084) is why: an `afterToolCall` hook that threw made `executeToolCallsParallel` lose tool results outright. A misbehaving hook silently dropped work.

Loop-control hooks get a documented contract and nothing else. `convertToLlm`, `transformContext`, `shouldStopAfterTurn`, `prepareNextTurn`, and `getSteeringMessages` all carry the same instruction in [`types.ts`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/types.ts#L159-L160): *must not throw or reject. Return a safe fallback value instead.* The `StreamFn` contract goes further and requires failures to arrive as a final message with `stopReason: "error"`, never as a rejected promise.

The split tracks blast radius rather than politeness. A bad tool hook damages one tool call, so the loop can absorb it and keep going. A `convertToLlm` that throws leaves no correct next move — there is no fallback transcript to send. The comment says so directly: throwing "interrupts the low-level agent loop without producing a normal event sequence." Guard what you can recover from; refuse to pretend about the rest.

Two more guards follow the same logic, and both exist because the damage escaped the tool call. A stale `tool_execution_update` arriving after the run settled could crash the **host process**, so progress callbacks are fenced by an `acceptingUpdates` flag ([#5573](https://github.com/earendil-works/pi/issues/5573)). And an untyped JS extension returning a result with no content would put a null into **session history and provider payloads**, so content is normalized with `content ?? []` at the message boundary. The pattern is narrower than distrust: guard the boundary a tool's mistake can cross.

## Two queues, two loops

There are two nested `while` loops because there are two distinct kinds of "more work" ([`agent-loop.ts:170-272`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/agent-loop.ts#L170-L272)).

- **Steering** (`getSteeringMessages`) drains between turns, while the agent is mid-flight. It injects the message before the next model call without skipping the tool calls already in progress. A commit titled `fix(agent): defer steering until after tool execution` set that boundary.
- **Follow-up** (`getFollowUpMessages`) is checked at the point the agent would otherwise have exited, and revives the outer loop for another turn.

A single loop cannot express both. Same mechanism, opposite intent: one interrupts work in progress, the other restarts work that finished. They were split into separate `steer()` and `followUp()` APIs in an earlier commit rather than left as one queue with a flag.

Two smaller rules come from the same place: neither the user nor the clock respects a turn boundary.

- Steering is polled **once before the first turn**, with the comment "user may have typed while waiting." Nobody types only when it is convenient.
- The API key is resolved per model call rather than per run, because a short-lived OAuth token can expire during a long tool phase. [`types.ts`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/src/types.ts#L202-L210) names GitHub Copilot as the case that forced it. A run that outlives its own credential is the normal case once tool phases take minutes.

## Mutated arguments skip revalidation

`beforeToolCall` receives the already-validated `args` object, and whatever it does to that object flows straight into `execute()` without a second pass. A test codifies the behavior rather than forbidding it — the tool's schema is `Type.Object({ value: Type.String() })`, and the hook overwrites the validated value with a number ([`test/agent-loop.test.ts:444-476`](https://github.com/earendil-works/pi/blob/e47b8e37a6211ebd0b2942fa87059d64f81eec02/packages/agent/test/agent-loop.test.ts#L444-L476)):

```typescript
it("should execute mutated beforeToolCall args without revalidation", async () => {
	/* ... */
	beforeToolCall: async ({ args }) => {
		const mutableArgs = args as { value: string | number };
		mutableArgs.value = 123;
		return undefined;
	},
```

The tool declares `value` as a string. It executes with the number `123`. Every other extension surface in this file is guarded against author error; this one hands out a live reference to validated data and trusts the caller. It is a defensible call for a hook designed to adjust arguments, and it is the only place where the file's own defensive standard does not hold.

Worth noting the contrast with `prepareArguments`, the sanctioned path for fixing up arguments. That one runs *before* validation, so its output gets checked. `beforeToolCall` runs after, so its output does not.

## Key takeaways

The four that generalize past this codebase:

- **A schema check proves well-formedness, not completeness.** Wherever a salvage parser feeds a validator, this hole exists. Truncation is a property of the transport, so ask the transport, not the validator.
- **When two consumers want different guarantees, give them two orderings.** Liveness and determinism cannot come out of one event sequence. Commodity silicon solved this three decades ago.
- **Size the defense to the blast radius, and put it in the type.** Guard what costs one tool call. Where failure leaves no correct fallback, write "must not throw" in the contract and let it fail loudly.
- **A binary safety flag ends up carrying two meanings.** `sequential` conflates "exclusive against everything" with "exclusive against other writers," and every mixed batch pays the difference.

The other 700 lines are what it costs to keep a loop running when the model truncates, the user types early, the token expires, and the extension throws.

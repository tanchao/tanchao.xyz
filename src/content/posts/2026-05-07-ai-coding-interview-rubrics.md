---
title: "AI Coding Interview Rubrics"
description: "What separates a competent AI-assisted engineer from someone who just autocompletes? A framework for evaluating the skills that actually matter."
date: 2026-05-07
tags: ["ai", "career", "engineering"]
draft: false
---

AI coding interviews are emerging. Companies want to know: can this person actually ship with AI, or do they just tab-complete and pray?

I've been thinking about what I'd evaluate — and it maps closely to what I've learned makes the difference in my own daily work. Not prompt engineering tricks. Actual engineering judgment applied to a new tool.

Here's my rubric.

## 1. Model selection

The first decision isn't what to type — it's which model to use.

Do I need deep reasoning, or is this a straightforward transform? Is this a 200-line refactor (small model, fast) or an architecture decision (large model, think)? Can I get away with Haiku for this grep-and-replace, or do I need Opus to reason about the state machine?

The skill is knowing the cost/capability tradeoff cold. Wrong model choice either wastes money or wastes time recovering from bad output.

## 2. Mode selection

Plan before you agent. Ask before you plan.

If I just need a question answered, I stay in ask mode. If the task has meaningful tradeoffs, I plan first. If I have a clear implementation path, I agent. The anti-pattern is jumping straight to agent mode for everything — the model thrashes, you burn context, and you end up with a mess that takes longer to fix than doing it right.

The rubric question: does this person know when to think versus when to execute?

## 3. Context window management

Most of the time I run at max context. As long as I remember to start fresh sessions for fresh tasks, this works well. The real decision is the model-premium-pricing threshold — once you exceed it, every subsequent turn in that conversation is expensive.

But sometimes a task genuinely needs that depth. A 3000-line file with complex interdependencies. A multi-file refactor where the model needs to hold the full picture. That's a deliberate choice to pay for coherence.

The skill: knowing when to start fresh versus when the accumulated context is worth the premium.

## 4. Environment setup

A well-indexed codebase saves enormous time across every interaction. `AGENTS.md` (or `CLAUDE.md`) that describes your project structure, conventions, constraints. Cursor rules for file-specific patterns. Brief, accurate, maintained.

This is the equivalent of keeping your workshop organized. Every minute spent on indexing pays back tenfold. In an interview context, I'd look for: does this person set up the environment before diving in, or do they repeat the same context in every prompt?

## 5. Custom tooling

Beyond the basics: domain-specific skills, component-level workflows, reusable patterns encoded as context.

You need a data migration? There's a skill for that with the schema conventions, validation steps, and rollback patterns already baked in. You need a new API endpoint? The skill knows your auth middleware, error handling conventions, and test patterns.

This is the difference between using AI as a generic assistant and using it as a domain-aware collaborator.

## 6. Personalized agent system

Not in the repo. In your own setup. The agent follows your habits, inherits your architectural taste, knows your review standards, prepares CI the way you expect it.

This is the most underrated layer. Two engineers with the same model and the same codebase will get wildly different results based on how they've trained their environment to work with them. It's the accumulated judgment that makes the output feel like yours, not like generic AI slop.

## 7. Spec Development → Test Development → Development

Three phases, each feeding the next.

**Spec Development** produces the spec — requirements, constraints, edge cases, acceptance criteria. This is where you define what "done" looks like and enumerate the use cases.

**Test Development** takes those use cases and produces test cases. Concrete, runnable, verifiable. The AI is good at this — given a clear spec, it generates thorough test coverage fast.

**Development** makes the tests pass. Now the model has something to self-evaluate against. It's the difference between "write me a function" (vague, no termination condition) and "make these 14 tests pass" (concrete, binary). The model works better, you review faster, and defects surface before they ship.

## 8. Feedback loops

The system improves over time — but only if you build the loop.

Capture what worked. Update your skills and rules. Add constraints when the agent makes a class of mistake. Promote patterns that produced good output. The engineer who ships 10x with AI in month six versus month one got there through deliberate iteration on their own workflow, not just practice with prompts.

---

## What I'd actually evaluate

If I were designing an AI coding interview, I'd watch for:

- **Judgment over speed.** Did they pick the right tool for the subtask, or just fire the biggest model at everything?
- **Preparation over prompting.** Did they set up context, or start from zero every time?
- **Verification over trust.** Did they define success criteria before generating code?
- **Iteration over perfection.** Did they course-correct quickly when output was wrong?

The engineers who are dangerous with AI aren't the ones who know the fanciest prompts. They're the ones who've built systems around the tool — layered judgment that compounds.

The model is the easy part. The system around it is the skill.

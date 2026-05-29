---
title: "Tech recordings at Amazon"
description: "A running log of technical learnings, career reflections, and engineering principles from my years at Amazon Alexa."
tldr: "A 2021–2022 running log of engineering lessons from Amazon Alexa — API design as the central craft, performance tuning, COE root-cause culture, the 'make it cheap' mental model, and the habits that compound across teams."
date: 2021-07-31
updated: 2026-05-28
tags: ["career", "engineering", "api", "performance"]
faq:
  - q: "What is COE at Amazon?"
    a: "COE stands for Correction of Errors — Amazon's structured root-cause mechanism after an incident. The discipline is to drive 5-Whys until the root cause is fixed and remains fixed, not to complete a process form."
  - q: "What does 'make it cheap' mean as an engineering principle?"
    a: "Make latency cheap to reduce, availability cheap to raise, and the system cheap to change. The framing forces design choices that preserve optionality and lower the cost of future iteration."
  - q: "What is the difference between best practice and benchmark?"
    a: "Best practice is what your team currently does well. Benchmark is what the rest of the industry has moved to. A benchmark refresh can reveal that your inherited best practice is no longer best."
  - q: "What defines an effective API design?"
    a: "Focus on entity definition before everything else — what the entity is, why the business needs it, whether the world would need it in an ideal design. The best APIs are usable, secure, available, fast, and cheap at the same time; trade-offs between them are intentional, not accidental."
---

## Mission Statement

- `To be the best API Service owner`: mastered the best practice of API (including the full-stack microservices and data processes behind the scene) design, build and maintainenance.
- `System Performance Tuning`: continuously improving the end to end system performance on both reliability and scalability

## Records

### Jul. 2022

- One important thing is the awareness between "best practice" vs "benchmark". For inherited systems, they normally come with legacy wise and people mostly inherit their best practices. However, leaders should pay attention to the benchmarks as well, if there is gap between current best practice, it's not the best practice.
  - benchmark keeps refreshing on the other hand, for example, `step function express mode`.
- We always talk about the "Data" for right decision making, however, we should add "Rationale" along with it. The data should match the rationale.
- Again, curiosity is so important, again and again reminds me the quote "stay hungry, stay foolish".
- Knowing the benchmark or standard is good, you know what "good enough" is.
  - for example, when we consider `Scalability`, we could measure it with `handle 100x scale, no need architecture change for next 5 years.`

### Jun. 2022

- iterative optimization is the right way to better stage, which requires two essential tools
  - Feedback & Upgrade Loop: easy and fast feedback and upgrade mechanism that could collect feedbacks easily from end customers, and a way to correct the product easily. For example, oh-my-zsh upgrade mechanism.
  - Experiment Framework: easy to conduct A/B testing and critical changes help measure the change impact effectively
- Project Management by Milestone instead of by *Project*
  - Timebox the milestones then the *real* project progress comes with it
  - Prioritization over Time/Resource/Feature

### May. 2022

- A recent COE was due to a bug in a widely spread `X-Utils` package, one of the action items was to `mark the util package deprecated to avoid people misuse it`. This is a typical example of "naive thinking": there is a problem in the tool, let's not use the tool with problem. The question raised from my side: what should we use then? this tool is commonly used for a reason, is there an alternative that supports all its good features without this problem?
  - On the other side, `COE` is one the most favorite mechanism I learnt here at Amazon. The `Fix Root Cause via 5-WHYs` are not aimed for a process completion but keep the problem fixed and remain fixed.

### Apr. 2022

- Decision Making on career change
  - there is no *right* answer, but a *suitable choice*
  - don't regret

### Mar. 2022

- PoA talk from alv on distributed system testing
  - class must have good javadoc
  - test as close as possible to the dev environment
  - create tool for UT instead of relying on Integration Test (Do the **Cheap** choice!)
  - focus on the fundamental features, the rest are others job

### Feb. 2022

- Key value: `breakdown problem into granular sub-tasks and delegate to the right people`.
  - understand the problem
  - known people
  - task breakdown with proper boundary
  - keep track of the breakdowns so it's assembled well when needed
- `温故知新` — we shall learn from the past and keep it refreshed with latest knowledge and skills

### Jan. 2022

- Just a note on important things for API design: focused on "entity definition" more than anything else. "What is it? Why do we need it in [X business]? In an ideal world, would we need it?"
- The value I should focus on: 1) insist a good technical benchmark; 2) keep the maintainability and flexibility with best effort; 3) remember business first.
- `cheap`: make latency cheap to reduce, make availability cheap to raise, make system cheap to change.

### Dec. 2021

- `To Be THE Best API Service Developer`, mastered the best practice of API (including the full-stack microservices and data processes behind the scene) design, maintenance and scale.
- Two sets of technical skills:
  - ***Tools*** — like programming language familiarity, database/api/ops best practices etc.
  - ***Instruments*** — like mechanism of design creation, process to tech vision etc.

### Nov. 2021

- Automation at different levels, learning from "Resolve MV Conflict":
  1. ask experienced SDE
  2. write a wiki on HowTo
  3. write a script GodianKnot.fix-mv-conflict
  4. integrate and automate on its own
- AH told me "stay ahead" so that to discover what's missing
- YS told me "own end to end" so that to solve the problem completely
- S3 stories show that "stick to highest standard at one dimension" so that it could arrive a beyond expectation stage

### Oct. 2021

- Dataflow velocity and cost could be a good design dimension to evaluate
- Design for flexibility
- Listen to Customers, but Think ahead and offer beyond their voice. "One more thing" by Steve Jobs.

### Sep. 2021

- Security and Privacy is a concern for all existing online services
- Realtime abuse detection

### Aug. 2021

Thirdparty developer platform owner:
- effective API design (and internal system consistent maintenance following the design)
- platform operation (boundary between infra vs partner with proper permission group configuration and operational excellence)
- developer metrics monitoring and improvement (customer oriented platform)
- feedback mechanism
- better sandbox (isolate side effects)

### Jul. 2021

Proficient API designer and Tier-1 Ops master, particularly on *Runtime*/*Platform* service.

### Random notes

- Terminology is an essential important setup for context.
- Variables, more specifically, Variable's Scope. Be thoughtful about what scope a variable lives in — system-level variables are easy to misuse.
- Focus. List the tasks with specifics and time bounded, makes it easier to narrow down the focus list.

> The best APIs are `usable, secure, available, fast and cheap` at the same time. When necessary, we make intentional trade-offs in usability or cost to improve security, availability or performance.

## Case studies

- Precompute Framework / Elastic View
- Chain Executor / DAG Processor
- Dynamic Configurable Rule Engine
- Discovery and Throttling
- Async Task Management

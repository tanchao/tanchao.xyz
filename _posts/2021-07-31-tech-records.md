---
layout: post
title: tanchao's tech recording at amazon
subtitle: who matters in which domain by how at what level
author: Chao Tan
date: 2021-07-31 16:10:10 +0800
categories: career
tags: career impact
---

## Mission Statement
* `To be the best API Service owner`, mastered the best practice of API (including the full-stack microservices and data processes behind the scene) design, build and maintainenance.
* `System Performance Tuning`, continuously improving the end to end system performance on both reliability and scalability

## Records

### Jul. 2022
* One important thing is the awareness between "best practice" vs "benchmark". For inherited systems, they normally come with legacy wise and people mostly inherit their best practices. However, leaders should pay attention to the benchmarks as well, if there is gap between current best practice, it's not the best practice.
  * benchmark keeps refreshing on the other hand, for example, `step function express mode`.
* We always talk about the "Data" for right decision making, however, we should add "Rationale" along with it. The data should match the rationale.
* Again, curiosity is so important, again and again reminds me the quote "stay hungry, stay foolish".
* Knowing the benchmark or standard is good, you know what "good enough" is.
  * for example, when we consider `Scalability`, we could measure it with `handle 100x scale, no need architecture change for next 5 years.`

### Jun. 2022
* iterative optimization is the right way to better stage, which requires two essential tools
  * Feedback & Upgrade Loop, easy and fast feedback and upgrade mechanism that could collect feedbacks easily from end customers, and a way to correct the product easily. For example, oh-my-zsh upgrade mechanism.
  * Experiment Framework, easy to conduct A/B testing and critical changes help measure the change impact effectively
* Project Management by Milestone instead of by *Project*
  * Timebox the milestones then the *real* project progress comes with it
  * Prioritization over Time/Resource/Feature
  * Foundation
* When look into web application frameworks, noticed the gap between Java vs Ruby(Rails)/Python(Django), however, when I dig into `Spring` there are lots of good frameworks and considerations, some of them might be over weighting, but they are good.
  * https://spring.io/guides/tutorials/rest/
  * https://spring.io/guides/tutorials/spring-boot-oauth2/

### May. 2022
* A recent COE was due to a bug in a widely spread `X-Utils` package, one of the action items was to `mark the util package deprecated to avoid people misuse it`. This is a typical example of "naive thinking": there is a problem in the tool, let's not use the tool with problem. The question raised from my side: what should we use then? this tool is commonly used for a reason, is there a alternative that supports all its good features without this problem?
  * I took a close look later, the bug wasn't due to the `X-Utils` but actually due to the misuse of the util. Similar ask of "we should all not use knifes, because there is a bad guy killed someone with a knife."
  * On the otherside, `COE` is one the most favorite mechanism I learnt here at Amazon. The `Fix Root Cause via 5-WHYs` are not aimed for a process completion but keep the problem fixed and remain fixed.
  * I didn't close this issue completely but avoided the AI ticket to auto close with this deprecation statement. We shall look into it even deeper to find a better approach for the utils to safe by default.

### Apr. 2022
* Decision Making on career change
  * there is no *right* answer, but a *suitable choice*
  * don't regret

### Mar. 2022
* PoA talk from alv on distributed system testing
  * class must have good javadoc
  * test as close as possible to the dev environment
  * create tool for UT instead of relying on Integration Test (Do the **Cheap** choice!)
  * focus on the fundamental features, the rest are others job

### Feb. 2022
* Key value: `breakdown problem into granular sub-tasks and delegate to the right people`.
  * understand the problem
  * known people
  * task breakdown with proper boundary
  * keep track of the breakdowns so it's assemble well when need
* quote:
>不管这次能不能过，都建议你多做strategic thinking，不管大事小事，看到没有人去做的机会就可以写个1-pager，we should do X, SWOT analysis, why not Y, what does it mean for product Foo, what does it mean for technical stack Bar, what's the 1/3/5 year vision, what are the dependencies, etc.
* `温故知新`, we shall learn from the past and keep it refreshed with latest knowledge and skills
* there are two types of invention: 

### Jan. 2022
* Just a note on important things for API design: F focused on "entity definition" more than anything else, "what is it? why do we need it in [X business]? in an ideal world, would we need it? shall we need it in future?", after confirming that we really need an entity for a good reason, then "who will produce it? who will consume it? why do they need pass through this API/Service instead of establishing the direct relationship? do they plan to do it in future? if yes, why not now?" There are lots of API design best practices on technical areas, however, the most important part comes back to the business (use case) itself, that's the reason why talented developers can't design the *best* API ever due the business would always excel its current state. 
* The value I should focus on: 1) insist a good technical brenchmark; 2) keep the maintanenbility and flexibility with best effort; 3) remember business first. 
* There are some good machnism we learnt, that's not a done-done, it must process 3 steps: 1) awareness; 2) practice; 3) habit. Because most *mechnisms* are still exist in format of *process*, you have to use it first then to benefit from it. The other point is that *Do we really follow the mechenism?* 
  * That's why my favorite way is `automation` over `mechenism`, if there is a good intention, try to enforce an automated check/validation.
* The hard thing about *First Principal* is not about this thinking strategy, but on *what is the first place?* or technically *what could it be*.
* `cheap`, make latency cheap to reduce, make availability cheap to raise, make system cheap to change.

### Dec. 2021
* `To Be THE Best API Service Developer`, mastered the best practice of API (including the full-stack microservices and data processes behind the scene) design, maintainenance and scale.
* Two sets of technical skills:
  * ***Tools*** - like programming language familarity, database/api/ops best practices etc.
  * ***Instruments*** - like mechanism of design creation, process to tech vision etc.

### Nov. 2021
* Automation at different levels, learning from "Resolve MV Conflict": 1. ask experienced SDE; 2. write a wiki on HowTo; 3. write a script GodianKnot.fix-mv-conflict; 4. integrate with code.amazon and permission to automate run updates on its own. 
  * the process, at the end, is to simulate and automate "the manual process" to solve the prolem as much as possible
* AH told me "stay ahead" so that to discover what's missing
* YS told me "own end to end" so that to solve the problem completely
* S3 stories show that "stick to highest standard at one dimension" so that it could arrive a beyond expectation stage

### Oct. 2021
* Dataflow velocity and cost could be a good design dimension to evaluate
* Design for flexibility 
  * I have a plan B, why not go with plan B directly?
* Listen to Customers, but, Think ahead and offer beyond their voice. "One more thing" by Steve Jobs.

### Sep. 2021

* Security and Privacy is a concern for all existing online services
* Realtime abuse detection

### Aug. 2021

Thirdparty developer platform owner
  * effective API design (and internal system consistent maintenance following the design)
  * platform operation (boundary between infra vs partner with proper permission group configuration and operational excellence over proper granularity)
  * developer metrics monitoring and improvement (customer oriented platform)
  * feedback mechanism 
  * better sandbox (isolate side affects)

### Jul. 2021

Proficient API designer and Tier-1 Ops master, particularly on *Runtime*/*Platform* service.

### Random notes

* Terminology is an essential important setup for context. People could assume audience are having good enough context and on the same page of understanding the topics and reasoning. But, for audience not familar with the background and history, terminology clarification is the most important step to make the conversation effective and right. Lots of design doc use *Terminology* section to explain lots of abbreviations for different teams, but the key definition we need clarify are from the *Problem Statement*. The key problem area, technical challengies/complexities/blockers etc.
  * Clear problem statement results in right design
* Variables, more specifically, Variable's Scope. A recent design discussion helped me understand one important dimension to pay attention to is the *System Variable*, we frequently recognize the variables and arguments clearly when we write program methods, we are not at the same level of sensitivity at System level. Here is an existing data pipeline, existing data structure, let me just add a field so I can consume it somewhere elese. NOTE: what's the scope of this data structure? what's the data update frequency? who owns it who promisd the correctness of it? Are you willing to track among the pipeline when you get a bug in future? INSTEAD: could I access the data source directly from my program? so it's a variable defined in my scope and I know who is directly responsible for it instead of "plug" on other solutions.
* Focus. Stay focus is really hard, with multitasking it's harder. Not only from work but also from family, too. List the tasks with specifics and time bounded, makes it easier to narrow down the focus list. Then self-awareness whenever the attention switch. Another awareness is are we trying to solve the problem exceed the expectation, is there a value to do that?
* API
>The best APIs are `usable, secure, available, fast and cheap` at the same time. When necessary, we make intentional trade-offs in usability or cost to improve security, availability or performance. We strive to find a solution which satisfies all concerns.
* Talk about **Think Big** and **Invent and Simplify**, there are shortcuts, if you are not targeting some real breakthrough inventions:
  * New technologies are invented, adapt it in your problem space: e.g. Rust-lang to reduce latency (particularly the tail bumps), MemoryDB for session management
  * Existing technologies for existing problems in new area: e.g. crypto
  * New mechnism in existing problem space: e.g. API economy

## Case studies
* Precompute Framework
  * Elastic View
* Chain Executor
  * DAG Processor
* Dynamic Configurable Rule Engine
* SDC/App Config
* Discovery and Throttling
* Async Task Management
* Atocha log
* Tracing: https://w.amazon.com/bin/view/CEH/Efficiency/Efficiency_and_Code/
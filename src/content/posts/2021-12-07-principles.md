---
title: "supertan's principles"
description: "Seven personal engineering principles distilled from Amazon: automation, proactivity, deliver-small-deliver-fast, highest standard, dynamic problem-solving, think big, and operational excellence."
tldr: "Seven personal engineering principles distilled from Amazon — automation, proactivity, deliver small and fast, insist on the highest standard, solve dynamic end-to-end problems, think big, and operational excellence — backed by four tenets: automate everything, make things cheap, solve the right problem, and listen-understand-communicate."
date: "2021-12-07"
updated: 2026-05-28
originalUrl: "https://tanchao.github.io/2021/12/07/principles.html"
faq:
  - q: "What are Chao Tan's engineering principles?"
    a: "Seven principles: automation, proactivity (ownership and founder's mentality), deliver small and fast, insist on the highest standard, solve dynamic end-to-end problems, think big, and operational excellence (measure, observe, fix the root cause)."
  - q: "What are the underlying tenets behind the principles?"
    a: "Four tenets: automate everything; make things cheap (prototype works, prefer the cheaper plan when it meets the need, follow vision-design-impl, optimize price/performance); solve the right problem; and listen, understand, and communicate."
  - q: "What does 'make things cheap' mean?"
    a: "Prefer designs that are cheap to prototype, cheap to change, and have good price/performance. When choosing between plan A and a cheaper plan B that meets the same need, default to plan B."
  - q: "What is operational excellence in this framing?"
    a: "Measure, observe, and reason — then fix the root cause so it remains fixed. The mechanism matters more than the intention; without measurement, every fix is a guess."
---

Amazon has it's leadership principles to guide the company on decision making. Here are some guide my behaviors:
1. Automation
> automate everything, particularly something rely on human intention; as jeffb@ always said: "good intention won't work, mechanism does".
2. Proactive
> someone call it ownership or founder's mentality, just step out and think beyond.
3. Deliver small, deliver fast
> speed matters.
> make solutions cheap
4. Insist highest standard
> there are two important perspective: insist highest standard for self; hold it for the team.
5. Solve dynamic problem
> curious to learn to explore the end to end picture, software is eating the world, start from customer direct experience to the bits movement on the data center.
6. Think big
> think ahead, think beyond, whatever you called, don't limit to customer's camplains only, watch for the reflection behind the scene. Experiment and prototype quickly.
7. OE
> measure, observe and reason; fix the root cause and it should remain fixed.

# tenets

0. automate everything
1. make things *cheap*
    1. prototype works
    1. plan A vs plan B, why not just use plan B
    1. vision, design, impl
    1. price performance
2. solve the right problem
3. listen, understand and communicate

# Examples

## Ownership

### 6/16 
Use case: A complainted that something (X) doesn't work with his stuffs (Y), that something was offered by B. Then B claimed X worked with his stuffs (Z), so there should be some issue in `Y` or `X & Y`. 
Chao: The issue here is that B introduced another variable `Z` that actually won't really help the end delivery `X & Y`. As a owner, we should focus on *Solving Customer's Problem* instead of *Proving we are right*.

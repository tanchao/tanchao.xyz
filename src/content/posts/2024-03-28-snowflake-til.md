---
title: "TILs at Snowflake"
description: "Two years of learnings at Snowflake — on performance, product thinking, and technical leadership."
date: 2024-03-28
tags: ["career", "snowflake", "performance", "engineering"]
---

I didn't post the #makeitsnow sharing when I joined Snowflake, one because I was exhausted from the scary immigration system (almost lost my working status), the other was the hesitance among all the choices. Today, as of 03/24/2024, the stock price is the same as it was around Aug. 2022. Financially, this is the worst choice among all my offers where Meta/Uber bumped 4x. Technically, this is a good choice when I look back at how much I learnt and grew.

Today is just another proud day for me to look at what we invented and delivered, worth writing them down.

## Product First

Think hard for customers, make intuitive decisions for customers, even if it sacrifices tech complexity.

## Opinionated Tech Lead

Make a right choice, by right algorithm, and/or accurate user data, and/or personal (professional) experience.

## Algorithms in practice

Math has the power of truth provenance, algorithms too. How to be "right"? Prove it ahead with algo.

## Effective Performance Tuning

Today's proud comes from the performance improvement we made to our core classification function — **10x faster**. More importantly, the delta between p50/p90 is reduced from 40s to 3s. What's more meaningful to myself: reduced the delta ratio from **1x** to **0.4x**.

When I looked at the p90 numbers drop from 80 to 10 this morning, I felt *normal*. I did such performance improvements multiple times during my career and I knew this is just another case when we focus in this area. Later, during discussion with my manager, I suddenly realized this was the north star. **IT IS DIFFERENT.**

Let me zoom out and take a look at the 2-year picture. Our p90 journey has been `50s → tuning → 10s → climbing → 80s → tuning → 10s`:

1. **First reduction** was a *normal improvement*. We had a bunch of classifiers running slower than they should. I believed it should be dozens of milliseconds. So we refactored the structure and rewrote some slow classifiers, p90 improved 5x as expected.
2. **Second climbing** was a sacrifice for product features. We introduced more classifiers to support internationalization expansion, plus dynamic custom classification. We admit to a lineage latency increase from more classifiers. We don't do parallelization at the executor level because the data storage workers already optimize concurrent distribution well — multithreading at executor level would just compete for resources. Customers are happy with the new features, with the cost.
3. **Latest reduction** is an innovation and "standing on the shoulders of giants". The giant part: Snowflake UDTF offers a more performant way to parallel-scan a table, vs the old UDF which is more like sequential execution. The innovative part: we flatten columns to rows, then leverage the UDTF mechanism for maximum parallelism.

With the latest tuning, we cut off the lineage latency increase from more columns in a table. The whole job duration for a table is dominated by the slowest column now.

> How fast is fast enough?

The amazing part for me is turning a design into a reality. We had a theory, we did prototype, we implemented and rolled out. There were bugs, performance testing limitations, and special workload negative results. When we finally arrived at the goal, until I realized *the delta between p50 & p90*, I wasn't sure how to prove the success. As a perf nerd, this is the best part — this is when I am comfortable that I master the **more effective** perf tuning methodology.

## People

- Learnt from PM
- Learnt from Architect
- Learnt from Manager

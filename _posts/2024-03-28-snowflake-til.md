---
layout: post
title: TILs at Snowflake
subtitle: keep a record of my learnings from Snowflake
author: Chao Tan
date: 2024-03-28 20:38:00 +0700
categories: career
tags: career
---

{{ page.title }}
================

I didn't post the #makeitsnow sharing when I joint Snowflake, one because I was exhausted from the scary immigration system (almost lost my working status), the other was the hesitance among all the choices. Today, as of 03/24/2024, the stock price is the same when as it was around Aug. 2022. Financially, this is the worst choice among all my offers where Meta/Uber bumped 4x. Technically, this is a good choice when I look back how much I learnt and grew. 

Today is just another proud day for me to look at what we invented and delivered, worth write them down.

**Product First**

Think hard for customers, make intuitive decisions for customers, even if it sarcrifies the tech complexity.

**Opinionated Tech Lead**

Make a right choice, by right algorithem, and/or accurate user data, and/or personal (professional) experience.

**Algorithms in practice**

Math has the power of truth provenance, algorithms too. How to be "right"? Prove it ahead with algo.

**Effective Performance Tuning**

Today's proud comes from the performance improvement we made to our core classification function, 10x faster. More importantly, the delta between p50/p90 is reduced from 40s to 3s. What's more meaningful to myself, reduced the delta ratio from **1x** to **0.4x**. 

When I looked at the p90 numbers drop from 80 to 10 this morning, I felt _normal_. I did such performance improvements multiple times during my career and I knew this is just another case when we focus in this area. Later, during discussion with my manager (Yimeng is a good manager), I suddenly realized this was the north star. IT IS DIFFERENT. 

Let me zoom out the graph a little bit and take a look at the 2 years picture, our p90 journey has been `50s -> tuning -> 10s -> climbing -> 80s -> tuning -> 10s`. Because:
1. first reduction was a _normal improvement_, we have a bunch of classifer that run slower (hundreds of milliseconds), I believe it should be dozens of milliseconds. So we refactor the structure and rewrite some slow classifiers, p90 improved 5x as expected.
2. second climbing was a sacrifice for product features, we introduced more and more classifiers to support internationalization expansion. plus a dynamic portion from custom classification. basically we admit to a lineage latency increase from the increase of classifier counts. we don't do parallization because the data storage workers already optimize the concurrent distributions pretty well, multithreading at executor level would just competing resources against each other and harm the system, it couldn't help its overall latency. customers are happy with the new features, with the cost.
3. latest reduction is an innovation and a "standing on the shoulders of giant". the giant part, Snowflake UDTF offers a more performant way to parallism scan a table, comparing to the old UDF is more like a sequence execution one by one. the innonvative part, we flatten columns to be rows, then leverage the UDTF mechanism for most parallism.
With latest tuning, we cut off the lineage latency increase with more columns in a table. The whole job duration for a table is dominate by the slowest column now. We still get the lineage growth from our classifiers but it wouldn't be 10x anymore. Also we have another potential 10x cheaper plan B, if we really needs to.

>How fast is fast enough?

The amazing part for me is turning a design into a reality, we had a theory, we did prototype, we implemented and rolled out. There were bugs, performance testing limitations and special workload negative results. when we finally arrived to the goal, until I realized _the delta between p50 & p90_, I wasn't sure how to prove the success. As a perf nerd, this is the best part, this is when I am comfortable that I master the **more effective** perf tuning methodology.

**People**

- Learnt from PM
- Learnt from Architect
- Learnt from Manager
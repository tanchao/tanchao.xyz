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

# Product First

Think hard for customers, make intuitive decisions for customers, even if it sarcrifies the tech complexity.

# Opinionated Tech Lead

Make a right choice, by right algorithem, and/or accurate user data, and/or personal (professional) experience.

# Algorithms in practice

Math has the power of truth provenance, algorithms too. How to be "right"? Prove it ahead with algo.

# Effective Performance Tuning

Today's proud comes from the performance improvement we made to our core classification function, from p90 to p50, 7x faster. More important, the delta between p50/p90 is reduced from 40s to 3s, put it more meaningfully, reduced the delta ration from 1x `(80 - 40) / 40` to 0.4x `(10 - 7) / 7`. 

When I looked at the p90 numbers drop from 80 to 10 this morning, I felt normal. I did such performance improvements multiple times during my career and I knew this is just another case when we focus in this area. Later, during discussion with my manager (Yimeng is good), I suddenly realized this was the north star. IT IS DIFFERENT. 

Let me zoom out the graph first and look at the 2 years picture, our p90 journey has been `50s -> 10s -> gradually -> 80s -> 10s`. Because:
1. first reduction was the normal improvement, we have a bunch of classifer that run slower than we thought (hundreds of milliseconds), we tune the structure and rewrite the slow algorithm, it's 10x faster, result in our p90 improved 5x.
2. second climbing was a sacrifice for product features, we introduced more and more classifiers to support internationalization expansion. plus a dynamic portion from custom classification. basically we admit to a lineage latency increase from the increase of classifier counts. we don't do parallization because the data storage workers already optimize the concurrent distributions pretty well, multithreading at executor level would just competing resources against each other and harm the system, it couldn't help its overall latency. customers are happy with the new features, with the cost.
3. this reduction is an innovation and a "standing on the shoulders of giant". the giant part, Snowflake UDTF offers a more performant way to parallism scan a table, comparing to the old UDF is more like a sequence execution one by one. the innonvative part, 

# People

Learnt from PM
Learnt from Architect
Learnt from Manager
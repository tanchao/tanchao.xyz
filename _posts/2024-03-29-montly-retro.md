---
layout: post
title: 2024-03 retro
author: Chao Tan
date: 2024-03-29 13:00:00 +0700
categories: career
tags: career
---

{{ page.title }}
================

Monthly retro over:
1. Delivery
```
* classification udf -> udtf done done, 10x improvement.
* automatic tag propagation engine design almost done, satisfied about the final algothrims for performance and eventual consistency, and the full scan trade offs we thought through, eventually a trade-off on time v.s. memory.
```
2. Next priority
```
* implementation of the continuous propagation
* observability of the propagation
* lots of data analysis and SQLs over the dependency graph and tag associations, building a new dashboard for object tagging
```
3. Learning from work and study
```
* performance improvement at architecture level, focus on gain that reduce the growth delta, e.g. from O(N) to O(logN)
* how to write better doc
* opinionate, then focus on all the supporting data; if not enough supporting data, revise opinion
* ceo change resulted such a huge impact on $SNOW, as well as my financial plan
* an admired architect left the team, they taught me a lot, even with the last stamp
```
4. Look around industry findings
```
* DBRX is not an efficient move, we chose mistral for a reason, for the price/cost efficiency.
* AI Component System is a good paper to read, I think LLM is like the OS in future world, more importantly, wait and see who will invent the DOS and the WINDOW. 
```
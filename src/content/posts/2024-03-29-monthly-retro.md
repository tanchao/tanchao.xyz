---
title: "Monthly retro — March 2024"
description: "What I shipped, what I'm focused on next, and what I learned in March 2024 at Snowflake."
date: 2024-03-29
tags: ["career", "snowflake", "retro"]
---

## Delivery

- Classification UDF → UDTF migration done. **10x performance improvement.**
- Automatic tag propagation engine design almost done. Satisfied about the final algorithms for performance and eventual consistency, and the full scan trade-offs we thought through — eventually a trade-off on time vs. memory.

## Next priority

- Implementation of the continuous propagation
- Observability of the propagation
- Lots of data analysis and SQLs over the dependency graph and tag associations, building a new dashboard for object tagging

## Learnings from work and study

- Performance improvement at architecture level: focus on gains that reduce the growth delta, e.g. from O(N) to O(log N)
- How to write better documentation
- Opinionate, then focus on all the supporting data. If not enough supporting data, revise opinion.
- CEO change resulted in such a huge impact on $SNOW, as well as my financial plan
- An admired architect left the team. They taught me a lot, even with the last stamp.

## Industry findings

- DBRX is not an efficient move. We chose Mistral for a reason — price/cost efficiency.
- *AI Component System* is a good paper to read. I think LLM is like the OS in the future world. More importantly, wait and see who will invent the DOS and the Windows.

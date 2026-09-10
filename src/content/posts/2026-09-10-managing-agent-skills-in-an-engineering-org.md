---
title: "Managing agent skills in an engineering org: personal outranks project"
description: "Claude Code resolves skills enterprise → personal → project, which inverts what settings do. A personal skill silently shadows the team's, so governance that runs in CI cannot enforce a mandate that is decided at load time."
tldr: "Claude Code resolves skills enterprise over personal over project — the reverse of settings, where project outranks user. So an engineer's own skill silently shadows the team's, and governance that runs at commit time cannot see a conflict decided at load time."
date: 2026-09-10
tags: ["llm", "agents", "claude-code", "context-engineering", "engineering"]
draft: false
faq:
  - q: "What is the precedence order for Claude Code skills?"
    a: "Enterprise, then personal, then project, then nested subdirectory skills. Anthropic's documentation states it as 'Enterprise over personal, and personal over project.' This differs from settings precedence, which runs managed, command line, project local, shared project, user — where project outranks user. Skills invert the middle two tiers relative to settings."
  - q: "Does a personal skill override a project skill?"
    a: "Yes. With a skill named deploy in both ~/.claude/skills/ and the repository's .claude/skills/, invoking /deploy runs the personal one. I verified this with two same-named skills returning distinct tokens: invoked from inside the project, the personal one answered, and nothing reported that a project skill had been passed over. A team cannot commit a skill and rely on it executing."
  - q: "How does an organization ship a mandated skill?"
    a: "Place it at .claude/skills/<name>/SKILL.md inside the managed settings directory — /Library/Application Support/ClaudeCode/ on macOS, /etc/claude-code/ on Linux and WSL, C:\\Program Files\\ClaudeCode\\ on Windows. Skills delivered this way sit at the top of the precedence order and cannot be overridden. Several teams can own separate parts of one policy through managed-settings.d/*.json drop-in files, merged alphabetically."
  - q: "Can an admin block personal or project skills?"
    a: "Two ways, at very different granularity. strictPluginOnlyCustomization is managed-scope only and blocks skills, agents, hooks, and MCP servers from user and project sources outright. skillOverrides is the per-skill control: a map of skill name to one of on, name-only, user-invocable-only, or off, which hides or collapses a single skill without editing its SKILL.md. Set in managed settings it can only restrict further, never make a skill more visible, and it does not apply to plugin skills."
  - q: "Should org-wide skills be shipped as plugins?"
    a: "Usually yes. Plugin skills are namespaced as /plugin-name:skill-name, so they cannot collide with a personal or project skill at all. Namespacing makes shadowing structurally impossible instead of conventionally avoided, which is the difference between a mechanism and an agreement."
  - q: "Does an unused skill cost anything?"
    a: "Almost nothing, but an invoked one does. Only descriptions load at session start. Once invoked, the rendered SKILL.md enters the conversation and stays across later turns, so every line is a recurring token cost. After auto-compaction Claude Code re-attaches the most recent invocation of each skill, keeping the first 5,000 tokens of each within a 25,000-token combined budget."
---

> Part of a series on structuring agentic systems. Earlier: [Skills vs. subagents: when to use each](/posts/2026/07/27/skills-vs-subagents-when-to-use-each/).

Claude Code loads skills from three tiers — enterprise, personal, and project — and resolves name conflicts in that order. Personal beats project. A team can commit a mandated skill, pass every check in CI, and still have it silently replaced by one engineer's own copy. Managing skills across an org is a precedence problem before it is a policy problem.

## Three tiers, and the middle one wins

Most orgs land on the same three logical groups: company defaults, project procedure, personal working style. That grouping is right. The priority everyone assumes for it is wrong. Anthropic's [skills documentation](https://code.claude.com/docs/en/skills) states the rule directly: *"Enterprise over personal, and personal over project."* Their own example is the one that should worry a platform team — with `deploy` in both `~/.claude/skills/` and the repository, `/deploy` runs the personal one.

The two orders disagree:

| Surface | Order, highest first |
|---|---|
| [Skills](https://code.claude.com/docs/en/skills) | Enterprise → **personal** → **project** → nested |
| [Settings](https://code.claude.com/docs/en/settings) | Managed → command line → **project local** → **shared project** → **user** |

For settings, the project outranks the user. For skills, the user outranks the project. Nothing in the interface tells you so.

I reproduced it rather than trust the sentence. Two skills with the same name, one in `~/.claude/skills/` and one in a throwaway project's `.claude/skills/`, each instructed to return a distinct token. Invoked from inside the project directory, the answer came back `MARKER_PERSONAL_TIER`. The personal skill won, and nothing announced that a project skill of the same name had been passed over.

There is a defensible reason for the ordering. A personal skill is a deliberate individual override — my way of doing this, in whatever repo I am in. Ranking it higher respects the engineer. The cost is that the org loses any guarantee that a committed skill runs.

One exception matters more than the rule. Plugin skills are namespaced `/plugin-name:skill-name`. They cannot collide with anything.

## Commit-time checks cannot see load-time precedence

Governance for shared config almost always lands at commit time: a linter in precommit, a validator in CI, CODEOWNERS on the shared directory. That is the right place for most questions about a file. It is the wrong place for this one. A repo-scoped validator reads the repository. The tier that outranks the repository lives in `~/.claude/skills/` on a laptop the validator never sees.

So a skill can be fully compliant with whatever contract your org publishes — correct frontmatter, under the line cap, eval set attached, green in CI — land on the main branch, and never execute on a given engineer's machine. Nobody gets an error. The team's procedure quietly does not happen.

The cheapest fix converts a silent failure into a loud one. A `SessionStart` hook that compares the two directories and prints the overlap is seven lines:

```bash
#!/usr/bin/env bash
# Print any project skill shadowed by a personal skill of the same name.
personal=$(ls ~/.claude/skills 2>/dev/null | sort)
project=$(ls .claude/skills 2>/dev/null | sort)
shadowed=$(comm -12 <(echo "$personal") <(echo "$project"))
[ -n "$shadowed" ] && printf 'Shadowed by your personal skills: %s\n' "$(echo "$shadowed" | tr '\n' ' ')"
exit 0
```

It does not resolve the conflict, and it should not. It makes the conflict visible, which is the part that was missing. Two caveats, since reliability is the entire claim: it compares only these two tiers, so a skill delivered through the managed settings directory outranks both and goes unreported, and it assumes the session started at the repository root.

## What an admin can actually enforce

Anthropic ships a real enterprise channel, and it is narrower than most policy documents assume. An org delivers a mandated skill as `.claude/skills/<name>/SKILL.md` inside the [managed settings directory](https://code.claude.com/docs/en/managed-settings): `/Library/Application Support/ClaudeCode/` on macOS, `/etc/claude-code/` on Linux and WSL, `C:\Program Files\ClaudeCode\` on Windows. Skills placed there sit above everything and cannot be overridden.

For blocking rather than adding there are two instruments, and confusing them is how orgs overreach. The hammer is `strictPluginOnlyCustomization`, managed-scope only, which blocks *"skills, agents, hooks, and MCP servers from user and project sources."* The scalpel is [`skillOverrides`](https://code.claude.com/docs/en/skills): a per-skill map with four states — `on`, `name-only`, `user-invocable-only`, `off` — that hides or collapses one named skill without editing its `SKILL.md`. Set in managed settings it only ever tightens: *"You can only restrict a skill further through an alias, never make it more visible."* It does not apply to plugin skills.

So shadowing has a remedy chain: the hook finds the name, `skillOverrides` turns that one skill off, and shipping as a namespaced plugin avoids the collision entirely. Note what the scalpel still requires — you must already know the skill's name, which is exactly what the silent failure withheld. Detection remains the missing piece, not enforcement.

Reach for the scalpel, not the hammer, and stop conflating two decisions. Publishing the org's skills as a plugin from a marketplace you control is a *delivery* choice: it buys namespacing, so the org's skills cannot be shadowed by anyone's local copy. `strictPluginOnlyCustomization` is an *enforcement* choice, and a different one — it stops engineers having local skills at all. Ship through the plugin channel; leave the lockdown lever off. Locking the local tiers buys compliance and costs you the people who write the skills worth mandating.

Spotify's framing is the one worth copying. Their golden paths are *"the opinionated and supported path to build something"* — and explicitly optional. Gary Niemen's [2020 write-up](https://engineering.atspotify.com/2020/08/how-we-use-golden-paths-to-solve-fragmentation-in-our-software-ecosystem/) puts it plainly: *"If you are an adventurer you can of course leave the Golden Path and do your own thing, but then you will not have the same support."* Leaving costs support, not permission. For a skill set that means the org tier should be the reviewed, evaluated, current one — good enough that writing your own is the harder path.

One under-discussed detail: multiple teams can own separate pieces of one policy through `managed-settings.d/*.json` drop-in files, merged alphabetically, with numeric prefixes controlling order. That is federated ownership of a single mandate without a shared file to fight over, and a better answer than one platform team gatekeeping every change.

## An invoked skill is a recurring cost

Progressive disclosure is the usual reason to keep a large skill library: descriptions load at session start, bodies load on demand, so an unused skill costs almost nothing. True, and only half the accounting. Once invoked, the rendered `SKILL.md` enters the conversation and *stays there across later turns*. Claude Code does not re-read the file, and does not drop it.

The [documentation](https://code.claude.com/docs/en/skills) is explicit: *"every line is a recurring token cost."* Even compaction preserves it. Claude Code re-attaches the most recent invocation of each skill, keeping the first 5,000 tokens of each, within a 25,000-token combined budget.

This is the real constraint on how big a mandated tier can be. Every skill the org forces into a session taxes the rest of that session. Keep `SKILL.md` under 500 lines, push detail into reference files loaded on demand, and prefer a handful of sharp skills to a catalog nobody prunes.

You can now measure this rather than estimate it. `/skill-doctor`, from v2.1.252, reports each skill's token cost, flags the ones never invoked, and ranks by context cost so you prune the expensive ones first. One caveat for exactly the audience that needs it: the report covers your session's skills *other than* bundled and enterprise ones, so the mandated tier is the part you cannot see.

ThoughtWorks named the opposite outcome. *Agent Instruction Bloat* sits at **Caution** in [Volume 34](https://www.thoughtworks.com/radar/techniques/agent-instruction-bloat) of the Technology Radar, April 2026: *"Instructions become long and sometimes conflict with each other. Models tend to attend less to content buried in the middle of long contexts."* An org tier is exactly where that accretes, because nobody wants to be the person who deletes another team's mandated skill.

## The tier only matters if the skill fires

Everything above assumes the skill runs when it should, and that assumption is shakier than the precedence rule. In [Vercel's January 2026 agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals), testing APIs absent from training data, a documentation skill was never invoked in 56% of cases and scored 53% — indistinguishable from shipping no documentation. Explicit instructions lifted it to 79%; the same content placed always-on in `AGENTS.md` reached 100%.

Treat those numbers as one team's task set, not a law: Vercel does not publish a sample size, and the tasks were deliberately chosen for knowledge the model lacked. What generalizes is the mechanism, not the percentage. Retrieval is a decision point, and a decision point can be skipped. Passive context has no decision point.

The narrow, defensible version: knowledge that should apply on *every* task belongs in the always-on file — `AGENTS.md`, the [vendor-neutral standard](https://agents.md/), or `CLAUDE.md`. Skills earn their place for the occasional procedure invoked on purpose. For tiering there is a second-order effect worth planning around: the more an org pushes into always-on files, the sooner the practical size ceiling on those files becomes the binding constraint instead of the precedence order.

## The override mechanisms you do control

You cannot change the tier order. You do choose how many *additional* ways your layout expresses "apply this skill here," and that is where orgs create their own mess. Claude Code already offers four: which tier the skill lives in, nesting it under a subdirectory, `paths` globs in frontmatter, and plugin namespacing. Each is reasonable alone. Adopt all four as org convention and no engineer will be able to predict which skill runs.

The negative case is documented by the maintainers who lived it. ESLint's old `.eslintrc` cascaded config by walking every directory to the root, *while also* supporting `overrides` glob patterns, *while also* growing new top-level keys release over release. Their [own retrospective](https://eslint.org/blog/2022/08/new-config-system-part-2/) calls the result "more complex than necessary through a series of small, incremental changes," and they collapsed it into a single flat file. Pick one scoping mechanism for your org and write down that the others are unused.

[VS Code](https://code.visualstudio.com/docs/configure/settings) shows what is missing. It overrides by value type: scalars and arrays replace across layers, object-typed settings merge. Skills have no merge — a higher tier replaces a lower one wholesale, and that is the only behavior available. So the rule follows directly. Put in the org tier only what a personal layer should never need to extend. Anything an engineer will predictably want to add to rather than swap out belongs in the project tier or in `AGENTS.md`, where addition is the normal operation.

## Takeaways

- **Write the order down, including the inversion.** Every reader assumes company → project → personal, and skills run enterprise → personal → project.
- **An org cannot commit a skill and assume it runs.** Add the `SessionStart` shadow check — seven lines, catches the common case, blind to the managed tier.
- **Separate delivery from enforcement.** Namespaced plugin for delivery, because it is the only collision-proof channel. `skillOverrides` as the scalpel when one skill misbehaves. Save `strictPluginOnlyCustomization` for a threat model you can actually name.
- **Measure before pruning.** `/skill-doctor` gives per-skill token cost and never-invoked flags. It cannot see the enterprise tier, which is the one you mandated.
- **Pick one scoping mechanism and retire the rest.** Tier, nesting, `paths`, namespacing — four ways to say "apply this here" is the ESLint trap, available today.

I audited my own machine while writing this: 27 personal skills against 17 in one repository, zero name collisions. Zero is the right number, and I did not feel relieved. What holds the line is a prefix convention on the project skills that nobody wrote down and nothing checks.

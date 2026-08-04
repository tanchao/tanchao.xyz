---
title: "Governing multi-party agentic systems"
description: "Single-party agents already work: coding agents and personal runtimes like OpenClaw and Hermes. The unsolved problem is multi-party — agents and humans across roles, teams, and trust boundaries driving one shared process. The hard part is not the models. It is governance: who the agent acts as, what it may do, and who is accountable when it acts. A field survey with the identity, policy, and oversight mechanics that make it safe."
tldr: "A multi-party agentic system spans roles, teams, and trust boundaries, so the binding constraint is governance, not model quality: bind every action to a delegated identity (OAuth token exchange, RFC 8693), gate every tool call through a policy engine (Cedar or OPA), verify cross-org provenance (the A2A trust drafts), and give every agent a named human owner with interrupt conditions and a tamper-evident audit trail (NIST AI RMF, EU AI Act Article 14). Multi-agent is not multi-party."
date: 2026-08-03
tags: ["ai", "agents", "governance", "security", "engineering"]
draft: false
faq:
  - q: "What is a multi-party agentic system?"
    a: "A system where agents and humans across different roles, teams, or organizations drive one shared process to completion, each a distinct party with its own authority and trust boundary. A pipeline where data science, engineering, product, an account team, and a customer each act through or alongside an agent is multi-party. The parties do not share a single owner or a single permission set."
  - q: "How is multi-party different from a multi-agent system?"
    a: "Multi-agent means several agents cooperate; multi-party means several distinct authorities and trust boundaries are involved. Anthropic's orchestrator-worker research system and Claude's managed multiagent orchestration are multi-agent but single-party: all agents share one sandbox, one credential vault, and one owner. Multi-party adds the governance problem multi-agent frameworks assume away: the agents answer to different principals."
  - q: "Who does an AI agent act as when it takes an action?"
    a: "It should act on behalf of a specific human, not as itself. The mechanism is OAuth 2.0 Token Exchange (RFC 8693): the token's subject stays the human and an act claim names the agent, so a downstream system sees both. This is delegation, not impersonation, and it caps the blast radius of a compromised agent at the invoking user's own permissions."
  - q: "How do you enforce policy on an agent's actions?"
    a: "With policy-as-code evaluated at the tool call, not with prompt instructions. A policy engine such as AWS Cedar or Open Policy Agent sits in front of every tool as a decision point: given this principal, tool, arguments, and context, is the action allowed? The agent runtime never gets to vote. AWS ships this pattern in Amazon Bedrock AgentCore, gating every agent-to-tool call at the gateway."
  - q: "What does human oversight require for agentic systems?"
    a: "A named human owner per agent, predefined interrupt conditions, and a tamper-evident audit trail. NIST AI RMF and EU AI Act Article 14 require documented accountability and meaningful human oversight for consequential decisions. Interrupt conditions pause execution when an action exceeds an impact threshold, falls outside authorized scope, or touches sensitive data. Ownership is an on-call rotation, not a line in a spreadsheet."
  - q: "How do agents from different organizations trust each other?"
    a: "Not implicitly. The emerging IETF A2A trust drafts give agents verifiable identities via CA-signed templates, cryptographically traceable spawn chains, and per-message signatures, and require an explicit signed grant before one organization's agent may act against another's resources. Fail-closed at every verification step. The building blocks are standard PKI applied to a new surface."
  - q: "What are the main failure modes of multi-party agentic systems?"
    a: "The confused deputy (an over-permissioned agent tricked into misusing its authority), approval fatigue (humans rubber-stamping gates until the gate is theater), cross-boundary data leakage (one party's context reaching another party), and agent-to-agent telephone (summaries of summaries losing fidelity). Each is a governance failure, not a model failure, and each has a mechanical fix."
---

Single-party agentic systems already work. A coding agent building and testing on your machine, or a personal runtime answering across your messaging apps, operates inside one trust boundary with one owner. The unsolved problem is multi-party: agents and humans across roles, teams, and organizations driving one shared process. There the binding constraint is not the model. It is governance: who the agent acts as, what it may do, and who is accountable when it acts.

This is a field survey of that problem. It sorts single-party from multi-party, shows why most "multi-agent" work is still single-party, and then spends most of its length on the part that actually decides whether these systems are safe to run: identity, policy, oversight, and control.

## Single-party versus multi-party

A single-party system has one trust boundary: one owner, one permission set, one accountable human. A multi-party system has several. The distinction is not the number of agents. It is the number of distinct authorities. A pipeline where data science flags a metric spike, engineering confirms it, product briefs an account team, and the account team reaches a customer is five parties, each with its own data access, its own approvals, and its own reasons to say no. Governance lives on the seams between them.

## Where single-party agents already win

The killer use case today is the coding agent. Claude Code and OpenAI's Codex build, run, and repair code inside a single developer's trust boundary, and they are good enough to have changed how software gets written. The same shape shows up in personal runtimes: [OpenClaw](https://docs.openclaw.ai/), the self-hosted gateway from Peter Steinberger, and [Hermes](https://github.com/nousresearch/hermes-agent/) from Nous Research both run a persistent personal agent across your chat apps, with memory and subagents. All of it is single-party by design.

OpenClaw is explicit about the boundary. Its security docs state the project is a single trusted-operator model and is [not a hostile multi-tenant security boundary](https://docs.openclaw.ai/); if several people can message one tool-enabled agent, each of them can steer that same permission set. That warning is the whole multi-party problem stated in one sentence. What is missing at single-party maturity is exactly what an enterprise process needs: an agent that can act across people who do not share a permission set.

## Multi-agent is not multi-party

Most of what ships as "multi-agent" is single-party underneath. Anthropic's [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) uses an orchestrator-worker pattern: a LeadResearcher plans, spawns parallel subagents, and a CitationAgent attributes sources. Claude's [managed multiagent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration) lets a coordinator delegate to a roster of up to 20 agents. In both, every agent shares one sandbox, one credential vault, and one owner. That is cooperation inside a single boundary.

The value of that work is real, and the frontier advice from it carries over. But it sidesteps the multi-party question by construction: the agents never answer to different principals. OpenAI's Agents SDK handoff pattern and Anthropic's shared-task-list model both coordinate agents that already trust each other. Genuine multi-party — where the account team's agent and the customer's agent belong to different organizations — is where the standards are still drafts, not shipped products.

## Why governance is the hard part

Move from one party to several and the failure modes stop being about capability and start being about authority. Who did the agent act as? Was it allowed to do that? Can another party's data leak through it? Who answers when it gets something wrong at 2 a.m. on a Saturday? None of those are model questions. They are the questions a clearing house answers in finance: parties who do not fully trust each other still settle trades, because a neutral mechanism holds the state, enforces the rules, and records who owed what. In a multi-party agentic system, the governance layer is that clearing house. The rest of this post is what goes in it.

## Who does the agent act as

The first governance decision is identity, and the right answer is delegation, not impersonation. An impersonation token says "I am Alice." A delegation token says "this is Alice's request, carried out by this agent." The mechanism already exists: [OAuth 2.0 Token Exchange (RFC 8693)](https://datatracker.ietf.org/doc/html/rfc8693), stable since 2020, keeps the human as the token's `sub` and names the agent in an `act` claim. Both principals stay identifiable, in the same token, at every hop downstream.

That one choice caps the blast radius. If every outbound call is bound by the invoking user's rights rather than the agent's superset, a prompt injection that tells the agent to delete every customer record fails for a boring reason: the person it acts for cannot delete every customer record. Two more pieces harden it. [Resource Indicators (RFC 8707)](https://datatracker.ietf.org/doc/html/rfc8707) bind a token to exactly one API, so a stolen token cannot be replayed elsewhere. And a draft OAuth extension for on-behalf-of agents adds `actor_token` and `requested_actor` parameters to record the full delegation chain from human to agent. It is not yet ratified, but the direction is clear, and the MCP authorization spec already builds on OAuth 2.1.

## Least privilege when the agent writes its own intent

Least privilege is harder for agents than for people, and the reason is structural. Traditional least privilege assumes access is designed in advance: this role reads, that role writes. An agent generates new intent at runtime. The same agent might read in one turn and, three reasoning steps later, decide it needs to write. Access cannot be pinned to a role because the agent's next action is not known when the role is granted. Research suggests most deployed agents are over-permissioned, inheriting the broad rights of the engineer who shipped them.

The fix is to scope per action, not per agent. Mint a fresh, narrowly scoped token just before each call and let it expire just after. When an agent hits an operation beyond its current scope, return an HTTP 403 with the required scope named, and trigger explicit consent: step-up authorization at the point of need, rather than a broad grant up front. And enforce the chain: a parent agent cannot hand a child agent a scope it does not itself hold. That rule belongs in the authorization server at token-exchange time, not in application logic where an agent's own reasoning could route around it.

## Policy as code, enforced at the tool call

Identity says who is asking. Policy says whether the answer is yes. The load-bearing rule: enforce policy as code at the tool call, and never let the agent's reasoning be the enforcement point. A policy engine like [AWS Cedar](https://www.cedarpolicy.com/) or [Open Policy Agent](https://www.openpolicyagent.org/) sits in front of every tool as a decision point and answers one question per call: given this principal, this tool, these arguments, this context, is it allowed? The runtime asks; the engine decides; the agent never gets a vote. This is the same discipline behind treating [data governance as code](/posts/2026/06/07/data-governance-as-code-dbt-terraform/).

AWS ships exactly this in [Policy for Amazon Bedrock AgentCore](https://aws.amazon.com/blogs/machine-learning/secure-ai-agents-with-policy-in-amazon-bedrock-agentcore/), which intercepts every agent-to-tool request at the gateway and evaluates it against Cedar policies before the tool runs. Cedar is deny-by-default and formally analyzable; OPA's Rego is more expressive with a steeper curve. The property that matters is separation: the agent decides what to do, a layer it cannot edit decides whether it is allowed. Business rules live in a versioned file, changed without redeploying the agent, and evaluated in well under a millisecond so the gate does not dominate the latency budget. An approval status is set by the orchestration layer, never by the agent asking for the approval.

## Trust across organizations

Inside one company, agents can share a trust root. Across companies they cannot, and implicit trust is the vulnerability. The IETF [A2A trust drafts](https://datatracker.ietf.org/doc/draft-tonyai-a2a-trust/) address this by giving agents verifiable identities via CA-signed templates, cryptographically traceable spawn chains, and per-message signatures, so a resource can verify that a calling agent was legitimately spawned and its scope was not escalated. The rule that matters most for multi-party work is blunt: cross-organizational agent action MUST be explicitly authorized by the resource-owning organization. No implicit trust exists between organizations, and verification fails closed at every step.

None of this invents new cryptography; it applies existing PKI (X.509, revocation lists, signing requests) to a new surface. That is the right instinct. A multi-party system's weakest link is the party that assumed the message on the other end came from who it claimed. Signed provenance and an explicit grant turn "I think this is the customer's agent" into "I can prove this is the customer's agent, acting within a scope their organization signed off on."

## Human oversight and named accountability

Automation does not remove the accountable human; it makes naming them non-negotiable. Every agent needs a designated human owner, not a team but a person, reachable when the agent makes a consequential call. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) requires documented accountability under its Govern function, and [EU AI Act Article 14](https://artificialintelligenceact.eu/article/14/) mandates meaningful human oversight for high-risk systems. Ownership is an on-call rotation with an escalation path, not a spreadsheet cell. When the agent acts at 2 a.m., the system must be able to say which human is responsible and how to reach them.

Oversight needs mechanism, not intention. Traditional log review does not scale when an agent takes hundreds of consequential actions a minute, so define interrupt conditions at deployment: pause and require human review when an action exceeds an impact threshold, falls outside authorized scope, trips anomaly detection, or touches sensitive data. Pair that with a tamper-evident audit trail capturing the full chain: the instruction, the retrieved context, each tool call and its arguments, the result, and any human override. Capture it because a human correction is itself a governance event worth recording. One 2026 CSA research note estimates only 38% of organizations monitor AI traffic end-to-end and only 17% continuously monitor agent-to-agent interactions. Read that number twice. Most agent-to-agent conversation in production today is simply unobserved.

## The state of control

Control is where the field is thinnest. Identity and policy are converging on real standards; graceful, well-tested human control is mostly still hand-rolled. The pieces a multi-party system needs: a clean interrupt that pauses a running agent without corrupting the case state, human-in-the-loop checkpoints for high-stakes steps, human-on-the-loop monitoring for the rest, and a kill switch that revokes an agent's tokens instantly rather than politely asking it to stop. Durable, replayable state underneath all of it, so a paused case survives an OOO or a handoff. Same discipline as making an [agentic workflow deterministic and verifiable](/posts/2026/07/28/make-an-agentic-workflow-deterministic-and-verifiable/).

The honest status: most production control today is a thin approval prompt bolted onto an otherwise autonomous loop. That is enough for a single-party coding agent, where the blast radius is one repo and one human is watching. It is not enough for a process that touches a customer through an account team, where a wrong action is visible externally and the human who should catch it is three time zones away. Control has to be designed as a first-class layer, not added as an afterthought.

## How it breaks

The failure modes are predictable, and each is a governance gap with a mechanical fix.

- **The confused deputy.** An over-permissioned agent is tricked, by prompt injection or a bad instruction, into misusing authority it should not have held. Fix: on-behalf-of delegation, so the agent only ever wields the invoking user's least privilege.
- **Approval fatigue.** Route every action through a human and the human rubber-stamps until the gate is theater. Fix: reserve interrupts for actions that cross an impact or scope threshold; let policy auto-approve the boring majority.
- **Cross-boundary leakage.** One party's context (a customer's data, an internal metric) reaches a party who should not see it. Fix: per-party context isolation and purpose-bound messages, not one shared transcript.
- **Agent-to-agent telephone.** Agents summarize each other's summaries and fidelity decays. Fix: exchange typed, structured results and let one coordinator synthesize from raw outputs, the pattern Anthropic's research system uses.

Notice the shape. None of these is fixed by a better model. Each is fixed by a mechanism that holds even when a component behaves badly.

## What the frontier labs actually recommend

Strip the vendor language off the lab guidance and the advice is consistent and unglamorous.

- **Start simple; add agents only when it demonstrably helps.** Both Anthropic and Google say default to one well-resourced agent and escalate to multi-agent only when a task is genuinely parallelizable.
- **Treat tool design with the rigor of prompt design.** The tool surface is the agent's real API; a sloppy tool is a security hole and a context leak.
- **Isolate context per agent.** Give each worker only the task-relevant slice, both for quality and to contain what any one agent can spill. The [skills-versus-subagents](/posts/2026/07/27/skills-vs-subagents-when-to-use-each/) boundary is the same idea.
- **Manage secrets outside the agent.** [Vaulted credentials](https://platform.claude.com/docs/en/managed-agents/vaults) referenced by ID, substituted at egress, so the agent never sees the secret value.
- **Enforce policy at issuance and at the call.** Decide what an agent can access before the token is minted and again when the tool is invoked. The agent's reasoning is never the control point.
- **Evaluate and log everything.** Structured, queryable records of instructions, tool calls, results, and overrides, designed in, because current logging was not built to reconstruct an agent's reasoning after the fact.

## A minimal design that respects all this

Put it together and the shape of a safe multi-party system is not exotic. A durable case object holds the shared state (the spike, the confirmation, the customer thread) and survives anyone going OOO. Each party acts through an agent bound to that party's delegated identity, so every action carries a `sub` and an `act` claim. Every tool call passes a policy gate. Cross-party steps require a signed grant. High-stakes steps hit a human checkpoint; the rest run under monitoring with interrupt conditions armed. Email and Slack are channels the system writes to, never the source of truth. The case object is.

That design keeps a stalled enterprise process moving without pretending the humans vanished. The agent drafts the next message, nudges the right party, escalates on a timer, and hands off cleanly when someone is away. But it does all of it inside a boundary that says who it is acting as, what it may do, and who owns the outcome.

## What I take from this

- **Multi-agent is solved enough; multi-party is not.** The models cooperate fine inside one boundary. The open work is on the seams between boundaries, and that work is governance.
- **Identity is the first design decision, not the last.** Delegate, don't impersonate. `sub` is the human, `act` is the agent, scoped per action. Design for dual identity now; the RFCs are already here.
- **Policy belongs in code at the tool call.** If the agent's reasoning is the enforcement point, there is no enforcement. A Cedar or OPA gate the agent cannot edit is the mechanism.
- **Name the human.** Every agent needs an owner who is on call, and every consequential action needs a record and an interrupt. Good intention won't work here; mechanism does.

The uncomfortable part is that almost none of this is new. Token exchange is from 2020, PKI is older than most of the engineers using it, and "least privilege" predates the word "agent." The multi-party agentic system that works will be the one that reaches for those boring mechanisms first, and saves the model for the part only a model can do.

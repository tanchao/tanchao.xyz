---
title: "Open weights dissolve ZDR. They do not replace EFS"
description: "Self-hosting open weights removes the vendor asking for custody, and hands you the detection job both labs built EFS and Private Safety Processing to keep. A map of what OSS actually ships, where hosted OSS is weaker than it looks, and the one place open weights are strictly ahead: attestation."
tldr: "The EFS/PSP dilemma is a closed-weights problem. Download the weights and there is no vendor to negotiate with, but the vendor's detector leaves with the vendor. Per-interaction guard models are free and mediocre. Session tracing works on a GenAI semantic convention that has not shipped 1.0. Cross-session, cross-account correlation — the thing both labs said they needed stored state for — has no production OSS analog. Hosted Llama/Qwen endpoints often sign ZDR because they take no detection responsibility. The open opportunity is a SIEM for agents over your own traces, plus attestation-gated key release on code you control."
date: 2026-09-07
tags: ["ai", "security", "governance", "privacy", "open-source"]
draft: false
faq:
  - q: "Does self-hosting open weights solve the EFS / Private Safety Processing problem?"
    a: "It dissolves the procurement conflict, not the safety job. There is no third party holding your traffic, so there is no ZDR carve-out to negotiate. You inherit the obligation: correlate misuse across sessions and accounts yourself, because the vendor detector is gone."
  - q: "Are open-source guard models good enough for frontier misuse detection?"
    a: "They are good enough for per-prompt content classification, which is the layer both labs called insufficient. On an ICLR 2026 workshop bench of 14 models (arXiv:2605.28830), ShieldGemma's 82.2% precision still missed 54.5% of unsafe content, and gpt-oss-safeguard missed 75.1%. Qwen Guard 4B led recall at 84.0%."
  - q: "Why isn't hosted Llama or Qwen with ZDR a better deal?"
    a: "Together, Fireworks, Groq, and Bedrock/Vertex serving open weights will often sign ZDR without a frontier-model carve-out. That is privacy by omission. They take no responsibility for misuse detection on models they did not train, so you get no detector and no architecture that keeps one."
  - q: "What is the actual OSS gap versus EFS?"
    a: "Cross-session and cross-account correlation. Gateways can emit OTel traces for a single agent run. Nothing production-grade joins those traces across users, accounts, and days with a published threat model and detection rates. If you want what EFS claims to deliver, you write SIEM rules over your own agent traces."
  - q: "Where is open source strictly ahead of Anthropic and OpenAI?"
    a: "Verifiability. Both labs claim personnel cannot see content and have not published an attestation design. On open weights you control the measured binary. GPU TEEs plus attestation-gated key release can make 'we do not read it' checkable. Apple's Private Cloud Compute is the published reference: wrap the payload key only to nodes whose measurements match a public transparency log."
  - q: "Will there ever be an open-source EFS?"
    a: "Not in the category both vendors defined. Provider-side monitoring requires a provider in the loop. Safety tuning is removable from open weights, and there is no callback. OSS assigns accountability differently: the deployer is both the monitored party and the monitor."
  - q: "What should an enterprise build or buy in this gap?"
    a: "A SIEM for agents: ingest GenAI traces, join on identity and session across days, encode a named threat model, publish detection rates, and route flags to the customer's own reviewers. That is the empty layer. Do not confuse it with another Llama Guard deploy."
---

The [EFS / Private Safety Processing problem](/posts/2026/09/05/splitting-custody-from-detection/) exists because a third party holds your traffic. Download the weights and run them yourself and the dilemma dissolves. There is no vendor asking for custody, so there is nothing to negotiate.

What you inherit is not a solution. It is the obligation. The vendor's detection capability goes away with the vendor.

Read EFS in that light. Anthropic is emulating the open-weight trust posture — your bucket, your keys, your reviewer — while keeping the weights and keeping the detector. "The person doing that review needs to be one of their own" is what self-hosting already gives you for free.

## The closed-weights problem, restated

Frontier misuse detection needs stored state so a detector can join activity across sessions and accounts. Zero data retention is a promise of no stored state. That collision only happens when someone else runs the model.

Self-hosting changes the parties, not the physics. You still need a rolling window if you believe the labs' threat model. The window now lives in your SIEM instead of their bucket. Nobody is asking you to waive a DPA to put it there.

That is a real procurement win. Treat it as one, and then look at what you actually have to operate.

## Three layers, very different maturity

**Per-interaction classification is commodity.** Llama Guard 4 12B, Qwen3Guard (0.6B / 4B / 8B, generative and streaming), Granite Guardian 3.3 8B, ShieldGemma, WildGuard 7B, Nemotron Safety Guard, and gpt-oss-safeguard are all open weights. You can run them next to the serving stack.

Look at recall before calling this solved. A 2026 ICLR workshop paper evaluated 14 guard models on 79,331 samples across eight NIST AI RMF safety categories ([arXiv:2605.28830](https://arxiv.org/abs/2605.28830)). ShieldGemma hits the highest precision at 82.2% and misses 54.5% of unsafe content. gpt-oss-safeguard misses 75.1%. Qwen Guard 4B leads recall at 84.0%. Model size does not predict detection. Conservative models — high precision, low recall — are the dangerous ones if your job is not to miss harm.

Do not treat a leaderboard winner as a complete detector. IBM's Granite family is built for jailbreak, tool-call hallucination, and RAG groundedness, which Llama Guard's content taxonomy does not cover the same way ([Granite Guardian](https://www.ibm.com/granite/docs/models/guardian)). WildGuard is often picked when over-blocking on benign traffic is the pain. Whether those two should sit in an ensemble is a measurement on *your* traffic, not a result from the ICLR bench. That bench is content-safety recall, not injection recall.

More important: this is exactly the layer OpenAI said was insufficient. "Existing ZDR-compatible safety systems evaluate each interaction individually," and serious risks "may only become visible across multiple interactions" ([OpenAI, Aug 19 2026](https://openai.com/index/offering-zero-data-retention-for-frontier-models/)). The OSS stack is strong where both vendors said the problem is not.

**Session-level observability is usable on an unstable substrate.** A gateway emits telemetry, a collector fans it out, a backend groups spans. [agentgateway](https://agentgateway.dev/docs/standalone/latest/integrations/observability/opentelemetry/) emits OpenTelemetry traces per LLM request following the GenAI semantic conventions, and traces MCP traffic too. Langfuse, Phoenix, and MLflow all ingest OTLP. Session-ID grouping gives you a multi-turn agent run as one trace.

The caveat is the schema. The GenAI conventions moved into their own repository in June 2026 ([open-telemetry/semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai), via [PR #3696](https://github.com/open-telemetry/semantic-conventions/pull/3696)). They remain marked Development. The dedicated repo had no official tagged release as of late summer 2026. You are building correlation logic on a schema that will churn. Pin a commit. Do not treat `gen_ai.*` as a storage contract.

**Cross-session, cross-account correlation has no OSS analog.** This is the actual gap, and there is no project to point at.

Research-stage pieces exist. Trajectory-level guards try to read a full agent run for instruction hijacking and tool misuse — StepGuard reports 83.0 trajectory-level accuracy on its own bench ([zheng977/StepGuard](https://github.com/zheng977/StepGuard)), AgentDoG frames online trajectory diagnosis, Sponsio compiles temporal contracts at the tool-call boundary. Phoenix can cluster embeddings and flag drift. None of that is a production detector with a threat model that matches EFS: stolen credentials reused across accounts, offensive-capability work split across sessions, a pattern that only appears when you join identity over days.

If you want what EFS claims to deliver, you write SIEM correlation rules over your own agent traces.

The mechanism layer is dense and free. The trajectory-invariant layer is empty.

## Hosted OSS is worse, not better

Together, Fireworks, Groq, and Bedrock/Vertex serving Llama or Qwen will often sign ZDR without a frontier-model carve-out. That looks like a win. It is the absence of a guarantee, not a stronger one.

They offer ZDR because they take no responsibility for misuse detection on models they did not train. Bedrock is explicit that some models require retention for safety, and that `data_retention_mode: none` simply refuses those models ([AWS Bedrock data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)). Open-weight endpoints that stay in `none` are the ones nobody is watching.

You get privacy by omission, not by architecture, and no detection at all. If your CISO quote in the Anthropic post was "we keep custody, they keep detection," a Fireworks ZDR toggle gives you the first half and deletes the second.

## Where OSS is genuinely ahead: attestation

Both Anthropic and OpenAI make access-control claims. Personnel do not see content. Neither published an attestation design. That gap is closable, and it is closable more easily on open weights because you control the code being measured.

NVIDIA H100 confidential computing shipped in preview in July 2023 and went GA for single-GPU passthrough with CUDA 12.4 in 2024 ([NVIDIA](https://developer.nvidia.com/blog/announcing-confidential-computing-general-access-on-nvidia-h100-tensor-core-gpus/)). CC mode produces a GPU-specific attestation report signed by the GPU's security processor. Blackwell extends the story with hardware NVLink encryption so multi-GPU traffic stays inside the confidential boundary ([NVIDIA, 2026](https://developer.nvidia.com/blog/hardware-rooted-ai-security-that-wont-slow-you-down/)).

AMD MI300X takes a different path. The GPU sits inside the host VM's SEV-SNP envelope. Attestation covers the whole VM, not GPU firmware and VRAM encryption state specifically. That distinction matters if an auditor asked for GPU-level attestation.

The pattern that closes the loop is attestation-gated key release. NVIDIA's Remote Attestation Service checks a signed GPU report plus CPU TEE measurements against a reference integrity manifest, and only then are secrets such as model decryption keys deployed into the confidential VM. Hardware proves its state before it gets keys.

Apple's Private Cloud Compute is the published reference everyone benchmarks against. A user device wraps the request payload key only to nodes whose attested measurements match a software release in a public transparency log ([Apple](https://security.apple.com/documentation/private-cloud-compute/verifiabletransparency)). That is "we do not read it" as a mechanism, not as an org chart.

Cost: NVIDIA's own Blackwell numbers for Qwen 3.5 397B on HGX B300 put steady-state CC overhead roughly in the −1% to −8% range, marketed as "up to 98%" of non-CC performance ([NVIDIA](https://developer.nvidia.com/blog/hardware-rooted-ai-security-that-wont-slow-you-down/)). Independent Hopper work found the tax in CPU–GPU I/O via bounce buffers, not in the matmul ([arXiv:2409.03992](https://arxiv.org/abs/2409.03992)). Tinfoil's later Blackwell runs show that a CC-naive engine can turn that into ~30% in compute-bound regimes ([Tinfoil](https://tinfoil.sh/blog/2026-06-23-confidential-computing-overhead)). The marketing number assumes a CC-aware stack and ignores cold-start attestation. Phala and Spheron quote the low end and both have token or decentralized-compute incentives. Discount accordingly.

You can only attest code you control. That is why this advantage does not transfer to a closed API, even one that stores logs in your S3 bucket.

## There will never be an OSS EFS

Provider-side misuse monitoring is impossible for weights you have downloaded. Safety tuning is removable. There is no callback. The category requires a provider in the loop.

What OSS offers is a different accountability assignment. The deployer becomes the monitored party and the monitor. Every enterprise CISO quote in Anthropic's post is asking for exactly that arrangement, while declining to give up the closed model that made the negotiation necessary.

That is not hypocrisy. Frontier quality and open weights are still not the same product. It is a reminder that EFS is the closed-model emulation of a posture self-hosting already had, minus the detector you now have to build.

## The opportunity: a SIEM for agents

The empty layer is not another guard model. It is correlation with a threat model.

The shape is familiar from network security. Packet filters are commodity. IDS signatures for a single flow are commodity. The product that paid for itself was the SIEM: join identity across days, encode what "bad" looks like as a campaign rather than a packet, publish detection rates, and page a human who is allowed to look.

For agents that product does not exist as OSS.

What it would have to do:

- **Ingest** GenAI and MCP traces (OTLP), plus identity: user, service account, API key, tenant.
- **Join** across sessions and accounts over a rolling window measured in days, not one chat thread.
- **Name a threat model** that matches what the labs actually argued for: stolen credentials reused across keys, offensive-capability work split into benign-looking turns, agents that keep going after stop.
- **Publish detection rates** on a held-out set, including false positives on ordinary coding and RAG traffic. Guard-model papers that hide recall are the failure mode to avoid.
- **Route flags to the customer's reviewers.** Custody stays local. Detection is yours, or a vendor running *your* rules against *your* traces.

Until that exists, "we self-host, therefore we are safe" is the hosted-OSS mistake with extra GPUs. You have custody. You do not have EFS.

## What I take from this

- **Self-hosting kills the ZDR fight and creates the detection job.** EFS is the closed-model version of a posture you already have on open weights, plus a detector you do not.
- **Guard models are the wrong layer to celebrate.** Best-in-class precision still misses more than half the unsafe content on a public bench. They classify a prompt. EFS claims to classify a campaign.
- **Hosted open weights with ZDR are not a third way.** They are ZDR because nobody is watching.
- **Attestation is the one place OSS is strictly ahead.** GPU TEEs plus gated key release, on a binary you can measure, is how "personnel cannot read it" becomes checkable. Closed APIs have not published that design.
- **The build is a SIEM, not a classifier.** Mechanism is dense and free. Trajectory-invariant detection is empty. That is the opportunity.

Good intention won't work here; mechanism does. A Llama Guard sidecar is intention with a GPU. The mechanism is join keys, a named threat model, and a reviewer who is actually yours.

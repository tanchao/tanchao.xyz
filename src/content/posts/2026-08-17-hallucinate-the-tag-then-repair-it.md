---
title: "Hallucinate the tag, then repair it: measuring the baselines"
description: "Doug Turnbull's trick invents a label, then maps it to your real vocabulary with embeddings. I ran it on 34 of my own posts against two baselines nobody had measured."
tldr: "Ask a cheap model to invent a category, embed the invention, snap it to the nearest real category. On my 34 tagged posts against my own 51-tag vocabulary it scored 70.6% top-1 versus 64.7% for just embedding the post and 58.8% for always guessing 'engineering' — but on a paired test none of those gaps is distinguishable. On the specific tags that carry information, shipping the whole vocabulary to the model beat the trick 10 disagreements to 1 (p=0.012), and the trick tied the arm with no LLM in it at all (p=1.0). At this vocabulary size, send the vocabulary."
date: 2026-08-17
tags: ["ai", "llm", "engineering", "embeddings", "classification", "evals"]
draft: true
faq:
  - q: "What is hallucinate-then-map classification?"
    a: "You ask an LLM to invent a plausible category for an item without showing it your real category list, embed the invented string, and return the nearest real category by vector similarity. The invented label is thrown away; only its position in embedding space is used."
  - q: "How is it different from HyDE?"
    a: "Same generate-embed-retrieve shape, different index. HyDE generates a hypothetical document and searches real documents. This generates a hypothetical label and searches a real label vocabulary."
  - q: "Why not just embed the document and match it to the label embeddings?"
    a: "That is the obvious baseline, and five separate commenters asked it on the Hacker News thread. On my corpus it scored 64.7% top-1 against 70.6% for hallucinate-then-map, a gap of two posts out of 34 that does not survive a paired test. Restricted to specific tags the two arms tie exactly (p=1.0), so the extra model call bought nothing."
  - q: "Does the technique need a large model?"
    a: "Its cost argument depends on a small one. Doug Turnbull's claim is that you can hand the invention step to a cheap model because you no longer ship the vocabulary in the prompt. My run used a large model, so it tests the accuracy claim and leaves the cost claim untested."
  - q: "When is it worth using?"
    a: "When the vocabulary genuinely cannot fit in a prompt, meaning hundreds to thousands of labels, and after you have measured the embed-the-document baseline, since that costs one embedding call and no LLM call."
  - q: "Does a bigger vocabulary change the answer?"
    a: "Probably. My 51 tags fit in a prompt easily, which is why the vocabulary-in-prompt arm is hard to beat here. The technique targets vocabularies where that arm is unavailable, and I have not measured that regime."
---

Doug Turnbull published a tagging trick worth understanding: rather than sending your category list to the model, ask the model to invent a category, then snap the invention onto your real vocabulary with embeddings. I ran it on 34 of my own posts against two baselines nobody had measured. It leads on raw hit rate, that lead does not survive a paired test, and on the tags that carry information it ties the baseline that uses no LLM at all.

## The problem: a vocabulary too big to send

The setup, in [Turnbull's words](https://softwaredoug.com/blog/2026/08/10/hypothetical-classifications): "Using LLMs to classify products, search queries, etc is by now boring. Yet it can still be difficult to constrains the LLM's output to the legal vocabulary of brands, colors, categories, etc your system allows." His example is the Wayfair WANDS dataset, where a query like `wood coffee table` has to land in one of hundreds of categories.

He is explicit that the standard answer works. Pass the category list as a Pydantic `Literal` to a structured-output call and the model cannot return anything illegal: "This works." The objection is cost and size. You need a model big enough to handle a huge enum, and there is an [upper limit on how much schema you can send](https://developers.openai.com/api/docs/guides/structured-outputs).

Simon Willison [picked it up](https://simonwillison.net/2026/Aug/14/dont-classify-hallucinate) with a sharper version of the problem: "My blog has 1,856 tags - likely too many to feed to an LLM in one go." That is the case where the boring answer runs out.

## The technique: invent a label, then snap it to the real one

Four steps, from his post:

1. Prompt a cheap model for a category, without showing it the real list. His prompt says "create novel, never seen before, furniture, home goods, or hardware classification that best fit a search query", primed with six example category strings so the model matches the shape.
2. The model returns something that does not exist. For `brown coffee table` it produced `Furniture / Living Room / Tables / Coffee`.
3. Embed every real category once, offline. He uses MiniLM.
4. Embed the invented string, "dot product the fake embedding into the real ones to find the most similar," and return that. Here it resolves to `Furniture / Living Room Furniture / Coffee Tables & End Tables / Coffee Tables`, which is the right answer.

His payoff: "You can give these hallucination tasks to dumb / cheap LLMs. And you don't need to ship the schema over to the LLM every time." He links [a notebook](https://colab.research.google.com/drive/1ljk72SBRuqWIijuEusCnDbhG1WAfZFcC) and [the utility code](https://github.com/softwaredoug/cheat-at-search/blob/main/cheat_at_search/enrich/vocabulary.py).

Three things the post does not contain, which is why I ran it myself: no quantitative evaluation of any kind, one worked example, and no discussion of a similarity threshold or what to do when nothing is close.

## It is HyDE with the index swapped

The shape is [HyDE](https://arxiv.org/abs/2212.10496) (Gao, Ma, Lin, Callan; ACL 2023, [2023.acl-long.99](https://aclanthology.org/2023.acl-long.99/)). HyDE feeds a query to a generative model, instructs it to "write a document that answers the question," embeds that hypothetical document, and searches the real corpus with it. The authors are direct about the obvious problem: the generated document "is not real, can contain factual errors," and their argument is that the encoder acts as "a lossy compressor, where the extra (hallucinated) details are filtered out from the embedding."

Swap the index and you get Turnbull's trick. Generate a hypothetical *label*, search the real *label vocabulary*. Same three steps, different thing being retrieved.

That places it in a family with two other ways to keep a model inside a legal vocabulary:

- **Constrain the generation.** [GENRE](https://arxiv.org/abs/2010.00904) (De Cao et al., ICLR 2021) generates entity names with constrained beam search over a prefix tree, so the output is a valid vocabulary entry by construction. The gate is structural.
- **Repair after the fact.** [SapBERT](https://arxiv.org/abs/2010.11784) (Liu et al., NAACL 2021) embeds a mention and links it to the nearest concept name in a controlled vocabulary. A [2025 subject-heading system](https://arxiv.org/abs/2507.22913) (Liu et al., ASIST 2025) makes the sequence explicit: LLMs "often over-generate and hallucinate," so it uses embedding models to "post-edit the predicted terms with actual LCSH terms to mitigate hallucinations." The gate is statistical.

Turnbull's version is the statistical gate with the mention step replaced by an invention step. Worth naming, because a structural gate can be audited by reading the prefix tree and a statistical one can only be audited by measuring it.

## What the Hacker News thread asked, and nobody answered with data

Turnbull [posted it himself](https://news.ycombinator.com/item?id=49249523) and it drew 245 points and 107 comments. The most common response was one question, asked independently by at least five people: why not embed the document and match it to the label embeddings directly, with no LLM in the loop at all?

[Majromax](https://news.ycombinator.com/item?id=49298600) put it most precisely: "Isn't this begging the question that the hallucinated classification will be more selective with respect to the real schema than the query itself? What would the dot product of &lt;E(search query), E(schema)&gt; have given?"

Turnbull [conceded](https://news.ycombinator.com/item?id=49299345) rather than defended: "Yes absolutely that's another good trick." He offered no measurement either way. The only quality claim anywhere in the discussion is his own aside that with "a Nano model" the technique is ["a tad worse than shipping a vocabulary to a larger OpenAI model"](https://news.ycombinator.com/item?id=49297917).

Two comments supply what the post does not. [memjay](https://news.ycombinator.com/item?id=49299013) reports from production: "We have this running in production. Can get pretty expensive and slow. We are trying to replace this with cheaper and faster methods that don't hammer our LLM and elastic search endpoints as much." And [thatjoeoverthr](https://news.ycombinator.com/item?id=49298009) names the thing that decides it: "if accuracy matters, you can't rely on embedding sort to get a closet match. With a real test set they usually don't hold up under scrutiny."

So: a technique with no published numbers, an author who concedes the simpler alternative, and one production user trying to get off it. That is a gap worth filling with a test set.

## My setup: 34 posts, 51 tags, MiniLM

I have the same problem Simon has, three orders of magnitude smaller. This blog has 34 published posts with hand-assigned tags and 51 distinct tags across them, averaging 4.5 tags per post. My own tags are the ground truth. A prediction counts as a hit if it appears in the list I wrote by hand.

Four arms, each predicting one tag per post:

- **Baseline.** Always guess `engineering`, the most common tag. This exists because it is very easy to look good on this task.
- **A, vocabulary-in-prompt.** The model sees all 51 legal tags and picks one. The option Turnbull's trick replaces.
- **B, embed-the-document.** No LLM at all. Embed the post, embed each tag name, take the nearest by cosine. The question the thread kept asking.
- **C, hallucinate-then-map.** The model invents a tag having never seen the vocabulary, then MiniLM snaps the invention to the nearest real tag.

Embeddings are `all-MiniLM-L6-v2`, matching Turnbull's choice. Arms A and C ran as separate agents with fresh context so neither could see my tags. Keep one number in mind throughout: 34 posts is small enough that a six-point difference is two posts.

## Results: the loose metric ranks nothing

Top-1 accuracy, where a hit means the predicted tag appears in the list I hand-wrote. "Specific tags" restricts the ground truth to tags I used on five posts or fewer, because hitting `engineering` on an engineering blog is not evidence that anything works.

| Arm | Top-1, any tag | Top-1, specific tags | LLM calls per post |
|---|---|---|---|
| Baseline: always `engineering` | 58.8% (20/34) | — | 0 |
| B, embed-the-document | 64.7% (22/34) | 37.5% (12/32) | 0 |
| C, hallucinate-then-map | 70.6% (24/34) | 34.4% (11/32) | 1 |
| A, vocabulary-in-prompt | 76.5% (26/34) | 62.5% (20/32) | 1 |

One thing this table cannot tell you is whether the trick is cheap, which is its whole selling point. Turnbull's argument is that you can hand invention to a small model precisely because the vocabulary never enters the prompt. My invention step ran on a large model. So every number in the C row tests his accuracy claim and leaves his cost claim alone.

Read the ordering and you would conclude the trick beats embedding the document by six points. Do not. All four arms ran on the same 34 posts, so the honest test is a paired one: count only the posts where two arms disagree, then ask whether the split is lopsided enough to mean anything. On the any-tag metric, nothing is:

- C over B: 6 wins to 4 on 10 disagreements, p = 0.75
- C over the baseline: 8 to 4 on 12, p = 0.39
- B over the baseline: 9 to 7 on 16, p = 0.80
- A over C: 6 to 4 on 10, p = 0.75

Four arms, no distinguishable difference, including a constant that ignores the post entirely. That is what a 34-item test set buys you, and it is the first thing I would want to know before adopting anything on the strength of one worked example.

The specific-tag metric is where the arms separate:

- A over C: **10 wins to 1** on 11 disagreements, p = 0.012
- A over B: 11 to 3 on 14, p = 0.057
- C over B: 4 to 5 on 9, p = 1.00

Two findings there. Sending the whole vocabulary beats hallucinate-then-map on the tags that carry information. And the trick is indistinguishable from the arm with no LLM in it at all. That is exactly what the thread kept asking, and exactly what one worked example cannot answer.

Honesty about that p = 0.012: it is one of seven paired tests I ran, and a strict multiple-comparison correction puts the bar near 0.007, which it does not clear. I report it as the only comparison in this experiment that separated at all, not as a number I would defend to three decimals.

Its lead on the loose metric came from broad tags. Snapping a vague invention to `ai` or `engineering` scores a hit on a blog where most posts carry one of those.

## Feeding it more text made it worse

Embedding the title and description beat embedding the title, description, and 1,200 characters of body: 64.7% against 61.8%, and 37.5% against 31.2% on specific tags. More input, worse answer.

The sentence-transformers docs explain why. [Symmetric and asymmetric search want different models](https://sbert.net/examples/sentence_transformer/applications/semantic-search/README.html): symmetric is where "your query and the entries in your corpus are of about the same length," asymmetric is where "you usually have a short query... and you want to find a longer paragraph." A one-word tag against a full post is asymmetric, and `all-MiniLM-L6-v2` is a symmetric model. Matching a bare tag name is the weak configuration in general — the OpenAI cookbook gets 87% from bare labels like `negative` and 95% from ["An Amazon review with a negative sentiment"](https://developers.openai.com/cookbook/examples/zero-shot_classification_with_embeddings) on the same task. My tags are bare names, so arm B is running in that weaker mode, and giving it a tag description per tag is the first thing I would try before reaching for a model call.

(Rendering tags as words rather than slugs, `context engineering` for `context-engineering`, was worth nothing on top-1 and one post on top-3.)

## The repair step cannot say "I don't know"

The failures are more instructive than the score. Three from my run:

| Invented | Snapped to | My tags |
|---|---|---|
| `best-practices` | `compliance` | career, engineering, api, performance |
| `onboarding` | `iac` | career, software, snowflake |
| `ec2-setup` | `aws` | thur |

When the invention is vague, the nearest-neighbour step still returns something, with no signal that it is guessing. `best-practices` is not a topic, so its embedding lands wherever the vocabulary happens to be dense, and `compliance` comes back looking exactly as confident as a correct answer. Mean top-1 cosine across my posts was 0.426 and the minimum was 0.264. There is no natural cutoff anywhere in that range, and Turnbull's post never mentions one.

This is the part I would not ship without a gate. I wrote in a note recently that I cannot hand my final gates to a black box, and this is the concrete version of that: constrained decoding fails loudly by refusing to emit an illegal token, while embedding repair fails silently by emitting a legal one. Both keep you inside the vocabulary. Only one tells you when it had no idea.

Only 2 of 34 invented tags were already legal strings, so the repair step is doing nearly all the work of landing in the vocabulary.

There is also a limit on what invention can reach. [kgeist](https://news.ycombinator.com/item?id=49299735) put it well in the thread: the trick "only works for common knowledge that's already in the LLM. If the target document contains very niche or private information, then the hallucinated answer's embedding can be even farther away than the query's." My `thur` tag is that case in miniature. It is short for Thursday, a 2016 side project, and it appears on exactly one post. For that post the model invented `ec2-setup`, which honestly describes the content — the notes are about reaching an EC2 box. I had filed it under the project it belonged to. No amount of embedding repair bridges that, because the information is not in the text or in the model. It is in my head.

## The vocabulary was the real problem

Building the test set taught me more than running it. My 51 tags include `structured-output` and `structured-outputs`, `devtools` and `developer-tools`, `tooling` and `tool-use`, plus `thur`, a tag that means something only to me. No matching method fixes that. Any of these arms can be "wrong" by picking the synonym I did not use that day, and my ground truth is inconsistent by construction.

Turnbull's framing treats the vocabulary as fixed and the classifier as the variable. On a corpus this size the payoff is the other way around: merge the synonyms first and every arm improves for free, including the one that costs nothing to run.

## The answer key leaked, and it was worth fifteen points

My first pass fed each arm a JSON file that still carried the post's `tags` field, so the arm meant to be blind had my answers sitting in its input. The agent reported that it ignored them. That is not verifiable, so I rebuilt the input without the field and reran every arm.

Vocabulary-in-prompt scored 91.2% with the answer key in its input and 76.5% without it. The two hallucinate-then-map runs, same instructions, agreed on only 20 of 34 invented tags. Trusting the first pass would have published a number inflated by fifteen points, and nothing in the output looked wrong.

That is the argument for a held-out set even on a 34-item toy experiment. The leak was invisible in the results and obvious in the input.

## When I would use it

At 51 tags, send the vocabulary. It is the cheapest thing to build, the easiest to audit, and it won the only comparison here that separated at all.

The technique earns a look when the vocabulary genuinely will not fit — Simon's 1,856 tags, Turnbull's hundreds of categories, an ICD code set. Even then, measure embed-the-document first. It costs one embedding call and no LLM call, and on my corpus it tied the trick on specific tags, 5 wins to 4 across nine disagreements. If that holds at your vocabulary size, you have saved a model call per item and kept a system you can explain.

Whichever arm you pick, keep a similarity threshold and a queue for whatever falls below it. A classifier that cannot abstain will hand you `compliance` for a post about performance work and look confident doing it.

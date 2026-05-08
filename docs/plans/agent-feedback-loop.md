# Agent Feedback Loop

Status: **done**
Created: 2026-05-06
Shipped: 2026-05-07

## Shipped — divergences from plan

This feature is fully implemented. The shipped version differs from the plan in the following ways:

| Plan | Shipped |
|------|---------|
| Form on `/about/` | Dedicated page at `/feedback/` (`src/pages/feedback.astro`) |
| Workflow file `claude-code.yml` | `claude-agent.yml` (`.github/workflows/claude-agent.yml`) |
| Trigger: `issues: [labeled]` only | Trigger: `issues: [opened, labeled]` + `issue_comment: [created]` |
| `model`, `timeout_minutes` action inputs | `claude_args: "--allowed-tools bash edit read write --system-prompt-file AGENTS.md --max-turns 20"` |
| Redirect to `/about/?thanks=1` on submit | Handled in `feedback.astro` client-side |

Do not re-implement any part of this. To modify the workflow or Pages Function, edit the actual files — but note that `claude-agent.yml` and `functions/api/feedback.ts` are **off-limits for agents** (see AGENTS.md constraints).

## Goal

Build a closed loop: visitor leaves feedback on the site → GitHub issue is created → Claude Code Action picks it up → opens a PR → you review and merge from your phone → Cloudflare Pages deploys.

## Design decisions

- **Manual approval only** — no auto-merge. You review every PR before merging.
- **Feedback loop only** — no "find something to do" autonomous routine (for now).
- **Claude Code Action** (`anthropics/claude-code-action`) as the agent — mature, GitHub-native.
- **Cloudflare Turnstile** for spam protection on the feedback form.

## Architecture

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Visitor     │     │  CF Pages Function │     │  GitHub Issues   │
│  fills form  │────▶│  /api/feedback     │────▶│  (labeled:       │
│  on /about   │     │  + Turnstile check │     │   agent-task)    │
└──────────────┘     └────────────────────┘     └────────┬─────────┘
                                                         │
                                                         ▼
┌──────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  CF Pages    │     │  You review &      │     │  Claude Code     │
│  auto-deploy │◀────│  merge PR          │◀────│  Action opens PR │
└──────────────┘     └────────────────────┘     └──────────────────┘
```

## Components

### 1. Feedback form (frontend)

Location: Add to `/about/` page (or create a dedicated `/feedback/` page).

```html
<form action="/api/feedback" method="POST">
  <textarea name="message" required placeholder="What would you like to see?"></textarea>
  <!-- Turnstile widget renders here -->
  <div class="cf-turnstile" data-sitekey="<TURNSTILE_SITE_KEY>"></div>
  <button type="submit">Send feedback</button>
</form>
```

Keep it minimal — just a text area. No email required (low friction).

### 2. Cloudflare Pages Function (backend)

Location: `functions/api/feedback.ts`

Responsibilities:
1. Validate Turnstile token (reject bots)
2. Rate limit (by IP, max 3/hour via CF KV or in-memory)
3. Create GitHub issue via REST API
4. Return success/error response

```typescript
// Pseudocode
export async function onRequestPost({ request, env }) {
  const { message, "cf-turnstile-response": token } = await parseForm(request);

  // 1. Verify Turnstile
  const valid = await verifyTurnstile(token, env.TURNSTILE_SECRET);
  if (!valid) return new Response("Bot detected", { status: 403 });

  // 2. Rate limit
  // (use CF KV or simple IP check)

  // 3. Create GitHub issue
  await fetch("https://api.github.com/repos/supertan/tanchao.xyz/issues", {
    method: "POST",
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `[Feedback] ${message.slice(0, 60)}...`,
      body: `## Visitor feedback\n\n${message}\n\n---\n_Submitted via site feedback form_`,
      labels: ["agent-task", "feedback"],
    }),
  });

  return Response.redirect("/about/?thanks=1", 303);
}
```

### 3. Claude Code Action (GitHub workflow)

File: `.github/workflows/claude-code.yml`

```yaml
name: Claude Code Action
on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]

jobs:
  claude:
    if: |
      (github.event_name == 'issues' && contains(github.event.issue.labels.*.name, 'agent-task'))
      || (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          model: claude-sonnet-4-20250514
          max_turns: 20
          timeout_minutes: 30
```

The action reads `AGENTS.md` automatically for project context.

### 4. Existing context files (already in place)

- `AGENTS.md` — full project guide for the agent
- `CLAUDE.md` — pointer to AGENTS.md
- Content schemas, build commands, constraints — all documented

## Secrets required

| Secret | Where | Purpose |
|--------|-------|---------|
| `TURNSTILE_SITE_KEY` | Frontend HTML (public) | Turnstile widget |
| `TURNSTILE_SECRET` | CF Pages env var | Server-side Turnstile verification |
| `GITHUB_TOKEN` (PAT) | CF Pages env var | Create issues from Pages Function |
| `ANTHROPIC_API_KEY` | GitHub repo secret | Claude Code Action API calls |

### GitHub PAT scope

Fine-grained PAT with minimal permissions:
- Repository: `supertan/tanchao.xyz`
- Permissions: `issues:write` only

## Cost considerations

- **Cloudflare Turnstile**: Free
- **Cloudflare Pages Functions**: Free tier (100K requests/day)
- **Claude API via Code Action**: ~$0.50-2.00 per issue (depends on complexity and turns)
- **Estimated monthly**: $5-20 assuming 10-40 feedback items/month that trigger the agent

## Safety guardrails

1. **No auto-merge** — you always review the PR
2. **CF Pages preview** — every PR gets a preview URL, visible on your phone
3. **Labeled issues only** — agent only triggers on `agent-task` label
4. **`max_turns: 20`** — caps runaway agent loops
5. **`timeout_minutes: 30`** — hard timeout
6. **AGENTS.md constraints** — agent reads "never force-push", "never delete posts", etc.
7. **Turnstile + rate limiting** — prevents spam flooding issues

## Implementation order

1. Set up Cloudflare Turnstile (get site key + secret from CF dashboard)
2. Create feedback form on `/about/` page
3. Create `functions/api/feedback.ts` Pages Function
4. Create fine-grained GitHub PAT, add to CF Pages env vars
5. Test end-to-end: submit form → issue appears in GitHub
6. Add `ANTHROPIC_API_KEY` to GitHub repo secrets
7. Create `.github/workflows/claude-code.yml`
8. Test: create a test issue with `agent-task` label → verify PR opens
9. Review and merge the test PR → verify CF Pages deploys

## Future extensions (not in scope now)

- **"Find something to do" routine** — cron-triggered agent that looks for small improvements
- **Auto-merge for content-only changes** — if PR only touches `src/content/`, auto-merge on CI green
- **Slack/Telegram notification** — ping you when a PR is ready for review
- **Cost dashboard** — track Anthropic API spend per issue

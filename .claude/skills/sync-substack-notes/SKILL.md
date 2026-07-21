---
name: sync-substack-notes
description: >-
  Pull the latest Substack Notes (@sprtn) into the blog's notes collection and open a PR.
  Use when the user says "sync substack", "pull my notes", "sync my substack notes",
  "import notes from substack", or wants to syndicate recent Substack activity to tanchao.xyz.
allowed-tools: Bash(npm run sync:substack:*), Bash(npm run check:content:*), Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr create:*), Read
---

You are syndicating the user's public **Substack Notes** (`@sprtn`) into the blog's `notes`
collection and opening a PR. The heavy lifting is done by the existing `scripts/sync-substack.ts`
(`npm run sync:substack`) — your job is to run it safely, review the output, validate, and hand off
a clean PR. Follow these steps exactly.

## 0. Why this is manual (read before running)

Substack sits behind Cloudflare bot management that blocks **data-center IPs** (VPNs, CI runners,
cloud shells). The nightly GitHub Action was removed for this reason and must **not** be re-added.
This only succeeds from a **residential IP** — the user's Mac on home Wi-Fi. The script hard-fails on
401/403 with that message; when you see it, stop and relay it.

## 1. Preflight

- Confirm you're in the Astro repo: `package.json` must contain a `sync:substack` script. If not,
  tell the user to `cd ~/workspace/supertan/tanchao.xyz` and re-run — this skill only works there.
- Check the current branch (`git branch --show-current`). **Never** commit or push on `main`
  (branch-protected; direct push is rejected). You'll branch in step 6.

## 2. Dry-run first

```
npm run sync:substack -- --dry-run
```

Report how many new notes *would* be imported.

- If **zero new**, stop: tell the user there's nothing new to sync.
- If the output is a **401/403 Cloudflare block**, stop: tell the user to run from home Wi-Fi (a
  residential IP), not a VPN or data-center connection. Do **not** retry blindly.

## 3. Real sync

```
npm run sync:substack
```

Capture the final summary line (`Imported N new note(s), skipped X existing, Y too short`).

## 4. Review

- `git status` to list the new `src/content/notes/substack-*.md` files.
- Read a handful of the new files and give the user a one-line-per-note summary (title + date).
- Flag anything that looks wrong: empty body, mangled ProseMirror→Markdown conversion, a title that's
  just a date. Do not edit synced files unless the user asks — the sync is idempotent and re-running
  won't overwrite them.

## 5. Validate

```
npm run check:content
```

If it fails, surface the error and **stop** — do not commit.

## 6. Branch, commit, push, PR

Respect the repo's PR workflow (see AGENTS.md §git): never push to `main`, never force-push, never
use a company git identity.

- **Branch.** If on `main`, create one: `git checkout -b chore/sync-substack-notes-<YYYY-MM-DD>`.
  If already on a working branch, **ask** whether to reuse it or branch off — don't assume.
- **Commit** only the notes (keep it atomic):
  ```
  git add src/content/notes/
  git commit -m "chore(notes): sync Substack notes"
  ```
  In the commit body, say what came in (count + date range) — the *why*, not the *what*.
- **Push:** `git push -u origin HEAD`.
- **PR:** `gh pr create` (open, not draft). Body: a short list of the imported note titles.
- Print the PR URL.

## 7. Hand off — do NOT merge

- Stop at an open PR. **Deploy happens on merge to `main`** — Cloudflare Pages auto-builds then.
- Tell the user: review the PR, merge when happy, and the notes go live at `tanchao.xyz/notes/`.

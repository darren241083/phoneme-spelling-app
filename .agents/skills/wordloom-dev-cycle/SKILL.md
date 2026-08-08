---
name: wordloom-dev-cycle
description: Use for Wordloom development planning, implementation, review, bug fixing, release readiness, "Ship it" release workflow, checkpoint updates, or coordinating Explorer, Product Guardrail, Builder, Tester, Reviewer, QA, and Bug Investigator agents in this repository.
---

# Wordloom Dev Cycle

Use this skill to run the standard Wordloom development workflow.

## Start

1. Run `git status --short --untracked-files=all`.
2. Read the root `AGENTS.md`.
3. Identify branch, worktree, dirty files, parked files, and protected files.
4. Confirm whether the request is plan-only, approved build work, failure diagnosis, QA, or `Ship it`.

## Normal Build Flow

1. Use `explorer-architect` and `product-guardrail` in parallel when planning benefits from both architecture and product checks. Product Guardrail review is mandatory for teacher-facing, pupil-facing, assignment, analytics, automation, public-claim, compliance, accessibility, or navigation changes.
2. Consolidate a small plan and stop for Darren's plan approval.
3. After plan approval, use `builder` for implementation inside the approved scope.
4. Use `tester` and `reviewer` in parallel after implementation when useful.
5. Let Builder fix issues found by tests or review when the fix remains clearly inside the approved scope.
6. Use `qa-smoke-tester` for meaningful user journeys when the change affects UI, auth, assignment, analytics, pupil flow, or other end-to-end behavior.
7. Report readiness and stop for review.

Plan approval covers in-scope edits, tests, routine agent use, and routine in-scope fixes. Do not ask per file edit or per test command.

Stop for new approval if the work needs to exceed scope, touch `js/config.js`, handle secrets, install dependencies, change migrations, alter production, or use destructive operations.

## Failure Flow

1. Send failure evidence to `bug-investigator`.
2. Get root-cause diagnosis before editing.
3. Use Builder for the smallest in-scope fix.
4. Rerun targeted tests.
5. Use Reviewer or QA again if risk remains.

## Ship It Flow

Only run this when Darren explicitly says `Ship it`.

1. Run final targeted checks.
2. Inspect full diff.
3. Update checkpoint or project-state documentation concisely.
4. Confirm branch, upstream/remote, and whether push can trigger production deployment.
5. Stage narrowly by explicit paths. Never use `git add .`.
6. Inspect staged diff.
7. Commit with a concise message.
8. Push only if the branch/remote is expected and the push does not itself deploy production.

`Ship it` authorizes the routine staging, commit, push, and checkpoint-update sequence. Pause if anything unexpected appears.
Stop before pushing if on an unexpected branch, if upstream/remote is unclear, or if pushing would deploy production.

## Separate Approval Required

Always ask before production deployment, applying/resetting migrations, destructive database operations, dependency installation or upgrade, secrets/credentials work, `js/config.js` changes, destructive Git operations, new scheduled automations, or enabling external integrations/plugins with meaningful permissions.

## Wordloom Defaults

- Keep one focused feature/change per build.
- Protect unrelated work and parked local files.
- Keep teacher workload low and pupil clarity high.
- Preserve automation-first and Support Ladder direction.
- For teacher-facing changes: add no recurring manual teacher step unless explicitly approved, keep automation as the default, limit visible choices, progressively disclose exceptions, and make recovery copy clear.
- Use targeted `node --test ...` checks where possible.
- Use Supabase commands only when scope and environment are appropriate.
- Report workflow evolution opportunities, prefer updating or merging existing workflow pieces first, and do not create new permanent agents or skills without approval.

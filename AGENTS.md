# Wordloom Codex Workflow

This repository uses an automation-first, approval-gated Codex workflow. Keep the system lean, evidence-led, and focused on one defensible change at a time.

## Start Every Task

- Run `git status --short --untracked-files=all` before planning or editing.
- Identify current branch, worktree, and any unrelated modified, parked, ignored, or untracked files.
- Protect unrelated work. Do not touch dirty files, parked screenshots, selector audit output, demo seed fixtures, local smoke packs, or ignored local credentials unless Darren explicitly includes them in scope.
- Stop if `js/config.js` appears unexpectedly modified.
- Do not stage, commit, push, deploy, migrate, reset databases, install dependencies, or delete files unless the current approval level allows it.

## Product Guardrails

Wordloom is an automated, low-work-for-teachers spelling intervention system.

- Prefer automation, Support Ladder delivery, analytics insight, and intervention oversight.
- Keep teacher workload low and teacher-facing choices simple.
- Preserve pupil clarity, age-appropriate wording, deterministic spelling assessment, and progressive disclosure.
- Avoid unnecessary complexity, noisy gamification, prominent manual test-building paths, and casual exposure of internal question-type mechanics.
- Do not restore quarantined manual dashboard sections or create teacher-facing manual workflows unless the approved plan specifically requires it.
- Visibility must not imply assignability. School visibility, read-only access, analytics visibility, and sharing permissions are distinct.
- Public, compliance, AI, accessibility, supplier, security, and school-readiness claims must stay cautious and evidence-aligned.

Use this low-workload rubric for teacher-facing changes:

- no new recurring manual teacher step unless the approved plan explicitly requires it;
- automation remains the default path;
- teacher choices stay limited, named clearly, and progressively disclosed;
- exceptions and recovery states explain the next action without creating routine admin work;
- pupil-facing consequences remain clear and calm.

## Approval Model

### Plan Approval

Once Darren approves a feature plan, that approval authorizes Codex to:

- edit files within the approved scope;
- create or update tests within that scope;
- run targeted tests and validation commands;
- use Explorer / Architect, Product Guardrail, Builder, Tester, Reviewer, QA / Smoke Tester, and Bug Investigator agents as needed;
- fix issues found by tests, review, Product Guardrail, or QA when the fix remains clearly inside the approved scope.

Do not ask for approval for each file edit, routine test command, agent invocation, or routine in-scope fix.

Stop and request approval if implementation needs to materially exceed, change, or reinterpret the approved plan.

### Ship Approval

When Darren explicitly says `Ship it`, treat that as one approval for the routine release workflow:

1. final targeted checks;
2. inspect full diff;
3. concise checkpoint or project-state documentation update;
4. confirm branch, upstream/remote, and whether push can trigger production deployment;
5. narrow staging;
6. validate staged diff;
7. commit;
8. push only if the branch/remote is expected and the push does not itself deploy production.

Do not ask separately for staging, commit, push, or checkpoint updates during this sequence unless something unexpected occurs.
Stop before pushing if on an unexpected branch, if upstream/remote is unclear, or if pushing would deploy production.

### Separate Explicit Approval Always Required

Always request separate explicit approval before:

- production deployment;
- applying, resetting, or otherwise changing database migrations;
- destructive database operations;
- dependency or package installation or upgrade;
- changes involving secrets or credentials;
- modifying `js/config.js`;
- operations materially outside the approved feature scope;
- destructive Git operations;
- creating scheduled automations;
- enabling a new external integration or plugin with meaningful permissions.

## Normal Workflow

1. Explorer / Architect and Product Guardrail investigate in parallel when useful. Product Guardrail review is mandatory for teacher-facing, pupil-facing, assignment, analytics, automation, public-claim, compliance, accessibility, or navigation changes.
2. Codex consolidates findings into a small plan and stops for human approval.
3. Builder implements only the approved scope.
4. Tester and Reviewer run in parallel where useful.
5. Builder fixes in-scope issues discovered by testing or review.
6. QA / Smoke Tester validates meaningful user journeys when appropriate.
7. Codex reports readiness and stops for review.
8. On `Ship it`, Codex runs the routine release workflow.

## Failure Workflow

1. Failure occurs in implementation, test, review, or QA.
2. Bug Investigator diagnoses root cause before code changes.
3. Builder applies the smallest in-scope fix.
4. Tester reruns targeted checks.
5. Reviewer or QA re-checks if the risk warrants it.

## Agents

Use project agents automatically when their role fits. Darren should not have to manually manage routine subagent prompts.

- `explorer-architect`: read-only architecture and implementation investigation.
- `product-guardrail`: read-only Wordloom product-principle review.
- `builder`: write-capable implementation agent for approved plans only.
- `tester`: test and validation evidence; no app-code edits.
- `reviewer`: independent read-only review of correctness, regressions, maintainability, security, and test gaps.
- `qa-smoke-tester`: scripted and browser/computer-use smoke evidence; no app-code edits.
- `bug-investigator`: read-only diagnosis before fixes.

Recommend new specialist agents only after recurring need is visible. Do not create permanent new specialist agents or skills without Darren approving that workflow change.

## Skills

Use `$wordloom-dev-cycle` for planning, building, reviewing, fixing, and shipping Wordloom changes.

Use `$wordloom-smoke-qa` for scripted smoke testing, browser/computer-use QA, journey evidence, and smoke-test reporting.

## Git Rules

- Prefer isolated Git worktrees for setup work or independent parallel development when the main working tree is dirty.
- Never use `git add .`.
- Stage narrowly by explicit path.
- Review unstaged and staged diffs before committing.
- Do not stage parked or ignored local files.
- Do not use destructive Git commands unless Darren explicitly requests them.

## Verification Defaults

There is no root `package.json`. Prefer targeted `node --test ...` commands for JavaScript tests and `npx supabase test db` only when database test scope is approved and a suitable local Supabase setup exists.

For browser or smoke QA, report the environment, exact journey, evidence observed, screenshots or logs when relevant, and residual risk. Do not patch failures from the QA role.

## Workflow Evolution

During planning, review, QA, and final summaries, proactively report when:

- repeated manual work could be automated;
- an agent or skill is redundant or overlapping;
- an agent or skill should be updated, merged, or retired;
- a specialist agent now appears justified;
- a newer Codex or OpenAI capability could materially improve speed, reliability, capability, or automation.

Prefer updating, merging, or retiring existing workflow pieces before adding new ones. Keep recommendations lean and wait for approval before making permanent workflow changes.

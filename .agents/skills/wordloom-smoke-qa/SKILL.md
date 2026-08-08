---
name: wordloom-smoke-qa
description: Use for Wordloom QA, scripted smoke tests, browser or computer-use validation, user-journey evidence, screenshots, console/network evidence, accessibility smoke checks, and release-readiness smoke summaries.
---

# Wordloom Smoke QA

Use this skill when Wordloom work needs evidence from user journeys or smoke checks.

## Boundaries

- Report evidence rather than patching failures.
- Do not expose, quote, copy, or commit local smoke credentials.
- Do not run against production unless Darren explicitly approves the target environment.
- Do not apply/reset migrations, install dependencies, deploy, or perform destructive data operations.
- If a smoke check needs credentials, services, database writes, browser access, or network access, state the requirement clearly.

## Choose The Smallest Useful QA Scope

Match QA to the changed behavior:

- Login/auth: teacher login, pupil login, session routing, error copy.
- Teacher dashboard: Analytics-first view, assignments, manual-tool quarantine, ownership/assignability, staff/admin flows.
- Pupil flow: assignment entry, spelling activity, feedback, progress cards, Support Ladder delivery.
- Automation/personalised assignment: policy setup, generation feedback, run status, blocked states, recovery copy, and whether next steps keep teacher effort low and pupil expectations clear.
- Analytics/reporting: dashboard summaries, rankings, comparisons, exports, AI assistant boundaries.
- Accessibility: keyboard path, focus visibility, labels, zoom/reflow, non-colour cues, screen reader smoke where available.
- Public/compliance pages: cautious claims, policy links, mobile/readability.

## Scripted Checks

Prefer targeted commands already present in the repo. Examples:

```powershell
node --test tests/teacher-dashboard-analytics-first.test.mjs
node --test tests/teacher-dashboard-home-navigation.test.mjs
node --test tests/teacher-dashboard-render-guard.test.mjs
node --test tests/pupil-feedback-model.test.mjs
node --test tests/pupil-practice-mode.test.mjs
node --test tests/spelling-context-support.test.mjs
```

Use `npx supabase test db` only when database validation is approved and the local Supabase environment is ready.

Smoke scripts under `scripts/smoke/` may require local environment variables and safe test data. Do not infer or reveal those values.

## Browser / Computer-Use QA

When browser QA is available:

1. State environment, URL, viewport/device assumptions, and account type without revealing credentials.
2. Follow the shortest representative journey.
3. Capture screenshots, console errors, network failures, and exact UI copy only where useful.
4. Note pass/fail evidence and any untested branches.

## Report Format

Return:

- scope tested;
- environment and commands or journey steps;
- evidence observed;
- failures or blockers;
- residual risk and recommended next check;
- whether workflow evolution is justified, preferring updates, merges, or retirement of existing agents/skills before recommending anything new.

# Wordloom Project Handover / Checkpoint

Status: Internal project checkpoint
Checkpoint date: 25 May 2026
Branch: `fix/migration-baseline`
Latest pushed commit: `b14822e Add spelling bee pro ladder audit`

## Current repository state

- Tracked tree is expected to be clean at this checkpoint.
- Parked untracked files are intentionally outside this checkpoint:
  - `assests/screenshots/...`
  - `selector-audit-output.txt`
  - `supabase/seeds/demo_multischool_fixture.sql`
- This checkpoint should not be used to change runtime app code, selector logic, migrations, `js/config.js`, screenshots, or the demo seed fixture.

## Stable product state

- Core bank is at `1,750`.
- Personalised Selector v2 is stable.
- Phase 1 spacing/repetition work is completed.
- Phase 2 stretch quality work is completed.
- Phase 3 review/fallback coherence work is completed.
- Needs-support fallback tightening is completed.
- Teacher review smoke audit is completed.

## Audit-only work

- Contextual difficulty v3A is audit-only.
- Spelling Bee/Pro ladder audit is audit-only.
- These audit streams should be treated as review evidence, not as runtime selector changes.

## Recommendation

Pause selector runtime changes for now. The selector has a stable v2 baseline and recent quality work should be allowed to settle before introducing further runtime behavior changes.

## Likely next product work

1. Teacher/admin visibility.
2. Assignment explainability.
3. Policy/run trust.
4. Later decision on contextual difficulty v3B.

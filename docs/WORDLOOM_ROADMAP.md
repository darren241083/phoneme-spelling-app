# Wordloom Roadmap

Status: Internal product direction and implementation guardrail
Last updated: 7 July 2026
Latest pushed checkpoint: `4cd2a66 Make dashboard analytics first`
Current implementation checkpoint: Normal dashboard is Analytics-first; ordinary Test Builder question-type choice is hidden; standalone class/lifecycle/core/manual sections are quarantined from normal first-load.

## Current Product Direction

* Wordloom should become an automated, low-work-for-teachers spelling intervention system.
* Teachers should not need to build or manually manage large numbers of tests.
* Support Ladder should become the standard/default pupil delivery model.
* Manual dashboard assignment remains limited to teacher-owned tests.
* Manual Test Builder/Test Library is preserved for occasional custom lists or legacy manual tests, but it is no longer the normal teacher dashboard path.
* Question types remain internal, specialist, admin, migration, legacy, or runtime compatibility details where needed.
* The normal dashboard should lead with Analytics, keeping teacher-facing insight simple and low-clutter.

## Current Priority

* Keep dashboard manual assignment safe: own-tests-only, own-classes-only, no visibility-implies-assignability.
* Keep the disabled Assign reason UI so access decisions are visible.
* Preserve Support Ladder delivery while moving teacher workflows toward automation and intervention oversight.
* Keep manual tools behind Advanced manual tools, with direct builder links and existing old tests preserved.
* Keep ordinary Test Builder flows free of teacher-facing question-type choice.
* Keep standalone class, assignment lifecycle, core bank, and manual-tool dashboard blocks hidden from normal first-load.

## Next Up

* Continue shaping admin workflows around setup, data/imports, analytics oversight, and automation/core/personalised assignment management.
* Redesign hidden class/lifecycle/core/manual areas into role-specific Analytics, admin, or support surfaces.
* Move `Your classes` information into Analytics rather than restoring it as a separate normal-dashboard section.

## Later / Deferred

* Build a proper explicit Share system/shared bank.
* Sharing should support named teacher, department/subject, and school-wide/shared-bank scopes.
* Sharing must define clear owner, assignee, edit, duplicate, assign, and revoke permissions.
* Visibility alone must never imply assignability.
* Plan safe legacy row cleanup only after retention, audit, assignment-history, and school-data implications are understood.

## Do Not Accidentally Build

* Do not let normal teachers manually assign another teacher’s self-built tests just because they are visible.
* Do not make admin a default path for casual reassignment of another teacher’s personal tests.
* Do not re-expand teacher-facing manual test-building as the main product workflow.
* Do not restore a prominent normal-dashboard `+ Create test` path while automation is the recommended route.
* Do not restore `Your classes`, Assignment lifecycle, Core bank monitor, or Advanced manual tools as normal first-load dashboard blocks.
* Do not expose draft/private/archived/auto-generated tests for manual dashboard assignment.
* Do not treat school visibility, read-only access, or analytics visibility as sharing permission.

## Recent Checkpoints

* Manual Test Builder/Test Library is quarantined behind Advanced manual tools for occasional custom lists or legacy manual tests.
* Normal dashboard first-load is Analytics-first, with standalone class/lifecycle/core/manual blocks hidden until explicit fallback/admin-support flows are designed.
* Ordinary Test Builder flows no longer show the question-type picker; existing stored types remain for legacy/direct/runtime compatibility.
* Direct `test-builder.html?id=...` links and old test records are preserved.
* `15a2585 Restrict manual assignment to owned tests` tightened manual dashboard assignment back to owned tests.
* Migration `20260706123000_restrict_manual_assignment_to_owned_tests` has been applied remotely.
* Browser smoke confirmed visible classes show `Visible to you`.
* Browser smoke confirmed non-owned tests show disabled Assign with `Only the teacher who created this test can assign it.`
* Known separate issue: the `public.teachers` foreign-key/create-test bootstrap issue remains separate.
* Parked untracked screenshot/audit/seed files should remain untouched:

  * `assests/screenshots/...`
  * `selector-audit-output.txt`
  * `supabase/seeds/demo_multischool_fixture.sql`

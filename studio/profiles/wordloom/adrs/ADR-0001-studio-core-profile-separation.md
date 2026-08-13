# ADR-0001: Studio Core and Profile Separation

Status: Accepted

## Context

AI Product Studio v2.1 introduces reusable Studio operating mechanisms and a first
app-specific profile for Wordloom. Wordloom is the first profile, not the Studio itself.
The Core must remain portable enough that a new unrelated app can use it without
inheriting Wordloom, Supabase, pupil, school, spelling, or person-specific assumptions.

## Decision

Keep Studio Core for reusable operating mechanisms: manifest loading, role vocabulary,
profile compatibility, and other app-neutral coordination contracts.

Keep app and domain knowledge in profiles. Wordloom product principles, ADRs, evidence
anchors, and future profile-specific references live under `studio/profiles/wordloom/`.
Core logic must not depend on Wordloom-specific, Supabase-specific, pupil/school-specific,
or person-specific policy.

## Why

This keeps the Core reusable, protects context budget, and gives each app a clear place
for its own durable product and architecture memory. A new unrelated app should
primarily require a new profile, not a redesign of the Core.

## Consequences

- Wordloom policy memory is discoverable in the Wordloom profile, not embedded in Core.
- The full Constitution or ADR should not be automatically injected into every agent
  prompt; later prompt selection can reference profile documents when relevant.
- Core tests should continue to catch obvious Wordloom-specific leakage.
- Profile metadata should stay minimal until later approved Studio work explicitly adds
  a formal reference mechanism.

## Revisit Triggers

- A second unrelated app cannot load through the Core without app-specific changes.
- Core code needs Wordloom, Supabase, pupil, school, spelling, or person-specific terms
  to make a generic Studio decision.
- Profile documents become too large or too hard for future prompt selection to
  reference.
- Later approved Studio work adds formal routing, readiness, or lifecycle contracts that
  require a reference mechanism.

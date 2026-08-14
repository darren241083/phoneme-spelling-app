# AI Product Studio v2.1 Roadmap

Status: Canonical Studio engineering roadmap

This roadmap is separate from `docs/WORDLOOM_ROADMAP.md`, which remains the Wordloom
product roadmap. Stage 5+ remains documentation-only until its own plan is approved.

## Settled Architecture

Studio is a thin, portable control plane. Codex/OpenAI provides engineering execution
machinery behind stable Studio boundaries.

Product collaboration happens upstream of Codex. The current interface is ChatGPT, and
the current transport into Codex is manual copy/paste. Studio Core does not depend on
provider identities, thread identifiers, external conversation storage, APIs, or a
custom relay.

The normal boundary flow is:

`Studio Ready Brief -> Studio Ready Intake -> execution -> independent evidence -> Completion/Evidence Packet`

Studio Ready Intake is the preferred entry point. It preserves a trusted detailed brief,
validates it, adds only objective technical context where needed, and allows execution
only when genuinely required product judgement is resolved. Structured briefs may be
completed from repository and profile evidence. Natural intent remains a secondary
fallback for small tasks and other interfaces.

Deterministic Studio policy outranks agent opinion. A stricter deterministic rule is
effective and its conflict or deviation remains visible; this precedence rule does not
create a separate adjudication system.

## Native-First Law

Before a custom Studio mechanism is built or retained, record:

1. the relevant native Codex/OpenAI capability considered;
2. why that native capability is insufficient for the requirement.

Native-first does not replace deterministic policy or independent verification. Studio
owns policy; Codex owns machinery. Stable input and output contracts keep the execution
platform replaceable.

## Current Native-First Assessment (Stages 1-4)

This assessment records why each current custom boundary remains necessary; it does not
authorize additional runtime work.

| Custom mechanism retained | Native capability considered | Why the native capability is insufficient |
| --- | --- | --- |
| Core/profile compatibility | `AGENTS.md`, Skills, and Codex configuration profiles | Native instructions and configuration can shape execution, but they do not provide a versioned, app-profile schema with deterministic Core compatibility checks. |
| Role vocabulary and presentation metadata | Codex subagents and named agent roles | Native roles coordinate execution, but they do not provide portable canonical role IDs while separately mapping app-specific human display labels. |
| Independent CI | Native test execution, code review, and the Codex GitHub Action | Codex can invoke and interpret checks, but Studio still needs deterministic pass/fail evidence that is independent of agent opinion and cannot be weakened by the acting agent. |
| Product-memory references | `AGENTS.md`, Skills, and repository file reading | Native context loading does not define a normalized, profile-scoped reference list that can pass through Intake without copying full product memory into every task. |
| Intake, contracts, and hashing | Native planning, prompts, structured outputs, and task context | Native task handling does not supply Studio's provider-independent schema versioning, deterministic normalization, readiness rules, or stable content hash. |
| Artifact lifecycle, promotion, and sensitivity | Codex sandboxing, Git worktrees, and Git | Native isolation manages execution and code changes, but it does not model evidence retention states, profile-approved promotion destinations, or additive sensitivity policy. |
| Tier-3 concise audit | Native execution logs, transcripts, and Git history | Native records are transient or broader than required and do not guarantee the concise, deterministic audit shape that excludes raw conversations and temporary artifact paths. |

## Current Boundary

Stages 1-4 establish the portable Core/profile boundary, role vocabulary, dependency-free
CI, product-memory references, Studio Ready Intake contracts, ephemeral task workspaces,
artifact lifecycle metadata, and concise Tier-3 audit retention. A `dispose` lifecycle
state records disposal intent and removes retained paths from the record; it is not proof
that files were physically deleted.

## Remaining Stages

### Stage 5 - Deterministic Risk Policy (Keep)

Define portable deterministic minimum-risk rules plus app-profile rules. Risk remains
Studio policy. Prefer native execution and enforcement mechanisms where suitable, backed
by independent deterministic controls. Do not create a large orchestration engine.

### Stage 6 - Discovery / Delivery (Reduce)

Define policy for isolation, promotion, and production boundaries. Use native Codex
worktrees and Git mechanics. Do not build a custom worktree or environment manager.

### Stage 7 - Execution Traceability / Evidence (Reduce)

Retain acceptance-criterion traceability, required evidence, deviations, deterministic
policy precedence, and the Completion/Evidence Packet contract. Use native Codex
orchestration for internal collaboration instead of custom conversational handoffs.

### Stage 8 - Context Policy (Reduce)

Define authoritative sources, relevant-context mapping, context budgets, and Core/profile
boundaries. Use native file reading, `AGENTS.md`, Skills, and future native context
facilities. Do not build bespoke RAG, vector, or context infrastructure.

### Stage 9 - Capabilities / Specialists (Reduce Heavily)

Map Studio capabilities to native Codex agents, subagents, and Skills. Keep agent
stop-loss as a policy guardrail where useful. One principal Builder remains the default.
Do not build a custom agent scheduler.

### Stage 10 - Test Integrity (Keep Strong)

Keep independent deterministic verification as a major Studio control. Codex may run
early native checks; GitHub CI remains an independent source of truth. Agents must not
weaken or delete established tests merely to make work pass.

### Stage 11 - Design Questions / Parking Lot (Shrink / Defer)

Keep exploratory product thinking in the upstream Product Collaboration layer. Promote
only durable product or engineering questions that genuinely need repository persistence.
Do not turn the repository into a transcript archive.

### Stage 12 - Incident Learning (Keep Thin)

Define deterministic learning and retention rules without creating an incident-management
platform. A meaningful incident should produce an appropriate durable control improvement,
such as a regression test, risk rule, monitoring, runbook improvement, architecture
change, ADR, or explicitly documented accepted risk. An ADR is not mandatory for every
incident.

### Stage 13 - Integration / Pilot (Broaden)

Validate the end-to-end Studio Ready Intake to execution to evidence flow, a second-app
simulation, a portability audit, and a native-substitution audit. For each custom Studio
mechanism, ask whether a better native Codex/OpenAI capability now exists and should
replace it.

## Do Not Build

- A custom ChatGPT-to-Codex relay.
- A custom worktree manager or environment manager.
- A custom agent scheduler, model-provider router, or messaging bus.
- Bespoke vector/RAG infrastructure.
- A speculative plugin framework.
- Production deployment automation as part of this roadmap amendment.
- Stage 5+ runtime functionality before separate approval.

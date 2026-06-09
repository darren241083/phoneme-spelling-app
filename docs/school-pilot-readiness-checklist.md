# School Pilot Readiness Checklist

Status: Internal draft for review

Last reviewed: 5 May 2026

## 1. Purpose

This checklist supports readiness review before a limited Wordloom school pilot.

It helps record evidence, owners, known limitations, support routes, risks and go/no-go notes before pupils or staff use Wordloom in a pilot setting.

This document is for pilot readiness only. It is not approval for full school rollout.

## 2. Status and limitations

- This is not a public policy page.
- This is not legal advice.
- This is not DPO approval, procurement approval, safeguarding approval, accessibility approval, security certification or full rollout approval.
- A pilot may still require school, DPO, legal, procurement, safeguarding, accessibility or security review.
- Unknown or unverified items should remain marked "To be confirmed" until reviewed and evidenced.
- This checklist supports pilot readiness and risk review. It does not replace school, DPO, legal, procurement, safeguarding, accessibility or security review.

## 3. How to use this checklist

- Use this checklist before a limited school pilot.
- Record evidence held, action needed, owner, status and follow-up date.
- Record known limitations and whether they are acceptable for pilot only.
- Confirm support and escalation routes before pupils or staff use the product.
- Do not treat unchecked items as approved.
- Keep wording cautious where evidence is incomplete, including "pilot", "limited rollout", "reviewed", "evidence held", "known limitation", "action needed" and "to be confirmed".

## 4. Pilot readiness checklist

Status options: Reviewed; Evidence held; Action needed; Not yet confirmed; To be confirmed; Not applicable.

| Area | Check | Status | Evidence / location | Owner | Risk / notes |
|---|---|---|---|---|---|
| School scope | Pilot school/contact confirmed | To be confirmed | Pilot record or onboarding notes | Product / Support | Confirm the authorised school contact before relying on pilot instructions. |
| School scope | Pilot group/class/year confirmed | To be confirmed | Pilot scope notes | Product / School | Keep the pilot limited to the agreed group. |
| School scope | Pilot start/end date proposed | To be confirmed | Pilot plan | Product / School | Dates may change if evidence, setup or review is incomplete. |
| School scope | Pilot objectives agreed | To be confirmed | Pilot plan | Product / School | Objectives should be practical and limited to pilot learning. |
| School scope | Pilot success criteria agreed | To be confirmed | Pilot plan | Product / School | Success criteria should not imply full rollout approval. |
| School scope | Pilot limitations recorded | To be confirmed | Known limitations register | Product / Compliance | Limitations must be visible before the pilot starts. |
| Privacy / data protection | Privacy Notice reviewed | To be confirmed | `policies/privacy.html` | Product / Compliance | Do not claim full GDPR compliance from internal review alone. |
| Privacy / data protection | School Data Use Statement reviewed | To be confirmed | `policies/school-data.html` | Product / Compliance | School-facing wording should remain aligned with pilot behaviour. |
| Privacy / data protection | Data Processing Agreement draft shared where needed | To be confirmed | `docs/school-data-processing-agreement-draft.md` | Compliance / Legal | A draft is not signed terms or legal approval. |
| Privacy / data protection | Records of processing/data inventory reviewed | To be confirmed | `docs/records-of-processing-data-inventory.md` | Compliance / Engineering | Deployed data flows and operational records may need confirmation. |
| Privacy / data protection | Data minimisation approach reviewed | To be confirmed | Data inventory and pilot setup notes | Product / Compliance | Pilot imports and prompts should use only necessary data. |
| Privacy / data protection | Retention/export/deletion process reviewed | To be confirmed | `docs/retention-deletion-export-procedure.md` | Compliance / Support | Manual or supplier-dependent steps should be explained. |
| School / DPO / procurement | School authorised contact confirmed | To be confirmed | Pilot record | Product / Support | Instructions should come from an authorised school contact. |
| School / DPO / procurement | DPO/procurement/security review route confirmed where needed | To be confirmed | School review notes | School / Compliance | Review may be needed before pilot use or before stronger claims. |
| School / DPO / procurement | Evidence pack prepared | To be confirmed | Evidence pack location | Compliance / Product | Evidence should be current, cautious and pilot-specific. |
| School / DPO / procurement | To be confirmed items listed before pilot | To be confirmed | Action register | Product / Compliance | Unresolved items should not be hidden from go/no-go review. |
| Safeguarding / pupil safety | Safeguarding & Pupil Safety Statement reviewed | To be confirmed | `policies/safeguarding.html` | Product / Compliance | Wordloom should not replace school safeguarding procedures. |
| Safeguarding / pupil safety | No open pupil chat claim checked against product behaviour | To be confirmed | Code review and policy evidence | Engineering / Product | Re-check before repeating this claim publicly or in school notes. |
| Safeguarding / pupil safety | Pupil account/login approach reviewed | To be confirmed | Pilot setup notes | Product / School | Login support and account handling should be age-appropriate and school-managed. |
| Safeguarding / pupil safety | Pupil support/escalation route confirmed | To be confirmed | Support route notes | School / Support | School safeguarding and pastoral routes remain primary. |
| Safeguarding / pupil safety | School safeguarding route remains primary | To be confirmed | School pilot notes | School / Product | Do not present Wordloom as a safeguarding service or decision-maker. |
| AI | AI Use Statement reviewed | To be confirmed | `policies/ai-use.html` | Product / Compliance | Do not claim AI is risk-free. |
| AI | AI risk assessment/assurance notes reviewed | To be confirmed | `docs/ai-risk-assessment-assurance-notes.md` | Product / Compliance / Engineering | Internal notes are not certification or school DPIA approval. |
| AI | Teacher AI data minimisation guidance reviewed | To be confirmed | `docs/teacher-ai-data-minimisation-guidance.md` | Product / Compliance | Staff should avoid unnecessary pupil personal data in AI prompts. |
| AI | OpenAI/provider configuration to be confirmed where applicable | To be confirmed | Supplier/configuration evidence | Engineering / Compliance | Provider terms, model settings and data handling may need review. |
| AI | `ai-suggest` provider/source to be confirmed where applicable | To be confirmed | Deployed function/source evidence | Engineering | Provider/source uncertainty should remain visible until confirmed. |
| AI | AI prompt/output concern route confirmed | To be confirmed | Support and incident notes | Product / Support | Prompt over-disclosure or unsuitable output should have an escalation route. |
| Accessibility | Accessibility Statement reviewed | To be confirmed | `policies/accessibility.html` | Product / Accessibility | Do not claim full accessibility or WCAG compliance unless supported. |
| Accessibility | Accessibility testing checklist/findings log reviewed | To be confirmed | `docs/accessibility-testing-checklist-findings-log.md` | Product / Accessibility | Testing may be incomplete or need specialist review. |
| Accessibility | Known accessibility limitations recorded | To be confirmed | Known limitations register | Product / Accessibility | Limitations should be shared before pilot use where relevant. |
| Accessibility | No WCAG/full accessibility claim made unless supported | To be confirmed | Public claims review | Product / Compliance | Public and school-facing wording must remain evidence-based. |
| Security / access | Security Statement reviewed | To be confirmed | `policies/security.html` | Security / Compliance | Do not claim security certification unless separately evidenced. |
| Security / access | Staff access/roles reviewed | To be confirmed | Code/schema/test evidence and pilot setup notes | Engineering / Security | Staff roles should match the limited pilot scope. |
| Security / access | Pupil login approach reviewed | To be confirmed | Pilot setup notes | Product / Engineering | Credential handling should match the school's pilot process. |
| Security / access | School scoping/tenant behaviour reviewed where relevant | To be confirmed | Code/schema/test evidence and smoke test notes | Engineering / Security | Tenant behaviour may need live smoke testing before pupil use. |
| Security / access | `js/config.js` not modified with local/sensitive settings | To be confirmed | Release diff and configuration review | Engineering | Local or sensitive settings must not be introduced. |
| Security / access | Production configuration/secrets handling to be confirmed | To be confirmed | Hosting/Supabase/deployment evidence | Engineering / Security | Secrets and production settings may need confirmation outside the repo. |
| Suppliers / sub-processors | Sub-processors page reviewed | To be confirmed | `policies/sub-processors.html` | Compliance | Supplier wording should not overstate terms, regions or safeguards. |
| Suppliers / sub-processors | Supplier due diligence checklist reviewed | To be confirmed | `docs/supplier-subprocessor-due-diligence-checklist.md` | Compliance / Procurement | Supplier evidence may be incomplete. |
| Suppliers / sub-processors | Supabase evidence to be confirmed | To be confirmed | Supplier evidence pack | Compliance / Engineering | Region, DPA, security and support evidence may need confirmation. |
| Suppliers / sub-processors | Google OAuth/Identity evidence to be confirmed | To be confirmed | Supplier/configuration evidence | Engineering / Compliance | OAuth configuration should match the pilot environment. |
| Suppliers / sub-processors | OpenAI evidence to be confirmed | To be confirmed | Supplier/configuration evidence | Compliance / Engineering | AI provider handling should be confirmed before relying on assurances. |
| Suppliers / sub-processors | Hosting/deployment/support/monitoring/payment providers to be confirmed where applicable | To be confirmed | Supplier evidence pack | Operations / Compliance | Operational suppliers should not be omitted if school data is involved. |
| Product readiness | Pupil login smoke test completed or scheduled | To be confirmed | Smoke test notes | Product / Engineering | Complete before pupil use begins where possible. |
| Product readiness | Pupil spelling test flow smoke test completed or scheduled | To be confirmed | Smoke test notes | Product / Engineering | Include representative pilot devices where possible. |
| Product readiness | Teacher login smoke test completed or scheduled | To be confirmed | Smoke test notes | Product / Engineering | Confirm staff can access the pilot environment. |
| Product readiness | Teacher dashboard smoke test completed or scheduled | To be confirmed | Smoke test notes | Product / Engineering | Confirm expected pilot classes and pupils are visible only where appropriate. |
| Product readiness | Test builder/assignment flow smoke test completed or scheduled | To be confirmed | Smoke test notes | Product / Engineering | Confirm assignments can be created and reviewed for the pilot group. |
| Product readiness | Analytics/reporting flow smoke test completed or scheduled | To be confirmed | Smoke test notes | Product / Engineering | Confirm what reporting is available and what remains limited. |
| Product readiness | Known bugs/limitations recorded before pilot | To be confirmed | Known limitations register | Product / Engineering | Known issues should be reviewed before go/no-go. |
| Support / incidents | Named Wordloom pilot owner confirmed | To be confirmed | Support route notes | Product / Support | Lack of owner can slow pilot decisions and issue handling. |
| Support / incidents | Named school pilot contact confirmed | To be confirmed | Pilot record | School / Product | Confirm primary and backup contacts where possible. |
| Support / incidents | Support route confirmed | To be confirmed | Support process notes | Support | Staff need a clear route for ordinary support. |
| Support / incidents | Incident response route confirmed | To be confirmed | `docs/incident-response-breach-process.md` | Operations / Security | Route should cover security, privacy and urgent operational concerns. |
| Support / incidents | Data subject request route confirmed | To be confirmed | `docs/data-subject-request-handling-checklist.md` | Compliance / Support | Requests should be authorised, scoped and recorded. |
| Support / incidents | Accessibility issue route confirmed | To be confirmed | Accessibility notes | Product / Accessibility | Pilot users should know how to raise access issues. |
| Support / incidents | AI concern route confirmed | To be confirmed | AI/support notes | Product / Support | Concerns about prompts or outputs should be triaged. |
| Public claims | Public homepage claims checked against evidence | To be confirmed | Homepage and evidence matrix | Product / Compliance | Claims should not become stronger than internal evidence. |
| Public claims | Public policy pages checked for cautious wording | To be confirmed | `policies/` pages | Product / Compliance | Public pages should not imply approval, certification or completed review. |
| Public claims | No full GDPR/WCAG/security/AI safety/full rollout claims made | To be confirmed | Public claims review | Product / Compliance | Avoid unsupported "fully compliant", "certified", "risk-free" or full rollout wording. |

## 5. Evidence and action log

| Item | Evidence held / location | Decision | Action needed | Owner | Status | Follow-up date |
|---|---|---|---|---|---|---|
| School pilot scope | Pilot plan or onboarding notes | To be confirmed | Confirm school, group, dates, objectives and pilot-only limitations. | Product / School | To be confirmed | To be confirmed |
| Public policy pages | `policies/` pages | To be confirmed | Review cautious wording and alignment with current pilot behaviour. | Product / Compliance | To be confirmed | To be confirmed |
| Internal compliance docs | `docs/` compliance documents | To be confirmed | Confirm documents are current and internally consistent. | Compliance | To be confirmed | To be confirmed |
| Supplier evidence | Supplier evidence pack | To be confirmed | Gather or confirm supplier terms, regions, security information and contacts where needed. | Compliance / Procurement | To be confirmed | To be confirmed |
| AI guidance/configuration evidence | AI notes, teacher guidance and provider/configuration evidence | To be confirmed | Confirm AI guidance, provider/source, configuration and concern route. | Product / Engineering / Compliance | To be confirmed | To be confirmed |
| Accessibility evidence | Accessibility statement and findings log | To be confirmed | Record current findings, known limitations and any specialist review needed. | Product / Accessibility | To be confirmed | To be confirmed |
| Security/access evidence | Code/schema/test evidence, pilot setup notes and deployment evidence | To be confirmed | Confirm roles, scoping, tenant behaviour, secrets and production configuration. | Engineering / Security | To be confirmed | To be confirmed |
| Product smoke testing | Smoke test notes | To be confirmed | Complete or schedule pilot-critical pupil, teacher, assignment and analytics checks. | Product / Engineering | To be confirmed | To be confirmed |
| Support/escalation route | Support and incident process notes | To be confirmed | Confirm named school and Wordloom contacts, incident route and issue triage. | Support / Operations | To be confirmed | To be confirmed |
| Known limitations | Known limitations register | To be confirmed | Record pilot impact, mitigation and wider rollout blockers. | Product / Compliance | To be confirmed | To be confirmed |
| Go/no-go decision | Pilot readiness notes | To be confirmed | Record decision, reviewers, remaining actions and review still needed. | Product / Compliance / School | To be confirmed | To be confirmed |

## 6. Known limitations register

| Limitation | Area affected | Pilot impact | Wider rollout blocker? | Mitigation / note | Owner | Status |
|---|---|---|---|---|---|---|
| Accessibility testing incomplete | Accessibility / pupil and staff use | Some users may encounter barriers not yet identified. | To be confirmed | Share known limitations and decide whether specialist review is needed before or during pilot. | Product / Accessibility | To be confirmed |
| Supplier evidence not fully confirmed | Suppliers / data protection / security | Some school assurance questions may remain open. | To be confirmed | Keep supplier evidence marked as "To be confirmed" until current evidence is held. | Compliance / Procurement | To be confirmed |
| Export/deletion/offboarding manual steps | Retention / data rights / operations | School requests may need manual review and support handling. | To be confirmed | Explain manual steps, owners, expected handling and supplier limitations. | Compliance / Support | To be confirmed |
| AI provider/source/configuration still to be confirmed | AI / supplier assurance | AI assurances may be limited until deployed configuration is confirmed. | To be confirmed | Review provider/source, model, prompt handling, retention and staff guidance. | Engineering / Compliance | To be confirmed |
| Some product flows needing live smoke testing | Product readiness | Pilot users may encounter setup or workflow issues. | To be confirmed | Complete smoke tests before pupil use begins where possible and record any issues. | Product / Engineering | To be confirmed |
| Support/escalation process still being refined | Support / incidents | Issues may take longer to route if ownership is unclear. | To be confirmed | Confirm named owners and routes before pilot launch. | Support / Operations | To be confirmed |
| Public claims must remain cautious | Public claims / procurement | School expectations may exceed current evidence if wording is too strong. | Yes, if claims cannot be evidenced | Use pilot-only and evidence-based wording; avoid compliance, certification or full rollout claims. | Product / Compliance | To be confirmed |

## 7. Support and escalation route checklist

| Route | Confirmed contact/process | Status | Notes |
|---|---|---|---|
| School pilot lead | To be confirmed | To be confirmed | Record primary and backup school contacts where available. |
| Wordloom pilot owner | To be confirmed | To be confirmed | Record the internal owner for pilot readiness and decisions. |
| Technical support | To be confirmed | To be confirmed | Confirm route, expected response handling and issue logging. |
| Account/access issues | To be confirmed | To be confirmed | Include staff access, pupil login and role changes. |
| Data protection/DPO route | To be confirmed | To be confirmed | Confirm school and Wordloom route for privacy or DPO questions. |
| Safeguarding concern route | To be confirmed | To be confirmed | School safeguarding route remains primary. |
| AI prompt/output concern route | To be confirmed | To be confirmed | Include prompt over-disclosure, unsuitable output or teacher guidance issues. |
| Accessibility issue route | To be confirmed | To be confirmed | Confirm how access issues are raised, tracked and reviewed. |
| Incident/security concern route | To be confirmed | To be confirmed | Include urgent security, privacy or operational incidents. |
| Data subject request route | To be confirmed | To be confirmed | Requests should be authorised, scoped and logged before action. |

## 8. Pilot go/no-go notes

Use these prompts for a cautious pilot decision. A pilot go/no-go note is not full rollout approval.

- What is ready for a limited pilot?
- What remains to be confirmed?
- What limitations must be shared with the school?
- What risks are acceptable for pilot only?
- What must be fixed before wider rollout?
- Who has reviewed the pilot readiness position?
- What school, DPO, legal, procurement, safeguarding, accessibility or security review is still needed?

Do not record a pilot go decision as legal, DPO, procurement, safeguarding, accessibility, security or full school rollout approval unless that approval has been separately obtained and evidenced.

## 9. Risk notes

- The pilot may be mistaken for full rollout approval.
- Public claims may become stronger than internal evidence.
- Supplier evidence may still be incomplete.
- AI configuration or provider/source may not yet be fully confirmed.
- Accessibility testing may be incomplete.
- Role/scope or tenant behaviour may need live smoke tests.
- Product smoke tests may not be completed before pupil use.
- Support or escalation routes may be unclear.
- Incident or data request routes may be unclear.
- Known limitations may not be communicated clearly to the school.
- School, DPO, legal, procurement, safeguarding, accessibility or security review may still be needed before or during pilot use.

## 10. Action register

| Action | Owner | Priority | Status | Notes |
|---|---|---|---|---|
| Confirm pilot school/contact | Product / School | High | To be confirmed | Record authorised contact and confirmation source. |
| Confirm pilot scope and success criteria | Product / School | High | To be confirmed | Keep criteria limited to pilot learning and readiness. |
| Confirm school/DPO/procurement review route | Product / Compliance | High | To be confirmed | Record whether review is needed before pupil use. |
| Confirm safeguarding/support escalation route | School / Support | High | To be confirmed | School safeguarding route remains primary. |
| Confirm AI guidance shared with staff | Product / Compliance | High | To be confirmed | Include teacher review expectations and data minimisation. |
| Confirm accessibility limitations reviewed | Product / Accessibility | High | To be confirmed | Record known limitations and any specialist review needed. |
| Confirm supplier evidence position | Compliance / Procurement | High | To be confirmed | Mark missing supplier evidence as "To be confirmed". |
| Confirm product smoke tests | Product / Engineering | High | To be confirmed | Include pupil login, spelling flow, teacher dashboard, assignments and analytics where relevant. |
| Confirm support owner | Product / Support | High | To be confirmed | Name the Wordloom owner for pilot support. |
| Confirm pilot go/no-go review | Product / Compliance / School | High | To be confirmed | Record reviewers, decision, conditions and remaining actions. |

## 11. Review cadence

Review this checklist:

- before each pilot;
- before pupil use begins;
- after pilot setup changes;
- after product bugs or incidents;
- after AI, supplier, security or accessibility changes;
- before moving from pilot to wider rollout;
- at least annually while pilots continue.

This checklist is an internal pilot-readiness support document. It should be reviewed alongside Wordloom's compliance release checklist, public policy pages, compliance evidence matrix, data processing agreement draft, records of processing/data inventory, retention/deletion/export procedure, incident response process, AI risk assessment notes, teacher AI data minimisation guidance, supplier due diligence checklist, accessibility findings log, school onboarding/offboarding checklist and data subject request handling checklist. It supports limited pilot readiness review, but does not replace school/DPO/legal/procurement/safeguarding/accessibility/security review and does not approve full rollout.

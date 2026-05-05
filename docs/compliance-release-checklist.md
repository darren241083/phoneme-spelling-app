# Compliance Release Checklist

Status: Internal draft for review

Last reviewed: 5 May 2026

## 1. Purpose

This checklist supports Wordloom release-readiness review before a school rollout, public release, procurement conversation, DPO review, or stronger public trust/compliance claim.

It brings together public policy pages, internal compliance documents, supplier review, accessibility review, AI assurance, data inventory, onboarding/offboarding, incident process and cautious public wording. It is intended to help reviewers identify what has been reviewed, what evidence is held, what action is needed and what remains not yet confirmed.

This checklist supports evidence review and operational readiness. It does not replace school, DPO, legal or procurement review.

## 2. Status and limitations

This is not a public policy page.

This is not legal advice.

This is not a certification.

This document does not prove GDPR compliance, WCAG compliance, security certification, AI safety or school rollout approval.

School, DPO, legal and procurement review may still be required before a school relies on Wordloom for rollout, procurement, DPIA, accessibility, safeguarding, security or data protection decisions.

Unknowns should remain marked as "To be confirmed" until current evidence has been reviewed and recorded.

## 3. How to use this checklist

- Use this checklist before first school rollout.
- Use it before changing public trust or compliance wording.
- Use it before procurement or DPO conversations.
- Use it after major product, AI, supplier, access-control, data-flow or hosting changes.
- Record evidence location, owner, status, risk and follow-up action.
- Do not treat unchecked items as approved.
- Keep cautious wording where evidence is incomplete, including "reviewed", "evidence held", "action needed", "not yet confirmed" and "requires school/DPO/legal/procurement review".

## 4. Release readiness checklist

Status options: Reviewed; Evidence held; Action needed; Not yet confirmed; To be confirmed; Not applicable.

| Area | Check | Status | Evidence / location | Owner | Risk / notes |
|---|---|---|---|---|---|
| Privacy / data protection | Privacy Notice reviewed | To be confirmed | `policies/privacy.html` | Product / Compliance | Public wording must remain aligned with current product behaviour and evidence. |
| Privacy / data protection | School Data Use Statement reviewed | To be confirmed | `policies/school-data.html` | Product / Compliance | Do not imply school rollout is approved without school/DPO/legal/procurement review. |
| Privacy / data protection | Data Processing Agreement draft reviewed | To be confirmed | `docs/school-data-processing-agreement-draft.md` | Legal / Compliance | Draft wording should not be treated as signed terms or legal approval. |
| Privacy / data protection | Records of processing / data inventory reviewed | To be confirmed | `docs/records-of-processing-data-inventory.md` | Compliance / Engineering | Deployed schema, suppliers and operational records may differ from repo evidence. |
| Privacy / data protection | Legal basis/controller instructions to be confirmed with school/DPO/legal review | To be confirmed | School/DPO/legal review notes | School / Compliance / Legal | Do not claim full GDPR compliance from internal notes alone. |
| Privacy / data protection | Retention/export/deletion procedure reviewed | To be confirmed | `docs/retention-deletion-export-procedure.md` | Compliance / Engineering | Avoid instant deletion, export or retention claims unless supported by process evidence. |
| School review / procurement | School onboarding/offboarding checklist reviewed | To be confirmed | `docs/school-onboarding-offboarding-checklist.md` | Product / Compliance | Rollout steps may still require school-specific approval and contacts. |
| School review / procurement | DPO/procurement/security evidence pack prepared | To be confirmed | Compliance evidence pack location | Compliance / Security | Evidence should be current, cautious and matched to the actual deployment. |
| School review / procurement | School authorised contact route confirmed | To be confirmed | School onboarding record | Product / Support | Requests and instructions should come from an authorised school contact. |
| School review / procurement | To be confirmed items listed before rollout | To be confirmed | This checklist and action register | Product / Compliance | Unresolved items should be visible before any go/no-go discussion. |
| AI use and pupil safety | AI Use Statement reviewed | To be confirmed | `policies/ai-use.html` | Product / Compliance | Do not claim AI is risk-free or suitable without review. |
| AI use and pupil safety | AI risk assessment / assurance notes reviewed | To be confirmed | `docs/ai-risk-assessment-assurance-notes.md` | Product / Compliance / Engineering | AI assurance notes are not certification or a completed school DPIA. |
| AI use and pupil safety | OpenAI terms/configuration still to be confirmed where applicable | To be confirmed | Supplier/configuration evidence | Engineering / Compliance | Model, data handling and provider settings may need separate confirmation. |
| AI use and pupil safety | `ai-suggest` provider/source verified or marked To be confirmed | To be confirmed | Deployed function/source evidence | Engineering | Source/provider uncertainty must not be hidden in public or procurement wording. |
| AI use and pupil safety | Pupil-facing AI restrictions reviewed | To be confirmed | Code review and policy evidence | Engineering / Product | Re-check before stronger claims about pupil AI exposure. |
| AI use and pupil safety | Staff prompt/data minimisation guidance reviewed | To be confirmed | AI notes and staff guidance | Product / Compliance | Staff should avoid unnecessary pupil personal data in prompts. |
| Safeguarding | Safeguarding & Pupil Safety Statement reviewed | To be confirmed | `policies/safeguarding.html` | Product / Compliance | Wordloom should not be presented as replacing school safeguarding procedures. |
| Safeguarding | No open pupil chat claim checked against product behaviour | To be confirmed | Code review and policy evidence | Engineering / Product | Product behaviour should be re-checked before repeating the claim publicly. |
| Safeguarding | Incident/reporting route reviewed | To be confirmed | Policy pages and incident process | Compliance / Support | Reporting routes must be clear and should not replace school DSL procedures. |
| Safeguarding | AI prompt concern route reviewed | To be confirmed | AI notes and incident process | Product / Compliance | Prompt incidents may involve pupil data and should have an escalation route. |
| Accessibility | Accessibility Statement reviewed | To be confirmed | `policies/accessibility.html` | Product / Accessibility | Do not claim WCAG compliance unless current evidence supports it. |
| Accessibility | Accessibility testing checklist/findings log reviewed | To be confirmed | `docs/accessibility-testing-checklist-findings-log.md` | Product / Accessibility | Testing may remain incomplete or need specialist review. |
| Accessibility | Known limitations recorded | To be confirmed | Accessibility findings log | Product / Accessibility | Limitations should be visible before procurement or stronger public claims. |
| Accessibility | No WCAG compliance claim made unless evidence supports it | To be confirmed | Public claims review | Product / Compliance | Avoid "fully accessible" or "WCAG compliant" wording without evidence. |
| Security / access control | Security Statement reviewed | To be confirmed | `policies/security.html` | Security / Compliance | Do not claim security certification unless separately evidenced. |
| Security / access control | Role/access model reviewed | To be confirmed | Code/schema/test evidence | Engineering / Security | Permissions should be checked against deployed behaviour. |
| Security / access control | School scoping/tenant behaviour reviewed where relevant | To be confirmed | Code/schema/test evidence and live smoke test notes | Engineering / Security | Tenant behaviour may need live smoke testing before rollout. |
| Security / access control | Staff/pupil account lifecycle reviewed | To be confirmed | Onboarding/offboarding and product evidence | Product / Engineering | Lifecycle controls should match school process and support expectations. |
| Security / access control | `js/config.js` not modified with local/sensitive settings | To be confirmed | Release diff and configuration review | Engineering | Local or sensitive configuration must not leak into release. |
| Security / access control | Production secrets/configuration handling to be confirmed | To be confirmed | Hosting/Supabase/deployment evidence | Engineering / Security | Secrets and environment settings should be confirmed outside the repo where needed. |
| Suppliers / sub-processors | Sub-processors page reviewed | To be confirmed | `policies/sub-processors.html` | Compliance | Supplier wording should not overstate regions, DPAs or transfer safeguards. |
| Suppliers / sub-processors | Supplier due diligence checklist reviewed | To be confirmed | `docs/supplier-subprocessor-due-diligence-checklist.md` | Compliance / Procurement | Supplier evidence may be incomplete and should remain marked accordingly. |
| Suppliers / sub-processors | Supabase terms/region/DPA/security evidence to be confirmed | To be confirmed | Supplier evidence pack | Compliance / Engineering | Do not claim region, DPA or security posture without current evidence. |
| Suppliers / sub-processors | Google OAuth/Identity terms/configuration to be confirmed | To be confirmed | Supplier/configuration evidence | Engineering / Compliance | OAuth setup and terms should match production configuration. |
| Suppliers / sub-processors | OpenAI terms/configuration to be confirmed | To be confirmed | Supplier/configuration evidence | Compliance / Engineering | AI provider handling should be confirmed before procurement or public claims. |
| Suppliers / sub-processors | Hosting/deployment provider to be confirmed | To be confirmed | Deployment evidence | Engineering / Compliance | Hosting location, logs and security controls may affect school review. |
| Suppliers / sub-processors | Email/support/monitoring/payment providers to be confirmed where applicable | To be confirmed | Supplier evidence pack | Compliance / Operations | Do not omit operational suppliers if school data or account data is involved. |
| Retention / deletion / export | Retention/deletion/export procedure reviewed | To be confirmed | `docs/retention-deletion-export-procedure.md` | Compliance / Engineering | Procedure evidence should distinguish manual and automated steps. |
| Retention / deletion / export | Export/deletion/offboarding manual steps identified | To be confirmed | Procedure and onboarding/offboarding checklist | Product / Support | Manual steps need owner, timing and evidence records. |
| Retention / deletion / export | Supplier backup/log/support retention limitations recorded | To be confirmed | Supplier evidence pack | Compliance / Operations | Supplier retention limits may affect deletion and support commitments. |
| Retention / deletion / export | No instant deletion/export claim made | To be confirmed | Public claims review | Product / Compliance | Avoid claims stronger than actual process capability. |
| Incident response | Incident response / breach process reviewed | To be confirmed | `docs/incident-response-breach-process.md` | Compliance / Security | Process should be current before relying on it in procurement. |
| Incident response | Named incident owner to be confirmed | To be confirmed | Incident rota or owner record | Operations / Security | Lack of owner can delay response and school communication. |
| Incident response | Escalation route to be confirmed | To be confirmed | Incident process | Operations / Security | Escalation should cover security, privacy, safeguarding and AI concerns where relevant. |
| Incident response | Supplier incident contacts to be confirmed | To be confirmed | Supplier evidence pack | Compliance / Operations | Supplier contact routes should be known before school rollout. |
| Incident response | School communication route to be confirmed | To be confirmed | School onboarding record | Product / Support | School contacts should be confirmed before incidents or data requests arise. |
| Public claims | Public homepage trust/safety claims checked against evidence | To be confirmed | Homepage and compliance evidence matrix | Product / Compliance | Claims must not become stronger than evidence. |
| Public claims | Public policy pages checked for cautious wording | To be confirmed | `policies/` pages | Product / Compliance | Public pages should not imply approval, certification or completed review. |
| Public claims | No "fully GDPR compliant" claim | To be confirmed | Public claims review | Product / Compliance | Do not claim full GDPR compliance. |
| Public claims | No "fully accessible/WCAG compliant" claim | To be confirmed | Public claims review | Product / Accessibility | Do not claim WCAG compliance without current evidence. |
| Public claims | No "AI is risk-free/completely safe" claim | To be confirmed | Public claims review | Product / Compliance | AI controls reduce risk but do not remove all risk. |
| Public claims | No "UK-only/no international transfers" claim unless evidenced | To be confirmed | Supplier and hosting evidence | Compliance / Procurement | Transfer and hosting claims require supplier evidence. |
| Public claims | No "certified secure" claim unless evidenced | To be confirmed | Security evidence | Security / Compliance | Do not claim certification without formal evidence. |

## 5. Evidence/action log

| Item | Evidence held / location | Decision | Action needed | Owner | Status | Follow-up date |
|---|---|---|---|---|---|---|
| Public policy pages | `policies/` pages | To be confirmed | Review cautious wording and evidence alignment. | Product / Compliance | To be confirmed | To be confirmed |
| Internal compliance docs | `docs/` compliance documents | To be confirmed | Confirm documents are current and internally consistent. | Compliance | To be confirmed | To be confirmed |
| Supplier evidence | Supplier evidence pack | To be confirmed | Gather DPAs, regions, security terms and support/contact evidence. | Compliance / Procurement | To be confirmed | To be confirmed |
| AI configuration evidence | OpenAI and deployed AI function configuration evidence | To be confirmed | Confirm provider/source, model, data handling and minimisation controls. | Engineering / Compliance | To be confirmed | To be confirmed |
| Accessibility evidence | Accessibility findings log and testing notes | To be confirmed | Record current findings, limitations and any specialist review needed. | Product / Accessibility | To be confirmed | To be confirmed |
| Security/access-control evidence | Code/schema/test evidence and live smoke test notes | To be confirmed | Confirm role, tenant, credential and production configuration behaviour. | Engineering / Security | To be confirmed | To be confirmed |
| Retention/export/deletion evidence | Retention/deletion/export procedure and support notes | To be confirmed | Confirm manual steps, owners, timings and supplier limitations. | Compliance / Support | To be confirmed | To be confirmed |
| Incident response evidence | Incident response / breach process | To be confirmed | Confirm owner, escalation route, supplier contacts and school contacts. | Operations / Security | To be confirmed | To be confirmed |
| School onboarding evidence | School onboarding/offboarding checklist | To be confirmed | Confirm authorised contact, rollout criteria and offboarding owner. | Product / Support | To be confirmed | To be confirmed |
| Public claims review | Homepage, policy pages and release notes | To be confirmed | Remove or soften any unsupported trust, compliance or safety claims. | Product / Compliance | To be confirmed | To be confirmed |

## 6. Go / no-go notes

Use these prompts for a cautious release decision. This section is not formal approval.

- What is ready?
- What is not yet confirmed?
- What must be reviewed by the school/DPO/legal/procurement contact?
- What public claims are currently supported?
- What public claims must be avoided?
- What risks are accepted for pilot use only, if any?
- What must be fixed before wider rollout?

Do not record a go decision as legal, DPO, procurement, security, accessibility or school approval unless that approval has been separately obtained and evidenced.

## 7. Risk notes

- Public claims may become stronger than the evidence currently held.
- Supplier DPAs, regions or transfer safeguards may not yet be confirmed.
- AI data-flow, provider/source, model or model-training settings may not yet be confirmed.
- Accessibility testing may be incomplete or may require specialist review.
- Deletion, export and offboarding may include manual steps and may not be fully automated.
- Incident owner, escalation routes or school communication routes may not yet be confirmed.
- Role/scope or tenant configuration may need live smoke testing before rollout.
- Local or development configuration may accidentally leak into release if configuration review is missed.
- School rollout may proceed before school, DPO, legal or procurement review is complete.

## 8. Action register

| Action | Owner | Priority | Status | Notes |
|---|---|---|---|---|
| Confirm school/DPO/legal/procurement review route | Product / Compliance | High | To be confirmed | Required before treating a school rollout as approved. |
| Confirm supplier evidence pack | Compliance / Procurement | High | To be confirmed | Include DPAs, regions, transfer safeguards, security terms and contacts where applicable. |
| Confirm AI provider/source/configuration evidence | Engineering / Compliance | High | To be confirmed | Include OpenAI configuration and deployed `ai-suggest` source/provider where applicable. |
| Confirm accessibility testing position | Product / Accessibility | High | To be confirmed | Record known limitations and avoid WCAG claims unless supported. |
| Confirm production hosting/configuration/security evidence | Engineering / Security | High | To be confirmed | Include secrets handling, deployment settings and production security evidence. |
| Confirm retention/export/deletion support process | Compliance / Support | High | To be confirmed | Identify manual steps, owner, timing and supplier limits. |
| Confirm incident response owner and escalation route | Operations / Security | High | To be confirmed | Include supplier and school communication contacts. |
| Confirm public claims evidence review | Product / Compliance | High | To be confirmed | Check homepage, policy pages, release notes and procurement material. |
| Confirm school onboarding/offboarding owner | Product / Support | Medium | To be confirmed | Ensure authorised school contact and lifecycle responsibilities are recorded. |
| Confirm final go/no-go review before rollout | Product / Compliance | High | To be confirmed | A checklist review is not formal approval. |

## 9. Review cadence

Review this checklist:

- before first school rollout;
- before public release;
- before changing public trust/compliance wording;
- before procurement or DPO conversations;
- after supplier changes;
- after AI or data-flow changes;
- after security or access-control changes;
- after accessibility fixes or findings;
- after incident or offboarding process changes;
- at least annually.

This checklist is an internal working release-readiness tool. It should be reviewed alongside Wordloom's public policy pages, compliance evidence matrix, data processing agreement draft, retention/deletion/export procedure, incident response process, AI risk assessment notes, supplier due diligence checklist, accessibility findings log, school onboarding/offboarding checklist, and records of processing/data inventory. It supports evidence review and operational readiness, but does not replace school/DPO/legal/procurement review and does not certify compliance.

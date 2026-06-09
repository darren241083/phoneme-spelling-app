# Supplier / Sub-processor Due Diligence Checklist

Status: Internal draft for review

Last reviewed: 5 May 2026

## 1. Purpose

This checklist helps Wordloom collect, review and track supplier and sub-processor evidence. It is intended to support school onboarding, DPO review, procurement checks, DPIA work and internal assurance.

The checklist should be used as a practical record of what is known, what is assumed, what evidence has been collected and what still needs to be confirmed before relying on a supplier or service in a school context.

## 2. Status and limitations

This document is not legal advice, not a public compliance claim, not a certification and not a substitute for school, DPO, legal or procurement review.

Entries may include assumptions while evidence is still being collected. Any assumption should be marked clearly as "To be confirmed" and should not be treated as an approved supplier position.

Supplier status, data protection role, security position, hosting location, transfer position, retention support and incident terms must be confirmed against current contractual, security and privacy documents before school rollout or procurement reliance.

## 3. How to use this checklist

- Identify each supplier, service, platform, library or technical dependency used by Wordloom.
- Record the Wordloom purpose for that supplier or service.
- Identify whether personal data, school data or pupil data may be involved.
- Confirm the likely role or status, including whether the supplier is a processor, sub-processor, independent controller, technical dependency or non-data-processing dependency.
- Collect relevant DPA, terms, privacy, security, sub-processor, transfer and incident evidence.
- Record open actions, evidence gaps and review notes.
- Review before school rollout and periodically afterwards.

## 4. Supplier/service review table

| Supplier/service | Purpose in Wordloom | Data involved | Role/status | Region/data residency | DPA/terms/security evidence | Retention/deletion/export support | Breach notification terms | Current status | Action / notes |
|---|---|---|---|---|---|---|---|---|---|
| Supabase | Backend database, authentication, edge functions and school data storage where used. | School, staff, class, assignment, pupil, attempt, progress, analytics and support-related data may be involved. | Likely processor/sub-processor relationship to be confirmed. | To be confirmed. Do not assume UK-only hosting. | To be confirmed. Collect current DPA, terms, privacy, security and sub-processor documentation. | To be confirmed. Map export, deletion, retention and offboarding support. | To be confirmed. | To be confirmed. | Confirm production project region, contractual terms, security evidence, backups, logs, sub-processors and support contacts. |
| Google OAuth / Google Identity | Teacher/staff sign-in where Google authentication is enabled. | Staff account identifiers and authentication-related data may be involved. Pupil involvement is not assumed and should be confirmed. | Role/status to be confirmed; may involve controller/processor distinctions depending on configuration and account type. | To be confirmed. Do not assume no international transfers. | To be confirmed. Collect relevant Google terms, privacy, security and school account implications. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm OAuth configuration, school account implications, admin controls, logs and any DPA or Workspace-specific terms. |
| OpenAI | Teacher-facing AI support, including analytics assistance where enabled. | Teacher prompts, recent conversation context and analytics context may be involved. Visible repo evidence indicates analytics context may include pupil-related summaries where used. | Likely processor/sub-processor relationship to be confirmed. | To be confirmed. Do not assume UK-only processing or no international transfers. | To be confirmed. Collect current DPA, terms, privacy, security, AI data-use and model-training documentation. | To be confirmed. Map prompt, output, log, deletion and export handling. | To be confirmed. | To be confirmed. | Confirm account configuration, data-use settings, retention settings, approved models, support route and school-facing controls. |
| ai-suggest provider/source | Teacher preparation support for word, sentence or meaning suggestions where enabled. | Teacher-entered focus graphemes, target words, topics, instructions and generated outputs may be involved. | To be confirmed. Deployed source/provider and supplier chain should be verified. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | Verify deployed `ai-suggest` source, provider, model, prompt handling, data-use terms and whether pupil data can be included. |
| Hosting/deployment provider | Hosts the public site, application files, policy pages and deployment infrastructure. | Technical request metadata may be involved. School or pupil data involvement depends on hosting architecture and should be confirmed. | Role/status to be confirmed. | To be confirmed. Do not assume UK-only hosting. | To be confirmed. Collect terms, privacy, security, logs, CDN and incident documentation. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm provider, hosting regions, CDN behaviour, log retention, access controls and sub-processors. |
| Email/support provider | Handles support, contact, onboarding, procurement or incident communications where used. | Contact details, support messages, school information and incident-related information may be involved. | Role/status to be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm provider, mailbox/support desk setup, access controls, retention, deletion and escalation process. |
| Monitoring/error logging provider | Operational monitoring, diagnostics and error investigation if used. | Technical logs may include identifiers or school/pupil-related context depending on implementation. | Role/status to be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm whether monitoring is enabled, what data is captured, redaction controls, retention and incident support. |
| Payment provider, if applicable | Payment, invoicing or subscription processing if commercial billing is enabled. | Billing contact details, payment metadata and school procurement details may be involved. Pupil data should not be assumed. | Role/status to be confirmed; may be independent controller for payment processing. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm whether a payment provider is used and record terms, privacy, security and controller/processor position. |
| jsDelivr / esm.sh technical delivery | Technical delivery of third-party browser modules where remote CDN delivery is used. | Browser request metadata may be processed by the CDN. School/pupil data should not be intentionally sent through module requests, but this should be confirmed. | Role/status to be confirmed; may be technical delivery dependency rather than a school data processor. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm current dependency use, whether assets are remotely loaded in production, privacy implications and fallback/vendoring approach. |
| Local vendored xlsx library | Spreadsheet parsing/export support where the library is served locally by Wordloom. | Spreadsheet contents may be processed in the browser by the local library. External supplier processing is not assumed and should be confirmed against implementation. | To be confirmed; may be a local software dependency rather than a supplier processing data. | To be confirmed. | To be confirmed. Review licence, provenance, security advisories and update process. | To be confirmed. | To be confirmed. | To be confirmed. | Confirm vendored version, source, licence, security maintenance and whether any network calls occur. |

## 5. Evidence to collect

- DPA or data processing terms.
- Privacy notice.
- Security documentation and assurance materials.
- Current sub-processor list.
- Hosting region and data residency information.
- International transfer safeguards.
- Retention, deletion and export support.
- Breach notification wording and timescales.
- Support, security and incident contact routes.
- Access control, admin and audit controls.
- AI data-use, retention, prompt handling and model-training terms where relevant.
- School procurement, DPO and legal sign-off notes.

## 6. Questions for supplier review

- What personal data is processed?
- Is pupil data involved directly or indirectly?
- Where is data stored and processed?
- Are international transfers involved?
- What transfer safeguards apply?
- Can data be exported or deleted on school instruction?
- How are incidents identified, investigated and notified?
- What sub-processors are used?
- How are supplier personnel access, audit logs and support access controlled?
- Are AI prompts, outputs or analytics context used for model training?
- Can the feature be disabled or configured for schools?
- What retention periods apply to production data, logs, backups and support records?
- What happens at school offboarding or contract end?

## 7. AI-specific review notes

Visible repo evidence indicates Wordloom includes teacher-facing AI preparation/support and a teacher-facing analytics assistant. Visible repo evidence also indicates pupils do not have open AI chat and pupil spelling scores are not judged by AI. These statements should be verified before school rollout and whenever AI features, pupil runtime behaviour or deployed functions change.

OpenAI should be reviewed for current DPA terms, API terms, model configuration, data-use settings, retention settings, security documentation, sub-processors, support route and incident notification wording. To be confirmed: the production account configuration, data residency position, international transfer position, log retention and any model-training settings that apply to Wordloom.

The `ai-suggest` provider/source should be verified before school rollout. To be confirmed: deployed source, provider, model, prompt handling, output handling, retention, logs, data-use terms, incident route and whether any school or pupil data may be included in prompts.

Teacher-facing AI preparation/support should use the minimum prompt/input data needed for the task. Staff guidance should discourage entering unnecessary personal data, safeguarding details, health details, family information, behavioural information or special category data into prompts unless separately assessed and instructed by the school.

Analytics AI context should be mapped carefully because visible repo evidence indicates it may include pupil-related analytics summaries where used. To be confirmed: exact deployed data flow, fields sent, retention, export/deletion handling and whether schools can disable or configure the feature.

Incident handling for AI prompt concerns should be documented. This should include how to handle accidental entry of sensitive information, unsuitable AI output, suspected supplier incident, data subject request, school deletion request and DPO escalation.

## 8. Risk notes

- Supplier regions, hosting locations and data residency positions are not yet confirmed for all services.
- DPAs, terms, security documents and breach notification wording are not yet confirmed for all services.
- AI data flows, prompt retention, output retention and model-training settings need supplier-specific confirmation.
- Technical CDN and browser library dependencies may create privacy, security, availability or provenance questions.
- Support, email and monitoring providers are not yet confirmed.
- School offboarding, export, deletion, backup and log deletion may depend on supplier capabilities.
- Public compliance wording could be overclaimed if supplier due diligence remains incomplete.
- Supplier terms may change and should be reviewed against the current live service, not only older saved documents.

## 9. Action register

| Action | Owner | Priority | Status | Notes |
|---|---|---|---|---|
| Confirm Supabase production region, DPA and security terms. | To be confirmed | High | To be confirmed | Include backups, logs, access controls and sub-processors. |
| Confirm Google OAuth terms and school account implications. | To be confirmed | High | To be confirmed | Include OAuth configuration, Workspace implications and admin controls where relevant. |
| Confirm OpenAI terms/configuration and data-use settings. | To be confirmed | High | To be confirmed | Include API account settings, retention, model-training position and incident route. |
| Verify deployed ai-suggest source/provider. | To be confirmed | High | To be confirmed | Confirm provider, model, data flow, prompt logging and retention. |
| Confirm hosting/deployment provider. | To be confirmed | High | To be confirmed | Include hosting region, CDN, access controls and log retention. |
| Confirm email/support provider. | To be confirmed | Medium | To be confirmed | Include support mailbox/helpdesk retention and access controls. |
| Confirm monitoring/error logging provider. | To be confirmed | Medium | To be confirmed | Confirm whether enabled and what data is captured. |
| Confirm payment provider, if applicable. | To be confirmed | Medium | To be confirmed | Record role/status and whether school or billing data is processed. |
| Confirm jsDelivr / esm.sh dependency position. | To be confirmed | Medium | To be confirmed | Confirm whether remote CDN delivery is used in production and whether vendoring is needed. |
| Confirm deletion/export/offboarding support across suppliers. | To be confirmed | High | To be confirmed | Map production data, logs, backups, AI prompts, support records and analytics chat records. |
| Review with school DPO/legal/procurement contact. | To be confirmed | High | To be confirmed | This checklist supports review but does not replace formal school sign-off. |

## 10. Review cadence

Review this checklist:

- before first school rollout;
- when a new supplier or service is added;
- when AI or data flows change;
- when hosting, deployment, CDN or infrastructure changes;
- after supplier terms, privacy documents, security documents or sub-processor lists change;
- during procurement, DPO or DPIA review;
- after any relevant incident or near miss;
- at least annually.

This checklist is an internal working document and should be reviewed alongside Wordloom's data processing agreement draft, privacy notice, school data use statement, AI use statement, DPIA support notes, incident response process, and retention/deletion/export procedure.

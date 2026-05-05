# Records of Processing / Data Inventory Support Document

Status: Internal draft for review

Last reviewed: 5 May 2026

## 1. Purpose

This document helps Wordloom map broad categories of data that may be processed, why they may be processed, where they may appear in the product, who may be able to access them, which supplier dependencies may be involved, and which review questions remain open.

It is intended to support school onboarding, DPO review, procurement and security review, DPIA work, retention/export/deletion planning, internal assurance and future data-flow checks.

This document supports data mapping and school review. It does not replace school, DPO, legal or procurement review.

## 2. Status and limitations

This is an internal working support document. It is not a public policy page.

This document is not legal advice, not data protection advice, not a completed Article 30 records of processing activity record, and not a claim that Wordloom is fully GDPR compliant.

Legal bases, controller/processor positions, supplier roles, transfer safeguards, data retention periods, deletion/export scope and school instructions should be confirmed through school, DPO, legal and procurement review before this document is relied on for a live school rollout or formal assurance process.

Unknown or unverified items should be marked "To be confirmed". Cautious wording such as "may include", "where used", "visible product evidence indicates", "to be verified" and "to be confirmed" should be retained until each item has been checked against the current live product, deployed configuration, supplier terms and school setup.

## 3. Evidence basis

This inventory is based on visible product/repository evidence and existing internal Wordloom documentation available at the time of review.

It should be checked against the current live deployment, current database schema, deployed edge functions, supplier configuration, authentication setup, support process, school configuration and any written school terms before it is treated as accurate for a particular school or rollout.

This is a working support record. It should be updated as product flows, data structures, supplier arrangements and school onboarding practices change.

## 4. Data inventory table

| Data area | Example data that may be involved | Purpose in Wordloom | Product/source area | Typical access/visibility | Supplier/dependency notes | Retention/export/deletion considerations | Status / notes |
|---|---|---|---|---|---|---|---|
| School/tenant setup data | School name, school identifier, tenant/school configuration, enabled features, school contacts where used | Set up and separate school environments, route users to the correct school context, support school administration | School setup, school selection, tenant scoping, admin/support workflows | School admins and authorised staff may see school setup details; Wordloom operational/support access may be needed where agreed | Supabase and hosting/deployment dependencies may be involved; supplier roles, regions and terms are to be confirmed | Retention and offboarding handling are to be confirmed; school-level export/deletion may require manual review | To be confirmed against live setup and written school terms |
| Staff account/profile data | Staff name, email, username/login identity, role, school association, profile/status information where used | Let staff sign in, manage classes/tests, administer school access and receive support | Staff login, Google OAuth/Identity where used, staff directory, access management | Staff may see their own account details; school admins may manage staff; Wordloom support may access where needed and authorised | Google OAuth/Identity and Supabase may be involved; identity provider configuration and retention are to be confirmed | Account deletion, deactivation, export and audit retention need confirmation | To be confirmed |
| Staff roles and permissions | Role labels, access level, approval status, admin/teacher/read-only permissions where used | Control access to school data, administration, analytics and support workflows | Staff access management, role checks, school-scoped product areas | School admins and authorised staff may see or manage role information; Wordloom support access should be limited and authorised | Supabase access controls and any identity-provider claims may be involved; configuration should be verified | Changes may need audit or lifecycle records; retention and export scope are to be confirmed | To be verified against current access model |
| Pupil roster/account data | Pupil name, class/form, username, login code/PIN where used, school-managed identifiers, status | Create and manage pupil access, organise classes, assign spelling work and support school roster processes | Pupil import, pupil login, pupil directory, class/form management | Pupils may see limited own account context; teachers and school admins may see roster details for their school; Wordloom support access should be authorised | Supabase stores product records; CSV handling and any support routes may be involved | Retention, archive, correction, export and deletion procedures are to be confirmed; avoid assuming instant deletion | To be confirmed with school roster process |
| Pupil class/form/group membership | Class/form names, year group, teacher-pupil grouping, group labels such as SEN/PP/gender where used | Organise pupils, target assignments, support analytics comparison and school review | Class/form management, imports, teacher grouping, analytics filters | Teachers and authorised school staff may see group membership for their school; pupils should only see relevant own learning context | Supabase and CSV import/export flows may be involved | Sensitive or special-category implications should be reviewed by school/DPO/legal where group labels are used; retention/export/deletion to be confirmed | To be confirmed before school rollout |
| Teacher-created tests and assignments | Test title, word list, spelling content, assignment settings, due dates, class/pupil targets, teacher author | Let teachers create, allocate and manage spelling activities | Test builder, assignments, pupil dashboard/runtime, teacher dashboard | Teachers and authorised staff may see tests and assignments; pupils see assigned activity content | Supabase and client app dependencies may be involved | Retention and export/deletion of historical assignments and linked attempts are to be confirmed | To be confirmed |
| Baseline and spelling attempt data | Assignment, attempt, answer/result, score, completion status, timing/progress indicators where used | Record pupil spelling activity, support feedback, progress tracking and teacher review | Pupil spelling activity, baseline flow, attempts/results, teacher analytics | Pupils may see own progress/feedback; teachers and authorised staff may see pupil/class results | Supabase stores product records; analytics exports may include derived summaries | Retention, correction, deletion and export scope should be reviewed; historic learning evidence may need school-led retention decisions | To be confirmed |
| Pupil progress and analytics data | Scores, trends, ranking/comparison views, progress summaries, class analytics, evidence labels | Help teachers understand pupil progress and plan support | Teacher analytics, dashboards, reports/exports | Teachers and authorised school staff may see analytics for their school; pupils may see limited own progress where shown | Supabase and chart/export libraries may be involved; analytics assistant may use derived context where enabled | Analytics may derive from underlying pupil attempts; export/deletion scope and derived-record handling are to be confirmed | To be verified against live analytics flows |
| Practice and personalised assignment data | Practice recommendations, personalised assignment settings, automation runs, target words, pupil inclusion/exclusion status where used | Support targeted spelling practice and teacher-managed automation | Practice flows, personalised assignment logic, automation/policy features | Teachers and authorised staff may see personalised assignment information; pupils see assigned practice | Supabase and any teacher-facing automation logic may be involved | Retention/export/deletion of recommendations, automation run records and linked assignments is to be confirmed | To be confirmed |
| Spelling Bee / competition data where used | Competition assignment, pupil inclusion, score/result, ranking/status, generated runs where used | Support competition-style spelling activities and reporting where enabled | Spelling Bee flows, automation, teacher dashboard, results views | Teachers and authorised staff may see competition data; pupils may see assigned activity and relevant feedback | Supabase and product logic may be involved | Retention and publication/visibility rules for rankings should be confirmed with school requirements | To be confirmed where feature is used |
| Word/context support data | Word, phoneme/grapheme/context notes, support examples, cache/context records where used | Support teacher preparation, spelling explanations and contextual learning materials | Word/context support features, generated context, teacher-facing support UI | Primarily teacher-facing where used; pupil exposure should be verified per feature | Supabase may store context/cache records; AI/provider involvement may exist depending on feature | Context support records should be kept separate from pupil spelling scores where applicable; retention/export/deletion are to be confirmed | To be verified before rollout |
| Teacher-facing AI prompt/output data where used | Teacher prompts, generated suggestions, spelling explanations, word/context support, AI outputs | Help teachers prepare or review learning materials where AI support is enabled | Teacher-facing AI support and related edge/function calls where used | Teachers using the feature may see prompts/outputs; Wordloom operational access and supplier handling are to be confirmed | OpenAI and/or ai-suggest provider/source may be involved; provider, model, region, retention and data-use settings are to be confirmed | Prompt/output retention, deletion/export handling and support process are to be confirmed; staff should minimise unnecessary personal data in prompts | To be confirmed |
| Analytics assistant context where used | Teacher questions, assistant replies, analytics summaries, class/pupil-level derived context where used | Help teachers ask questions about progress and analytics where the assistant is enabled | Teacher analytics assistant/chat, analytics context generation | Teachers and authorised staff may see assistant output; supplier and operational access are to be verified | OpenAI may be involved; deployed configuration, model, retention and data-use settings are to be confirmed | Chat history, prompt/output storage, derived context and export/deletion handling are to be confirmed | To be verified before school rollout |
| CSV import/export data | Pupil or staff import files, validation messages, export files, analytics/report exports | Bulk-create/update records, support school administration, support review/export workflows | Pupil/staff CSV import, analytics export, spreadsheet handling | Authorised school staff may handle files; Wordloom support access should be limited and authorised if support is requested | Local vendored xlsx library may be used; browser/file handling and support routes should be confirmed | Imported/exported files may exist outside Wordloom after download or support sharing; secure handling and retention should be agreed with schools | To be confirmed |
| Authentication/session/security records | Login events, identity tokens/session state where used, access checks, security logs, credential resets | Authenticate users, protect school data, investigate security/support issues | Google OAuth/Identity, Supabase auth/session flows, login screens, access-control checks | Users see login flows; operational access to logs should be restricted and documented | Google Identity/OAuth, Supabase and hosting/security tooling may be involved | Log/session retention, deletion limits and audit needs are to be confirmed; some security records may need limited retention | To be confirmed |
| Audit/lifecycle/admin records | Staff approval, role changes, pupil lifecycle events, archive/deactivate/restore actions, admin notes where used | Support accountability, school administration, incident review and access management | Admin panels, lifecycle workflows, database audit/security records where available | School admins and authorised staff may see relevant records; Wordloom operational access may be needed for support | Supabase and operational tooling may be involved | Some records may need retention for audit, legal, security or operational reasons; exact periods are to be confirmed | To be confirmed |
| Support/contact/incident records | Support emails/messages, contact details, screenshots, incident notes, school communications, supplier notices | Provide support, handle incidents, document decisions and assist schools | Support/contact routes, incident response process, email/support tools | Wordloom support and authorised school contacts may see support records; avoid unnecessary pupil data in screenshots/messages | Email/support provider, monitoring/error logging provider and supplier incident routes are to be confirmed | Support/incident records may have separate retention; deletion/export may require manual review and may be limited by legal/security needs | To be confirmed |
| Public website/policy page technical records | Browser/server logs, cookies or consent signals where used, page analytics where used, contact-form technical metadata where applicable | Operate public pages, provide policy information, security monitoring and contact/support routing | Public website, policy pages, hosting/CDN, browser delivery | Public visitors interact with pages; operational access to logs should be restricted and documented | Hosting/deployment provider, jsDelivr/esm.sh technical delivery and monitoring tools may be involved | Cookie/log retention, analytics, consent handling and provider terms are to be confirmed | To be confirmed |
| Payment/billing data if applicable | Billing contact, invoice details, payment status, procurement references where applicable | Manage subscriptions, billing, procurement and account administration if payment features are used | Billing/procurement process, payment provider or manual finance workflow where applicable | School finance/procurement contacts and authorised Wordloom operational users may see relevant records | Payment provider, accounting tools or manual finance systems are to be confirmed if applicable | Payment data position, supplier handling, retention and deletion/export support are to be confirmed | To be confirmed / if applicable |

## 5. Access and visibility notes

### Pupils

Pupils should only see learning content, assignments, feedback and progress information intended for their own use. Visible product/repo evidence indicates pupil-facing flows are separate from teacher/admin views, but pupil visibility should be verified against the current live deployment and school setup.

### Teachers

Teachers may access pupil roster information, class/group information, tests, assignments, attempts, progress, analytics, exports and teacher-facing AI or context support features where enabled. Access should be limited to the relevant school and role, and should be verified against the current access-control implementation.

### School admins

School admins may have broader school-level access to staff, roles, pupils, classes, lifecycle actions, imports/exports and support/offboarding workflows where enabled. Exact admin capabilities and approval routes are to be confirmed with the school setup and written terms.

### Oversight/read-only roles where used

Oversight, reviewer or read-only roles may be used to support senior leaders, SENCOs, school reviewers or support staff. Visibility and permissions for these roles should be checked before rollout and should not be assumed to cover every school requirement.

### Wordloom operational/support access

Wordloom operational or support access may be needed to investigate support issues, handle incidents, assist with imports/exports/offboarding or maintain the service. Such access should be limited, authorised, logged where available and aligned with school instructions and written terms. Operational access controls and logging are to be confirmed.

### Suppliers/sub-processors where used

Suppliers or sub-processors may process or store data depending on hosting, database, authentication, AI, support, monitoring, deployment, billing and technical delivery choices. Supplier regions, roles, DPAs, transfer safeguards, retention, deletion/export support and breach notification terms are to be confirmed.

## 6. Retention, export and deletion considerations

Retention periods are to be confirmed by data category. This document should not be read as setting final retention periods or legal bases.

Export, deletion and offboarding may require manual support steps, technical checks and school authorisation. This document should not imply instant deletion, complete automated export or fully automated offboarding.

Supplier logs, backups, support tickets, security records, authentication logs, payment records and monitoring/error records may have separate retention and deletion limits. These should be reviewed against supplier terms, operational needs and written school arrangements.

Some records may need limited retention for legal, security, audit, incident response, dispute handling, safeguarding, service continuity or operational reasons. Any such retention should be documented, proportionate and reviewed with appropriate school/DPO/legal input.

School instructions for export, deletion, correction, restriction, archive or offboarding should be authorised and recorded. The identity and authority of the requester should be checked before action is taken.

This inventory should be reviewed alongside the retention/deletion/export procedure and the school onboarding/offboarding checklist.

## 7. AI and analytics data notes

Visible product/repo evidence indicates that Wordloom may include teacher-facing AI support where used, including teacher preparation, word/context support, generated suggestions and analytics assistant features. These should be verified before school rollout.

Teacher-facing analytics assistant features may use analytics context that contains pupil-related summaries or derived progress information. Context support records should be considered separately from pupil spelling scores where applicable, because their retention, export and deletion handling may differ.

Staff should minimise unnecessary personal data in prompts, support requests, screenshots and free-text messages. Prompting guidance should discourage entering pupil personal data unless necessary, authorised and proportionate.

OpenAI and the ai-suggest provider/source still require confirmation. To be confirmed items include provider identity, deployed source, model settings, prompt fields, logging, retention, deletion/export support, data-use/model-training settings, region, transfer safeguards, supplier terms and breach notification routes.

Prompt/output retention, analytics chat history, context support records, model-training/data-use settings and school export/deletion scope are to be confirmed. These points should be verified before school rollout and whenever AI or analytics behaviour changes.

## 8. Supplier/dependency notes

The following suppliers and dependencies may be relevant to Wordloom data mapping. This list is a working support list and should be verified against the current live deployment, package/config state, supplier contracts and operational setup.

| Supplier/dependency | Possible role or use | Items to confirm |
|---|---|---|
| Supabase | Database, authentication/session-related services, edge functions and storage/logging where configured | Region, DPA, sub-processors, backup/log retention, deletion/export support, breach notification, access controls and transfer safeguards |
| Google OAuth / Google Identity | Staff authentication or identity flow where used | OAuth configuration, data shared, role, region, DPA/terms, retention, logs, transfer safeguards and account lifecycle handling |
| OpenAI | Teacher-facing AI/analytics assistant processing where used | Provider terms, model, region, retention, abuse monitoring/logging, data-use/model-training settings, deletion/export support and transfer safeguards |
| ai-suggest provider/source | AI suggestion/support flow where used | Deployed source, provider, model, prompt fields, logging, retention, region, data-use settings, DPA/terms and deletion/export support |
| Hosting/deployment provider | Delivery of public site/app, server logs, deployment infrastructure and technical records | Provider identity, region, DPA/terms, logs, retention, access controls, breach notification and transfer safeguards |
| Email/support provider | Support, contact, incident and school communication handling where used | Provider identity, mailbox/ticket retention, attachments/screenshots handling, deletion/export support, DPA/terms and access controls |
| Monitoring/error logging provider | Error reports, availability/security signals and operational logs where used | Provider identity, captured data, redaction, retention, access controls, deletion/export support, DPA/terms and breach notification |
| Payment provider, if applicable | Billing, payment status, invoices or subscription records where used | Whether payment data is processed, provider identity, DPA/terms, region, retention, deletion/export support and PCI/payment responsibilities |
| jsDelivr / esm.sh technical delivery | Public/client-side technical delivery of third-party browser assets where used | Exact assets, request metadata, regions, terms, logs, retention and transfer implications |
| Local vendored xlsx library | Spreadsheet import/export handling in the product where used | Version/source, maintenance status, security review, data handling boundary and whether files remain local/browser-side or are uploaded |

Unless verified in current supplier records, supplier regions, DPAs, security terms, retention/deletion/export support, breach notification terms and transfer safeguards are "To be confirmed".

## 9. Unresolved items / action register

| Action | Owner | Priority | Status | Notes |
|---|---|---|---|---|
| Confirm data categories against live schema and product flows | Engineering / Compliance | High | To be confirmed | Check current deployment, database schema, edge functions and enabled features |
| Confirm legal basis/controller instructions with school/DPO/legal review | Product / Compliance / School | High | To be confirmed | Do not treat this document as legal advice or a completed Article 30 ROPA |
| Confirm retention periods by data category | Compliance / Product / School | High | To be confirmed | Align with school requirements, written terms and retention/deletion/export procedure |
| Confirm export/deletion/offboarding scope | Engineering / Support / Compliance | High | To be confirmed | Identify manual steps, unsupported records, supplier limits and school authorisation process |
| Confirm supplier regions, DPAs and transfer safeguards | Compliance / Procurement | High | To be confirmed | Include hosting, database, identity, AI, support, monitoring, payment and technical delivery providers |
| Confirm OpenAI and ai-suggest data handling | Engineering / Compliance | High | To be confirmed | Confirm provider/source, model, prompts, logging, retention, data-use settings and deletion/export handling |
| Confirm support/contact/incident record handling | Support / Compliance | Medium | To be confirmed | Include email/support provider, screenshots, attachments, incident log location and retention |
| Confirm payment/billing data position if applicable | Product / Finance / Compliance | Medium | To be confirmed | Confirm whether payment data is processed and through which provider/process |
| Confirm audit/security log retention | Engineering / Security / Compliance | High | To be confirmed | Include authentication logs, access logs, supplier logs, backups and monitoring/error records |
| Confirm school review/sign-off process | Product / Compliance / School | High | To be confirmed | Agree who reviews, who signs off and when this inventory is updated |

## 10. Review cadence

This document should be reviewed:

- before first school rollout;
- when database or product flows change;
- when new data categories are introduced;
- when AI or analytics data-flow behaviour changes;
- when suppliers or sub-processors change;
- when retention, export, deletion or offboarding processes change;
- during school DPO or procurement review;
- at least annually.

This document is an internal working support record. It should be reviewed alongside Wordloom's data processing agreement draft, privacy notice, school data use statement, AI use statement, safeguarding statement, supplier due diligence checklist, accessibility findings log, school onboarding/offboarding checklist, incident response process, and retention/deletion/export procedure. It supports data mapping and review, but does not replace school/DPO/legal/procurement review.

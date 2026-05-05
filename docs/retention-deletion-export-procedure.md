# Wordloom Retention / Deletion / Export Procedure Draft

Status: Internal operational/support draft for review

Last reviewed: May 2026

Core caveat: This is not legal advice, not approved contractual terms, not a full automated workflow, and is subject to school instructions and written terms.

This draft is intended to help Wordloom handle school retention, deletion, export and offboarding requests consistently. It describes current product evidence where visible in the repository, likely support handling steps, and items still to be confirmed or built.

This procedure should be reviewed with school/DPO/legal/data protection input before being used as an agreed process. It should also be reviewed against the current product, deployed database, supplier setup, written school terms and operational support practice before each school rollout.

## 1. Status and review note

This document is an internal operational/support draft. It is not a public policy page and should not be presented as legal advice, approved contractual terms or a complete product capability statement.

Retention, deletion and export handling may depend on:

- school instructions and written terms;
- product setup and feature use;
- record type and linked records;
- technical support capability;
- operational/legal needs that may require limited retention;
- supplier and sub-processor processes;
- the deployed database and hosting configuration.

Current app evidence shows some analytics export, archive/restore and feature-level delete capabilities. It does not show a full automated export/deletion workflow yet, and manual support may be required.

## 2. Purpose of this procedure

The purpose of this procedure is to define a practical support approach for:

- identifying what school-managed data Wordloom may hold;
- understanding what can currently be exported where supported;
- understanding what can currently be archived, deactivated, restored or deleted where supported;
- routing pupil, staff and school requests to the right controller or authorised school contact;
- handling school offboarding requests consistently;
- logging operational handling of export, deletion, archive and retention requests;
- marking gaps that need technical, legal, supplier or operational follow-up.

This procedure should support, but not replace, school instructions, written processor terms, the draft Data Processing Agreement / processor terms, and school/DPO/legal review.

## 3. Scope

This procedure covers school-managed data processed in or around Wordloom where Wordloom is likely acting as processor for school-managed use.

In scope:

- school, staff, pupil, class and assignment records;
- pupil attempts, responses, scores, progress and analytics evidence;
- Spelling Bee results where used;
- teacher-facing analytics export data where supported;
- staff and pupil directory lifecycle records;
- support records connected to school-managed use;
- word context support and teacher-facing AI/analytics records where used;
- audit/log records connected to access, staff directory and pupil directory actions where available;
- backup, log and technical records at a high operational level, subject to confirmation.

Out of scope for this draft:

- public policy page wording;
- product implementation changes;
- Supabase migrations or seed data;
- legal advice or approved contractual wording;
- controller-side school processes that only the school can perform;
- Wordloom controller activities for enquiries, demos, business administration and general support except where they overlap with school-managed service requests.

## 4. Data categories covered

| Data category | Examples | Current capability | Manual support need | Notes |
| --- | --- | --- | --- | --- |
| School setup data | School names, school IDs, setup information, active school context. | School-scoped product areas exist where supported. | Manual support may be required for school-level export, deletion or offboarding. | Full school offboarding process is to be confirmed. |
| Staff directory and access data | Staff names, emails, roles, scopes, access approvals, import metadata. | Staff archive/restore and access deactivation flows exist where supported. | Manual review may be required for export, access cleanup and support records. | Staff archive deactivates live roles/scopes; restore does not automatically restore roles/scopes. |
| Pupil directory data | Names, school-managed identifiers, usernames, class membership, active/archive state. | Pupil archive/restore flows exist where supported. | Manual support may be required for export, deletion, class cleanup and data request handling. | Pupil restore clears archive state but does not recreate a live form membership. |
| Classes and memberships | Class records, form/subject/intervention groups, pupil memberships. | Feature-level class deletion and membership cleanup flows exist where supported. | Manual review may be required before deletion because classes can link to pupils, assignments and automation. | Class delete should not be described as deleting pupil records. |
| Tests and assignments | Tests, words, assignments, assignment target rows and related settings. | Feature-level delete flows exist for tests, assignments and assignment target rows where supported. | Manual support may be required to assess linked attempt/progress records. | These are feature-level delete flows, not an end-to-end person or school deletion workflow. |
| Pupil activity evidence | Attempts, responses, scores, completion, progress and analytics evidence. | Analytics export exists for some summary, assignment, scoped attempts and scoped summary data. | Manual support may be required for broader data-subject or school export/deletion requests. | Export coverage may not match the full request scope. |
| Analytics exports | CSV and Excel where available for supported analytics models. | `js/analyticsExport.js`, `js/teacherView.js` and `tests/analytics-export.test.mjs` show supported export models and no-row handling. | Manual support may be required if a school asks for data outside supported analytics exports. | Excel availability depends on runtime support; CSV is supported by the export model. |
| Automation policies | Personalised automation policies, class auto-assign policies, policy targets and runs. | Archive/restore and delete flows exist for some automation policies where supported. | Manual review may be required because policies can link to classes, pupils and generated assignments. | Archived automation references may remain visible for review. |
| Context support records | Sentences, meanings, school-scoped context cache records. | Word context support records may exist. | Retention/export/deletion handling is to be confirmed. | Baseline spelling evidence remains separate from optional context support. |
| AI/teacher analytics records | Teacher-facing AI prompts, analytics chat context or generated support where used. | Teacher-facing AI/analytics records may exist. | Retention/export/deletion handling is to be confirmed. | Staff should avoid unnecessary pupil personal data in prompts. |
| Support records | Emails, support notes, operational details, school contact information. | Support records may exist outside app runtime. | Manual support and controller/processor role review may be required. | Email/support provider and retention handling are to be confirmed. |
| Audit and operational logs | Staff access logs, staff directory logs, pupil directory logs, pending access logs where supported. | Some staff/pupil/access audit/log tables and functions exist. | Manual review may be required to retrieve or interpret logs. | Request handling should be logged without treating logs as exhaustive. |
| Backups and technical records | Backups, server logs, authentication/session metadata, error logs. | Technical records may exist depending on deployed services. | Handling is to be confirmed with hosting and supplier setup. | Operational/legal needs may require limited retention. |

## 5. Retention principles

Wordloom should retain school-managed data only for as long as needed for the relevant school service, support, security, operational or legal purpose, subject to school instructions and written terms.

Retention decisions should consider:

- the type of record;
- the school's documented instructions;
- whether the record is needed to provide the service;
- whether the record is needed for support, security, audit or incident review;
- whether operational/legal needs may require limited retention;
- whether deletion, restriction, archive or export is supported by the product;
- supplier, backup and log retention constraints;
- whether the request concerns school-managed processor data or Wordloom controller data.

Retention periods by data category are to be confirmed.

## 6. Export process

Export requests should be handled as a support workflow, not assumed to be fully automated.

Where supported by the product, authorised staff may be able to download analytics exports. Current code evidence includes:

- analytics summary export models;
- assignment analytics export models;
- scoped attempts export models;
- scoped summary export models;
- CSV serialization;
- Excel workbook export where the runtime library is available;
- handling for export selections with no rows.

Supported analytics exports may include pupil, class, grapheme, timeline, assignment, attempt or summary rows depending on the selected view and available data. This should not be treated as a full school export or full data-subject export without further review.

| Step | Action | Owner | Notes |
| --- | --- | --- | --- |
| 1 | Confirm the requester and school authority. | Support/admin | Use authorised school contact route where available. |
| 2 | Identify whether the request is school-level, pupil-level, staff-level, class-level or feature-level. | Support/admin | Route pupil/staff rights requests through the school where applicable. |
| 3 | Check what export is already supported in-product. | Support/admin or authorised school staff | Analytics exports exist where supported. |
| 4 | Identify gaps between requested scope and supported export scope. | Support/admin | Manual support may be required. |
| 5 | Confirm format and secure delivery route. | Support/admin and school | Export format and delivery process are to be confirmed for manual exports. |
| 6 | Log the request and action taken. | Support/admin | Include requester, authority, scope, dates, output and caveats. |
| 7 | Provide export or explain limitations. | Support/admin | Avoid claiming broader coverage than the output contains. |

Full school export scope and format, data subject export scope, and manual admin/support playbook are to be confirmed.

## 7. Deletion process

Deletion requests should be handled carefully and should not be assumed to be immediate or fully automated.

Current product evidence includes feature-level delete flows for:

- tests;
- assignments and assignment target rows;
- classes and class memberships where supported;
- class auto-assign policies;
- personalised automation policies;
- related automation policy targets or generated run rows where supported by permissions and database policies.

These feature-level flows should not be described as an end-to-end person, pupil, staff or school deletion workflow. Some records may remain because they are linked to audit, support, security, operational, backup or legal needs, or because deletion for that record type has not yet been built.

| Step | Action | Owner | Notes |
| --- | --- | --- | --- |
| 1 | Confirm requester authority and school instruction. | Support/admin | Deletion should be subject to school instructions and written terms. |
| 2 | Classify the request by scope and data category. | Support/admin | Examples: pupil, staff, class, test, assignment, school offboarding. |
| 3 | Check whether archive, deactivate, restrict or delete is the appropriate action. | Support/admin and school | Archive/deactivate may be safer where records are linked to operational history. |
| 4 | Identify supported product action and gaps. | Support/admin | Manual support may be required. |
| 5 | Assess records that may need limited retention. | Support/admin with legal/DPO input where needed | Examples: audit logs, incident records, support records, backups. |
| 6 | Carry out approved action where supported. | Authorised admin/support | Follow product permissions and support playbook. |
| 7 | Log the action, caveats and follow-up. | Support/admin | Do not describe the outcome more broadly than the action taken. |

Deletion/restriction/archive process by record type is to be confirmed.

## 8. Archive/deactivate/restore process

Archive and restore are lifecycle actions, not the same as deletion.

Current product evidence indicates:

- pupil archive and restore functions are exposed through `js/db.js` and teacher UI handling in `js/teacherView.js`;
- staff archive and restore functions are exposed through `js/db.js` and teacher UI handling in `js/teacherView.js`;
- Supabase lifecycle functions and tests cover pupil and staff archive/restore behaviour;
- staff archive deactivates live roles/scopes;
- staff restore clears archive fields but does not automatically restore roles/scopes;
- pupil restore clears archive state but does not recreate a live form membership;
- archived pupils may need to be restored before some account actions such as PIN reset;
- archived automation policies can remain visible for review and may be restorable where supported.

Archive/deactivate/restore requests should be logged with:

- requester;
- school;
- affected record;
- requested action;
- reason;
- approver;
- date/time;
- product action taken;
- limitations or follow-up needed.

Archive and restore behaviour by record type is to be confirmed in an operational playbook.

## 9. School offboarding process

School offboarding should be treated as a controlled support workflow.

| Step | Offboarding action | Status |
| --- | --- | --- |
| 1 | Confirm authorised school contact and written instruction. | To be confirmed. |
| 2 | Confirm offboarding date, service end date and required retention/export/deletion handling. | To be confirmed. |
| 3 | Identify active staff access, roles, scopes and pending approvals. | Supported in parts; manual review may be required. |
| 4 | Identify pupil directory records, class memberships and active assignments. | Supported in parts; manual review may be required. |
| 5 | Identify analytics export needs and supported export formats. | Supported for some analytics views; broader export to be confirmed. |
| 6 | Identify AI/context support, support records, logs and technical records. | To be confirmed. |
| 7 | Agree archive, deactivate, restriction or deletion steps by record category. | To be confirmed. |
| 8 | Confirm supplier, backup and log handling constraints. | To be confirmed. |
| 9 | Complete approved supported actions and record limitations. | Manual support may be required. |
| 10 | Send completion note with caveats and retained-record categories. | To be confirmed. |

Full school offboarding process is to be confirmed.

## 10. Pupil/staff data requests

For school-managed pupil accounts, pupils, parents and carers should usually contact the school in the first instance. The school is usually best placed to verify the requester, decide whether and how the request should be handled, and issue instructions to Wordloom where Wordloom acts as processor.

For staff records connected to school-managed use, staff should usually follow the school's local route first where the school is controller for that staff use. Wordloom may need to assist the school where applicable and where supported by the product.

If Wordloom receives a direct pupil, parent, carer or staff request, support should:

- record the request date and requester details;
- avoid disclosing school-managed data until authority is verified;
- identify whether the request concerns school-managed processor data or Wordloom controller data;
- route school-managed pupil/staff requests to the school where appropriate;
- notify the authorised school contact where appropriate;
- support the school with export, correction, restriction, archive or deletion actions where supported;
- log actions taken and limitations.

Data subject export/deletion scope is to be confirmed.

## 11. Support and operational handling

Support handling should be consistent, cautious and logged.

| Field | What to record |
| --- | --- |
| Request ID | Internal support reference or ticket ID where available. |
| Date received | Date/time the request was received. |
| Requester | Name, role, organisation and contact details. |
| Authority check | How school authority or requester identity was checked. |
| School | School/trust and active school context where relevant. |
| Request type | Export, deletion, archive, restore, restriction, correction, offboarding or other. |
| Data scope | Pupil, staff, class, assignment, analytics, support, AI/context, logs or school-wide. |
| Written instruction | Where the instruction is stored. |
| Product capability | Supported product action or manual support needed. |
| Action taken | Export, archive, restore, delete, deactivate, restrict, no action, or pending. |
| Caveats | Records outside scope, unsupported data, retained records, supplier limits or follow-up. |
| Approver | School/admin/support approver where applicable. |
| Completion date | Date/time completed or closed. |
| Follow-up | Outstanding confirmation, build work or school response needed. |

Operational support records may themselves need retention for accountability, support continuity, incident review or legal/operational needs. Support record retention is to be confirmed.

## 12. Records that may need retention

Some records may need limited retention even after an archive, deletion or offboarding request.

Examples may include:

- support tickets and correspondence;
- audit/log records for staff access, staff directory, pupil directory or pending access actions;
- security, incident or abuse-prevention records;
- billing, procurement or business administration records where applicable;
- records needed to resolve disputes or verify actions taken;
- backup and technical records subject to provider retention;
- records Wordloom must retain for operational/legal needs.

Any retained records should be limited to what is needed for the relevant purpose and handled according to written terms and applicable operational procedures.

Legal/operational retention needs are to be confirmed.

## 13. Backups, logs and technical records

Backups, logs and technical records may be controlled by the deployed hosting, database, authentication, monitoring, support or infrastructure providers.

This procedure should not assume that backup or log deletion happens immediately after a product-level deletion action. Backup, log and technical record retention may depend on provider configuration, security needs, operational recovery processes, support needs and written terms.

To be confirmed:

- backup retention periods;
- backup restoration behaviour;
- database log retention;
- authentication/session log retention;
- monitoring/error logging provider and retention;
- support/email provider retention;
- whether manual suppression, restriction or deletion requests can be applied to specific technical records;
- how restored backups are handled if they contain previously actioned records.

## 14. AI/context support records

Word context support and teacher-facing AI/analytics records may exist where those features are used.

Relevant records may include:

- short sentences, meanings or school-scoped context cache records;
- teacher-facing prompts or questions;
- analytics context used to generate teacher support;
- AI-supported content preparation outputs;
- teacher analytics chat/support records where used.

Current public wording says pupils do not have open AI chat and AI is not called while pupils complete spelling tests. It also says teacher-facing prompts may include words, instructions, questions or analytics context needed to provide the requested support.

Retention/export/deletion handling for analytics, AI, context support and support records is to be confirmed. The procedure should keep these records separate from baseline spelling evidence where applicable and avoid claiming that all AI/context records are covered by current exports.

## 15. Sub-processor considerations

Sub-processors or service providers may affect retention, deletion and export handling.

Relevant providers may include:

- Supabase for database, authentication and server-side functions;
- Google OAuth where teacher sign-in uses Google;
- OpenAI API where teacher-facing AI support is used;
- jsDelivr or similar frontend delivery services where loaded;
- hosting/provider services;
- email/support providers;
- payment providers if applicable;
- monitoring/error logging providers if applicable.

Sub-processor deletion/export support, retention periods, backup/log handling, data location and transfer safeguards are to be confirmed. Supplier DPAs and provider terms should be reviewed before this procedure is treated as operationally settled.

## 16. Actions still to confirm/build

The following items remain to be confirmed or built:

- retention periods by data category;
- full school offboarding process;
- full school export scope and format;
- data subject export/deletion scope;
- deletion/restriction/archive process by record type;
- backup, log and technical record retention;
- analytics, AI, context support and support record handling;
- sub-processor deletion/export support;
- authorised school instruction route;
- manual admin/support playbook;
- incident/breach overlap;
- legal/operational retention needs;
- secure delivery route for manual exports;
- support ticket retention and closure process;
- completion wording for schools that accurately describes what was actioned and what may remain.

## 17. Version history

| Date | Status | Notes |
| --- | --- | --- |
| May 2026 | Internal operational/support draft for review | Initial draft based on policy pages, compliance evidence matrix, DPA draft and visible app/database evidence. Requires operational, technical, supplier and school/DPO/legal review before use. |

This procedure should be reviewed whenever product features, export capabilities, archive/delete flows, AI use, supplier arrangements, hosting, support processes, school requirements or written terms change.

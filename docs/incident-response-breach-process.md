# Wordloom Incident Response / Data Breach Process Draft

Status: Internal operational/support draft for review

Last reviewed: May 2026

Core caveat: This is not legal advice, not a full legal or regulatory workflow, and not a substitute for school/DPO/legal review.

This document is intended to help Wordloom handle suspected security incidents, support incidents and potential personal data breach events consistently. It should be reviewed against the current product, deployed environment, supplier setup, written school terms, support practice, ICO guidance and applicable law before it is treated as an agreed process.

No automated detection claim: this process includes concerns identified through school support reports, supplier notices, operational review, staff reports or technical signals where available. It should not be read as saying that automated monitoring will identify every issue.

## 1. Status and review note

This document is an internal operational/support draft. It is not a public policy page and should not be presented as legal advice, data protection advice, approved contractual wording or a settled regulator notification workflow.

Incident handling may depend on:

- the written terms and school instructions in place;
- whether Wordloom is acting as processor, controller or another role for the relevant data;
- the affected product area, school, user, supplier or support route;
- the information available at the time;
- school/DPO/legal review where applicable;
- supplier/sub-processor evidence and contractual notification terms;
- the school's own safeguarding, data protection and incident procedures.

Where Wordloom acts as processor for school-managed data, the school is usually controller and Wordloom should support the school promptly, without undue delay where required and in line with written terms. Whether an incident is reportable must be assessed by the school/controller/DPO/legal adviser where applicable.

## 2. Purpose of this process

Wordloom should treat security and personal-data incidents seriously. This process is intended to give support, operational and compliance reviewers a practical route for:

- recognising suspected or potential incidents;
- collecting enough evidence to understand what happened;
- taking proportionate containment steps where available;
- supporting affected schools where Wordloom acts as processor;
- escalating supplier/sub-processor incidents;
- documenting decisions and caveats in an incident log;
- identifying follow-up actions and gaps after the event.

This process supports, but does not replace, the draft school data processing agreement, public policy pages, the retention/deletion/export procedure, school instructions, written processor terms or school/DPO/legal review.

## 3. Scope

In scope:

- suspected unauthorised access to school, staff or pupil data;
- wrong school data exposure or tenant-scoping concerns;
- account misuse, inappropriate staff access or compromised sessions;
- lost, shared or exposed credentials, including pupil credentials;
- supplier, hosting, authentication, support, monitoring or AI-provider security incidents;
- AI/support prompt data concerns, including unnecessary pupil personal data entered into AI prompts or support emails;
- accidental data disclosure through support, email, export, screenshots, attachments or school communications;
- school support reports about behaviour that may affect school data or pupil use;
- potential personal data breach events affecting school-managed data;
- operational access/support actions taken to investigate or contain an issue.

Out of scope for this draft:

- public policy page changes;
- app runtime implementation changes;
- Supabase migrations or seed data;
- the school's own safeguarding response;
- the school's own regulator notification decision;
- full supplier due diligence or contractual review;
- formal legal/data protection advice.

Wordloom should not decide the school's safeguarding response. Pupil safeguarding concerns should be routed through the school's safeguarding procedures and appropriate school safeguarding lead.

## 4. Definitions and incident types

The table below is intended for initial classification. Several rows may apply to the same suspected incident.

| Incident type | Examples | Initial action | Escalation note |
| --- | --- | --- | --- |
| Suspected unauthorised access | Staff account accessed by an unexpected person; unusual access to a school area; support report that a user saw data they should not see. | Preserve available evidence, identify affected school/user/workflow, consider session/account containment where supported. | Escalate for technical review and school notification/support assessment. |
| Wrong school data exposure | A teacher sees another school's class, pupil, assignment, analytics or export data. | Stop or limit the affected workflow where possible, capture exact screen/export details, identify tenant/school scope. | Treat as a potential personal data breach event until assessed. |
| Account misuse | Shared staff login, inappropriate access, role misuse, pupil credential misuse, attempts to bypass controls. | Confirm account, role, school context and timeline; consider access restriction or credential reset where appropriate. | School may need to manage staff/pupil discipline or safeguarding routes. |
| Lost or exposed credentials | Pupil PINs shared widely; staff device lost while signed in; support email includes credentials. | Advise reset/revocation where supported, assess whether data access occurred, remind school of local credential handling. | School/controller review required where school-managed credentials are involved. |
| Supplier/security incident | Supabase, Google OAuth, OpenAI, hosting, email/support, monitoring or other provider reports an issue. | Collect supplier notice, affected services, dates, data categories and mitigations. | Escalate through supplier/sub-processor route and assess school impact. |
| AI/support prompt data concern | Staff enters unnecessary pupil personal data into an AI prompt or support email; prompt context includes more data than needed. | Identify prompt/support record, data categories, supplier route and whether deletion/restriction is possible. | Review AI prompt/support handling playbook when confirmed. |
| Accidental data disclosure | Email sent to wrong recipient; screenshot includes pupil data; export shared with wrong school/contact. | Ask recipient not to use/share data where appropriate, retrieve/delete where feasible, log disclosure details. | School/controller/DPO/legal review required where personal data may be involved. |
| School support report | School reports unusual product behaviour, access concern, incorrect data, suspected misuse or pupil safety concern. | Acknowledge, triage, request facts, route safeguarding concerns to school process. | Support the school while avoiding regulator or safeguarding decisions for the school. |
| Potential personal data breach event | Any suspected confidentiality, integrity or availability issue affecting personal data. | Preserve evidence, contain where available, assess role and affected data. | Reportability is to be assessed by the school/controller/DPO/legal adviser where applicable. |

For this process, a "personal data breach concern" means a suspected or potential event that could involve accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to personal data. This is a practical working definition for triage and does not replace legal/data protection advice.

## 5. Roles and responsibilities

| Role | Responsibilities | To be confirmed |
| --- | --- | --- |
| Support handler | Receive school support reports, acknowledge receipt, capture facts, avoid over-stating conclusions, log actions. | Support rota and authorised support users. |
| Internal incident owner | Coordinate triage, containment, evidence collection, school support, supplier escalation and closure. | Named internal incident owner. |
| Backup contact | Cover when the incident owner is unavailable. | Backup contact and out-of-hours expectations. |
| Technical reviewer | Review product, database, authentication, hosting, logs and access-control evidence where available. | Hosting/deployment details and log access route. |
| Compliance/privacy reviewer | Check role position, processor/controller implications, school communications and caveats. | DPO/legal review process and regulator assessment workflow. |
| School/controller contact | Receive relevant information, provide instructions, decide controller-side response where applicable. | Authorised school contact route and school communication approval path. |
| Supplier/sub-processor contact | Provide supplier notices, evidence, mitigations and contractual notification information. | Supplier/sub-processor contact points and contractual notification terms. |

Where Wordloom is processor for school-managed data, Wordloom should support the school and provide relevant information reasonably available to Wordloom. Wordloom should not make the school's controller decisions, safeguarding decisions or regulator notification decisions.

## 6. Initial triage

The first response should be calm, factual and logged. Early triage should avoid deciding too quickly that an event is or is not a personal data breach. The classification may change as evidence is collected.

| Triage item | Question | Status/notes |
| --- | --- | --- |
| Reporter | Who reported the concern and through which route? | Record name, organisation, email/support channel and time received. |
| Affected school | Which school, trust or active school context may be involved? | Confirm exact school identifier where available. |
| Affected users | Which staff, pupils, classes, roles or accounts may be involved? | Use minimum necessary personal data in notes. |
| Incident type | Which incident type appears most likely? | Mark as suspected or potential until assessed. |
| Data involved | What data categories may be affected? | Pupil, staff, class, assignment, analytics, support, AI/context, logs or supplier records. |
| Current access | Is the issue still ongoing or repeatable? | Consider containment steps where supported. |
| Scope | Is this limited to one account/school/workflow or potentially wider? | Escalate if wrong school data exposure or supplier incident is possible. |
| Role position | Is Wordloom processor, controller or both for the affected data? | To be assessed with school/DPO/legal review where applicable. |
| Safeguarding | Does the report include a pupil welfare or safeguarding concern? | Route to school safeguarding procedures; do not decide the school's response. |
| Immediate risk | Is urgent containment needed to reduce further exposure, misuse or loss? | Escalate to incident owner/technical reviewer. |
| School contact | Has the authorised school contact been identified? | To be confirmed if no authorised route exists. |
| Logging | Has an incident log entry been opened? | Incident log should be maintained from the first report. |

## 7. Evidence to collect

Evidence collection should be proportionate, secure and limited to what is needed. Do not ask schools to send unnecessary pupil personal data. Where screenshots or exports are needed, request the minimum information that shows the issue.

| Evidence item | What to capture | Notes |
| --- | --- | --- |
| Report details | Date/time received, reporter, school, contact route and summary. | Keep original support email/ticket where available. |
| Timeline | When the issue was first noticed, when it may have started, and relevant actions already taken. | Use exact dates/times and timezone where possible. |
| Product area | Page, workflow, feature, export, function, email or supplier system involved. | Include URL/path only where useful and safe. |
| Accounts/users | Affected account IDs, roles, school context and credential/reset status where relevant. | Avoid unnecessary pupil names in working notes. |
| Data categories | School setup, staff, pupil, class, assignment, attempt, score, analytics, support, AI/context, log or supplier data. | Mark unknowns as to be assessed. |
| Access evidence | Logs, access approvals, active school context, auth/session information or support access records where available. | Log availability is to be confirmed. |
| Screenshots/exports | Minimal screenshot, CSV or file showing the issue. | Check for accidental extra personal data before wider sharing. |
| Supplier evidence | Supplier notice, incident ID, affected services, dates, mitigations, regions and data categories. | Supplier logs/evidence availability is to be confirmed. |
| AI/support prompt evidence | Prompt text, support email, generated output, analytics context or provider record where available. | AI prompt/support handling playbook is to be confirmed. |
| Containment actions | Account restrictions, resets, workflow disablement, supplier actions or recipient deletion requests. | Record who approved and performed each action. |
| Communications | School notices, supplier contacts, internal notes and decisions. | Use approved wording where templates exist. |

## 8. Containment steps

Containment should be proportionate to the suspected issue and available product/support controls. Actions should be approved and logged. Where school-managed accounts or pupil credentials are involved, coordinate with the school where applicable.

| Containment item | Possible action | Notes |
| --- | --- | --- |
| Staff account/session concern | Disable or restrict access where supported; ask user to sign out; trigger password/OAuth review where applicable. | Coordinate with school for staff account decisions. |
| Pupil credential concern | Reset affected pupil credentials where supported; ask school to reissue locally. | Schools remain responsible for local credential handling. |
| Wrong school exposure | Pause affected workflow if feasible; restrict affected role/account; preserve evidence; escalate technical review. | Treat as potential personal data breach event until assessed. |
| Misaddressed email/export | Ask unintended recipient to delete and confirm; avoid further forwarding; check whether recall is available. | Do not rely on recall as proof of deletion. |
| Support attachment/screenshot issue | Remove or restrict access to the support record where supported; replace with minimised evidence if needed. | Support/email provider capabilities are to be confirmed. |
| AI prompt concern | Stop further use of the prompt/context; check provider/support record handling options; document minimisation issue. | AI prompt/support handling playbook is to be confirmed. |
| Supplier incident | Follow supplier guidance; request affected data/service details; assess school impact. | Escalate through supplier/sub-processor contact route. |
| Vulnerability/product issue | Limit use of affected feature where feasible; prioritise technical fix or configuration change. | Product changes are outside this document but may be follow-up actions. |
| Logs/backups | Preserve relevant logs and evidence where available. | Backup/log retention and access are to be confirmed. |

Containment should not erase necessary evidence. If deletion or restriction is needed for exposed material, record what was deleted, restricted, retained and why.

## 9. Assessment of personal data breach risk

Personal data breach risk assessment should be cautious and documented. The outcome is to be assessed based on evidence available at the time and may need school/DPO/legal review.

Assessment should consider:

- whether personal data was involved;
- whether the data relates to pupils, staff, parents/carers or school contacts;
- whether school-managed pupil data was affected;
- whether data was accessed, disclosed, altered, lost, unavailable or deleted unexpectedly;
- whether wrong school data exposure occurred;
- whether credentials, authentication sessions or roles were affected;
- whether the issue was contained and when;
- whether affected data was encrypted, pseudonymised, minimised or otherwise protected;
- whether a supplier/sub-processor was involved;
- whether AI prompts/support emails included unnecessary pupil personal data;
- whether the issue creates risks to individuals that require school/controller assessment;
- whether safeguarding concerns are present and should be routed through school procedures.

Where Wordloom acts as processor for school-managed data, Wordloom should provide relevant information reasonably available to support the school. The school/controller/DPO/legal adviser should assess reportability where applicable.

## 10. School notification/support

Schools should be supported promptly when a suspected or potential incident may affect school-managed data, pupil use, school access or school responsibilities.

Notification/support should:

- use the authorised school contact route where confirmed;
- explain that the matter is suspected or potential if assessment is ongoing;
- include known facts, affected data categories where known, dates/times where known, containment steps and next steps;
- avoid speculating beyond the available evidence;
- identify information still to be assessed;
- ask for school instructions where Wordloom acts as processor and school action is needed;
- remind the school to use its own safeguarding procedures if pupil welfare concerns are involved;
- avoid deciding the school's regulator, data subject or safeguarding response.

Authorised school contact route, notification templates and school communication approval path are to be confirmed.

## 11. ICO or regulator notification caveat

Regulator notification decisions are not automatic and must be assessed by the school/controller/DPO/legal adviser where applicable. Wordloom should not tell a school that a regulator notification is definitely required or definitely unnecessary unless that position has been reviewed and approved through the appropriate legal/data protection route.

Where Wordloom acts as processor for school-managed data, Wordloom should support the school without undue delay where required by providing relevant information reasonably available to Wordloom. The school/controller is usually responsible for deciding whether and how to notify the ICO or another regulator for school-managed data.

Regulator assessment workflow and DPO/legal review process are to be confirmed.

## 12. Data subject communication caveat

Data subject communication decisions should be assessed by the school/controller/DPO/legal adviser where applicable. Wordloom should support the school with factual information reasonably available where Wordloom acts as processor, but should not decide whether pupils, parents, carers, staff or other individuals must be contacted.

Any communications should use approved wording, avoid unnecessary personal data, and reflect only confirmed facts or clearly marked provisional information.

School communication approval path and notification templates are to be confirmed.

## 13. Supplier/sub-processor incidents

Incidents involving suppliers/sub-processors need supplier information and escalation. Relevant suppliers may include database, authentication, hosting, AI, support/email, monitoring/error logging, deployment and other technical service providers.

For supplier/sub-processor concerns, collect:

- supplier name and service involved;
- supplier incident/reference ID;
- notice date/time and affected period;
- affected product/service areas;
- data categories and regions where known;
- whether school-managed data may be affected;
- containment and mitigation steps described by the supplier;
- supplier evidence, logs or reports available;
- contractual notification terms and timing;
- supplier contact point and escalation route.

Supplier/sub-processor contact points, contractual notification terms, supplier logs/evidence availability, support/email provider, monitoring/error logging provider, hosting/deployment details and backup/log retention are to be confirmed.

## 14. AI/support prompt data concerns

AI/support prompt concerns may include unnecessary pupil personal data entered into AI prompts, teacher analytics questions, support emails, screenshots, exported files or free-text support requests.

Handling should consider:

- whether pupil, staff or school personal data was included;
- whether the information was necessary for the support or AI request;
- whether teacher-facing analytics context or generated output was involved;
- which supplier/provider handled the prompt, support email or record;
- whether the prompt/support record can be deleted, restricted or minimised where appropriate;
- whether the school should be supported as controller for school-managed data;
- whether guidance should be improved to reduce future unnecessary personal data entry.

Current public wording says pupils do not have open AI chat and AI is not called while pupils complete spelling tests. This process should keep AI/support prompt concerns separate from baseline spelling evidence where applicable and avoid claiming current exports or support tooling cover every AI/context record.

AI prompt/support handling playbook is to be confirmed.

## 15. Record keeping and incident log

An incident log should be maintained for suspected and potential incidents, including events later assessed as outside personal data breach scope. Operational access/support actions should be logged.

| Incident log field | Description |
| --- | --- |
| Incident ID | Internal reference for the incident. |
| Date/time opened | When the concern was first received or identified. |
| Reporter/source | School, supplier, staff member, support route, technical signal or other source. |
| Affected school/contact | School/trust and authorised contact where known. |
| Incident type | Suspected unauthorised access, wrong school data exposure, account misuse, credential issue, supplier incident, AI/support prompt concern, accidental disclosure, school support report or other. |
| Summary | Short factual description with assumptions marked. |
| Data categories | Pupil, staff, class, assignment, attempt, score, analytics, support, AI/context, supplier, logs or unknown. |
| Role assessment | Processor/controller/other role position and caveats. |
| Initial triage | Key triage outcome and open questions. |
| Evidence collected | Screenshots, logs, support tickets, supplier notices, exports or other evidence. |
| Containment actions | Actions taken, approver, timestamp and limitations. |
| School communications | What was sent, to whom, when, and approval route. |
| Supplier communications | Supplier contact, incident reference, evidence and follow-up. |
| DPO/legal review | Whether school/DPO/legal review was requested or completed. |
| Regulator assessment | Status of controller/regulator assessment where applicable. |
| Data subject communication assessment | Status where applicable. |
| Safeguarding route | Whether any safeguarding issue was identified and routed to school procedures. |
| Closure decision | Outcome, caveats, residual actions and reviewer. |
| Post-incident review | Review date, lessons learned and action owners. |

Incident log location, access controls and retention are to be confirmed. Incident records may themselves need limited retention for accountability, support continuity, security review, dispute handling or legal/operational needs.

## 16. Post-incident review

Post-incident review should happen after containment and initial school/supplier support. It should focus on what happened, what was learned and what needs to change.

| Review item | Question | Notes |
| --- | --- | --- |
| Timeline | Is there a clear timeline from report/identification to closure? | Capture gaps and unknowns. |
| Root cause | What likely caused the issue? | Mark as to be assessed if not confirmed. |
| Scope | Was scope limited or broader than first thought? | Include affected schools, users, data and suppliers. |
| Containment | Were containment steps timely and effective? | Note actions not available in current tooling. |
| Communication | Were school, supplier and internal communications clear and approved? | Improve templates where needed. |
| Evidence | Was evidence sufficient, proportionate and securely handled? | Identify missing logs or supplier evidence. |
| Legal/data protection review | Was school/DPO/legal review needed and obtained where applicable? | Record decisions without replacing advice. |
| Safeguarding | Were any pupil welfare concerns routed through school procedures? | Do not document unnecessary safeguarding details in this log. |
| AI/support minimisation | Did prompts, support emails or attachments include unnecessary personal data? | Update guidance/playbook if needed. |
| Controls | Are product, access, support or supplier controls needing change? | Create follow-up tickets outside this document. |
| Documentation | Do policy, DPA, retention or support docs need review? | Public policy edits are outside this scoped build. |
| Closure | Are owners and due dates assigned for follow-up actions? | Keep incident log updated until closed. |

## 17. Actions still to confirm/build

The following items remain to be confirmed or built:

- named internal incident owner;
- escalation route;
- backup contact;
- out-of-hours expectations;
- authorised school contact route;
- notification templates;
- supplier/sub-processor contact points;
- contractual notification terms;
- supplier logs/evidence availability;
- support/email provider;
- monitoring/error logging provider;
- hosting/deployment details;
- backup/log retention;
- incident log location, access controls and retention;
- DPO/legal review process;
- regulator assessment workflow;
- school communication approval path;
- AI prompt/support handling playbook;
- support rota and authorised support users;
- technical log access route;
- wording for school support acknowledgements and closure summaries;
- criteria for when product/security engineering work should be opened after an incident;
- review cadence for this process.

## 18. Version history

| Date | Status | Notes |
| --- | --- | --- |
| May 2026 | Internal operational/support draft for review | Initial draft based on current Wordloom policy pages, compliance evidence matrix, DPA draft and retention/deletion/export procedure. Requires operational, technical, supplier and school/DPO/legal review before use. |

This process should be reviewed whenever product features, AI use, supplier arrangements, hosting, support processes, school requirements, written terms, ICO guidance or UK data protection law change.

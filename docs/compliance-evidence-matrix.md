# Wordloom Compliance Evidence Matrix

Status: Internal working evidence matrix

Last reviewed: May 2026

Caveat: This is not legal advice, not a public compliance claim, and not a substitute for a formal Data Processing Agreement, security audit, accessibility audit, supplier due diligence, or school/DPO review.

## Confidence Key

- High: Directly supported by current app/code/tests.
- Medium: Supported in product wording or partial implementation, but with caveats.
- Low: Policy-supporting statement exists, but operational/legal evidence is incomplete.

## 1. AI Use And Pupil Safety

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| AI use and pupil safety | Pupils do not have open AI chat. | `policies/ai-use.html`, `policies/safeguarding.html`, `policies/security.html`, `policies/school-data.html`, `policies/dpia-support.html`, `policies/sub-processors.html` | Pupil runtime routes load spelling activity and progress views only. Searches found teacher AI chat UI in teacher areas, not pupil runtime. | `js/pupilView.js`, `js/game.js`, `js/authPupil.js`, `js/teacherView.js` | High | Evidence is based on visible repository files. Future pupil features could change this. | Re-check before each public policy review. | Engineering / ongoing |
| AI use and pupil safety | AI is not called while pupils complete spelling tests. | `policies/ai-use.html`, `policies/safeguarding.html`, `policies/security.html`, `policies/school-data.html`, `policies/dpia-support.html` | Pupil test scoring and attempt logging happen in `game.js`; OpenAI/Supabase AI function calls are outside pupil gameplay. | `js/game.js`, `ai.js`, `supabase/functions/teacher-analytics-chat/index.ts` | High | Claim should be re-tested if pupil runtime imports AI helpers later. | Add a static grep check for AI function calls in pupil runtime files. | Engineering / recommended |
| AI use and pupil safety | Teacher-facing AI support exists for preparation and analytics. | `policies/ai-use.html`, `policies/privacy.html`, `policies/school-data.html`, `policies/terms.html` | Test builder calls `aiSuggest` for teacher preparation. Teacher dashboard includes analytics assistant and calls the teacher analytics function. | `ai.js`, `js/testBuilder.js`, `js/teacherView.js`, `supabase/functions/teacher-analytics-chat/index.ts` | High | Exact deployed source/provider for `ai-suggest` is not visible in the repo. | Verify deployed `ai-suggest` function source and provider. | Engineering / action needed |
| AI use and pupil safety | Pupil spelling scores are not judged by AI. | `policies/ai-use.html`, `policies/privacy.html`, `policies/dpia-support.html` | Scoring compares typed answers or selected grapheme parts against expected answers. Attempts record a boolean `correct` result. | `js/game.js`, `tests/pupil-feedback-model.test.mjs`, `js/spellingIndicator.js` | High | Does not assess whether every future question type will remain deterministic. | Keep deterministic scoring checks in regression tests. | Engineering / ongoing |
| AI use and pupil safety | AI analytics support may use analytics context. | `policies/ai-use.html`, `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html`, `policies/sub-processors.html` | Teacher analytics function builds analytics context from scoped classes, assignments, memberships, pupils and attempts, then sends prompt/context to OpenAI. | `supabase/functions/teacher-analytics-chat/index.ts`, `js/teacherView.js` | High | Prompts may include pupil-related analytics context; minimisation guidance is policy/process based. | Add AI risk assessment and minimisation notes. | Product/Engineering / action needed |

## 2. Privacy And School Data Use

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Privacy and school data use | Wordloom processes school/staff/pupil account, class, assignment, attempt, score, progress and analytics data. | `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html` | App stores teachers, staff profiles, pupils, classes, assignments, attempts, progress, analytics exports and AI chat history. | `js/db.js`, `js/teacherView.js`, `js/pupilView.js`, `supabase/remote_public_schema.sql` | High | Production data inventory should still be confirmed against deployed schema and suppliers. | Maintain a data inventory aligned to the deployed environment. | Product/Compliance / action needed |
| Privacy and school data use | School-managed pupil accounts exist. | `policies/privacy.html`, `policies/security.html`, `policies/terms.html`, `policies/dpia-support.html` | Pupil login uses school-managed username/PIN and server-side authentication/validation RPCs. Teacher/admin tooling can import pupils and reset PINs. | `js/authPupil.js`, `js/app.js`, `supabase/migrations/20260423120000_pupil_school_session_context.sql`, `supabase/tests/database/pupil_credential_reset.test.sql` | High | PIN storage and operational handling need formal school guidance and security review. | Document pupil credential handling expectations for schools. | Product/Compliance / action needed |
| Privacy and school data use | Data is used to provide spelling activities, progress review and teacher analytics. | `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html` | App creates tests, assignments, records attempts, displays progress/analytics, and exports analytics. | `js/game.js`, `js/teacherView.js`, `js/analyticsExport.js`, `tests/analytics-export.test.mjs` | High | Public wording should avoid broader data-use claims until operational records exist. | Keep privacy wording aligned with actual product workflows. | Product / ongoing |
| Privacy and school data use | School-managed data should remain school-scoped where supported. | `policies/privacy.html`, `policies/school-data.html`, `policies/security.html` | Active school context, school-scoped payload helpers, server-side requested-school parameters and RLS policies exist. | `js/db.js`, `tests/school-context-wiring.test.mjs`, `supabase/tests/database/tenant_server_side_rpc_scoping.test.sql` | High | Some legacy compatibility paths exist; deployed data should be checked for unmapped/default school records. | Periodically inspect school-scoping data health. | Engineering / ongoing |

## 3. Controller/Processor Role Assumptions

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Controller/processor role assumptions | School is usually controller for school-managed pupil data. | `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html` | Product is school-facing, teacher/admin managed, and pupils use school-issued credentials. | `js/authPupil.js`, `js/teacherView.js`, Supabase pupil/staff lifecycle migrations | Medium | This is a legal role assumption, not purely a code fact. Product setup and contracts may vary. | Confirm with school DPO/legal review. | Compliance / action needed |
| Controller/processor role assumptions | Wordloom is likely processor for school-managed pupil use. | `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html` | Product behaviour supports acting on school-managed data and school staff instructions. | App account, assignment, pupil, attempt and access-control flows | Low | No formal DPA or processor terms are present in the repo. | Draft formal Data Processing Agreement / processor terms. | Legal/Compliance / action needed |
| Controller/processor role assumptions | Wordloom may be controller for enquiries, demos, support and business administration. | `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html` | Public pages include contact routes. Demo/support tooling is visible, but business process evidence is outside app runtime. | `policies/*.html`, `supabase/functions/demo-school-data/index.ts` | Medium | Operational records and lawful basis documentation are not visible in repo. | Add controller-processing record for enquiries/support/business data. | Compliance / action needed |

## 4. Safeguarding And Pupil-Facing Safety

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Safeguarding and pupil-facing safety | Wordloom is not a social network and has no pupil-to-pupil messaging, public posting, open web search or open pupil AI chat. | `policies/safeguarding.html`, `policies/dpia-support.html` | Pupil views are assignment/practice/progress focused. Searches found teacher analytics chat only. | `js/pupilView.js`, `js/game.js`, `js/teacherView.js` | High | Static evidence should be repeated when new pupil features are added. | Add banned-surface scan for pupil messaging/search/chat terms. | Engineering / recommended |
| Safeguarding and pupil-facing safety | Pupil work is teacher-managed through assigned spelling activities. | `policies/safeguarding.html`, `policies/terms.html`, `policies/dpia-support.html` | Teachers create tests and assignments; pupils load runtime assignments and attempts. | `js/testBuilder.js`, `js/teacherView.js`, `js/pupilView.js`, `js/db.js` | High | Schools still control supervision and local safeguarding response. | Keep school-responsibility wording in public policies. | Product / ongoing |
| Safeguarding and pupil-facing safety | Context support is designed to avoid spelling clues but cannot guarantee every clue is prevented. | `policies/ai-use.html`, `policies/safeguarding.html` | Meaning validation blocks spelling-pattern explanations, target-word leaks and unavailable statuses. Teacher can edit before assignment. | `js/spellingContextSupport.js`, `js/testBuilder.js`, `tests/spelling-context-support.test.mjs` | High | Content quality risk remains, especially with AI-generated suggestions or teacher-entered text. | Add AI/context review checklist for teachers. | Product / recommended |
| Safeguarding and pupil-facing safety | Wordloom does not replace school safeguarding procedures. | `policies/safeguarding.html`, `policies/terms.html`, `policies/dpia-support.html` | Product provides contact/reporting wording but no safeguarding case-management workflow. | Policy pages only | Medium | This is primarily a shared-responsibility statement, not app-enforced. | Keep public wording clear that school DSL procedures remain primary. | Compliance / ongoing |

## 5. Cookie/Browser Storage

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Cookie/browser storage | Browser storage may support login, session handling, school context, accessibility preferences and product operation. | `policies/cookies.html`, `policies/security.html`, `policies/dpia-support.html` | Supabase auth persists sessions in local storage. App stores role, pupil session, active school and accessibility preferences. | `js/supabaseClient.js`, `js/app.js`, `js/authPupil.js`, `js/db.js`, `js/accessibility.js`, `js/testBuilder.js` | High | Storage inventory should be refreshed before adding analytics/tracking. | Maintain a storage inventory with key names and purposes. | Product/Engineering / recommended |
| Cookie/browser storage | No advertising or marketing cookies were visible in inspected app files. | `policies/cookies.html` | Searches found local/session storage use, but no visible advertising/tracking cookie implementation. | Search evidence across `js/` and policy files | High | Third-party scripts or deployment platform behaviour may add storage outside repo. | Confirm deployed site/platform tracking configuration. | Product/Engineering / action needed |
| Cookie/browser storage | Future optional analytics/advertising storage would need notice and consent review. | `policies/cookies.html` | No current in-app consent system is visible because optional tracking is not implemented. | Policy wording, absence of visible optional tracking implementation | Medium | Future product changes could require consent controls. | Add privacy/cookie review gate for any tracking feature. | Product / recommended |

## 6. Accessibility

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Accessibility | Some accessibility-related controls/preferences exist. | `policies/accessibility.html`, `policies/cookies.html`, `policies/dpia-support.html` | App supports overlay and font preferences in pupil-facing accessibility helper and test builder overlay setting. | `js/accessibility.js`, `js/testBuilder.js` | Medium | Controls are partial and not equivalent to full accessibility compliance. | Document which screens have controls and which do not. | Product/Engineering / action needed |
| Accessibility | No formal WCAG 2.2 AA audit has yet been completed. | `policies/accessibility.html` | Policy correctly avoids audit/compliance certification claims. | `policies/accessibility.html` | Low | Accessibility coverage across keyboard, screen reader, contrast and motion is not formally evidenced. | Run accessibility audit and update Accessibility Statement. | Product/Accessibility / action needed |
| Accessibility | Schools should test on their own devices, browsers and assistive technology. | `policies/accessibility.html`, `policies/dpia-support.html` | Policy frames accessibility as context-specific and school-reviewed. | Policy pages only | Medium | This is procedural guidance, not app-enforced. | Provide school accessibility testing notes once audit findings exist. | Product/Compliance / recommended |

## 7. Security And Access Control

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Security and access control | Teacher sign-in may use Supabase Auth and Google OAuth. | `policies/security.html`, `policies/privacy.html`, `policies/sub-processors.html`, `policies/dpia-support.html` | Teacher sign-in calls Supabase OAuth with Google provider. Supabase client persists auth sessions. | `js/app.js`, `js/authTeacher.js`, `js/supabaseClient.js` | High | Actual provider configuration must be confirmed in deployed Supabase project. | Confirm production auth providers and redirect settings. | Engineering / recommended |
| Security and access control | Pupil access uses school-managed credentials and server-side auth/validation. | `policies/security.html`, `policies/privacy.html`, `policies/dpia-support.html` | Pupil login calls `authenticate_pupil`; sessions are validated with `validate_pupil_runtime_session`. | `js/authPupil.js`, `supabase/migrations/20260423120000_pupil_school_session_context.sql`, `supabase/tests/database/pupil_credential_reset.test.sql` | High | PIN process requires operational guidance and security review. | Create pupil credential handling guidance. | Product/Compliance / action needed |
| Security and access control | Role-based access and school scoping exist where supported. | `policies/security.html`, `policies/privacy.html`, `policies/safeguarding.html`, `policies/dpia-support.html` | Staff access context exposes roles/capabilities. Active school context threads through helpers and RPCs. | `js/db.js`, `supabase/migrations/20260422160000_phase3a_active_school_runtime_context.sql`, `tests/tenant-active-school-context.test.mjs`, `tests/school-context-wiring.test.mjs` | High | Legacy/default school compatibility should be monitored. | Keep tenant data-health checks in release review. | Engineering / ongoing |
| Security and access control | Multi-school tenant scoping/RLS exists. | `policies/security.html`, `policies/school-data.html`, `policies/dpia-support.html` | Schema includes schools, school memberships, school IDs, RLS policies and server-side scoping tests. | `supabase/migrations/20260422131500_phase1_tenant_foundation.sql`, `supabase/migrations/20260422143000_phase2_tenant_roles_rls.sql`, `supabase/tests/database/tenant_roles_rls.test.sql`, `supabase/tests/database/tenant_server_side_rpc_scoping.test.sql` | High | Formal security audit has not been completed. | Run security/RLS review before broad rollout. | Engineering/Security / action needed |

## 8. Terms/Acceptable Use

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Terms/acceptable use | Wordloom is for school-managed spelling and literacy activity. | `policies/terms.html`, `policies/privacy.html`, `policies/school-data.html` | Core workflows are teacher-created tests, assignments, pupil practice, progress review and school data management. | `js/testBuilder.js`, `js/teacherView.js`, `js/pupilView.js`, `js/db.js` | High | Public terms are not a signed customer agreement. | Align commercial/school terms with product wording. | Product/Legal / action needed |
| Terms/acceptable use | Users must not access other schools' data, misuse accounts, bypass controls or upload harmful content. | `policies/terms.html`, `policies/security.html` | Access controls and tenant scoping reduce unauthorised access. Content upload surface appears limited to CSV/import and test content. | `js/db.js`, tenant/RLS migrations and tests, staff/pupil CSV import tests | Medium | Enforcement is partly technical and partly school/contract responsibility. | Add acceptable-use enforcement and support escalation process. | Product/Compliance / recommended |
| Terms/acceptable use | Staff should review AI-supported wording before assigning pupil-visible content. | `policies/terms.html`, `policies/ai-use.html`, `policies/safeguarding.html` | Test builder exposes generated words, sentences and meanings for teacher review/edit before save/assign. | `js/testBuilder.js`, `tests/spelling-context-support.test.mjs` | High | Teachers can still assign unsuitable text if they ignore warnings. | Add teacher guidance and review prompts in support materials. | Product / recommended |

## 9. Sub-Processors And Suppliers

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Sub-processors and suppliers | Supabase may be used for database, authentication and server-side functions. | `policies/privacy.html`, `policies/security.html`, `policies/sub-processors.html` | App imports Supabase browser client, uses Supabase Auth, database queries and Edge Functions. | `js/supabaseClient.js`, `js/db.js`, `ai.js`, `supabase/functions/*` | High | Supplier contract, region and production project configuration are not confirmed in repo. | Confirm Supabase DPA, region and security terms. | Compliance/Engineering / action needed |
| Sub-processors and suppliers | Google OAuth may be used for teacher sign-in. | `policies/privacy.html`, `policies/security.html`, `policies/sub-processors.html` | Teacher sign-in uses provider `google`. | `js/app.js`, `js/authTeacher.js` | High | Exact production OAuth client/provider settings are outside repo. | Confirm Google OAuth setup and applicable terms. | Engineering/Compliance / recommended |
| Sub-processors and suppliers | OpenAI API may support teacher-facing AI. | `policies/ai-use.html`, `policies/privacy.html`, `policies/sub-processors.html`, `policies/school-data.html` | Teacher analytics function calls OpenAI responses/chat completions API. Test builder calls `ai-suggest`, but source is not visible. | `supabase/functions/teacher-analytics-chat/index.ts`, `ai.js`, `js/testBuilder.js` | Medium | `ai-suggest` deployed source/provider, data fields and region are not fully confirmed from visible repo. | Verify `ai-suggest` deployed source/provider and OpenAI data-processing terms. | Engineering/Compliance / action needed |
| Sub-processors and suppliers | Supplier list is transparency information, not full legal schedule. | `policies/sub-processors.html` | Public page explicitly flags unknowns such as hosting region, email/support provider, payment, monitoring and due diligence. | `policies/sub-processors.html` | Low | Formal supplier due diligence and data residency are not confirmed. | Confirm supplier/sub-processor regions, DPAs, privacy/security terms. | Compliance / action needed |

## 10. DPIA Support

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| DPIA support | Wordloom provides information to support schools' DPIA process. | `policies/dpia-support.html` | DPIA page gathers product purposes, roles, data types, AI, access/security, risks and questions. | `policies/dpia-support.html` | Medium | DPIA support page is not a completed school DPIA or legal/data protection advice. | Seek school DPO/legal/data protection review. | Compliance / action needed |
| DPIA support | Built-in risk reduction includes school-managed accounts, teacher-managed assignments, no pupil messaging/open AI, school scoping and role-based access where supported. | `policies/dpia-support.html`, related policy pages | These controls are visible across pupil login, assignment flow, teacher areas and tenant/RLS implementation. | `js/authPupil.js`, `js/testBuilder.js`, `js/game.js`, tenant/RLS migrations and tests | High | Risk reduction does not remove all risk or replace school governance. | Keep DPIA language cautious and evidence-linked. | Product/Compliance / ongoing |
| DPIA support | Schools should assess lawful basis, notices, age/vulnerability, roles, training, credentials, devices, accessibility, retention, export/deletion and incident routes. | `policies/dpia-support.html` | Policy provides local assessment prompts. Product does not complete these local governance tasks. | `policies/dpia-support.html` | Medium | This is guidance, not implemented workflow. | Create school onboarding/DPIA pack once DPA, supplier and incident docs exist. | Compliance / action needed |

## 11. Retention/Deletion/Export

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Retention/deletion/export | Retention, deletion and export depend on school instructions, setup, record type and operational needs. | `policies/privacy.html`, `policies/school-data.html`, `policies/dpia-support.html` | Product includes archive/restore/delete helpers and analytics export, but no complete formal retention procedure is visible. | `js/db.js`, `js/teacherView.js`, `js/analyticsExport.js`, `tests/analytics-export.test.mjs` | Medium | Operational retention schedule and deletion/export request handling are not documented. | Create retention/deletion/export procedure. | Compliance/Engineering / action needed |
| Retention/deletion/export | Analytics exports are available for some teacher views. | `policies/privacy.html`, `policies/school-data.html`, implied by product use | Export models generate CSV/Excel outputs for analytics data. | `js/analyticsExport.js`, `js/teacherView.js`, `tests/analytics-export.test.mjs` | High | Export coverage may not equal full data-subject or school export coverage. | Review school offboarding/export/deletion flows. | Product/Engineering / action needed |
| Retention/deletion/export | Some records can be archived/restored or deleted by privileged users. | `policies/school-data.html`, `policies/security.html` | Staff/pupil lifecycle and automation policy archive/delete helpers exist. | `js/db.js`, `js/teacherView.js`, relevant Supabase lifecycle/scoping migrations and tests | Medium | Archive/delete helpers are not a formal retention/deletion workflow. | Define which records are retained, archived, deleted and exported. | Compliance/Engineering / action needed |

## 12. Incident Response / Security Reporting

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| Incident response / security reporting | Schools can report security concerns, suspected unauthorised access, account issues or product behaviour affecting school data/pupil use. | `policies/security.html`, `policies/safeguarding.html`, `policies/terms.html` | Public pages provide contact wording and what to include in reports. | Policy pages only | Medium | There is no full operational incident response or breach process visible in repo. | Create incident response and breach process. | Compliance/Security / action needed |
| Incident response / security reporting | Wordloom should not be treated as the school's safeguarding reporting route. | `policies/safeguarding.html`, `policies/terms.html` | Policy directs pupil safeguarding concerns to the school and its procedures. | Policy pages only | Medium | Product has no safeguarding case-management or escalation workflow. | Keep safeguarding reporting route clear in support materials. | Product/Compliance / ongoing |
| Incident response / security reporting | No formal security audit or certification is claimed. | `policies/security.html` | Public security statement explicitly avoids certification/audit claims. | `policies/security.html` | Low | Technical controls exist, but formal assurance evidence is incomplete. | Run security review/audit when ready for school procurement. | Security/Compliance / action needed |

## 13. App Gaps And Future Checks

| Policy area | Policy claim | Where claim appears | App behaviour that supports it | Code/schema/test evidence | Current confidence | Risk or caveat | Action needed | Owner/status |
|---|---|---|---|---|---|---|---|---|
| App gaps and future checks | Public policy wording should continue to describe actual product behaviour. | All policy pages include update/limits wording | Current policies are cautious and caveated. This matrix maps claims back to visible evidence. | Policy pages, this matrix | Medium | Matrix can drift as app features, suppliers and operations change. | Review matrix before policy changes and releases. | Product/Compliance / ongoing |
| App gaps and future checks | Formal DPA is not yet created. | `policies/privacy.html`, `policies/school-data.html`, `policies/terms.html` state pages are not full DPA | No DPA file or processor terms were found in visible docs. | `docs/`, policy pages | Low | Public transparency pages cannot replace contractual data processing terms. | Draft formal Data Processing Agreement / processor terms. | Legal/Compliance / action needed |
| App gaps and future checks | Formal accessibility audit is not completed. | `policies/accessibility.html` | Accessibility statement explicitly says no formal WCAG 2.2 AA audit has yet been completed. | `policies/accessibility.html` | Low | Accessibility controls exist but coverage is unverified. | Run accessibility audit and update Accessibility Statement. | Accessibility/Product / action needed |
| App gaps and future checks | Supplier due diligence, regions and data residency are not confirmed. | `policies/sub-processors.html`, `policies/school-data.html` | Sub-processors page flags unknown supplier/region/due-diligence items. | `policies/sub-processors.html` | Low | Procurement and DPO review will need stronger supplier evidence. | Confirm supplier/sub-processor regions, DPAs, privacy/security terms. | Compliance / action needed |
| App gaps and future checks | AI support should have risk assessment/assurance notes. | `policies/ai-use.html`, `policies/dpia-support.html` | Teacher AI features and minimisation caveats exist, but no standalone AI assurance file was found. | `ai.js`, `js/testBuilder.js`, `supabase/functions/teacher-analytics-chat/index.ts` | Medium | AI assurance is incomplete without model/provider/data-flow review. | Create AI risk assessment / AI assurance notes. | Product/Compliance / action needed |

## Action Register

| Action | Rationale | Suggested owner/status |
|---|---|---|
| Draft formal Data Processing Agreement / processor terms. | Public privacy and school-data pages are not a full legal DPA. | Legal/Compliance / action needed |
| Confirm ICO fee / registration position. | UK data protection governance position is not evidenced in the repo. | Compliance / action needed |
| Confirm supplier/sub-processor regions, DPAs, privacy/security terms. | Supabase, Google OAuth, OpenAI and technical delivery services need formal supplier evidence. | Compliance/Engineering / action needed |
| Create retention/deletion/export procedure. | Current app has partial archive/export/delete capabilities but no formal operational process. | Compliance/Engineering / action needed |
| Create incident response and breach process. | Security reporting wording exists, but no full operational incident/breach document is visible. | Security/Compliance / action needed |
| Run accessibility audit and update Accessibility Statement. | Accessibility statement correctly says no formal WCAG audit is complete. | Accessibility/Product / action needed |
| Create AI risk assessment / AI assurance notes. | Teacher-facing AI features need documented minimisation, review and provider assurance. | Product/Compliance / action needed |
| Verify `ai-suggest` deployed source/provider. | App calls `ai-suggest`, but visible repo source/provider was not confirmed. | Engineering / action needed |
| Review school offboarding/export/deletion flows. | Export and lifecycle helpers may not cover full school offboarding or data requests. | Product/Engineering / action needed |
| Seek school DPO/legal/data protection review. | Controller/processor roles, DPIA support and procurement evidence require external review. | Compliance / action needed |

## Verification Checklist

- Browser smoke test all policy links from the footer/navigation and direct URLs.
- Run policy banned-claim scans for unsupported terms such as certification, guaranteed compliance, full audit, full DPA, ICO registration, data residency guarantees, or absolute security.
- Run focused AI/context/scoring checks:
  - `node --test tests/spelling-context-support.test.mjs`
  - `node --test tests/pupil-feedback-model.test.mjs`
  - `node --test tests/pupil-practice-mode.test.mjs`
  - `node --test tests/spelling-bee-policy.test.mjs`
- Run tenant/RLS/server-side scoping tests where available:
  - `node --test tests/tenant-active-school-context.test.mjs tests/school-context-wiring.test.mjs`
  - `npx supabase test db`
- Run accessibility checks, including keyboard navigation, screen reader smoke testing, colour contrast, focus visibility and reduced-motion review.
- Review supplier list against actual deployed services, hosting, email/support, monitoring, payment and analytics tools.
- Review DPA, retention/export/deletion and incident/breach documents once created.

## Source Map

### Policy Pages

- `policies/ai-use.html`
- `policies/privacy.html`
- `policies/safeguarding.html`
- `policies/cookies.html`
- `policies/accessibility.html`
- `policies/security.html`
- `policies/terms.html`
- `policies/school-data.html`
- `policies/sub-processors.html`
- `policies/dpia-support.html`

### Main App Files

- `ai.js`
- `js/app.js`
- `js/authPupil.js`
- `js/authTeacher.js`
- `js/supabaseClient.js`
- `js/db.js`
- `js/game.js`
- `js/pupilView.js`
- `js/teacherView.js`
- `js/testBuilder.js`
- `js/spellingContextSupport.js`
- `js/spellingIndicator.js`
- `js/baselinePlacement.js`
- `js/accessibility.js`
- `js/analyticsExport.js`
- `supabase/functions/teacher-analytics-chat/index.ts`
- `supabase/functions/group-comparison/index.ts`
- `supabase/functions/demo-school-data/index.ts`

### Tests

- `tests/spelling-context-support.test.mjs`
- `tests/pupil-feedback-model.test.mjs`
- `tests/pupil-practice-mode.test.mjs`
- `tests/spelling-bee-policy.test.mjs`
- `tests/analytics-export.test.mjs`
- `tests/tenant-active-school-context.test.mjs`
- `tests/school-context-wiring.test.mjs`
- `tests/staff-csv-import.test.mjs`
- `tests/pupil-csv-import.test.mjs`

### Supabase Migrations/Database Tests

- `supabase/migrations/20260422131500_phase1_tenant_foundation.sql`
- `supabase/migrations/20260422143000_phase2_tenant_roles_rls.sql`
- `supabase/migrations/20260422160000_phase3a_active_school_runtime_context.sql`
- `supabase/migrations/20260423120000_pupil_school_session_context.sql`
- `supabase/migrations/20260424133000_phase3b2_server_side_school_scoping.sql`
- `supabase/migrations/20260501120000_spelling_context_support_cache.sql`
- `supabase/tests/database/security_hardening_rls.test.sql`
- `supabase/tests/database/tenant_foundation.test.sql`
- `supabase/tests/database/tenant_roles_rls.test.sql`
- `supabase/tests/database/tenant_runtime_context.test.sql`
- `supabase/tests/database/tenant_server_side_rpc_scoping.test.sql`
- `supabase/tests/database/pupil_credential_reset.test.sql`
- `supabase/tests/database/pupil_runtime_assignments_rpc.test.sql`
- `supabase/tests/database/spelling_context_support_cache.test.sql`

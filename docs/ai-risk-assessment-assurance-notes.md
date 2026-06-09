# Wordloom AI Risk Assessment / AI Assurance Notes

Status: Internal draft for review

Last reviewed: May 2026

Core caveat: This is not a certification, not legal advice, not a public compliance claim, and not proof that AI use is free from risk. It should be reviewed against current DfE/ICO guidance, school requirements, provider terms and deployed product behaviour.

This document is an internal review and support note for Wordloom AI use. It is intended to help product, engineering, school, DPO, legal and data protection reviewers understand current AI use, known limits, current controls and items still to confirm.

## 1. Status and review note

These notes are a draft internal review record. They should not be presented as a formal certification, school DPIA, procurement assurance, legal advice, data protection advice or public compliance claim.

The notes are based on the current visible repository evidence as of May 2026, including public policy pages, internal compliance documents and product code. Deployed source, provider configuration and operational records may differ and must be confirmed before relying on these notes for school onboarding or procurement review.

AI use in Wordloom is designed to support teacher preparation and review where used. It is not a substitute for teacher judgement, school safeguarding procedures, specialist assessment, school governance, DPO review or legal review.

## 2. Purpose of these notes

The purpose of these notes is to document:

- where AI may be used in Wordloom;
- where AI is not currently used based on visible repository evidence;
- what data may be sent to AI services where features are used;
- what data staff should avoid entering into AI prompts;
- pupil exposure controls and teacher review expectations;
- known AI risks and current mitigations;
- provider, data-flow and operational items still to confirm;
- tests and checks that should be maintained to support confidence.

These notes support the compliance evidence matrix and related internal procedures. They do not replace the school's own DPIA, supplier review, safeguarding review, accessibility review, procurement review or written terms.

## 3. AI feature inventory

| Feature area | Current evidence | Data that may be involved | Current control or caveat | Status |
| --- | --- | --- | --- | --- |
| Teacher preparation: word generation | `js/testBuilder.js` calls `aiSuggest` through `ai.js`; `ai.js` calls Supabase function `ai-suggest`. | Teacher-entered focus grapheme, theme/topic, extra instruction and requested word count. | Output is parsed into words and filtered for simple one-word entries. Deployed `ai-suggest` source/provider is not visible in `supabase/functions`. | In use where feature is used; provider details to be confirmed. |
| Teacher preparation: sentence suggestions | `js/testBuilder.js` calls `aiSuggest` to write short pupil-friendly sentences for teacher test builder rows. | Target spelling word and prompt instructions. | Teachers can review/edit before assignment. Output may still need human review for suitability and spelling clues. | In use where feature is used; review expected. |
| Teacher preparation: meaning suggestions | `js/testBuilder.js` calls `aiSuggest`; returned meanings are checked with `validateMeaningSupportText` and target-word checks before insertion. | Target spelling word and prompt instructions. | Unsafe or unsuitable suggested meanings may be skipped and left for manual entry. Checks reduce risk but do not remove every content risk. | In use where feature is used; review expected. |
| Context support validation | `js/spellingContextSupport.js` validates meaning text and blocks hidden, needs-review and AI-generated cache statuses from pupil snapshots until promoted. | Sentences, meanings, context cache status and related context support metadata. | Context support is separate from scoring. Some generated or edited content may still require teacher review. | Current mitigation present. |
| Teacher-facing analytics assistant | `supabase/functions/teacher-analytics-chat/index.ts` uses `OPENAI_API_KEY`, `OPENAI_ANALYTICS_MODEL` or default `gpt-4.1-mini`, and sends scoped analytics context to OpenAI. | Teacher question, recent conversation turns, scope, class/assignment/pupil summaries, names/usernames where included, attempts, accuracy, first-try success, average attempts and weak graphemes. | Function checks teacher authentication and scope visibility in code before building context. Teacher analytics AI may receive analytics context, including pupil-related summaries where used. | In use where feature is used; provider and data-flow details to be confirmed. |
| Analytics chat history | `js/teacherView.js` creates and saves analytics assistant threads/messages where history is available. | Teacher questions, assistant replies, scope labels and metadata. | Retention/export/deletion handling for analytics chat records is to be confirmed. | Handling to be confirmed. |

## 4. Where AI is not used

Based on current visible repository evidence:

- Pupils do not have open AI chat.
- AI is not called during pupil spelling tests based on current repo evidence.
- Pupil spelling scores are not judged by AI.
- Pupil gameplay scoring in `js/game.js` is based on local answer matching against expected words or grapheme parts.
- Context support is separate from scoring.
- AI analytics support should not be treated as diagnosis, safeguarding decision-making, formal assessment or automatic intervention assignment.

These statements should be re-checked before each public policy review and whenever pupil runtime files, test modes, analytics features or AI functions change.

## 5. Data that may be sent to AI

Where AI features are used, prompts may include the minimum data needed to provide the requested support.

For teacher preparation, this may include:

- target spelling words;
- focus graphemes or spelling patterns;
- teacher-entered topics or extra instructions;
- prompts asking for spelling words, short sentences, meanings or splits.

For teacher-facing analytics, this may include:

- teacher questions and recent conversation turns;
- selected scope such as overview, assignment, class, year group or pupil;
- class and assignment summaries;
- pupil-related analytics summaries where used;
- attempt-derived metrics such as accuracy, first-try success, average attempts and weak graphemes;
- pupil display names or usernames where included in the analytics context.

Staff should avoid unnecessary pupil personal data in prompts. Schools and staff should use the minimum information needed and should not add sensitive, safeguarding, health, family, behavioural or special category details unless there has been a separate school-led assessment and instruction.

## 6. Data minimisation rules

Staff and product reviewers should apply these practical minimisation rules:

- Do not use unnecessary pupil personal data in AI prompts.
- Use class, group, assignment or pseudonymous references where that is enough for the task.
- Keep teacher preparation prompts focused on spelling content rather than pupil identity.
- Avoid adding pupil health, safeguarding, family, disability, behaviour or disciplinary details into prompts.
- Avoid pasting exports, screenshots or support material into prompts unless necessary and reviewed.
- Keep AI analytics questions focused on patterns in the supplied analytics evidence.
- Treat AI prompt and output records as school data where they include school-managed information.
- Log and review any prompt incident where too much pupil personal data may have been entered.

Data minimisation is partly procedural and depends on staff training, school expectations and product controls. Additional in-product prompts or checklists may be needed.

## 7. Pupil exposure controls

Current controls and product boundaries include:

- pupils do not have open AI chat;
- pupil work is teacher-managed through assignments and spelling activities;
- AI is not called while pupils complete spelling tests based on current repo evidence;
- teacher preparation output is surfaced in the test builder for review/edit before assignment;
- meaning suggestions are checked before insertion and may be rejected;
- context cache rows with AI-generated, hidden or needs-review statuses are not treated as pupil-usable snapshots until promoted;
- optional context support remains separate from scoring.

These controls are designed to reduce risk, not remove it. Pupil-facing content can still become unsuitable if generated or edited text is not reviewed carefully.

## 8. Teacher review and human oversight

Teacher review is expected, but this should not be read as a claim that every AI output has been checked or is suitable.

Teachers should:

- review generated words, sentences and meanings before assigning work;
- check that meanings and sentences are age-appropriate and school-appropriate;
- check that generated meanings or sentences do not give spelling clues;
- edit or remove unsuitable content;
- use analytics AI as a planning aid, not as a substitute for teacher judgement;
- treat analytics suggestions as prompts for review rather than automatic decisions;
- involve SENCo, safeguarding, pastoral or school leadership routes where pupil needs or concerns require professional review.

Product and support materials should make clear that AI-supported content and analytics require human review.

## 9. Scoring and assessment boundaries

Pupil spelling scoring is currently separate from AI use. `js/game.js` logs pupil attempts with deterministic `correct` values from local answer matching, not AI judgement.

Current boundaries:

- pupil spelling scores are not judged by AI;
- expected spellings or grapheme parts are compared with pupil input locally;
- attempt records include a boolean correctness value produced by deterministic scoring logic;
- context support does not change whether a submitted spelling answer is correct;
- teacher-facing analytics AI can discuss patterns in the supplied analytics context but should not make formal diagnoses or replace professional assessment.

Future question types, analytics features or AI features should be reviewed against this boundary before release.

## 10. Known AI risks

| Risk | Example | Potential impact | Current note |
| --- | --- | --- | --- |
| Inaccurate output | AI returns an incorrect word, misleading meaning or unsuitable sentence. | Pupils may see weak teaching content if not reviewed. | Teacher review and validation checks reduce but do not remove this risk. |
| Spelling clues in generated meanings/sentences | A meaning explains letters, graphemes, sounds or includes the target word. | The spelling task may be made easier or less valid. | Meaning validation blocks some spelling-clue patterns; sentences still require teacher review. |
| Unnecessary pupil personal data in prompts | Staff include names, needs, safeguarding details or support notes beyond what is needed. | Data minimisation and confidentiality risks. | Staff should avoid unnecessary pupil personal data and use the minimum information needed. |
| Analytics overinterpretation | AI describes a pupil as needing formal assessment based only on limited spelling evidence. | Teachers may over-weight weak or incomplete evidence. | Analytics prompt instructs the assistant to be evidence-based and not diagnose; teacher judgement remains required. |
| Bias or inappropriate suggestions | AI suggests examples, language or intervention ideas that do not suit the pupil, class or school context. | Content may be inappropriate, exclusionary or ineffective. | Human review and school context are required. |
| Teacher overreliance | Staff accept AI suggestions without checking content or evidence. | Reduced professional oversight and possible unsuitable assignments. | Training, review expectations and product wording should reinforce human review. |
| Supplier/provider changes | Model, provider settings, terms or processing behaviour change. | Data-flow, retention, transfer or assurance assumptions may become outdated. | Provider and model configuration are to be confirmed and reviewed over time. |
| Retention/export/deletion gaps | AI prompts, outputs, context cache or chat history are not covered by current export/deletion processes. | Schools may not receive complete operational handling for AI records. | Internal retention/deletion/export procedure marks AI/context handling to be confirmed. |
| Unclear deployed `ai-suggest` source/provider | Visible repo calls `ai-suggest`, but no source exists in `supabase/functions`. | Provider, model, prompt fields, logging and retention are unclear. | Deployed function source/provider must be verified. |
| Incomplete formal assurance review | Internal evidence exists, but provider terms, deployed behaviour and guidance review are incomplete. | Schools may need stronger assurance before rollout. | Formal AI assurance review against current DfE/ICO guidance is to be completed. |

## 11. Current mitigations

| Risk area | Current mitigation | Evidence | Remaining caveat |
| --- | --- | --- | --- |
| Open pupil AI exposure | Pupils do not have open AI chat; pupil runtime appears focused on assignments, practice and progress. | `docs/compliance-evidence-matrix.md`, `policies/ai-use.html`, `js/pupilView.js`, `js/game.js`. | Re-check when pupil features change. |
| AI during spelling tests | AI calls are outside current pupil gameplay based on visible repo evidence. | `ai.js`, `js/game.js`, `supabase/functions/teacher-analytics-chat/index.ts`. | Add static checks for AI imports/calls in pupil runtime files. |
| AI scoring | `js/game.js` determines correctness by local matching against expected answer content. | `js/game.js`; pupil feedback and practice tests. | New question types should preserve deterministic scoring unless separately reviewed. |
| Meaning clue risk | Meaning prompts instruct AI not to use the target word or spelling-pattern explanations; returned meanings are validated before insertion. | `js/testBuilder.js`, `js/spellingContextSupport.js`, `tests/spelling-context-support.test.mjs`. | Sentences and teacher-entered content still need review. |
| Pupil-usable context support | AI-generated, hidden and needs-review cache statuses are blocked from pupil snapshots until promoted. | `js/spellingContextSupport.js`, `tests/spelling-context-support.test.mjs`. | Promotion/review process and operational guidance need confirmation. |
| Analytics overinterpretation | Analytics system prompt requires evidence, sample-size caution and no dyslexia diagnosis. | `supabase/functions/teacher-analytics-chat/index.ts`. | Output can still be incomplete or over-weighted by users. |
| School/scope access for analytics | Analytics function checks teacher authentication and scope visibility before building context. | `supabase/functions/teacher-analytics-chat/index.ts`. | Production function settings and deployed code should be verified. |
| Retention/export/deletion awareness | Internal retention procedure identifies AI/context records and marks handling to be confirmed. | `docs/retention-deletion-export-procedure.md`. | Operational process is not settled. |

## 12. Provider and data-flow review

| Item | Current evidence | To be confirmed |
| --- | --- | --- |
| `ai-suggest` deployed source | `ai.js` calls Supabase function `ai-suggest`; no matching source directory is visible under `supabase/functions`. | Deployed source, provider, model, prompt/data fields, logging, retention and region. |
| Teacher analytics provider | `teacher-analytics-chat` calls OpenAI using `OPENAI_API_KEY` and `OPENAI_ANALYTICS_MODEL`, defaulting to `gpt-4.1-mini` if no model is set. | OpenAI data-processing terms, sub-processor position, retention/abuse-monitoring settings, transfer safeguards and model configuration. |
| Teacher analytics data flow | Function builds scoped analytics context and sends the question, recent conversation and analytics JSON to OpenAI. | Production data flow for prep AI and analytics AI, including where prompts, outputs, chat history and context are stored. |
| Prompt and output storage | `js/teacherView.js` can save analytics assistant threads/messages where history is available; context support records may exist. | Retention, export, deletion and incident handling for AI prompts, AI outputs, context cache records and analytics chat records. |
| Feature availability | Public and internal docs describe AI support as limited and teacher-facing where used. | Whether AI features are optional, configurable or excludable for specific school setups. |
| Teacher guidance | Current policies say staff should review AI-supported wording and avoid unnecessary pupil personal data. | Teacher guidance/training expectations and whether extra in-product prompts/checklists should be built. |
| External guidance review | Internal matrix identifies AI assurance notes as an action-needed gap. | Formal AI assurance review against current DfE/ICO guidance. |

## 13. Testing and monitoring

The following checks should be run or maintained when this document is created or reviewed:

- banned wording scan for unsupported claims in this file;
- static search that pupil runtime files do not import or call `aiSuggest`, `teacherAnalyticsChat`, `ai-suggest`, `teacher-analytics-chat`, `OPENAI_API_KEY` or OpenAI APIs;
- evidence search for `ai-suggest`, `teacher-analytics-chat`, `OPENAI_API_KEY`, `OPENAI_ANALYTICS_MODEL` and `OpenAI`;
- `node --test tests/spelling-context-support.test.mjs`;
- `node --test tests/pupil-feedback-model.test.mjs`;
- `node --test tests/pupil-practice-mode.test.mjs`;
- `node --test tests/spelling-bee-policy.test.mjs`;
- review of `supabase/functions/teacher-analytics-chat/index.ts` authentication, school-scope and context-building behaviour;
- review of deployed `ai-suggest` source/provider before relying on this document for school assurance;
- review of retention/export/deletion handling for AI/context records after any product or supplier change.

Monitoring should include periodic review of provider terms, model configuration, prompts, product surfaces, support incidents and school feedback about AI-supported content.

## 14. Actions still to confirm/build

| Action | Rationale | Suggested owner/status |
| --- | --- | --- |
| Verify deployed `ai-suggest` source/provider. | Visible repo calls `ai-suggest`, but source/provider is not visible in `supabase/functions`. | Engineering / action needed |
| Document `ai-suggest` data flow. | Prep AI prompt fields, model, provider, logging, retention and region need confirmation. | Engineering/Compliance / action needed |
| Confirm OpenAI terms and configuration. | Analytics AI uses OpenAI and may receive pupil-related analytics summaries where used. | Compliance/Engineering / action needed |
| Confirm AI feature configurability. | Schools may need to know whether AI features can be enabled, disabled or excluded from a setup. | Product/Engineering / action needed |
| Map AI records to retention/export/deletion procedure. | Prompts, outputs, context cache and analytics chat records need operational handling. | Compliance/Engineering / action needed |
| Add teacher guidance or checklist. | Staff should review output and avoid unnecessary pupil personal data. | Product/Compliance / recommended |
| Add static pupil-runtime AI checks. | Matrix recommends re-checking that AI calls remain outside pupil spelling-test runtime. | Engineering / recommended |
| Review against current DfE/ICO guidance. | Formal AI assurance review remains incomplete without current external guidance and provider review. | Product/Compliance/DPO / action needed |
| Review incident handling for AI prompt concerns. | Support and incident processes should handle over-disclosure or unsuitable AI output concerns. | Security/Compliance / recommended |

## 15. Version history

| Date | Status | Notes |
| --- | --- | --- |
| May 2026 | Internal draft for review | Initial internal AI risk assessment / assurance notes based on current policy pages, compliance evidence matrix, internal procedures and visible repo evidence. Provider/data-flow items remain to be confirmed. |

This document should be reviewed whenever AI features, pupil runtime features, scoring behaviour, analytics context, supplier arrangements, provider terms, school requirements, public policy wording, DfE/ICO guidance or deployed product behaviour change.

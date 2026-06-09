# Accessibility Testing Checklist and Findings Log

Status: Internal draft for review

Last reviewed: 5 May 2026

## 1. Purpose

This document helps Wordloom record accessibility checks, findings, fixes and retest notes. It is designed to support accessibility review, school procurement conversations, DPO and safeguarding confidence, public accessibility wording, and future improvement planning.

The log should help Wordloom track what has been reviewed, what is still to be tested, what findings need action, and what evidence exists before public wording is updated.

## 2. Status and limitations

This document is not a formal accessibility audit and does not claim that WCAG compliance has been achieved.

It does not claim that Wordloom is fully accessible and does not replace formal accessibility testing or specialist review. Formal or specialist review may still be needed before schools rely on Wordloom for particular access needs or before stronger public accessibility claims are made.

Findings should be checked against the current live product, not only older screenshots, local builds or previous review notes. Any uncertain item should be marked as "To be confirmed".

## 3. How to use this log

- Record each test session, including tester, environment, device, browser and assistive technology used.
- Test key pupil, teacher, admin and public flows.
- Log issues with evidence, affected flow, user impact and action needed.
- Assign priority, owner and status for each action.
- Retest after fixes and record the result.
- Update public accessibility wording only when current evidence supports it.

## 4. Test session record

| Date | Tester | Build/version or commit | Environment | Device/browser | Assistive technology used | Areas tested | Notes |
|---|---|---|---|---|---|---|---|
| To be completed | To be completed | To be completed | To be completed | To be completed | To be completed | To be completed | To be completed |

## 5. Accessibility checklist

| Area | What to check | Example Wordloom flows | Status | Notes / evidence |
|---|---|---|---|---|
| Keyboard navigation | Check whether users can reach, operate and leave interactive controls using the keyboard only. | Public homepage, login, pupil test controls, teacher dashboard, test builder, admin panels. | Not tested | To be confirmed. |
| Visible focus states | Check that focus is visible and understandable on links, buttons, form fields, custom controls and navigation. | Public pages, pupil dashboard, spelling activity controls, teacher toolbar actions. | Not tested | To be confirmed. |
| Screen reader smoke checks | Check page names, headings, landmarks, control names, form labels, error messages and dynamic updates with at least one screen reader setup. | Public pages, login, pupil test flow, teacher dashboard, forms. | Not tested | Needs specialist review where deeper testing is required. |
| Heading structure and landmarks | Check that headings are ordered clearly and landmarks support navigation. | Public homepage, public policy pages, teacher dashboard sections, pupil dashboard. | Not tested | To be confirmed. |
| Form labels and instructions | Check that fields have clear labels, instructions and accessible names. | Teacher login, pupil login, test builder, import flows, staff access forms. | Not tested | To be confirmed. |
| Error messages and validation | Check that errors are specific, visible, announced where appropriate, and do not rely only on colour. | Login errors, builder validation, CSV/import errors, pupil answer feedback. | Not tested | To be confirmed. |
| Colour contrast | Check text, controls, focus indicators, chart labels and important status colours against relevant contrast expectations. | Public pages, cards, teacher dashboards, pupil feedback, charts. | Not tested | To be confirmed. |
| Text size and readability | Check that wording, line length, spacing and text size are readable for pupils and staff. | Pupil tests, pupil dashboard/progress cards, teacher analytics, policy pages. | Not tested | To be confirmed. |
| Zoom and reflow at 200% | Check that screens remain usable at 200% zoom without loss of content or functionality. | Public pages, login, pupil tests, teacher dashboard, builder, analytics. | Not tested | To be confirmed. |
| Touch target size and spacing | Check that touch controls are large enough and spaced well on likely school devices. | Pupil spelling controls, dashboard cards, mobile public pages, teacher buttons. | Not tested | To be confirmed. |
| Reduced motion / animation sensitivity | Check whether animations, transitions or progress effects respect motion sensitivity where relevant. | Public homepage, pupil test feedback, dashboards, loading states. | Not tested | To be confirmed. |
| Audio controls and replay controls | Check that audio instructions or listen features have clear controls, replay support and alternatives where needed. | Pupil spelling test flow, audio/listen controls, instructions. | Not tested | To be confirmed. |
| Pupil login flow | Check labels, instructions, keyboard access, errors, focus order, readability and school-managed credential handling. | Pupil username/PIN login and session entry. | Not tested | To be confirmed. |
| Pupil spelling test flow | Check keyboard-only use, answer controls, instructions, feedback, audio, focus movement and non-colour cues. | Spell Loom, segmented spelling, arrange what you hear and other pupil activity types. | Not tested | To be confirmed. |
| Pupil dashboard/progress cards | Check headings, card structure, progress wording, colour cues, touch access and screen reader readability. | Pupil dashboard, progress cards, assignments and follow-up practice. | Not tested | To be confirmed. |
| Teacher login flow | Check sign-in controls, labels, errors, focus order, keyboard access and screen reader names. | Teacher sign-in and Google OAuth entry where used. | Not tested | To be confirmed. |
| Teacher dashboard | Check navigation, focus order, headings, status messages, card actions, modals and responsive layout. | Teacher dashboard, class overview, assignments, pupil lists. | Not tested | To be confirmed. |
| Test builder | Check form fields, generated content controls, validation, keyboard operation, focus handling and review steps. | Create/edit tests, word rows, sentence/meaning fields, overlay settings. | Not tested | To be confirmed. |
| Analytics dashboards/charts | Check chart names, summaries, keyboard access, colour use, table alternatives and export routes. | Progress over time, rankings, comparisons, analytics assistant and chart panels. | Not tested | Needs specialist review where charts need non-visual alternatives. |
| CSV/import/export flows | Check file controls, instructions, validation errors, progress, downloadable outputs and recovery guidance. | Pupil/staff imports, analytics export and spreadsheet-related workflows. | Not tested | To be confirmed. |
| Admin/staff access flows | Check permission controls, pending approvals, role selection, audit/history views and confirmation messages. | Staff access management, approvals, directory actions, audit panels. | Not tested | To be confirmed. |
| Automation/policy builder flows | Check complex configuration controls, labels, state changes, validation and keyboard access. | Automation rules, personalised policy builder and related admin controls. | Not tested | To be confirmed. |
| Public homepage | Check headings, navigation, links, focus states, images, contrast, zoom and mobile layout. | Homepage visitor journey and trust/safety sections. | Not tested | To be confirmed. |
| Public policy pages | Check semantic structure, link text, focus states, readability, contrast and mobile reflow. | Privacy, school data, accessibility, safeguarding, AI use, cookies, security, terms and sub-processors pages. | Not tested | To be confirmed. |

Status options: Not tested; Pass in smoke test; Finding logged; Needs specialist review; Not applicable; To be confirmed.

## 6. Findings log

| ID | Date | Area / flow | Finding | User impact | Evidence | Severity | Action needed | Owner | Status | Retest notes |
|---|---|---|---|---|---|---|---|---|---|---|
| To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed | To be confirmed |

Severity options: Low; Medium; High; Critical; To be confirmed.

Status options: Open; In progress; Fixed pending retest; Retested and closed; Accepted limitation; To be confirmed.

## 7. Suggested test flows

Public visitor flow:

- Open the public homepage.
- Navigate to policy pages using links and keyboard focus.
- Check page headings, link names, focus states, contrast, zoom and mobile readability.

Teacher/staff flow:

- Sign in as a teacher or staff user.
- Move through dashboard, class, assignment, pupil and analytics areas.
- Check navigation, forms, status messages, modals, tables, charts and exports.

Admin flow:

- Review staff access, role, approval and directory management screens.
- Check labels, confirmations, audit/history records, focus order and error messages.
- Confirm that complex admin actions remain understandable without relying only on colour or layout.

Pupil flow:

- Sign in with school-managed pupil credentials.
- Review dashboard/progress cards and assignment entry.
- Check readability, touch targets, audio/replay controls, focus handling and feedback wording.

Assessment/test-taking flow:

- Complete representative spelling activity types.
- Check keyboard-only use, answer entry, validation, feedback, replay controls, progress indicators and completion messages.
- Confirm that progress and errors are not communicated only by colour or visual position.

Analytics/reporting flow:

- Review analytics dashboards, rankings, comparisons and exports.
- Check whether charts have meaningful labels, summaries or table alternatives.
- Check whether exported reports support school review and whether inaccessible chart-only information is avoidable.

## 8. Accessibility risk notes

- Complex dashboards and charts may need alternative summaries, table views or text explanations.
- Spelling and phonics visuals may need text equivalents or careful explanation so that pupils and staff can understand the task.
- Audio-based spelling tasks must support replay and clear instructions.
- Keyboard-only use must be checked across interactive test types.
- Colour and visual cues should not be the only way to understand progress, status, errors or success.
- Mobile pupil use needs touch target, spacing and readability checks on likely school devices.
- Screen reader behaviour may vary by browser, operating system and assistive technology.
- Public accessibility wording should stay cautious until testing evidence exists.
- Findings from local builds, screenshots or older sessions should be retested against the current live product before being relied on.

## 9. Action register

| Action | Owner | Priority | Status | Notes |
|---|---|---|---|---|
| Complete keyboard-only smoke test. | To be confirmed | High | To be confirmed | Include pupil, teacher, admin and public flows. |
| Complete screen reader smoke test. | To be confirmed | High | To be confirmed | Record screen reader, browser and operating system used. |
| Check colour contrast on core screens. | To be confirmed | High | To be confirmed | Include text, buttons, focus indicators, cards and charts. |
| Check 200% zoom/reflow on public and app screens. | To be confirmed | High | To be confirmed | Include public pages, login, pupil flows, teacher dashboard and builder. |
| Review pupil spelling test accessibility. | To be confirmed | High | To be confirmed | Include keyboard, audio/replay, instructions, feedback and non-colour cues. |
| Review dashboards/charts for non-visual alternatives. | To be confirmed | High | To be confirmed | Identify where summaries, tables or exports are needed. |
| Review forms/errors in login, builder and import flows. | To be confirmed | High | To be confirmed | Check labels, instructions, validation and recovery guidance. |
| Document known limitations. | To be confirmed | Medium | To be confirmed | Use cautious wording and avoid compliance overclaims. |
| Retest fixed issues. | To be confirmed | High | To be confirmed | Record retest date, build/version and result. |
| Decide whether specialist accessibility audit is needed. | To be confirmed | High | To be confirmed | Consider school rollout, procurement needs and access-risk profile. |
| Update public accessibility statement only when evidence supports wording. | To be confirmed | High | To be confirmed | Do not claim full accessibility or WCAG compliance unless formally supported. |

## 10. Review cadence

Review this document:

- before first school rollout;
- before updating public accessibility claims;
- after major UI changes;
- after new pupil-facing test types are added;
- after dashboard or analytics changes;
- after accessibility fixes;
- after any accessibility-related complaint or support issue;
- at least annually.

This document is an internal working log. It should be reviewed alongside Wordloom's Accessibility Statement, safeguarding statement, school data use statement, incident response process, and product testing notes. It supports evidence gathering and improvement planning, but does not replace formal accessibility testing or specialist review.

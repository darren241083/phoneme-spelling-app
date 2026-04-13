alter table if exists public.classes
  add column if not exists year_group text;

alter table if exists public.attempts
  add column if not exists assignment_id uuid,
  add column if not exists test_word_id uuid,
  add column if not exists attempt_number integer,
  add column if not exists attempts_allowed integer,
  add column if not exists word_text text,
  add column if not exists attempt_source text,
  add column if not exists target_graphemes jsonb,
  add column if not exists focus_grapheme text,
  add column if not exists pattern_type text;

create index if not exists idx_classes_teacher_year_group
  on public.classes (teacher_id, year_group);

create index if not exists idx_pupil_classes_class_active_pupil
  on public.pupil_classes (class_id, active, pupil_id);

create index if not exists idx_assignments_v2_teacher_class_test_created
  on public.assignments_v2 (teacher_id, class_id, test_id, created_at desc);

create index if not exists idx_attempts_assignment_pupil_word_created
  on public.attempts (assignment_id, pupil_id, test_word_id, created_at desc);

create index if not exists idx_attempts_pupil_focus_created
  on public.attempts (pupil_id, focus_grapheme, created_at desc);

create index if not exists idx_attempts_assignment_created
  on public.attempts (assignment_id, created_at desc);

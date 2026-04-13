alter table if exists public.assignment_pupil_statuses
  add column if not exists total_words integer not null default 0,
  add column if not exists correct_words integer not null default 0,
  add column if not exists average_attempts double precision not null default 0,
  add column if not exists score_rate double precision not null default 0,
  add column if not exists result_json jsonb not null default '[]'::jsonb;

create index if not exists idx_assignment_pupil_statuses_assignment_completed
  on public.assignment_pupil_statuses (assignment_id, completed_at desc);

alter table if exists public.tests
  add column if not exists analytics_target_words_enabled boolean not null default false;

alter table if exists public.tests
  add column if not exists analytics_target_words_per_pupil integer not null default 3;

alter table if exists public.assignments_v2
  add column if not exists analytics_target_words_enabled boolean not null default false;

alter table if exists public.assignments_v2
  add column if not exists analytics_target_words_per_pupil integer not null default 3;

begin;

alter table public.personalised_generation_run_pupils
  drop constraint if exists personalised_generation_run_pupils_status_check;

alter table public.personalised_generation_run_pupils
  add constraint personalised_generation_run_pupils_status_check
  check (
    status in (
      'included',
      'skipped',
      'waiting'
    )
  );

alter table public.personalised_generation_run_pupils
  drop constraint if exists personalised_generation_run_pupils_skip_reason_check;

alter table public.personalised_generation_run_pupils
  add constraint personalised_generation_run_pupils_skip_reason_check
  check (
    skip_reason is null
    or skip_reason in (
      'baseline_incomplete',
      'no_baseline_assignment',
      'active_automated_assignment',
      'duplicate_pupil_in_run'
    )
  );

commit;

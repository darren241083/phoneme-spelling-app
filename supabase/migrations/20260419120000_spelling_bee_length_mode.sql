alter table public.personalised_automation_policies
  add column if not exists bee_length_mode text;

alter table public.personalised_generation_runs
  add column if not exists bee_length_mode text;

alter table public.spelling_bee_results
  add column if not exists bee_length_mode text not null default 'capped';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'personalised_automation_policies_bee_length_mode_check'
      and conrelid = 'public.personalised_automation_policies'::regclass
  ) then
    alter table public.personalised_automation_policies
      drop constraint personalised_automation_policies_bee_length_mode_check;
  end if;

  alter table public.personalised_automation_policies
    add constraint personalised_automation_policies_bee_length_mode_check
    check (bee_length_mode is null or bee_length_mode in ('capped', 'until_wrong'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'personalised_generation_runs_bee_length_mode_check'
      and conrelid = 'public.personalised_generation_runs'::regclass
  ) then
    alter table public.personalised_generation_runs
      drop constraint personalised_generation_runs_bee_length_mode_check;
  end if;

  alter table public.personalised_generation_runs
    add constraint personalised_generation_runs_bee_length_mode_check
    check (bee_length_mode is null or bee_length_mode in ('capped', 'until_wrong'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'spelling_bee_results_bee_length_mode_check'
      and conrelid = 'public.spelling_bee_results'::regclass
  ) then
    alter table public.spelling_bee_results
      drop constraint spelling_bee_results_bee_length_mode_check;
  end if;

  alter table public.spelling_bee_results
    add constraint spelling_bee_results_bee_length_mode_check
    check (bee_length_mode in ('capped', 'until_wrong'));
end $$;

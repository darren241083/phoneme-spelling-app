alter table public.personalised_generation_run_pupils
  drop constraint if exists personalised_generation_run_pupils_skip_reason_check;

alter table public.personalised_generation_run_pupils
  add constraint personalised_generation_run_pupils_skip_reason_check
  check (
    skip_reason is null
    or skip_reason in (
      'baseline_incomplete',
      'active_automated_assignment',
      'duplicate_pupil_in_run'
    )
  );

do $$
declare
  function_sql text;
  previous_join text := $previous$
  inner join public.tests as t
    on t.id = a.test_id
),$previous$;
  guarded_join text := $guarded$
  inner join public.tests as t
    on t.id = a.test_id
  where
    lower(btrim(coalesce(a.automation_kind, ''))) <> 'spelling_bee'
    or a.automation_run_id is null
    or (
      not exists (
        select 1
        from public.personalised_generation_run_pupils as bee_run_pupil_rows
        where bee_run_pupil_rows.run_id = a.automation_run_id
      )
      and not exists (
        select 1
        from public.personalised_generation_runs as bee_run
        where bee_run.id = a.automation_run_id
          and lower(btrim(coalesce(bee_run.status, ''))) = 'running'
      )
    )
    or exists (
      select 1
      from public.personalised_generation_run_pupils as own_bee_run_pupil
      where own_bee_run_pupil.run_id = a.automation_run_id
        and own_bee_run_pupil.assignment_id = a.id
        and own_bee_run_pupil.pupil_id = requested_pupil_id
        and lower(btrim(coalesce(own_bee_run_pupil.status, ''))) = 'included'
    )
),$guarded$;
begin
  select pg_get_functiondef('public.read_pupil_runtime_assignments(uuid)'::regprocedure)
    into function_sql;

  if position(guarded_join in function_sql) > 0 then
    return;
  end if;

  if position(previous_join in function_sql) = 0 then
    raise exception 'Could not patch read_pupil_runtime_assignments for Spelling Bee duplicate exposure guard.';
  end if;

  function_sql := replace(function_sql, previous_join, guarded_join);
  execute function_sql;
end $$;

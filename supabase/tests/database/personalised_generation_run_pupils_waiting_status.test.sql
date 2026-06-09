begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(2);

select ok(
  position('waiting' in coalesce((
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.personalised_generation_run_pupils'::regclass
      and conname = 'personalised_generation_run_pupils_status_check'
  ), '')) > 0,
  'personalised generation run pupil status allows waiting'
);

select ok(
  position('no_baseline_assignment' in coalesce((
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.personalised_generation_run_pupils'::regclass
      and conname = 'personalised_generation_run_pupils_skip_reason_check'
  ), '')) > 0,
  'personalised generation run pupil reason allows no baseline assignment'
);

select * from finish();

rollback;

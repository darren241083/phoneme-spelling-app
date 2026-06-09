begin;

alter table public.attempts
  drop constraint if exists attempts_assignment_id_fkey;

alter table public.attempts
  add constraint attempts_assignment_id_fkey
  foreign key (assignment_id)
  references public.assignments_v2(id)
  on delete cascade
  deferrable initially deferred
  not valid;

commit;

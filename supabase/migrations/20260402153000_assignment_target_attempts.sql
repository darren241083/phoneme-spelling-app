alter table if exists public.attempts
  add column if not exists assignment_target_id uuid references public.assignment_pupil_target_words(id) on delete set null;

create index if not exists idx_attempts_assignment_target_created
  on public.attempts (assignment_target_id, created_at desc);

grant select
  on table public.assignment_pupil_target_words
  to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Anon can view assignment pupil target words'
  ) then
    create policy "Anon can view assignment pupil target words"
      on public.assignment_pupil_target_words
      for select
      to anon
      using (true);
  end if;
end $$;

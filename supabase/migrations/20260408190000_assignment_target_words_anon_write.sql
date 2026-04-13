grant insert, update
  on table public.assignment_pupil_target_words
  to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Anon can insert assignment pupil target words'
  ) then
    create policy "Anon can insert assignment pupil target words"
      on public.assignment_pupil_target_words
      for insert
      to anon
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Anon can update assignment pupil target words'
  ) then
    create policy "Anon can update assignment pupil target words"
      on public.assignment_pupil_target_words
      for update
      to anon
      using (true)
      with check (true);
  end if;
end $$;

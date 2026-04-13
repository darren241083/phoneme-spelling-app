grant select, insert
  on table public.attempts
  to anon;

grant select, insert
  on table public.attempts
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attempts'
      and policyname = 'Anon can view attempts'
  ) then
    create policy "Anon can view attempts"
      on public.attempts
      for select
      to anon
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attempts'
      and policyname = 'Anon can insert attempts'
  ) then
    create policy "Anon can insert attempts"
      on public.attempts
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
      and tablename = 'attempts'
      and policyname = 'Authenticated can view attempts'
  ) then
    create policy "Authenticated can view attempts"
      on public.attempts
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attempts'
      and policyname = 'Authenticated can insert attempts'
  ) then
    create policy "Authenticated can insert attempts"
      on public.attempts
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

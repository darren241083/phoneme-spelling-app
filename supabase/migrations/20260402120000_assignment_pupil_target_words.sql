create table if not exists public.assignment_pupil_target_words (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  assignment_id uuid not null references public.assignments_v2(id) on delete cascade,
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  test_word_id uuid not null references public.test_words(id) on delete cascade,
  focus_grapheme text,
  target_source text not null default 'analytics',
  target_reason text not null default 'focus_grapheme',
  created_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, pupil_id, test_word_id)
);

create index if not exists idx_assignment_pupil_target_words_assignment_pupil
  on public.assignment_pupil_target_words (assignment_id, pupil_id, created_at desc);

create index if not exists idx_assignment_pupil_target_words_teacher_assignment
  on public.assignment_pupil_target_words (teacher_id, assignment_id, created_at desc);

grant select, insert, update, delete
  on table public.assignment_pupil_target_words
  to authenticated;

alter table if exists public.assignment_pupil_target_words
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Teachers can view own assignment pupil target words'
  ) then
    create policy "Teachers can view own assignment pupil target words"
      on public.assignment_pupil_target_words
      for select
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Teachers can insert own assignment pupil target words'
  ) then
    create policy "Teachers can insert own assignment pupil target words"
      on public.assignment_pupil_target_words
      for insert
      to authenticated
      with check (auth.uid() = teacher_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Teachers can update own assignment pupil target words'
  ) then
    create policy "Teachers can update own assignment pupil target words"
      on public.assignment_pupil_target_words
      for update
      to authenticated
      using (auth.uid() = teacher_id)
      with check (auth.uid() = teacher_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_target_words'
      and policyname = 'Teachers can delete own assignment pupil target words'
  ) then
    create policy "Teachers can delete own assignment pupil target words"
      on public.assignment_pupil_target_words
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;

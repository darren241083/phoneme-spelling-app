create table if not exists public.teacher_ai_threads (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  title text not null default 'New chat',
  scope_type text not null default 'overview' check (scope_type in ('overview', 'class', 'year_group', 'pupil')),
  scope_id text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique (id, teacher_id)
);

create table if not exists public.teacher_ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  teacher_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  scope_label text,
  meta text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint teacher_ai_messages_thread_teacher_fkey
    foreign key (thread_id, teacher_id)
    references public.teacher_ai_threads(id, teacher_id)
    on delete cascade
);

create index if not exists idx_teacher_ai_threads_teacher_recent
  on public.teacher_ai_threads (teacher_id, last_message_at desc);

create index if not exists idx_teacher_ai_messages_thread_created
  on public.teacher_ai_messages (thread_id, created_at asc);

create index if not exists idx_teacher_ai_messages_teacher_created
  on public.teacher_ai_messages (teacher_id, created_at desc);

grant select, insert, update, delete
  on table public.teacher_ai_threads
  to authenticated;

grant select, insert, update, delete
  on table public.teacher_ai_messages
  to authenticated;

alter table if exists public.teacher_ai_threads
  enable row level security;

alter table if exists public.teacher_ai_messages
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_ai_threads'
      and policyname = 'Teachers can view own AI threads'
  ) then
    create policy "Teachers can view own AI threads"
      on public.teacher_ai_threads
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
      and tablename = 'teacher_ai_threads'
      and policyname = 'Teachers can insert own AI threads'
  ) then
    create policy "Teachers can insert own AI threads"
      on public.teacher_ai_threads
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
      and tablename = 'teacher_ai_threads'
      and policyname = 'Teachers can update own AI threads'
  ) then
    create policy "Teachers can update own AI threads"
      on public.teacher_ai_threads
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
      and tablename = 'teacher_ai_threads'
      and policyname = 'Teachers can delete own AI threads'
  ) then
    create policy "Teachers can delete own AI threads"
      on public.teacher_ai_threads
      for delete
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
      and tablename = 'teacher_ai_messages'
      and policyname = 'Teachers can view own AI messages'
  ) then
    create policy "Teachers can view own AI messages"
      on public.teacher_ai_messages
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
      and tablename = 'teacher_ai_messages'
      and policyname = 'Teachers can insert own AI messages'
  ) then
    create policy "Teachers can insert own AI messages"
      on public.teacher_ai_messages
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
      and tablename = 'teacher_ai_messages'
      and policyname = 'Teachers can update own AI messages'
  ) then
    create policy "Teachers can update own AI messages"
      on public.teacher_ai_messages
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
      and tablename = 'teacher_ai_messages'
      and policyname = 'Teachers can delete own AI messages'
  ) then
    create policy "Teachers can delete own AI messages"
      on public.teacher_ai_messages
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;

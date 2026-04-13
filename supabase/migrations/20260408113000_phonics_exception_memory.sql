create table if not exists public.phonics_exceptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  word text not null,
  normalized_word text not null,
  grapheme_data_json jsonb not null default '{}'::jsonb,
  focus_grapheme text,
  classification text,
  source text not null default 'teacher_manual_approval',
  approval_status text not null default 'approved',
  notes text,
  times_seen integer not null default 0 check (times_seen >= 0),
  times_used integer not null default 0 check (times_used >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (teacher_id, normalized_word)
);

create index if not exists idx_phonics_exceptions_teacher_word
  on public.phonics_exceptions (teacher_id, normalized_word);

create index if not exists idx_phonics_exceptions_teacher_status
  on public.phonics_exceptions (teacher_id, approval_status, updated_at desc);

grant select, insert, update, delete
  on table public.phonics_exceptions
  to authenticated;

alter table if exists public.phonics_exceptions
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'phonics_exceptions'
      and policyname = 'Teachers can view own phonics exceptions'
  ) then
    create policy "Teachers can view own phonics exceptions"
      on public.phonics_exceptions
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
      and tablename = 'phonics_exceptions'
      and policyname = 'Teachers can insert own phonics exceptions'
  ) then
    create policy "Teachers can insert own phonics exceptions"
      on public.phonics_exceptions
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
      and tablename = 'phonics_exceptions'
      and policyname = 'Teachers can update own phonics exceptions'
  ) then
    create policy "Teachers can update own phonics exceptions"
      on public.phonics_exceptions
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
      and tablename = 'phonics_exceptions'
      and policyname = 'Teachers can delete own phonics exceptions'
  ) then
    create policy "Teachers can delete own phonics exceptions"
      on public.phonics_exceptions
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;

create table if not exists public.phonics_correction_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  word text not null,
  normalized_word text not null,
  original_output_json jsonb not null default '{}'::jsonb,
  corrected_output_json jsonb not null default '{}'::jsonb,
  correction_type text not null,
  correction_signature text not null,
  source text,
  context_area text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_phonics_correction_logs_teacher_created
  on public.phonics_correction_logs (teacher_id, created_at desc);

create index if not exists idx_phonics_correction_logs_signature
  on public.phonics_correction_logs (teacher_id, correction_type, correction_signature, created_at desc);

grant select, insert
  on table public.phonics_correction_logs
  to authenticated;

alter table if exists public.phonics_correction_logs
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'phonics_correction_logs'
      and policyname = 'Teachers can view own phonics correction logs'
  ) then
    create policy "Teachers can view own phonics correction logs"
      on public.phonics_correction_logs
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
      and tablename = 'phonics_correction_logs'
      and policyname = 'Teachers can insert own phonics correction logs'
  ) then
    create policy "Teachers can insert own phonics correction logs"
      on public.phonics_correction_logs
      for insert
      to authenticated
      with check (auth.uid() = teacher_id);
  end if;
end $$;

begin;

create table if not exists public.word_context_support (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  normalized_word text not null,
  display_word text not null,
  context_key text not null default 'default',
  sentence text,
  meaning text,
  sentence_required boolean not null default false,
  meaning_enabled_by_default boolean not null default false,
  sentence_status text not null default 'hidden',
  meaning_status text not null default 'hidden',
  source text not null default 'teacher',
  quality_flags jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint word_context_support_school_word_context_key unique (school_id, normalized_word, context_key),
  constraint word_context_support_normalized_word_check check (
    normalized_word = lower(btrim(normalized_word))
    and normalized_word <> ''
  ),
  constraint word_context_support_display_word_check check (btrim(display_word) <> ''),
  constraint word_context_support_context_key_check check (
    context_key = lower(btrim(context_key))
    and context_key <> ''
  ),
  constraint word_context_support_sentence_status_check check (
    sentence_status in (
      'ai_generated',
      'auto_approved',
      'teacher_entered',
      'teacher_edited',
      'hidden',
      'needs_review'
    )
  ),
  constraint word_context_support_meaning_status_check check (
    meaning_status in (
      'ai_generated',
      'auto_approved',
      'teacher_entered',
      'teacher_edited',
      'hidden',
      'needs_review'
    )
  ),
  constraint word_context_support_source_check check (
    source in ('teacher', 'ai', 'system', 'import')
  ),
  constraint word_context_support_quality_flags_object_check check (
    jsonb_typeof(quality_flags) = 'object'
  )
);

alter table public.word_context_support owner to postgres;

create index if not exists idx_word_context_support_school_word
  on public.word_context_support (school_id, normalized_word);

create index if not exists idx_word_context_support_school_updated
  on public.word_context_support (school_id, updated_at desc);

create or replace function public.set_word_context_support_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter function public.set_word_context_support_updated_at() owner to postgres;
revoke all on function public.set_word_context_support_updated_at() from public;
grant execute on function public.set_word_context_support_updated_at() to authenticated;
grant execute on function public.set_word_context_support_updated_at() to service_role;

drop trigger if exists trg_word_context_support_updated_at on public.word_context_support;
create trigger trg_word_context_support_updated_at
  before update on public.word_context_support
  for each row execute function public.set_word_context_support_updated_at();

alter table public.word_context_support enable row level security;

revoke all on table public.word_context_support from anon;
revoke all on table public.word_context_support from authenticated;
grant select, insert, update on table public.word_context_support to authenticated;
grant all on table public.word_context_support to service_role;

drop policy if exists "Staff can view school word context support" on public.word_context_support;
create policy "Staff can view school word context support"
  on public.word_context_support
  for select
  to authenticated
  using (
    public.is_admin_compat(auth.uid(), school_id)
    or public.is_teacher_compat(auth.uid(), school_id)
    or public.has_role('hoy', auth.uid(), school_id)
    or public.has_role('hod', auth.uid(), school_id)
    or public.has_role('senco', auth.uid(), school_id)
    or public.has_role('literacy_lead', auth.uid(), school_id)
  );

drop policy if exists "Teachers and admins can insert school word context support" on public.word_context_support;
create policy "Teachers and admins can insert school word context support"
  on public.word_context_support
  for insert
  to authenticated
  with check (
    public.is_admin_compat(auth.uid(), school_id)
    or public.is_teacher_compat(auth.uid(), school_id)
  );

drop policy if exists "Teachers and admins can update school word context support" on public.word_context_support;
create policy "Teachers and admins can update school word context support"
  on public.word_context_support
  for update
  to authenticated
  using (
    public.is_admin_compat(auth.uid(), school_id)
    or public.is_teacher_compat(auth.uid(), school_id)
  )
  with check (
    public.is_admin_compat(auth.uid(), school_id)
    or public.is_teacher_compat(auth.uid(), school_id)
  );

commit;

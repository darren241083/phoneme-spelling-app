begin;

create table if not exists public.wordloom_core_focus_targets (
  id uuid primary key default gen_random_uuid(),
  focus_grapheme text not null,
  display_label text,
  stage_band text,
  challenge_band text,
  sort_order integer,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wordloom_core_focus_targets_focus_grapheme_key unique (focus_grapheme),
  constraint wordloom_core_focus_targets_focus_grapheme_check check (
    focus_grapheme = lower(btrim(focus_grapheme))
    and focus_grapheme <> ''
  ),
  constraint wordloom_core_focus_targets_display_label_check check (
    display_label is null
    or btrim(display_label) <> ''
  ),
  constraint wordloom_core_focus_targets_stage_band_check check (
    stage_band is null
    or btrim(stage_band) <> ''
  ),
  constraint wordloom_core_focus_targets_challenge_band_check check (
    challenge_band is null
    or challenge_band in (
      'needs_support',
      'core_developing',
      'secure_expected',
      'early_stretch'
    )
  )
);

alter table public.wordloom_core_focus_targets owner to postgres;

create table if not exists public.wordloom_core_words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  normalised_word text not null,
  grapheme_segments jsonb not null,
  focus_graphemes jsonb not null,
  primary_focus_grapheme text,
  stage_band text,
  difficulty_score integer,
  difficulty_label text,
  difficulty_reason text,
  sentence text,
  meaning text,
  suitability_status text not null default 'suitable',
  approval_status text not null default 'approved',
  source text not null default 'wordloom_core',
  source_version text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wordloom_core_words_word_check check (btrim(word) <> ''),
  constraint wordloom_core_words_normalised_word_check check (
    normalised_word = lower(btrim(normalised_word))
    and normalised_word <> ''
  ),
  constraint wordloom_core_words_grapheme_segments_array_check check (
    jsonb_typeof(grapheme_segments) = 'array'
    and jsonb_array_length(grapheme_segments) > 0
  ),
  constraint wordloom_core_words_focus_graphemes_array_check check (
    jsonb_typeof(focus_graphemes) = 'array'
    and jsonb_array_length(focus_graphemes) > 0
  ),
  constraint wordloom_core_words_primary_focus_check check (
    primary_focus_grapheme is null
    or (
      primary_focus_grapheme = lower(btrim(primary_focus_grapheme))
      and primary_focus_grapheme <> ''
      and focus_graphemes ? primary_focus_grapheme
    )
  ),
  constraint wordloom_core_words_difficulty_score_check check (
    difficulty_score is null
    or difficulty_score between 0 and 100
  ),
  constraint wordloom_core_words_suitability_status_check check (
    suitability_status in ('suitable', 'caution', 'exclude')
  ),
  constraint wordloom_core_words_approval_status_check check (
    approval_status in ('pending', 'approved', 'rejected', 'retired')
  ),
  constraint wordloom_core_words_source_check check (btrim(source) <> ''),
  constraint wordloom_core_words_approved_active_metadata_check check (
    not (is_active and approval_status = 'approved')
    or (
      btrim(coalesce(sentence, '')) <> ''
      and btrim(coalesce(meaning, '')) <> ''
    )
  )
);

alter table public.wordloom_core_words owner to postgres;

create table if not exists public.wordloom_core_word_targets (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.wordloom_core_words(id) on delete cascade,
  focus_target_id uuid not null references public.wordloom_core_focus_targets(id) on delete cascade,
  focus_grapheme text not null,
  target_role text not null default 'primary',
  pattern_type text,
  difficulty_modifier integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint wordloom_core_word_targets_word_target_role_key unique (
    word_id,
    focus_target_id,
    target_role
  ),
  constraint wordloom_core_word_targets_focus_grapheme_check check (
    focus_grapheme = lower(btrim(focus_grapheme))
    and focus_grapheme <> ''
  ),
  constraint wordloom_core_word_targets_target_role_check check (
    target_role in ('primary', 'secondary', 'incidental')
  ),
  constraint wordloom_core_word_targets_pattern_type_check check (
    pattern_type is null
    or btrim(pattern_type) <> ''
  ),
  constraint wordloom_core_word_targets_difficulty_modifier_check check (
    difficulty_modifier between -30 and 30
  )
);

alter table public.wordloom_core_word_targets owner to postgres;

create table if not exists public.school_spelling_bank_overrides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  core_word_id uuid references public.wordloom_core_words(id) on delete cascade,
  focus_target_id uuid references public.wordloom_core_focus_targets(id) on delete cascade,
  blocked boolean not null default false,
  custom_sentence text,
  custom_meaning text,
  priority integer,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_spelling_bank_overrides_scope_check check (
    num_nonnulls(core_word_id, focus_target_id) = 1
  ),
  constraint school_spelling_bank_overrides_custom_sentence_check check (
    custom_sentence is null
    or btrim(custom_sentence) <> ''
  ),
  constraint school_spelling_bank_overrides_custom_meaning_check check (
    custom_meaning is null
    or btrim(custom_meaning) <> ''
  )
);

alter table public.school_spelling_bank_overrides owner to postgres;

create table if not exists public.school_spelling_bank_words (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  word text not null,
  normalised_word text not null,
  grapheme_segments jsonb not null,
  focus_graphemes jsonb not null,
  primary_focus_grapheme text,
  stage_band text,
  difficulty_score integer,
  difficulty_label text,
  difficulty_reason text,
  sentence text,
  meaning text,
  suitability_status text not null default 'suitable',
  approval_status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_spelling_bank_words_word_check check (btrim(word) <> ''),
  constraint school_spelling_bank_words_normalised_word_check check (
    normalised_word = lower(btrim(normalised_word))
    and normalised_word <> ''
  ),
  constraint school_spelling_bank_words_grapheme_segments_array_check check (
    jsonb_typeof(grapheme_segments) = 'array'
    and jsonb_array_length(grapheme_segments) > 0
  ),
  constraint school_spelling_bank_words_focus_graphemes_array_check check (
    jsonb_typeof(focus_graphemes) = 'array'
    and jsonb_array_length(focus_graphemes) > 0
  ),
  constraint school_spelling_bank_words_primary_focus_check check (
    primary_focus_grapheme is null
    or (
      primary_focus_grapheme = lower(btrim(primary_focus_grapheme))
      and primary_focus_grapheme <> ''
      and focus_graphemes ? primary_focus_grapheme
    )
  ),
  constraint school_spelling_bank_words_difficulty_score_check check (
    difficulty_score is null
    or difficulty_score between 0 and 100
  ),
  constraint school_spelling_bank_words_suitability_status_check check (
    suitability_status in ('suitable', 'caution', 'exclude')
  ),
  constraint school_spelling_bank_words_approval_status_check check (
    approval_status in ('pending', 'approved', 'rejected', 'retired')
  ),
  constraint school_spelling_bank_words_approved_active_metadata_check check (
    not (is_active and approval_status = 'approved')
    or (
      btrim(coalesce(sentence, '')) <> ''
      and btrim(coalesce(meaning, '')) <> ''
    )
  ),
  constraint school_spelling_bank_words_reviewed_status_check check (
    approval_status = 'pending'
    or reviewed_at is not null
    or reviewed_by is not null
  )
);

alter table public.school_spelling_bank_words owner to postgres;

create unique index if not exists idx_wordloom_core_words_active_normalised_word
  on public.wordloom_core_words (normalised_word)
  where is_active is true;

create index if not exists idx_wordloom_core_words_active
  on public.wordloom_core_words (is_active)
  where is_active is true;

create index if not exists idx_wordloom_core_words_primary_focus
  on public.wordloom_core_words (primary_focus_grapheme)
  where is_active is true;

create index if not exists idx_wordloom_core_words_status
  on public.wordloom_core_words (approval_status, suitability_status, is_active);

create index if not exists idx_wordloom_core_focus_targets_active
  on public.wordloom_core_focus_targets (is_active, sort_order, focus_grapheme);

create index if not exists idx_wordloom_core_word_targets_focus_target
  on public.wordloom_core_word_targets (focus_target_id, target_role);

create index if not exists idx_wordloom_core_word_targets_focus_grapheme
  on public.wordloom_core_word_targets (focus_grapheme, target_role);

create index if not exists idx_wordloom_core_word_targets_word
  on public.wordloom_core_word_targets (word_id);

create index if not exists idx_school_spelling_bank_overrides_school
  on public.school_spelling_bank_overrides (school_id);

create index if not exists idx_school_spelling_bank_overrides_blocked
  on public.school_spelling_bank_overrides (school_id, blocked)
  where blocked is true;

create unique index if not exists idx_school_spelling_bank_overrides_school_core_word
  on public.school_spelling_bank_overrides (school_id, core_word_id)
  where core_word_id is not null;

create unique index if not exists idx_school_spelling_bank_overrides_school_focus_target
  on public.school_spelling_bank_overrides (school_id, focus_target_id)
  where focus_target_id is not null;

create unique index if not exists idx_school_spelling_bank_words_school_active_normalised_word
  on public.school_spelling_bank_words (school_id, normalised_word)
  where is_active is true;

create index if not exists idx_school_spelling_bank_words_school
  on public.school_spelling_bank_words (school_id);

create index if not exists idx_school_spelling_bank_words_primary_focus
  on public.school_spelling_bank_words (school_id, primary_focus_grapheme)
  where is_active is true;

create index if not exists idx_school_spelling_bank_words_status
  on public.school_spelling_bank_words (school_id, approval_status, suitability_status, is_active);

create or replace function public.set_wordloom_core_spelling_bank_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter function public.set_wordloom_core_spelling_bank_updated_at() owner to postgres;
revoke all on function public.set_wordloom_core_spelling_bank_updated_at() from public;
grant execute on function public.set_wordloom_core_spelling_bank_updated_at() to authenticated;
grant execute on function public.set_wordloom_core_spelling_bank_updated_at() to service_role;

drop trigger if exists trg_wordloom_core_focus_targets_updated_at on public.wordloom_core_focus_targets;
create trigger trg_wordloom_core_focus_targets_updated_at
  before update on public.wordloom_core_focus_targets
  for each row execute function public.set_wordloom_core_spelling_bank_updated_at();

drop trigger if exists trg_wordloom_core_words_updated_at on public.wordloom_core_words;
create trigger trg_wordloom_core_words_updated_at
  before update on public.wordloom_core_words
  for each row execute function public.set_wordloom_core_spelling_bank_updated_at();

drop trigger if exists trg_school_spelling_bank_overrides_updated_at on public.school_spelling_bank_overrides;
create trigger trg_school_spelling_bank_overrides_updated_at
  before update on public.school_spelling_bank_overrides
  for each row execute function public.set_wordloom_core_spelling_bank_updated_at();

drop trigger if exists trg_school_spelling_bank_words_updated_at on public.school_spelling_bank_words;
create trigger trg_school_spelling_bank_words_updated_at
  before update on public.school_spelling_bank_words
  for each row execute function public.set_wordloom_core_spelling_bank_updated_at();

alter table public.wordloom_core_focus_targets enable row level security;
alter table public.wordloom_core_words enable row level security;
alter table public.wordloom_core_word_targets enable row level security;
alter table public.school_spelling_bank_overrides enable row level security;
alter table public.school_spelling_bank_words enable row level security;

revoke all on table public.wordloom_core_focus_targets from anon;
revoke all on table public.wordloom_core_focus_targets from authenticated;
grant select on table public.wordloom_core_focus_targets to authenticated;
grant all on table public.wordloom_core_focus_targets to service_role;

revoke all on table public.wordloom_core_words from anon;
revoke all on table public.wordloom_core_words from authenticated;
grant select on table public.wordloom_core_words to authenticated;
grant all on table public.wordloom_core_words to service_role;

revoke all on table public.wordloom_core_word_targets from anon;
revoke all on table public.wordloom_core_word_targets from authenticated;
grant select on table public.wordloom_core_word_targets to authenticated;
grant all on table public.wordloom_core_word_targets to service_role;

revoke all on table public.school_spelling_bank_overrides from anon;
revoke all on table public.school_spelling_bank_overrides from authenticated;
grant select, insert, update on table public.school_spelling_bank_overrides to authenticated;
grant all on table public.school_spelling_bank_overrides to service_role;

revoke all on table public.school_spelling_bank_words from anon;
revoke all on table public.school_spelling_bank_words from authenticated;
grant select, insert, update on table public.school_spelling_bank_words to authenticated;
grant all on table public.school_spelling_bank_words to service_role;

drop policy if exists "Authenticated users can view Wordloom core focus targets" on public.wordloom_core_focus_targets;
create policy "Authenticated users can view Wordloom core focus targets"
  on public.wordloom_core_focus_targets
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can view Wordloom core words" on public.wordloom_core_words;
create policy "Authenticated users can view Wordloom core words"
  on public.wordloom_core_words
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can view Wordloom core word targets" on public.wordloom_core_word_targets;
create policy "Authenticated users can view Wordloom core word targets"
  on public.wordloom_core_word_targets
  for select
  to authenticated
  using (true);

drop policy if exists "Staff can view school spelling bank overrides" on public.school_spelling_bank_overrides;
create policy "Staff can view school spelling bank overrides"
  on public.school_spelling_bank_overrides
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

drop policy if exists "Teachers and admins can insert school spelling bank overrides" on public.school_spelling_bank_overrides;
create policy "Teachers and admins can insert school spelling bank overrides"
  on public.school_spelling_bank_overrides
  for insert
  to authenticated
  with check (
    public.is_admin_compat(auth.uid(), school_id)
    or public.is_teacher_compat(auth.uid(), school_id)
  );

drop policy if exists "Teachers and admins can update school spelling bank overrides" on public.school_spelling_bank_overrides;
create policy "Teachers and admins can update school spelling bank overrides"
  on public.school_spelling_bank_overrides
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

drop policy if exists "Staff can view school spelling bank words" on public.school_spelling_bank_words;
create policy "Staff can view school spelling bank words"
  on public.school_spelling_bank_words
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

drop policy if exists "Teachers and admins can insert school spelling bank words" on public.school_spelling_bank_words;
create policy "Teachers and admins can insert school spelling bank words"
  on public.school_spelling_bank_words
  for insert
  to authenticated
  with check (
    public.is_admin_compat(auth.uid(), school_id)
    or public.is_teacher_compat(auth.uid(), school_id)
  );

drop policy if exists "Teachers and admins can update school spelling bank words" on public.school_spelling_bank_words;
create policy "Teachers and admins can update school spelling bank words"
  on public.school_spelling_bank_words
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

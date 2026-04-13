alter table if exists public.staff_profiles
  add column if not exists id uuid;

update public.staff_profiles
set id = gen_random_uuid()
where id is null;

alter table if exists public.staff_profiles
  alter column id set default gen_random_uuid();

alter table if exists public.staff_profiles
  alter column id set not null;

alter table if exists public.staff_profiles
  drop constraint if exists staff_profiles_pkey;

alter table if exists public.staff_profiles
  add constraint staff_profiles_pkey primary key (id);

alter table if exists public.staff_profiles
  alter column user_id drop not null;

create unique index if not exists idx_staff_profiles_user_id_unique
  on public.staff_profiles (user_id)
  where user_id is not null;

create index if not exists idx_staff_profiles_email_lookup
  on public.staff_profiles ((lower(email)));

alter table if exists public.staff_profiles
  add column if not exists external_staff_id text;

create index if not exists idx_staff_profiles_external_staff_id_lookup
  on public.staff_profiles ((lower(external_staff_id)))
  where external_staff_id is not null and btrim(external_staff_id) <> '';

alter table if exists public.staff_profiles
  add column if not exists notes text;

alter table if exists public.staff_profiles
  add column if not exists profile_source text not null default 'self_service';

alter table if exists public.staff_profiles
  add column if not exists import_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.staff_profiles
  add column if not exists last_import_batch_id uuid;

alter table if exists public.staff_profiles
  add column if not exists last_imported_at timestamptz;

alter table if exists public.staff_profiles
  add column if not exists last_imported_by uuid;

update public.staff_profiles
set profile_source = coalesce(nullif(btrim(profile_source), ''), 'self_service'),
    import_metadata = coalesce(import_metadata, '{}'::jsonb)
where profile_source is null
   or btrim(profile_source) = ''
   or import_metadata is null;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_profile_source_check;

alter table public.staff_profiles
  add constraint staff_profiles_profile_source_check
  check (profile_source in ('self_service', 'csv_import'));

create table if not exists public.staff_import_batches (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  file_name text,
  rows_processed integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

revoke all on table public.staff_import_batches from public;
revoke insert, update, delete on table public.staff_import_batches from authenticated, anon;
grant select on table public.staff_import_batches to authenticated;

alter table if exists public.staff_import_batches
  enable row level security;

create or replace function public.upsert_my_staff_profile(
  requested_email text default null,
  requested_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_profile public.staff_profiles%rowtype;
  email_match public.staff_profiles%rowtype;
  safe_email text := lower(btrim(coalesce(requested_email, '')));
  safe_display_name text := btrim(coalesce(requested_display_name, ''));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before updating your staff profile.';
  end if;

  select *
  into existing_profile
  from public.staff_profiles
  where user_id = actor_user_id
  limit 1;

  if safe_email = '' then
    safe_email := lower(btrim(coalesce(existing_profile.email, '')));
  end if;

  if safe_email = '' then
    raise exception 'A staff email is required to create your staff profile.';
  end if;

  if existing_profile.id is null then
    select *
    into email_match
    from public.staff_profiles
    where lower(email) = safe_email
      and (user_id is null or user_id = actor_user_id)
    order by case when user_id = actor_user_id then 0 else 1 end,
             updated_at desc nulls last,
             created_at desc nulls last
    limit 1;

    if email_match.id is not null then
      existing_profile := email_match;
    end if;
  end if;

  if safe_display_name = '' then
    safe_display_name := btrim(coalesce(existing_profile.display_name, ''));
  end if;

  if safe_display_name = '' then
    safe_display_name := split_part(safe_email, '@', 1);
  end if;

  if safe_display_name = '' then
    safe_display_name := 'Staff member';
  end if;

  if existing_profile.id is null then
    insert into public.staff_profiles (
      id,
      user_id,
      email,
      display_name,
      profile_source,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      actor_user_id,
      safe_email,
      safe_display_name,
      'self_service',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning *
    into existing_profile;
  else
    update public.staff_profiles
    set user_id = actor_user_id,
        email = safe_email,
        display_name = safe_display_name,
        updated_at = timezone('utc', now())
    where id = existing_profile.id
    returning *
    into existing_profile;
  end if;

  return jsonb_build_object(
    'id', existing_profile.id,
    'user_id', actor_user_id,
    'email', existing_profile.email,
    'display_name', existing_profile.display_name,
    'profile_source', existing_profile.profile_source
  );
end;
$$;

create or replace function public.import_staff_directory_csv(
  import_rows jsonb default '[]'::jsonb,
  import_file_name text default null,
  preview_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  batch_id uuid := gen_random_uuid();
  row_item jsonb;
  safe_rows jsonb := case when jsonb_typeof(import_rows) = 'array' then import_rows else '[]'::jsonb end;
  safe_file_name text := nullif(btrim(coalesce(import_file_name, '')), '');
  safe_email text;
  safe_display_name text;
  safe_external_staff_id text;
  safe_notes text;
  safe_role_suggestion text;
  safe_metadata jsonb;
  matched_by_email_count integer;
  matched_by_external_count integer;
  matched_email_profile public.staff_profiles%rowtype;
  matched_external_profile public.staff_profiles%rowtype;
  matched_profile public.staff_profiles%rowtype;
  final_action text;
  v_rows_processed integer := 0;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_skipped_count integer := 0;
  v_warning_count integer := greatest(0, coalesce((preview_summary ->> 'warning_count')::integer, 0));
  v_error_count integer := greatest(0, coalesce((preview_summary ->> 'error_count')::integer, 0));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before importing staff.';
  end if;

  if not public.can_import_csv(actor_user_id) then
    raise exception 'Admin access is required before importing staff.';
  end if;

  if jsonb_typeof(safe_rows) <> 'array' or jsonb_array_length(safe_rows) = 0 then
    raise exception 'Choose at least one valid CSV row before importing staff.';
  end if;

  insert into public.staff_import_batches (
    id,
    actor_user_id,
    file_name,
    rows_processed,
    created_count,
    updated_count,
    skipped_count,
    warning_count,
    error_count,
    metadata,
    created_at
  )
  values (
    batch_id,
    actor_user_id,
    safe_file_name,
    0,
    0,
    0,
    0,
    v_warning_count,
    v_error_count,
    jsonb_build_object(
      'source', 'csv_import',
      'preview_summary', coalesce(preview_summary, '{}'::jsonb)
    ),
    timezone('utc', now())
  );

  for row_item in
    select value
    from jsonb_array_elements(safe_rows)
  loop
    v_rows_processed := v_rows_processed + 1;
    final_action := lower(btrim(coalesce(row_item ->> 'final_action', 'skip')));
    if final_action not in ('create', 'update') then
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    safe_email := lower(btrim(coalesce(row_item ->> 'email', '')));
    safe_display_name := regexp_replace(btrim(coalesce(row_item ->> 'full_name', '')), '\s+', ' ', 'g');
    safe_external_staff_id := nullif(regexp_replace(btrim(coalesce(row_item ->> 'external_staff_id', '')), '\s+', ' ', 'g'), '');
    safe_notes := nullif(btrim(coalesce(row_item ->> 'notes', '')), '');
    safe_role_suggestion := nullif(btrim(coalesce(row_item ->> 'role_suggestion', '')), '');

    if safe_email = '' or safe_display_name = '' or safe_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      v_error_count := v_error_count + 1;
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    matched_email_profile := null;
    matched_external_profile := null;
    matched_profile := null;

    select count(*)
    into matched_by_email_count
    from public.staff_profiles
    where lower(email) = safe_email;

    if matched_by_email_count = 1 then
      select *
      into matched_email_profile
      from public.staff_profiles
      where lower(email) = safe_email
      limit 1;
    elsif matched_by_email_count > 1 then
      v_error_count := v_error_count + 1;
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    if safe_external_staff_id is not null then
      select count(*)
      into matched_by_external_count
      from public.staff_profiles
      where lower(coalesce(external_staff_id, '')) = lower(safe_external_staff_id);

      if matched_by_external_count = 1 then
        select *
        into matched_external_profile
        from public.staff_profiles
        where lower(coalesce(external_staff_id, '')) = lower(safe_external_staff_id)
        limit 1;
      elsif matched_by_external_count > 1 then
        v_error_count := v_error_count + 1;
        v_skipped_count := v_skipped_count + 1;
        continue;
      end if;
    end if;

    if matched_email_profile.id is not null and matched_external_profile.id is not null
      and matched_email_profile.id <> matched_external_profile.id then
      v_error_count := v_error_count + 1;
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    matched_profile := coalesce(matched_email_profile, matched_external_profile);
    safe_metadata := jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'csv_import',
        'role_suggestion', safe_role_suggestion,
        'department_suggestion_values', coalesce(row_item -> 'department_suggestion_values', '[]'::jsonb),
        'year_group_suggestion_values', coalesce(row_item -> 'year_group_suggestion_values', '[]'::jsonb),
        'class_scope_suggestion_values', coalesce(row_item -> 'class_scope_suggestion_values', '[]'::jsonb),
        'notes', safe_notes,
        'external_staff_id', safe_external_staff_id,
        'file_name', safe_file_name
      )
    );

    if matched_profile.id is null then
      insert into public.staff_profiles (
        id,
        user_id,
        email,
        display_name,
        external_staff_id,
        notes,
        profile_source,
        import_metadata,
        last_import_batch_id,
        last_imported_at,
        last_imported_by,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        null,
        safe_email,
        safe_display_name,
        safe_external_staff_id,
        safe_notes,
        'csv_import',
        safe_metadata,
        batch_id,
        timezone('utc', now()),
        actor_user_id,
        timezone('utc', now()),
        timezone('utc', now())
      );
      v_created_count := v_created_count + 1;
    else
      update public.staff_profiles
      set display_name = safe_display_name,
          external_staff_id = coalesce(safe_external_staff_id, external_staff_id),
          notes = case when safe_notes is not null then safe_notes else notes end,
          import_metadata = safe_metadata,
          last_import_batch_id = batch_id,
          last_imported_at = timezone('utc', now()),
          last_imported_by = actor_user_id,
          updated_at = timezone('utc', now())
      where id = matched_profile.id;
      v_updated_count := v_updated_count + 1;
    end if;
  end loop;

  update public.staff_import_batches as sib
  set rows_processed = greatest(v_rows_processed, coalesce((preview_summary ->> 'total_rows')::integer, v_rows_processed)),
      created_count = v_created_count,
      updated_count = v_updated_count,
      skipped_count = greatest(v_skipped_count, coalesce((preview_summary ->> 'skipped_count')::integer, v_skipped_count)),
      warning_count = v_warning_count,
      error_count = v_error_count,
      metadata = coalesce(sib.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'source', 'csv_import',
          'preview_summary', coalesce(preview_summary, '{}'::jsonb),
          'committed_row_count', v_created_count + v_updated_count
        )
  where id = batch_id;

  return jsonb_build_object(
    'batch_id', batch_id,
    'rows_processed', greatest(v_rows_processed, coalesce((preview_summary ->> 'total_rows')::integer, v_rows_processed)),
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'skipped_count', greatest(v_skipped_count, coalesce((preview_summary ->> 'skipped_count')::integer, v_skipped_count)),
    'warning_count', v_warning_count,
    'error_count', v_error_count
  );
end;
$$;

revoke all on function public.upsert_my_staff_profile(text, text) from public;
grant execute on function public.upsert_my_staff_profile(text, text) to authenticated, service_role;

revoke all on function public.import_staff_directory_csv(jsonb, text, jsonb) from public;
grant execute on function public.import_staff_directory_csv(jsonb, text, jsonb) to authenticated, service_role;

drop policy if exists "Admins can view staff import batches" on public.staff_import_batches;
create policy "Admins can view staff import batches"
  on public.staff_import_batches
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

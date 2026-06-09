begin;

create or replace function public.authenticate_pupil(requested_username text, requested_pin text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  safe_username text := public.normalize_pupil_import_lookup_text(requested_username);
  safe_pin text := btrim(coalesce(requested_pin, ''));
  matched_count integer := 0;
  pupil_row public.pupils%rowtype;
  pupil_school_id uuid := null;
  pupil_school_slug text := '';
  pupil_school_name text := '';
  pupil_school_is_legacy_default boolean := false;
begin
  if safe_username = '' or safe_pin = '' then
    return null;
  end if;

  select count(*)
  into matched_count
  from public.pupils as p
  where public.normalize_pupil_import_lookup_text(p.username) = safe_username
    and btrim(coalesce(p.pin, '')) = safe_pin
    and public.can_access_pupil_runtime(p.id);

  if matched_count <> 1 then
    return null;
  end if;

  select *
  into pupil_row
  from public.pupils as p
  where public.normalize_pupil_import_lookup_text(p.username) = safe_username
    and btrim(coalesce(p.pin, '')) = safe_pin
    and public.can_access_pupil_runtime(p.id)
  limit 1;

  pupil_school_id := coalesce(pupil_row.school_id, public.default_legacy_school_id());

  if pupil_school_id is not null then
    select
      coalesce(s.slug, ''),
      coalesce(s.name, ''),
      coalesce(s.is_legacy_default, false)
    into
      pupil_school_slug,
      pupil_school_name,
      pupil_school_is_legacy_default
    from public.schools as s
    where s.id = pupil_school_id
    limit 1;
  end if;

  return jsonb_build_object(
    'id', pupil_row.id,
    'username', lower(btrim(coalesce(pupil_row.username, ''))),
    'first_name', btrim(coalesce(pupil_row.first_name, '')),
    'surname', btrim(coalesce(pupil_row.surname, '')),
    'must_reset_pin', coalesce(pupil_row.must_reset_pin, false),
    'school_id', pupil_school_id,
    'school_name', pupil_school_name,
    'school_slug', pupil_school_slug,
    'school_is_legacy_default', pupil_school_is_legacy_default
  );
end;
$$;

alter function public.authenticate_pupil(text, text) owner to postgres;

create or replace function public.validate_pupil_runtime_session(requested_pupil_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pupil_row public.pupils%rowtype;
  pupil_school_id uuid := null;
  pupil_school_slug text := '';
  pupil_school_name text := '';
  pupil_school_is_legacy_default boolean := false;
begin
  if requested_pupil_id is null or not public.can_access_pupil_runtime(requested_pupil_id) then
    return null;
  end if;

  select *
  into pupil_row
  from public.pupils
  where id = requested_pupil_id
  limit 1;

  if pupil_row.id is null then
    return null;
  end if;

  pupil_school_id := coalesce(pupil_row.school_id, public.default_legacy_school_id());

  if pupil_school_id is not null then
    select
      coalesce(s.slug, ''),
      coalesce(s.name, ''),
      coalesce(s.is_legacy_default, false)
    into
      pupil_school_slug,
      pupil_school_name,
      pupil_school_is_legacy_default
    from public.schools as s
    where s.id = pupil_school_id
    limit 1;
  end if;

  return jsonb_build_object(
    'id', pupil_row.id,
    'username', lower(btrim(coalesce(pupil_row.username, ''))),
    'first_name', btrim(coalesce(pupil_row.first_name, '')),
    'surname', btrim(coalesce(pupil_row.surname, '')),
    'must_reset_pin', coalesce(pupil_row.must_reset_pin, false),
    'school_id', pupil_school_id,
    'school_name', pupil_school_name,
    'school_slug', pupil_school_slug,
    'school_is_legacy_default', pupil_school_is_legacy_default
  );
end;
$$;

alter function public.validate_pupil_runtime_session(uuid) owner to postgres;

commit;

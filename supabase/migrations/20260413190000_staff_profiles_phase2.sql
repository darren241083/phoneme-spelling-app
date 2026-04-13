create table if not exists public.staff_profiles (
  user_id uuid primary key,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

revoke all on table public.staff_profiles from public;
revoke insert, update, delete on table public.staff_profiles from authenticated, anon;
grant select on table public.staff_profiles to authenticated;

alter table if exists public.staff_profiles
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
  safe_email text := lower(btrim(coalesce(requested_email, '')));
  safe_display_name text := btrim(coalesce(requested_display_name, ''));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before updating your staff profile.';
  end if;

  select *
  into existing_profile
  from public.staff_profiles
  where user_id = actor_user_id;

  if safe_email = '' then
    safe_email := lower(btrim(coalesce(existing_profile.email, '')));
  end if;

  if safe_email = '' then
    raise exception 'A staff email is required to create your staff profile.';
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

  insert into public.staff_profiles (
    user_id,
    email,
    display_name,
    created_at,
    updated_at
  )
  values (
    actor_user_id,
    safe_email,
    safe_display_name,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      updated_at = timezone('utc', now());

  return jsonb_build_object(
    'user_id', actor_user_id,
    'email', safe_email,
    'display_name', safe_display_name
  );
end;
$$;

revoke all on function public.upsert_my_staff_profile(text, text) from public;
grant execute on function public.upsert_my_staff_profile(text, text) to authenticated, service_role;

drop policy if exists "Staff can view own profile" on public.staff_profiles;
create policy "Staff can view own profile"
  on public.staff_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can view staff profiles" on public.staff_profiles;
create policy "Admins can view staff profiles"
  on public.staff_profiles
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

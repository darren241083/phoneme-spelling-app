begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(12);

create temporary table test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table reset_checks (
  name text primary key,
  payload jsonb,
  text_value text,
  bool_value boolean,
  int_value integer
) on commit drop;

insert into test_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'admin_user',
  'non_admin_user',
  'active_pupil',
  'archived_pupil',
  'inactive_pupil'
]) as names(name);

do $$
declare
  admin_user_id uuid := (select id from test_ids where name = 'admin_user');
  non_admin_user_id uuid := (select id from test_ids where name = 'non_admin_user');
  active_pupil_id uuid := (select id from test_ids where name = 'active_pupil');
  archived_pupil_id uuid := (select id from test_ids where name = 'archived_pupil');
  inactive_pupil_id uuid := (select id from test_ids where name = 'inactive_pupil');
  reset_payload jsonb;
  new_pin text;
  non_admin_error text := null;
  archived_error text := null;
  inactive_error text := null;
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      admin_user_id,
      'authenticated',
      'authenticated',
      'pgtap-reset-admin-' || substr(replace(admin_user_id::text, '-', ''), 1, 12) || '@example.test',
      '',
      timezone('utc', now()),
      '{}'::jsonb,
      '{}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    ),
    (
      non_admin_user_id,
      'authenticated',
      'authenticated',
      'pgtap-reset-user-' || substr(replace(non_admin_user_id::text, '-', ''), 1, 12) || '@example.test',
      '',
      timezone('utc', now()),
      '{}'::jsonb,
      '{}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    )
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (admin_user_id, 'admin', true, admin_user_id)
  on conflict do nothing;

  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user_id::text, 'role', 'service_role')::text,
    true
  );

  insert into public.pupils (
    id,
    mis_id,
    first_name,
    surname,
    username,
    pin,
    must_reset_pin,
    is_active,
    archived_at
  )
  values
    (
      active_pupil_id,
      'PINRESET-' || substr(replace(active_pupil_id::text, '-', ''), 1, 12),
      'Active',
      'Reset',
      'pgtap.reset.active.' || substr(replace(active_pupil_id::text, '-', ''), 1, 8),
      'old-pin',
      false,
      true,
      null
    ),
    (
      archived_pupil_id,
      'PINRESET-' || substr(replace(archived_pupil_id::text, '-', ''), 1, 12),
      'Archived',
      'Reset',
      'pgtap.reset.archived.' || substr(replace(archived_pupil_id::text, '-', ''), 1, 8),
      'archived-pin',
      false,
      false,
      timezone('utc', now())
    ),
    (
      inactive_pupil_id,
      'PINRESET-' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 12),
      'Inactive',
      'Reset',
      'pgtap.reset.inactive.' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 8),
      'inactive-pin',
      false,
      false,
      null
    );

  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user_id::text, 'role', 'authenticated')::text,
    true
  );

  reset_payload := public.reset_pupil_login_pin(
    active_pupil_id,
    'pgTAP forgotten PIN reset'
  );
  new_pin := reset_payload ->> 'pin';

  insert into reset_checks (name, payload)
  values ('admin_reset_payload', reset_payload);

  insert into reset_checks (name, text_value)
  select 'stored_pin_after_reset', p.pin
  from public.pupils as p
  where p.id = active_pupil_id;

  insert into reset_checks (name, bool_value)
  values
    ('old_pin_rejected', public.authenticate_pupil(reset_payload ->> 'username', 'old-pin') is null),
    ('new_pin_accepted', public.authenticate_pupil(reset_payload ->> 'username', new_pin) is not null);

  insert into reset_checks (name, int_value)
  select 'audit_count', count(*)::integer
  from public.pupil_directory_audit_log
  where target_pupil_id = active_pupil_id
    and action = 'reset_pin';

  insert into reset_checks (name, text_value, bool_value)
  select
    'audit_safety',
    action,
    not exists (
      select 1
      from jsonb_each_text(metadata) as audit_meta(key, value)
      where lower(audit_meta.key) like '%pin%'
        or audit_meta.value = new_pin
    )
  from public.pupil_directory_audit_log
  where target_pupil_id = active_pupil_id
    and action = 'reset_pin'
  order by created_at desc
  limit 1;

  perform set_config('request.jwt.claim.sub', non_admin_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', non_admin_user_id::text, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.reset_pupil_login_pin(active_pupil_id, 'pgTAP non admin attempt');
  exception
    when others then
      non_admin_error := sqlerrm;
  end;

  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user_id::text, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.reset_pupil_login_pin(archived_pupil_id, 'pgTAP archived attempt');
  exception
    when others then
      archived_error := sqlerrm;
  end;

  begin
    perform public.reset_pupil_login_pin(inactive_pupil_id, 'pgTAP inactive attempt');
  exception
    when others then
      inactive_error := sqlerrm;
  end;

  insert into reset_checks (name, bool_value)
  values
    ('non_admin_blocked', coalesce(non_admin_error, '') like 'Admin access is required%'),
    ('archived_blocked', coalesce(archived_error, '') like 'Restore this pupil before resetting their PIN.%'),
    ('inactive_blocked', coalesce(inactive_error, '') like 'Only active pupils can have a PIN reset%');

  insert into reset_checks (name, bool_value)
  select
    'blocked_pins_unchanged',
    bool_and(
      (id = archived_pupil_id and pin = 'archived-pin')
      or (id = inactive_pupil_id and pin = 'inactive-pin')
    )
  from public.pupils
  where id in (archived_pupil_id, inactive_pupil_id);
end;
$$;

select ok(
  coalesce((select payload ->> 'pin' from reset_checks where name = 'admin_reset_payload'), '') ~ '^[0-9]{4}$',
  'admin reset returns a generated four digit PIN'
);

select is(
  (select payload ->> 'username' from reset_checks where name = 'admin_reset_payload'),
  (
    select lower(btrim(username))
    from public.pupils
    where id = (select id from test_ids where name = 'active_pupil')
  ),
  'admin reset keeps the username unchanged'
);

select is(
  (select text_value from reset_checks where name = 'stored_pin_after_reset'),
  (select payload ->> 'pin' from reset_checks where name = 'admin_reset_payload'),
  'admin reset stores the newly issued PIN for the current auth path'
);

select ok(
  (select bool_value from reset_checks where name = 'old_pin_rejected'),
  'old PIN no longer authenticates'
);

select ok(
  (select bool_value from reset_checks where name = 'new_pin_accepted'),
  'new PIN authenticates through the existing pupil auth RPC'
);

select is(
  (select int_value from reset_checks where name = 'audit_count'),
  1,
  'reset writes one pupil directory audit row'
);

select is(
  (select text_value from reset_checks where name = 'audit_safety'),
  'reset_pin',
  'audit action records reset_pin'
);

select ok(
  (select bool_value from reset_checks where name = 'audit_safety'),
  'audit metadata does not include the plaintext PIN'
);

select ok(
  (select bool_value from reset_checks where name = 'non_admin_blocked'),
  'non-admin user cannot reset a pupil PIN'
);

select ok(
  (select bool_value from reset_checks where name = 'archived_blocked'),
  'archived pupil must be restored before PIN reset'
);

select ok(
  (select bool_value from reset_checks where name = 'inactive_blocked'),
  'inactive pupil cannot have a PIN reset in this phase'
);

select ok(
  (select bool_value from reset_checks where name = 'blocked_pins_unchanged'),
  'blocked reset attempts leave archived and inactive PINs unchanged'
);

select * from finish();

rollback;

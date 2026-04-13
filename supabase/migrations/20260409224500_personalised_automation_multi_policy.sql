alter table if exists public.personalised_automation_policies
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

update public.personalised_automation_policies
set name = 'Main automation policy'
where coalesce(nullif(trim(name), ''), '') = '';

alter table if exists public.personalised_automation_policies
  alter column name set not null;

alter table if exists public.personalised_automation_policies
  drop constraint if exists personalised_automation_policies_teacher_id_key;

create index if not exists idx_personalised_automation_policies_teacher_archived_updated
  on public.personalised_automation_policies (teacher_id, archived_at, updated_at desc);

create table if not exists public.personalised_automation_policy_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  policy_id uuid not null references public.personalised_automation_policies(id) on delete cascade,
  actor_id uuid not null,
  event_type text not null check (event_type in ('created', 'updated', 'archived', 'restored', 'duplicated', 'run_started')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_personalised_automation_policy_events_policy_created
  on public.personalised_automation_policy_events (policy_id, created_at desc);

grant select, insert
  on table public.personalised_automation_policy_events
  to authenticated;

alter table if exists public.personalised_automation_policy_events
  enable row level security;

drop policy if exists "Central owners can view own personalised automation policy events"
  on public.personalised_automation_policy_events;
drop policy if exists "Central owners can insert own personalised automation policy events"
  on public.personalised_automation_policy_events;

create policy "Central owners can view own personalised automation policy events"
  on public.personalised_automation_policy_events
  for select
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can insert own personalised automation policy events"
  on public.personalised_automation_policy_events
  for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.is_central_owner());

create or replace function public.raise_personalised_automation_policy_overlap(p_policy_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conflict_group_names text;
  conflict_policy_names text;
begin
  select
    string_agg(distinct c.name, ', ' order by c.name),
    string_agg(
      distinct coalesce(nullif(trim(other_policy.name), ''), 'Untitled policy'),
      ', '
      order by coalesce(nullif(trim(other_policy.name), ''), 'Untitled policy')
    )
  into conflict_group_names, conflict_policy_names
  from public.personalised_automation_policies policy
  join public.personalised_automation_policy_targets targets
    on targets.policy_id = policy.id
  join public.personalised_automation_policy_targets other_targets
    on other_targets.class_id = targets.class_id
   and other_targets.policy_id <> targets.policy_id
  join public.personalised_automation_policies other_policy
    on other_policy.id = other_targets.policy_id
  join public.classes c
    on c.id = targets.class_id
  where policy.id = p_policy_id
    and policy.active = true
    and policy.archived_at is null
    and other_policy.teacher_id = policy.teacher_id
    and other_policy.active = true
    and other_policy.archived_at is null;

  if conflict_group_names is not null then
    raise exception 'These target groups are already used by another active automation policy: %.', conflict_group_names
      using errcode = '23514',
            detail = case
              when conflict_policy_names is not null
                then format('Conflicting policy names: %s', conflict_policy_names)
              else null
            end,
            hint = 'Remove those groups from the other active policy or keep this policy inactive.';
  end if;
end;
$$;

revoke all on function public.raise_personalised_automation_policy_overlap(uuid) from public;
grant execute on function public.raise_personalised_automation_policy_overlap(uuid) to authenticated;

create or replace function public.enforce_personalised_automation_policy_overlap_from_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active = true and new.archived_at is null then
    perform public.raise_personalised_automation_policy_overlap(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_personalised_automation_policy_overlap_from_policy() from public;
grant execute on function public.enforce_personalised_automation_policy_overlap_from_policy() to authenticated;

create or replace function public.enforce_personalised_automation_policy_overlap_from_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.raise_personalised_automation_policy_overlap(coalesce(new.policy_id, old.policy_id));
  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_personalised_automation_policy_overlap_from_target() from public;
grant execute on function public.enforce_personalised_automation_policy_overlap_from_target() to authenticated;

drop trigger if exists trg_personalised_automation_policy_overlap_from_policy
  on public.personalised_automation_policies;

create trigger trg_personalised_automation_policy_overlap_from_policy
  after insert or update of active, archived_at
  on public.personalised_automation_policies
  for each row
  execute function public.enforce_personalised_automation_policy_overlap_from_policy();

drop trigger if exists trg_personalised_automation_policy_overlap_from_target
  on public.personalised_automation_policy_targets;

create trigger trg_personalised_automation_policy_overlap_from_target
  after insert or update of class_id, policy_id
  on public.personalised_automation_policy_targets
  for each row
  execute function public.enforce_personalised_automation_policy_overlap_from_target();

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
    string_agg(
      distinct coalesce(nullif(trim(c.name), ''), 'Untitled group'),
      ', '
      order by coalesce(nullif(trim(c.name), ''), 'Untitled group')
    ),
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
    and policy.archived_at is null
    and other_policy.teacher_id = policy.teacher_id
    and other_policy.archived_at is null
    and daterange(policy.start_date, coalesce(policy.end_date, 'infinity'::date), '[]')
      && daterange(other_policy.start_date, coalesce(other_policy.end_date, 'infinity'::date), '[]');

  if conflict_group_names is not null then
    raise exception 'These target groups are already used by another automation policy in an overlapping date window: %.', conflict_group_names
      using errcode = '23514',
            detail = case
              when conflict_policy_names is not null
                then format('Conflicting policy names: %s', conflict_policy_names)
              else null
            end,
            hint = 'Adjust the dates, archive the other policy, or change the target groups.';
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
  if new.archived_at is null then
    perform public.raise_personalised_automation_policy_overlap(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_personalised_automation_policy_overlap_from_policy() from public;
grant execute on function public.enforce_personalised_automation_policy_overlap_from_policy() to authenticated;

drop trigger if exists trg_personalised_automation_policy_overlap_from_policy
  on public.personalised_automation_policies;

create trigger trg_personalised_automation_policy_overlap_from_policy
  after insert or update of start_date, end_date, archived_at
  on public.personalised_automation_policies
  for each row
  execute function public.enforce_personalised_automation_policy_overlap_from_policy();

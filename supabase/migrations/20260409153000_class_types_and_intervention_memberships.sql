alter table if exists public.classes
  add column if not exists class_type text;

update public.classes
set class_type = 'form'
where class_type is null
   or btrim(class_type) = '';

alter table if exists public.classes
  alter column class_type set default 'subject';

alter table if exists public.classes
  alter column class_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_class_type_check'
  ) then
    alter table public.classes
      add constraint classes_class_type_check
      check (class_type in ('form', 'subject', 'intervention'));
  end if;
end $$;

create index if not exists idx_classes_teacher_type_name
  on public.classes (teacher_id, class_type, name);

with duplicate_active_memberships as (
  select
    ctid,
    row_number() over (
      partition by class_id, pupil_id
      order by ctid desc
    ) as row_rank
  from public.pupil_classes
  where active is true
)
update public.pupil_classes as pupil_classes
set active = false
from duplicate_active_memberships
where pupil_classes.ctid = duplicate_active_memberships.ctid
  and duplicate_active_memberships.row_rank > 1;

create unique index if not exists idx_pupil_classes_active_membership_unique
  on public.pupil_classes (class_id, pupil_id)
  where active is true;

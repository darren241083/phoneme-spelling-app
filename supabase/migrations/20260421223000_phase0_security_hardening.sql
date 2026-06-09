begin;

drop policy if exists "dev allow all pupil_classes" on public.pupil_classes;
drop policy if exists "dev allow all pupils" on public.pupils;

alter table public.attempts enable row level security;
alter table public.test_words enable row level security;
alter table public.test_groups enable row level security;
alter table public.assignment_pupil_overrides enable row level security;

drop policy if exists "Anon can view attempts" on public.attempts;
drop policy if exists "Anon can view assignment-scoped attempts" on public.attempts;
create policy "Anon can view assignment-scoped attempts"
  on public.attempts
  for select
  to anon
  using (
    assignment_id is not null
    and public.can_access_pupil_assignment_runtime(pupil_id, assignment_id)
  );

drop policy if exists "CSV admins can view pupils" on public.pupils;
create policy "CSV admins can view pupils"
  on public.pupils
  for select
  to authenticated
  using (public.can_import_csv(auth.uid()));

drop policy if exists "CSV admins can insert pupils" on public.pupils;
create policy "CSV admins can insert pupils"
  on public.pupils
  for insert
  to authenticated
  with check (public.can_import_csv(auth.uid()));

drop policy if exists "CSV admins can update pupils" on public.pupils;
create policy "CSV admins can update pupils"
  on public.pupils
  for update
  to authenticated
  using (public.can_import_csv(auth.uid()))
  with check (public.can_import_csv(auth.uid()));

drop policy if exists "Teachers and CSV admins can insert scoped pupil classes" on public.pupil_classes;
create policy "Teachers and CSV admins can insert scoped pupil classes"
  on public.pupil_classes
  for insert
  to authenticated
  with check (
    pupil_id is not null
    and class_id is not null
    and public.can_access_pupil_runtime(pupil_id)
    and (
      public.can_import_csv(auth.uid())
      or exists (
        select 1
        from public.classes as c
        where c.id = pupil_classes.class_id
          and c.teacher_id = auth.uid()
          and public.is_teacher_compat(auth.uid())
      )
    )
  );

drop policy if exists "Teachers and CSV admins can update scoped pupil classes" on public.pupil_classes;
create policy "Teachers and CSV admins can update scoped pupil classes"
  on public.pupil_classes
  for update
  to authenticated
  using (
    class_id is not null
    and (
      public.can_import_csv(auth.uid())
      or exists (
        select 1
        from public.classes as c
        where c.id = pupil_classes.class_id
          and c.teacher_id = auth.uid()
          and public.is_teacher_compat(auth.uid())
      )
    )
  )
  with check (
    class_id is not null
    and (
      public.can_import_csv(auth.uid())
      or exists (
        select 1
        from public.classes as c
        where c.id = pupil_classes.class_id
          and c.teacher_id = auth.uid()
          and public.is_teacher_compat(auth.uid())
      )
    )
  );

drop policy if exists "Teachers and CSV admins can delete scoped pupil classes" on public.pupil_classes;
create policy "Teachers and CSV admins can delete scoped pupil classes"
  on public.pupil_classes
  for delete
  to authenticated
  using (
    class_id is not null
    and (
      public.can_import_csv(auth.uid())
      or exists (
        select 1
        from public.classes as c
        where c.id = pupil_classes.class_id
          and c.teacher_id = auth.uid()
          and public.is_teacher_compat(auth.uid())
      )
    )
  );

drop policy if exists "Authenticated users can view scoped test words" on public.test_words;
create policy "Authenticated users can view scoped test words"
  on public.test_words
  for select
  to authenticated
  using (public.can_view_test(test_id));

drop policy if exists "Teachers and admins can view scoped test groups" on public.test_groups;
create policy "Teachers and admins can view scoped test groups"
  on public.test_groups
  for select
  to authenticated
  using (
    public.is_admin_compat(auth.uid())
    or (
      teacher_id = auth.uid()
      and public.is_teacher_compat(auth.uid())
    )
  );

drop policy if exists "Teachers and admins can insert scoped test groups" on public.test_groups;
create policy "Teachers and admins can insert scoped test groups"
  on public.test_groups
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid())
      or public.is_admin_compat(auth.uid())
    )
  );

drop policy if exists "Teachers and admins can update scoped test groups" on public.test_groups;
create policy "Teachers and admins can update scoped test groups"
  on public.test_groups
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid())
      or public.is_admin_compat(auth.uid())
    )
  )
  with check (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid())
      or public.is_admin_compat(auth.uid())
    )
  );

drop policy if exists "Teachers and admins can delete scoped test groups" on public.test_groups;
create policy "Teachers and admins can delete scoped test groups"
  on public.test_groups
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid())
      or public.is_admin_compat(auth.uid())
    )
  );

drop policy if exists "Authenticated users can view scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Authenticated users can view scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil_history(pupil_id)
  );

drop policy if exists "Teachers and admins can insert scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Teachers and admins can insert scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for insert
  to authenticated
  with check (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid())
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid())
          )
        )
    )
  );

drop policy if exists "Teachers and admins can update scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Teachers and admins can update scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for update
  to authenticated
  using (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid())
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid())
          )
        )
    )
  )
  with check (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid())
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid())
          )
        )
    )
  );

drop policy if exists "Teachers and admins can delete scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Teachers and admins can delete scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for delete
  to authenticated
  using (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid())
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid())
          )
        )
    )
  );

revoke all on table public.pupils from anon;
revoke all on table public.pupil_classes from anon;
revoke all on table public.test_words from anon;
revoke all on table public.test_groups from anon;
revoke all on table public.assignment_pupil_overrides from anon;

revoke all on table public.attempts from anon;
grant select, insert on table public.attempts to anon;

commit;

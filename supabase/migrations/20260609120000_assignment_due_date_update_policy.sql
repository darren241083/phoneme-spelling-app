begin;

-- Baseline Supabase grants give authenticated users table-level UPDATE.
-- Revoke that broad privilege before granting only the due-date column.
revoke update on public.assignments_v2 from authenticated;
grant update (end_at) on public.assignments_v2 to authenticated;

drop policy if exists "Teachers can update own assignments v2" on public.assignments_v2;

create policy "Teachers can update own assignments v2"
  on public.assignments_v2
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_view_class(class_id)
  )
  with check (
    teacher_id = auth.uid()
    and public.can_view_class(class_id)
  );

commit;

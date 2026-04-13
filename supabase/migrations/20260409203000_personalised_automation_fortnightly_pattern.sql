alter table if exists public.personalised_automation_policies
  add column if not exists selected_weekdays_week_1 text[] not null default '{}'::text[],
  add column if not exists selected_weekdays_week_2 text[] not null default '{}'::text[];

update public.personalised_automation_policies
set selected_weekdays_week_1 = selected_weekdays
where selected_weekdays_week_1 = '{}'::text[];

alter table if exists public.personalised_automation_policies
  drop constraint if exists personalised_automation_policies_selected_weekdays_week_1_check,
  drop constraint if exists personalised_automation_policies_selected_weekdays_week_2_check,
  add constraint personalised_automation_policies_selected_weekdays_week_1_check
    check (selected_weekdays_week_1 <@ array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]),
  add constraint personalised_automation_policies_selected_weekdays_week_2_check
    check (selected_weekdays_week_2 <@ array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]);

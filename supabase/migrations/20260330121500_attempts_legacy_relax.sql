alter table if exists public.attempts
  alter column assignment_id drop not null,
  alter column word drop not null,
  alter column is_correct drop not null,
  alter column attempt_no drop not null;

update public.attempts
set
  correct = coalesce(correct, is_correct),
  attempt_number = coalesce(attempt_number, attempt_no),
  word_text = coalesce(word_text, word)
where
  correct is null
  or attempt_number is null
  or word_text is null;

begin;

-- Older deployed baseline gates identify baseline rows via the baseline_v1 flag.
-- Keep existing v2 rows visible to those gates without changing their v2 source/key.
update public.test_words
set choice = jsonb_set(coalesce(choice, '{}'::jsonb), '{baseline_v1}', 'true'::jsonb, true)
where choice is not null
  and (
    lower(btrim(coalesce(choice ->> 'source', ''))) = 'baseline_v2'
    or lower(btrim(coalesce(choice ->> 'baseline_v2', ''))) in ('true', '1', 'yes')
  )
  and lower(btrim(coalesce(choice ->> 'baseline_v1', ''))) not in ('true', '1', 'yes');

commit;

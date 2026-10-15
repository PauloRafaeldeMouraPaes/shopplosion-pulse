-- Seed and failure injection for the ephemeral local Supabase/PostgREST test only.
create or replace function public.pulse_intelligence_worker_token()
returns text
language sql
stable
as $$ select 'test-cron-token'::text $$;

revoke all on function public.pulse_intelligence_worker_token() from public, anon, authenticated;
grant execute on function public.pulse_intelligence_worker_token() to service_role;

insert into public.industries (id, name, slug, status)
values ('11111111-1111-4111-8111-111111111111', 'Source History Integration Test', 'source-history-integration-test', 'active')
on conflict (id) do nothing;

insert into public.intelligence_sources
  (id, industry_id, name, source_type, url, active, poll_interval_minutes)
values
  ('22222222-2222-4222-8222-222222222222',
   '11111111-1111-4111-8111-111111111111',
   'PostgREST observation RPC failure test',
   'json',
   'https://example.test/feed-failure.json',
   true,
   0),
  ('33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111',
   'PostgREST observation RPC success test',
   'json',
   'https://example.test/feed-success.json',
   true,
   0);

create or replace function public.pulse_test_reject_source_observation()
returns trigger
language plpgsql
as $pulse_test_reject_source_observation$
begin
  if new.external_id = 'postgrest-atomic-failure' then
    raise exception 'injected PostgREST observation persistence failure'
      using errcode = '55000';
  end if;
  return new;
end;
$pulse_test_reject_source_observation$;

create trigger pulse_test_reject_source_observation
before insert on public.intelligence_source_item_observations
for each row execute function public.pulse_test_reject_source_observation();

notify pgrst, 'reload schema';

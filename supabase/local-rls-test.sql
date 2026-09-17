create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal', current_setting('request.jwt.claim.aal', true)) $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.jwt() to authenticated, anon;

\i supabase/schema.sql

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '{}'::jsonb);

insert into public.clients (id, user_id, name) values
  (1, '11111111-1111-1111-1111-111111111111', 'Owner one'),
  (2, '22222222-2222-2222-2222-222222222222', 'Owner two');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 1 / case when count(*) = 1 then 1 else 0 end as owner_one_sees_one from public.clients;
reset request.jwt.claim.sub;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 1 / case when count(*) = 1 then 1 else 0 end as owner_two_sees_one from public.clients;
select 1 / case when count(*) = 0 then 1 else 0 end as cannot_see_other_owner from public.clients where id = 1;
reset role;


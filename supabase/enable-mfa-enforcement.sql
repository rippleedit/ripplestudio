-- Run only after the owner's authenticator app is enrolled and a successful
-- MFA login has been tested. This replaces the owner policies, not any data.
do $$
declare table_name text;
begin
  foreach table_name in array array['clients','projects','payments','payment_projects','time_entries'] loop
    execute format('drop policy if exists %I on public.%I', 'owner ' || replace(table_name, '_', ' '), table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid() and (auth.jwt()->>''aal'') = ''aal2'') with check (user_id = auth.uid() and (auth.jwt()->>''aal'') = ''aal2'')',
      'owner ' || replace(table_name, '_', ' '), table_name
    );
  end loop;
end $$;


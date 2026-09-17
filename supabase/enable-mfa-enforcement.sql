-- RippleStudio: require two-step login for all business data.
-- Run only after your authenticator app is set up in Studio (Your profile) and a
-- full sign-in with a code has worked. This replaces access rules, not data.
-- If you ever lose the authenticator: Supabase → Authentication → Users → your
-- user → remove the MFA factor, then set it up again in Studio.
do $$
declare table_name text;
begin
  foreach table_name in array array['clients','projects','payments','payment_projects','time_entries','paypal_transactions','paypal_senders'] loop
    execute format('drop policy if exists %I on public.%I', 'owner ' || replace(table_name, '_', ' '), table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid() and (auth.jwt()->>''aal'') = ''aal2'') with check (user_id = auth.uid() and (auth.jwt()->>''aal'') = ''aal2'')',
      'owner ' || replace(table_name, '_', ' '), table_name
    );
  end loop;
end $$;

drop policy if exists "owner profile" on public.profiles;
create policy "owner profile" on public.profiles for all to authenticated
  using (id = auth.uid() and (auth.jwt()->>'aal') = 'aal2')
  with check (id = auth.uid() and (auth.jwt()->>'aal') = 'aal2');

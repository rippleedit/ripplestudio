-- RippleStudio update 3: payments read from PayPal.
-- Two new tables; changes no existing data. The "destructive operations" warning,
-- if Supabase shows one, is about the access rules below being replaced.

-- Every incoming PayPal payment the studio has seen, keyed by PayPal's own id so
-- nothing is ever stored twice.
create table if not exists public.paypal_transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  happened_at timestamptz not null,
  payer_email text,
  payer_name text,
  gross numeric(12,2) not null,
  fee numeric(12,2) not null default 0,
  currency text not null,
  received_eur numeric(12,2),          -- what landed in euros, after fees and any conversion
  note text,
  client_id bigint,                    -- suggested from earlier payments by this sender
  status text not null default 'new' check (status in ('new', 'matched', 'dismissed')),
  payment_id bigint references public.payments(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Which client a PayPal email belongs to, learned from matches.
create table if not exists public.paypal_senders (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text not null,
  client_id bigint not null references public.clients(id) on delete cascade,
  primary key (user_id, email)
);

create index if not exists paypal_transactions_user_status_idx on public.paypal_transactions (user_id, status, happened_at desc);

alter table public.paypal_transactions enable row level security;
alter table public.paypal_senders enable row level security;
revoke all on public.paypal_transactions, public.paypal_senders from anon;
grant select, insert, update, delete on public.paypal_transactions, public.paypal_senders to authenticated;

drop policy if exists "owner paypal transactions" on public.paypal_transactions;
create policy "owner paypal transactions" on public.paypal_transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner paypal senders" on public.paypal_senders;
create policy "owner paypal senders" on public.paypal_senders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

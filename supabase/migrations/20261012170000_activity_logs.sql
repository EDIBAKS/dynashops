-- Migration: activity log table, access policies and database triggers.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  username text not null,
  activity text not null,
  reference text,
  description text,
  dpccode text
);

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_activity_idx on public.activity_logs (activity);
create index if not exists activity_logs_username_idx on public.activity_logs (username);

alter table public.activity_logs enable row level security;

-- Any signed-in user may add entries about themselves (app-side logging).
drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own" on public.activity_logs
  for insert to authenticated
  with check (user_id = auth.uid());

-- Only SuperAdmin may read. No update/delete policies: entries are immutable.
drop policy if exists "activity_logs_select_superadmin" on public.activity_logs;
create policy "activity_logs_select_superadmin" on public.activity_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.shopusers s
      where s.userid = auth.uid() and s.role = 'SuperAdmin'
    )
  );

-- ---------------------------------------------------------------------------
-- Triggers: capture changes made by any client, including direct DB edits.
-- ---------------------------------------------------------------------------

create or replace function public.log_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
  v_activity text;
  v_ref text;
  v_desc text;
  v_dpc text;
  v_user text;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  select nullif(trim(coalesce(s.firstname, '') || ' ' || coalesce(s.lastname, '')), '')
    into v_user
    from public.shopusers s
   where s.userid = auth.uid();

  v_user := coalesce(v_user, case when auth.uid() is null then 'System' else 'Unknown' end);

  if tg_table_name = 'salesheader' then
    v_ref := rec ->> 'receiptno';
    v_dpc := rec ->> 'dpccode';
    if tg_op = 'INSERT' then
      v_activity := 'Sale Created';
      v_desc := format('Receipt %s created for distributor %s', v_ref, rec ->> 'distributoridno');
    else
      v_activity := 'Receipt Deleted';
      v_desc := format('Receipt %s (distributor %s, sales date %s) deleted',
                       v_ref, rec ->> 'distributoridno', rec ->> 'salesdate');
    end if;

  elsif tg_table_name = 'debts' then
    v_ref := coalesce(rec ->> 'distributoridno', rec ->> 'id');
    v_dpc := rec ->> 'shopcode';
    if tg_op = 'INSERT' then
      v_activity := 'Debt Entry';
      v_desc := format('Debt entry: %s x %s for distributor %s',
                       rec ->> 'quantity', coalesce(rec ->> 'productname', rec ->> 'productcode'), v_ref);
    else
      v_activity := 'Debt Removed';
      v_desc := format('Debt removed: %s x %s for distributor %s',
                       rec ->> 'quantity', coalesce(rec ->> 'productname', rec ->> 'productcode'), v_ref);
    end if;
  else
    return coalesce(new, old);
  end if;

  insert into public.activity_logs (user_id, username, activity, reference, description, dpccode)
  values (auth.uid(), v_user, v_activity, v_ref, v_desc, v_dpc);

  return coalesce(new, old);
exception when others then
  -- Logging must never block the business operation.
  raise warning 'activity log trigger failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_activity_salesheader on public.salesheader;
create trigger trg_activity_salesheader
  after insert or delete on public.salesheader
  for each row execute function public.log_activity_from_trigger();

drop trigger if exists trg_activity_debts on public.debts;
create trigger trg_activity_debts
  after insert or delete on public.debts
  for each row execute function public.log_activity_from_trigger();

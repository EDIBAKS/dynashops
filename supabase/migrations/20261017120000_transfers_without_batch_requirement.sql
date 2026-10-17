-- Batch handling is under development: every stock movement works on productcode alone.
-- Any batchid argument is ignored. Where a stock table has a batchid column, incoming stock
-- goes to the 'LEGACY' row (the column is NOT NULL there); where it has none, the single row is used.
-- No ON CONFLICT is used, so this works whatever unique key the table has.

create or replace function public._has_column(p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_column
  );
$$;

-- Adds stock to a table (update the row, else insert it).
create or replace function public._add_stock_row(
  p_table text, p_productcode text, p_productname text, p_qty int, p_modifiedby text
)
returns void
language plpgsql
as $function$
declare
  has_batch boolean := public._has_column(p_table, 'batchid');
  has_name boolean := public._has_column(p_table, 'productname');
  updated int;
begin
  execute format(
    'update %I set quantity = quantity + %s, modifiedby = %L, lastmodified = now()
     where productcode = %L %s',
    p_table, p_qty, p_modifiedby, p_productcode,
    case when has_batch then 'and batchid = ''LEGACY''' else '' end
  );
  get diagnostics updated = row_count;
  if updated > 0 then
    return;
  end if;

  execute format(
    'insert into %I (productcode, %s quantity, modifiedby, lastmodified) values (%L, %s %s, %L, now())',
    p_table,
    case when has_name then 'productname,' else '' end || case when has_batch then 'batchid,' else '' end,
    p_productcode,
    case when has_name then quote_nullable(p_productname) || ',' else '' end
      || case when has_batch then '''LEGACY'',' else '' end,
    p_qty, p_modifiedby
  );
end;
$function$;

-- Removes stock for a product across all its rows (oldest first). Fails if there is not enough.
create or replace function public._deduct_stock(
  p_table text, p_productcode text, p_qty int, p_modifiedby text
)
returns void
language plpgsql
as $function$
declare
  remaining int := p_qty;
  take int;
  total int;
  r record;
begin
  execute format('select coalesce(sum(quantity), 0) from %I where productcode = %L', p_table, p_productcode)
    into total;

  if total < p_qty then
    raise exception 'Insufficient stock in % (available %, requested %)', p_table, total, p_qty;
  end if;

  for r in
    execute format(
      'select ctid as rid, quantity from %I
       where productcode = %L and quantity > 0
       order by lastmodified nulls first, ctid
       for update',
      p_table, p_productcode
    )
  loop
    exit when remaining <= 0;
    take := least(r.quantity, remaining);
    execute format(
      'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now() where ctid = %L::tid',
      p_table, take, p_modifiedby, r.rid
    );
    remaining := remaining - take;
  end loop;
end;
$function$;

-- Moves stock between two stock tables atomically.
create or replace function public._move_stock(
  p_from text, p_to text, p_productcode text, p_productname text, p_qty int, p_modifiedby text
)
returns void
language plpgsql
as $function$
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_from = p_to then
    raise exception 'Source and destination cannot be the same';
  end if;
  if not public.is_stock_table(p_from) or not public.is_stock_table(p_to) then
    raise exception 'Invalid stock table';
  end if;

  -- Same lock key for opposite transfers of a product, so they serialize instead of deadlocking
  perform pg_advisory_xact_lock(hashtext(least(p_from, p_to) || '|' || greatest(p_from, p_to) || '|' || p_productcode));

  perform public._deduct_stock(p_from, p_productcode, p_qty, p_modifiedby);
  perform public._add_stock_row(p_to, p_productcode, p_productname, p_qty, p_modifiedby);
end;
$function$;

-- Helpers run as the caller (security invoker), so table permissions/RLS still apply.
revoke all on function public._has_column(text, text) from public, anon;
revoke all on function public._add_stock_row(text, text, text, int, text) from public, anon;
revoke all on function public._deduct_stock(text, text, int, text) from public, anon;
revoke all on function public._move_stock(text, text, text, text, int, text) from public, anon;
grant execute on function public._has_column(text, text) to authenticated;
grant execute on function public._add_stock_row(text, text, text, int, text) to authenticated;
grant execute on function public._deduct_stock(text, text, int, text) to authenticated;
grant execute on function public._move_stock(text, text, text, text, int, text) to authenticated;

-- Province -> province
create or replace function public.transfer_store_stock(
  p_from_store text,
  p_to_store text,
  p_productcode text,
  p_quantity integer,
  p_modifiedby text,
  p_dispatch_date date,
  p_dispatchtype text,
  p_request_id uuid
)
returns void
language plpgsql
as $function$
begin
  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  perform public._move_stock(p_from_store, p_to_store, p_productcode, null, p_quantity, p_modifiedby);

  insert into dispatches (
    datecreated, from_location, to_location, productcode, quantity, createdby, dispatchtype
  )
  values (
    p_dispatch_date, p_from_store, p_to_store, p_productcode, p_quantity, p_modifiedby, p_dispatchtype
  );
end;
$function$;

-- Province -> shop.
drop function if exists public.transfer_stock(text, text, text, text, integer, text, date, text, uuid, text);
drop function if exists public.transfer_stock(text, text, text, text, integer, text, date, text, uuid);

create or replace function public.transfer_stock(
  p_province text,
  p_shopcode text,
  p_productcode text,
  p_productname text,
  p_quantity integer,
  p_modifiedby text,
  p_dispatch_date date,
  p_dispatchtype text,
  p_request_id uuid
)
returns void
language plpgsql
as $function$
declare
  to_table text := p_shopcode || '_STOCK';
begin
  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  perform public._move_stock(p_province, to_table, p_productcode, p_productname, p_quantity, p_modifiedby);

  insert into dispatches (
    datecreated, from_location, to_location, productcode, quantity, createdby, dispatchtype
  )
  values (
    p_dispatch_date, p_province, to_table, p_productcode, p_quantity, p_modifiedby, p_dispatchtype
  );
end;
$function$;

-- Reversal of a dispatch. Details must match the stored dispatch; repeat calls do nothing.
drop function if exists public.return_dispatch(uuid, text, text, character varying, integer, character varying);

create or replace function public.return_dispatch(
  p_dispatch_id uuid,
  p_from_table text,
  p_to_table text,
  p_productcode character varying,
  p_quantity integer,
  p_createdby character varying
)
returns void
language plpgsql
as $function$
declare
  d public.dispatches%rowtype;
begin
  select * into d from public.dispatches where id = p_dispatch_id for update;

  if not found then
    if exists (select 1 from public.withdraws where id = p_dispatch_id) then
      return;
    end if;
    raise exception 'Dispatch % not found', p_dispatch_id;
  end if;

  if d.to_location is distinct from p_from_table
     or d.productcode is distinct from p_productcode
     or d.quantity is distinct from p_quantity
     or p_to_table not in (d.from_location, d.from_location || '_STOCK') then
    raise exception 'Return details do not match dispatch %', p_dispatch_id;
  end if;

  perform public._move_stock(d.to_location, p_to_table, d.productcode, null, d.quantity, p_createdby);

  insert into public.withdraws (id, datecreated, from_location, to_location, productcode, quantity, createdby)
  values (d.id, now(), d.from_location, d.to_location, d.productcode, d.quantity, d.createdby);

  delete from public.dispatches where id = d.id;
end;
$function$;

-- Withdraw (store -> province)
drop function if exists public.withdraw_stock(text, text, text, integer, text, uuid);

create or replace function public.withdraw_stock(
  p_from_table text,
  p_to_province text,
  p_productcode text,
  p_quantity integer,
  p_createdby text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_productcode text := trim(p_productcode);
begin
  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  perform public._move_stock(p_from_table, p_to_province, v_productcode, null, p_quantity, p_createdby);

  insert into public.withdraws (id, datecreated, from_location, to_location, productcode, quantity, createdby)
  values (gen_random_uuid(), now(), p_from_table, p_to_province, v_productcode, p_quantity, p_createdby);
end;
$function$;

-- Store addition
create or replace function public.add_store_stock(
  p_store_table text,
  p_productcode text,
  p_quantity integer,
  p_dateadded date,
  p_expirydate date,
  p_modifiedby text,
  p_request_id uuid
)
returns void
language plpgsql
as $function$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if not public.is_stock_table(p_store_table) then
    raise exception 'Invalid stock table';
  end if;
  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_store_table || '|' || p_productcode));

  perform public._add_stock_row(p_store_table, p_productcode, null, p_quantity, p_modifiedby);

  execute format(
    'update %I set dateadded = %L, expirydate = %L where productcode = %L %s',
    p_store_table, p_dateadded, p_expirydate, p_productcode,
    case when public._has_column(p_store_table, 'batchid') then 'and batchid = ''LEGACY''' else '' end
  );

  insert into public.dispatchlogs (from_location, to_location, productcode, quantity, dispatchedby, status)
  values (p_modifiedby, p_store_table, p_productcode, p_quantity, p_modifiedby, 'STORE_ADDITION');
end;
$function$;

-- Edit a store addition (absolute target quantity, so retries change nothing)
drop function if exists public.edit_store_addition(uuid, integer, text);

create or replace function public.edit_store_addition(
  p_log_id uuid,
  p_new_quantity integer,
  p_modifiedby text
)
returns void
language plpgsql
as $function$
declare
  l public.dispatchlogs%rowtype;
  v_delta integer;
begin
  if p_new_quantity is null or p_new_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into l from public.dispatchlogs
  where id = p_log_id and status = 'STORE_ADDITION' for update;

  if not found then
    raise exception 'Addition not found';
  end if;
  if not public.is_stock_table(l.to_location) then
    raise exception 'Invalid stock table';
  end if;

  v_delta := p_new_quantity - l.quantity;
  if v_delta = 0 then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(l.to_location || '|' || l.productcode));

  if v_delta > 0 then
    perform public._add_stock_row(l.to_location, l.productcode, null, v_delta, p_modifiedby);
  else
    perform public._deduct_stock(l.to_location, l.productcode, -v_delta, p_modifiedby);
  end if;

  update public.dispatchlogs set quantity = p_new_quantity where id = l.id;
end;
$function$;

-- Delete a store addition (removes its stock; fails if already dispatched out)
drop function if exists public.delete_store_addition(uuid, text);

create or replace function public.delete_store_addition(
  p_log_id uuid,
  p_modifiedby text
)
returns void
language plpgsql
as $function$
declare
  l public.dispatchlogs%rowtype;
begin
  select * into l from public.dispatchlogs
  where id = p_log_id and status = 'STORE_ADDITION' for update;

  if not found then
    return;
  end if;
  if not public.is_stock_table(l.to_location) then
    raise exception 'Invalid stock table';
  end if;

  perform pg_advisory_xact_lock(hashtext(l.to_location || '|' || l.productcode));

  perform public._deduct_stock(l.to_location, l.productcode, l.quantity, p_modifiedby);

  delete from public.dispatchlogs where id = l.id;
end;
$function$;

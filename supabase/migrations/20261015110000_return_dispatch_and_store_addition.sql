-- Retry-safe return_dispatch and atomic store addition.

-- True only for real stock tables (not log/report tables).
create or replace function public.is_stock_table(p_table text)
returns boolean
language sql
stable
as $$
  select p_table is not null
    and p_table not in ('dispatches', 'dispatchlogs', 'withdraws', 'promos', 'debts', 'expiry', 'dispatch_requests')
    and (
      select count(distinct column_name)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = p_table
        and column_name in ('productcode', 'quantity', 'modifiedby', 'lastmodified')
    ) = 4;
$$;

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
  v_from_qty integer;
begin
  -- Lock the dispatch row first: concurrent or repeated returns serialize here
  select * into d from public.dispatches where id = p_dispatch_id for update;

  if not found then
    -- Already returned (e.g. earlier call committed but the response was lost)
    if exists (select 1 from public.withdraws where id = p_dispatch_id) then
      return;
    end if;
    raise exception 'Dispatch % not found', p_dispatch_id;
  end if;

  -- Never trust client-supplied values: they must match the stored dispatch
  if d.to_location is distinct from p_from_table
     or d.productcode is distinct from p_productcode
     or d.quantity is distinct from p_quantity
     or p_to_table not in (d.from_location, d.from_location || '_STOCK') then
    raise exception 'Return details do not match dispatch %', p_dispatch_id;
  end if;

  if d.quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if not public.is_stock_table(d.to_location) or not public.is_stock_table(p_to_table) then
    raise exception 'Invalid stock table';
  end if;

  execute format(
    'select quantity from %I where productcode = $1 for update',
    d.to_location
  ) into v_from_qty using d.productcode;

  if v_from_qty is null then
    raise exception 'Product % not found in %', d.productcode, d.to_location;
  end if;

  if v_from_qty < d.quantity then
    raise exception 'Insufficient stock in % (available %, requested %)',
      d.to_location, v_from_qty, d.quantity;
  end if;

  execute format(
    'update %I set quantity = quantity - $1, lastmodified = now(), modifiedby = $2 where productcode = $3',
    d.to_location
  ) using d.quantity, p_createdby, d.productcode;

  execute format(
    'insert into %1$I (productcode, quantity, lastmodified, modifiedby)
     values ($1, $2, now(), $3)
     on conflict (productcode) do update set
       quantity = %1$I.quantity + excluded.quantity,
       lastmodified = now(),
       modifiedby = excluded.modifiedby',
    p_to_table
  ) using d.productcode, d.quantity, p_createdby;

  insert into public.withdraws (id, datecreated, from_location, to_location, productcode, quantity, createdby)
  values (d.id, now(), d.from_location, d.to_location, d.productcode, d.quantity, d.createdby);

  delete from public.dispatches where id = d.id;
end;
$function$;

-- Store addition (admin adds stock to a province/store table) in one transaction
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

  execute format(
    'insert into %1$I (productcode, quantity, dateadded, expirydate, modifiedby, lastmodified)
     values ($1, $2, $3, $4, $5, now())
     on conflict (productcode) do update set
       quantity = %1$I.quantity + excluded.quantity,
       dateadded = excluded.dateadded,
       expirydate = excluded.expirydate,
       modifiedby = excluded.modifiedby,
       lastmodified = now()',
    p_store_table
  ) using p_productcode, p_quantity, p_dateadded, p_expirydate, p_modifiedby;

  insert into public.dispatchlogs (from_location, to_location, productcode, quantity, dispatchedby, status)
  values (p_modifiedby, p_store_table, p_productcode, p_quantity, p_modifiedby, 'STORE_ADDITION');
end;
$function$;

-- Make dispatch RPCs retry-safe (idempotent), validate quantities, and lock rows in a stable order.

create table if not exists public.dispatch_requests (
  request_id uuid primary key,
  created_at timestamptz not null default now()
);

grant select, insert on public.dispatch_requests to authenticated;

-- Returns true if this request_id is new (caller should proceed), false if already applied.
create or replace function public.claim_dispatch_request(p_request_id uuid)
returns boolean
language plpgsql
as $$
declare
  inserted integer;
begin
  if p_request_id is null then
    raise exception 'Request id is required';
  end if;

  insert into public.dispatch_requests (request_id)
  values (p_request_id)
  on conflict (request_id) do nothing;

  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

drop function if exists public.transfer_stock(text, text, text, text, integer, text, date, text);
drop function if exists public.transfer_store_stock(text, text, text, integer, text, date, text);
drop function if exists public.promo_dispatch(text, text, integer, text, text, date, text);
drop function if exists public.expiry_dispatch(text, text, integer, date, text, date);
drop function if exists public.debt_dispatch(text, text, integer, text, text, date, text);

-- Province -> shop
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
  from_qty int;
  to_table text := p_shopcode || '_STOCK';
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  -- Lock source row (destination may not exist yet; upsert below handles that)
  execute format(
    'select quantity from %I where productcode = %L for update',
    p_province, p_productcode
  ) into from_qty;

  if from_qty is null then
    raise exception 'Product % not found in %', p_productcode, p_province;
  end if;
  if from_qty < p_quantity then
    raise exception 'Insufficient stock in %', p_province;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L where productcode = %L',
    p_province, p_quantity, p_modifiedby, p_productcode
  );

  execute format(
    'insert into %1$I (productcode, productname, quantity, modifiedby)
     values (%2$L, %3$L, %4$s, %5$L)
     on conflict (productcode) do update
       set quantity = %1$I.quantity + excluded.quantity,
           modifiedby = excluded.modifiedby',
    to_table, p_productcode, p_productname, p_quantity, p_modifiedby
  );

  insert into dispatches (
    datecreated, from_location, to_location, productcode, quantity, createdby, dispatchtype
  )
  values (
    p_dispatch_date, p_province, to_table, p_productcode, p_quantity, p_modifiedby, p_dispatchtype
  );
end;
$function$;

-- Store -> store (DPC)
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
declare
  current_stock int;
  first_table text;
  second_table text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_from_store = p_to_store then
    raise exception 'Source and destination cannot be the same';
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  -- Lock both rows in a consistent order so opposite transfers cannot deadlock
  first_table := least(p_from_store, p_to_store);
  second_table := greatest(p_from_store, p_to_store);

  execute format('select 1 from %I where productcode = %L for update', first_table, p_productcode);
  execute format('select 1 from %I where productcode = %L for update', second_table, p_productcode);

  execute format(
    'select quantity from %I where productcode = %L',
    p_from_store, p_productcode
  ) into current_stock;

  if current_stock is null or current_stock < p_quantity then
    raise exception 'Insufficient stock in %', p_from_store;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now() where productcode = %L',
    p_from_store, p_quantity, p_modifiedby, p_productcode
  );

  execute format(
    'insert into %1$I (productcode, quantity, modifiedby, lastmodified)
     values (%2$L, %3$s, %4$L, now())
     on conflict (productcode) do update
       set quantity = %1$I.quantity + excluded.quantity,
           modifiedby = excluded.modifiedby,
           lastmodified = now()',
    p_to_store, p_productcode, p_quantity, p_modifiedby
  );

  insert into dispatches (
    datecreated, from_location, to_location, productcode, quantity, createdby, dispatchtype
  )
  values (
    p_dispatch_date, p_from_store, p_to_store, p_productcode, p_quantity, p_modifiedby, p_dispatchtype
  );
end;
$function$;

-- Shop -> promos
create or replace function public.promo_dispatch(
  p_shop_table text,
  p_productcode text,
  p_quantity integer,
  p_distributorid text,
  p_distributorname text,
  p_date date,
  p_modifiedby text,
  p_request_id uuid
)
returns void
language plpgsql
as $function$
declare
  current_stock int;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  execute format(
    'select quantity from %I where productcode = %L for update',
    p_shop_table, p_productcode
  ) into current_stock;

  if current_stock is null then
    raise exception 'Product % not found in shop table %', p_productcode, p_shop_table;
  end if;

  if current_stock < p_quantity then
    raise exception 'Insufficient stock for product % in shop %, available %, required %',
      p_productcode, p_shop_table, current_stock, p_quantity;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now() where productcode = %L',
    p_shop_table, p_quantity, p_modifiedby, p_productcode
  );

  insert into promos (shopcode, distributoridno, distributorname, productcode, quantity, date, addedby)
  values (p_shop_table, p_distributorid, p_distributorname, p_productcode, p_quantity,
          coalesce(p_date, current_date), p_modifiedby);
end;
$function$;

-- Shop -> expiry
create or replace function public.expiry_dispatch(
  p_shop_table text,
  p_productcode text,
  p_quantity integer,
  p_expirydate date,
  p_modifiedby text,
  p_dispatch_date date,
  p_request_id uuid
)
returns void
language plpgsql
as $function$
declare
  current_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_dispatch_date is null then
    raise exception 'Dispatch date is required';
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  execute format(
    'select quantity from %I where productcode = %L for update',
    p_shop_table, p_productcode
  ) into current_stock;

  if current_stock is null then
    raise exception 'Product % not found in stock table %', p_productcode, p_shop_table;
  end if;

  if current_stock < p_quantity then
    raise exception 'Insufficient stock for expiry: % required %, available %',
      p_productcode, p_quantity, current_stock;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now() where productcode = %L',
    p_shop_table, p_quantity, p_modifiedby, p_productcode
  );

  insert into expiry (shopcode, productcode, quantity, expirydate, dateadded, modifiedby)
  values (p_shop_table, p_productcode, p_quantity, p_expirydate, p_dispatch_date, p_modifiedby);
end;
$function$;

-- Shop -> debts
create or replace function public.debt_dispatch(
  p_shop_table text,
  p_productcode text,
  p_quantity integer,
  p_distributorid text,
  p_distributorname text,
  p_date date,
  p_addedby text,
  p_request_id uuid
)
returns void
language plpgsql
as $function$
declare
  current_stock int;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if not public.claim_dispatch_request(p_request_id) then
    return;
  end if;

  execute format(
    'select quantity from %I where productcode = %L for update',
    p_shop_table, p_productcode
  ) into current_stock;

  if current_stock is null then
    raise exception 'Product % not found in shop table %', p_productcode, p_shop_table;
  end if;

  if current_stock < p_quantity then
    raise exception 'Insufficient stock for product % in shop %, available %, required %',
      p_productcode, p_shop_table, current_stock, p_quantity;
  end if;

  execute format(
    'update %I set quantity = quantity - %s, modifiedby = %L, lastmodified = now() where productcode = %L',
    p_shop_table, p_quantity, p_addedby, p_productcode
  );

  insert into debts (shopcode, distributoridno, distributorname, productcode, quantity, date, addedby)
  values (p_shop_table, p_distributorid, p_distributorname, p_productcode, p_quantity,
          coalesce(p_date, current_date), p_addedby);
end;
$function$;

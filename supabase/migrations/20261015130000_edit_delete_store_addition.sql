-- Edit / delete Main Store additions (dispatchlogs rows with status STORE_ADDITION),
-- adjusting the province stock in the same transaction.

drop function if exists public.edit_store_addition(uuid, integer, text);
drop function if exists public.delete_store_addition(uuid, text);

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
  v_stock integer;
  v_delta integer;
begin
  if p_new_quantity is null or p_new_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into l
  from public.dispatchlogs
  where id = p_log_id and status = 'STORE_ADDITION'
  for update;

  if not found then
    raise exception 'Addition not found';
  end if;

  if not public.is_stock_table(l.to_location) then
    raise exception 'Invalid stock table';
  end if;

  -- Absolute target quantity, so a retry after a lost response changes nothing
  v_delta := p_new_quantity - l.quantity;
  if v_delta = 0 then
    return;
  end if;

  execute format('select quantity from %I where productcode = $1 for update', l.to_location)
    into v_stock using l.productcode;

  if v_stock is null then
    raise exception 'Product % not found in %', l.productcode, l.to_location;
  end if;

  if v_stock + v_delta < 0 then
    raise exception 'Cannot reduce: % of this stock has already been dispatched out of %',
      l.quantity - v_stock, l.to_location;
  end if;

  execute format(
    'update %I set quantity = quantity + $1, modifiedby = $2, lastmodified = now() where productcode = $3',
    l.to_location
  ) using v_delta, p_modifiedby, l.productcode;

  update public.dispatchlogs set quantity = p_new_quantity where id = l.id;
end;
$function$;

create or replace function public.delete_store_addition(
  p_log_id uuid,
  p_modifiedby text
)
returns void
language plpgsql
as $function$
declare
  l public.dispatchlogs%rowtype;
  v_stock integer;
begin
  select * into l
  from public.dispatchlogs
  where id = p_log_id and status = 'STORE_ADDITION'
  for update;

  -- Already deleted (e.g. earlier call committed but the response was lost)
  if not found then
    return;
  end if;

  if not public.is_stock_table(l.to_location) then
    raise exception 'Invalid stock table';
  end if;

  execute format('select quantity from %I where productcode = $1 for update', l.to_location)
    into v_stock using l.productcode;

  if v_stock is null then
    raise exception 'Product % not found in %', l.productcode, l.to_location;
  end if;

  if v_stock < l.quantity then
    raise exception 'Cannot delete: only % left in %, but this addition was %',
      v_stock, l.to_location, l.quantity;
  end if;

  execute format(
    'update %I set quantity = quantity - $1, modifiedby = $2, lastmodified = now() where productcode = $3',
    l.to_location
  ) using l.quantity, p_modifiedby, l.productcode;

  delete from public.dispatchlogs where id = l.id;
end;
$function$;
